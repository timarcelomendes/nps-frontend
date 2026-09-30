<script setup>
// ==========================================
// 1. IMPORTS
// ==========================================
import { useRouter, useRoute } from 'vue-router';
import { temPermissao } from './utils/permissoes';
import api from './services/api'; 
import { ref, nextTick, onMounted, computed, watch } from 'vue'; 
import { marked } from 'marked';

// PrimeVue Components
import { useToast } from 'primevue/usetoast';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Sidebar from 'primevue/sidebar';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Avatar from 'primevue/avatar';

// ==========================================
// 2. SETUP (Router & Globals)
// ==========================================
const router = useRouter();
const route = useRoute();
const toast = useToast();

// ==========================================
// 3. ESTADO (Variáveis)
// ==========================================
// -- UI / Layout
const sidebarExpandida = ref(true);
const mobileMenuAberto = ref(false);
const isDark = ref(false);

// -- UI / Dropdown do Perfil
const menuPerfilAberto = ref(false);

// -- Dados do Usuário e Avatar
const isAdmin = ref(false);
const nomeExibido = ref('');
const cargoExibido = ref('');
const iniciais = ref('');
const userEmail = ref('');
const usuarioAvatar = ref('');

// -- Modal de Perfil e Upload
const dialogPerfil = ref(false);
const salvandoPerfil = ref(false);
const perfilForm = ref({ nome: '', email: '', cargo: '' });
const previewImagem = ref(null);
const arquivoSelecionado = ref(null);

// ==========================================
// 4. COMPUTED PROPERTIES
// ==========================================
// Esconde a sidebar/menu em páginas específicas
const exibirLayout = computed(() => {
  const rotasSemMenu = ['Login', 'ForgotPassword', 'redefinir-senha', 'PesquisaPublica', 'FormularioPublico', 'Cadastro', 'Termos', 'Privacidade'];
  return !rotasSemMenu.includes(route.name);
});

// ==========================================
// 5. FUNÇÕES (Methods)
// ==========================================

// Atualiza todas as informações visuais baseadas no Storage
const atualizarDadosUsuario = () => {
  const nome = sessionStorage.getItem('usuario_nome') || '';
  const cargo = sessionStorage.getItem('usuario_cargo') || 'Analista';
  const perfil = sessionStorage.getItem('usuario_tipo') || 'Usuário'; 
  const email = sessionStorage.getItem('usuario_email') || '';
  let avatar = sessionStorage.getItem('usuario_avatar') || '';
  
  isAdmin.value = perfil.toLowerCase() === 'admin';
  userEmail.value = email;

  if (avatar.startsWith('http')) {
      usuarioAvatar.value = avatar;
    } else if (avatar) {
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      usuarioAvatar.value = `${backendUrl.replace(/\/api$/, '')}${avatar}`;
    } else {
      usuarioAvatar.value = '';
    }

  if (nome.trim()) {
    nomeExibido.value = nome;
    cargoExibido.value = cargo;
    
    const partes = nome.trim().split(/\s+/);
    if (partes.length > 1) {
      iniciais.value = (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    } else {
      iniciais.value = partes[0].substring(0, 2).toUpperCase();
    }
  } else {
    nomeExibido.value = 'Usuário';
    cargoExibido.value = '';
    iniciais.value = '??';
    usuarioAvatar.value = '';
  }
};

const toggleSidebar = () => {
  sidebarExpandida.value = !sidebarExpandida.value;
};

const toggleTema = () => {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  localStorage.setItem('darkMode', isDark.value.toString());
};

const logout = () => {
  sessionStorage.clear();
  router.push('/login');
};

const exibirBotaoChat = computed(() => {
  const rotasPublicas = ['Login', 'ResetPassword', 'RecuperarSenha', 'ForgotPassword', 'redefinir-senha', 'PesquisaPublica', 'FormularioPublico', 'Cadastro', 'Termos', 'Privacidade'];
  return !rotasPublicas.includes(route.name);
});

// --- GESTÃO DO PERFIL E IMAGEM ---
const abrirPerfil = () => {
  perfilForm.value = {
    nome: nomeExibido.value,
    cargo: cargoExibido.value,
    email: userEmail.value 
  };
  previewImagem.value = null; 
  arquivoSelecionado.value = null;
  dialogPerfil.value = true;
  menuPerfilAberto.value = false;
};

const onFileSelect = (event) => {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    arquivoSelecionado.value = file;
    previewImagem.value = URL.createObjectURL(file); 
  }
};

