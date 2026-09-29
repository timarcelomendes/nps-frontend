<script setup>
import { ref, onMounted, computed } from 'vue';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';

// Componentes PrimeVue
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import InputNumber from 'primevue/inputnumber';
import MultiSelect from 'primevue/multiselect';
import Textarea from 'primevue/textarea';
import Checkbox from 'primevue/checkbox';

const toast = useToast();

// --- ESTADOS DE CONTROLO ---
const loading = ref(false);
const verificandoConexao = ref(false);
const carregandoDados = ref(false);
const carregandoUtilizadores = ref(false);

// Captura o ID de quem está logado para ocultar o botão de exclusão da própria conta
const idUsuarioLogado = ref(localStorage.getItem('usuario_id') || '');

// --- ESTADO: GESTOR DE IMAGENS (E-MAIL) ---
const enviandoImagem = ref(false);
const imagensUpload = ref([]);
const fileInputImagem = ref(null);

// --- ESTADO: CONFIGURAÇÕES DE EMAIL ---
// Procure a definição do ref(config) e deixe assim:
const config = ref({
  tenant_id: '',
  client_id: '',
  client_secret: '',
  email_remetente: '',
  base_url_frontend: window.location.origin,
  envios_ativos: true,
  sso_microsoft_ativo: false,
  robo_ativo: false
});

// --- ESTADO: INTELIGÊNCIA ARTIFICIAL (MAGIC AI) ---
const loadingAIConfig = ref(false);
const savingAIConfig = ref(false);

const formConfigAI = ref({
  openai_api_key: '',
  openai_model: 'gpt-4o-mini',
  ai_temperature: '0.4'
});

const opcoesModeloIA = [
  { label: 'GPT-4o Mini (Rápido/Económico)', value: 'gpt-4o-mini' },
  { label: 'GPT-4 Turbo (Poderoso/Preciso)', value: 'gpt-4-turbo' },
  { label: 'GPT-4o (Otimizado/Multimodal)', value: 'gpt-4o' }
];

// --- ESTADO: UTILIZADORES ---
const utilizadores = ref([]);
const usuarioDialog = ref(false);
const editandoUser = ref(false);
const submetendoUser = ref(false);

const opcoesTipo = ['Admin', 'Manager', 'Viewer'];

const formatarDataHora = (dataString) => {
  if (!dataString) return 'Nunca acedeu';
  const data = new Date(dataString);
  return data.toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).replace(',', ' às');
};

const gerarSenhaAleatoria = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const randomValues = new Uint32Array(12);
  window.crypto.getRandomValues(randomValues);
  
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars[randomValues[i] % chars.length];
  }
  
  usuario.value.password = pass;
  toast.add({ severity: 'info', summary: 'Senha Gerada', detail: 'Uma nova senha foi gerada. Copie antes de salvar.', life: 3000 });
};

// --- ESTADOS DE SEGURANÇA ---
const loadingSenha = ref(false);
const formSenha = ref({ atual: '', nova: '', confirmacao: '' });

const alterarMinhaSenha = async () => {
  if (formSenha.value.nova !== formSenha.value.confirmacao) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'As senhas não coincidem.', life: 3000 });
    return;
  }
  loadingSenha.value = true;
  try {
    await api.post('/usuarios/alterar-senha', {
      senha_atual: formSenha.value.atual, nova_senha: formSenha.value.nova
    });
    toast.add({ severity: 'success', summary: 'Segurança Atualizada', detail: 'Sua senha foi alterada.', life: 3000 });
    formSenha.value = { atual: '', nova: '', confirmacao: '' };
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Falha', detail: error.response?.data?.detail || 'Erro ao mudar senha.' });
  } finally {
    loadingSenha.value = false;
  }
};

const mostrarTrocaSenha = ref(false);

const prepararEdicaoUser = (dados) => {
  usuario.value = { ...dados, password: '' };
  mostrarTrocaSenha.value = false;
  editandoUser.value = true;
  usuarioDialog.value = true;
};

// ==========================================
// 📡 SESSOES ATIVAS
// ==========================================
const sessoesAtivas = ref([]);
const loadingSessoes = ref(false);

const carregarSessoesReais = async () => {
  loadingSessoes.value = true;
  try {
    // Busca o ID do utilizador logado no momento
    const meuId = localStorage.getItem('usuario_id') || 1; 
    const response = await api.get(`/usuarios/sessoes?usuario_id=${meuId}`);
    
    if (response.data) {
      sessoesAtivas.value = response.data.map((sessao, index) => ({
        ...sessao, atual: index === 0
      }));
    }
  } catch (error) {
    console.error("Erro ao ler sessões reais:", error);
  } finally {
    loadingSessoes.value = false;
  }
};

const encerrarSessao = async (id) => {
  try {
    await api.delete(`/usuarios/sessoes/${id}`);
    sessoesAtivas.value = sessoesAtivas.value.filter(s => s.id !== id);
    toast.add({ severity: 'info', summary: 'Sessão Encerrada', detail: 'Acesso revogado com sucesso.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível revogar a sessão.' });
  }
};

const encerrarTodasAsSessoes = async () => {
  if (!confirm('Isto irá desconectar a sua conta de todos os outros computadores e telemóveis. Confirmar?')) return;
  loadingSessoes.value = true;
  try {
    const sessoesAntigas = sessoesAtivas.value.filter(s => !s.atual);
    for (const sessao of sessoesAntigas) await api.delete(`/usuarios/sessoes/${sessao.id}`);
    sessoesAtivas.value = sessoesAtivas.value.filter(s => s.atual);
    toast.add({ severity: 'warn', summary: 'Segurança Máxima', detail: 'Todas as outras sessões foram encerradas.', life: 5000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao encerrar todas as sessões.' });
  } finally {
    loadingSessoes.value = false;
  }
};

const obterUrlServidor = () => {
  if (imagensUpload.value && imagensUpload.value.length > 0) {
    return imagensUpload.value[0].url.split('/uploads')[0];
  }
  return (api.defaults.baseURL || window.location.origin).replace(/\/api$/, '');
};

// --- UTILITÁRIO: GERAR AVATAR ---
const getIniciais = (nome) => {
  if (!nome) return 'US';
  const partes = nome.trim().split(' ');
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

// ==========================================
// 📡 CARREGAR CONFIGURAÇÕES GERAIS E EMAIL
// ==========================================
const carregarDadosConfig = async () => {
  carregandoDados.value = true;
  try {
    const resConfig = await api.get('/config/email');
    if (resConfig.data) {
      const dados = Array.isArray(resConfig.data) ? resConfig.data[0] : resConfig.data;
      if (dados) {
        config.value = { ...config.value, ...dados };
        config.value.base_url_frontend = window.location.origin;
      }
    }
  } catch (error) {
  console.error("Erro ao carregar configurações de e-mail:", error);
  toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.', life: 3000 });
} finally {
    carregandoDados.value = false;
  }
};

const salvarConfigEmail = async () => {
  loading.value = true;
  try {
    await api.post('/config/email', {
      tenant_id: config.value.tenant_id,
      client_id: config.value.client_id,
      client_secret: config.value.client_secret,
      email_remetente: config.value.email_remetente,
      base_url_frontend: config.value.base_url_frontend,
      envios_ativos: config.value.envios_ativos,
      sso_microsoft_ativo: config.value.sso_microsoft_ativo,
      robo_ativo: config.value.robo_ativo
    });
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Configurações de e-mail atualizadas!', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar configurações.' });
  } finally {
    loading.value = false;
  }
};

// ==========================================
// 📡 CARREGAR CONFIGURAÇÕES DE IA
// ==========================================
const carregarConfiguracoesAI = async () => {
  loadingAIConfig.value = true;
  try {
    const response = await api.get('/configuracoes');
    if (response.data && response.data.status === 'success') {
      formConfigAI.value = { ...formConfigAI.value, ...response.data.data };
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Aviso', detail: 'Não foi possível carregar as chaves de IA.', life: 3000 });
  } finally {
    loadingAIConfig.value = false;
  }
};

const salvarConfiguracoesAI = async () => {
  savingAIConfig.value = true;
  try {
    const payload = Object.keys(formConfigAI.value).map(key => ({
      chave: key, valor: String(formConfigAI.value[key] || '')
    }));
    await api.post('/configuracoes', payload);
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Integração de Inteligência Artificial guardada.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao guardar configurações de IA.', life: 3000 });
  } finally {
    savingAIConfig.value = false;
  }
};

// ==========================================
// 🔐 MICROSOFT OAUTH2
// ==========================================
const autorizarMicrosoft = () => {
  if (!config.value.tenant_id || !config.value.client_id) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha o Tenant ID e o Client ID primeiro.', life: 4000 });
    return;
  }
  const redirectUri = `${window.location.origin}/configuracoes`;
  const scope = encodeURIComponent("offline_access mail.send");
  const authUrl = `https://login.microsoftonline.com/${config.value.tenant_id}/oauth2/v2.0/authorize?client_id=${config.value.client_id}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}`;
  window.location.href = authUrl;
};

const processarCallbackMicrosoft = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    verificandoConexao.value = true;
    try {
      // 🎯 Aqui está a mágica: enviamos o code E a URL dinâmica exata!
      await api.post('/config/email/autorizar', { 
        code: code,
        redirect_uri: window.location.origin + '/configuracoes' 
      });
      toast.add({ severity: 'success', summary: 'API Conectada', detail: 'Autorização Microsoft concluída.', life: 5000 });
      window.history.replaceState({}, document.title, window.location.pathname);
      carregarDadosConfig(); 
    } catch (error) {
      toast.add({ severity: 'error', summary: 'Erro OAuth', detail: 'Falha ao gerar token.', life: 5000 });
    } finally {
      verificandoConexao.value = false;
    }
  }
};

