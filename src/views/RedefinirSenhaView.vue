<script setup>
// Página do link "Redefinir senha" do e-mail: cria a nova senha com o token da URL (?token=...).
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../services/api';
import AcessoLayout from '../components/acesso/AcessoLayout.vue';
import AvisoAcesso from '../components/acesso/AvisoAcesso.vue';
import CampoSenha from '../components/acesso/CampoSenha.vue';
import { senhaValida, comAvisoDeDemora, mensagemGenerica, TEMPO_LIMITE } from '../components/acesso/acesso.js';

const route = useRoute();
const router = useRouter();

const token = ref('');
const emailDoToken = ref('');
const estado = ref('formulario'); // formulario | invalido | expirado | concluido
const novaSenha = ref('');
const confirmarSenha = ref('');
const erros = ref({ nova: '', confirmar: '' });
const erro = ref('');
const enviando = ref(false);
const lento = ref(false);

// Lê o e-mail e a validade do token só para exibir; quem valida de verdade é o backend.
const lerToken = (t) => {
  try {
    const base = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(base))));
  } catch (e) {
    return null;
  }
};

onMounted(() => {
  const t = typeof route.query.token === 'string' ? route.query.token : '';
  const dados = t ? lerToken(t) : null;
  if (!dados) { estado.value = 'invalido'; return; }
  token.value = t;
  emailDoToken.value = dados.sub || '';
  if (dados.exp && dados.exp * 1000 < Date.now()) estado.value = 'expirado';
});

// Só acusa diferença depois que a pessoa terminou de repetir (evita erro a cada letra).
const confirmacaoDiferente = computed(() => confirmarSenha.value.length >= novaSenha.value.length && confirmarSenha.value !== novaSenha.value && !!confirmarSenha.value);

const submeterNovaSenha = async () => {
  if (enviando.value) return;
  erro.value = '';
  erros.value = { nova: '', confirmar: '' };
  if (!senhaValida(novaSenha.value)) erros.value.nova = 'A senha ainda não atende a todas as regras abaixo.';
  if (!confirmarSenha.value) erros.value.confirmar = 'Repita a nova senha.';
  else if (confirmacaoDiferente.value) erros.value.confirmar = 'As senhas não são iguais.';
  if (erros.value.nova || erros.value.confirmar) {
    document.getElementById(erros.value.nova ? 'nova-senha' : 'confirmar-senha')?.focus();
    return;
  }

  enviando.value = true;
  try {
    await comAvisoDeDemora(() => api.post('/reset-password', { token: token.value, nova_senha: novaSenha.value }, { timeout: TEMPO_LIMITE }),
      (v) => { lento.value = v; });
    novaSenha.value = '';
    confirmarSenha.value = '';
    estado.value = 'concluido';
  } catch (e) {
    const status = e.response?.status;
    const detalhe = String(e.response?.data?.detail || '');
    if (status === 400 && /expirou|inválido/i.test(detalhe)) estado.value = 'expirado';
    else if (status === 400 && /senha/i.test(detalhe)) erros.value.nova = detalhe;
    else if (status === 404) estado.value = 'invalido';
    else erro.value = mensagemGenerica(e, 'Não foi possível salvar a nova senha. Tente de novo.');
  } finally {
    enviando.value = false;
  }
};

const irParaLogin = () => router.push({ path: '/login', query: emailDoToken.value ? { email: emailDoToken.value } : {} });
const pedirNovoLink = () => router.push({ path: '/forgot-password', query: emailDoToken.value ? { email: emailDoToken.value } : {} });
</script>

<template>
  <AcessoLayout>
    <div v-if="estado === 'concluido'" class="text-center" role="status">
      <div class="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center text-2xl">
        <i class="pi pi-check" aria-hidden="true"></i>
      </div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white mt-4">Senha alterada</h1>
      <p class="text-slate-600 dark:text-slate-300 mt-2">Pronto! Agora é só entrar com a sua nova senha.</p>
      <button type="button" class="acesso-botao mt-6" @click="irParaLogin">Entrar</button>
    </div>

    <div v-else-if="estado === 'invalido' || estado === 'expirado'" class="text-center" role="alert">
      <div class="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center text-2xl">
        <i class="pi pi-clock" aria-hidden="true"></i>
      </div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white mt-4">{{ estado === 'expirado' ? 'Este link expirou' : 'Link incompleto ou inválido' }}</h1>
      <p class="text-slate-600 dark:text-slate-300 mt-2">
        {{ estado === 'expirado'
          ? 'Por segurança, o link para criar uma nova senha vale por 30 minutos. Peça um novo e use o mais recente.'
          : 'Abra o link direto do e-mail, sem cortar nenhuma parte. Se não der certo, peça um novo.' }}
      </p>
      <div class="flex flex-col gap-3 mt-6">
        <button type="button" class="acesso-botao" @click="pedirNovoLink">Pedir um novo link</button>
        <button type="button" class="acesso-botao-sec" @click="irParaLogin">Voltar para o login</button>
      </div>
    </div>

    <form v-else @submit.prevent="submeterNovaSenha" class="flex flex-col gap-4" novalidate :aria-busy="enviando">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Crie uma nova senha</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
          <template v-if="emailDoToken">Para a conta <strong class="break-all text-slate-800 dark:text-slate-200">{{ emailDoToken }}</strong>.</template>
          Depois de salvar, use a nova senha para entrar.
        </p>
      </div>

      <!-- ajuda o gerenciador de senhas a salvar a senha na conta certa -->
      <input type="email" name="email" autocomplete="username" :value="emailDoToken" class="sr-only" tabindex="-1" aria-hidden="true" readonly />

      <AvisoAcesso v-if="erro" tipo="erro">{{ erro }}</AvisoAcesso>

      <CampoSenha id="nova-senha" v-model="novaSenha" rotulo="Nova senha" autocomplete="new-password" mostrar-regras :erro="erros.nova"
        @update:model-value="erros.nova = ''" />
      <CampoSenha id="confirmar-senha" v-model="confirmarSenha" rotulo="Repita a nova senha" autocomplete="new-password"
        :erro="erros.confirmar || (confirmacaoDiferente ? 'As senhas não são iguais.' : '')" @update:model-value="erros.confirmar = ''" />

      <p v-if="lento" class="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2" role="status">
        <i class="pi pi-spin pi-spinner text-orange-600" aria-hidden="true"></i>
        Conectando ao servidor, isso pode levar alguns segundos.
      </p>

      <button type="submit" class="acesso-botao" :disabled="enviando">
        <i v-if="enviando" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
        {{ enviando ? 'Salvando...' : 'Salvar nova senha' }}
      </button>

      <p class="mt-2 pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-center text-slate-600 dark:text-slate-300">
        <a href="/login" @click.prevent="irParaLogin" class="acesso-link">Voltar para o login</a>
      </p>
    </form>
  </AcessoLayout>
</template>
