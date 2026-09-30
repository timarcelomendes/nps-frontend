<script setup>
// Login, pedido de acesso de funcionário ("Solicitar uma conta") e entrada com Microsoft.
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PublicClientApplication } from '@azure/msal-browser';
import api from '../services/api';
import AcessoLayout from '../components/acesso/AcessoLayout.vue';
import CampoSenha from '../components/acesso/CampoSenha.vue';
import AvisoAcesso from '../components/acesso/AvisoAcesso.vue';
import { senhaValida, emailValido, emailPessoal, comAvisoDeDemora, mensagemGenerica, TEMPO_LIMITE } from '../components/acesso/acesso.js';

const router = useRouter();
const route = useRoute();

const modo = ref('login'); // login | solicitar | solicitado
const enviando = ref(false);
const lento = ref(false);
const aviso = ref(null); // { tipo, titulo, texto, reenviar?, links? }
const erros = ref({ nome: '', email: '', senha: '' });
const reenviando = ref(false);

const credenciais = ref({ email: '', password: '' });
const lembrarDeMim = ref(false);
const registro = ref({ nome: '', email: '', password: '' });
const mensagemSolicitado = ref('');

const ssoAtivo = ref(false);
const entrandoMicrosoft = ref(false);
let msalInstance = null;

const avisoEmailPessoal = computed(() => modo.value === 'solicitar' && emailValido(registro.value.email) && emailPessoal(registro.value.email));

const limparMensagens = () => {
  aviso.value = null;
  erros.value = { nome: '', email: '', senha: '' };
};

const irPara = async (novoModo) => {
  limparMensagens();
  modo.value = novoModo;
  if (novoModo === 'solicitar') registro.value = { nome: '', email: credenciais.value.email, password: '' };
  credenciais.value.password = '';
  await nextTick();
  document.getElementById(novoModo === 'solicitar' ? 'nome' : 'email')?.focus();
};

// Formato do sessionStorage usado pelo resto do app (não alterar as chaves).
const armazenarSessao = (dados) => {
  sessionStorage.setItem('token', dados.access_token || '');
  sessionStorage.setItem('usuario_nome', dados.nome || 'Usuário');
  sessionStorage.setItem('usuario_tipo', dados.tipo || 'Usuário');
  sessionStorage.setItem('usuario_cargo', dados.cargo || 'Analista');
  sessionStorage.setItem('usuario_email', dados.email || '');
  sessionStorage.setItem('usuario_avatar', dados.avatar_url || dados.avatar || '');
  sessionStorage.setItem('usuario_superadmin', dados.superadmin ? 'true' : 'false');
  sessionStorage.setItem('usuario_permissoes', JSON.stringify(Array.isArray(dados.permissoes) ? dados.permissoes : []));
};

const entrarNoApp = () => {
  router.push('/').catch(() => { window.location.href = '/'; });
};

// --- Mensagens de erro do login, a partir do status e do texto que o backend devolve ---
const tratarErroLogin = (erro) => {
  const status = erro.response?.status;
  const detalhe = String(erro.response?.data?.detail || '');
  const d = detalhe.toLowerCase();

  if (status === 401 && d.includes('não está cadastrado')) {
    erros.value.email = 'Não encontramos uma conta com este e-mail. Confira se digitou certo.';
    aviso.value = { tipo: 'info', texto: 'Sua empresa ainda não usa a Rakiti? Crie a conta dela no teste grátis de 14 dias.', links: ['cadastro'] };
    document.getElementById('email')?.focus();
  } else if (status === 401 && d.includes('senha')) {
    erros.value.senha = 'Senha incorreta. Tente de novo ou use "Esqueci a senha".';
    document.getElementById('senha')?.focus();
  } else if (status === 403 && d.includes('verificado')) {
    aviso.value = { tipo: 'atencao', titulo: 'Confirme o seu e-mail', texto: 'Enviamos um link de confirmação quando a conta foi criada. Abra o e-mail (olhe também o spam) e clique no link. Não achou? Envie outro.', reenviar: true };
  } else if (status === 403 && (d.includes('inativa') || d.includes('aprovação'))) {
    aviso.value = { tipo: 'atencao', titulo: 'Sua conta ainda não está liberada', texto: 'Se você pediu acesso há pouco, o administrador da sua empresa precisa aprovar o pedido. Se o seu acesso foi desativado, fale com ele.' };
  } else if (status === 403 && d.includes('domínio')) {
    aviso.value = { tipo: 'erro', titulo: 'E-mail não autorizado', texto: `${detalhe} Fale com o administrador da sua empresa.` };
  } else {
    aviso.value = { tipo: 'erro', texto: mensagemGenerica(erro, 'Não foi possível entrar. Tente de novo.') };
  }
};

