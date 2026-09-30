<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300 relative overflow-hidden font-sans">
    
    <div class="fixed inset-0 z-0 opacity-40 dark:opacity-100 pointer-events-none">
      <div v-for="n in 50" :key="n" 
           class="absolute bg-slate-300 dark:bg-white rounded-full animate-twinkle"
           :style="{
             width: Math.random() * 3 + 'px',
             height: Math.random() * 3 + 'px',
             top: Math.random() * 100 + '%',
             left: Math.random() * 100 + '%',
             animationDelay: Math.random() * 5 + 's',
             animationDuration: Math.random() * 3 + 2 + 's'
           }">
      </div>
    </div>

    <transition name="fade">
      <div v-if="processandoRetorno" class="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[999] flex items-center justify-center">
        <div class="flex flex-col items-center gap-8 text-center p-10 bg-slate-950 rounded-3xl border border-slate-800 shadow-3xl w-[340px] relative overflow-hidden">
          <div class="absolute -top-20 -left-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-20 -right-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="flex items-center gap-1.5 w-full justify-center relative h-8 mt-2">
            <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-slate-800 rounded-full z-0"></div>
            <div v-for="n in 10" :key="n" :class="['w-5 h-5 rounded-full border-4 border-slate-950 z-10 transition-all duration-300 transform scale-100', 'bg-slate-800 loading-dot-' + n]"></div>
            <div class="absolute -right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-950 z-20 loading-check-final shadow-lg">
                <i class="pi pi-check text-white text-xs font-bold"></i>
            </div>
          </div>
          
          <div class="flex flex-col gap-1.5 relative z-10">
            <span class="text-base font-black text-white tracking-tighter uppercase">Mapeando Jornada</span>
            <span class="text-xs text-slate-400 leading-tight">Validando as credenciais de acesso seguro à plataforma...</span>
          </div>
        </div>
      </div>
    </transition>
    
    <div class="fixed top-4 right-4 z-50 flex items-center gap-2">
      
      <button @click="ajudaVisivel = true" class="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-orange-500 hover:text-orange-500 transition-all shadow-sm" title="Como funciona esta tela?">
        <i class="pi pi-question-circle text-[1.1rem]"></i>
      </button>

      <button @click="toggleDarkMode" class="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-orange-300 dark:hover:border-orange-500 transition-all shadow-sm">
        <i :class="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'"></i>
      </button>
      
      <button v-if="!isLoginMode" @click="alternarModo" class="px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-500 transition-all shadow-sm">
        <i class="pi pi-arrow-left text-[10px]"></i> Voltar
      </button>
    </div>

    <Sidebar v-model:visible="ajudaVisivel" position="right" class="w-full md:w-[400px] !bg-white dark:!bg-slate-950 dark:border-l dark:border-slate-800" :showCloseIcon="true">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-xl border border-orange-200 dark:border-orange-500/30">
            <i class="pi pi-book text-orange-600 dark:text-orange-500 text-xl"></i>
          </div>
          <div class="flex flex-col">
            <h2 class="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tight">Guia da Tela</h2>
            <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Acesso & Segurança</span>
          </div>
        </div>
      </template>
      
      <div class="mt-6 flex flex-col gap-6">
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Bem-vindo à autenticação do <strong>Rakiti</strong>. Aqui você valida sua identidade para acessar a gestão de clientes.
        </p>

        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2">
            <i class="pi pi-microsoft text-indigo-500"></i> Acesso via Microsoft
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Se a sua conta corporativa Microsoft já estiver configurada, clique em <strong>"Entrar com Microsoft"</strong> para acessar sem precisar decorar novas senhas.
          </p>
        </div>

        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2">
            <i class="pi pi-user-plus text-emerald-500"></i> Solicitar Acesso
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Ainda não tem conta? Clique em <strong>"Solicitar uma conta"</strong>. O administrador receberá um alerta e, após aprovar, você receberá um e-mail de confirmação.
          </p>
        </div>

        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
          <h3 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2">
            <i class="pi pi-shield text-orange-500"></i> Erros Comuns
          </h3>
          <ul class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed list-disc pl-4 flex flex-col gap-1">
            <li><strong>Usuário inativo:</strong> Se você foi desligado do projeto, a tela mostrará uma mensagem em vermelho.</li>
            <li><strong>Link expirado:</strong> Se pediu reenvio de e-mail de validação, use sempre o link mais recente que chegou na caixa de entrada.</li>
          </ul>
        </div>
      </div>
    </Sidebar>

    <div class="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center z-10 relative">
      
      <div class="hidden md:flex flex-col gap-6 pr-8 transition-all animate-fadein">
        <div class="flex items-center gap-1 ml-[-2px]">
          <div class="flex flex-col items-start relative">
             <div class="absolute top-0 bottom-0 left-[-15px] w-1 bg-orange-600 dark:bg-orange-500 rounded-full"></div>
             <h1 class="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
               rakiti<span class="text-orange-600 dark:text-orange-500">.</span>
             </h1>
             <p class="text-[11px] text-indigo-400 font-bold uppercase tracking-[0.2em] mt-2 pl-px">NPS &bull; CSAT &bull; Retenção</p>
          </div>
        </div>
        
        <p class="text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
          A plataforma Rakiti para gestão da <strong class="text-orange-600 dark:text-orange-500 font-bold">experiência do cliente</strong>. Centralize respostas, automatize disparos em background e impulsione a lealdade com inteligência de dados.
        </p>
        
        <div class="flex items-center gap-6 mt-4">
          <p class="text-sm text-slate-500 dark:text-slate-500 font-medium">Saiba quem está insatisfeito antes de perder o cliente.</p>
        </div>
      </div>

      <div class="w-full max-w-md mx-auto md:max-w-full bg-white dark:bg-slate-900/60 p-8 md:p-10 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/30 backdrop-blur-xl animate-fadein relative overflow-hidden">
        
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div class="flex items-center gap-3 mb-10 pb-6 border-b border-slate-100 dark:border-slate-800 relative z-10">
          <div class="md:hidden flex flex-col items-start relative ml-px">
             <div class="absolute top-0 bottom-0 left-[-12px] w-1 bg-orange-600 dark:bg-orange-500 rounded-full"></div>
             <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
               rakiti<span class="text-orange-600 dark:text-orange-500">.</span>
             </h2>
          </div>
          <h2 class="hidden md:block text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
            {{ isLoginMode ? 'Acessar a Plataforma' : 'Criar Nova Conta' }}
          </h2>
        </div>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-5 relative z-10" novalidate>
          
          <div v-if="erros.geral" class="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 p-4 rounded-xl flex items-center gap-3 animate-fadein shadow-sm transition-colors duration-300">
            <i class="pi pi-exclamation-triangle text-lg shrink-0"></i>
            <span class="text-[11.5px] font-bold leading-tight">{{ erros.geral }}</span>
          </div>

          <div v-if="!isLoginMode" class="flex flex-col gap-1.5 animate-fadein">
            <label for="nome" class="text-sm font-bold text-slate-700 dark:text-slate-300">Nome Completo</label>
            <span class="p-input-icon-left">
              <i class="pi pi-user text-slate-400" :class="{'!text-rose-500': erros.nome}" />
              <InputText id="nome" v-model="registro.nome" name="name" autocomplete="name" placeholder="Ex: João da Silva" class="w-full custom-input" :class="{'!border-rose-500 ring-2 ring-rose-500/20': erros.nome}" @input="limparErroDe('nome')" />
            </span>
            <small v-if="erros.nome" class="text-xs font-bold text-rose-500 pl-2 mt-0.5 animate-fadein">{{ erros.nome }}</small>
          </div>

          <div class="flex flex-col gap-1.5 animate-fadein">
            <label for="email" class="text-sm font-bold text-slate-700 dark:text-slate-300">E-mail Corporativo</label>
            <span class="p-input-icon-left">
              <i class="pi pi-envelope text-slate-400" :class="{'!text-rose-500': erros.email}" />
              
              <InputText v-if="isLoginMode" 
                id="email" 
                v-model="credenciais.email" 
                type="email" 
                name="username"
                autocomplete="username"
                placeholder="seu@email.com.br" 
                class="w-full custom-input" 
                :class="{'!border-rose-500 ring-2 ring-rose-500/20': erros.email || erros.geral}" 
                @input="limparErroDe('email')" 
              />

              <InputText v-else 
                id="email_reg" 
                v-model="registro.email" 
                type="email" 
                name="email"
                autocomplete="email"
                placeholder="seu@email.com.br" 
                class="w-full custom-input" 
                :class="{'!border-rose-500 ring-2 ring-rose-500/20': erros.email}" 
                @input="limparErroDe('email')" />
            </span>
            <small v-if="erros.email" class="text-xs font-bold text-rose-500 pl-2 mt-0.5 animate-fadein">{{ erros.email }}</small>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Senha</label>
            
            <Password v-if="isLoginMode"
              v-model="credenciais.password" 
              name="password"
              autocomplete="current-password"
              placeholder="••••••••" 
              :feedback="false" 
              toggleMask 
              maxlength="70"
              class="w-full"
              inputClass="custom-input w-full"
              @keyup.enter="handleSubmit"
            />

            <Password v-else
              v-model="registro.password" 
              name="new-password"
              autocomplete="new-password"
              placeholder="••••••••" 
              :feedback="true" 
              toggleMask 
              maxlength="70"
              class="w-full"
              inputClass="custom-input w-full"
              promptLabel="Escolha uma senha forte"
              weakLabel="Fraca"
              mediumLabel="Média"
              strongLabel="Forte"
            >
              <template #header>
                <h6 class="text-xs font-bold mb-2">Requisitos:</h6>
              </template>
              <template #footer>
                <Divider />
                <ul class="pl-2 ml-2 mt-0 text-xs list-disc leading-relaxed">
                  <li>Mínimo 8 caracteres</li>
                  <li>Pelo menos uma letra maiúscula</li>
                  <li>Pelo menos um número</li>
                  <li>Pelo menos um caractere especial (@$!%*?&)</li>
                </ul>
              </template>
            </Password>
          </div>

          <div v-if="isLoginMode" class="flex items-center justify-between gap-2 mt-1">
            <div class="flex items-center gap-2">
              <Checkbox v-model="lembrarDeMim" :binary="true" inputId="lembrar" />
              <label for="lembrar" class="ml-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">Lembrar meu e-mail</label>
            </div>
            
            <a @click.prevent="router.push('/forgot-password')" href="#" class="text-xs font-bold text-slate-500 hover:text-orange-600 dark:hover:text-orange-500 transition-colors duration-200">
              Esqueceu a senha?
            </a>
          </div>

          <Button type="submit" :loading="loading" class="w-full custom-submit-btn group mt-2 transition-all duration-300">
            <template #loading><i class="pi pi-spin pi-spinner mr-2 text-sm"></i></template>
            <span class="flex items-center justify-center gap-2 w-full text-[14px] font-bold tracking-wide">
              {{ isLoginMode ? 'Entrar na Plataforma' : 'Criar Minha Conta' }}
              <i :class="isLoginMode ? 'pi pi-arrow-right' : 'pi pi-user-plus'" class="text-[10px] opacity-70 group-hover:translate-x-1 transition-transform"></i>
            </span>
          </Button>
          
          <div v-if="isLoginMode && ssoAtivo" class="relative my-4">
            <Divider align="center" class="custom-divider">
              <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-4 uppercase tracking-[0.2em]">OU</span>
            </Divider>
          </div>
          
          <Button v-if="isLoginMode && ssoAtivo" @click="loginComMicrosoft" type="button" class="w-full custom-ms-btn group pButton transition-colors duration-200" :disabled="loadingMicrosoft">
            <template #loading><i class="pi pi-spin pi-spinner mr-2"></i></template>
            <span class="flex items-center justify-center gap-3 w-full font-semibold text-[14px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 23 23">
                <path fill="#f35325" d="M0 0h11v11H0z"/><path fill="#81bc06" d="M12 0h11v11H12z"/><path fill="#05a6f0" d="M0 12h11v11H0z"/><path fill="#ffba08" d="M12 12h11v11H12z"/>
              </svg>
              {{ loadingMicrosoft ? 'Autenticando...' : 'Entrar com Microsoft' }}
            </span>
          </Button>

          <div class="mt-4 flex flex-col gap-4 text-center">
            <p v-if="isLoginMode" class="text-sm text-slate-600 dark:text-slate-300">
              Nova por aqui? <a href="/cadastro" @click.prevent="$router.push('/cadastro')" class="font-bold text-orange-600 hover:underline">Teste grátis por 14 dias</a>
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {{ isLoginMode ? 'Não tem acesso?' : 'Já possui uma conta?' }}
              <a @click.prevent="alternarModo" href="#" class="font-bold text-slate-800 dark:text-white hover:text-orange-600 dark:hover:text-orange-500 transition-colors duration-300">
                {{ isLoginMode ? 'Solicitar uma conta' : 'Fazer login' }}
              </a>
            </p>

            <div v-if="isLoginMode" class="pt-4 border-t border-slate-200 dark:border-slate-800/60">
              <p class="text-[11px] text-slate-500 dark:text-slate-600 font-medium">
                Aguardando aprovação por e-mail? 
                <a @click.prevent="reenviarEmail" href="#" class="font-bold text-orange-600 hover:text-orange-500 hover:underline inline-flex items-center gap-1 transition-colors duration-200">
                  <i class="pi" :class="loadingReenvio ? 'pi-spin pi-spinner' : 'pi-envelope'" style="font-size: 0.6rem"></i>
                  Reenviar link de verificação
                </a>
              </p>
            </div>
          </div>

        </form>
      </div>
    </div>
    
    <div class="fixed bottom-4 left-4 z-10 transition-colors duration-500">
      <p class="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Rakiti © {{ new Date().getFullYear() }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { PublicClientApplication } from '@azure/msal-browser';
