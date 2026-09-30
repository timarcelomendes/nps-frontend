<script setup>
/**
 * Respostas: tudo o que os clientes responderam.
 * Tarefa principal: ler os comentários e agir sobre quem está insatisfeito
 * (analisar a resposta, criar um plano de ação ou arquivar).
 */
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Calendar from 'primevue/calendar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import api from '../services/api';
import { formatarDataLocal, dataISO } from '../utils/formatters';
import { corNotaSolida, corClassificacao } from '../components/respostas/nota';
import ResumoRespostas from '../components/respostas/ResumoRespostas.vue';
import DialogAnalise from '../components/respostas/DialogAnalise.vue';
import DialogNovaAcao from '../components/respostas/DialogNovaAcao.vue';
import DialogNovaResposta from '../components/respostas/DialogNovaResposta.vue';
import '../components/respostas/respostas.css';

const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// ---------------------------------------------------------------- filtros
const CHAVE_ARQUIVADAS = 'nps_ver_arquivados';
const lerPreferenciaArquivadas = () => {
  try { return localStorage.getItem(CHAVE_ARQUIVADAS) === 'true'; } catch (e) { return false; }
};

const filtrosPadrao = () => ({ q: '', companhia: 'Todas', empresa: 'Todas', categoria: 'Todas', perfil: 'Todos' });
const filtros = ref({ ...filtrosPadrao(), incluir_excluidas: lerPreferenciaArquivadas(), tipo_data: 'data_resposta' });
const periodo = ref(null);

const opcoesTipoData = [
  { label: 'Data em que o cliente respondeu', value: 'data_resposta' },
  { label: 'Data em que entrou no sistema', value: 'created_at' },
];
const opcoesCategoria = [
  { label: 'Todas', value: 'Todas' },
  { label: 'Promotores (9 e 10)', value: 'Promotor' },
  { label: 'Neutros (7 e 8)', value: 'Neutro' },
  { label: 'Detratores (0 a 6)', value: 'Detrator' },
];
const opcoesPerfil = ['Todos', 'Decisor', 'Influenciador', 'Outro'];

const empresasData = ref([]);
const opcoesCompanhia = ref(['Todas']);
const opcoesEmpresa = computed(() => {
  const g = filtros.value.companhia;
  const lista = g && g !== 'Todas' ? empresasData.value.filter(e => e.companhia === g) : empresasData.value;
  return ['Todas', ...lista.map(e => e.nome).sort()];
});

const periodoCompleto = computed(() => !!(periodo.value?.[0] && periodo.value?.[1]));
const filtrosAtivos = computed(() => {
  const f = filtros.value;
  return !!(f.q || f.companhia !== 'Todas' || f.empresa !== 'Todas' || f.categoria !== 'Todas' || f.perfil !== 'Todos' || periodoCompleto.value);
});
// No celular os filtros ficam recolhidos atrás do botão "Filtros"
const mostrarFiltros = ref(false);
const classeExtra = computed(() => (mostrarFiltros.value ? 'flex' : 'hidden md:flex'));
const limparFiltros = () => {
  Object.assign(filtros.value, filtrosPadrao());
  periodo.value = null;
};

const carregarCombos = async () => {
  try {
    const [resEmp, resComp] = await Promise.all([api.get('/cadastros/empresas'), api.get('/cadastros/companhias')]);
    if (resEmp.data) empresasData.value = resEmp.data;
    if (resComp.data) {
      const nomes = typeof resComp.data[0] === 'string'
        ? resComp.data.filter(c => c !== 'Todos os grupos' && c !== 'Todas')
        : resComp.data.map(c => c.nome);
      opcoesCompanhia.value = ['Todas', ...nomes.sort()];
    }
  } catch (error) {
    toast.add({ severity: 'warn', summary: 'Filtros incompletos', detail: 'Não foi possível carregar grupos e empresas.', life: 3000 });
  }
};

// ---------------------------------------------------------------- respostas
const respostas = ref([]);
const loading = ref(true);
let versao = 0; // descarta respostas antigas se o filtro mudar no meio do carregamento

