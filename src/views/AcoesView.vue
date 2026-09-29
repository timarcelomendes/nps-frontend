<script setup>
import { ref, onMounted, computed } from 'vue';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';
import { useRoute, useRouter } from 'vue-router';
import { temPermissao } from '../utils/permissoes';
import { formatarDataLocal } from '../utils/formatters';

import Menu from 'primevue/menu';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Calendar from 'primevue/calendar';
import MultiSelect from 'primevue/multiselect';
import Sidebar from 'primevue/sidebar';

const toast = useToast();

const acoes = ref([]);
const loading = ref(true);
const ajudaVisivel = ref(false);

const isMaximizado = ref(false);

const toggleMaximizacao = () => {
  isMaximizado.value = !isMaximizado.value;
};

const regrasSLA = ref({ 
  sla_detrator_dias: 2, 
  sla_neutro_dias: 5, 
  sla_promotor_dias: 7 
});
const route = useRoute();
const router = useRouter();

// ==========================================
// 📂 LISTAS DE DOMÍNIO (APOIO)
// ==========================================
const gestoresLista = ref([]);
const empresasDetalhes = ref([]);
const empresasLista = ref([]);
const companhiasLista = ref([]);

const opcoesContexto = ref([
  { label: 'Promotores (9-10)', value: 'promotor' },
  { label: 'Neutros (7-8)', value: 'neutro' },
  { label: 'Detratores (0-6)', value: 'detrator' },
  { label: 'Ações Manuais', value: 'manual' }
]);

// ==========================================
// 🔎 FILTROS INTELIGENTES (MULTISELECT)
// ==========================================
const filtroCompanhia = ref([]);
const filtroResponsavel = ref([]);
const filtroEmpresa = ref([]);
const filtroContexto = ref([]);
const filtroData = ref(null);

const limparFiltros = () => {
  filtroCompanhia.value = [];
  filtroResponsavel.value = [];
  filtroEmpresa.value = [];
  filtroContexto.value = [];
  filtroData.value = null;
};

const getCompanhiaDaAcao = (acao) => {
  if (acao.companhia) return acao.companhia;
  const emp = empresasDetalhes.value.find(e => (e.empresa || e.nome) === acao.empresa_nome);
  return emp ? emp.companhia : null;
};

const acoesFiltradas = computed(() => {
  return acoes.value.filter(acao => {
    
    if (filtroCompanhia.value.length > 0) {
      const companhiaAtual = getCompanhiaDaAcao(acao);
      if (!filtroCompanhia.value.includes(companhiaAtual)) return false;
    }
    
    if (filtroResponsavel.value.length > 0) {
      if (!filtroResponsavel.value.includes(acao.gestor_id)) return false;
    }
    
    if (filtroEmpresa.value.length > 0) {
      if (!filtroEmpresa.value.includes(acao.empresa_nome)) return false;
    }
    
    if (filtroContexto.value.length > 0) {
      const isManual = acao.resposta_nota === null;
      const isPromotor = acao.resposta_nota >= 9;
      const isNeutro = acao.resposta_nota >= 7 && acao.resposta_nota <= 8;
      const isDetrator = acao.resposta_nota !== null && acao.resposta_nota <= 6;

      let passouContexto = false;
      if (filtroContexto.value.includes('manual') && isManual) passouContexto = true;
      if (filtroContexto.value.includes('promotor') && isPromotor) passouContexto = true;
      if (filtroContexto.value.includes('neutro') && isNeutro) passouContexto = true;
      if (filtroContexto.value.includes('detrator') && isDetrator) passouContexto = true;

      if (!passouContexto) return false;
    }

    if (filtroData.value && filtroData.value[0] && filtroData.value[1]) {
      let dataStr = acao.created_at || '';
      if (dataStr && !dataStr.includes('Z')) dataStr = dataStr.replace(' ', 'T') + 'Z';
      
      const dataAcao = new Date(dataStr || new Date());
      dataAcao.setHours(0,0,0,0);
      
      const start = new Date(filtroData.value[0]);
      start.setHours(0,0,0,0);
      const end = new Date(filtroData.value[1]);
      end.setHours(23,59,59,999);
      if (dataAcao < start || dataAcao > end) return false;
    }

    return true;
  });
});

// ==========================================
// 📊 ESTATÍSTICAS E SEPARAÇÃO DE COLUNAS
// ==========================================
const acoesPendentes = computed(() => acoesFiltradas.value.filter(a => a.status === 'Pendente'));
const acoesAndamento = computed(() => acoesFiltradas.value.filter(a => a.status === 'Em Andamento'));
const acoesConcluidas = computed(() => acoesFiltradas.value.filter(a => a.status === 'Concluído'));

const estatisticas = computed(() => ({
  pendentes: acoesPendentes.value.length,
  emAndamento: acoesAndamento.value.length,
  concluidas: acoesConcluidas.value.length
}));

// ==========================================
// 💾 CARREGAMENTO DE DADOS (API)
// ==========================================
const carregarAcoes = async () => {
  try {
    loading.value = true;
    const response = await api.get('/acoes');
    acoes.value = response.data;

    if (route.query.abrir) {
      const acaoAlvo = acoes.value.find(a => String(a.id) === String(route.query.abrir));
      if (acaoAlvo) {
        abrirEdicao(acaoAlvo);
        router.replace({ path: route.path });
      }
    }
  } catch (error) {
    console.error("Erro ao carregar ações:", error);
  } finally {
    loading.value = false;
  }
};

