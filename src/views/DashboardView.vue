<script setup>
/**
 * Visão geral. Ordem pensada para o dono do negócio:
 *   1. Precisa de atenção  (o que resolver hoje)
 *   2. Resultado           (NPS, satisfação, taxa de resposta, movimentação)
 *   3. Por quê             (assuntos, comentários, resumo da IA)
 *   4. Detalhe             (evolução, empresas, palavras)
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import api from '../services/api';
import { dataISO } from '../utils/formatters';
import KpiCard from '../components/dashboard/KpiCard.vue';
import PainelAtencao from '../components/dashboard/PainelAtencao.vue';
import SinteseIA from '../components/dashboard/SinteseIA.vue';
import DialogMudancas from '../components/dashboard/DialogMudancas.vue';
import AjudaMetricas from '../components/dashboard/AjudaMetricas.vue';

const router = useRouter();
const toast = useToast();
const TODOS = 'Todos os grupos';

// ---------------------------------------------------------------- filtros
const hoje = new Date();
const inicio90 = new Date(); inicio90.setDate(hoje.getDate() - 90);
const periodo = ref([inicio90, hoje]);
const grupo = ref(TODOS);
const grupos = ref([TODOS]);
const apenasAtivos = ref(true);

const periodoCompleto = computed(() => !!(periodo.value?.[0] && periodo.value?.[1]));
const filtros = computed(() => {
  const p = new URLSearchParams();
  if (grupo.value && grupo.value !== TODOS) p.append('companhia', grupo.value);
  p.append('apenas_ativos', apenasAtivos.value ? 'true' : 'false');
  if (periodoCompleto.value) {
    p.append('data_inicio', dataISO(periodo.value[0]));
    p.append('data_fim', dataISO(periodo.value[1]));
  }
  return `?${p.toString()}`;
});
const descricaoPeriodo = computed(() => (periodoCompleto.value
  ? `${periodo.value[0].toLocaleDateString('pt-BR')} a ${periodo.value[1].toLocaleDateString('pt-BR')}`
  : 'todo o histórico'));

// ---------------------------------------------------------------- dados
const carregando = ref(true);
const kpis = ref({});
const feedbacks = ref([]);
const detalhes = ref({ ranking: [], taxa_resposta: 0, total_convidados: 0, total_responderam: 0, acoes_abertas: 0, acoes_vencidas: 0 });
const tendencia = ref({ labels: [], scores: [], totais: [] });
const csat = ref({ total: 0, media: 0, satisfeitos_pct: 0, ultimas: [] });
const nomeUsuario = (sessionStorage.getItem('usuario_nome') || '').split(' ')[0];

let versao = 0; // descarta respostas antigas se o filtro mudar no meio do carregamento
const carregar = async () => {
  const minha = ++versao;
  carregando.value = true;
  const q = filtros.value;
  const csatParams = { companhia: grupo.value !== TODOS ? grupo.value : undefined };
  if (periodoCompleto.value) Object.assign(csatParams, { data_inicio: dataISO(periodo.value[0]), data_fim: dataISO(periodo.value[1]) });
  else csatParams.dias = 3650;
  try {
    const [rk, rd, rt, rc] = await Promise.all([
      api.get(`/dashboard/kpis${q}`),
      api.get(`/dashboard/detalhes${q}`),
      api.get(`/dashboard/trend${q}`),
      api.get('/csat/resumo', { params: csatParams }).catch(() => ({ data: null })),
    ]);
    if (minha !== versao) return;
    kpis.value = rk.data.kpis || {};
    feedbacks.value = rk.data.feedbacks || [];
    detalhes.value = rd.data;
    tendencia.value = rt.data;
    if (rc.data) csat.value = rc.data;
  } catch (e) {
    if (minha === versao) toast.add({ severity: 'error', summary: 'Não foi possível carregar a visão geral', detail: 'Tente atualizar em alguns segundos.', life: 5000 });
  } finally {
    if (minha === versao) carregando.value = false;
  }
};

// um único ponto de recarga, com pequena espera para não disparar várias vezes
let espera = null;
watch([filtros], () => {
  if (periodo.value && !periodoCompleto.value) return; // escolhendo a 2ª data do intervalo
  clearTimeout(espera);
  espera = setTimeout(carregar, 250);
});
onUnmounted(() => clearTimeout(espera));

const carregarGrupos = async () => {
  try {
    const { data } = await api.get('/cadastros/companhias');
    grupos.value = [TODOS, ...data.map(c => c.nome).sort()];
  } catch (e) { /* sem grupos */ }
};