const salvarPerfil = async () => {
  salvandoPerfil.value = true;
  
  try {
    if (arquivoSelecionado.value) {
      const formData = new FormData();
      formData.append('file', arquivoSelecionado.value);
      
      const res = await api.post('/usuarios/me/avatar', formData);
      sessionStorage.setItem('usuario_avatar', res.data.avatar_url);
    }
    
    sessionStorage.setItem('usuario_nome', perfilForm.value.nome);
    sessionStorage.setItem('usuario_cargo', perfilForm.value.cargo);
    
    atualizarDadosUsuario();
    
    toast.add({ severity: 'success', summary: 'Sucesso!', detail: 'O seu perfil foi atualizado.', life: 3000 });
    dialogPerfil.value = false;
  } catch (error) {
    console.error("Erro ao salvar:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar os dados.' });
  } finally {
    salvandoPerfil.value = false;
  }
};

// ==========================================
// 6. LIFECYCLE & WATCHERS
// ==========================================
onMounted(() => {
  const savedTheme = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const deveEstarEscuro = savedTheme === 'true' || (savedTheme === null && prefersDark);
  
  isDark.value = deveEstarEscuro;
  document.documentElement.classList.toggle('dark', deveEstarEscuro);

  atualizarDadosUsuario();
});

watch(
  () => route.path,
  () => {
    atualizarDadosUsuario();
    if (typeof menuPerfilAberto !== 'undefined') {
      menuPerfilAberto.value = false;
    }
  }
);

const renderMarkdown = (textoCru) => {
  if (!textoCru) return '';
  
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  return marked(textoCru);
};

const chatAberto = ref(false);
const novaMensagem = ref('');
const chatCarregando = ref(false);
const historicoChat = ref([]);
const sugestoesAtivas = ref([]);
const chatContainer = ref(null);

const enviarMensagem = async () => {
  if (!novaMensagem.value.trim() || chatCarregando.value) return;

  const userText = novaMensagem.value;
  historicoChat.value.push({ role: 'user', content: userText });
  
  const iaIndex = historicoChat.value.push({ role: 'assistant', content: '' }) - 1;
  novaMensagem.value = '';
  chatCarregando.value = true;
  sugestoesAtivas.value = []; // Reseta sugestões ao perguntar algo novo

  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/perguntar`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      },
      body: JSON.stringify({ 
        mensagem: userText,
        historico: historicoChat.value.slice(-6) 
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.replace('data: ', ''));
          
          if (data.texto) {
            historicoChat.value[iaIndex].content += data.texto;
            scrollToBottom();
          }
          
          if (data.sugestoes) {
            sugestoesAtivas.value = data.sugestoes;
          }

          else if (data.erro) {
            historicoChat.value[iaIndex].content = `⚠️ Erro interno do servidor: ${data.erro}`;
            scrollToBottom();
          }
        }
      }
    }
  } catch (error) {
    historicoChat.value[iaIndex].content = "⚠️ Erro de conexão com a Rakiti AI.";
  } finally {
    chatCarregando.value = false;
    scrollToBottom();
  }
};

const perguntar = (texto) => {
  novaMensagem.value = texto;
  enviarMensagem();
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
};

const clientesRecentes = ref([]);
const tagsCarregando = ref(true);

// Aviso de teste grátis / pagamento (aparece no topo de todas as telas internas)
const assinatura = ref(null);
const carregarAssinatura = async () => {
  if (!sessionStorage.getItem('token')) { assinatura.value = null; return; }
  try { assinatura.value = (await api.get('/assinatura')).data; } catch (e) { assinatura.value = null; }
};
const avisoAssinatura = computed(() => {
  const a = assinatura.value;
  if (!a) return null;
  if (a.status === 'teste') return a.dias_restantes <= 5 ? { texto: a.mensagem, acao: 'Escolher plano', grave: false } : null;
  if (['teste_expirado', 'atrasada', 'cancelada'].includes(a.status)) return { texto: a.mensagem, acao: a.status === 'atrasada' ? 'Pagar agora' : 'Escolher plano', grave: !a.pode_enviar };
  return null;
});
watch(() => route.name, (nome) => { if (!['Login', 'Cadastro'].includes(nome)) carregarAssinatura(); });

const carregarAtalhosChat = async () => {
  if (!sessionStorage.getItem('token')) { tagsCarregando.value = false; return; }
  tagsCarregando.value = true;
  try {
    const response = await api.get('/chat/clientes-recentes');
    clientesRecentes.value = response.data;
  } catch (error) {
    console.error("Erro ao carregar atalhos dinâmicos:", error);
    clientesRecentes.value = []; 
  } finally {
    tagsCarregando.value = false;
  }
};

onMounted(() => {
  carregarAtalhosChat(); 
});

</script>

<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 antialiased overflow-hidden flex-col md:flex-row transition-colors duration-300">
    
    <Toast position="bottom-right" />
    <ConfirmDialog />

    <header v-if="exibirLayout" 
            class="md:hidden flex items-center justify-between p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30">
      
      <div class="p-5 flex items-center border-b border-slate-100 dark:border-slate-800 h-20 shrink-0" :class="sidebarExpandida ? 'justify-start' : 'justify-center !p-0'">
        
        <div v-if="sidebarExpandida" class="flex flex-col items-start relative pl-4 w-full animate-fadein">
           <div class="absolute top-0 bottom-0 left-0 w-1 bg-orange-600 dark:bg-orange-500 rounded-full"></div>
           <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tighter leading-none whitespace-nowrap">
               rakiti<span class="text-orange-600 dark:text-orange-500">.</span>
           </h1>
           <p class="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.1em] mt-1.5 pl-px whitespace-nowrap">NPS &bull; CSAT &bull; Retenção</p>
        </div>

        <div v-else class="flex items-center justify-center w-full animate-fadein">
            <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/30">
                N
            </div>
        </div>
      </div>

      <Button icon="pi pi-bars" @click="mobileMenuAberto = true" class="p-button-text !text-slate-600 dark:!text-slate-400" />
    </header>

    <Sidebar v-model:visible="mobileMenuAberto" class="w-72 dark:bg-slate-900 border-none">
      <template #header>
        <span class="font-black uppercase tracking-widest text-[10px] text-slate-400">Menu Principal</span>
      </template>
      
      <nav class="flex flex-col h-full gap-1 mt-4">
        <router-link to="/" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-chart-bar"></i> <span>Visão geral</span>
        </router-link>
        
        <router-link to="/relatorios" class="nav-item group" @click="mobileMenuAberto = false">
          <i class="pi pi-chart-line"></i> 
          <div class="flex items-center justify-between flex-1">
            <span>Relatórios</span>
            <span class="bg-indigo-500 text-[7px] text-white px-1.5 py-0.5 rounded-md font-black tracking-tighter animate-pulse shadow-sm shadow-indigo-500/50">
              AI
            </span>
          </div>
        </router-link>
        
        <router-link to="/clientes" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-building"></i> <span>Clientes</span>
        </router-link>

        <router-link to="/respostas" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-comments"></i> <span>Respostas</span>
        </router-link>

        <router-link to="/formularios" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-file-edit"></i> <span>Formulários</span>
        </router-link>

        <router-link to="/importacao" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-upload"></i> <span>Importação</span>
        </router-link>

        <router-link to="/audiencia" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-users"></i> <span>Envios</span>
        </router-link>

        <router-link v-if="isAdmin" to="/configuracoes" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-cog"></i> <span>Configurações</span>
        </router-link>

        <router-link v-if="isAdmin" to="/assinatura" class="nav-item" @click="mobileMenuAberto = false">
          <i class="pi pi-credit-card"></i> <span>Assinatura</span>
        </router-link>

        <router-link to="/acoes" class="nav-item border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10" @click="mobileMenuAberto = false">
          <i class="pi pi-check-square text-orange-500"></i> 
          <div class="flex items-center justify-between flex-1">
            <span class="text-orange-700 dark:text-orange-400 font-black">Planos de Ação</span>
            <span class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
          </div>
        </router-link>

        <div v-if="isAdmin" class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80">
          
          <span class="block px-4 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
            Ações Críticas
          </span>

          <router-link 
            to="/logs" 
            :class="[
              'group flex items-center rounded-xl transition-all duration-300 relative overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-800/80 shadow-sm mb-3',
              sidebarExpandida ? 'px-4 py-2 gap-3' : 'px-0 py-2 justify-center w-10 h-10 mx-auto'
            ]"
          >
            <div :class="[
              'shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
              sidebarExpandida ? 'w-6 h-6' : 'w-full h-full'
            ]">
              <i class="pi pi-history text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-sm"></i>
            </div>
            
            <div v-show="sidebarExpandida" class="flex flex-col pr-2 animate-fadein">
              <span class="text-[11px] font-black text-slate-700 dark:text-slate-300">Auditoria</span>
            </div>
          </router-link>

          <router-link 
            to="/admin/limpeza" 
            class="group flex items-center gap-3 px-4 py-3 rounded-[1.25rem] transition-all duration-300 relative overflow-hidden bg-rose-50/80 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:border-rose-200 dark:hover:border-rose-500/30 shadow-sm"
          >
            <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
              <div class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
            </div>
            
            <div class="w-9 h-9 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
              <i class="pi pi-exclamation-triangle text-rose-600 dark:text-rose-400 text-sm"></i>
            </div>
            
            <div class="flex flex-col pr-6">
              <span class="text-xs font-black text-rose-700 dark:text-rose-400">Zona de Risco</span>
              <span class="text-[10px] font-bold text-rose-500/80 dark:text-rose-400/80 mt-0.5 leading-tight">Limpeza de Dados</span>
            </div>
          </router-link>
          
        </div>

        <div class="mt-auto border-t border-slate-100 dark:border-slate-800 pt-6 pb-8">
          <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black shadow-lg">
                {{ iniciais }}
              </div>
              <div class="flex flex-col">
                <span class="font-black text-xs text-slate-800 dark:text-white">{{ nomeExibido }}</span>
                <span class="text-[9px] font-bold text-orange-500 uppercase tracking-widest">{{ cargoExibido }}</span>
                <span @click="logout" class="text-[9px] font-bold text-rose-500 uppercase tracking-widest cursor-pointer mt-1">Sair</span>
              </div>
            </div>
            <button 
              @click="toggleTema" 
              class="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm shrink-0"
            >
              <i :class="isDark ? 'pi pi-sun text-yellow-500' : 'pi pi-moon'"></i>
            </button>
          </div>
        </div>
      </nav>
    </Sidebar>

    <aside v-if="exibirLayout" :class="[
        'hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 h-screen fixed md:relative z-40 transition-all duration-300 ease-in-out shrink-0',
        sidebarExpandida ? 'w-72' : 'w-20'
      ]">

      <button 
        @click="sidebarExpandida = !sidebarExpandida" 
        class="absolute -right-3 top-8 bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md hover:bg-orange-600 transition-colors z-50"
      >
        <i :class="['pi text-[10px] transition-transform duration-300', sidebarExpandida ? 'pi-chevron-left' : 'pi-chevron-right']"></i>
      </button>
      
            <div class="p-5 flex items-center border-b border-slate-100 dark:border-slate-800 h-20 shrink-0" :class="sidebarExpandida ? 'justify-start' : 'justify-center !p-0'">
        
        <div v-if="sidebarExpandida" class="flex flex-col items-start relative pl-4 w-full animate-fadein">
           <div class="absolute top-0 bottom-0 left-0 w-1 bg-orange-600 dark:bg-orange-500 rounded-full"></div>
           <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tighter leading-none whitespace-nowrap">
               rakiti<span class="text-orange-600 dark:text-orange-500">.</span>
           </h1>
           <p class="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.1em] mt-1.5 pl-px whitespace-nowrap">NPS &bull; CSAT &bull; Retenção</p>
        </div>

        <div v-else class="flex items-center justify-center w-full animate-fadein">
            <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/30">
                N
            </div>
        </div>
      </div>

      <nav class="flex-1 px-3 space-y-1 mt-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
        <router-link to="/" :class="['nav-item', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Visão geral' : null">
          <i class="pi pi-chart-bar shrink-0"></i> 
          <span v-show="sidebarExpandida" class="whitespace-nowrap transition-opacity duration-300">Visão geral</span>
        </router-link>

        <router-link to="/relatorios" :class="['nav-item group', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Relatórios Inteligentes' : null">
          <i class="pi pi-chart-line shrink-0"></i> 
          <div v-show="sidebarExpandida" class="flex items-center justify-between flex-1 whitespace-nowrap transition-opacity duration-300">
            <span>Relatórios</span>
            <span class="bg-indigo-500 text-[7px] text-white px-1.5 py-0.5 rounded-md font-black tracking-tighter animate-pulse shadow-sm shadow-indigo-500/50">AI</span>
          </div>
        </router-link>

        <router-link to="/clientes" :class="['nav-item', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Clientes' : null">
          <i class="pi pi-building shrink-0"></i> 
          <span v-show="sidebarExpandida" class="whitespace-nowrap transition-opacity duration-300">Clientes</span>
        </router-link>

        <router-link to="/respostas" :class="['nav-item', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Respostas' : null">
          <i class="pi pi-comments shrink-0"></i> 
          <span v-show="sidebarExpandida" class="whitespace-nowrap transition-opacity duration-300">Respostas</span>
        </router-link>

        <router-link to="/importacao" :class="['nav-item', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Importação' : null">
          <i class="pi pi-upload shrink-0"></i> 
          <span v-show="sidebarExpandida" class="whitespace-nowrap transition-opacity duration-300">Importação</span>
        </router-link>

        <router-link to="/formularios" :class="['nav-item', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Formulários' : null">
          <i class="pi pi-file-edit shrink-0"></i> 
          <span v-show="sidebarExpandida" class="whitespace-nowrap transition-opacity duration-300">Formulários</span>
        </router-link>

        <router-link to="/audiencia" :class="['nav-item', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Envios' : null">
          <i class="pi pi-users shrink-0"></i> 
          <span v-show="sidebarExpandida" class="whitespace-nowrap transition-opacity duration-300">Envios</span>
        </router-link>

        <router-link to="/acoes" :class="['nav-item border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10', sidebarExpandida ? 'justify-start px-4' : 'justify-center px-0']" v-tooltip.right="!sidebarExpandida ? 'Planos de Ação' : null">
          <i class="pi pi-check-square text-orange-500 shrink-0"></i> 
          <div v-show="sidebarExpandida" class="flex items-center justify-between flex-1 whitespace-nowrap transition-opacity duration-300">
            <span class="text-orange-700 dark:text-orange-400 font-black">Planos de Ação</span>
            <span class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
          </div>
        </router-link>

          <div v-if="isAdmin" class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80">
            <span v-show="sidebarExpandida" class="block px-4 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 animate-fadein">
              Ações Críticas
            </span>

          <router-link to="/logs" :class="['group flex items-center rounded-xl transition-all duration-300 relative overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-800/80 shadow-sm mb-3', sidebarExpandida ? 'px-4 py-2 gap-3' : 'px-0 py-2 justify-center w-10 h-10 mx-auto']">
            <div :class="['shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110', sidebarExpandida ? 'w-6 h-6' : 'w-full h-full']">
              <i class="pi pi-history text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-sm"></i>
            </div>
            <div v-show="sidebarExpandida" class="flex flex-col pr-2 animate-fadein">
              <span class="text-[11px] font-black text-slate-700 dark:text-slate-300">Auditoria</span>
            </div>
          </router-link>

          <router-link to="/admin/limpeza" :class="['group flex items-center rounded-[1.25rem] transition-all duration-300 relative overflow-hidden bg-rose-50/80 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:border-rose-200 dark:hover:border-rose-500/30 shadow-sm', sidebarExpandida ? 'px-4 py-3 gap-3' : 'px-0 py-3 justify-center w-12 h-12 mx-auto']">
            <div v-if="sidebarExpandida" class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center animate-fadein">
              <div class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
            </div>
            <div :class="['shrink-0 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300', sidebarExpandida ? 'w-9 h-9' : 'w-10 h-10']">
              <i class="pi pi-exclamation-triangle text-rose-600 dark:text-rose-400 text-sm"></i>
            </div>
            <div v-show="sidebarExpandida" class="flex flex-col pr-6 animate-fadein">
              <span class="text-xs font-black text-rose-700 dark:text-rose-400">Zona de Risco</span>
              <span class="text-[10px] font-bold text-rose-500/80 dark:text-rose-400/80 mt-0.5 leading-tight">Limpeza de Dados</span>
            </div>
          </router-link>
        </div>
      </nav>

      <div class="mt-auto p-3 border-t border-slate-100 dark:border-slate-800 space-y-1 bg-white dark:bg-slate-900 z-10 relative shrink-0">
          <router-link v-if="isAdmin" to="/configuracoes" class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group" v-tooltip.right="!sidebarExpandida ? 'Configurações' : null">
              <i class="pi pi-cog text-[1.1rem] shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white transition-colors"></i>
              <span v-show="sidebarExpandida" class="text-[13px] tracking-tight font-medium">Configurações</span>
          </router-link>
          <router-link v-if="isAdmin" to="/assinatura" class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group" v-tooltip.right="!sidebarExpandida ? 'Assinatura' : null">
              <i class="pi pi-credit-card text-[1.1rem] shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white transition-colors"></i>
              <span v-show="sidebarExpandida" class="text-[13px] tracking-tight font-medium">Assinatura</span>
          </router-link>
          
          <button @click="sidebarExpandida = !sidebarExpandida" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors group">
              <i :class="['pi text-[1rem] shrink-0 transition-transform duration-300', sidebarExpandida ? 'pi-align-right' : 'pi-align-left']"></i>
              <span v-show="sidebarExpandida" class="text-[12px] font-bold">Recolher Menu</span>
          </button>
      </div>
    </aside>
    <div class="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      <header v-if="exibirLayout" class="h-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 md:px-8 flex items-center justify-between shrink-0 relative z-10 transition-colors">
        
        <div class="flex items-center gap-4">
        </div>

        <div class="flex items-center gap-5">
          <button 
            @click="toggleTema" 
            class="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm shrink-0"
          >
            <i :class="isDark ? 'pi pi-sun text-yellow-500' : 'pi pi-moon'"></i>
          </button>

          <div class="h-8 w-px bg-slate-200 dark:bg-slate-800"></div>

          <div class="relative flex items-center gap-3 cursor-pointer group" @click="menuPerfilAberto = !menuPerfilAberto">
            
              <div class="flex flex-col text-right hidden md:flex">
                <span class="text-[13px] font-black text-slate-800 dark:text-white leading-tight tracking-tight">{{ nomeExibido || 'Usuário' }}</span>
                <span class="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-[0.15em] mt-0.5">{{ cargoExibido || 'Analista' }}</span>
              </div>
            
            <Avatar 
              :image="usuarioAvatar" 
              :label="!usuarioAvatar ? (iniciais || 'U') : null" 
              class="rounded-full bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-500/20 dark:to-orange-500/5 text-orange-600 dark:text-orange-500 border border-orange-200 dark:border-orange-500/30 shadow-sm group-hover:scale-105 transition-all duration-300 shrink-0" 
              shape="circle" 
              style="width: 48px; height: 48px; font-size: 1.2rem; font-weight: 900;"
            />
            
              <i class="pi pi-chevron-down text-slate-400 text-[10px] transition-transform duration-300" :class="{'rotate-180': menuPerfilAberto}"></i>
            
            <transition name="fade-fast">
              <div v-if="menuPerfilAberto" class="absolute top-16 right-0 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 py-2 z-[100] transform origin-top-right">
                
                <button 
                  @click.stop="abrirPerfil" 
                  class="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <i class="pi pi-user text-slate-400"></i> O Meu Perfil
                </button>
                
                <button @click="logout" class="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
                  <i class="pi pi-sign-out"></i> Encerrar Sessão
                </button>
                
              </div>
            </transition>
          </div>
          
        </div>
      </header>

      <main class="flex-1 overflow-y-auto relative" :class="['PesquisaPublica', 'FormularioPublico', 'Cadastro', 'Termos', 'Privacidade'].includes(route.name) ? '' : 'p-6 md:p-8'">
         <div v-if="exibirLayout && avisoAssinatura" class="mb-4 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm"
              :class="avisoAssinatura.grave ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'">
           <i :class="avisoAssinatura.grave ? 'pi pi-exclamation-triangle' : 'pi pi-clock'"></i>
           <span class="flex-1">{{ avisoAssinatura.texto }}</span>
           <router-link v-if="isAdmin && route.name !== 'Assinatura'" to="/assinatura" class="font-semibold underline">{{ avisoAssinatura.acao }}</router-link>
         </div>
         <router-view />
      </main>

    </div>
  </div>

  <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="onFileSelect" />

  <button 
    v-if="exibirBotaoChat"
    @click="chatAberto = true"
    class="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white rounded-full p-4 shadow-2xl shadow-purple-900/40 transition-all hover:scale-110 flex items-center gap-2"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 animate-pulse text-white">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
    <span class="font-bold hidden md:inline">NPS AI</span>
  </button>

  <Sidebar v-if="exibirBotaoChat" v-model:visible="chatAberto" position="right" class="w-full md:w-[450px] !bg-slate-900 !text-slate-100">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <i class="pi pi-sparkles text-white text-lg"></i>
        </div>
        <div>
          <h2 class="font-bold text-lg leading-tight">Rakiti AI</h2>
          <span class="text-xs text-emerald-400 font-medium animate-pulse">● Online</span>
        </div>
      </div>
    </template>

    <div class="flex flex-col h-full overflow-hidden">
      <div ref="chatContainer" class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        <div class="flex flex-col gap-1 items-start">
          <div class="bg-slate-800 p-4 rounded-2xl rounded-tl-sm text-sm border border-slate-700 max-w-[90%] shadow-sm">
            Olá, Marcelo. Como posso ajudar a analisar os dados de produto hoje?
          </div>
        </div>

        <div v-for="(msg, index) in historicoChat" :key="index" class="flex gap-4 p-4 rounded-xl" :class="msg.role === 'user' ? 'bg-slate-800/50 ml-12' : 'bg-transparent mr-12 border border-slate-800/50'">
          
          <div 
            class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" 
            :class="msg.role === 'user' ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md'"
          >
            <i :class="msg.role === 'user' ? 'pi pi-user' : 'pi pi-sparkles'" class="text-sm"></i>
          </div>

          <div class="flex-1 overflow-hidden">
            <div class="text-xs font-bold mb-1" :class="msg.role === 'user' ? 'text-indigo-400' : 'text-fuchsia-400'">
              {{ msg.role === 'user' ? 'Você' : 'Rakiti AI' }}
            </div>
            
            <div 
              v-if="msg.content" 
              class="text-sm text-slate-300 leading-relaxed overflow-x-auto prose prose-invert max-w-none prose-p:my-1 prose-headings:mt-3 prose-headings:mb-2 prose-table:my-2 prose-td:py-1"
            >
              <span v-html="renderMarkdown(msg.content)"></span>
            </div>

            <div v-else-if="msg.role === 'ai' && chatCarregando" class="flex items-center gap-3 py-2">
              <div class="flex gap-1.5 items-center">
                <div class="w-2 h-2 rounded-full bg-fuchsia-500 animate-bounce" style="animation-delay: 0ms"></div>
                <div class="w-2 h-2 rounded-full bg-fuchsia-500 animate-bounce" style="animation-delay: 150ms"></div>
                <div class="w-2 h-2 rounded-full bg-fuchsia-500 animate-bounce" style="animation-delay: 300ms"></div>
              </div>
              <span class="text-xs text-slate-400/80 font-medium italic tracking-wide animate-pulse">
                Consultando a base de dados...
              </span>
            </div>

          </div>
        </div>

        <div v-if="sugestoesAtivas.length > 0 && !chatCarregando" class="flex flex-wrap gap-2 pt-2 animate-fade-in">
          <button 
            v-for="tag in sugestoesAtivas" 
            :key="tag"
            @click="perguntar(tag)"
            class="px-3 py-1.5 bg-slate-800/50 hover:bg-fuchsia-600/20 hover:border-fuchsia-500 border border-slate-700 rounded-full text-[11px] text-slate-300 transition-all flex items-center gap-2"
          >
            <i class="pi pi-bolt text-fuchsia-400 text-[10px]"></i>
            {{ tag }}
          </button>
        </div>
      </div>

      <div class="mt-auto p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div class="flex gap-2 overflow-x-auto mb-3 pb-1 scrollbar-hide">
          
          <button 
            v-for="cliente in clientesRecentes" 
            :key="cliente"
            @click="perguntar(`Resumo da ${cliente} nos últimos 30 dias`)" 
            :disabled="tagsCarregando || chatCarregando"
            class="text-[10px] uppercase font-bold tracking-wider whitespace-nowrap px-3 py-1.5 rounded-md border transition-all flex items-center gap-2"
            :class="[
              (tagsCarregando || chatCarregando) 
                ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-50' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
            ]"
          >
            <i v-if="tagsCarregando" class="pi pi-spin pi-spinner text-[8px]"></i>
            Resumo {{ cliente }}
          </button>

          <button 
            @click="perguntar('Gere um comparativo Trimestral de todo o portfólio')" 
            :disabled="chatCarregando"
            class="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 whitespace-nowrap px-3 py-1.5 rounded-md border border-indigo-500/30 transition-colors"
          >
            <i class="pi pi-chart-line mr-1 text-[8px]"></i> Visão Trimestral
          </button>
        </div>

        <form @submit.prevent="enviarMensagem" class="relative">
          <InputText 
            v-model="novaMensagem" 
            placeholder="Pergunte algo sobre os produtos..." 
            class="w-full !bg-slate-950 !border-slate-700 !rounded-xl !pl-4 !pr-12 !py-4 focus:!ring-fuchsia-500 !text-sm"
            :disabled="chatCarregando"
          />
          <button type="submit" :disabled="!novaMensagem.trim() || chatCarregando" 
                  class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50 disabled:bg-slate-800 transition-all shadow-lg">
            <i class="pi pi-send text-sm"></i>
          </button>
        </form>
        <p class="text-[10px] text-slate-500 mt-2 text-center">A Rakiti AI pode processar dados históricos de NPS e Planos de Ação.</p>
      </div>
    </div>
  </Sidebar>

  <Dialog 
      v-model:visible="dialogPerfil" 
      header="Os Meus Dados" 
      :modal="true" 
      :draggable="false" 
      class="custom-dialog" 
      :style="{width: '400px'}"
    >
      <div class="flex flex-col gap-6 pt-2">
        
        <div class="flex justify-center mt-2 mb-2">
          <label for="upload-foto" class="relative group cursor-pointer block rounded-full shadow-2xl">
            
            <Avatar 
              :image="previewImagem || usuarioAvatar" 
              :label="!(previewImagem || usuarioAvatar) ? (iniciais || 'U') : null" 
              class="border-4 border-white dark:border-slate-800 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-500/20 dark:to-orange-500/5 text-orange-600 dark:text-orange-500" 
              shape="circle" 
              style="width: 120px; height: 120px; font-size: 2.5rem; font-weight: 900;"
            />
            
            <div class="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <i class="pi pi-camera text-white text-3xl mb-1"></i>
              <span class="text-white text-[10px] font-black uppercase tracking-widest">Alterar</span>
            </div>
            
            <input 
              id="upload-foto" 
              type="file" 
              class="hidden" 
              accept="image/*" 
              @change="onFileSelect" 
            />
          </label>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Completo</label>
          <InputText v-model="perfilForm.nome" class="custom-input w-full" placeholder="Seu nome" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] font-black uppercase text-slate-500 ml-1">Cargo / Função</label>
          <InputText v-model="perfilForm.cargo" class="custom-input w-full" placeholder="Ex: Head de Produtos" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] font-black uppercase text-slate-500 ml-1">E-mail Corporativo</label>
          <div class="relative">
            <i class="pi pi-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <InputText 
              v-model="perfilForm.email" 
              disabled 
              class="custom-input w-full !pl-10 opacity-60 cursor-not-allowed !bg-slate-50 dark:!bg-slate-800" 
            />
          </div>
          <small class="text-[9px] text-slate-400 ml-1 italic">
            * Campo gerido pela organização (SSO).
          </small>
        </div>

      </div>

      <template #footer>
        <div class="flex items-center gap-3 w-full pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button label="Cancelar" text class="flex-1 font-bold text-xs text-slate-400" @click="dialogPerfil = false" />
          <Button label="Salvar Alterações" :loading="salvandoPerfil" @click="salvarPerfil" class="flex-1 !bg-orange-500 !border-none !rounded-xl font-bold text-xs !py-3 shadow-lg shadow-orange-500/20" />
        </div>
      </template>
    </Dialog>

</template>

<style scoped>
@reference "./style.css";

/* Transições suaves do menu */
.animate-fadein { 
  animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
}
@keyframes fadeIn { 
  from { opacity: 0; transform: translateX(-10px); } 
  to { opacity: 1; transform: translateX(0); } 
}

/* Formatação base dos botões do menu */
.nav-item {
  @apply flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-sm transition-all duration-300 w-full mb-1;
}

/* Efeito ao passar o rato (Hover) */
.nav-item:hover {
  @apply bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200;
}

/* Estado Ativo (Página atual selecionada) */
.router-link-active.nav-item {
  @apply bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-100 dark:border-orange-500/20;
}

/* Ícones do menu */
.nav-item i {
  @apply text-lg transition-colors duration-300;
}
.router-link-active.nav-item i {
  @apply text-orange-500 dark:text-orange-400;
}

/* ==========================================
   ✨ ESTILO PREMIUM PARA O TOAST (NOTIFICAÇÕES)
   ========================================== */
:deep(.p-toast) {
  /* Adiciona um espaçamento mais elegante da borda da tela */
  margin-bottom: 1rem;
  margin-right: 1rem;
}

:deep(.p-toast-message) {
  /* Arredondamento moderno estilo Apple/Vercel e efeito vidro */
  @apply rounded-2xl shadow-2xl shadow-slate-900/10 border-none backdrop-blur-md transition-all duration-300;
  overflow: hidden;
}

:deep(.p-toast-message-content) {
  /* Espaçamento interno perfeito e alinhamento do ícone */
  @apply p-4 flex items-center gap-3;
}

:deep(.p-toast-message-icon) {
  @apply text-xl;
}

/* Tipografia e cores do título e do texto */
:deep(.p-toast-summary) {
  @apply font-black text-sm tracking-wide;
}
:deep(.p-toast-detail) {
  @apply text-xs font-medium opacity-90 mt-0.5 leading-relaxed;
}

/* Cores customizadas por Severidade (Modo Claro/Escuro) */
:deep(.p-toast-message-success) {
  @apply bg-emerald-500/90 dark:bg-emerald-500/20 text-white dark:text-emerald-400 border-l-4 border-emerald-500;
}
:deep(.p-toast-message-error) {
  @apply bg-rose-500/90 dark:bg-rose-500/20 text-white dark:text-rose-400 border-l-4 border-rose-500;
}
:deep(.p-toast-message-warn) {
  @apply bg-orange-500/90 dark:bg-orange-500/20 text-white dark:text-orange-400 border-l-4 border-orange-500;
}
:deep(.p-toast-message-info) {
  @apply bg-indigo-500/90 dark:bg-indigo-500/20 text-white dark:text-indigo-400 border-l-4 border-indigo-500;
}

/* Ocultar o botão de fechar (opcional, deixa mais minimalista pois desaparece sozinho) */
:deep(.p-toast-icon-close) {
  @apply text-white/50 hover:text-white dark:text-current hover:bg-white/10 rounded-full transition-colors w-6 h-6 outline-none ring-0;
}

:deep(.p-avatar img) {
  object-fit: cover !important;
}

/* No seu style.css ou App.vue */
.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}
.prose th, .prose td {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* Estilização para as tabelas Markdown dentro do chat */
.prose table {
  @apply w-full border-collapse my-3 text-[12px] bg-slate-900/50 rounded-lg overflow-hidden;
}
.prose th {
  @apply bg-slate-700/50 p-2 text-fuchsia-400 font-bold border-b border-slate-600 text-left;
}
.prose td {
  @apply p-2 border-b border-slate-800 text-slate-300;
}
.prose h1, .prose h2 {
  @apply text-fuchsia-400 font-bold mb-2 mt-4 text-sm uppercase tracking-tight;
}
.prose blockquote {
  @apply border-l-4 border-fuchsia-500 bg-fuchsia-500/10 p-3 my-3 italic rounded-r-lg text-slate-300;
}

/* Scrollbar fina e elegante */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  @apply bg-slate-700 rounded-full;
}
</style>