const carregarCompanhias = async () => {
  try {
    const res = await api.get('/dashboard/companhias'); 
    if (res.data && Array.isArray(res.data)) {
      const nomes = res.data.filter(c => c && c !== "Todos os grupos");
      companhiasLista.value = [...new Set(nomes)].sort();
    }
  } catch (error) {}
};

const carregarEmpresas = async () => {
  try {
    const res = await api.get('/cadastros/empresas'); 
    if (res.data) {
      empresasDetalhes.value = res.data;
      const nomes = res.data.map(e => e.empresa || e.nome || e).filter(Boolean);
      empresasLista.value = [...new Set(nomes)].sort();
    }
  } catch (error) {}
};

const carregarRegrasSLA = async () => {
  try {
    const res = await api.get('/config/regras');
    if (res.data) {
      if (res.data.sla_detrator_dias) regrasSLA.value.sla_detrator_dias = parseInt(res.data.sla_detrator_dias);
      if (res.data.sla_neutro_dias)   regrasSLA.value.sla_neutro_dias = parseInt(res.data.sla_neutro_dias);
      if (res.data.sla_promotor_dias) regrasSLA.value.sla_promotor_dias = parseInt(res.data.sla_promotor_dias);
    }
  } catch (error) {
    console.error("Erro ao carregar regras de SLA:", error);
  }
};