// ---------------------------------------------------------------- guia de primeiros passos
const onboarding = ref(null);
const guiaOculto = ref((() => { try { return localStorage.getItem('guia_primeiros_passos_oculto') === '1'; } catch (e) { return false; } })());
const ocultarGuia = () => { guiaOculto.value = true; try { localStorage.setItem('guia_primeiros_passos_oculto', '1'); } catch (e) { /* ok */ } };
const passosGuia = computed(() => {
  const p = onboarding.value?.passos || {};
  return [
    { chave: 'clientes', titulo: 'Cadastre seus clientes', texto: 'Importe uma planilha com clientes e contatos, ou cadastre um a um.', rota: '/importacao', botao: 'Importar planilha', feito: p.clientes },
    { chave: 'formulario', titulo: 'Revise o formulário', texto: 'Os formulários já vêm prontos. Ajuste as perguntas se quiser.', rota: '/formularios', botao: 'Abrir formulários', feito: p.formulario },
    { chave: 'envio', titulo: 'Envie a primeira pesquisa', texto: 'Dispare a pesquisa para alguns clientes ou compartilhe o link.', rota: '/audiencia', botao: 'Ir para envios', feito: p.envio },
    { chave: 'respostas', titulo: 'Receba as respostas', texto: 'Os números aparecem aqui e as notas baixas viram planos de ação.', rota: '/respostas', botao: 'Ver respostas', feito: p.respostas },
  ];
});
const mostrarGuia = computed(() => onboarding.value && !onboarding.value.concluido && !guiaOculto.value);
const passosFeitos = computed(() => passosGuia.value.filter(p => p.feito).length);

// ---------------------------------------------------------------- indicadores
const temNps = computed(() => (kpis.value.total_respostas || 0) > 0);
const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);
const distribuicao = computed(() => {
  const t = kpis.value.total_respostas || 0;
  return [
    { rotulo: 'Promotores', valor: kpis.value.promotores || 0, pct: pct(kpis.value.promotores, t), cor: 'bg-emerald-500', texto: 'text-emerald-600' },
    { rotulo: 'Neutros', valor: kpis.value.neutros || 0, pct: pct(kpis.value.neutros, t), cor: 'bg-amber-400', texto: 'text-amber-600' },
    { rotulo: 'Detratores', valor: kpis.value.detratores || 0, pct: pct(kpis.value.detratores, t), cor: 'bg-rose-500', texto: 'text-rose-600' },
  ];
});
const corNps = (n) => (n >= 50 ? 'text-emerald-600' : n >= 0 ? 'text-amber-600' : 'text-rose-600');
const resumoNps = (n) => (n >= 75 ? 'Excelente' : n >= 50 ? 'Muito bom' : n >= 0 ? 'Pode melhorar' : 'Crítico');

// ---------------------------------------------------------------- por quê
const maxMencoes = computed(() => Math.max(1, ...(kpis.value.topicos_criticos || []).map(t => t.mencoes)));
const comentarios = computed(() => {
  const nps = feedbacks.value.map(f => ({ tipo: 'NPS', nota: f.nota, escala: 10, texto: f.comentario, quem: f.cliente || f.empresa || 'Anônimo', data: f.created_at }));
  const cs = (csat.value.ultimas || []).filter(c => c.comentario).map(c => ({ tipo: 'CSAT', nota: c.nota, escala: 5, texto: c.comentario, quem: c.cliente || 'Anônimo', ref: c.referencia, data: c.created_at }));
  return [...nps, ...cs].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 6);
});
const corNota = (c) => {
  const ruim = c.escala === 10 ? c.nota <= 6 : c.nota <= 2;
  const medio = c.escala === 10 ? c.nota <= 8 : c.nota === 3;
  return ruim ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : medio ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
};
const dataCurta = (d) => (d ? new Date(String(d).replace(' ', 'T')).toLocaleDateString('pt-BR') : '');

