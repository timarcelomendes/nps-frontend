import { createRouter, createWebHistory } from 'vue-router';

// Mantenha aqui os imports que já tinha
// import LoginView from '../views/LoginView.vue'; // (Descomente se estiver importando no topo)
import AdminLimpezaView from '../views/AdminLimpezaView.vue';

const routes = [
  // ==========================================
  // 🔓 ROTAS PÚBLICAS (Autenticação)
  // ==========================================
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'), // Certifique-se de importar corretamente
    meta: { requiresAuth: false } 
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/redefinir-senha',
    name: 'redefinir-senha', 
    component: () => import('../views/RedefinirSenhaView.vue'),
    meta: { requiresAuth: false }
  },
  
  {
    // Formulário de pesquisa que o cliente final responde (link do e-mail/WhatsApp)
    path: '/r/:token',
    name: 'PesquisaPublica',
    component: () => import('../views/PesquisaPublicaView.vue'),
    meta: { requiresAuth: false }
  },

  // ==========================================
  // 🔒 ROTAS PRIVADAS (Core da Aplicação)
  // ==========================================
{
  path: '/',
  name: 'Dashboard',
  component: () => import('../views/DashboardView.vue'),
  meta: { 
    requiresAuth: true, 
    // Aceita as variações para evitar bloqueio por acentuação
    roles: ['Admin', 'Manager', 'Viewer', 'Usuário', 'Usuario', 'usuario'] 
  }
},
  {
    path: '/respostas',
    name: 'Respostas',
    component: () => import('../views/RespostasView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/acoes',
    name: 'Acoes',
    component: () => import('../views/AcoesView.vue'),
    // 🎯 CORREÇÃO: Adicionado 'Usuário'
    meta: { requiresAuth: true, roles: ['Admin', 'Manager', 'Viewer', 'Usuário'] } 
  },
  {
    path: '/audiencia',
    name: 'Audiencia',
    component: () => import('../views/AudienciaView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/clientes',
    name: 'Clientes', 
    component: () => import('../views/ClientesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/relatorios',
    name: 'Relatorios',
    component: () => import('../views/RelatoriosView.vue'),
    meta: { requiresAuth: true }
  },

  // ==========================================
  // ⚙️ ROTAS PRIVADAS (Gestão e Sistema)
  // ==========================================
  {
    path: '/configuracoes',
    name: 'Configuracoes',
    component: () => import('../views/ConfiguracoesView.vue'),
    meta: { requiresAuth: true, roles: ['Admin'] } // 🚫 APENAS ADMINS
  },
  {
    path: '/importacao',
    name: 'Importacao',
    component: () => import('../views/ImportacaoView.vue'),
    meta: { requiresAuth: true, roles: ['Admin', 'Manager'] } // 🚫 SEM VIEWERS / USUÁRIOS
  },
  {
    path: '/admin/limpeza',
    name: 'limpeza-dados',
    component: AdminLimpezaView,
    meta: { requiresAuth: true, roles: ['Admin'] } 
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('../views/LogsView.vue'),
    meta: { requiresAuth: true, roles: ['Admin'] } 
  },

  // ==========================================
  // ❌ ROTA FALLBACK (Página não encontrada)
  // ==========================================
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

// ==========================================
// 🛡️ GUARDIÃO DE NAVEGAÇÃO BLINDADO
// ==========================================
router.beforeEach((to, from, next) => {
  const token = sessionStorage.getItem('token');
  const isAuthenticated = !!token;
  
  // 🎯 NORMALIZAÇÃO TOTAL: Tudo em minúsculo e sem depender de acentos complexos
  const rawTipo = (sessionStorage.getItem('usuario_tipo') || 'usuário').toLowerCase();

  if (to.path === '/login' && isAuthenticated) return next('/');
  if (to.meta.requiresAuth && !isAuthenticated) return next('/login');

  if (to.meta.roles) {
    // 🎯 COMPARAÇÃO BLINDADA: Transformamos as roles da rota em minúsculo também
    const rolesPermitidas = to.meta.roles.map(r => r.toLowerCase());
    
    if (!rolesPermitidas.includes(rawTipo)) {
      console.warn(`🚫 Bloqueado: ${rawTipo} não está em ${rolesPermitidas}`);
      if (to.path === '/') {
        sessionStorage.clear();
        return next('/login');
      }
      return next('/');
    }
  }
  next();
});

export default router;