const carregarGestores = async () => {
  try {
    const res = await api.get('/cadastros/gestores');
    gestoresLista.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {}
};

// ==========================================
// 🖱️ DRAG & DROP
// ==========================================
const onDragStart = (event, id) => {
  event.dataTransfer.dropEffect = 'move';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('acaoId', id.toString());
};

const onDrop = async (event, novoStatus) => {
  const id = event.dataTransfer.getData('acaoId');
  const acao = acoes.value.find(a => a.id == id);
  if (!acao) return;

  // 🛡️ NOVA TRAVA: Responsável e Resolução são obrigatórios para concluir
  if (novoStatus === 'Concluído') {
    const semGestor = !acao.gestor_id || acao.gestor_id === null;
    const semResolucao = !acao.resolucao || !acao.resolucao.trim();

    if (semGestor || semResolucao) {
      const mensagem = semGestor 
        ? 'Este item precisa de um Responsável atribuído para ser finalizado.' 
        : 'Descreva o que foi feito na Resolução antes de concluir.';

      toast.add({ severity: 'warn', summary: 'Ação Bloqueada', detail: mensagem, life: 5000 });
      
      // Abre o modal para o usuário corrigir o erro na hora
      abrirEdicao(acao);
      return; 
    }
  }

  // Segue com o PUT (usando a URL correta sem duplicar /api)
  try {
    await api.put(`/acoes/${id}`, { ...acao, status: novoStatus });
    toast.add({ severity: 'success', summary: 'Status Atualizado', detail: `Movido para ${novoStatus}`, life: 2000 });
    await carregarAcoes();
  } catch (error) {
    console.error(error);
  }
};

// ==========================================
// 📝 DIALOG (CRIAR/EDITAR) E AUTO-ATRIBUIÇÃO
// ==========================================
const dialogAcao = ref(false);
const salvando = ref(false);
const acaoAtual = ref({});

const abrirNovaAcao = () => {
  acaoAtual.value = { 
    id: null, 
    titulo: '', 
    descricao: '', 
    empresa_nome: '', 
    empresa_id: null, 
    companhia: '', 
    gestor_id: null, 
    prioridade: 'Média', 
    status: 'Pendente',
    contexto: 'promotor'
  };
  dialogAcao.value = true;
};

const abrirEdicao = (acao) => {
  isMaximizado.value = false;

  let contextoCalculado = 'manual';
  if (acao.resposta_nota !== null) {
    const nota = Number(acao.resposta_nota);
    if (nota >= 9) contextoCalculado = 'promotor';
    else if (nota >= 7) contextoCalculado = 'neutro';
    else contextoCalculado = 'detrator';
  }

  acaoAtual.value = { 
    ...acao,
    contexto: contextoCalculado,
    resolucao: acao.resolucao || '' 
  };
  dialogAcao.value = true;
};

const aoMudarEmpresa = () => {
  if (!acaoAtual.value.empresa_nome) return;
  const emp = empresasDetalhes.value.find(e => (e.empresa || e.nome) === acaoAtual.value.empresa_nome);
  
  if (emp) {
    acaoAtual.value.empresa_id = emp.id;
    if (emp.gestor_id) acaoAtual.value.gestor_id = Number(emp.gestor_id);
    if (emp.companhia) acaoAtual.value.companhia = emp.companhia;
  }
};

const salvarAcao = async () => {
  // 🛡️ VALIDAÇÃO DE INTEGRIDADE
  if (acaoAtual.value.status === 'Concluído') {
    if (!acaoAtual.value.gestor_id) {
      toast.add({ severity: 'warn', summary: 'Campo Obrigatório', detail: 'Selecione um responsável para finalizar esta ação.', life: 5000 });
      return;
    }
    if (!acaoAtual.value.resolucao?.trim()) {
      toast.add({ severity: 'warn', summary: 'Falta Resolução', detail: 'Descreva o desfecho do caso antes de salvar.', life: 5000 });
      return;
    }
  }

  salvando.value = true;
  try {
    const payload = {
      ...acaoAtual.value,
      gestor_id: acaoAtual.value.gestor_id ? Number(acaoAtual.value.gestor_id) : null,
      empresa_id: acaoAtual.value.empresa_id ? Number(acaoAtual.value.empresa_id) : null
    };

    const url = acaoAtual.value.id ? `/acoes/${acaoAtual.value.id}` : '/acoes';
    const metodo = acaoAtual.value.id ? 'put' : 'post';

    await api[metodo](url, payload);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Registro atualizado com sucesso!', life: 3000 });
    dialogAcao.value = false;
    await carregarAcoes();
  } catch (error) {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao persistir no banco.', life: 3000 });
  } finally {
    salvando.value = false;
  }
};

const excluirAcao = async (id) => {
  if (!confirm('Excluir esta ação permanentemente?')) return;
  try {
    await api.delete(`/acoes/${id}`);
    acoes.value = acoes.value.filter(a => a.id !== id);
    toast.add({ severity: 'success', summary: 'Excluída', detail: 'Ação removida do quadro.', life: 3000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir.', life: 5000 });
  }
};

// ==========================================
// ⚙️ MENU & HELPERS DE UI
// ==========================================
const menuOpcoes = ref();
const acaoSelecionada = ref(null);

const toggleMenu = (event, acao) => {
  acaoSelecionada.value = acao;
  menuOpcoes.value.toggle(event);
};

const menuItens = computed(() => {
  const itens = [];
  if (temPermissao('acoes:editar')) {
    itens.push({ label: 'Editar Ação', icon: 'pi pi-pencil', command: () => abrirEdicao(acaoSelecionada.value) });
  }
  if (temPermissao('acoes:editar') && temPermissao('acoes:excluir')) {
    itens.push({ separator: true });
  }
  if (temPermissao('acoes:excluir')) {
    itens.push({ label: 'Excluir', icon: 'pi pi-trash', command: () => excluirAcao(acaoSelecionada.value.id) });
  }
  return itens;
});

const getGestor = (id) => gestoresLista.value.find(g => g.id === id);

const getNpsDot = (nota) => {
  if (nota === null || nota === undefined) return 'text-slate-300 dark:text-slate-600';
  if (nota <= 6) return 'text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]';
  if (nota <= 8) return 'text-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]';
  return 'text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
};

const formatarId = (id) => id ? `#${String(id).padStart(3, '0')}` : '#---';

const getPrioDot = (prio) => {
  if (prio === 'Alta') return 'text-rose-500';
  if (prio === 'Média') return 'text-yellow-500';
  return 'text-sky-500';
};

const obterSLA = (acao) => {
  if (acao.status === 'Concluído') return null;
  const nota = acao.resposta_nota;
  let diasSLA = regrasSLA.value.sla_promotor_dias;
  if (nota !== null && nota <= 6) diasSLA = regrasSLA.value.sla_detrator_dias;
  else if (nota !== null && nota <= 8) diasSLA = regrasSLA.value.sla_neutro_dias;

  let dataStr = acao.created_at || '';
  if (dataStr && !dataStr.includes('Z')) dataStr = dataStr.replace(' ', 'T') + 'Z';

  const dataAlvo = new Date(dataStr || new Date());
  dataAlvo.setDate(dataAlvo.getDate() + diasSLA);
  
  const hoje = new Date();
  hoje.setHours(0,0,0,0); dataAlvo.setHours(0,0,0,0);
  
  const diff = Math.ceil((dataAlvo - hoje) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { texto: `Atrasado ${Math.abs(diff)}d`, cor: 'text-rose-600 font-bold bg-rose-50 dark:bg-rose-500/10' };
  if (diff === 0) return { texto: 'Vence Hoje', cor: 'text-orange-600 font-bold bg-orange-50 dark:bg-orange-500/10' };
  return { texto: `${diff} dias`, cor: 'text-slate-500 bg-slate-50 dark:bg-slate-800' };
};

const gerarIniciais = (nome) => nome ? nome.split(' ').map((n, i, a) => i === 0 || i === a.length - 1 ? n[0] : '').join('').toUpperCase() : 'U';

onMounted(async () => {
  await Promise.all([
    carregarRegrasSLA(),
    carregarAcoes(),
    carregarGestores(),
    carregarEmpresas(),
    carregarCompanhias()
  ]);

  if (route.query.empresa && empresasLista.value.includes(route.query.empresa)) {
    filtroEmpresa.value = [route.query.empresa];
    toast.add({ severity: 'info', summary: 'Filtro Aplicado', detail: `Exibindo ações para: ${route.query.empresa}`, life: 4000 });
  }
});
</script>

<template>
  <div class="max-w-[1600px] mx-auto animate-fadein p-4 lg:p-8">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 z-20 relative">
      
      <div>
        <h1 class="text-4xl lg:text-5xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
          Plano de Ação <span class="text-indigo-500">.</span>
        </h1>
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-3">
          Gestão de Respostas e Recuperação de Clientes
        </p>
      </div>

      <div class="flex items-center gap-3">
        
        <Button 
          icon="pi pi-question-circle" 
          @click="ajudaVisivel = true" 
          v-tooltip.top="'Guia da Metodologia'"
          class="w-10 h-10 !bg-slate-50 dark:!bg-slate-800 !text-slate-600 dark:!text-slate-400 !border-none !rounded-lg hover:!bg-slate-100 dark:hover:!bg-slate-700 hover:!text-indigo-500 transition-colors shrink-0" 
        />

        <Button 
          icon="pi pi-refresh" 
          @click="carregarAcoes" 
          :loading="loading" 
          class="w-10 h-10 !bg-slate-50 dark:!bg-slate-800 !text-slate-600 dark:!text-slate-400 !border-none !rounded-lg hover:!bg-slate-100 dark:hover:!bg-slate-700 hover:!text-indigo-500 transition-colors shrink-0" 
          v-tooltip.top="'Atualizar'" 
        />
        
        <div class="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

        <Button 
          v-if="temPermissao('acoes:criar')" 
          label="Nova Ação" 
          icon="pi pi-plus" 
          @click="abrirNovaAcao" 
          class="!bg-orange-500 hover:!bg-orange-600 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 !py-3 shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform shrink-0" 
        />
        
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900 p-3 pl-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-nowrap items-center w-full overflow-x-auto hide-scrollbar relative mb-8 gap-4">
      
      <div class="absolute left-0 top-0 w-1.5 h-full bg-sky-500 rounded-l-[1.5rem]"></div>
      
      <div class="flex flex-col gap-1 shrink-0 w-[180px]">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><i class="pi pi-sitemap text-[8px]"></i> Grupo</span>
        <MultiSelect v-model="filtroCompanhia" :options="companhiasLista" placeholder="Todos os grupos" display="chip" class="custom-dropdown-minimal w-full" />
      </div>

      <div class="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0"></div>

      <div class="flex flex-col gap-1 shrink-0 w-[180px]">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><i class="pi pi-user text-[8px]"></i> Responsável</span>
        <MultiSelect v-model="filtroResponsavel" :options="gestoresLista" optionLabel="nome" optionValue="id" placeholder="Todos os gestores" display="chip" class="custom-dropdown-minimal w-full" />
      </div>

      <div class="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0"></div>

      <div class="flex flex-col gap-1 shrink-0 w-[180px]">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><i class="pi pi-building text-[8px]"></i> Empresa</span>
        <MultiSelect v-model="filtroEmpresa" :options="empresasLista" placeholder="Todas as empresas" display="chip" class="custom-dropdown-minimal w-full" />
      </div>

      <div class="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0"></div>

      <div class="flex flex-col gap-1 shrink-0 w-[180px]">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><i class="pi pi-star text-[8px]"></i> Contexto</span>
        <MultiSelect v-model="filtroContexto" :options="opcoesContexto" optionLabel="label" optionValue="value" placeholder="Todas as notas" display="chip" class="custom-dropdown-minimal w-full" />
      </div>

      <div class="w-px h-8 bg-slate-100 dark:bg-slate-800 shrink-0"></div>

      <div class="flex flex-col gap-1 shrink-0 w-[180px]">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><i class="pi pi-calendar text-[8px]"></i> Data de Criação</span>
        <Calendar v-model="filtroData" selectionMode="range" :manualInput="false" placeholder="Todos os períodos" class="custom-calendar-minimal w-full" />
      </div>

      <div class="shrink-0 ml-auto pr-2">
        <Button @click="limparFiltros" icon="pi pi-filter-slash" class="!bg-slate-50 dark:!bg-slate-800 hover:!bg-rose-50 dark:hover:!bg-rose-500/10 !text-slate-400 hover:!text-rose-500 !border-none transition-all w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer" v-tooltip.top="'Limpar Filtros'" />
      </div>

    </div>  

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
    
    <div class="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem] p-4 min-h-[60vh] border border-slate-100/80 dark:border-slate-800" @dragover="temPermissao('acoes:mover') ? $event.preventDefault() : null" @drop="temPermissao('acoes:mover') ? onDrop($event, 'Pendente') : null">
      <div class="flex justify-between items-center px-2 pt-1 pb-2 border-b border-slate-200/50 dark:border-slate-800">
        <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Pendente <span class="text-slate-400 ml-1">{{ estatisticas.pendentes }}</span></h3>
        <i class="pi pi-inbox text-slate-400 text-xs"></i>
      </div>
      
      <div class="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div v-for="acao in acoesPendentes" :key="acao.id" 
            draggable="true" 
            @dragstart="onDragStart($event, acao.id)" 
            @click="abrirEdicao(acao)"
            class="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 transition-all group">
          
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-2 mt-1">
              <i class="pi pi-circle-fill text-[8px] rounded-full shrink-0" :class="getNpsDot(acao.resposta_nota)" v-tooltip.top="acao.resposta_nota ? `Nota NPS: ${acao.resposta_nota}` : 'Origem Manual'"></i>
              <div class="flex flex-col leading-tight overflow-hidden">
                <span v-if="getCompanhiaDaAcao(acao)" class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate max-w-[140px]">{{ getCompanhiaDaAcao(acao) }}</span>
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[140px]">{{ acao.empresa_nome }}</span>
              </div>
            </div>
            <button v-if="temPermissao('acoes:editar') || temPermissao('acoes:excluir')" @click.stop="toggleMenu($event, acao)" class="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100 shrink-0"><i class="pi pi-ellipsis-h text-sm"></i></button>
          </div>
          
          <div class="mb-2">
            <h4 class="text-sm font-bold text-slate-800 dark:text-white leading-snug">
                <span class="text-orange-500 mr-1 font-black">{{ formatarId(acao.id) }}</span> 
                {{ acao.titulo }}
            </h4>
            <span class="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                <i class="pi pi-clock text-[8px]"></i> {{ formatarDataLocal(acao.created_at) }}
            </span>
          </div>
          <p v-if="acao.descricao || acao.resposta_comentario" class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-4 whitespace-pre-line leading-relaxed border-l-2 border-orange-500/50 pl-2">
              {{ acao.descricao || acao.resposta_comentario }}
          </p>
          
          <div class="flex items-center gap-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 mt-auto">
            <div class="w-6 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600 shadow-sm" v-tooltip.top="getGestor(acao.gestor_id)?.nome || acao.gestor_nome || 'Sem gestor'">
              <img v-if="getGestor(acao.gestor_id)?.avatar || acao.gestor_avatar" :src="getGestor(acao.gestor_id)?.avatar || acao.gestor_avatar" class="w-full h-full object-cover" @error="(e) => e.target.style.display = 'none'" />
              <span v-else class="text-[9px] font-black text-slate-500 dark:text-slate-300">{{ gerarIniciais(getGestor(acao.gestor_id)?.nome || acao.gestor_nome) }}</span>
            </div>
            <div v-if="obterSLA(acao)" class="px-2 py-1 rounded-md text-[9px] uppercase tracking-widest" :class="obterSLA(acao).cor">
              {{ obterSLA(acao).texto }}
            </div>
            <div class="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-slate-500" v-tooltip.top="'Prioridade'">
              <i class="pi pi-circle-fill text-[8px]" :class="getPrioDot(acao.prioridade)"></i> {{ acao.prioridade }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem] p-4 min-h-[60vh] border border-slate-100/80 dark:border-slate-800" @dragover="temPermissao('acoes:mover') ? $event.preventDefault() : null" @drop="temPermissao('acoes:mover') ? onDrop($event, 'Em Andamento') : null">
      <div class="flex justify-between items-center px-2 pt-1 pb-2 border-b border-slate-200/50 dark:border-slate-800">
        <h3 class="text-[11px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-500">Em Andamento <span class="text-slate-400 ml-1">{{ estatisticas.emAndamento }}</span></h3>
        <i class="pi pi-spinner text-sky-500 text-xs animate-spin-slow"></i>
      </div>
      
      <div class="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div v-for="acao in acoesAndamento" :key="acao.id" 
            draggable="true" 
            @dragstart="onDragStart($event, acao.id)" 
            @click="abrirEdicao(acao)"
            class="bg-white dark:bg-slate-800 p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-sky-200 dark:hover:border-sky-800 transition-all group">
          
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-2 mt-1">
              <i class="pi pi-circle-fill text-[8px] rounded-full shrink-0" :class="getNpsDot(acao.resposta_nota)" v-tooltip.top="acao.resposta_nota ? `Nota NPS: ${acao.resposta_nota}` : 'Origem Manual'"></i>
              <div class="flex flex-col leading-tight overflow-hidden">
                <span v-if="getCompanhiaDaAcao(acao)" class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate max-w-[140px]">{{ getCompanhiaDaAcao(acao) }}</span>
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[140px]">{{ acao.empresa_nome }}</span>
              </div>
            </div>
            <button v-if="temPermissao('acoes:editar') || temPermissao('acoes:excluir')" @click.stop="toggleMenu($event, acao)" class="text-slate-400 hover:text-sky-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"><i class="pi pi-ellipsis-h text-sm"></i></button>
          </div>
          
          <div class="mb-2">
            <h4 class="text-sm font-bold text-slate-800 dark:text-white leading-snug">
                <span class="text-orange-500 mr-1 font-black">{{ formatarId(acao.id) }}</span> 
                {{ acao.titulo }}
            </h4>
            <span class="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                <i class="pi pi-clock text-[8px]"></i> {{ formatarDataLocal(acao.created_at) }}
            </span>
          </div>
          <p v-if="acao.descricao || acao.resposta_comentario" class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-4 whitespace-pre-line leading-relaxed border-l-2 border-orange-500/50 pl-2">
              {{ acao.descricao || acao.resposta_comentario }}
          </p>
          
          <div class="flex items-center gap-3 pt-3 border-t border-slate-50 dark:border-slate-700/50 mt-auto">
            <div class="w-6 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600 shadow-sm" v-tooltip.top="getGestor(acao.gestor_id)?.nome || acao.gestor_nome || 'Sem gestor'">
              <img v-if="getGestor(acao.gestor_id)?.avatar || acao.gestor_avatar" :src="getGestor(acao.gestor_id)?.avatar || acao.gestor_avatar" class="w-full h-full object-cover" @error="(e) => e.target.style.display = 'none'" />
              <span v-else class="text-[9px] font-black text-slate-500 dark:text-slate-300">{{ gerarIniciais(getGestor(acao.gestor_id)?.nome || acao.gestor_nome) }}</span>
            </div>
            <div v-if="obterSLA(acao)" class="px-2 py-1 rounded-md text-[9px] uppercase tracking-widest" :class="obterSLA(acao).cor">
              {{ obterSLA(acao).texto }}
            </div>
            <div class="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-slate-500" v-tooltip.top="'Prioridade'">
              <i class="pi pi-circle-fill text-[8px]" :class="getPrioDot(acao.prioridade)"></i> {{ acao.prioridade }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-[2rem] p-4 min-h-[60vh] border border-slate-100/80 dark:border-slate-800 opacity-70 hover:opacity-100 transition-opacity" @dragover="temPermissao('acoes:mover') ? $event.preventDefault() : null" @drop="temPermissao('acoes:mover') ? onDrop($event, 'Concluído') : null">
  
      <div class="flex justify-between items-center px-2 pt-1 pb-2 border-b border-slate-200/50 dark:border-slate-800">
        <h3 class="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">Concluído <span class="text-slate-400 ml-1">{{ estatisticas.concluidas }}</span></h3>
        <i class="pi pi-check-circle text-emerald-500 text-xs"></i>
      </div>
      
      <div class="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div v-for="acao in acoesConcluidas" :key="acao.id" 
            :draggable="temPermissao('acoes:mover')" 
            @dragstart="temPermissao('acoes:mover') ? onDragStart($event, acao.id) : null" 
            @click="abrirEdicao(acao)"
            class="bg-white/60 dark:bg-slate-800/40 p-4 rounded-[1.25rem] border border-slate-200/50 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-all group">
          
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center gap-2 mt-1 opacity-70">
              <i class="pi pi-circle-fill text-[8px] rounded-full shrink-0" :class="getNpsDot(acao.resposta_nota)"></i>
              <div class="flex flex-col leading-tight overflow-hidden">
                <span v-if="getCompanhiaDaAcao(acao)" class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate max-w-[140px]">{{ getCompanhiaDaAcao(acao) }}</span>
                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[140px]">{{ acao.empresa_nome }}</span>
              </div>
            </div>
            <button v-if="temPermissao('acoes:editar') || temPermissao('acoes:excluir')" @click.stop="toggleMenu($event, acao)" class="text-slate-400 hover:text-emerald-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"><i class="pi pi-ellipsis-h text-sm"></i></button>
          </div>
          
          <div class="mb-2">
            <h4 class="text-sm font-bold text-slate-400 dark:text-slate-500 leading-snug line-through decoration-slate-300 dark:decoration-slate-700">
                <span class="text-slate-300 dark:text-slate-600 mr-1 font-black">{{ formatarId(acao.id) }}</span> 
                {{ acao.titulo }}
            </h4>
            <span class="text-[9px] font-bold text-slate-300 flex items-center gap-1 mt-1">
                <i class="pi pi-clock text-[8px]"></i> {{ formatarDataLocal(acao.created_at) }}
            </span>
          </div>

          <p v-if="acao.descricao || acao.resposta_comentario" class="text-[11px] text-slate-400 dark:text-slate-600 line-clamp-4 whitespace-pre-line leading-relaxed border-l-2 border-slate-200 dark:border-slate-800 pl-2 line-through">
              {{ acao.descricao || acao.resposta_comentario }}
          </p>
          
          <div class="flex items-center gap-3 pt-3 mt-auto">
            <div class="w-6 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600 shadow-sm opacity-50" v-tooltip.top="getGestor(acao.gestor_id)?.nome || acao.gestor_nome || 'Sem gestor'">
              <img v-if="getGestor(acao.gestor_id)?.avatar || acao.gestor_avatar" :src="getGestor(acao.gestor_id)?.avatar || acao.gestor_avatar" class="w-full h-full object-cover grayscale" @error="(e) => e.target.style.display = 'none'" />
              <span v-else class="text-[9px] font-black text-slate-400 dark:text-slate-500">{{ gerarIniciais(getGestor(acao.gestor_id)?.nome || acao.gestor_nome) }}</span>
            </div>
            <div class="ml-auto flex items-center gap-1.5 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
              <i class="pi pi-check"></i> Fechado
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

    <Menu ref="menuOpcoes" :model="menuItens" :popup="true" class="!rounded-xl !border-slate-200 dark:!border-slate-700 text-xs w-40" />

    <Dialog 
      v-model:visible="dialogAcao" 
      :modal="true" 
      :style="{ width: isMaximizado ? '98vw' : '550px' }" 
      :closable="false" 
      :class="['custom-dialog-no-header transition-all duration-300', { 'dialog-maximizado': isMaximizado }]"
    >
      <div class="bg-slate-900 p-6 flex justify-between items-center rounded-t-[2rem]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500 shadow-lg shadow-orange-500/10">
            <i :class="acaoAtual.id ? 'pi pi-pencil' : 'pi pi-plus-circle'" class="text-lg"></i>
          </div>
          <div>
            <h2 class="text-lg font-black italic tracking-tight text-white leading-none">
              {{ acaoAtual.id ? 'Editar Plano' : 'Novo Plano de Ação' }}
            </h2>
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de Close-the-Loop</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            type="button"
            @click="toggleMaximizacao" 
            class="text-slate-500 hover:text-white p-2 transition-all hover:bg-white/10 rounded-full"
            v-tooltip.top="isMaximizado ? 'Recolher' : 'Expandir Leitura'"
          >
            <i :class="isMaximizado ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"></i>
          </button>

          <button @click="dialogAcao = false" class="text-slate-500 hover:text-white p-2 transition-all hover:bg-white/10 rounded-full">
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
      
      <div :class="['p-8 space-y-6 bg-white dark:bg-slate-900 rounded-b-[2rem] border-x border-b border-slate-100 dark:border-slate-800 transition-all duration-300', isMaximizado ? 'h-[85vh] overflow-y-auto' : '']">
        
        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Título do Plano de Ação *</label>
          <InputText v-model="acaoAtual.titulo" class="custom-input w-full font-bold" placeholder="Ex: Resolver pendência técnica no checkout" />
        </div>
        
        <div class="grid grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Conta (Empresa) *</label>
            <Dropdown v-model="acaoAtual.empresa_nome" :options="empresasLista" editable filter placeholder="Selecionar..." class="custom-input !p-0" @change="aoMudarEmpresa" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Grupo</label>
            <Dropdown v-model="acaoAtual.companhia" :options="companhiasLista" editable filter placeholder="Opcional" class="custom-input !p-0" />
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Responsável</label>
            <Dropdown v-model="acaoAtual.gestor_id" :options="gestoresLista" optionLabel="nome" optionValue="id" filter placeholder="Atribuir..." class="custom-input !p-0">
              <template #value="slotProps">
                <div v-if="slotProps.value" class="flex items-center gap-2 px-3 py-2.5">
                  <div class="w-6 h-6 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0 border border-slate-300 shadow-sm">
                    <img v-if="getGestor(slotProps.value)?.avatar" :src="getGestor(slotProps.value)?.avatar" class="w-full h-full object-cover" />
                    <span v-else class="text-[9px] font-black text-slate-600">{{ gerarIniciais(getGestor(slotProps.value)?.nome) }}</span>
                  </div>
                  <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{{ getGestor(slotProps.value)?.nome }}</span>
                </div>
                <span v-else class="p-3.5 text-sm text-slate-400 italic">Selecionar responsável</span>
              </template>
            </Dropdown>
          </div>
          
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-orange-500 ml-1 flex items-center gap-1.5">
               <i class="pi pi-stopwatch"></i> Tipo de Prazo
            </label>
            <Dropdown v-model="acaoAtual.contexto" :options="opcoesContexto" optionLabel="label" optionValue="value" class="custom-input !p-0" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-5">
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Prioridade Crítica</label>
            <Dropdown v-model="acaoAtual.prioridade" :options="['Alta', 'Média', 'Baixa']" class="custom-input !p-0" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Fase do Workflow</label>
            <Dropdown v-model="acaoAtual.status" :options="['Pendente', 'Em Andamento', 'Concluído']" class="custom-input !p-0" />
          </div>
        </div>
        
        <div class="flex flex-col gap-1.5 transition-all">
          <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Detalhamento e Notas Internas</label>
          <Textarea 
            v-model="acaoAtual.descricao" 
            :rows="isMaximizado ? 18 : 3" 
            class="custom-input w-full resize-none transition-all duration-300" 
            placeholder="Descreva os próximos passos ou observações..." 
          />
        </div>

        <div class="flex flex-col gap-1.5 transition-all">
          <label class="text-[10px] font-black uppercase tracking-widest text-emerald-500 dark:text-emerald-400 ml-1 flex items-center gap-1.5">
            <i class="pi pi-check-square"></i> Resolução / O que foi feito?
          </label>
          <Textarea 
            v-model="acaoAtual.resolucao" 
            :rows="isMaximizado ? 10 : 3" 
            class="custom-input-success w-full resize-none transition-all duration-300" 
            placeholder="Descreva a solução aplicada e o desfecho com o cliente..." 
          />
        </div>
        
        <div class="pt-6 flex gap-4 w-full border-t border-slate-50 dark:border-slate-800">
          <Button 
            label="Descartar Alterações" 
            text 
            class="flex-1 !text-slate-400 !font-black !uppercase !text-[10px] !tracking-[0.15em]" 
            @click="dialogAcao = false" 
          />
          <Button 
            v-if="temPermissao('acoes:editar') || temPermissao('acoes:criar')" 
            :label="acaoAtual.id ? 'Atualizar Registro' : 'Lançar Nova Ação'" 
            icon="pi pi-check" 
            :loading="salvando" 
            class="flex-1 !bg-orange-500 hover:!bg-orange-600 !text-white !border-none !rounded-xl !px-6 !py-4 !font-black !uppercase !text-[10px] !tracking-[0.15em] shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-100 transition-all" 
            @click="salvarAcao" 
          />
        </div>
      </div>
    </Dialog>
  </div>
  <Sidebar v-model:visible="ajudaVisivel" position="right" class="w-full md:w-[32rem] !bg-slate-50 dark:!bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-0">
      <template #header>
        <div class="flex items-center gap-3 px-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm">
            <i class="pi pi-info-circle text-lg"></i>
          </div>
          <span class="font-black italic text-lg tracking-tight text-slate-800 dark:text-white">Guia: Plano de Ação</span>
        </div>
      </template>

      <div class="p-4 space-y-5 custom-scrollbar pb-10">
        
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
          <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white mb-2 ml-1">Metodologia Retorno ao Cliente</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed ml-1">
            O objetivo desta tela é garantir que <strong>toda resposta</strong> de cliente receba uma tratativa. O ciclo só termina quando o cliente é ouvido e a pendência é movida para "Concluído".
          </p>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h3 class="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white mb-4">Prazos de Atendimento</h3>
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <div class="w-2 h-10 rounded-full bg-rose-500 shrink-0 mt-1"></div>
              <div>
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 block mb-0.5">Detratores (0-6)</span>
                <span class="text-[10px] text-slate-500 leading-tight block">Prioridade Crítica. Requerem resposta em até <strong>{{ regrasSLA.sla_detrator_dias }} dias</strong> para evitar o cancelamento imediato.</span>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-2 h-10 rounded-full bg-yellow-500 shrink-0 mt-1"></div>
              <div>
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 block mb-0.5">Neutros (7-8)</span>
                <span class="text-[10px] text-slate-500 leading-tight block">Prioridade Média. Tratativa em até <strong>{{ regrasSLA.sla_neutro_dias }} dias</strong> para evitar que se tornem detratores.</span>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-2 h-10 rounded-full bg-emerald-500 shrink-0 mt-1"></div>
              <div>
                <span class="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 block mb-0.5">Promotores (9-10)</span>
                <span class="text-[10px] text-slate-500 leading-tight block">Foco em agradecimento e coleta de depoimentos em até <strong>{{ regrasSLA.sla_promotor_dias }} dias</strong>.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-indigo-900/5 dark:bg-indigo-500/5 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
          <h3 class="text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3"><i class="pi pi-directions mr-1"></i> Fluxo de Trabalho</h3>
          <ul class="space-y-3">
            <li class="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-400">
              <i class="pi pi-circle-fill text-[6px] text-indigo-400"></i>
              <span><strong>A Fazer:</strong> Ações criadas automaticamente a cada resposta nova.</span>
            </li>
            <li class="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-400">
              <i class="pi pi-circle-fill text-[6px] text-indigo-400"></i>
              <span><strong>Em Andamento:</strong> Cards que já estão sendo tratados pelo responsável.</span>
            </li>
            <li class="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-400">
              <i class="pi pi-circle-fill text-[6px] text-indigo-400"></i>
              <span><strong>Concluído:</strong> O cliente foi contatado e o ciclo foi fechado.</span>
            </li>
          </ul>
        </div>

        <div class="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20 flex gap-3">
          <i class="pi pi-lightbulb text-amber-500 text-lg"></i>
          <p class="text-[10px] text-amber-700 dark:text-amber-400 font-medium italic">
            "Um cliente detrator cujo problema foi resolvido rapidamente tem mais chances de se tornar um promotor fiel do que um cliente que nunca teve problemas."
          </p>
        </div>

      </div>
    </Sidebar>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";

.animate-fadein { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.animate-spin-slow { animation: spin 3s linear infinite; }

/* ==========================================
   🌟 FILTROS PADRONIZADOS
   ========================================== */
:deep(.custom-input-minimal),
:deep(.custom-dropdown-minimal),
:deep(.custom-calendar-minimal .p-inputtext) {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    color: inherit !important;
    @apply text-[10px] font-black uppercase text-slate-800 dark:text-white w-full outline-none ring-0;
}

:deep(.custom-input-minimal::placeholder),
:deep(.custom-calendar-minimal .p-inputtext::placeholder),
:deep(.custom-dropdown-minimal .p-dropdown-label.p-placeholder),
:deep(.custom-dropdown-minimal .p-multiselect-label.p-placeholder) {
    @apply text-slate-300 dark:text-slate-600 font-black !important;
}

:deep(.p-inputtext:enabled:focus),
:deep(.p-inputtext:enabled:hover),
:deep(.p-dropdown:not(.p-disabled):focus),
:deep(.p-dropdown:not(.p-disabled):hover),
:deep(.p-multiselect:not(.p-disabled):focus),
:deep(.p-multiselect:not(.p-disabled):hover) {
    background-color: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
}

:deep(.custom-dropdown-minimal .p-dropdown-label),
:deep(.custom-dropdown-minimal .p-multiselect-label) {
    @apply p-0 font-black flex items-center text-[10px] uppercase text-slate-800 dark:text-white !important;
}

:deep(.custom-dropdown-minimal .p-dropdown-trigger),
:deep(.custom-dropdown-minimal .p-multiselect-trigger) {
    @apply w-4 text-slate-400 !important;
}

/* O FUNDO AZUL (SKY) DOS MENUS DROP NO MODO ESCURO */
:deep(.p-dropdown-panel), :deep(.p-datepicker), :deep(.p-multiselect-panel) {
    @apply dark:bg-slate-800 dark:border-slate-700 shadow-xl !important;
}
:deep(.p-dropdown-panel .p-dropdown-item), :deep(.p-multiselect-panel .p-multiselect-item) {
    @apply text-xs font-medium text-slate-600 dark:text-slate-300 !important;
}
:deep(.p-dropdown-panel .p-dropdown-item.p-highlight), :deep(.p-multiselect-panel .p-multiselect-item.p-highlight) {
    @apply bg-sky-500/10 text-sky-600 dark:text-sky-400 !important;
}

/* O fundo azul das "Chips" nos filtros dos Planos de Ação de Ações */
:deep(.custom-dropdown-minimal .p-multiselect-token) {
    @apply bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest mr-1 mb-0;
}

/* Ajuste sutil para o MultiSelect (Padding interno dos chips) */
:deep(.custom-dropdown-minimal .p-multiselect-label) {
  @apply py-0 px-0 flex flex-wrap gap-1.5 !important;
}

/* Scroll invisível na barra horizontal */
.hide-scrollbar::-webkit-scrollbar { display: none; }
.hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* ==========================================
   📌 MODAIS, SCROLL E OUTROS COMPONENTES
   ========================================== */
:deep(.custom-dialog-no-header .p-dialog-header) { display: none !important; }
:deep(.custom-dialog-no-header .p-dialog-content) { padding: 0 !important; @apply rounded-3xl bg-transparent; }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { @apply bg-transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { @apply bg-slate-200 dark:bg-slate-700 rounded-full; }

:deep(.p-dropdown .p-dropdown-label), :deep(.p-dropdown .p-inputtext) { @apply p-3.5 text-sm outline-none bg-transparent shadow-none border-none; }
:deep(.p-dropdown) { @apply overflow-hidden; }
:deep(.p-menu) { @apply p-1 !important; }
:deep(.p-menuitem-link) { @apply px-3 py-2 text-sm !important; }

/* Estilo específico para o campo de Resolução */
.custom-input-success {
  @apply bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 
         focus:border-emerald-500 dark:focus:border-emerald-500/50 
         focus:ring-2 focus:ring-emerald-500/10 outline-none
         rounded-xl p-3 text-sm transition-all duration-300;
}

/* Ajuste do Modo Maximizado para comportar dois Textareas grandes */
:deep(.dialog-maximizado .p-dialog-content) {
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* Espaçamento entre os blocos quando em tela cheia */
}
</style>