const enviandoTeste = ref(false);
const enviarTeste = async () => {
  enviandoTeste.value = true;
  try {
    await api.post('/config/email/teste');
    toast.add({ severity: 'success', summary: 'E-mail Enviado', detail: 'Verifique a sua caixa de entrada.', life: 5000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Falha no Teste', detail: error.response?.data?.detail || 'Erro ao disparar e-mail.', life: 5000 });
  } finally {
    enviandoTeste.value = false;
  }
};

// ==========================================
// 💾 GESTÃO DE UTILIZADORES
// ==========================================
const usuario = ref({ nome: '', email: '', cargo: '', tipo: 'Viewer', ativo: true, password: '' });

const carregarUtilizadores = async () => {
  carregandoUtilizadores.value = true;
  try {
    const response = await api.get('/usuarios'); 
    let lista = Array.isArray(response.data) ? response.data : [response.data];
    utilizadores.value = lista.sort((a, b) => Number(a.ativo) - Number(b.ativo));
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao listar utilizadores.', life: 5000 });
  } finally {
    carregandoUtilizadores.value = false;
  }
};

const salvarUtilizador = async () => {
  // 🎯 TRAVA 1: Impede guardar o formulário se estiver a ativar sem um perfil válido
  if (usuario.value.ativo && !opcoesTipo.includes(usuario.value.tipo)) {
    toast.add({ 
      severity: 'warn', 
      summary: 'Perfil Obrigatório', 
      detail: 'Selecione um Nível de Acesso (Admin, Manager ou Viewer) antes de aprovar a conta.', 
      life: 5000 
    });
    return;
  }

  submetendoUser.value = true;
  try {
    if (editandoUser.value) {
      await api.put(`/usuarios/${usuario.value.usuario_id}`, usuario.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Dados atualizados com sucesso.' });
    } else {
      await api.post('/usuarios', usuario.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Utilizador criado.' });
    }
    usuarioDialog.value = false;
    carregarUtilizadores();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao processar operação.' });
  } finally {
    submetendoUser.value = false;
  }
};

const alternarStatus = async (user_data) => {
  const novoStatus = !user_data.ativo; 
  
  if (novoStatus === true && !opcoesTipo.includes(user_data.tipo)) {
    toast.add({ 
      severity: 'warn', 
      summary: 'Ação Necessária', 
      detail: 'Defina o Nível de Acesso do utilizador antes de liberar o acesso.', 
      life: 5000 
    });
    prepararEdicaoUser(user_data);
    return;
  }

  try {
    await api.put(`/usuarios/${user_data.usuario_id}`, { ...user_data, ativo: novoStatus });
    user_data.ativo = novoStatus; 
    toast.add({ severity: 'success', summary: 'Acesso Atualizado', detail: novoStatus ? 'Utilizador ativado!' : 'Acesso bloqueado.', life: 3000 });
    utilizadores.value.sort((a, b) => Number(a.ativo) - Number(b.ativo));
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível alterar o status.', life: 3000 });
  }
};

const abrirNovoUser = () => {
  usuario.value = { nome: '', email: '', cargo: '', tipo: 'Viewer', ativo: true, password: '' };
  editandoUser.value = false;
  usuarioDialog.value = true;
};

// ==========================================
// 🔒 ESTADOS: SEGURANÇA
// ==========================================
const configSeguranca = ref({ tempo_minutos: 60 });
const salvandoSeguranca = ref(false);

const carregarSeguranca = async () => {
  try {
    const response = await api.get('/config/seguranca');
    if (response.data && response.data.tempo_minutos) configSeguranca.value.tempo_minutos = response.data.tempo_minutos;
  } catch (error) { console.error(error); }
};

const salvarSeguranca = async () => {
  salvandoSeguranca.value = true;
  try {
    await api.put('/config/seguranca', { tempo_minutos: configSeguranca.value.tempo_minutos });
    toast.add({ severity: 'success', summary: 'Segurança Atualizada', detail: 'Tempo de expiração alterado.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar a configuração de segurança.', life: 3000 });
  } finally {
    salvandoSeguranca.value = false;
  }
};

// --- ESTADO: INTEGRAÇÕES ---
const loadingIntegracoes = ref(false);
const savingIntegracoes = ref(false);
const integracoesConfig = ref({ 
  webhook_global: '', 
  webhook_tecnico: '' 
});

// URL do webhook com o token secreto da conta (vem da API)
const webhookFilloutURL = ref('');
const dadosConta = ref({ nome: '', plano: '' });
const carregarConta = async () => {
  try {
    const res = await api.get('/conta');
    webhookFilloutURL.value = res.data.webhook_url || '';
    dadosConta.value = { nome: res.data.nome, plano: res.data.plano };
  } catch (error) { console.error(error); }
};
const regenerarWebhook = async () => {
  if (!confirm('Gerar um novo link? O link atual para de funcionar e será preciso atualizar no Fillout.')) return;
  try {
    const res = await api.post('/conta/webhook/regenerar');
    webhookFilloutURL.value = res.data.webhook_url;
    toast.add({ severity: 'success', summary: 'Novo link gerado', detail: 'Atualize o webhook no Fillout.', life: 5000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: error.response?.data?.detail || 'Não foi possível gerar o link.', life: 5000 });
  }
};

const copiarWebhookFillout = async () => {
  try {
    await navigator.clipboard.writeText(webhookFilloutURL.value);
    toast.add({ severity: 'success', summary: 'Copiado!', detail: 'URL do Webhook copiado.', life: 3000 });
  } catch (err) { 
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível copiar o URL.' }); 
  }
};

const carregarIntegracoes = async () => {
  loadingIntegracoes.value = true;
  try {
    // Aponta para a nova rota que criámos no main.py
    const res = await api.get('/configuracoes/integracoes');
    if (res.data) {
      integracoesConfig.value = { 
        webhook_global: res.data.webhook_global || '',
        webhook_tecnico: res.data.webhook_tecnico || ''
      };
    }
  } catch (error) { 
    console.error(error); 
  } finally { 
    loadingIntegracoes.value = false; 
  }
};

const salvarIntegracoes = async () => {
  savingIntegracoes.value = true;
  try {
    // Aponta para o novo PUT que faz o UPSERT no banco
    await api.put('/configuracoes/integracoes', integracoesConfig.value);
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Integrações atualizadas com sucesso!', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao guardar configurações de integração.', life: 5000 });
  } finally { 
    savingIntegracoes.value = false; 
  }
};

// --- ESTADO: WEBHOOK DE RECEÇÃO (FILLOUT) ---
const testingIncoming = ref(false);

const testarWebhookRecebimento = async () => {
  testingIncoming.value = true;
  try {
    // Faz um GET simples à nossa própria rota para ver se ela responde
    const token = new URL(webhookFilloutURL.value).searchParams.get('token');
    const res = await api.get('/webhook/fillout', { params: { token } });
    
    if (res.data && res.data.status === 'success') {
      toast.add({ 
        severity: 'success', 
        summary: 'Webhook Online! 🟢', 
        detail: 'O endpoint está ativo e pronto para receber dados.', 
        life: 5000 
      });
    }
  } catch (error) {
    toast.add({ 
      severity: 'error', 
      summary: 'Webhook Offline 🔴', 
      detail: 'O endpoint não respondeu. Verifique se o servidor está online.', 
      life: 5000 
    });
  } finally {
    testingIncoming.value = false;
  }
};

const limparCacheNavegador = () => {
  localStorage.removeItem('nps_ver_arquivados');
  toast.add({ severity: 'success', summary: 'Cache Limpo', detail: 'A recarregar o sistema com dados frescos...', life: 2000 });
  setTimeout(() => { window.location.reload(true); }, 1500);
};

// --- ESTADO: MOTOR NPS ---
const totalElegiveisNPS = ref(0);
const loadingElegiveis = ref(false);
const disparandoNPS = ref(false);

const carregarElegiveisNPS = async () => {
  loadingElegiveis.value = true;
  try {
    const res = await api.get('/config/nps/elegiveis');
    
    const totalRecebido = res.data && res.data.total !== undefined ? res.data.total : 0;
    
    if (typeof totalRecebido === 'number' && totalRecebido < 1000000) {
      totalElegiveisNPS.value = totalRecebido;
    } else {
      const convertido = parseInt(totalRecebido);
      totalElegiveisNPS.value = (!isNaN(convertido) && convertido < 1000000) ? convertido : 0;
    }

  } catch (error) { 
    console.error("Falha ao carregar fila NPS:", error); 
    totalElegiveisNPS.value = 0;
  } finally { 
    loadingElegiveis.value = false; 
  }
};

const forcarDisparoNPS = async () => {
  disparandoNPS.value = true;
  try {
    await api.post('/config/nps/forcar-disparo');
    toast.add({ severity: 'success', summary: 'Motor Iniciado', detail: 'Processamento em segundo plano.', life: 5000 });
    setTimeout(() => carregarElegiveisNPS(), 3000); 
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao iniciar disparo.', life: 5000 });
  } finally { disparandoNPS.value = false; }
};

// ==========================================
// ⚙️ REGRAS DE NEGÓCIO E TEMPLATES
// ==========================================
const loadingRegras = ref(false);
const savingRegras = ref(false);
const abaEmailAgradecimento = ref('promotor');
const abaEmailLembrete = ref('1');

const regrasConfig = ref({
  scheduler_hora_inicio: '09:00', 
  scheduler_horas: 6,
  teams_horario_resumo: '08:00',
  sla_detrator_dias: 2, 
  sla_neutro_dias: 5, 
  sla_promotor_dias: 7,
  recorrencia_dias: 90,
  survey_url: '',
  fillout_campos: ['clienteId', 'email', 'nome', 'empresa', 'empresa_id'],
  email_template_html: '', 
  email_agradecimento_promotor: '',
  email_agradecimento_neutro: '', 
  email_agradecimento_detrator: '',
  
  // 👇 AS 4 NOVAS VARIÁVEIS DA RÉGUA DE LEMBRETES:
  lembrete_qtd_maxima: 3, 
  lembrete_dias_1: 3,
  lembrete_dias_2: 7,
  lembrete_dias_3: 15,
  
  email_template_lembrete_1: '',
  email_template_lembrete_2: '',
  email_template_lembrete_3: '',
  robo_ativo: false
});

const opcoesCamposFillout = ref([
  { label: 'ID do Cliente', value: 'clienteId' }, { label: 'E-mail', value: 'email' },
  { label: 'Nome', value: 'nome' }, { label: 'Empresa', value: 'empresa' },
  { label: 'ID da Empresa', value: 'empresa_id' }, { label: 'Gestor', value: 'gestor' }, { label: 'Segmento', value: 'segmento' }
]);

const carregarRegras = async () => {
  loadingRegras.value = true;
  try {
    const res = await api.get('/config/regras');
    regrasConfig.value = { 
      ...res.data, 
      robo_ativo: String(res.data.robo_ativo).toLowerCase() === 'true',
      fillout_campos: res.data.fillout_campos ? res.data.fillout_campos.split(',') : [],
      lembrete_qtd_maxima: parseInt(res.data.lembrete_qtd_maxima) || 0,
      lembrete_dias_1: parseInt(res.data.lembrete_dias_1) || 3,
      lembrete_dias_2: parseInt(res.data.lembrete_dias_2) || 7,
      lembrete_dias_3: parseInt(res.data.lembrete_dias_3) || 15,
      recorrencia_dias: parseInt(res.data.recorrencia_dias) || 90
    };
    
    const urlReal = obterUrlServidor();
    
    const camposHtml = [
      'email_template_html', 'email_template_lembrete_1', 'email_template_lembrete_2', 
      'email_template_lembrete_3', 'email_agradecimento_promotor', 
      'email_agradecimento_neutro', 'email_agradecimento_detrator'
    ];
    
    camposHtml.forEach(campo => {
      if (regrasConfig.value[campo]) {
        // Pega no {backend_url} guardado na BD e converte na URL do ambiente onde a pessoa está agora!
        regrasConfig.value[campo] = regrasConfig.value[campo].replaceAll('{backend_url}', urlReal);
      }
    });

  } catch (error) { 
    console.error(error); 
  } finally { 
    loadingRegras.value = false; 
  }
};

// ==========================================
// 🖼️ GESTÃO DE IMAGENS PARA E-MAILS
// ==========================================
const carregarImagensHospedadas = async () => {
  try {
    const res = await api.get('/config/imagens');
    imagensUpload.value = res.data || [];
  } catch (error) {
    console.warn("Nenhuma imagem hospedada encontrada.");
  }
};

const triggerUploadImagem = () => {
  if (fileInputImagem.value) fileInputImagem.value.click();
};

const processarUploadImagem = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const imagemExistenteIndex = imagensUpload.value.findIndex(img => img.nome === file.name);

  if (imagemExistenteIndex !== -1) {
    const querSubstituir = confirm(
      `⚠️ Já existe uma imagem com o nome "${file.name}".\n\nDeseja substituí-la?\nAo confirmar, todos os templates que usam esta imagem passarão a exibir a nova versão.`
    );
    
    if (!querSubstituir) {
      event.target.value = ''; 
      return; //
    }
  }

  enviandoImagem.value = true;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await api.post('/upload-imagem', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (imagemExistenteIndex !== -1) {

      imagensUpload.value[imagemExistenteIndex].url = res.data.url + '?v=' + new Date().getTime();
      
      toast.add({ severity: 'success', summary: 'Imagem Atualizada', detail: 'A imagem foi substituída com sucesso no servidor.' });
    } else {
      imagensUpload.value.unshift(res.data);
      toast.add({ severity: 'success', summary: 'Imagem Hospedada', detail: 'O ficheiro já tem uma URL pública.' });
    }

  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao processar o upload da imagem.' });
  } finally {
    enviandoImagem.value = false;
    event.target.value = '';
  }
};

const copiarUrl = (url) => {
  navigator.clipboard.writeText(url);
  toast.add({ severity: 'info', summary: 'URL Copiada', detail: 'Cole no atributo src="" do seu HTML.', life: 3000 });
};

const removerImagem = async (nomeArquivo) => {
  if(confirm("Tem a certeza que deseja apagar esta imagem? Os e-mails deixarão de a exibir.")){
    try {
      await api.delete(`/config/imagens/${nomeArquivo}`);
      imagensUpload.value = imagensUpload.value.filter(img => img.nome !== nomeArquivo);
      toast.add({ severity: 'success', summary: 'Apagada', detail: 'A imagem foi removida do servidor.' });
    } catch(e) {
      toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível apagar a imagem.' });
    }
  }
};

// ==========================================
// 🪄 SUBSTITUIÇÃO INTELIGENTE DE IMAGENS (ULTRA ROBUSTA)
// ==========================================
const aplicarImagensInteligente = (tipoTemplate) => {
  // 1. Dicionário exato: Mapeia o argumento do botão para a variável correta no banco
  const mapaTemplates = {
    'convite': 'email_template_html',
    'lembrete1': 'email_template_lembrete_1',
    'lembrete2': 'email_template_lembrete_2',
    'lembrete3': 'email_template_lembrete_3',
    'agradecimento_promotor': 'email_agradecimento_promotor',
    'agradecimento_neutro': 'email_agradecimento_neutro',
    'agradecimento_detrator': 'email_agradecimento_detrator'
  };

  // 2. Descobre qual é a chave que vamos editar
  const chaveConfig = mapaTemplates[tipoTemplate];

  // Proteção: Se o botão enviar um nome que não existe no mapa
  if (!chaveConfig) {
    console.error("ERRO: Tipo de template não mapeado:", tipoTemplate);
    return toast.add({ severity: 'error', summary: 'Erro de Rota', detail: 'A aba atual não foi reconhecida pelo botão.' });
  }

  // 3. Pega o HTML atual da caixa de texto correspondente
  let html = regrasConfig.value[chaveConfig];

  if (!html || html.trim() === '') {
    return toast.add({ severity: 'warn', summary: 'Vazio', detail: 'Cole primeiro o código HTML na caixa de texto desta aba.' });
  }

  const urlReal = obterUrlServidor();
  let substituicoes = 0;

  // 4. Varre e substitui as imagens
  imagensUpload.value.forEach(img => {
    const nomeEscapado = img.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`([^"'\\s\\(]*\\/)?${nomeEscapado}(?:\\?[^"'\\s\\)]*)?`, 'gi');
    
    const matches = html.match(regex);
    if (matches) {
      // Injeta a URL REAL
      html = html.replace(regex, `${urlReal}/uploads/${img.nome}`);
      substituicoes += matches.length;
    }
  });

  // 5. Devolve o HTML atualizado para a caixa de texto
  if (substituicoes > 0) {
    regrasConfig.value[chaveConfig] = html; // Magia acontece aqui! Atualiza dinamicamente.
    toast.add({ severity: 'success', summary: 'Magia Aplicada 🪄', detail: `${substituicoes} link(s) convertido(s) para o ambiente atual!`, life: 4000 });
  } else {
    toast.add({ severity: 'info', summary: 'Sem alterações', detail: 'Nenhuma imagem local correspondente encontrada no HTML.', life: 3000 });
  }
};