// ---------------------------------------------------------------- detalhe
const MIN_RESPOSTAS = 3;
const abaRanking = ref('piores');
const rankingConfiavel = computed(() => (detalhes.value.ranking || []).filter(r => r.nome !== 'Não Identificado'));
const rankingLista = computed(() => {
  const base = rankingConfiavel.value.filter(r => r.total >= MIN_RESPOSTAS);
  const lista = base.length ? base : rankingConfiavel.value;
  const ordenada = [...lista].sort((a, b) => (abaRanking.value === 'melhores' ? b.nps - a.nps : a.nps - b.nps));
  return ordenada.slice(0, 6);
});
const rankingSemMinimo = computed(() => rankingConfiavel.value.length && !rankingConfiavel.value.some(r => r.total >= MIN_RESPOSTAS));

const grafico = computed(() => ({
  labels: tendencia.value.labels || [],
  datasets: [{
    label: 'NPS', data: tendencia.value.scores || [], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)',
    fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#f97316',
  }],
}));
const opcoesGrafico = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c) => `NPS ${c.parsed.y} · ${tendencia.value.totais?.[c.dataIndex] ?? '?'} respostas` } },
  },
  scales: { y: { suggestedMin: -100, suggestedMax: 100, ticks: { stepSize: 50 } }, x: { grid: { display: false } } },
}));

const palavras = computed(() => kpis.value.termos_frequentes || []);
const maxPalavra = computed(() => Math.max(1, ...palavras.value.map(p => p.quantidade)));

// ---------------------------------------------------------------- ações
const dialogo = ref({ visivel: false, tipo: 'risco' });
const abrirDialogo = (tipo) => { dialogo.value = { visivel: true, tipo }; };
const ajuda = ref(false);