import api from '../services/api';

// 🚨 IMPORTAÇÕES RESTAURADAS - O QUE HAVIA QUEBRADO A TELA
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Divider from 'primevue/divider';
import Toast from 'primevue/toast';
import Sidebar from 'primevue/sidebar';

const router = useRouter();
const route = useRoute();
const toast = useToast(); 

// --- ESTADOS DE UI E CONTROLE ---
const processandoRetorno = ref(false);
const isLoginMode = ref(true); 
const loading = ref(false);
const isDarkMode = ref(true);
const ssoAtivo = ref(false);
const loadingMicrosoft = ref(false);
const loadingReenvio = ref(false);
const ajudaVisivel = ref(false); // 🚨 VARIÁVEL RESTAURADA
let msalInstance = null;

// --- DADOS DO FORMULÁRIO E ERROS ---
const credenciais = ref({ email: '', password: '' });
const registro = ref({ nome: '', email: '', password: '' });
const lembrarDeMim = ref(false);

const erros = ref({
  geral: '',
  nome: '',
  email: '',
  password: ''
});

// --- FUNÇÕES DE INTERFACE ---
const limparErros = () => {
  erros.value = { geral: '', nome: '', email: '', password: '' };
};

const limparErroDe = (campo) => {
  erros.value[campo] = '';
  erros.value.geral = '';
};