// ==========================================
// 💾 AÇÕES DE GRAVAÇÃO (COM DESIDRATAÇÃO DE URL)
// ==========================================
const salvarRegras = async () => {
  savingRegras.value = true;
  try {
    const urlReal = obterUrlServidor();
    
    // 1. Cria uma cópia profunda para não afetar o que o utilizador vê no ecrã
    const payload = JSON.parse(JSON.stringify(regrasConfig.value));
    
    // 2. Formata campos especiais
    if (Array.isArray(payload.fillout_campos)) {
      payload.fillout_campos = payload.fillout_campos.join(',');
    }

    // 3. Protege os templates: substitui a URL física pela variável dinâmica {backend_url}
    const camposHtml = [
      'email_template_html', 
      'email_template_lembrete_1', 
      'email_template_lembrete_2', 
      'email_template_lembrete_3', 
      'email_agradecimento_promotor', 
      'email_agradecimento_neutro', 
      'email_agradecimento_detrator'
    ];
    
    camposHtml.forEach(campo => {
      if (payload[campo]) {
        // Remove a URL específica do ambiente (ex: localhost ou azure) e coloca a tag genérica
        payload[campo] = payload[campo].replaceAll(urlReal, '{backend_url}');
      }
    });

    // 4. Envia o payload "limpo" para o banco de dados
    await api.post('/config/regras', payload);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Regras de negócio atualizadas!', life: 3000 });
  } catch (error) {
    console.error("Erro ao salvar regras:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: error.response?.data?.detail || 'Falha ao guardar configurações.', life: 5000 });
  } finally { 
    savingRegras.value = false; 
  }
};

// ==========================================
// 🧪 MÓDULOS DE TESTE DE EMAIL (COM HIDRATAÇÃO PARA PREVIEW)
// ==========================================

// Função auxiliar para garantir que o HTML enviado para teste tenha a URL funcional do momento
const prepararHtmlParaTeste = (htmlOriginal) => {
  if (!htmlOriginal) return '';
  const urlReal = obterUrlServidor();
  // Se o HTML tiver {backend_url}, troca pela URL real para a imagem aparecer no e-mail de teste
  return htmlOriginal.replaceAll('{backend_url}', urlReal);
};

const loadingTesteConvite = ref(false);
const emailTesteConvite = ref('');
const modeloBaseConvite = `<!DOCTYPE html><html><body style="background-color: #f4f4f4; padding: 40px; font-family: sans-serif;"><div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; text-align: center;"><h2 style="color: #333;">Olá, {nome}!</h2><p style="color: #555; font-size: 16px;">Como avalia a sua parceria com a <strong>{empresa}</strong>?</p><a href="{survey_url}" style="display: inline-block; padding: 14px 28px; background-color: #F97316; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px;">Responder Pesquisa</a></div></body></html>`;

const testarTemplateConvite = async () => {
  if (!emailTesteConvite.value) return toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Introduza um e-mail.' });
  if (!regrasConfig.value.email_template_html) return toast.add({ severity: 'warn', summary: 'Vazio', detail: 'Cole o HTML.' });
  
  loadingTesteConvite.value = true;
  try {
    // Hidrata o HTML antes de enviar para o teste
    const htmlParaEnvio = prepararHtmlParaTeste(regrasConfig.value.email_template_html);
    
    await api.post('/config/testar-template', { 
      email_destino: emailTesteConvite.value, 
      html_content: htmlParaEnvio, 
      categoria: 'convite' 
    });
    toast.add({ severity: 'success', summary: 'Enviado! 🚀', detail: 'Preview do convite enviado com sucesso.', life: 5000 });
  } catch (error) { 
    toast.add({ severity: 'error', summary: 'Falha no Teste', detail: 'Não foi possível enviar o preview.' }); 
  } finally { 
    loadingTesteConvite.value = false; 
  }
};

const loadingTesteAgradecimento = ref(false);
const emailTesteAgradecimento = ref('');
const modeloBaseAgradecimento = `<!DOCTYPE html><html><body style="background-color: #f4f4f4; padding: 40px; font-family: sans-serif;"><div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;"><h2 style="color: #333;">Obrigado, {nome}!</h2><p>A sua avaliação da parceria com a <strong>{empresa}</strong> é muito importante.</p><p>A sua nota final foi: <strong style="font-size: 18px; color: #F97316;">{nota}/10</strong></p><div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #F97316; margin: 20px 0;"><p style="margin: 0; font-style: italic; color: #555;">"{motivo}"</p></div><p>A nossa equipa já está a analisar o seu feedback.</p></div></body></html>`;

const testarTemplateAgradecimento = async () => {
  if (!emailTesteAgradecimento.value) return toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Introduza um e-mail.' });
  
  let htmlOriginal = abaEmailAgradecimento.value === 'promotor' 
    ? regrasConfig.value.email_agradecimento_promotor 
    : abaEmailAgradecimento.value === 'neutro' 
      ? regrasConfig.value.email_agradecimento_neutro 
      : regrasConfig.value.email_agradecimento_detrator;

  if (!htmlOriginal) return toast.add({ severity: 'warn', summary: 'Vazio', detail: 'Cole o HTML.' });
  
  loadingTesteAgradecimento.value = true;
  try {
    const htmlParaEnvio = prepararHtmlParaTeste(htmlOriginal);
    
    await api.post('/config/testar-template', { 
      email_destino: emailTesteAgradecimento.value, 
      html_content: htmlParaEnvio, 
      categoria: abaEmailAgradecimento.value 
    });
    toast.add({ severity: 'success', summary: 'Enviado! 🚀', detail: 'Preview enviado com sucesso.' });
  } catch (error) { 
    toast.add({ severity: 'error', summary: 'Falha no Teste', detail: 'Erro ao enviar preview.' }); 
  } finally { 
    loadingTesteAgradecimento.value = false; 
  }
};

const loadingTesteLembrete = ref(false);
const emailTesteLembrete = ref('');
const modeloBaseLembrete = `<!DOCTYPE html><html><body style="background-color: #f4f4f4; padding: 40px; font-family: sans-serif;"><div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; text-align: center;"><h2 style="color: #333;">Olá novamente, {nome}!</h2><p style="color: #555; font-size: 16px;">Ainda não recebemos o seu feedback sobre a <strong>{empresa}</strong>. Leva menos de 1 minuto!</p><a href="{survey_url}" style="display: inline-block; padding: 14px 28px; background-color: #F97316; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px;">Responder Agora</a></div></body></html>`;

const testarTemplateLembrete = async () => {
  if (!emailTesteLembrete.value) return toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Introduza um e-mail.' });
  
  let htmlOriginal = '';
  if (abaEmailLembrete.value === '1') htmlOriginal = regrasConfig.value.email_template_lembrete_1;
  else if (abaEmailLembrete.value === '2') htmlOriginal = regrasConfig.value.email_template_lembrete_2;
  else if (abaEmailLembrete.value === '3') htmlOriginal = regrasConfig.value.email_template_lembrete_3;

  if (!htmlOriginal) return toast.add({ severity: 'warn', summary: 'Vazio', detail: 'Cole o HTML.' });
  
  loadingTesteLembrete.value = true;
  try {
    const htmlParaEnvio = prepararHtmlParaTeste(htmlOriginal);
    
    await api.post('/config/testar-template', { 
      email_destino: emailTesteLembrete.value, 
      html_content: htmlParaEnvio, 
      categoria: 'lembrete' 
    });
    toast.add({ severity: 'success', summary: 'Enviado!', detail: 'Preview do lembrete enviado.' });
  } catch (error) { 
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha no teste.' }); 
  } finally { 
    loadingTesteLembrete.value = false; 
  }
};

// ==========================================
// 🔐 MATRIZ DE PERMISSÕES
// ==========================================
const loadingPermissoes = ref(false);
const savingPermissoes = ref(false);

// O Admin não aparece aqui porque tem acesso total fixo
const permissoesAtuais = ref({
  Viewer: [],
  Manager: []
});

// O "Dicionário" do que cada chave significa para desenhar no ecrã
const modulosPermissoes = ref([
  {
    nome: 'Dashboard & Relatórios',
    icone: 'pi-chart-line',
    cor: 'text-indigo-500',
    permissoes: [
      { chave: 'dashboard:ler', label: 'Visualizar Dashboard e KPIs' },
      { chave: 'dashboard:exportar', label: 'Exportar Dados (CSV)' }
    ]
  },
  {
    nome: 'Kanban & Ações',
    icone: 'pi-objects-column',
    cor: 'text-orange-500',
    permissoes: [
      { chave: 'acoes:ler', label: 'Visualizar Tickets e Colunas' },
      { chave: 'acoes:criar', label: 'Criar Novas Ações Manuais' },
      { chave: 'acoes:editar', label: 'Editar Dados do Ticket' },
      { chave: 'acoes:mover', label: 'Mover Cartões (Drag & Drop)' },
      { chave: 'acoes:excluir', label: 'Excluir Tickets do Kanban' }
    ]
  },
  {
    nome: 'Base de Clientes',
    icone: 'pi-users',
    cor: 'text-blue-500',
    permissoes: [
      { chave: 'clientes:ler', label: 'Visualizar Base de Clientes' },
      { chave: 'clientes:criar', label: 'Cadastrar Novos Clientes/Empresas' },
      { chave: 'clientes:editar', label: 'Editar Clientes/Empresas' },
      { chave: 'clientes:excluir', label: 'Excluir Registos da Base' }
    ]
  },
  {
    nome: 'Disparos & Respostas',
    icone: 'pi-send',
    cor: 'text-emerald-500',
    permissoes: [
      { chave: 'audiencia:ler', label: 'Visualizar Audiência e Histórico' },
      { chave: 'audiencia:disparar', label: 'Realizar Novos Disparos NPS' },
      { chave: 'respostas:ler', label: 'Consultar Respostas Brutas' }
    ]
  }
]);

const carregarPermissoes = async () => {
  loadingPermissoes.value = true;
  try {
    const response = await api.get('/permissoes');
    if (response.data.status === 'success') {
      permissoesAtuais.value = response.data.permissoes;
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar permissões.', life: 3000 });
  } finally {
    loadingPermissoes.value = false;
  }
};

const salvarPermissoes = async () => {
  savingPermissoes.value = true;
  try {
    const payload = [
      { perfil: 'Viewer', chaves: permissoesAtuais.value.Viewer },
      { perfil: 'Manager', chaves: permissoesAtuais.value.Manager }
    ];
    
    await api.post('/permissoes', payload);
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Matriz de permissões atualizada!', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao gravar permissões.', life: 3000 });
  } finally {
    savingPermissoes.value = false;
  }
};

const novoDominio = ref('');
const listaDominios = ref([]);
const salvandoDominios = ref(false);

// Função para buscar do banco ao abrir a tela
const carregarDominios = async () => {
    try {
        const res = await api.get('/configuracoes/dominios');
        if (res.data.dominios) {
            // Transforma a string "a.com, b.com" num Array limpo ['a.com', 'b.com']
            listaDominios.value = res.data.dominios.split(',').map(d => d.trim()).filter(d => d);
        }
    } catch (error) {
        console.error("Erro ao carregar domínios:", error);
    }
};

// Adiciona à lista visual (ainda não salva no banco)
const adicionarDominio = () => {
    let dom = novoDominio.value.toLowerCase().trim();
    if (dom.startsWith('@')) dom = dom.substring(1); // Remove o @ se o utilizador o digitar

    if (dom && !listaDominios.value.includes(dom)) {
        listaDominios.value.push(dom);
        novoDominio.value = ''; // Limpa o input
    } else if (listaDominios.value.includes(dom)) {
         toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Este domínio já está na lista.', life: 3000 });
    }
};

// Remove da lista visual
const removerDominio = (dom) => {
    listaDominios.value = listaDominios.value.filter(d => d !== dom);
};

// Salva a lista final no banco de dados
const salvarDominios = async () => {
    salvandoDominios.value = true;
    try {
        const dominiosStr = listaDominios.value.join(', '); // Junta tudo com vírgula
        await api.put('/configuracoes/dominios', { dominios: dominiosStr });
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Domínios autorizados atualizados!', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar domínios.', life: 3000 });
    } finally {
        salvandoDominios.value = false;
    }
};

const excluirUtilizador = async (usuario_id) => {
  if (!confirm("Tem certeza que deseja excluir permanentemente este utilizador? Esta ação não pode ser desfeita.")) return;
  
  try {
    await api.delete(`/usuarios/${usuario_id}`);
    toast.add({ severity: 'success', summary: 'Excluído', detail: 'Utilizador removido do sistema.', life: 3000 });
    carregarUtilizadores(); // Atualiza a tabela
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Acesso Negado', detail: error.response?.data?.detail || 'Não foi possível excluir o utilizador.', life: 5000 });
  }
};

const reenviarEmailConfirmacao = async (emailUsuario) => {
  try {
    // Usa a mesma rota que o utilizador usaria no ecrã de login
    await api.post('/reenviar-confirmacao', { email: emailUsuario });
    toast.add({ 
      severity: 'success', 
      summary: 'E-mail Enviado', 
      detail: `O link de confirmação foi reenviado para ${emailUsuario}.`, 
      life: 5000 
    });
  } catch (error) {
    toast.add({ 
      severity: 'error', 
      summary: 'Falha no Envio', 
      detail: error.response?.data?.detail || 'Não foi possível reenviar o e-mail de confirmação.', 
      life: 5000 
    });
  }
};

// ==========================================
// 🔍 SISTEMA DE PESQUISA NOS TEMPLATES HTML
// ==========================================

// Estados independentes para cada secção
const buscaConvite = ref({ termo: '', matches: [], atual: -1 });
const buscaLembrete = ref({ termo: '', matches: [], atual: -1 });
const buscaAgradecimento = ref({ termo: '', matches: [], atual: -1 });

// Referências para os Textareas
const textareaConvite = ref(null);
const textareaLembrete1 = ref(null);
const textareaLembrete2 = ref(null);
const textareaLembrete3 = ref(null);
const textareaAgraPromotor = ref(null);
const textareaAgraNeutro = ref(null);
const textareaAgraDetrator = ref(null);

const resetarBusca = (secao) => {
  if (secao === 'convite') { buscaConvite.value.matches = []; buscaConvite.value.atual = -1; }
  if (secao === 'lembrete') { buscaLembrete.value.matches = []; buscaLembrete.value.atual = -1; }
  if (secao === 'agradecimento') { buscaAgradecimento.value.matches = []; buscaAgradecimento.value.atual = -1; }
};

const buscarNoTemplate = (secao) => {
  let estado, textoAlvo, refTextarea;

  // 1. Identifica qual a secção e qual a aba ativa
  if (secao === 'convite') {
    estado = buscaConvite.value;
    textoAlvo = regrasConfig.value.email_template_html;
    refTextarea = textareaConvite.value;
  } 
  else if (secao === 'lembrete') {
    estado = buscaLembrete.value;
    if (abaEmailLembrete.value === '1') { textoAlvo = regrasConfig.value.email_template_lembrete_1; refTextarea = textareaLembrete1.value; }
    else if (abaEmailLembrete.value === '2') { textoAlvo = regrasConfig.value.email_template_lembrete_2; refTextarea = textareaLembrete2.value; }
    else if (abaEmailLembrete.value === '3') { textoAlvo = regrasConfig.value.email_template_lembrete_3; refTextarea = textareaLembrete3.value; }
  } 
  else if (secao === 'agradecimento') {
    estado = buscaAgradecimento.value;
    if (abaEmailAgradecimento.value === 'promotor') { textoAlvo = regrasConfig.value.email_agradecimento_promotor; refTextarea = textareaAgraPromotor.value; }
    else if (abaEmailAgradecimento.value === 'neutro') { textoAlvo = regrasConfig.value.email_agradecimento_neutro; refTextarea = textareaAgraNeutro.value; }
    else if (abaEmailAgradecimento.value === 'detrator') { textoAlvo = regrasConfig.value.email_agradecimento_detrator; refTextarea = textareaAgraDetrator.value; }
  }

  if (!estado.termo || !textoAlvo) return;

  const texto = textoAlvo.toLowerCase();
  const termo = estado.termo.toLowerCase();

  // 2. Procura todas as ocorrências na primeira vez
  if (estado.matches.length === 0) {
    let startIndex = 0;
    let index;
    while ((index = texto.indexOf(termo, startIndex)) > -1) {
      estado.matches.push(index);
      startIndex = index + termo.length;
    }

    if (estado.matches.length === 0) {
      toast.add({ severity: 'info', summary: 'Não encontrado', detail: `O termo "${estado.termo}" não existe neste template.`, life: 3000 });
      return;
    }
  }

  // 3. Avança para o próximo e faz o Scroll/Foco
  estado.atual = (estado.atual + 1) % estado.matches.length;
  const matchStart = estado.matches[estado.atual];
  
  const el = refTextarea?.$el || refTextarea;
  if (el && typeof el.setSelectionRange === 'function') {
    el.focus();
    el.setSelectionRange(matchStart, matchStart + termo.length);
    
    const textBeforeMatch = el.value.substring(0, matchStart);
    const linesBeforeMatch = textBeforeMatch.split('\n').length;
    el.scrollTop = (linesBeforeMatch - 2) * 16; // Ajustado para o tamanho da fonte do seu layout
  }
};