const fazerLogin = async () => {
  if (enviando.value) return;
  limparMensagens();
  const email = credenciais.value.email.trim();
  if (!emailValido(email)) erros.value.email = email ? 'Digite um e-mail válido, como nome@empresa.com.br.' : 'Digite o seu e-mail.';
  if (!credenciais.value.password) erros.value.senha = 'Digite a sua senha.';
  if (erros.value.email || erros.value.senha) {
    document.getElementById(erros.value.email ? 'email' : 'senha')?.focus();
    return;
  }

  enviando.value = true;
  try {
    const response = await comAvisoDeDemora(() => api.post('/login', {
      email,
      password: credenciais.value.password,
      remember: lembrarDeMim.value,
    }, { timeout: TEMPO_LIMITE }), (v) => { lento.value = v; });

    armazenarSessao(response.data);
    if (lembrarDeMim.value) localStorage.setItem('nps_remember_email', email);
    else localStorage.removeItem('nps_remember_email');
    entrarNoApp();
  } catch (erro) {
    tratarErroLogin(erro);
  } finally {
    enviando.value = false;
  }
};

const reenviarConfirmacao = async () => {
  const email = (modo.value === 'login' ? credenciais.value.email : registro.value.email).trim();
  if (!emailValido(email)) {
    erros.value.email = 'Digite o seu e-mail acima para reenviar a confirmação.';
    document.getElementById('email')?.focus();
    return;
  }
  reenviando.value = true;
  try {
    await comAvisoDeDemora(() => api.post('/reenviar-confirmacao', { email }, { timeout: TEMPO_LIMITE }), (v) => { lento.value = v; });
    aviso.value = { tipo: 'sucesso', titulo: 'E-mail reenviado', texto: `Enviamos um novo link de confirmação para ${email}. Ele vale por 24 horas; use sempre o mais recente.` };
  } catch (erro) {
    const status = erro.response?.status;
    if (status === 400) aviso.value = { tipo: 'info', texto: erro.response.data?.detail };
    else if (status === 404) aviso.value = { tipo: 'erro', texto: 'Não encontramos uma conta com este e-mail. Confira se digitou certo.' };
    else aviso.value = { tipo: 'erro', texto: mensagemGenerica(erro, 'Não foi possível reenviar o e-mail.') };
  } finally {
    reenviando.value = false;
  }
};

const solicitarConta = async () => {
  if (enviando.value) return;
  limparMensagens();
  const { nome, password } = registro.value;
  const email = registro.value.email.trim();
  if (!nome.trim()) erros.value.nome = 'Digite o seu nome completo.';
  if (!emailValido(email)) erros.value.email = email ? 'Digite um e-mail válido, como nome@empresa.com.br.' : 'Digite o seu e-mail da empresa.';
  if (!senhaValida(password)) erros.value.senha = 'A senha ainda não atende a todas as regras abaixo.';
  const primeiro = ['nome', 'email', 'senha'].find((c) => erros.value[c]);
  if (primeiro) {
    document.getElementById(primeiro === 'senha' ? 'nova-senha' : primeiro)?.focus();
    return;
  }

  enviando.value = true;
  try {
    const response = await comAvisoDeDemora(() => api.post('/register', {
      nome: nome.trim(),
      email,
      password,
      url_plataforma: window.location.origin,
    }, { timeout: TEMPO_LIMITE }), (v) => { lento.value = v; });
    mensagemSolicitado.value = response.data?.mensagem || '';
    registro.value.password = '';
    modo.value = 'solicitado';
  } catch (erro) {
    const status = erro.response?.status;
    const detalhe = String(erro.response?.data?.detail || '');
    if (status === 403 && detalhe.includes('identificar a sua empresa')) {
      aviso.value = { tipo: 'atencao', titulo: 'Não achamos a sua empresa pelo e-mail', texto: `Nenhuma empresa na Rakiti libera o domínio @${email.split('@')[1]}. Use o e-mail da empresa ou peça ao administrador para criar o seu acesso. Se a sua empresa ainda não usa a Rakiti, comece o teste grátis.`, links: ['cadastro'] };
    } else if (status === 400 && detalhe.includes('já possui')) {
      erros.value.email = 'Este e-mail já tem uma conta. Faça login ou use "Esqueci a senha".';
    } else if (status === 400 && detalhe.toLowerCase().includes('senha')) {
      erros.value.senha = detalhe;
    } else {
      aviso.value = { tipo: 'erro', texto: mensagemGenerica(erro, 'Não foi possível enviar o pedido. Tente de novo.') };
    }
  } finally {
    enviando.value = false;
  }
};