const alternarModo = () => {
  isLoginMode.value = !isLoginMode.value;
  limparErros();
  registro.value = { nome: '', email: '', password: '' };
  credenciais.value.password = '';
};

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  document.documentElement.classList.toggle('dark', isDarkMode.value);
  localStorage.setItem('darkMode', isDarkMode.value.toString());
};

const armazenarSessao = (dados) => {
  try {
    sessionStorage.setItem('token', dados.access_token || ''); // 🎯 Use 'token' para bater com o Router
    sessionStorage.setItem('usuario_nome', dados.nome || 'Usuário');
    sessionStorage.setItem('usuario_tipo', dados.tipo || 'Usuário');
    sessionStorage.setItem('usuario_cargo', dados.cargo || 'Analista');
    sessionStorage.setItem('usuario_email', dados.email || '');
    sessionStorage.setItem('usuario_avatar', dados.avatar_url || '');
    sessionStorage.setItem('usuario_superadmin', dados.superadmin ? 'true' : 'false');

    const listaPermissoes = Array.isArray(dados.permissoes) ? dados.permissoes : [];
    sessionStorage.setItem('usuario_permissoes', JSON.stringify(listaPermissoes));

    console.log("✅ Dados salvos no Storage.");
  } catch (error) {
    console.error("❌ Erro ao processar dados:", error);
    throw error;
  }
};