// ==========================================
// 🏢 ADMINISTRAÇÃO DA PLATAFORMA (somente super admin)
// ==========================================
const ehSuperAdmin = sessionStorage.getItem('usuario_superadmin') === 'true';
const contasPlataforma = ref([]);
const novaConta = ref({ nome: '', admin_nome: '', admin_email: '', admin_senha: '', dominios: '' });
const criandoConta = ref(false);
const carregarContasPlataforma = async () => {
  if (!ehSuperAdmin) return;
  try {
    const res = await api.get('/superadmin/contas');
    contasPlataforma.value = res.data || [];
  } catch (error) { console.error(error); }
};
const criarContaPlataforma = async () => {
  criandoConta.value = true;
  try {
    const res = await api.post('/superadmin/contas', novaConta.value);
    toast.add({ severity: 'success', summary: 'Conta criada', detail: res.data.message, life: 5000 });
    novaConta.value = { nome: '', admin_nome: '', admin_email: '', admin_senha: '', dominios: '' };
    carregarContasPlataforma();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: error.response?.data?.detail || 'Não foi possível criar a conta.', life: 6000 });
  } finally {
    criandoConta.value = false;
  }
};

onMounted(() => {
  carregarContasPlataforma();
  carregarConta();
  carregarDadosConfig();
  carregarConfiguracoesAI();
  carregarUtilizadores();
  carregarSessoesReais();
  processarCallbackMicrosoft();
  carregarSeguranca();
  carregarElegiveisNPS();
  carregarRegras();
  carregarIntegracoes();
  carregarPermissoes();
  carregarImagensHospedadas();
  carregarDominios();
});

</script>