const enviar = () => (modo.value === 'login' ? fazerLogin() : solicitarConta());

const irParaEsqueci = () => {
  const email = credenciais.value.email.trim();
  router.push({ path: '/forgot-password', query: emailValido(email) ? { email } : {} });
};

// --- Microsoft (SSO) ---
const loginComMicrosoft = async () => {
  limparMensagens();
  if (!msalInstance) {
    aviso.value = { tipo: 'erro', texto: 'A entrada com Microsoft não está disponível no momento.' };
    return;
  }
  entrandoMicrosoft.value = true;
  try {
    await msalInstance.loginRedirect({ scopes: ['User.Read'] });
  } catch (erro) {
    entrandoMicrosoft.value = false;
    aviso.value = { tipo: 'erro', texto: 'Não foi possível abrir a entrada com Microsoft. Tente de novo.' };
  }
};

const iniciarMicrosoft = async () => {
  const res = await api.get('/auth/sso-config', { timeout: TEMPO_LIMITE });
  if (!res.data?.sso_ativo || !res.data.client_id) return;
  ssoAtivo.value = true;
  msalInstance = new PublicClientApplication({
    auth: {
      clientId: res.data.client_id,
      authority: `https://login.microsoftonline.com/${res.data.tenant_id}`,
      redirectUri: window.location.origin + '/login',
    },
    cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
  });
  await msalInstance.initialize();
  const retorno = await msalInstance.handleRedirectPromise();
  if (!retorno) return;
  const authRes = await api.post('/auth/microsoft', { access_token: retorno.accessToken }, { timeout: TEMPO_LIMITE });
  if (authRes.data?.access_token) {
    armazenarSessao(authRes.data);
    entrarNoApp();
  }
};

onMounted(async () => {
  const status = route.query.status;
  if (status === 'confirmado') {
    aviso.value = { tipo: 'sucesso', titulo: 'E-mail confirmado!', texto: 'Se você criou a conta da sua empresa, já pode entrar. Se pediu acesso a uma empresa, o administrador dela precisa aprovar antes do seu primeiro login.' };
  } else if (status === 'erro' || route.query.erro) {
    aviso.value = { tipo: 'erro', titulo: 'Link de confirmação expirado ou inválido', texto: 'Digite o seu e-mail abaixo e envie um link novo. Use sempre o link mais recente.', reenviar: true };
  }
  if (status || route.query.erro || route.query.email) router.replace({ query: {} });
  const avisoSessao = sessionStorage.getItem('aviso_login');
  if (avisoSessao && !aviso.value) {
    aviso.value = { tipo: 'info', texto: avisoSessao };
    sessionStorage.removeItem('aviso_login');
  }

  const emailSalvo = localStorage.getItem('nps_remember_email');
  if (typeof route.query.email === 'string' && emailValido(route.query.email)) {
    credenciais.value.email = route.query.email;
  } else if (emailSalvo) {
    credenciais.value.email = emailSalvo;
    lembrarDeMim.value = true;
  }

  const voltandoDaMicrosoft = window.location.hash.includes('code=') || window.location.hash.includes('state=');
  if (voltandoDaMicrosoft) entrandoMicrosoft.value = true;
  try {
    await iniciarMicrosoft();
  } catch (erro) {
    const texto = String(erro?.errorMessage || erro?.message || '');
    if (/AADSTS65004|access_denied|user_cancelled|User declined/i.test(texto)) {
      aviso.value = { tipo: 'info', texto: 'A entrada com Microsoft foi cancelada. Tente de novo se quiser.' };
    } else if (erro?.response) {
      aviso.value = { tipo: 'erro', texto: mensagemGenerica(erro, 'Não foi possível entrar com Microsoft.') };
    } else if (voltandoDaMicrosoft) {
      aviso.value = { tipo: 'erro', texto: 'Não foi possível concluir a entrada com Microsoft. Tente de novo.' };
    }
  } finally {
    entrandoMicrosoft.value = false;
  }
});
</script>