const mostrarAvisoBloqueio = () => {
    toast.add({
        severity: 'warn', 
        summary: 'Acesso Temporariamente Bloqueado', 
        detail: 'Fez demasiadas tentativas. Por favor, aguarde 1 minuto antes de tentar novamente.', 
        life: 6000 
    });
};

// --- CICLO DE VIDA (INIT) --
onMounted(async () => {
  window.addEventListener('api-rate-limit', mostrarAvisoBloqueio);
  const savedTheme = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const isDark = savedTheme === 'true' || (savedTheme === null && prefersDark);
  
  isDarkMode.value = isDark;
  document.documentElement.classList.toggle('dark', isDark);

  if (window.location.hash.includes('code=') || window.location.hash.includes('state=')) {
      processandoRetorno.value = true;
  }

// Mude de route.query.verificado para route.query.status
  if (route.query.status === 'confirmado') {
      toast.add({ 
        severity: 'success', 
        summary: 'E-mail Confirmado!', 
        detail: 'Sua conta foi verificada. Aguarde a aprovação do administrador.', 
        life: 8000 
      });
      router.replace({ query: {} }); 
  } else if (route.query.status === 'erro' || route.query.erro) {
      erros.value.geral = 'O link de verificação expirou ou é inválido.';
      router.replace({ query: {} });
  }

  const emailSalvo = localStorage.getItem('nps_remember_email');
    if (emailSalvo) {
      credenciais.value.email = emailSalvo;
      lembrarDeMim.value = true; // 🎯 Se existe e-mail, começa marcado!
    }
  
  try {
    const res = await api.get('/auth/sso-config'); 
    
    if (res.data && res.data.sso_ativo && res.data.client_id) {
        ssoAtivo.value = true; 
        
        const msalConfig = {
            auth: {
                clientId: res.data.client_id,
                authority: `https://login.microsoftonline.com/${res.data.tenant_id}`, 
                redirectUri: window.location.origin + '/login', 
            },
            cache: { cacheLocation: "sessionStorage", storeAuthStateInCookie: false }
        };
        
        msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();

        const responseMSAL = await msalInstance.handleRedirectPromise();
        
        if (responseMSAL) {
            loadingMicrosoft.value = true;
            processandoRetorno.value = true;
            
            const authRes = await api.post('/auth/microsoft', { 
                access_token: responseMSAL.accessToken 
            });

            if (authRes.data.access_token) {
                armazenarSessao(authRes.data);
                setTimeout(() => { router.push('/'); }, 1500);
            }
        }
    }
  } catch (error) {
      loadingMicrosoft.value = false;
      processandoRetorno.value = false;
      
      let msgErro = "Falha ao autenticar com a Microsoft.";
      
      // 🎯 TRATAMENTO DO ERRO AADSTS65004 E CANCELAMENTOS
      const strErro = error.error_description || error.message || String(error);
      
      if (strErro.includes('AADSTS65004') || strErro.includes('access_denied') || strErro.includes('User declined')) {
          msgErro = "O login seguro foi cancelado ou as permissões foram recusadas. Tente novamente se desejar entrar.";
      } 
      // Tratamento de erros do nosso próprio backend
      else if (error.response && error.response.data && error.response.data.detail) {
          msgErro = error.response.data.detail; 
      } 
      // Outros erros desconhecidos
      else if (strErro) {
          msgErro = strErro; 
      }
      
      erros.value.geral = msgErro; 
  }
});