const exportando = ref(false);
const exportar = async () => {
  exportando.value = true;
  try {
    const res = await api.get(`/dashboard/exportar${filtros.value}`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url; a.download = `rakiti-visao-geral-${dataISO(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Não foi possível exportar', life: 4000 });
  } finally {
    exportando.value = false;
  }
};

onMounted(() => {
  api.get('/onboarding').then(r => { onboarding.value = r.data; }).catch(() => {});
  carregarGrupos();
  carregar();
});
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-6 pb-24">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Visão geral<span class="text-orange-500">.</span></h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            <span v-if="nomeUsuario">Olá, {{ nomeUsuario }} · </span>{{ descricaoPeriodo }}<span v-if="grupo !== TODOS"> · {{ grupo }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="ajuda = true" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300" title="Como ler os números"><i class="pi pi-question-circle text-sm"></i></button>
          <button @click="exportar" :disabled="exportando" class="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-60">
            <i :class="['pi mr-1 text-xs', exportando ? 'pi-spin pi-spinner' : 'pi-download']"></i>Exportar
          </button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"><i class="pi pi-calendar text-slate-400 text-sm"></i>
          <Calendar v-model="periodo" selectionMode="range" :manualInput="false" dateFormat="dd/mm/yy" placeholder="Todo o período" class="filtro-campo w-52" />
          <button v-if="periodo" @click="periodo = null" class="text-slate-400 hover:text-slate-600" title="Ver todo o histórico"><i class="pi pi-times text-xs"></i></button>
        </div>
        <div class="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"><i class="pi pi-sitemap text-slate-400 text-sm"></i>
          <Dropdown v-model="grupo" :options="grupos" class="filtro-campo w-44" />
        </div>
        <label class="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer" v-tooltip.bottom="'Desligado: inclui empresas marcadas como inativas'">
          <InputSwitch v-model="apenasAtivos" class="scale-75" /><span class="text-sm text-slate-600 dark:text-slate-300">Só ativos</span>
        </label>
        <button @click="carregar" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300" title="Atualizar"><i :class="['pi pi-refresh text-sm', carregando ? 'pi-spin' : '']"></i></button>
      </div>
    </header>

    <!-- Primeiros passos -->
    <section v-if="mostrarGuia" class="bg-white dark:bg-slate-900 rounded-2xl border border-orange-200 dark:border-orange-500/30 p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Primeiros passos</h2>
          <p class="text-sm text-slate-500">{{ passosFeitos }} de {{ passosGuia.length }} concluídos</p>
        </div>
        <button @click="ocultarGuia" class="text-sm text-slate-500 hover:text-slate-700"><i class="pi pi-times mr-1 text-xs"></i>Ocultar</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div v-for="(p, i) in passosGuia" :key="p.chave" class="rounded-xl border p-4 flex flex-col gap-2"
          :class="p.feito ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/5' : 'border-slate-200 dark:border-slate-700'">
          <p class="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full text-xs flex items-center justify-center shrink-0" :class="p.feito ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700'">
              <i v-if="p.feito" class="pi pi-check text-[10px]"></i><template v-else>{{ i + 1 }}</template>
            </span>{{ p.titulo }}
          </p>
          <p class="text-sm text-slate-500 flex-1">{{ p.texto }}</p>
          <button v-if="!p.feito" @click="router.push(p.rota)" class="self-start text-sm font-semibold text-orange-600 hover:underline">{{ p.botao }} →</button>
        </div>
      </div>
    </section>

    <!-- 1. Precisa de atenção -->
    <div v-if="carregando && !kpis.score && kpis.score !== 0" class="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    <PainelAtencao v-else :ranking="detalhes.ranking" :acoes-abertas="detalhes.acoes_abertas" :acoes-vencidas="detalhes.acoes_vencidas"
      :em-risco="kpis.clientes_em_risco || 0" :quedas="kpis.queda_drastica || 0" :receita-em-risco="kpis.revenue_at_risk || 0"
      @ver-risco="abrirDialogo('risco')" />

    <!-- 2. Resultado -->
    <section>
      <h2 class="text-base font-bold text-slate-900 dark:text-white mb-3">Resultado do período</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" :class="{ 'opacity-60': carregando }">
        <!-- NPS -->
        <KpiCard titulo="NPS" icone="pi pi-chart-line" ajuda="Promotores (%) menos detratores (%). Vai de -100 a +100.">
          <template v-if="temNps">
            <div class="flex items-baseline gap-2">
              <span class="text-4xl font-black" :class="corNps(kpis.score)">{{ kpis.score }}</span>
              <span class="text-sm text-slate-500">{{ resumoNps(kpis.score) }}</span>
              <span v-if="kpis.variacao_nps !== null && kpis.variacao_nps !== undefined" class="ml-auto text-sm font-semibold"
                :class="kpis.variacao_nps > 0 ? 'text-emerald-600' : kpis.variacao_nps < 0 ? 'text-rose-600' : 'text-slate-500'"
                v-tooltip.top="'Comparado ao período anterior de mesmo tamanho'">
                {{ kpis.variacao_nps > 0 ? '▲ +' : kpis.variacao_nps < 0 ? '▼ ' : '' }}{{ kpis.variacao_nps }}
              </span>
            </div>
            <div class="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div v-for="d in distribuicao" :key="d.rotulo" :class="d.cor" :style="{ width: d.pct + '%' }"></div>
            </div>
            <div class="flex justify-between text-xs text-slate-500">
              <span v-for="d in distribuicao" :key="d.rotulo"><b :class="d.texto">{{ d.pct }}%</b> {{ d.rotulo.toLowerCase() }}</span>
            </div>
            <p class="text-xs text-slate-500">{{ kpis.total_respostas }} {{ kpis.total_respostas === 1 ? 'resposta' : 'respostas' }}<span v-if="kpis.total_decisores"> · decisores: <b>{{ kpis.nps_decisor }}</b> ({{ kpis.total_decisores }})</span></p>
          </template>
          <p v-else class="text-sm text-slate-500 py-3">Ainda sem respostas de NPS neste período.</p>
        </KpiCard>

        <!-- CSAT -->
        <KpiCard titulo="Satisfação (CSAT)" icone="pi pi-face-smile" ajuda="% de notas 4 e 5 nas pesquisas de 1 a 5 (após entrega ou atendimento).">
          <template v-if="csat.total">
            <div class="flex items-baseline gap-2">
              <span class="text-4xl font-black" :class="csat.satisfeitos_pct >= 80 ? 'text-emerald-600' : csat.satisfeitos_pct >= 60 ? 'text-amber-600' : 'text-rose-600'">{{ Math.round(csat.satisfeitos_pct) }}%</span>
              <span class="text-sm text-slate-500">satisfeitos</span>
            </div>
            <p class="text-xs text-slate-500">Média {{ csat.media.toLocaleString('pt-BR') }} de 5 · {{ csat.total }} {{ csat.total === 1 ? 'avaliação' : 'avaliações' }}</p>
          </template>
          <div v-else class="py-1">
            <p class="text-sm text-slate-500">Sem avaliações de satisfação no período.</p>
            <button @click="router.push('/formularios')" class="text-sm font-semibold text-orange-600 hover:underline mt-1">Configurar pesquisa pós-entrega →</button>
          </div>
        </KpiCard>

        <!-- Taxa de resposta -->
        <KpiCard titulo="Taxa de resposta" icone="pi pi-inbox" ajuda="Clientes cadastrados que responderam no período.">
          <template v-if="detalhes.total_convidados">
            <div class="flex items-baseline gap-2">
              <span class="text-4xl font-black text-slate-900 dark:text-white">{{ detalhes.taxa_resposta }}%</span>
            </div>
            <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full bg-orange-500" :style="{ width: Math.min(100, detalhes.taxa_resposta) + '%' }"></div>
            </div>
            <p class="text-xs text-slate-500">{{ detalhes.total_responderam }} de {{ detalhes.total_convidados }} clientes responderam<span v-if="detalhes.taxa_resposta < 20"> · amostra pequena</span></p>
          </template>
          <p v-else class="text-sm text-slate-500 py-3">Cadastre clientes para acompanhar.</p>
        </KpiCard>

        <!-- Movimentação -->
        <KpiCard titulo="Movimentação" icone="pi pi-sort-alt" ajuda="Compara a última resposta de cada cliente com a anterior.">
          <button @click="abrirDialogo('resgatados')" class="flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-left">
            <span class="text-sm text-emerald-800 dark:text-emerald-300"><i class="pi pi-arrow-up-right text-xs mr-1"></i>Resgatados</span>
            <span class="text-xl font-black text-emerald-700 dark:text-emerald-400">{{ kpis.clientes_resgatados || 0 }}</span>
          </button>
          <button @click="abrirDialogo('risco')" class="flex items-center justify-between rounded-lg px-3 py-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-left">
            <span class="text-sm text-rose-800 dark:text-rose-300"><i class="pi pi-arrow-down-right text-xs mr-1"></i>Deixaram de ser promotores</span>
            <span class="text-xl font-black text-rose-700 dark:text-rose-400">{{ kpis.clientes_em_risco || 0 }}</span>
          </button>
        </KpiCard>
      </div>
    </section>

    <!-- 3. Por quê -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">Assuntos mais citados</h2>
        <p class="text-sm text-slate-500 mb-4">Nos comentários de NPS, com a nota média de quem falou do assunto.</p>
        <ul v-if="(kpis.topicos_criticos || []).length" class="flex flex-col gap-3">
          <li v-for="t in kpis.topicos_criticos" :key="t.tema">
            <div class="flex items-center justify-between text-sm mb-1">
              <span class="font-semibold text-slate-700 dark:text-slate-200">{{ t.tema }}</span>
              <span class="text-slate-500">{{ t.mencoes }} {{ t.mencoes === 1 ? 'menção' : 'menções' }} · nota média
                <b :class="t.notaMedia <= 6 ? 'text-rose-600' : t.notaMedia <= 8 ? 'text-amber-600' : 'text-emerald-600'">{{ t.notaMedia.toLocaleString('pt-BR') }}</b>
              </span>
            </div>
            <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full" :class="t.notaMedia <= 6 ? 'bg-rose-400' : t.notaMedia <= 8 ? 'bg-amber-400' : 'bg-emerald-400'" :style="{ width: (t.mencoes / maxMencoes * 100) + '%' }"></div>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-500 py-6 text-center">Sem comentários suficientes no período.</p>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Comentários recentes</h2>
            <p class="text-sm text-slate-500">O que os clientes escreveram por último.</p>
          </div>
          <button @click="router.push('/respostas')" class="text-sm font-semibold text-orange-600 hover:underline">Ver todas</button>
        </div>
        <ul v-if="comentarios.length" class="flex flex-col gap-3">
          <li v-for="(c, i) in comentarios" :key="i" class="flex gap-3">
            <span :class="['w-10 h-8 shrink-0 rounded-lg text-sm font-bold flex items-center justify-center', corNota(c)]" v-tooltip.top="c.tipo === 'NPS' ? 'Nota de 0 a 10' : 'Satisfação de 1 a 5'">{{ c.nota }}</span>
            <div class="min-w-0">
              <p class="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line line-clamp-3">{{ c.texto }}</p>
              <p class="text-xs text-slate-400 mt-0.5">{{ c.quem }}<span v-if="c.ref"> · {{ c.ref }}</span> · {{ c.tipo }} · {{ dataCurta(c.data) }}</p>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-500 py-6 text-center">Nenhum comentário no período.</p>
      </div>
    </section>

    <SinteseIA :filtros="filtros" />

    <!-- 4. Detalhe -->
    <section class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div class="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">Evolução do NPS por mês</h2>
        <p class="text-sm text-slate-500 mb-4">Passe o mouse para ver quantas respostas há em cada mês. Meses com poucas respostas oscilam mais.</p>
        <div class="h-64">
          <Chart v-if="(tendencia.labels || []).length" type="line" :data="grafico" :options="opcoesGrafico" class="h-full" />
          <p v-else class="text-sm text-slate-500 pt-20 text-center">Sem respostas no período.</p>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Empresas</h2>
          <div class="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button v-for="a in [['piores', 'Menor NPS'], ['melhores', 'Maior NPS']]" :key="a[0]" @click="abaRanking = a[0]"
              :class="['px-2.5 py-1 rounded-md', abaRanking === a[0] ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500']">{{ a[1] }}</button>
          </div>
        </div>
        <p class="text-sm text-slate-500 mb-4">{{ rankingSemMinimo ? 'Ainda há poucas respostas por empresa.' : `Com ${MIN_RESPOSTAS} ou mais respostas no período.` }}</p>
        <ul v-if="rankingLista.length" class="flex flex-col gap-3">
          <li v-for="r in rankingLista" :key="r.nome">
            <div class="flex items-center justify-between text-sm mb-1">
              <button @click="router.push({ path: '/acoes', query: { empresa: r.nome } })" class="font-semibold text-slate-700 dark:text-slate-200 truncate hover:text-orange-600 text-left">{{ r.nome }}</button>
              <span class="shrink-0 pl-2"><b :class="corNps(r.nps)">{{ r.nps }}</b> <span class="text-slate-400 text-xs">· {{ r.total }} resp.</span></span>
            </div>
            <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full" :class="r.nps >= 50 ? 'bg-emerald-500' : r.nps >= 0 ? 'bg-amber-400' : 'bg-rose-500'" :style="{ width: Math.max(4, (r.nps + 100) / 2) + '%' }"></div>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-500 py-6 text-center">Sem empresas com respostas no período.</p>
      </div>

      <div v-if="palavras.length" class="xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white mb-3">Palavras mais citadas</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="p in palavras" :key="p.palavra" class="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            :style="{ fontSize: (0.8 + (p.quantidade / maxPalavra) * 0.5) + 'rem' }">
            {{ p.palavra }} <span class="text-xs text-slate-400">{{ p.quantidade }}</span>
          </span>
        </div>
      </div>
    </section>

    <DialogMudancas v-model:visible="dialogo.visivel" :tipo="dialogo.tipo"
      :lista="dialogo.tipo === 'risco' ? (kpis.lista_risco || []) : (kpis.lista_resgatados || [])" />
    <AjudaMetricas v-model:visible="ajuda" />
  </div>
</template>

<style scoped>
/* Campos do PrimeVue sem borda própria dentro das caixas de filtro */
:deep(.filtro-campo.p-dropdown), :deep(.filtro-campo .p-inputtext) {
  border: none !important; box-shadow: none !important; background: transparent !important;
  font-size: 0.875rem; padding: 0.25rem 0; color: inherit !important;
}
:deep(.filtro-campo .p-dropdown-label) { padding: 0.25rem 0; font-size: 0.875rem; color: inherit; }
:deep(.filtro-campo .p-dropdown-trigger) { color: inherit; }
</style>