<template>
  <AcessoLayout>
    <template #lateral>
      <h1 class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight">
        Saiba quem está insatisfeito antes de perder o cliente.
      </h1>
      <p class="text-lg text-slate-600 dark:text-slate-300 mt-4">
        Pesquisas de NPS e satisfação por e-mail e link, com alerta para notas baixas e plano de ação.
      </p>
      <ul class="mt-6 flex flex-col gap-2 text-slate-700 dark:text-slate-200">
        <li><i class="pi pi-check-circle text-orange-500 mr-2" aria-hidden="true"></i>Respostas e notas em um só painel</li>
        <li><i class="pi pi-check-circle text-orange-500 mr-2" aria-hidden="true"></i>Alerta quando um cliente fica insatisfeito</li>
        <li><i class="pi pi-check-circle text-orange-500 mr-2" aria-hidden="true"></i>Plano de ação para não perder o cliente</li>
      </ul>
    </template>

    <!-- Pedido de acesso enviado -->
    <div v-if="modo === 'solicitado'" class="text-center" role="status">
      <div class="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center text-2xl">
        <i class="pi pi-envelope" aria-hidden="true"></i>
      </div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white mt-4">Pedido enviado</h1>
      <p class="text-slate-600 dark:text-slate-300 mt-2">{{ mensagemSolicitado || 'Confira o seu e-mail para confirmar o endereço.' }}</p>
      <ol class="text-left mt-6 flex flex-col gap-3 text-sm text-slate-700 dark:text-slate-200">
        <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center">1</span>Abra o e-mail que enviamos para <strong class="break-all">{{ registro.email }}</strong> e clique no link (vale por 24 horas). Olhe também o spam.</li>
        <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center">2</span>O administrador da sua empresa aprova o seu acesso.</li>
        <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center">3</span>Depois disso, é só entrar com o seu e-mail e senha.</li>
      </ol>
      <button type="button" class="acesso-botao mt-8" @click="credenciais.email = registro.email; irPara('login')">Voltar para o login</button>
    </div>

    <form v-else @submit.prevent="enviar" class="flex flex-col gap-4" novalidate :aria-busy="enviando">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">{{ modo === 'login' ? 'Entrar na Rakiti' : 'Pedir acesso à sua empresa' }}</h1>
        <p v-if="modo === 'login'" class="text-sm text-slate-600 dark:text-slate-400 mt-1">Use o e-mail e a senha da sua conta.</p>
      </div>

      <AvisoAcesso v-if="modo === 'solicitar'" tipo="info" titulo="Para quem trabalha numa empresa que já usa a Rakiti">
        Use o seu e-mail da empresa. O administrador dela recebe o pedido e aprova o seu acesso.
        Sua empresa ainda não usa a Rakiti?
        <a href="/cadastro" @click.prevent="router.push('/cadastro')" class="acesso-link">Comece o teste grátis de 14 dias</a>.
      </AvisoAcesso>

      <AvisoAcesso v-if="aviso" :tipo="aviso.tipo" :titulo="aviso.titulo">
        {{ aviso.texto }}
        <a v-if="aviso.links?.includes('cadastro')" href="/cadastro" @click.prevent="router.push('/cadastro')" class="acesso-link block mt-1">Começar teste grátis</a>
        <button v-if="aviso.reenviar" type="button" @click="reenviarConfirmacao" :disabled="reenviando"
          class="mt-3 w-full sm:w-auto min-h-10 px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-current font-semibold inline-flex items-center justify-center gap-2 acesso-foco">
          <i :class="reenviando ? 'pi pi-spin pi-spinner' : 'pi pi-envelope'" aria-hidden="true"></i>
          {{ reenviando ? 'Reenviando...' : 'Reenviar e-mail de confirmação' }}
        </button>
      </AvisoAcesso>

      <div v-if="modo === 'solicitar'">
        <label for="nome" class="acesso-rotulo">Nome completo</label>
        <input id="nome" v-model="registro.nome" name="name" autocomplete="name" maxlength="150" class="acesso-campo"
          :aria-invalid="erros.nome ? 'true' : undefined" :aria-describedby="erros.nome ? 'nome-erro' : undefined" @input="erros.nome = ''" />
        <p v-if="erros.nome" id="nome-erro" class="acesso-erro-campo">{{ erros.nome }}</p>
      </div>

      <div>
        <label for="email" class="acesso-rotulo">{{ modo === 'login' ? 'E-mail' : 'E-mail da empresa' }}</label>
        <input v-if="modo === 'login'" id="email" v-model="credenciais.email" type="email" name="email" autocomplete="email" inputmode="email"
          placeholder="nome@empresa.com.br" class="acesso-campo" :aria-invalid="erros.email ? 'true' : undefined"
          :aria-describedby="erros.email ? 'email-erro' : undefined" @input="erros.email = ''" />
        <input v-else id="email" v-model="registro.email" type="email" name="email" autocomplete="email" inputmode="email"
          placeholder="nome@empresa.com.br" class="acesso-campo" :aria-invalid="erros.email ? 'true' : undefined"
          :aria-describedby="erros.email ? 'email-erro' : (avisoEmailPessoal ? 'email-pessoal' : undefined)" @input="erros.email = ''" />
        <p v-if="erros.email" id="email-erro" class="acesso-erro-campo">{{ erros.email }}</p>
        <p v-else-if="avisoEmailPessoal" id="email-pessoal" class="mt-1 text-sm text-amber-800 dark:text-amber-300">
          E-mails pessoais (Gmail, Hotmail etc.) não identificam a sua empresa. Use o e-mail da empresa ou peça ao administrador para criar o seu acesso.
        </p>
      </div>

      <CampoSenha v-if="modo === 'login'" id="senha" v-model="credenciais.password" autocomplete="current-password" :erro="erros.senha"
        @update:model-value="erros.senha = ''" />
      <CampoSenha v-else id="nova-senha" v-model="registro.password" rotulo="Crie uma senha" autocomplete="new-password" mostrar-regras
        :erro="erros.senha" @update:model-value="erros.senha = ''" />

      <div v-if="modo === 'login'" class="flex flex-wrap items-center justify-between gap-2">
        <label for="lembrar" class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input id="lembrar" v-model="lembrarDeMim" type="checkbox" class="w-4 h-4 accent-orange-600 acesso-foco" />
          Lembrar meu e-mail
        </label>
        <a href="/forgot-password" @click.prevent="irParaEsqueci" class="acesso-link text-sm">Esqueci a senha</a>
      </div>

      <p v-if="lento" class="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2" role="status">
        <i class="pi pi-spin pi-spinner text-orange-600" aria-hidden="true"></i>
        Conectando ao servidor, isso pode levar alguns segundos.
      </p>

      <button type="submit" class="acesso-botao" :disabled="enviando || entrandoMicrosoft">
        <i v-if="enviando" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
        <template v-if="modo === 'login'">{{ enviando ? 'Entrando...' : 'Entrar' }}</template>
        <template v-else>{{ enviando ? 'Enviando pedido...' : 'Pedir acesso' }}</template>
      </button>

      <template v-if="modo === 'login' && ssoAtivo">
        <div class="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400" aria-hidden="true">
          <span class="flex-1 h-px bg-slate-200 dark:bg-slate-800"></span>ou<span class="flex-1 h-px bg-slate-200 dark:bg-slate-800"></span>
        </div>
        <button type="button" class="acesso-botao-sec" @click="loginComMicrosoft" :disabled="entrandoMicrosoft">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
            <path fill="#f35325" d="M0 0h11v11H0z" /><path fill="#81bc06" d="M12 0h11v11H12z" /><path fill="#05a6f0" d="M0 12h11v11H0z" /><path fill="#ffba08" d="M12 12h11v11H12z" />
          </svg>
          {{ entrandoMicrosoft ? 'Entrando com Microsoft...' : 'Entrar com Microsoft' }}
        </button>
      </template>

      <div class="mt-2 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 text-sm text-center text-slate-600 dark:text-slate-300">
        <template v-if="modo === 'login'">
          <p>Empresa nova por aqui? <a href="/cadastro" @click.prevent="router.push('/cadastro')" class="acesso-link whitespace-nowrap">Teste grátis por 14 dias</a></p>
          <p>Sua empresa já usa a Rakiti? <a href="#" @click.prevent="irPara('solicitar')" class="acesso-link whitespace-nowrap">Solicitar uma conta</a></p>
          <p>Não recebeu o e-mail de confirmação?
            <button type="button" @click="reenviarConfirmacao" :disabled="reenviando" class="acesso-link">{{ reenviando ? 'Reenviando...' : 'Reenviar' }}</button>
          </p>
        </template>
        <p v-else>Já tem conta? <a href="#" @click.prevent="irPara('login')" class="acesso-link">Entrar</a></p>
      </div>
    </form>
  </AcessoLayout>
</template>