onUnmounted(() => {
  window.removeEventListener('api-rate-limit', mostrarAvisoBloqueio);
});

// --- REQUISIÇÕES (API) ---
const handleSubmit = () => {
  if (isLoginMode.value) { fazerLogin(); } else { fazerRegistro(); }
};

const fazerLogin = async () => {
  if (loading.value) return;
  limparErros();

  loading.value = true;
  processandoRetorno.value = true;

  try {
    const response = await api.post('/login', {
      email: credenciais.value.email,
      password: credenciais.value.password,
      remember: lembrarDeMim.value
    });

    armazenarSessao(response.data);
    
    if (lembrarDeMim.value) {
      localStorage.setItem('nps_remember_email', credenciais.value.email);
    } else {
      localStorage.removeItem('nps_remember_email');
    }

    console.log("🚀 Iniciando transição...");

    setTimeout(() => {

      processandoRetorno.value = false; 
      loading.value = false;

      router.push('/').catch(err => {
        console.error("Erro no Router:", err);
        window.location.href = '/'; 
      });
    }, 2500);

  } catch (error) {
    processandoRetorno.value = false;
    loading.value = false;
    erros.value.geral = error.response?.data?.detail || "Erro ao autenticar.";
  }
};

const fazerRegistro = async () => {
  limparErros();
  let possuiErro = false;

  if (!registro.value.nome || registro.value.nome.trim() === '') { 
    erros.value.nome = 'O nome completo é obrigatório.'; 
    possuiErro = true; 
  }
  
  if (!registro.value.email || registro.value.email.trim() === '') { 
    erros.value.email = 'O e-mail é obrigatório.'; 
    possuiErro = true; 
  }

  if (!registro.value.password) { 
    erros.value.password = 'Crie uma senha de acesso.'; 
    possuiErro = true; 
  } else if (registro.value.password.length < 6) { 
    erros.value.password = 'A senha deve conter no mínimo 6 caracteres.'; 
    possuiErro = true; 
  }
  
  if (possuiErro) {
    console.log("❌ Erros de validação encontrados:", erros.value);
    return;
  }

loading.value = true;
  try {
    console.log("🚀 Enviando registro:", registro.value);
    
    const response = await api.post('/register', {
        nome: registro.value.nome,
        email: registro.value.email,
        password: registro.value.password,
        url_plataforma: window.location.origin 
    });

    toast.add({ 
      severity: 'success', 
      summary: 'Conta Solicitada!', 
      detail: response.data.mensagem || 'Aguarde aprovação.', 
      life: 5000 
    });
    
    alternarModo();
    
  } catch (error) {
    console.error("❌ Erro no registro:", error);
    erros.value.geral = error.response?.data?.detail || 'Erro ao solicitar acesso. Tente novamente.';
  } finally {
    loading.value = false;
  }
};