const carregarRespostas = async () => {
  const minha = ++versao;
  loading.value = true;
  const f = filtros.value;
  const params = {
    q: f.q,
    companhia: f.companhia === 'Todas' ? '' : f.companhia,
    empresa: f.empresa === 'Todas' ? '' : f.empresa,
    categoria: f.categoria === 'Todas' ? '' : f.categoria,
    perfil: f.perfil === 'Todos' ? '' : f.perfil,
    incluir_excluidas: f.incluir_excluidas,
    tipo_data: f.tipo_data,
  };
  if (periodoCompleto.value) {
    params.data_inicio = dataISO(periodo.value[0]);
    params.data_fim = dataISO(periodo.value[1]);
  }
  try {
    const response = await api.get('/respostas', { params });
    if (minha !== versao) return;
    respostas.value = response.data.map(item => ({
      ...item,
      excluido: [true, 'True', 'true', 1, '1'].includes(item.excluido),
    }));
  } catch (error) {
    if (minha === versao) toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as respostas.', life: 3000 });
  } finally {
    if (minha === versao) loading.value = false;
  }
};

// Um único ponto que recarrega a lista quando qualquer filtro muda (com pequena espera para a digitação).
let espera = null;
watch(() => filtros.value.companhia, () => { filtros.value.empresa = 'Todas'; });
watch([filtros, periodo], () => {
  try { localStorage.setItem(CHAVE_ARQUIVADAS, filtros.value.incluir_excluidas); } catch (e) { /* sem armazenamento */ }
  if (periodo.value?.[0] && !periodo.value?.[1]) return; // ainda escolhendo a data final
  clearTimeout(espera);
  espera = setTimeout(carregarRespostas, 400);
}, { deep: true });

const metricas = computed(() => {
  let promotores = 0, neutros = 0, detratores = 0;
  respostas.value.forEach(r => {
    if (r.nota >= 9) promotores++;
    else if (r.nota >= 7) neutros++;
    else detratores++;
  });
  const total = respostas.value.length;
  const nps = total ? Math.round(((promotores - detratores) / total) * 100) : 0;
  return { nps, promotores, neutros, detratores, total };
});

// ---------------------------------------------------------------- ações por resposta
const respostaAtual = ref(null);
const dialogAnalise = ref(false);
const dialogAcao = ref(false);
const dialogNovaResposta = ref(false);

const paraFormulario = (dados) => ({
  ...dados,
  id: dados.resposta_id,
  empresa: dados.nome || dados.empresa,
  empresa_id: dados.empresa_id ? Number(dados.empresa_id) : null,
  gestor_id: dados.gestor_id ? Number(dados.gestor_id) : null,
});

const abrirAnalise = (dados) => {
  respostaAtual.value = paraFormulario(dados);
  dialogAnalise.value = true;
};
const abrirNovaAcao = (dados) => {
  // vindo da janela de análise já chega no formato do formulário (com as edições em andamento)
  respostaAtual.value = dados.id ? { ...dados } : paraFormulario(dados);
  dialogAcao.value = true;
};
const irParaAcao = (acaoId) => {
  if (acaoId) router.push({ path: '/acoes', query: { abrir: acaoId } });
};

const alternarArquivo = async (dados) => {
  const estavaArquivada = dados.excluido;
  dados.excluido = !estavaArquivada;
  try {
    if (!estavaArquivada) {
      await api.post(`/respostas/${dados.resposta_id}/soft-delete`);
      toast.add({ severity: 'info', summary: 'Resposta arquivada', detail: 'Ela não conta mais nos indicadores.', life: 3000 });
    } else {
      await api.post(`/respostas/${dados.resposta_id}/restore`);
      toast.add({ severity: 'success', summary: 'Resposta restaurada', detail: 'Ela voltou a contar nos indicadores.', life: 3000 });
    }
    if (!filtros.value.incluir_excluidas && !estavaArquivada) {
      respostas.value = respostas.value.filter(r => r.resposta_id !== dados.resposta_id);
    }
  } catch (error) {
    dados.excluido = estavaArquivada;
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível falar com o servidor.', life: 3000 });
  }
};

const isAdmin = (sessionStorage.getItem('usuario_tipo') || '').toLowerCase() === 'admin';