<template>
  <div class="max-w-6xl mx-auto animate-fadein px-4 md:px-8 py-4 relative">
    
    <div class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white tracking-tight italic">
          Configurações <span class="text-orange-500">.</span>
        </h1>
        <p class="text-[12px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ambiente & Infraestrutura</p>
      </div>
      <div v-if="carregandoDados || loadingAIConfig" class="text-orange-500 text-[10px] font-black animate-pulse uppercase tracking-widest mt-2 md:mt-0">
        <i class="pi pi-spin pi-spinner mr-2"></i>Sincronizando Banco...
      </div>
    </div>

    <TabView class="custom-tabview">
      
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-desktop text-slate-400"></i> <span class="font-bold">Geral</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            <div class="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                <i class="pi pi-bolt text-emerald-500 mr-1"></i> Ambiente Detetado (Auto)
              </label>
              <div class="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                {{ config.base_url_frontend }}
              </div>
              <p class="text-[9px] text-slate-400 font-medium mt-1">
                O sistema usa esta origem dinamicamente para o redirecionamento de segurança. Não é guardada no banco de dados para evitar conflitos entre Nuvem e Localhost.
              </p>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group transition-all hover:border-orange-200 dark:hover:border-orange-500/30">
            <div class="flex items-center gap-5">
              <div class="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center border border-orange-100 dark:border-orange-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                <i class="pi pi-eraser text-orange-500 text-2xl group-hover:rotate-12 transition-transform"></i>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.1em]">Limpar Cache Local</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed max-w-2xl">
                  Força a atualização de imagens (como o logotipo), limpa filtros antigos guardados em memória e restaura o desempenho do navegador.
                </p>
              </div>
            </div>
            <Button 
              label="Limpar Agora" 
              icon="pi pi-refresh" 
              @click="limparCacheNavegador" 
              class="!bg-white dark:!bg-slate-800 !text-orange-600 dark:!text-orange-400 !border-orange-200 dark:!border-orange-500/30 hover:!bg-orange-50 dark:hover:!bg-orange-500/20 !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 !py-3 w-full md:w-auto shrink-0 shadow-sm transition-all"
            />
          </div>

        </div>
      </TabPanel>

      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-envelope text-slate-400"></i> <span class="font-bold">E-mail</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">

          <div class="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between shadow-sm">
            <div>
              <h3 class="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                <i class="pi pi-power-off" :class="config.envios_ativos ? 'text-emerald-500' : 'text-rose-500'"></i> 
                Motor de Disparos de E-mail
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium max-w-xl">
                Se desligar esta chave, <span class="text-rose-500 font-bold">NENHUM e-mail de NPS será enviado</span>. 
                O sistema continuará a calcular as datas, mas as mensagens ficarão retidas até que o motor seja reativado.
              </p>
            </div>
            <div class="flex flex-col items-center gap-2">
              <InputSwitch v-model="config.envios_ativos" @change="salvarConfigEmail" />
              
              <span class="text-[10px] font-black uppercase tracking-widest" :class="config.envios_ativos ? 'text-emerald-500' : 'text-rose-500'">
                {{ config.envios_ativos ? 'ATIVADO' : 'PAUSADO' }}
              </span>
            </div>
          </div>
          
          <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-slate-50 dark:border-slate-800 gap-4">
              <div>
                <h3 class="text-sm font-black uppercase text-slate-800 dark:text-white">Envio de E-mails</h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Serviço gerenciado pela Rakiti</p>
              </div>
              <Tag :value="config.provedor === 'resend' ? 'ATIVO' : 'NÃO CONFIGURADO'"
                  :severity="config.provedor === 'resend' ? 'success' : 'warning'"
                  class="!text-[9px] !px-4 !py-2 !rounded-xl !font-black shadow-sm tracking-widest" />
            </div>

            <div class="space-y-6">
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Os convites de pesquisa, lembretes e avisos são enviados pela própria plataforma. Não é preciso configurar servidor de e-mail nem conta Microsoft.
              </p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col gap-2">
                  <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Remetente</label>
                  <InputText :value="config.remetente_nome ? `${config.remetente_nome} <${config.remetente_email}>` : (config.remetente_email || '—')" readonly class="custom-input !bg-slate-50 dark:!bg-slate-950 !text-[12px]" />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Provedor</label>
                  <InputText :value="config.provedor === 'resend' ? 'Resend' : 'Não configurado (fale com o suporte)'" readonly class="custom-input !bg-slate-50 dark:!bg-slate-950 !text-[12px]" />
                </div>
              </div>

              <div class="pt-6 border-t border-slate-50 dark:border-slate-800">
                <Button 
                  label="Enviar E-mail de Teste" 
                  icon="pi pi-send" 
                  @click="enviarTeste" 
                  :loading="enviandoTeste"
                  class="w-full !bg-transparent !border-2 !border-orange-500/20 !text-orange-500 !rounded-2xl !text-[10px] !font-black !uppercase !tracking-widest !py-4 hover:!bg-orange-50 dark:hover:!bg-orange-500/10 hover:scale-[1.01] transition-all" 
                  />
              </div>
            </div>
          </div>

        </div>
      </TabPanel>

      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-android text-slate-400"></i><span class="font-bold">IA</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            <div class="flex justify-between items-start lg:items-center mb-8 pb-6 border-b border-slate-50 dark:border-slate-800 flex-col lg:flex-row gap-4">
              <div class="flex items-center gap-4 group">
                <div class="w-12 h-12 rounded-[1.2rem] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20 shadow-sm group-hover:scale-105 group-hover:bg-emerald-500 group-hover:border-emerald-500 transition-all duration-300">
                  <svg class="w-6 h-6 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A6.0651 6.0651 0 0 0 19.02 19.818a5.9847 5.9847 0 0 0 3.9977-2.9001 6.051 6.051 0 0 0-.7358-7.0967zm-14.5358 1.15l8.6046-4.9658a.4735.4735 0 0 0 .2368-.4114v-1.6384a4.4335 4.4335 0 0 1 2.3023 2.1264 4.3854 4.3854 0 0 1 .4943 2.91 4.4287 4.4287 0 0 1-1.7828 2.5029l-7.3732 4.2526a.4735.4735 0 0 1-.4736 0L1.75 11.23a4.4431 4.4431 0 0 1-.7864-3.1413 4.4093 4.4093 0 0 1 2.0124-2.671 4.4383 4.4383 0 0 1 3.2384-.3676v5.4855a1.6521 1.6521 0 0 0 .8258 1.429zm3.5042-7.394l8.6046 4.9658a.4735.4735 0 0 1 .2368.4114v6.864a4.4335 4.4335 0 0 0-1.808-2.4839 4.3854 4.3854 0 0 0-3.0487-.7146 4.4287 4.4287 0 0 0-2.4347 1.4552l-3.6866 6.386a.4735.4735 0 0 1-.4114.2368H2.174a4.4431 4.4431 0 0 0 2.4578-2.108 4.4093 4.4093 0 0 0 .1786-3.3243 4.4383 4.4383 0 0 0-2.228-2.383L10.05 4.5025a1.6521 1.6521 0 0 1 1.2003-.9256zm-1.8217 12.0031l-8.6046 4.9658a.4735.4735 0 0 0-.2368.4114v1.6384a4.4335 4.4335 0 0 1-2.3023-2.1264 4.3854 4.3854 0 0 1-.4943-2.91 4.4287 4.4287 0 0 1 1.7828-2.5029l7.3732-4.2526a.4735.4735 0 0 1 .4736 0l8.0044 4.6235a4.4431 4.4431 0 0 1 .7864 3.1413 4.4093 4.4093 0 0 1-2.0124 2.671 4.4383 4.4383 0 0 1-3.2384.3676v-5.4855a1.6521 1.6521 0 0 0-.8258-1.429zM12 15.1768a3.1768 3.1768 0 1 1 0-6.3536 3.1768 3.1768 0 0 1 0 6.3536z"/>
                  </svg>
                </div>
                <div class="flex flex-col justify-center">
                  <h2 class="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Integração OpenAI</h2>
                  <p class="text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mt-0.5">Motor Preditivo do Magic AI</p>
                </div>
              </div>
              <Button label="Guardar" icon="pi pi-save" @click="salvarConfiguracoesAI" :loading="savingAIConfig" class="w-full lg:w-auto !bg-indigo-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 !py-3 shadow-xl shadow-indigo-500/30 hover:scale-105 transition-transform" />
            </div>

            <div class="space-y-6 max-w-3xl">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Chave de API (Secret Key)</label>
                <Password v-model="formConfigAI.openai_api_key" :feedback="false" toggleMask placeholder="sk-..." inputClass="custom-input !text-[12px] w-full" class="w-full" />
                <small class="text-slate-400 italic font-medium ml-1">Nunca partilhe esta chave. Obtenha uma em platform.openai.com</small>
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Motor de Processamento (Modelo)</label>
                <Dropdown v-model="formConfigAI.openai_model" :options="opcoesModeloIA" optionLabel="label" optionValue="value" class="custom-input !p-0 !text-[12px]" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Temperatura de Criatividade (0.0 a 1.0)</label>
                <InputText v-model="formConfigAI.ai_temperature" placeholder="0.4" class="custom-input !text-[12px] w-full md:w-1/3" />
              </div>
            </div>
          </div>

        </div>
      </TabPanel>

      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-users text-slate-400"></i> <span class="font-bold">Utilizadores</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            
            <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
              <div>
                <h3 class="text-xl font-black italic tracking-tight text-slate-800 dark:text-white flex items-center gap-3">
                  <i class="pi pi-users text-orange-500"></i> Gestão de Utilizadores
                </h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Controle de acessos, cargos e permissões
                </p>
              </div>
              
              <div class="flex flex-col sm:flex-row gap-3 items-center w-full xl:w-auto bg-slate-50 dark:bg-slate-800/50 p-2 rounded-[1.2rem] border border-slate-100 dark:border-slate-700/50">
                <div class="relative w-full sm:w-64">
                  <i class="pi pi-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <InputText placeholder="Procurar utilizador..." class="custom-input !pl-10 !py-2.5 !bg-white dark:!bg-slate-900 w-full !text-xs !border-none shadow-sm" />
                </div>
                <div class="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                <Button icon="pi pi-refresh" @click="carregarUtilizadores" :loading="carregandoUtilizadores" v-tooltip.top="'Atualizar Lista'" class="w-full sm:w-10 h-10 !bg-white dark:!bg-slate-900 !text-slate-400 !border-none !rounded-xl hover:!text-orange-500 transition-colors shadow-sm shrink-0" />
                <Button label="Novo Utilizador" icon="pi pi-user-plus" @click="abrirNovoUser" class="w-full sm:w-auto !bg-orange-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-5 !py-3 shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform shrink-0" />
              </div>
            </div>

            <DataTable :value="utilizadores" responsiveLayout="stack" breakpoint="960px" class="p-datatable-sm custom-table" :rows="10" paginator rowHover>
              
              <Column header="Usuário">
                <template #body="s">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm">
                      <span class="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {{ s.data.nome ? s.data.nome.charAt(0).toUpperCase() : 'U' }}
                      </span>
                    </div>
                    
                    <div class="flex flex-col">
                      <span class="text-[13px] font-black text-slate-800 dark:text-white leading-tight">
                        {{ s.data.nome }}
                      </span>
                      
                      <div class="flex items-center gap-2 mt-1">
                        <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {{ s.data.email }}
                        </span>
                        
                        <div v-if="s.data.email_verificado" class="bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-200 dark:border-emerald-500/20" v-tooltip.top="'E-mail Verificado'">
                          <i class="pi pi-check-circle text-[8px] text-emerald-500"></i>
                          <span class="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">OK</span>
                        </div>
                        
                        <div v-else class="flex items-center gap-2">
                          <div class="bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-200 dark:border-amber-500/20" v-tooltip.top="'Aguardando Confirmação'">
                            <i class="pi pi-clock text-[8px] text-amber-500"></i>
                            <span class="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">Pendente</span>
                          </div>
                          
                          <button @click.stop="reenviarEmailConfirmacao(s.data.email)" 
                                  class="w-5 h-5 rounded flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shadow-sm"
                                  v-tooltip.top="'Reenviar link de confirmação'">
                            <i class="pi pi-envelope text-[10px]"></i>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </template>
              </Column>

              <Column field="cargo" header="Função">
                <template #body="s">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-briefcase text-slate-300 text-[10px]"></i>
                    <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">{{ s.data.cargo || 'Analista' }}</span>
                  </div>
                </template>
              </Column>
              
              <Column header="Nível de Acesso">
                <template #body="s">
                  <Tag :value="s.data.tipo" :class="s.data.tipo === 'Admin' ? '!bg-rose-50 dark:!bg-rose-500/10 !text-rose-600 dark:!text-rose-400 !border-rose-200 dark:!border-rose-500/20' : '!bg-indigo-50 dark:!bg-indigo-500/10 !text-indigo-600 dark:!text-indigo-400 !border-indigo-200 dark:!border-indigo-500/20'" class="!text-[9px] !font-black !px-3 !py-1 uppercase tracking-widest !rounded-lg border" />
                </template>
              </Column>
              
              <Column header="Status">
                <template #body="s">
                  <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 w-fit px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50">
                    <div :class="['w-2 h-2 rounded-full', s.data.ativo ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-400']"></div>
                    <span class="text-[9px] font-black uppercase tracking-widest" :class="s.data.ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'">{{ s.data.ativo ? 'Ativo' : 'Bloqueado' }}</span>
                  </div>
                </template>
              </Column>
              
              <Column field="ultimo_acesso" header="Último Login" sortable>
                <template #body="{ data }">
                  <span :class="data.ultimo_acesso ? 'text-slate-500 dark:text-slate-400 font-bold text-[11px]' : 'text-slate-300 italic text-[10px] uppercase tracking-widest font-black'">
                    {{ formatarDataHora(data.ultimo_acesso) }}
                  </span>
                </template>
              </Column>
              
              <Column alignFrozen="right" style="width: 150px">
                <template #body="s">
                  <div class="flex gap-2 justify-end">
                    
                    <Button icon="pi pi-pencil" @click="prepararEdicaoUser(s.data)" v-tooltip.top="'Editar Usuário'" class="w-9 h-9 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-xs rounded-xl hover:!bg-indigo-50 hover:!text-indigo-500 transition-all shadow-sm" />
                    
                    <Button :icon="s.data.ativo ? 'pi pi-lock' : 'pi pi-unlock'" @click="alternarStatus(s.data)" v-tooltip.top="s.data.ativo ? 'Bloquear Acesso' : 'Desbloquear Acesso'" :class="['w-9 h-9 !border-none !text-xs rounded-xl transition-all shadow-sm', s.data.ativo ? '!bg-rose-50 dark:!bg-rose-500/10 !text-rose-500 hover:!bg-rose-500 hover:!text-white' : '!bg-emerald-50 dark:!bg-emerald-500/10 !text-emerald-500 hover:!bg-emerald-500 hover:!text-white']" />
                    
                    <Button 
                      v-if="String(s.data.usuario_id) !== String(idUsuarioLogado)" 
                      icon="pi pi-trash" 
                      @click="excluirUtilizador(s.data.usuario_id)" 
                      v-tooltip.top="'Excluir Definitivamente'" 
                      class="w-9 h-9 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 hover:!bg-rose-500 hover:!text-white !border-none !text-xs rounded-xl transition-all shadow-sm" 
                    />
                  </div>
                </template>
              </Column>
              
              <template #empty>
                <div class="flex flex-col items-center justify-center p-12 text-slate-400">
                  <i class="pi pi-users text-4xl mb-4 opacity-50"></i>
                  <span class="text-[10px] font-black uppercase tracking-widest">Nenhum usuário encontrado.</span>
                </div>
              </template>
            </DataTable>
          </div>

        </div>
      </TabPanel>

      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-shield text-slate-400"></i> <span class="font-bold">Permissões</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h3 class="text-xl font-black italic tracking-tight text-slate-800 dark:text-white flex items-center gap-3">
                  <i class="pi pi-shield text-indigo-500"></i> Matriz de Acessos
                </h3>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Controle o que cada perfil pode ver e fazer no sistema
                </p>
              </div>
              
              <Button label="Guardar Matriz" icon="pi pi-check" :loading="savingPermissoes" @click="salvarPermissoes" class="w-full sm:w-auto !bg-indigo-500 hover:!bg-indigo-600 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 !py-3 shadow-lg shadow-indigo-500/20 hover:scale-105 transition-transform shrink-0" />
            </div>

            <div v-if="loadingPermissoes" class="space-y-4">
               <Skeleton height="3rem" class="rounded-xl mb-4" />
               <Skeleton height="15rem" class="rounded-xl" />
            </div>

            <div v-else class="overflow-x-auto custom-scrollbar pb-4">
              <div class="min-w-[700px]">
                
                <div class="grid grid-cols-12 gap-4 mb-4 px-4 items-center bg-slate-50 dark:bg-slate-800/50 py-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                  <div class="col-span-6">
                    <span class="text-[9px] font-black uppercase tracking-widest text-slate-500">Módulos e Funcionalidades</span>
                  </div>
                  <div class="col-span-3 text-center border-l border-slate-200 dark:border-slate-700">
                    <span class="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex flex-col items-center">
                      <i class="pi pi-eye mb-1"></i> Viewer
                    </span>
                  </div>
                  <div class="col-span-3 text-center border-l border-slate-200 dark:border-slate-700">
                    <span class="text-[11px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 flex flex-col items-center">
                      <i class="pi pi-briefcase mb-1"></i> Manager
                    </span>
                  </div>
                </div>

                <div v-for="modulo in modulosPermissoes" :key="modulo.nome" class="mb-6">
                  
                  <div class="flex items-center gap-2 mb-3 pl-2">
                    <i :class="['pi', modulo.icone, modulo.cor, 'text-sm']"></i>
                    <h4 class="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-white">{{ modulo.nome }}</h4>
                  </div>

                  <div class="flex flex-col gap-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-2 shadow-sm">
                    
                    <div v-for="(perm, index) in modulo.permissoes" :key="perm.chave" 
                         :class="['grid grid-cols-12 gap-4 px-4 py-3 items-center rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50', index !== modulo.permissoes.length - 1 ? 'border-b border-slate-50 dark:border-slate-800/50' : '']">
                      
                      <div class="col-span-6 flex flex-col">
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ perm.label }}</span>
                        <span class="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">{{ perm.chave }}</span>
                      </div>

                      <div class="col-span-3 flex justify-center">
                        <div class="bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                          <Checkbox v-model="permissoesAtuais.Viewer" :value="perm.chave" />
                        </div>
                      </div>

                      <div class="col-span-3 flex justify-center">
                        <div class="bg-orange-50 dark:bg-orange-500/10 p-2 rounded-lg border border-orange-100 dark:border-orange-500/20">
                          <Checkbox v-model="permissoesAtuais.Manager" :value="perm.chave" />
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            </div>
            
            <div class="mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl flex items-start gap-3 border border-indigo-100 dark:border-indigo-800/30">
              <i class="pi pi-info-circle text-indigo-500 mt-0.5"></i>
              <p class="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                <strong>Atenção:</strong> O perfil de <span class="font-black uppercase">Admin</span> não é exibido nesta matriz pois possui nativamente acesso total irrestrito (Bypass) a todos os módulos do sistema. Alterações feitas nesta matriz entram em vigor no próximo login dos utilizadores.
              </p>
            </div>

          </div>

        </div>
      </TabPanel>

      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-lock text-slate-400"></i> <span class="font-bold">Segurança</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div class="lg:col-span-4 space-y-6">
              
              <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                <h3 class="text-[11px] font-black uppercase text-slate-800 dark:text-white tracking-widest mb-6 flex items-center gap-2">
                  <i class="pi pi-key text-orange-500"></i> Alterar Senha
                </h3>
                <div class="space-y-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Senha Atual</label>
                    <Password v-model="formSenha.atual" toggleMask :feedback="false" inputClass="custom-input !text-[12px] w-full" class="w-full" />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nova Senha</label>
                    <Password v-model="formSenha.nova" toggleMask inputClass="custom-input !text-[12px] w-full" class="w-full" />
                  </div>
                  <div class="flex flex-col gap-1.5 pb-4">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirmar Nova Senha</label>
                    <Password v-model="formSenha.confirmacao" toggleMask :feedback="false" inputClass="custom-input !text-[12px] w-full" class="w-full" />
                  </div>
                  <Button label="Atualizar Senha" @click="alterarMinhaSenha" :loading="loadingSenha" class="w-full !bg-slate-900 dark:!bg-white dark:!text-slate-900 !text-white !border-none !rounded-2xl !text-[10px] !font-black !uppercase !tracking-widest !py-4 shadow-xl hover:scale-[1.02] transition-transform" />
                </div>
              </div>

              <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                        <i class="pi pi-globe text-xl"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white leading-none mb-1">Domínios Autorizados</h3>
                        <p class="text-[10px] text-slate-400 font-bold leading-tight">E-mails permitidos para SSO e Registo</p>
                    </div>
                </div>

                <div class="flex gap-3 mb-6">
                    <div class="relative flex items-center group w-full max-w-md">
                        <i class="pi pi-at absolute left-4 text-slate-400 z-10 group-focus-within:text-indigo-500 transition-colors" />
                        <InputText 
                            v-model="novoDominio" 
                            @keyup.enter="adicionarDominio" 
                            placeholder="ex: novatech.com" 
                            class="custom-input w-full !pl-10" 
                        />
                    </div>
                    <Button 
                        icon="pi pi-plus" 
                        @click="adicionarDominio" 
                        class="!bg-indigo-500 !border-none !w-11 !h-11 !rounded-xl hover:scale-105 transition-transform" 
                        v-tooltip="'Adicionar Domínio'"
                    />
                </div>

                <div class="flex flex-wrap gap-2 mb-8 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl min-h-[5rem] border border-slate-100 dark:border-slate-800">
                    <div 
                        v-for="dom in listaDominios" :key="dom" 
                        class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-fadein"
                    >
                        <span class="text-[11px] font-black text-slate-600 dark:text-slate-300">{{ dom }}</span>
                        <button 
                            @click="removerDominio(dom)" 
                            class="flex items-center justify-center w-5 h-5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-300 hover:text-rose-500 transition-colors cursor-pointer border-none bg-transparent"
                        >
                            <i class="pi pi-times text-[9px]"></i>
                        </button>
                    </div>
                    
                    <div v-if="listaDominios.length === 0" class="flex items-center text-[11px] font-bold text-rose-500 uppercase tracking-widest w-full">
                        <i class="pi pi-exclamation-triangle mr-2"></i> O acesso está bloqueado para todos.
                    </div>
                </div>

                <div class="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-5">
                    <Button 
                        label="Guardar Permissões" 
                        icon="pi pi-shield" 
                        :loading="salvandoDominios" 
                        @click="salvarDominios" 
                        class="!bg-slate-900 dark:!bg-white !text-white dark:!text-slate-900 !rounded-xl !text-[10px] !font-black uppercase tracking-widest !px-6 !py-3 hover:scale-[1.02] transition-transform !border-none w-full" 
                    />
                </div>
              </div>

            </div>
            
            <div class="lg:col-span-8 space-y-6">
              
              <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div>
                    <h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">Regras de Acesso</h3>
                    <p class="text-[9px] text-slate-400 font-bold italic mt-1">Tempo limite de inatividade</p>
                  </div>
                </div>
                <div class="flex flex-col gap-2 max-w-xl">
                  <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Tempo de Expiração da Sessão</label>
                  <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <InputNumber v-model="configSeguranca.tempo_minutos" inputId="tempo_sessao" :min="5" :max="1440" suffix=" minutos" class="w-full sm:w-48" inputClass="custom-input !text-[12px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10" />
                    <Button label="Guardar Regra" icon="pi pi-save" class="w-full sm:w-auto !bg-indigo-600 !border-none hover:!bg-indigo-700 !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest shadow-xl shadow-indigo-500/30 hover:scale-105 transition-transform px-6 py-4 sm:py-3" @click="salvarSeguranca" :loading="salvandoSeguranca" />
                  </div>
                </div>
              </div>

              <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm h-full">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div>
                    <h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800 dark:text-white">Controlo de Dispositivos</h3>
                    <p class="text-[9px] text-slate-400 font-bold italic mt-1">Sessões ativas no momento</p>
                  </div>
                  <Button v-if="sessoesAtivas.length > 1" label="Encerrar Outras Sessões" icon="pi pi-bolt" @click="encerrarTodasAsSessoes" :loading="loadingSessoes" class="w-full md:w-auto !bg-rose-50 dark:!bg-rose-500/10 !text-rose-600 dark:!text-rose-400 !border-none !text-[10px] !font-black !uppercase !tracking-widest !px-6 !py-3 !rounded-xl hover:!bg-rose-600 hover:!text-white transition-all shadow-sm hover:scale-105" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div v-for="sessao in sessoesAtivas" :key="sessao.id" class="p-5 rounded-[2rem] border border-slate-50 dark:border-slate-800 flex flex-col gap-4 relative transition-all" :class="sessao.atual ? 'bg-orange-50/30 border-orange-100 shadow-inner' : 'bg-white dark:bg-slate-900 shadow-sm'">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0" :class="sessao.atual ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'">
                        <i :class="[sessao.dispositivo.includes('iPhone') ? 'pi pi-mobile' : 'pi pi-desktop']"></i>
                      </div>
                      <div class="overflow-hidden">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h4 class="text-[11px] font-bold text-slate-800 dark:text-white truncate">{{ sessao.dispositivo }}</h4>
                          <Tag v-if="sessao.atual" value="Este Dispositivo" severity="warning" class="!text-[8px] !px-2 !font-black !uppercase !tracking-widest" />
                        </div>
                        <p class="text-[9px] text-slate-400 font-medium tracking-tight truncate">{{ sessao.local }} • {{ sessao.ip }}</p>
                      </div>
                    </div>
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                      <span class="text-[9px] font-black text-slate-300 uppercase tracking-widest">{{ sessao.data }}</span>
                      <Button v-if="!sessao.atual" icon="pi pi-sign-out" label="Revogar" @click="encerrarSessao(sessao.id)" class="!text-[9px] !font-black !p-0 !text-rose-400 !bg-transparent !border-none hover:!text-rose-600 uppercase tracking-widest" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </TabPanel>
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-link text-slate-400"></i> <span class="font-bold">Integrações</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div>
            <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1">Integrações de Sistema</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Ligue o Hub de NPS a ferramentas externas como formulários e canais de comunicação.</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col justify-between relative overflow-hidden group mb-8 shadow-lg">
              <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

              <div class="relative z-10">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                    <i class="pi pi-download text-emerald-400 text-xl"></i>
                  </div>
                  <div>
                    <h4 class="text-sm font-black text-white">Webhook de Recepção</h4>
                    <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Ponto de Entrada (Fillout)</p>
                  </div>
                </div>
                
                <p class="text-xs text-slate-400 leading-relaxed mb-6">
                  Cole este endereço no webhook do seu formulário (Fillout) para que as respostas cheguem automaticamente ao painel. Ele contém uma chave secreta da sua conta: não compartilhe.
                </p>
                
                <div class="flex flex-col gap-2">
                  <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">URL de Escuta (Endpoint)</label>
                  <div class="flex items-center gap-2">
                    <div class="relative flex-1">
                      <i class="pi pi-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 z-10" />
                      <InputText 
                        :value="webhookFilloutURL" 
                        readonly 
                        class="custom-input !w-full !bg-slate-950 !border-slate-800 !text-slate-300 !text-[11px] !pl-10 !font-mono" 
                      />
                    </div>
                    
                    <Button 
                      icon="pi pi-copy" 
                      @click="copiarWebhookFillout" 
                      class="!bg-slate-800 !text-slate-300 !border-none !rounded-xl !w-11 !h-11 hover:!bg-slate-700 hover:!text-white transition-all shrink-0" 
                      v-tooltip.top="'Copiar URL'" 
                    />
                    
                    <Button 
                      icon="pi pi-bolt" 
                      :loading="testingIncoming"
                      @click="testarWebhookRecebimento" 
                      class="!bg-emerald-500/20 !text-emerald-400 !border-none !rounded-xl !w-11 !h-11 hover:!bg-emerald-500 hover:!text-white transition-all shrink-0" 
                      v-tooltip.top="'Testar Status da Escuta'" 
                    />
                    <Button 
                      icon="pi pi-refresh" 
                      @click="regenerarWebhook" 
                      class="!bg-slate-800 !text-slate-300 !border-none !rounded-xl !w-11 !h-11 hover:!bg-rose-600 hover:!text-white transition-all shrink-0" 
                      v-tooltip.top="'Gerar novo link (invalida o atual)'" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden group shadow-sm">
              <div class="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity"><i class="pi pi-microsoft text-9xl text-slate-900 dark:text-white"></i></div>
              <div>
                <div class="flex items-center gap-3 mb-4 relative z-10">
                  <div class="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/20 shadow-sm rounded-xl flex items-center justify-center"><i class="pi pi-microsoft text-indigo-500 text-xl"></i></div>
                  <div><h4 class="text-sm font-black text-slate-800 dark:text-white">Microsoft Teams</h4><p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Notificações e Alertas</p></div>
                </div>
                
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6 relative z-10">
                  Configure os canais do <strong>Incoming Webhook</strong> para receber os alertas operacionais e técnicos diretamente na sua equipa.
                </p>
                
                <div class="space-y-5 relative z-10">
                  <div class="flex flex-col gap-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Canal Global (Feedbacks) <span class="text-orange-500">*</span>
                    </label>
                    <InputText 
                      v-model="integracoesConfig.webhook_global" 
                      placeholder="https://suaempresa.webhook.office.com/..." 
                      class="custom-input !w-full !bg-slate-50 dark:!bg-slate-800 !text-[11px]" 
                    />
                  </div>

                  <div class="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                      Canal Técnico (DevOps / TI)
                    </label>
                    <InputText 
                      v-model="integracoesConfig.webhook_tecnico" 
                      placeholder="https://suaempresa.webhook.office.com/..." 
                      class="custom-input !w-full !bg-slate-50 dark:!bg-slate-800 !text-[11px]" 
                    />
                    <p class="text-[9px] text-slate-400 font-medium ml-1 mt-0.5 leading-relaxed">
                      Recebe notificações de falhas críticas (ex: Timeout na Azure, Banco Offline).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button label="Guardar Integrações" icon="pi pi-save" :loading="savingIntegracoes" @click="salvarIntegracoes" class="!bg-slate-900 dark:!bg-white dark:!text-slate-900 !text-white !border-none font-black text-xs uppercase tracking-widest px-6 py-3 shadow-xl hover:-translate-y-0.5 transition-transform" />
          </div>

        </div>
      </TabPanel>

      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-cog text-slate-400"></i> <span class="font-bold">Regras & Operação</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4 ">
          
          <div class="bg-slate-900 dark:bg-slate-950 rounded-[2rem] p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
            <div class="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-6">
              
              <div class="flex flex-col gap-4">
                <div>
                  <h3 class="text-xl font-black italic tracking-tight mb-1 flex items-center gap-3">
                    <i class="pi pi-bolt text-orange-500"></i> Motor de Disparo <span class="text-orange-500">.</span>
                  </h3>
                  <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Controlo da fila de espera e execução manual</p>
                </div>
                
                <div class="flex items-center gap-3 bg-white/5 border border-white/10 py-2.5 px-4 rounded-xl w-fit backdrop-blur-sm">
                <InputSwitch v-model="regrasConfig.robo_ativo" @change="salvarRegras" class="scale-90" />
                <div class="flex flex-col">
                  <span class="text-[10px] font-black uppercase tracking-widest text-white">Robô Automático</span>
                  <span class="text-[8.5px] font-bold mt-0.5" :class="regrasConfig.robo_ativo ? 'text-emerald-400' : 'text-rose-400'">
                    {{ regrasConfig.robo_ativo ? 'LIGADO (Disparos em Background)' : 'DESLIGADO (Apenas Disparos Manuais)' }}
                  </span>
                </div>
              </div>
              </div>
              
              <div class="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 p-3 md:p-4 rounded-2xl backdrop-blur-sm">
                <div class="flex flex-col px-4">
                  <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Na Fila de Espera</span>
                  <div class="flex items-baseline gap-1.5 mt-0.5">
                    <span class="text-3xl font-black text-white leading-none">
                      {{ typeof totalElegiveisNPS === 'number' && totalElegiveisNPS < 1000000 ? totalElegiveisNPS : 0 }}
                    </span>
                    <span class="text-[10px] font-bold text-slate-500">clientes</span>
                  </div>
                </div>
                <div class="hidden md:block w-px h-10 bg-white/10"></div>
                <Button label="Forçar Disparo Agora" icon="pi pi-play" @click="forcarDisparoNPS" :loading="disparandoNPS" class="!bg-orange-500 !text-white !border-none !rounded-xl !font-black !uppercase !tracking-widest !text-[10px] !px-6 !py-3 shadow-lg shadow-orange-500/20 hover:!bg-orange-600 hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4 py-2">
             <div class="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
             <span class="text-[9px] font-black uppercase tracking-widest text-slate-400"><i class="pi pi-sliders-h mr-1"></i> Parâmetros do Robô & SLA</span>
             <div class="h-px bg-slate-200 dark:bg-slate-800 flex-1"></div>
          </div>
            
          <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-1 flex items-center gap-2">
                <i class="pi pi-sliders-h text-orange-500"></i> Regras de Negócio
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Controlo absoluto sobre os tempos de resposta, formulários e comunicação com o cliente.</p>
            </div>
            <Button label="Guardar Regras" icon="pi pi-save" :loading="savingRegras" @click="salvarRegras" class="!bg-slate-900 dark:!bg-white dark:!text-slate-900 !text-white !border-none font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl shadow-xl hover:-translate-y-0.5 transition-transform" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div class="md:col-span-2 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row">
              
              <div class="p-6 lg:p-8 flex-1 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <div class="flex items-center gap-3 mb-8">
                  <div class="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-sm shrink-0"><i class="pi pi-bolt text-lg"></i></div>
                  <div>
                    <h4 class="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Motor & Contexto</h4>
                    <p class="text-[9px] text-slate-400 font-medium mt-0.5">Cadência de envios e injeção de dados</p>
                  </div>
                </div>

                <div class="space-y-6">

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div class="flex flex-col gap-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">1º Envio do Dia</label>
                    <InputText v-model="regrasConfig.scheduler_hora_inicio" placeholder="09:00" class="w-full text-center font-bold text-[11px] !py-3 !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm focus:!ring-2 focus:!ring-orange-500/20" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Repetir a cada</label>
                    <InputNumber v-model="regrasConfig.scheduler_horas" :min="1" :max="48" suffix=" horas" class="w-full" inputClass="w-full text-center font-bold text-[11px] !py-3 !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm focus:!ring-2 focus:!ring-orange-500/20" />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-orange-500 ml-1 flex items-center gap-1.5">
                      <i class="pi pi-sync text-[8px]"></i> Recorrência do NPS
                    </label>
                    <InputNumber 
                      v-model="regrasConfig.recorrencia_dias" 
                      :min="1" 
                      :max="365" 
                      suffix=" dias" 
                      class="w-full" 
                      inputClass="w-full text-center font-black text-[11px] !py-3 !bg-orange-50 dark:!bg-orange-500/10 text-orange-600 dark:text-orange-400 !border-orange-200 dark:!border-orange-500/30 !rounded-xl shadow-sm focus:!ring-2 focus:!ring-orange-500/20" 
                      v-tooltip.top="'Tempo de carência (intervalo mínimo) para disparar nova pesquisa ao mesmo cliente.'" 
                    />
                  </div>
                  </div>

                  <div class="flex flex-col gap-2 pt-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-orange-500 ml-1 flex items-center justify-between">
                      Link do Formulário de Pesquisa
                      <i class="pi pi-info-circle text-slate-400" v-tooltip.top="'Endereço do seu formulário (ex.: Fillout). Os convites levam o cliente para este link. Sem ele, nenhum convite é enviado.'"></i>
                    </label>
                    <InputText v-model="regrasConfig.survey_url" placeholder="https://forms.fillout.com/t/SEU_FORMULARIO" class="custom-input !bg-white dark:!bg-slate-900 !text-[11px] !font-mono shadow-sm !rounded-xl" :class="{'!border-rose-400': !regrasConfig.survey_url}" />
                    <p v-if="!regrasConfig.survey_url" class="text-[9px] text-rose-500 font-bold ml-1 uppercase tracking-widest">Obrigatório para enviar pesquisas</p>
                  </div>

                  <div class="flex flex-col gap-2 pt-2">
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center justify-between">
                      Injeção de Dados (Hidden Fields)
                      <i class="pi pi-info-circle text-slate-400" v-tooltip.top="'Variáveis invisíveis passadas para a URL do Fillout'"></i>
                    </label>
                    <MultiSelect v-model="regrasConfig.fillout_campos" :options="opcoesCamposFillout" optionLabel="label" optionValue="value" display="chip" placeholder="Selecione as variáveis" class="custom-input !bg-white dark:!bg-slate-900 !py-2 shadow-sm !rounded-xl" />
                  </div>
                </div>
              </div>

              <div class="p-6 lg:p-8 flex-1 bg-white dark:bg-slate-900 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <div class="flex items-center gap-3 mb-8">
                  <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm shrink-0"><i class="pi pi-stopwatch text-lg"></i></div>
                  <div>
                    <h4 class="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Prazos de Resolução</h4>
                    <p class="text-[9px] text-slate-400 font-medium mt-0.5">SLA de encerramento no Kanban</p>
                  </div>
                </div>

                <div class="flex flex-col gap-3.5">
                  <div class="flex items-center justify-between bg-white dark:bg-slate-800/80 p-3 pl-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
                    <div>
                      <span class="text-[10px] font-black uppercase tracking-widest text-rose-500 block">Detratores</span>
                      <span class="text-[9px] text-slate-400 font-medium mt-0.5 block">Prioridade Máxima</span>
                    </div>
                    <InputNumber v-model="regrasConfig.sla_detrator_dias" :min="1" suffix=" dias" class="w-24" inputClass="w-full text-center font-black text-[11px] text-rose-600 !bg-rose-50 dark:!bg-rose-500/10 !border-none !py-2.5 !rounded-lg" />
                  </div>

                  <div class="flex items-center justify-between bg-white dark:bg-slate-800/80 p-3 pl-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-500"></div>
                    <div>
                      <span class="text-[10px] font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-500 block">Neutros</span>
                      <span class="text-[9px] text-slate-400 font-medium mt-0.5 block">Atenção Moderada</span>
                    </div>
                    <InputNumber v-model="regrasConfig.sla_neutro_dias" :min="1" suffix=" dias" class="w-24" inputClass="w-full text-center font-black text-[11px] text-yellow-600 !bg-yellow-50 dark:!bg-yellow-500/10 !border-none !py-2.5 !rounded-lg" />
                  </div>

                  <div class="flex items-center justify-between bg-white dark:bg-slate-800/80 p-3 pl-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
                    <div>
                      <span class="text-[10px] font-black uppercase tracking-widest text-emerald-500 block">Promotores</span>
                      <span class="text-[9px] text-slate-400 font-medium mt-0.5 block">Manutenção Padrão</span>
                    </div>
                    <InputNumber v-model="regrasConfig.sla_promotor_dias" :min="1" suffix=" dias" class="w-24" inputClass="w-full text-center font-black text-[11px] text-emerald-600 !bg-emerald-50 dark:!bg-emerald-500/10 !border-none !py-2.5 !rounded-lg" />
                  </div>
                </div>
              </div>
            </div>

            <div class="md:col-span-2 bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
              <div class="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div class="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-500 shadow-sm shrink-0">
                  <i class="pi pi-calendar-clock text-lg"></i>
                </div>
                <div>
                  <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Régua de Lembretes Automáticos</h3>
                  <p class="text-[10px] text-slate-400 font-bold mt-0.5">Defina a cadência de insistência para clientes que não responderam.</p>
                </div>
              </div>

              <div class="space-y-6">
                <div class="flex flex-col gap-2 w-full md:w-1/3">
                  <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Quantidade Máxima de Lembretes</label>
                  <Dropdown 
                    v-model="regrasConfig.lembrete_qtd_maxima" 
                    :options="[0, 1, 2, 3]" 
                    placeholder="Selecione" 
                    class="custom-input !py-1 w-full font-bold" 
                  />
                </div>

                <div v-if="regrasConfig.lembrete_qtd_maxima > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  
                  <div v-if="regrasConfig.lembrete_qtd_maxima >= 1" class="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-400"></div>
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2">1º Lembrete</label>
                    <InputNumber v-model="regrasConfig.lembrete_dias_1" suffix=" dias após envio" class="w-full" inputClass="w-full text-center font-bold text-[11px] !py-2.5 !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm focus:!ring-2 focus:!ring-sky-500/20 text-sky-600 dark:text-sky-400" />
                  </div>

                  <div v-if="regrasConfig.lembrete_qtd_maxima >= 2" class="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-400"></div>
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2">2º Lembrete</label>
                    <InputNumber v-model="regrasConfig.lembrete_dias_2" suffix=" dias após envio" class="w-full" inputClass="w-full text-center font-bold text-[11px] !py-2.5 !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm focus:!ring-2 focus:!ring-indigo-500/20 text-indigo-600 dark:text-indigo-400" />
                  </div>

                  <div v-if="regrasConfig.lembrete_qtd_maxima === 3" class="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                    <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500"></div>
                    <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2">3º Lembrete</label>
                    <InputNumber v-model="regrasConfig.lembrete_dias_3" suffix=" dias após envio" class="w-full" inputClass="w-full text-center font-bold text-[11px] !py-2.5 !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm focus:!ring-2 focus:!ring-purple-500/20 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                
                <div v-if="regrasConfig.lembrete_qtd_maxima > 0" class="flex items-center gap-3 text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-100 dark:border-amber-500/20">
                  <i class="pi pi-exclamation-triangle text-lg"></i>
                  O sistema interrompe a cadeia de lembretes automaticamente no momento em que o cliente submete a avaliação.
                </div>
              </div>
            </div>
            
            <div class="md:col-span-2 bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-4 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
              <div class="flex items-center gap-4 w-full lg:w-auto">
                <div class="w-12 h-12 rounded-[1.2rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shadow-sm shrink-0 border border-indigo-100 dark:border-indigo-500/20 group-hover:scale-105 transition-transform">
                  <i class="pi pi-microsoft text-indigo-500 text-xl"></i>
                </div>
                <div>
                  <h4 class="text-[12px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Resumo Matinal (Teams)</h4>
                  <p class="text-[10px] text-slate-400 font-medium mt-0.5">Horário de envio automático do Kanban de pendências aos gestores.</p>
                </div>
              </div>

              <div class="flex items-center gap-4 w-full lg:w-auto">
                <div class="flex-1 lg:w-48 relative">
                  <i class="pi pi-clock absolute left-4 top-1/2 -translate-y-1/2 z-20 text-slate-400" />
                  <input
                    type="time"
                    v-model="regrasConfig.teams_horario_resumo"
                    class="custom-input w-full cursor-pointer pl-11 py-3 text-[12px] font-black text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                  />
                </div>
                <Button
                  @click="salvarRegras"
                  :loading="savingRegras"
                  icon="pi pi-save"
                  label="Guardar"
                  class="w-full sm:w-auto !bg-indigo-600 !text-white !border-none hover:!bg-indigo-700 !px-6 !py-3 !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest shadow-xl shadow-indigo-500/30 hover:scale-105 transition-transform shrink-0"
                />
              </div>
            </div>

            <div class="md:col-span-2 bg-slate-50 dark:bg-slate-800/40 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-8 mt-8">
              <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <i class="pi pi-images text-orange-500"></i> Gestor de Imagens para E-mails
              </h4>
              
              <div class="flex flex-col gap-4">
                <p class="text-[11px] text-slate-500 font-medium">Faça o upload das imagens do seu template (ex: banner, logo) para gerar um link público. Clique em "Copiar" e cole o link no atributo <code class="text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-1 rounded">src="..."</code> do seu HTML.</p>
                
                <div class="flex items-center gap-4 mt-2">
                  <input type="file" ref="fileInputImagem" accept="image/*" class="hidden" @change="processarUploadImagem" />
                  <Button label="Hospedar Nova Imagem" icon="pi pi-upload" :loading="enviandoImagem" @click="triggerUploadImagem" class="!bg-slate-900 dark:!bg-slate-100 !text-white dark:!text-slate-900 !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-5 shadow-md" />
                </div>

                <div v-if="imagensUpload.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                  <div v-for="img in imagensUpload" :key="img.url" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] flex flex-col shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    
                    <div class="h-44 w-full relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlNWU3ZWIiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2U1ZTdlYiI+PC9yZWN0Pgo8L3N2Zz4=')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjMWUyOTNiIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMwZjE3MmEiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iIzBmMTcyYSI+PC9yZWN0Pgo8L3N2Zz4=')] flex items-center justify-center p-4">
                      <img :src="img.url" class="max-w-full max-h-full object-contain drop-shadow-md" :alt="img.nome" />
                      
                      <div class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                        <Button icon="pi pi-copy" label="Copiar URL" class="!bg-white hover:!bg-slate-100 !text-slate-900 !border-none !text-[10px] !font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-transform hover:scale-105 shadow-xl" @click="copiarUrl(img.url)" />
                        <Button icon="pi pi-trash" class="!bg-rose-500 hover:!bg-rose-600 !text-white !border-none !w-9 !h-9 !p-0 rounded-xl flex items-center justify-center transition-transform hover:scale-105 shadow-xl" v-tooltip.top="'Apagar Imagem'" @click="removerImagem(img.nome)" />
                      </div>
                    </div>

                    <div class="p-5 flex flex-col border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <span class="text-[11px] font-black text-slate-800 dark:text-slate-200 break-words leading-tight mb-2">
                        {{ img.nome }}
                      </span>
                      <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                        <i class="pi pi-link text-[10px] text-sky-500 shrink-0"></i>
                        <span class="text-[9px] font-medium text-slate-500 dark:text-slate-400 truncate w-full" :title="img.url">{{ img.url }}</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            <div class="md:col-span-2 bg-white dark:bg-slate-900 p-2 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
              <div class="bg-slate-950 rounded-[1.5rem] overflow-hidden border border-slate-800 shadow-2xl">
                
                <div class="flex flex-col md:flex-row justify-between items-center bg-slate-900 px-6 py-4 border-b border-slate-800 gap-4">
                  <div class="flex items-center gap-3">
                    <div class="flex gap-1.5"><div class="w-3 h-3 rounded-full bg-rose-500"></div><div class="w-3 h-3 rounded-full bg-yellow-500"></div><div class="w-3 h-3 rounded-full bg-emerald-500"></div></div>
                    <div class="w-px h-4 bg-slate-700 mx-2"></div>
                    <i class="pi pi-send text-sky-400 text-sm"></i>
                    <h4 class="text-[11px] font-black uppercase tracking-widest text-white">HTML: E-mail de Convite</h4>
                  </div>

                  <div class="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <i class="pi pi-envelope text-slate-500 pl-2 text-[10px]"></i>
                    <InputText v-model="emailTesteConvite" placeholder="E-mail de teste..." class="!border-none !shadow-none !bg-transparent !text-slate-300 !text-[10px] w-36 placeholder:text-slate-600" />
                    <Button icon="pi pi-play" label="Executar Preview" :loading="loadingTesteConvite" @click="testarTemplateConvite" class="!bg-sky-500/20 !text-sky-400 hover:!bg-sky-500 hover:!text-white !border-none !rounded-lg !text-[9px] !font-black !uppercase !tracking-widest !px-3 !py-1.5 transition-all" />
                  </div>
                </div>

                <div class="bg-slate-900/50 px-6 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                  <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest shrink-0">Injetáveis:</span>
                  <Tag value="{nome}" class="!bg-sky-900/40 !text-sky-300 !text-[9px] !font-mono border border-sky-800/50" />
                  <Tag value="{empresa}" class="!bg-sky-900/40 !text-sky-300 !text-[9px] !font-mono border border-sky-800/50" />
                  <Tag value="{survey_url}" class="!bg-rose-900/40 !text-rose-300 !text-[9px] !font-mono border border-rose-800/50" v-tooltip.top="'Obrigatório (Link do Botão)'" />
                  
                  <Button label="Auto-Corrigir Imagens" icon="pi pi-magic" @click="aplicarImagensInteligente('convite')" class="ml-auto !bg-sky-500/10 hover:!bg-sky-500/30 !text-sky-300 !border-none !text-[9px] !font-black !uppercase tracking-widest !py-1 !px-3 rounded-lg shadow-sm transition-colors shrink-0" v-tooltip.top="'Injeta as URLs das imagens hospedadas.'" />
                </div>

                <div class="bg-[#0b1120] px-6 py-1.5 border-b border-slate-800/80 flex items-center gap-2">
                  <i class="pi pi-search text-slate-500 text-[10px]"></i>
                  <input v-model="buscaConvite.termo" @keyup.enter="buscarNoTemplate('convite')" @input="resetarBusca('convite')" placeholder="Localizar no código (Enter)..." class="bg-transparent border-none outline-none text-[10px] text-slate-300 flex-1 placeholder:text-slate-600 focus:ring-0" spellcheck="false" />
                  <div v-if="buscaConvite.matches.length > 0" class="flex items-center gap-2 animate-fadein">
                    <span class="text-[9px] font-black text-sky-400 tracking-widest">{{ buscaConvite.atual + 1 }} DE {{ buscaConvite.matches.length }}</span>
                    <button @click="buscarNoTemplate('convite')" class="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" v-tooltip.top="'Próximo'"><i class="pi pi-angle-down text-[10px]"></i></button>
                  </div>
                </div>

                <Textarea ref="textareaConvite" v-model="regrasConfig.email_template_html" rows="12" :placeholder="modeloBaseConvite" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-sky-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
              </div>
            </div>

            <div class="md:col-span-2 bg-white dark:bg-slate-900 p-2 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
              <div class="bg-slate-950 rounded-[1.5rem] overflow-hidden border border-slate-800 shadow-2xl">
                
                <div class="flex flex-col md:flex-row justify-between items-center bg-slate-900 px-6 py-4 border-b border-slate-800 gap-4">
                  <div class="flex items-center gap-3">
                    <div class="flex gap-1.5"><div class="w-3 h-3 rounded-full bg-rose-500"></div><div class="w-3 h-3 rounded-full bg-yellow-500"></div><div class="w-3 h-3 rounded-full bg-emerald-500"></div></div>
                    <div class="w-px h-4 bg-slate-700 mx-2"></div>
                    <i class="pi pi-history text-purple-400 text-sm"></i>
                    <h4 class="text-[11px] font-black uppercase tracking-widest text-white">HTML: E-mail de Lembrete</h4>
                  </div>

                  <div class="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <i class="pi pi-envelope text-slate-500 pl-2 text-[10px]"></i>
                    <InputText v-model="emailTesteLembrete" placeholder="E-mail de teste..." class="!border-none !shadow-none !bg-transparent !text-slate-300 !text-[10px] w-36 placeholder:text-slate-600" />
                    <Button icon="pi pi-play" label="Executar Preview" :loading="loadingTesteLembrete" @click="testarTemplateLembrete" class="!bg-purple-500/20 !text-purple-400 hover:!bg-purple-500 hover:!text-white !border-none !rounded-lg !text-[9px] !font-black !uppercase !tracking-widest !px-3 !py-1.5 transition-all" />
                  </div>
                </div>

                <div class="bg-slate-900/80 px-4 pt-3 border-b border-slate-800 flex gap-2 overflow-x-auto">
                  <button v-if="regrasConfig.lembrete_qtd_maxima >= 1" @click="abaEmailLembrete = '1'" :class="abaEmailLembrete === '1' ? 'bg-slate-800 text-purple-400 border-t-2 border-purple-500' : 'text-slate-500 hover:bg-slate-800/50 border-t-2 border-transparent'" class="px-5 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <i class="pi pi-file text-[10px]"></i> 1º Lembrete
                  </button>
                  <button v-if="regrasConfig.lembrete_qtd_maxima >= 2" @click="abaEmailLembrete = '2'" :class="abaEmailLembrete === '2' ? 'bg-slate-800 text-purple-400 border-t-2 border-purple-500' : 'text-slate-500 hover:bg-slate-800/50 border-t-2 border-transparent'" class="px-5 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <i class="pi pi-file text-[10px]"></i> 2º Lembrete
                  </button>
                  <button v-if="regrasConfig.lembrete_qtd_maxima === 3" @click="abaEmailLembrete = '3'" :class="abaEmailLembrete === '3' ? 'bg-slate-800 text-purple-400 border-t-2 border-purple-500' : 'text-slate-500 hover:bg-slate-800/50 border-t-2 border-transparent'" class="px-5 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <i class="pi pi-file text-[10px]"></i> 3º Lembrete
                  </button>
                </div>

                <div class="bg-slate-800/50 px-6 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                  <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest shrink-0">Injetáveis:</span>
                  <Tag value="{nome}" class="!bg-purple-900/40 !text-purple-300 !text-[9px] !font-mono border border-purple-800/50" />
                  <Tag value="{empresa}" class="!bg-purple-900/40 !text-purple-300 !text-[9px] !font-mono border border-purple-800/50" />
                  <Tag value="{survey_url}" class="!bg-rose-900/40 !text-rose-300 !text-[9px] !font-mono border border-rose-800/50" v-tooltip.top="'Obrigatório (Link do Botão)'" />
                  
                  <Button label="Auto-Corrigir Imagens" icon="pi pi-magic" @click="aplicarImagensInteligente('lembrete' + abaEmailLembrete)" class="ml-auto !bg-purple-500/10 hover:!bg-purple-500/30 !text-purple-300 !border-none !text-[9px] !font-black !uppercase tracking-widest !py-1 !px-3 rounded-lg shadow-sm transition-colors shrink-0" v-tooltip.top="'Injeta as URLs das imagens hospedadas na aba atual.'" />
                </div>

                <div class="bg-[#0b1120] px-6 py-1.5 border-b border-slate-800/80 flex items-center gap-2">
                  <i class="pi pi-search text-slate-500 text-[10px]"></i>
                  <input v-model="buscaLembrete.termo" @keyup.enter="buscarNoTemplate('lembrete')" @input="resetarBusca('lembrete')" placeholder="Localizar na aba atual (Enter)..." class="bg-transparent border-none outline-none text-[10px] text-slate-300 flex-1 placeholder:text-slate-600 focus:ring-0" spellcheck="false" />
                  <div v-if="buscaLembrete.matches.length > 0" class="flex items-center gap-2 animate-fadein">
                    <span class="text-[9px] font-black text-purple-400 tracking-widest">{{ buscaLembrete.atual + 1 }} DE {{ buscaLembrete.matches.length }}</span>
                    <button @click="buscarNoTemplate('lembrete')" class="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><i class="pi pi-angle-down text-[10px]"></i></button>
                  </div>
                </div>

                <div v-show="abaEmailLembrete === '1' && regrasConfig.lembrete_qtd_maxima >= 1" class="animate-fadein bg-slate-800/30">
                  <Textarea ref="textareaLembrete1" v-model="regrasConfig.email_template_lembrete_1" rows="12" :placeholder="modeloBaseLembrete" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-purple-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
                </div>
                <div v-show="abaEmailLembrete === '2' && regrasConfig.lembrete_qtd_maxima >= 2" class="animate-fadein bg-slate-800/30">
                  <Textarea ref="textareaLembrete2" v-model="regrasConfig.email_template_lembrete_2" rows="12" :placeholder="modeloBaseLembrete" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-purple-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
                </div>
                <div v-show="abaEmailLembrete === '3' && regrasConfig.lembrete_qtd_maxima === 3" class="animate-fadein bg-slate-800/30">
                  <Textarea ref="textareaLembrete3" v-model="regrasConfig.email_template_lembrete_3" rows="12" :placeholder="modeloBaseLembrete" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-purple-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
                </div>

              </div>
            </div>

            <div class="md:col-span-2 bg-white dark:bg-slate-900 p-2 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-4 mb-8">
              <div class="bg-slate-950 rounded-[1.5rem] overflow-hidden border border-slate-800 shadow-2xl">
                
                <div class="flex flex-col md:flex-row justify-between items-center bg-slate-900 px-6 py-4 border-b border-slate-800 gap-4">
                  <div class="flex items-center gap-3">
                    <div class="flex gap-1.5"><div class="w-3 h-3 rounded-full bg-rose-500"></div><div class="w-3 h-3 rounded-full bg-yellow-500"></div><div class="w-3 h-3 rounded-full bg-emerald-500"></div></div>
                    <div class="w-px h-4 bg-slate-700 mx-2"></div>
                    <i class="pi pi-reply text-emerald-400 text-sm"></i>
                    <h4 class="text-[11px] font-black uppercase tracking-widest text-white">HTML: Close The Loop</h4>
                  </div>

                  <div class="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <i class="pi pi-envelope text-slate-500 pl-2 text-[10px]"></i>
                    <InputText v-model="emailTesteAgradecimento" placeholder="E-mail de teste..." class="!border-none !shadow-none !bg-transparent !text-slate-300 !text-[10px] w-36 placeholder:text-slate-600" />
                    <Button icon="pi pi-play" label="Executar Preview" :loading="loadingTesteAgradecimento" @click="testarTemplateAgradecimento" class="!bg-emerald-500/20 !text-emerald-400 hover:!bg-emerald-500 hover:!text-white !border-none !rounded-lg !text-[9px] !font-black !uppercase !tracking-widest !px-3 !py-1.5 transition-all" />
                  </div>
                </div>

                <div class="bg-slate-900/80 px-4 pt-3 border-b border-slate-800 flex gap-2 overflow-x-auto">
                  <button @click="abaEmailAgradecimento = 'promotor'" :class="abaEmailAgradecimento === 'promotor' ? 'bg-slate-800 text-emerald-400 border-t-2 border-emerald-500' : 'text-slate-500 hover:bg-slate-800/50 border-t-2 border-transparent'" class="px-5 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <i class="pi pi-file text-[10px]"></i> Promotores.html
                  </button>
                  <button @click="abaEmailAgradecimento = 'neutro'" :class="abaEmailAgradecimento === 'neutro' ? 'bg-slate-800 text-yellow-400 border-t-2 border-yellow-500' : 'text-slate-500 hover:bg-slate-800/50 border-t-2 border-transparent'" class="px-5 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <i class="pi pi-file text-[10px]"></i> Neutros.html
                  </button>
                  <button @click="abaEmailAgradecimento = 'detrator'" :class="abaEmailAgradecimento === 'detrator' ? 'bg-slate-800 text-rose-400 border-t-2 border-rose-500' : 'text-slate-500 hover:bg-slate-800/50 border-t-2 border-transparent'" class="px-5 py-2.5 rounded-t-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    <i class="pi pi-file text-[10px]"></i> Detratores.html
                  </button>
                </div>

                <div class="bg-slate-800/50 px-6 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                  <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest shrink-0">Injetáveis:</span>
                  <Tag value="{nome}" class="!bg-emerald-900/30 !text-emerald-400 !text-[9px] !font-mono border border-emerald-800/50" />
                  <Tag value="{empresa}" class="!bg-emerald-900/30 !text-emerald-400 !text-[9px] !font-mono border border-emerald-800/50" />
                  <Tag value="{nota}" class="!bg-emerald-900/30 !text-emerald-400 !text-[9px] !font-mono border border-emerald-800/50" />
                  <Tag value="{motivo}" class="!bg-orange-900/30 !text-orange-400 !text-[9px] !font-mono border border-orange-800/50" />
                  
                  <Button label="Auto-Corrigir Imagens" icon="pi pi-magic" @click="aplicarImagensInteligente('agradecimento_' + abaEmailAgradecimento)" class="ml-auto !bg-emerald-500/10 hover:!bg-emerald-500/30 !text-emerald-300 !border-none !text-[9px] !font-black !uppercase tracking-widest !py-1 !px-3 rounded-lg shadow-sm transition-colors shrink-0" v-tooltip.top="'Injeta as URLs das imagens hospedadas na aba atual.'" />
                </div>

                <div class="bg-[#0b1120] px-6 py-1.5 border-b border-slate-800/80 flex items-center gap-2">
                  <i class="pi pi-search text-slate-500 text-[10px]"></i>
                  <input v-model="buscaAgradecimento.termo" @keyup.enter="buscarNoTemplate('agradecimento')" @input="resetarBusca('agradecimento')" placeholder="Localizar na aba atual (Enter)..." class="bg-transparent border-none outline-none text-[10px] text-slate-300 flex-1 placeholder:text-slate-600 focus:ring-0" spellcheck="false" />
                  <div v-if="buscaAgradecimento.matches.length > 0" class="flex items-center gap-2 animate-fadein">
                    <span class="text-[9px] font-black text-emerald-400 tracking-widest">{{ buscaAgradecimento.atual + 1 }} DE {{ buscaAgradecimento.matches.length }}</span>
                    <button @click="buscarNoTemplate('agradecimento')" class="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"><i class="pi pi-angle-down text-[10px]"></i></button>
                  </div>
                </div>

                <div v-show="abaEmailAgradecimento === 'promotor'" class="animate-fadein bg-slate-800/30">
                  <Textarea ref="textareaAgraPromotor" v-model="regrasConfig.email_agradecimento_promotor" rows="12" :placeholder="modeloBaseAgradecimento" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-emerald-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
                </div>

                <div v-show="abaEmailAgradecimento === 'neutro'" class="animate-fadein bg-slate-800/30">
                  <Textarea ref="textareaAgraNeutro" v-model="regrasConfig.email_agradecimento_neutro" rows="12" :placeholder="modeloBaseAgradecimento" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-yellow-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
                </div>

                <div v-show="abaEmailAgradecimento === 'detrator'" class="animate-fadein bg-slate-800/30">
                  <Textarea ref="textareaAgraDetrator" v-model="regrasConfig.email_agradecimento_detrator" rows="12" :placeholder="modeloBaseAgradecimento" class="w-full font-mono text-[11px] leading-relaxed !bg-transparent !text-rose-100 !border-none !p-6 focus:!ring-0 placeholder:text-slate-700 resize-y" spellcheck="false" />
                </div>

              </div>
            </div>

          </div>

        </div>
      </TabPanel>

      <TabPanel v-if="ehSuperAdmin">
        <template #header>
          <div class="flex items-center gap-2 px-2">
            <i class="pi pi-building text-slate-400"></i> <span class="font-bold">Plataforma</span>
          </div>
        </template>
        <div class="space-y-8 animate-fadein py-4">
          <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            <h3 class="text-sm font-black uppercase text-slate-800 dark:text-white mb-1">Nova empresa cliente</h3>
            <p class="text-[11px] text-slate-400 mb-6">Cria uma conta isolada (dados separados) com o primeiro usuário Admin.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome da empresa</label>
                <InputText v-model="novaConta.nome" placeholder="Distribuidora Exemplo" class="custom-input" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Domínios permitidos</label>
                <InputText v-model="novaConta.dominios" placeholder="exemplo.com.br" class="custom-input" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome do Admin</label>
                <InputText v-model="novaConta.admin_nome" class="custom-input" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail do Admin</label>
                <InputText v-model="novaConta.admin_email" placeholder="admin@exemplo.com.br" class="custom-input" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Senha inicial</label>
                <Password v-model="novaConta.admin_senha" toggleMask :feedback="false" inputClass="custom-input w-full" class="w-full" />
              </div>
              <div class="flex items-end">
                <Button label="Criar conta" icon="pi pi-plus" :loading="criandoConta" @click="criarContaPlataforma" class="w-full !bg-orange-500 !border-none !rounded-2xl !text-[10px] !font-black !uppercase !tracking-widest !py-4" />
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 md:p-8 shadow-sm">
            <h3 class="text-sm font-black uppercase text-slate-800 dark:text-white mb-6">Contas na plataforma</h3>
            <DataTable :value="contasPlataforma" class="text-sm" stripedRows>
              <Column field="id" header="#" />
              <Column field="nome" header="Empresa" />
              <Column field="plano" header="Plano" />
              <Column field="usuarios" header="Usuários" />
              <Column field="clientes" header="Clientes" />
              <Column field="respostas" header="Respostas" />
            </DataTable>
          </div>
        </div>
      </TabPanel>
    </TabView>

    <Dialog v-model:visible="usuarioDialog" :header="editandoUser ? 'Editar Utilizador' : 'Novo Utilizador'" :modal="true" class="custom-dialog w-[95vw] sm:w-[80vw] md:w-[60vw] lg:w-[50vw] max-w-2xl">
      <div class="p-2 sm:p-6 space-y-8">
        
        <div class="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50">
          <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <i class="pi pi-id-card"></i> Identificação
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Nome Completo</label>
              <InputText v-model="usuario.nome" class="custom-input !py-3 !text-sm" placeholder="Ex: Marcelo Mendes" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">E-mail Corporativo</label>
              <InputText v-model="usuario.email" class="custom-input !py-3 !text-sm" placeholder="nome@empresa.com" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Cargo / Função</label>
              <InputText v-model="usuario.cargo" class="custom-input !py-3 !text-sm" placeholder="Ex: Product Manager" />
            </div>
          </div>
        </div>

        <div class="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
          <h4 class="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-4 flex items-center gap-2">
            <i class="pi pi-shield"></i> Permissões & Segurança
          </h4>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Nível de Acesso</label>
              <Dropdown v-model="usuario.tipo" :options="opcoesTipo" class="custom-input !p-0 !py-1" />
            </div>
            
            <div class="flex flex-col gap-1.5">
              <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Estado da Conta</label>
              <div class="flex items-center gap-3 bg-white dark:bg-slate-900 h-[48px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <InputSwitch v-model="usuario.ativo" />
                <span class="text-[11px] font-black uppercase tracking-widest" :class="usuario.ativo ? 'text-emerald-500' : 'text-slate-400'">
                  {{ usuario.ativo ? 'Conta Ativa' : 'Bloqueada' }}
                </span>
              </div>
            </div>
          </div>

          <div v-if="editandoUser && !mostrarTrocaSenha" class="pt-2 border-t border-indigo-100 dark:border-indigo-800/30">
            <Button label="Redefinir Palavra-passe" icon="pi pi-key" class="!bg-transparent !text-indigo-600 dark:!text-indigo-400 hover:!bg-indigo-100 dark:hover:!bg-indigo-900/30 !border-none !rounded-lg !text-[10px] !font-black uppercase tracking-widest transition-colors" @click="mostrarTrocaSenha = true" />
          </div>
          
          <div v-if="!editandoUser || mostrarTrocaSenha" class="flex flex-col gap-1.5 animate-fade-in pt-2">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">
              {{ editandoUser ? 'Nova Palavra-passe' : 'Palavra-passe Inicial' }}
            </label>
            <div class="flex gap-2">
              <Password v-model="usuario.password" toggleMask :feedback="false" class="flex-1" inputClass="custom-input !py-3 w-full" placeholder="Mínimo 8 caracteres" />
              <Button icon="pi pi-refresh" @click="gerarSenhaAleatoria" v-tooltip.top="'Gerar Senha Segura'" class="!bg-slate-800 hover:!bg-slate-700 !border-none !rounded-xl !w-[48px] text-white transition-colors shadow-sm" />
            </div>
          </div>
        </div>

      </div>
      <template #footer>
        <div class="flex gap-3 justify-end px-6 pb-6 pt-2">
          <Button label="Cancelar" icon="pi pi-times" class="!bg-transparent !text-slate-500 hover:!bg-slate-100 dark:hover:!bg-slate-800 !border-none !font-black !text-[10px] uppercase tracking-widest" @click="usuarioDialog = false" />
          <Button :label="editandoUser ? 'Atualizar Perfil' : 'Criar Utilizador'" icon="pi pi-check" :loading="submetendoUser" class="!bg-orange-500 hover:!bg-orange-600 !text-white !border-none !rounded-xl !px-6 !py-3 !font-black !uppercase !text-[10px] tracking-widest hover:scale-105 transition-transform shadow-lg shadow-orange-500/20" @click="salvarUtilizador" />
        </div>
      </template>
    </Dialog>

  </div>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";