const loginComMicrosoft = async () => {
    limparErros(); 
    if (!msalInstance) {
        erros.value.geral = "O serviço de SSO da Microsoft não está disponível no momento.";
        return;
    }
    
    loadingMicrosoft.value = true;
    try {
        await msalInstance.loginRedirect({ scopes: ["User.Read"] });
    } catch (error) {
        loadingMicrosoft.value = false;
        erros.value.geral = error.message || "Falha ao iniciar o login seguro da Microsoft.";
    }
};

const reenviarEmail = async () => {
  limparErros();
  const emailAlvo = credenciais.value.email;
  
  if (!emailAlvo) {
    erros.value.email = 'Digite o seu e-mail aqui antes de solicitar o reenvio.';
    return;
  }

  loadingReenvio.value = true;
  try {
    await api.post('/reenviar-confirmacao', { email: emailAlvo });
    toast.add({ severity: 'success', summary: 'E-mail Enviado', detail: 'Verifique a sua caixa de entrada.', life: 6000 });
  } catch (error) {
    erros.value.geral = error.response?.data?.detail || 'Não foi possível reenviar o e-mail.';
  } finally {
    loadingReenvio.value = false;
  }
};
</script>

<style scoped>
@reference "../style.css";

/* =========================================================
   1. ANIMAÇÕES GERAIS E LAYOUT
========================================================= */
.animate-fadein { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* =========================================================
   2. INPUTS E ÍCONES DO PRIMEVUE
========================================================= */
.p-input-icon-left {
  display: flex !important;
  align-items: center !important;
  position: relative !important;
  width: 100%;
}

.p-input-icon-left > i {
  position: absolute !important;
  left: 1.1rem !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  z-index: 30 !important;
  pointer-events: none;
  font-size: 1rem !important;
}

:deep(.custom-input),
:deep(.p-password input) {
  width: 100% !important;
  border-radius: 1.2rem !important;
  padding: 0.9rem 1rem 0.9rem 3.2rem !important;
  border: 1.5px solid #e2e8f0 !important;
  background-color: #f8fafc !important;
  color: #1e293b !important;
  font-weight: 500 !important;
  font-size: 0.95rem !important;
  transition: all 0.3s ease !important;
  outline: none !important;
}

:deep(.custom-input:focus),
:deep(.p-password input:focus) {
  border-color: #f97316 !important;
  background-color: #ffffff !important;
  box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1) !important;
}

:deep(.p-password) { width: 100% !important; }
:deep(.p-password-reveal-icon) { right: 1.2rem !important; color: #94a3b8 !important; }

:global(.dark) :deep(.custom-input),
:global(.dark) :deep(.p-password input) {
  background-color: #1e293b !important;
  border-color: #334155 !important;
  color: #f8fafc !important;
}

:global(.dark) :deep(.custom-input:focus),
:global(.dark) :deep(.p-password input:focus) {
  background-color: #0f172a !important;
  border-color: #f97316 !important;
  box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.2) !important;
}

