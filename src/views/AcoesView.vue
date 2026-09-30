<script setup>
/**
 * Planos de Ação: quadro com as tarefas criadas a partir das notas dos clientes.
 * Fluxo: A fazer → (Começar) → Em andamento → (Registrar contato) → Concluído.
 * Links usados pela Visão geral: ?abrir=<id> abre a ação; ?empresa=<nome> filtra.
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Menu from 'primevue/menu';
import MultiSelect from 'primevue/multiselect';
import Calendar from 'primevue/calendar';
import api from '../services/api';
import { temPermissao } from '../utils/permissoes';
import { COLUNAS, statusDe, calcularPrazo, dataCriacao, origem } from '../components/acoes/acoesUtils';
import CartaoAcao from '../components/acoes/CartaoAcao.vue';
import DialogAcao from '../components/acoes/DialogAcao.vue';
import AjudaAcoes from '../components/acoes/AjudaAcoes.vue';
import '../components/acoes/acoes.css';

const toast = useToast();
const route = useRoute();
const router = useRouter();

const pode = {
  criar: temPermissao('acoes:criar'),
  editar: temPermissao('acoes:editar'),
  excluir: temPermissao('acoes:excluir'),
  mover: temPermissao('acoes:mover'),
};

// ---------------------------------------------------------------- dados
const acoes = ref([]);
const carregando = ref(true);
const erroCarga = ref(false);
const regrasSLA = ref({ sla_detrator_dias: 2, sla_neutro_dias: 5, sla_promotor_dias: 7 });
const gestoresLista = ref([]);
const empresasDetalhes = ref([]);
const companhiasLista = ref([]);

const carregarAcoes = async () => {
  carregando.value = true;
  try {
    const { data } = await api.get('/acoes');
    acoes.value = Array.isArray(data) ? data : [];
    erroCarga.value = false;
  } catch (e) {
    erroCarga.value = true;
    toast.add({ severity: 'error', summary: 'Não foi possível carregar as ações', detail: 'Tente atualizar em instantes.', life: 5000 });
  } finally {
    carregando.value = false;
  }
};

const carregarApoio = () => Promise.all([
  api.get('/config/regras').then(({ data }) => {
    for (const k of ['sla_detrator_dias', 'sla_neutro_dias', 'sla_promotor_dias']) {
      if (data?.[k]) regrasSLA.value[k] = parseInt(data[k]);
    }
  }).catch(() => {}),
  api.get('/cadastros/gestores').then(({ data }) => { gestoresLista.value = Array.isArray(data) ? data : []; }).catch(() => {}),
  api.get('/cadastros/empresas').then(({ data }) => { empresasDetalhes.value = Array.isArray(data) ? data : []; }).catch(() => {}),
  api.get('/dashboard/companhias').then(({ data }) => {
    if (Array.isArray(data)) companhiasLista.value = [...new Set(data.filter(c => c && c !== 'Todos os grupos'))].sort();
  }).catch(() => {}),
]);

// Empresas do cadastro + as que aparecem nas ações (para o filtro achar todas)
const empresasLista = computed(() => {
  const nomes = empresasDetalhes.value.map(e => e.empresa || e.nome || e).filter(n => typeof n === 'string' && n);
  const dasAcoes = acoes.value.map(a => a.empresa_nome).filter(Boolean);
  return [...new Set([...nomes, ...dasAcoes, ...filtroEmpresa.value])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
});

const getGestor = (acao) => {
  const g = gestoresLista.value.find(x => x.id === acao.gestor_id);
  if (g) return g;
  if (acao.gestor_id && acao.gestor_nome) return { nome: acao.gestor_nome, avatar: acao.gestor_avatar };
  return null;
};
const getCompanhiaDaAcao = (acao) => {
  if (acao.companhia) return acao.companhia;
  const emp = empresasDetalhes.value.find(e => (e.empresa || e.nome) === acao.empresa_nome);
  return emp ? emp.companhia : null;
};

// ---------------------------------------------------------------- filtros
const filtroCompanhia = ref([]);
const filtroResponsavel = ref([]);
const filtroEmpresa = ref([]);
const filtroNota = ref([]);
const filtroData = ref(null);
const soVencidas = ref(false);
const filtrosAbertos = ref(false); // só no celular

const opcoesNota = [
  { label: 'Detratores (0 a 6)', value: 'detrator' },
  { label: 'Neutros (7 e 8)', value: 'neutro' },
  { label: 'Promotores (9 e 10)', value: 'promotor' },
  { label: 'Sem nota de NPS', value: 'manual' },
];
const opcoesResponsavel = computed(() => [{ id: 0, nome: 'Sem responsável' }, ...gestoresLista.value]);

const qtdFiltros = computed(() => [filtroCompanhia.value.length, filtroResponsavel.value.length, filtroEmpresa.value.length, filtroNota.value.length, filtroData.value?.[0] ? 1 : 0, soVencidas.value ? 1 : 0].filter(Boolean).length);

const limparFiltros = () => {
  filtroCompanhia.value = [];
  filtroResponsavel.value = [];
  filtroEmpresa.value = [];
  filtroNota.value = [];
  filtroData.value = null;
  soVencidas.value = false;
};

const prazoDe = (acao) => calcularPrazo(acao, regrasSLA.value);

const acoesFiltradas = computed(() => acoes.value.filter(acao => {
  if (filtroCompanhia.value.length && !filtroCompanhia.value.includes(getCompanhiaDaAcao(acao))) return false;
  if (filtroResponsavel.value.length && !filtroResponsavel.value.includes(acao.gestor_id || 0)) return false;
  if (filtroEmpresa.value.length && !filtroEmpresa.value.includes(acao.empresa_nome)) return false;
  if (filtroNota.value.length) {
    const tipo = acao.resposta_nota === null || acao.resposta_nota === undefined ? 'manual' : origem(acao).tipo;
    if (!filtroNota.value.includes(tipo)) return false;
  }
  if (filtroData.value?.[0]) {
    const criada = dataCriacao(acao);
    const ini = new Date(filtroData.value[0]); ini.setHours(0, 0, 0, 0);
    const fim = new Date(filtroData.value[1] || filtroData.value[0]); fim.setHours(23, 59, 59, 999);
    if (!criada || criada < ini || criada > fim) return false;
  }
  if (soVencidas.value && prazoDe(acao)?.nivel !== 'vencido') return false;
  return true;
}));

// ---------------------------------------------------------------- colunas
const LIMITE_CONCLUIDAS = 15;
const mostrarTodasConcluidas = ref(false);

const colunas = computed(() => COLUNAS.map(col => {
  let itens = acoesFiltradas.value
    .filter(a => statusDe(a) === col.status)
    .map(a => ({ acao: a, prazo: prazoDe(a) }));
  if (col.status === 'Concluído') itens.sort((x, y) => y.acao.id - x.acao.id);
  else itens.sort((x, y) => (x.prazo?.diff ?? 0) - (y.prazo?.diff ?? 0) || x.acao.id - y.acao.id);
  const total = itens.length;
  const ocultas = col.status === 'Concluído' && !mostrarTodasConcluidas.value ? Math.max(0, total - LIMITE_CONCLUIDAS) : 0;
  if (ocultas) itens = itens.slice(0, LIMITE_CONCLUIDAS);
  const vencidas = itens.filter(i => i.prazo?.nivel === 'vencido').length;
  return { ...col, itens, total, ocultas, vencidas };
}));

const resumo = computed(() => {
  const abertas = acoesFiltradas.value.filter(a => statusDe(a) !== 'Concluído');
  const prazos = abertas.map(prazoDe);
  return {
    abertas: abertas.length,
    vencidas: prazos.filter(p => p?.nivel === 'vencido').length,
    perto: prazos.filter(p => p?.nivel === 'perto').length,
  };
});

const colunaMovel = ref('Pendente'); // coluna exibida no celular

// ---------------------------------------------------------------- mover
const moverPara = async (acao, novoStatus) => {
  if (!pode.mover || statusDe(acao) === novoStatus) return;

  // Para concluir é preciso responsável e o registro do que foi feito
  if (novoStatus === 'Concluído' && (!acao.gestor_id || !acao.resolucao?.trim())) {
    toast.add({
      severity: 'info',
      summary: 'Falta pouco para concluir',
      detail: !acao.gestor_id ? 'Escolha um responsável e registre o que foi feito com o cliente.' : 'Registre o que foi feito com o cliente.',
      life: 5000,
    });
    abrirDialogo(acao, 'concluir');
    return;
  }

  const anterior = acao.status;
  acao.status = novoStatus; // atualiza na hora; volta se der erro
  try {
    await api.put(`/acoes/${acao.id}`, { ...acao, status: novoStatus });
    const titulo = COLUNAS.find(c => c.status === novoStatus)?.titulo;
    toast.add({ severity: 'success', summary: `Movida para "${titulo}"`, life: 2500 });
  } catch (e) {
    acao.status = anterior;
    toast.add({ severity: 'error', summary: 'Não foi possível mover a ação', detail: 'Tente novamente.', life: 5000 });
  }
};

// Arrastar e soltar (computador)
const colunaAlvo = ref(null);
const onDragStart = (event, acao) => {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('acaoId', String(acao.id));
};
const onDragOver = (event, status) => {
  if (!pode.mover) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  colunaAlvo.value = status;
};
const onDrop = (event, status) => {
  colunaAlvo.value = null;
  if (!pode.mover) return;
  const id = event.dataTransfer.getData('acaoId');
  const acao = acoes.value.find(a => String(a.id) === id);
  if (acao) moverPara(acao, status);
};

// Menu "⋮" do cartão (alternativa ao arrastar, útil no celular)
const menuOpcoes = ref();
const acaoSelecionada = ref(null);
const toggleMenu = (event, acao) => {
  acaoSelecionada.value = acao;
  menuOpcoes.value.toggle(event);
};
const menuItens = computed(() => {
  const acao = acaoSelecionada.value;
  if (!acao) return [];
  const itens = [];
  if (pode.mover) {
    itens.push({
      label: 'Mover para',
      items: COLUNAS.filter(c => c.status !== statusDe(acao)).map(c => ({ label: c.titulo, icon: c.icone, command: () => moverPara(acao, c.status) })),
    });
  }
  const outros = [];
  if (pode.editar) outros.push({ label: 'Abrir e editar', icon: 'pi pi-pencil', command: () => abrirDialogo(acao) });
  if (pode.excluir) outros.push({ label: 'Excluir', icon: 'pi pi-trash', command: () => excluirAcao(acao.id) });
  if (outros.length) itens.push({ label: 'Ação', items: outros });
  return itens;
});
const temMenu = pode.mover || pode.editar || pode.excluir;

// ---------------------------------------------------------------- diálogo
const dialogo = ref(false);
const modoDialogo = ref('editar');
const acaoAtual = ref({});
const salvando = ref(false);

const abrirDialogo = (acao, modo = 'editar') => {
  acaoAtual.value = { ...acao };
  modoDialogo.value = modo;
  dialogo.value = true;
};
const abrirNovaAcao = () => abrirDialogo({
  id: null, titulo: '', descricao: '', resolucao: '', empresa_nome: filtroEmpresa.value.length === 1 ? filtroEmpresa.value[0] : '',
  empresa_id: null, gestor_id: null, prioridade: 'Média', status: 'Pendente', resposta_nota: null,
});

const salvarAcao = async (payload) => {
  salvando.value = true;
  try {
    if (payload.id) await api.put(`/acoes/${payload.id}`, payload);
    else await api.post('/acoes', payload);
    toast.add({ severity: 'success', summary: payload.id ? (payload.status === 'Concluído' ? 'Ação salva e concluída' : 'Ação salva') : 'Ação criada', life: 3000 });
    dialogo.value = false;
    await carregarAcoes();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Não foi possível salvar', detail: 'Verifique os dados e tente novamente.', life: 5000 });
  } finally {
    salvando.value = false;
  }
};

const excluirAcao = async (id) => {
  if (!confirm('Excluir esta ação? Isso não pode ser desfeito.')) return;
  try {
    await api.delete(`/acoes/${id}`);
    acoes.value = acoes.value.filter(a => a.id !== id);
    dialogo.value = false;
    toast.add({ severity: 'success', summary: 'Ação excluída', life: 3000 });
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Não foi possível excluir', life: 5000 });
  }
};

const ajudaVisivel = ref(false);

// ---------------------------------------------------------------- links (?abrir, ?empresa)
const aplicarLink = () => {
  const { abrir, empresa } = route.query;
  if (empresa) filtroEmpresa.value = [String(empresa)];
  if (abrir) {
    const alvo = acoes.value.find(a => String(a.id) === String(abrir));
    if (alvo) {
      colunaMovel.value = statusDe(alvo);
      abrirDialogo(alvo);
    } else {
      toast.add({ severity: 'warn', summary: 'Ação não encontrada', detail: 'Ela pode ter sido excluída.', life: 4000 });
    }
    const { abrir: _, ...resto } = route.query;
    router.replace({ path: route.path, query: resto });
  }
};
watch(() => [route.query.abrir, route.query.empresa], (novo, antigo) => {
  if (!carregando.value && (novo[0] !== antigo[0] || novo[1] !== antigo[1]) && (novo[0] || novo[1])) aplicarLink();
});

onMounted(async () => {
  await Promise.all([carregarAcoes(), carregarApoio()]);
  aplicarLink();
});
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-5 pb-24">
    <!-- Cabeçalho -->
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Planos de ação<span class="text-orange-500">.</span></h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Cada nota baixa vira uma tarefa: fale com o cliente, registre o que foi feito e conclua.</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="ajudaVisivel = true" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300" title="Como usar" aria-label="Como usar"><i class="pi pi-question-circle text-sm"></i></button>
        <button @click="carregarAcoes" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300" title="Atualizar" aria-label="Atualizar"><i :class="['pi pi-refresh text-sm', carregando ? 'pi-spin' : '']"></i></button>
        <button v-if="pode.criar" @click="abrirNovaAcao" class="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold"><i class="pi pi-plus text-xs mr-1"></i>Nova ação</button>
      </div>
    </header>

    <!-- Resumo -->
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-semibold">
        {{ resumo.abertas }} {{ resumo.abertas === 1 ? 'ação aberta' : 'ações abertas' }}
      </span>
      <button v-if="resumo.vencidas || soVencidas" @click="soVencidas = !soVencidas" :aria-pressed="soVencidas"
        :class="['px-3 py-1.5 rounded-lg font-semibold border', soVencidas ? 'bg-rose-600 border-rose-600 text-white' : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400']"
        :title="soVencidas ? 'Mostrar todas' : 'Mostrar só as vencidas'">
        <i class="pi pi-exclamation-circle text-xs mr-1"></i>{{ resumo.vencidas }} {{ resumo.vencidas === 1 ? 'vencida' : 'vencidas' }}
        <span v-if="soVencidas" class="font-normal"> · mostrando só estas <i class="pi pi-times text-xs ml-0.5"></i></span>
      </button>
      <span v-if="resumo.perto" class="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-semibold">
        <i class="pi pi-clock text-xs mr-1"></i>{{ resumo.perto }} {{ resumo.perto === 1 ? 'vence' : 'vencem' }} hoje ou amanhã
      </span>
      <span v-if="!carregando && !resumo.abertas && !qtdFiltros" class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-semibold">
        <i class="pi pi-check text-xs mr-1"></i>Tudo em dia
      </span>
    </div>

    <!-- Filtros -->
    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2 md:hidden">
        <button @click="filtrosAbertos = !filtrosAbertos" :aria-expanded="filtrosAbertos"
          class="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <i class="pi pi-filter text-xs mr-1"></i>Filtros<span v-if="qtdFiltros" class="ml-1 px-1.5 rounded-md bg-orange-500 text-white text-xs">{{ qtdFiltros }}</span>
          <i :class="['pi text-xs ml-2', filtrosAbertos ? 'pi-chevron-up' : 'pi-chevron-down']"></i>
        </button>
        <button v-if="qtdFiltros" @click="limparFiltros" class="h-10 px-3 text-sm font-semibold text-orange-600">Limpar</button>
      </div>
      <div :class="['flex-wrap items-center gap-2', filtrosAbertos ? 'flex' : 'hidden md:flex']">
        <div class="flex items-center gap-2 h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-full md:w-56" :class="filtroEmpresa.length ? 'border-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700'">
          <i class="pi pi-building text-slate-400 text-sm"></i>
          <MultiSelect v-model="filtroEmpresa" :options="empresasLista" filter placeholder="Todas as empresas" :maxSelectedLabels="1" selectedItemsLabel="{0} empresas" panelClass="acoes-painel" class="acoes-filtro flex-1 min-w-0" aria-label="Empresa" />
        </div>
        <div class="flex items-center gap-2 h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-full md:w-56" :class="filtroResponsavel.length ? 'border-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700'">
          <i class="pi pi-user text-slate-400 text-sm"></i>
          <MultiSelect v-model="filtroResponsavel" :options="opcoesResponsavel" optionLabel="nome" optionValue="id" placeholder="Todos os responsáveis" :maxSelectedLabels="1" selectedItemsLabel="{0} responsáveis" panelClass="acoes-painel" class="acoes-filtro flex-1 min-w-0" aria-label="Responsável" />
        </div>
        <div v-if="companhiasLista.length" class="flex items-center gap-2 h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-full md:w-56" :class="filtroCompanhia.length ? 'border-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700'">
          <i class="pi pi-sitemap text-slate-400 text-sm"></i>
          <MultiSelect v-model="filtroCompanhia" :options="companhiasLista" placeholder="Todos os grupos" :maxSelectedLabels="1" selectedItemsLabel="{0} grupos" panelClass="acoes-painel" class="acoes-filtro flex-1 min-w-0" aria-label="Grupo" />
        </div>
        <div class="flex items-center gap-2 h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-full md:w-56" :class="filtroNota.length ? 'border-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700'">
          <i class="pi pi-star text-slate-400 text-sm"></i>
          <MultiSelect v-model="filtroNota" :options="opcoesNota" optionLabel="label" optionValue="value" placeholder="Todas as notas" :maxSelectedLabels="1" selectedItemsLabel="{0} tipos de nota" panelClass="acoes-painel" class="acoes-filtro flex-1 min-w-0" aria-label="Nota do cliente" />
        </div>
        <div class="flex items-center gap-2 h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 w-full md:w-56" :class="filtroData?.[0] ? 'border-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700'">
          <i class="pi pi-calendar text-slate-400 text-sm"></i>
          <Calendar v-model="filtroData" selectionMode="range" :manualInput="false" dateFormat="dd/mm/yy" placeholder="Criadas em qualquer data" class="acoes-filtro flex-1 min-w-0" aria-label="Data de criação" />
          <button v-if="filtroData" type="button" @click.prevent="filtroData = null" class="text-slate-400 hover:text-slate-600" title="Qualquer data"><i class="pi pi-times text-xs"></i></button>
        </div>
        <button v-if="qtdFiltros" @click="limparFiltros" class="hidden md:inline-flex items-center h-10 px-3 rounded-xl text-sm font-semibold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10">
          <i class="pi pi-filter-slash text-xs mr-1"></i>Limpar filtros
        </button>
      </div>
    </section>

    <!-- Abas das colunas (celular) -->
    <div class="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 md:hidden" role="tablist" aria-label="Colunas do quadro">
      <button v-for="col in colunas" :key="col.status" role="tab" :aria-selected="colunaMovel === col.status" @click="colunaMovel = col.status"
        :class="['min-h-10 py-1 px-1 rounded-lg text-sm font-semibold leading-tight flex flex-col items-center justify-center gap-0.5',
          colunaMovel === col.status ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400']">
        {{ col.titulo }}
        <span :class="['text-xs px-1.5 rounded-md', col.vencidas ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200']">{{ col.total }}</span>
      </button>
    </div>

    <!-- Quadro -->
    <div v-if="erroCarga && !acoes.length" class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
      <p class="font-semibold text-slate-800 dark:text-slate-100">Não foi possível carregar as ações.</p>
      <button @click="carregarAcoes" class="mt-3 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Tentar de novo</button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
      <section v-for="col in colunas" :key="col.status"
        :class="['flex-col gap-3 rounded-2xl p-3 border transition-colors min-h-[12rem] md:min-h-[60vh]', colunaMovel === col.status ? 'flex' : 'hidden md:flex',
          colunaAlvo === col.status ? 'border-orange-400 border-dashed bg-orange-50/60 dark:bg-orange-500/5' : 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40']"
        :aria-label="col.titulo"
        @dragover="onDragOver($event, col.status)"
        @dragleave.self="colunaAlvo = null"
        @drop="onDrop($event, col.status)">
        <header class="hidden md:flex items-center justify-between gap-2 px-1">
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <i :class="[col.icone, 'text-sm', col.status === 'Concluído' ? 'text-emerald-500' : 'text-slate-400']"></i>{{ col.titulo }}
            <span class="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{{ col.total }}</span>
          </h2>
          <span v-if="col.vencidas" class="text-xs font-semibold text-rose-600 dark:text-rose-400"><i class="pi pi-exclamation-circle text-xs mr-0.5"></i>{{ col.vencidas }} {{ col.vencidas === 1 ? 'vencida' : 'vencidas' }}</span>
        </header>

        <template v-if="carregando && !acoes.length">
          <div v-for="n in 2" :key="n" class="h-36 rounded-xl bg-white dark:bg-slate-800 animate-pulse"></div>
        </template>

        <template v-else>
          <CartaoAcao v-for="item in col.itens" :key="item.acao.id"
            :acao="item.acao" :prazo="item.prazo" :gestor="getGestor(item.acao)" :grupo="getCompanhiaDaAcao(item.acao) || ''"
            :pode-mover="pode.mover" :pode-editar="pode.editar" :tem-menu="temMenu"
            :draggable="pode.mover"
            @dragstart="onDragStart($event, item.acao)"
            @dragend="colunaAlvo = null"
            @abrir="abrirDialogo(item.acao)"
            @comecar="moverPara(item.acao, 'Em Andamento')"
            @registrar="abrirDialogo(item.acao, 'concluir')"
            @menu="toggleMenu($event, item.acao)" />

          <div v-if="!col.itens.length" class="flex-1 flex flex-col items-center justify-center text-center gap-2 px-4 py-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <i :class="[col.icone, 'text-xl text-slate-300 dark:text-slate-600']"></i>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ qtdFiltros ? 'Nenhuma ação com esses filtros.' : col.vazio }}</p>
            <button v-if="qtdFiltros" @click="limparFiltros" class="text-sm font-semibold text-orange-600 hover:underline">Limpar filtros</button>
          </div>

          <button v-if="col.ocultas" @click="mostrarTodasConcluidas = true" class="h-10 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">
            Mostrar mais {{ col.ocultas }} {{ col.ocultas === 1 ? 'concluída' : 'concluídas' }}
          </button>
        </template>
      </section>
    </div>

    <Menu ref="menuOpcoes" :model="menuItens" popup class="acoes-menu" />

    <DialogAcao v-model:visible="dialogo" :acao="acaoAtual" :modo="modoDialogo"
      :empresas="empresasLista" :empresas-detalhes="empresasDetalhes" :gestores="gestoresLista" :regras="regrasSLA"
      :salvando="salvando" :pode-salvar="acaoAtual.id ? pode.editar : pode.criar" :pode-excluir="pode.excluir"
      @salvar="salvarAcao" @excluir="excluirAcao" />

    <AjudaAcoes v-model:visible="ajudaVisivel" :regras="regrasSLA" />
  </div>
</template>