const excluirDefinitivo = (dados) => {
  confirm.require({
    header: 'Excluir resposta para sempre?',
    message: `A resposta de ${dados.cliente_nome || dados.empresa || 'este cliente'} e os planos de ação ligados a ela serão apagados. Não dá para desfazer. Se quiser só tirar dos indicadores, use Arquivar.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await api.delete(`/respostas/${dados.resposta_id}`);
        toast.add({ severity: 'success', summary: 'Resposta excluída', detail: 'A resposta e as ações ligadas a ela foram apagadas.', life: 4000 });
        carregarRespostas();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Não foi possível excluir', detail: error.response?.data?.detail || 'Apenas administradores podem excluir.', life: 4000 });
      }
    },
  });
};

// ---------------------------------------------------------------- formatação
const tratarData = (valor) => {
  if (!valor || valor === 'NaT' || valor === 'None') return null;
  const texto = String(valor).trim();
  if (texto.length === 10) {
    const [ano, mes, dia] = texto.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return isNaN(new Date(texto).getTime()) ? null : formatarDataLocal(texto);
};
const temNotaAnterior = (r) => r.nota_anterior !== null && r.nota_anterior !== undefined && r.nota_anterior !== '';
const iconeCanal = (canal) => ({ Manual: 'pi-user-edit', WhatsApp: 'pi-whatsapp', Telefone: 'pi-phone', 'Reunião': 'pi-users' }[canal] || 'pi-envelope');

onMounted(() => {
  carregarCombos();
  carregarRespostas();
});
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-6 pb-24">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Respostas<span class="text-orange-500">.</span></h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">O que cada cliente respondeu. Leia os comentários e crie ações para quem ficou insatisfeito.</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="carregarRespostas" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300" title="Atualizar">
          <i :class="['pi pi-refresh text-sm', loading ? 'pi-spin' : '']"></i>
        </button>
        <button @click="dialogNovaResposta = true" class="h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">
          <i class="pi pi-plus text-xs mr-1"></i>Registrar resposta
        </button>
      </div>
    </header>

    <!-- Filtros -->
    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-5 flex flex-col gap-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label class="flex flex-col gap-1.5 sm:col-span-2">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Buscar</span>
          <span class="flex gap-2">
            <span class="relative flex-1 min-w-0">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
              <InputText v-model="filtros.q" placeholder="Nome do cliente, empresa ou comentário" class="resp-campo !pl-9" />
            </span>
            <button type="button" @click.prevent="mostrarFiltros = !mostrarFiltros" :aria-expanded="mostrarFiltros"
              class="md:hidden shrink-0 h-10 px-3 rounded-xl border text-sm font-semibold"
              :class="mostrarFiltros || filtrosAtivos ? 'border-orange-300 text-orange-600 dark:border-orange-500/40 dark:text-orange-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'">
              <i class="pi pi-sliders-h text-xs mr-1"></i>Filtros
            </button>
          </span>
        </label>
        <div class="flex-col gap-1.5" :class="classeExtra">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
            Período
            <button v-if="periodo" @click="periodo = null" class="text-xs font-semibold text-slate-500 hover:text-orange-600">Limpar</button>
          </span>
          <Calendar v-model="periodo" selectionMode="range" :manualInput="false" dateFormat="dd/mm/yy" placeholder="Todo o período"
            class="resp-campo" panel-class="resp-painel" />
        </div>
        <label class="flex-col gap-1.5" :class="classeExtra">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Considerar a data</span>
          <Dropdown v-model="filtros.tipo_data" :options="opcoesTipoData" optionLabel="label" optionValue="value" class="resp-campo" panel-class="resp-painel" />
        </label>

        <label class="flex-col gap-1.5" :class="classeExtra">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Grupo</span>
          <Dropdown v-model="filtros.companhia" :options="opcoesCompanhia" class="resp-campo" panel-class="resp-painel" />
        </label>
        <label class="flex-col gap-1.5" :class="classeExtra">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Empresa</span>
          <Dropdown v-model="filtros.empresa" :options="opcoesEmpresa" filter emptyFilterMessage="Nenhuma empresa encontrada" class="resp-campo" panel-class="resp-painel" />
        </label>
        <label class="flex-col gap-1.5" :class="classeExtra">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Classificação</span>
          <Dropdown v-model="filtros.categoria" :options="opcoesCategoria" optionLabel="label" optionValue="value" class="resp-campo" panel-class="resp-painel" />
        </label>
        <label class="flex-col gap-1.5" :class="classeExtra">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Perfil de quem respondeu</span>
          <Dropdown v-model="filtros.perfil" :options="opcoesPerfil" class="resp-campo" panel-class="resp-painel" />
        </label>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <label class="flex items-center gap-2 cursor-pointer select-none" v-tooltip.bottom="'Respostas arquivadas não contam nos indicadores'">
          <InputSwitch v-model="filtros.incluir_excluidas" class="resp-switch scale-75" />
          <span class="text-sm text-slate-600 dark:text-slate-300">Mostrar arquivadas</span>
        </label>
        <button v-if="filtrosAtivos" @click="limparFiltros" class="text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline">
          <i class="pi pi-filter-slash text-xs mr-1"></i>Limpar filtros
        </button>
      </div>
    </section>

    <!-- Resumo -->
    <div v-if="loading && !respostas.length" class="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    <ResumoRespostas v-else-if="metricas.total" :metricas="metricas" :class="{ 'opacity-60': loading }" />

    <!-- Lista -->
    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div v-if="loading && !respostas.length" class="divide-y divide-slate-100 dark:divide-slate-800">
        <div v-for="i in 5" :key="i" class="flex gap-4 p-5">
          <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 w-1/4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
            <div class="h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!respostas.length" class="px-5 py-16 flex flex-col items-center text-center gap-2">
        <span class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center"><i class="pi pi-inbox text-xl"></i></span>
        <p class="font-semibold text-slate-800 dark:text-slate-100">{{ filtrosAtivos ? 'Nenhuma resposta com esses filtros' : 'Ainda sem respostas neste período' }}</p>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          {{ filtrosAtivos ? 'Tente outro período ou tire alguns filtros.' : 'Quando os clientes responderem à pesquisa, as respostas aparecem aqui.' }}
        </p>
        <button v-if="filtrosAtivos" @click="limparFiltros" class="mt-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-orange-300 hover:text-orange-600">Limpar filtros</button>
        <button v-else @click="dialogNovaResposta = true" class="mt-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Registrar uma resposta</button>
      </div>

      <DataTable v-else :value="respostas" paginator :rows="10" dataKey="resposta_id" rowHover
        responsiveLayout="stack" breakpoint="767px" class="tabela-respostas" :class="{ 'opacity-60': loading }"
        paginatorTemplate="PrevPageLink PageLinks NextPageLink CurrentPageReport" currentPageReportTemplate="{first} a {last} de {totalRecords}">
        <Column field="nota" header="Nota" style="width: 7.5rem">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <span :class="['w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0', corNotaSolida(data.nota)]">{{ data.nota }}</span>
              <span v-if="temNotaAnterior(data)" class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 whitespace-nowrap" v-tooltip.top="'Nota da resposta anterior deste cliente'">
                <i v-if="Number(data.nota) > Number(data.nota_anterior)" class="pi pi-arrow-up text-emerald-500 text-xs"></i>
                <i v-else-if="Number(data.nota) < Number(data.nota_anterior)" class="pi pi-arrow-down text-rose-500 text-xs"></i>
                <i v-else class="pi pi-minus text-slate-400 text-xs"></i>
                antes {{ data.nota_anterior }}
              </span>
              <span v-else class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">1ª resposta</span>
            </div>
          </template>
        </Column>

        <Column field="cliente_nome" header="Cliente" style="min-width: 12rem">
          <template #body="{ data }">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5" :class="{ 'line-through text-slate-400 dark:text-slate-500': data.excluido }">
                {{ data.cliente_nome || 'Cliente sem nome' }}
                <i v-if="data.perfil_cliente === 'Decisor'" class="pi pi-star-fill text-amber-500 text-xs" v-tooltip.top="'Decisor: quem decide a compra'"></i>
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ data.empresa || 'Sem empresa' }}</p>
              <p v-if="data.perfil_cliente" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5"><i class="pi pi-user text-xs mr-1"></i>{{ data.perfil_cliente }}</p>
            </div>
          </template>
        </Column>

        <Column field="motivo" header="Comentário" style="min-width: 18rem">
          <template #body="{ data }">
            <div class="flex flex-col gap-2">
              <p v-if="data.motivo" class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line" :class="{ 'opacity-60 line-through': data.excluido }">"{{ data.motivo }}"</p>
              <p v-else class="text-sm text-slate-400 dark:text-slate-500">Sem comentário</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-if="data.categoria" :class="['text-xs font-semibold px-2 py-0.5 rounded-md', corClassificacao(data.categoria)]">{{ data.categoria }}</span>
                <span v-if="data.excluido" class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><i class="pi pi-folder text-xs mr-1"></i>Arquivada</span>
              </div>
            </div>
          </template>
        </Column>

        <Column field="data_exibicao" header="Recebida" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <div class="flex flex-col gap-1">
              <span class="text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap"
                v-tooltip.top="tratarData(data.created_at) ? 'Entrou no sistema em ' + tratarData(data.created_at) : ''">
                {{ tratarData(data.data_resposta) || tratarData(data.created_at) || 'Sem data' }}
              </span>
              <span class="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <i :class="['pi text-slate-400 text-xs', iconeCanal(data.canal)]"></i>{{ data.canal || 'E-mail' }}
              </span>
            </div>
          </template>
        </Column>

        <Column field="acao_vinculada" header="Plano de ação" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <button v-if="data.acao_vinculada" @click="irParaAcao(data.acao_vinculada)" v-tooltip.top="'Abrir nos Planos de Ação'"
              class="text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline whitespace-nowrap">
              Ação #{{ String(data.acao_vinculada).padStart(3, '0') }} <i class="pi pi-arrow-right text-xs"></i>
            </button>
            <button v-else-if="!data.excluido" @click="abrirNovaAcao(data)"
              class="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:text-orange-600 whitespace-nowrap">
              <i class="pi pi-plus text-xs mr-1"></i>Criar ação
            </button>
          </template>
        </Column>

        <Column header="Opções" style="width: 10rem">
          <template #body="{ data }">
            <div class="flex items-center gap-1 justify-end">
              <button @click="abrirAnalise(data)" class="h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">
                Analisar
              </button>
              <button @click="alternarArquivo(data)" v-tooltip.top="data.excluido ? 'Restaurar (volta a contar nos indicadores)' : 'Arquivar (deixa de contar nos indicadores)'"
                :aria-label="data.excluido ? 'Restaurar' : 'Arquivar'"
                class="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white">
                <i :class="['pi text-sm', data.excluido ? 'pi-undo' : 'pi-folder']"></i>
              </button>
              <button v-if="isAdmin" @click="excluirDefinitivo(data)" v-tooltip.top="'Excluir para sempre'" aria-label="Excluir"
                class="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                <i class="pi pi-trash text-sm"></i>
              </button>
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <DialogAnalise v-model:visible="dialogAnalise" :resposta="respostaAtual" @salvo="carregarRespostas"
      @criar-acao="abrirNovaAcao" @ver-acao="irParaAcao" />
    <DialogNovaAcao v-model:visible="dialogAcao" :resposta="respostaAtual" @criada="carregarRespostas" />
    <DialogNovaResposta v-model:visible="dialogNovaResposta" @salva="carregarRespostas" />
  </div>
</template>

<style scoped>
@reference "../style.css";

:deep(.tabela-respostas .p-datatable-thead > tr > th) {
  @apply bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 py-3 px-4;
}
:deep(.tabela-respostas .p-datatable-tbody > tr) {
  @apply bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300;
}
:deep(.tabela-respostas .p-datatable-tbody > tr:hover) {
  @apply bg-slate-50! dark:bg-slate-800/40!;
}
:deep(.tabela-respostas .p-datatable-tbody > tr > td) {
  @apply py-4 px-4 align-top border-b border-slate-100 dark:border-slate-800;
}
:deep(.tabela-respostas .p-datatable-wrapper) { @apply overflow-x-auto; }
:deep(.tabela-respostas .p-sortable-column-icon) { @apply text-xs ml-1; }
:deep(.tabela-respostas .p-sortable-column.p-highlight) { @apply text-orange-600!; }
:deep(.tabela-respostas .p-sortable-column.p-highlight .p-sortable-column-icon) { @apply text-orange-600!; }

/* Paginação */
:deep(.tabela-respostas .p-paginator) { @apply bg-transparent border-0 py-3 text-sm; }
:deep(.tabela-respostas .p-paginator .p-paginator-page),
:deep(.tabela-respostas .p-paginator .p-paginator-prev),
:deep(.tabela-respostas .p-paginator .p-paginator-next) { @apply rounded-lg min-w-9 h-9 text-slate-600 dark:text-slate-300; }
:deep(.tabela-respostas .p-paginator .p-paginator-page.p-highlight) { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
:deep(.tabela-respostas .p-paginator .p-paginator-current) { @apply text-slate-500 dark:text-slate-400 text-sm; }

/* Celular: cada resposta vira um cartão (layout "stack" do DataTable) */
@media (max-width: 767px) {
  :deep(.tabela-respostas .p-datatable-tbody > tr) { @apply block border-b-8 border-slate-100 dark:border-slate-800; }
  :deep(.tabela-respostas .p-datatable-tbody > tr > td) { @apply flex! items-start! justify-start! gap-3 border-0! py-2! px-4!; }
  :deep(.tabela-respostas .p-datatable-tbody > tr > td:first-child) { @apply pt-4!; }
  :deep(.tabela-respostas .p-datatable-tbody > tr > td:last-child) { @apply pb-4!; }
  :deep(.tabela-respostas .p-datatable-tbody > tr > td .p-column-title) { @apply w-24 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-0.5; min-width: 6rem; }
  :deep(.tabela-respostas .p-datatable-tbody > tr > td > div) { @apply min-w-0 flex-1; }
  :deep(.tabela-respostas .p-datatable-tbody > tr > td:last-child > div) { @apply justify-start!; }
}
</style>