:deep(.p-invalid) .custom-input,
:deep(.p-invalid) input {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1) !important;
}

/* =========================================================
   3. BOTÕES PREMIUM
========================================================= */
:deep(.custom-submit-btn) {
  background: linear-gradient(180deg, #f97316 0%, #ea580c 100%) !important;
  border: 1px solid #c2410c !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2) !important;
  color: white !important;
  border-radius: 1.2rem !important; 
  padding: 0.9rem 1rem !important; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

:deep(.custom-submit-btn:hover:not(:disabled)) {
  background: linear-gradient(180deg, #fb923c 0%, #f97316 100%) !important;
  box-shadow: 0 4px 14px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.3) !important;
  transform: translateY(-1px);
}

:deep(.custom-submit-btn:active:not(:disabled)) {
  transform: scale(0.98) translateY(0);
  box-shadow: none !important;
}

:deep(.custom-ms-btn) {
  background-color: transparent !important;
  border: 1.5px solid #e2e8f0 !important; 
  color: #334155 !important;
  border-radius: 1.2rem !important; 
  padding: 0.9rem 1rem !important;
  transition: all 0.2s ease !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
}

:global(.dark) :deep(.custom-ms-btn) {
  border-color: #334155 !important;
  color: #e2e8f0 !important;
}

:deep(.custom-ms-btn:hover:not(:disabled)) {
  background-color: #f8fafc !important; 
  border-color: #cbd5e1 !important; 
}

:global(.dark) :deep(.custom-ms-btn:hover:not(:disabled)) {
  background-color: #0f172a !important; 
  border-color: #475569 !important; 
}

:deep(.custom-ms-btn:active:not(:disabled)) { transform: scale(0.98); }

/* =========================================================
   4. JORNADA NPS (Animação de Loading Overlay)
========================================================= */
@keyframes fillDot {
  0% { transform: scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes colorDetractor { 100% { background-color: #ef4444; border-color: #ef4444; } }
@keyframes colorPassive { 100% { background-color: #f59e0b; border-color: #f59e0b; } }
@keyframes colorPromoter { 100% { background-color: #10b981; border-color: #10b981; } }

.loading-dot-1 { animation: fillDot 0.4s ease-out forwards, colorDetractor 0.1s forwards 0.4s; animation-delay: 0.1s; }
.loading-dot-2 { animation: fillDot 0.4s ease-out forwards, colorDetractor 0.1s forwards 0.8s; animation-delay: 0.3s; }
.loading-dot-3 { animation: fillDot 0.4s ease-out forwards, colorDetractor 0.1s forwards 1.2s; animation-delay: 0.5s; }
.loading-dot-4 { animation: fillDot 0.4s ease-out forwards, colorDetractor 0.1s forwards 1.6s; animation-delay: 0.7s; }
.loading-dot-5 { animation: fillDot 0.4s ease-out forwards, colorDetractor 0.1s forwards 2.0s; animation-delay: 0.9s; }
.loading-dot-6 { animation: fillDot 0.4s ease-out forwards, colorDetractor 0.1s forwards 2.4s; animation-delay: 1.1s; }
.loading-dot-7 { animation: fillDot 0.4s ease-out forwards, colorPassive 0.1s forwards 2.8s; animation-delay: 1.3s; }
.loading-dot-8 { animation: fillDot 0.4s ease-out forwards, colorPassive 0.1s forwards 3.2s; animation-delay: 1.5s; }
.loading-dot-9 { animation: fillDot 0.4s forwards, colorPromoter 0.1s forwards 3.6s; animation-delay: 1.7s; }
.loading-dot-10 { animation: fillDot 0.4s forwards, colorPromoter 0.1s forwards 4.0s; animation-delay: 1.9s; }

@keyframes checkPop {
  0% { transform: translate(50%, -50%) scale(0); opacity: 0; }
  80% { transform: translate(50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(50%, -50%) scale(1); opacity: 1; border-color: #10b981; }
}
.loading-check-final {
  opacity: 0;
  animation: checkPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: 2.3s; 
}
</style>