.animate-fadein { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.custom-scrollbar::-webkit-scrollbar { height: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 4px; }

:deep(.p-tabview), :deep(.p-tabview-nav-container), :deep(.p-tabview-nav-content), :deep(.p-tabview-nav) {
    background: transparent !important; background-color: transparent !important; border: none !important;
}

:deep(.p-tabview-panels) {
    background: transparent !important;
    padding: 0 !important;   
    margin-top: -10px !important; 
}

/* Força o conteúdo interno da aba a esticar também */
:deep(.p-tabview-panel) {
    min-height: 850px !important; 
}

:deep(.p-tabview-nav li .p-tabview-nav-link) {
    @apply bg-slate-100 dark:bg-slate-800 text-slate-500 !important;
    border: none !important; 
    border-radius: 10px !important;
    padding: 0 14px !important;
    transition: all 0.2s ease !important;
    
    height: 38px !important;
    display: flex !important;          
    align-items: center !important;    
    white-space: nowrap !important;    
    font-size: 12px !important;
}

:deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
    @apply bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md !important;
}

:deep(.p-tabview .p-tabview-nav) { border-bottom: none !important; }

:deep(.custom-input) { 
    @apply bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 p-4 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-medium text-slate-800 dark:text-white; 
}

:deep(.custom-dialog .p-dialog-header) { @apply bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6; }
:deep(.custom-dialog .p-dialog-content) { @apply dark:bg-slate-900; }
:deep(.custom-dialog .p-dialog-title) { @apply text-lg font-black italic tracking-tight text-slate-800 dark:text-white; }

:deep(.custom-table), :deep(.custom-table .p-datatable-wrapper) { @apply bg-white dark:bg-slate-900; }
:deep(.custom-table .p-datatable-thead > tr > th) { @apply bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 py-4; }
:deep(.custom-table .p-datatable-tbody > tr) { @apply bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300; }
</style>