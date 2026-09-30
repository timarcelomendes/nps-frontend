<script setup>
// Aba "Por grupo de clientes": NPS por segmento, por tempo como cliente e assuntos a priorizar.
// Obs.: estes endpoints não recebem o período; o servidor usa os últimos 6 meses.
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dropdown from 'primevue/dropdown';
import Chart from 'primevue/chart';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import api from '../../services/api';
import { corNps, barraNps, HEX } from './cores';

const props = defineProps({ filtros: { type: Object, required: true } });
const emit = defineEmits(['update:filtros']);
const toast = useToast();

// ---------------------------------------------------------------- filtros (o valor enviado à API não muda)
const opcoesSegmento = ref([{ rotulo: 'Todos os segmentos', valor: 'Todos' }]);
const opcoesValor = [
  { rotulo: 'Qualquer valor', valor: 'Todos' },
  { rotulo: 'Acima de 100 mil', valor: '> € 100k' },
  { rotulo: 'De 50 mil a 100 mil', valor: '€ 50k - € 100k' },
  { rotulo: 'Abaixo de 50 mil', valor: '< € 50k' },
];
const opcoesTempo = [
  { rotulo: 'Qualquer tempo', valor: 'Todos' },
  { rotulo: 'Até 3 meses', valor: '0-3 Meses (Onboarding)' },
  { rotulo: 'De 3 a 12 meses', valor: '3-12 Meses' },
  { rotulo: 'Mais de 1 ano', valor: '+1 Ano' },
];
const alterar = (campo, valor) => emit('update:filtros', { ...props.filtros, [campo]: valor });
const temFiltro = computed(() => ['segmento', 'arr', 'safra'].some(k => props.filtros[k] !== 'Todos'));
const limpar = () => emit('update:filtros', { ...props.filtros, segmento: 'Todos', arr: 'Todos', safra: 'Todos' });

// ---------------------------------------------------------------- dados
const carregando = ref(true);
const segmentos = ref([]);
const tempoCasa = ref({ labels: [], promotores: [], neutros: [], detratores: [] });
const assuntos = ref([]);

let versao = 0; // ignora respostas antigas se o filtro mudar no meio do carregamento
const carregar = async () => {
  const minha = ++versao;
  carregando.value = true;
  try {
    const config = { params: props.filtros };
    const [rs, rt, rg] = await Promise.all([
      api.get('/reports/bi-scatter', config),
      api.get('/reports/bi-safra', config),
      api.get('/reports/bi-segmento', config),
    ]);
    if (minha !== versao) return;
    assuntos.value = rs.data || [];
    tempoCasa.value = rt.data || tempoCasa.value;
    segmentos.value = rg.data || [];
  } catch (e) {
    if (minha === versao) toast.add({ severity: 'error', summary: 'Não foi possível carregar os relatórios', detail: 'Tente de novo em alguns segundos.', life: 5000 });
  } finally {
    if (minha === versao) carregando.value = false;
  }
};

// chave em texto: só dispara quando um destes valores muda de fato
watch(() => `${props.filtros.segmento}|${props.filtros.arr}|${props.filtros.safra}`, carregar);

onMounted(() => {
  carregar();
  api.get('/cadastros/segmentos')
    .then(res => { opcoesSegmento.value = [opcoesSegmento.value[0], ...res.data.map(s => ({ rotulo: s.nome, valor: s.nome }))]; })
    .catch(() => {});
});

// ---------------------------------------------------------------- tempo como cliente
const NOMES_TEMPO = { '0-3 Meses': 'Até 3 meses', '3-6 Meses': '3 a 6 meses', '6-12 Meses': '6 a 12 meses', '+1 Ano': 'Mais de 1 ano' };
const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);
const gruposTempo = computed(() => (tempoCasa.value.labels || []).map((l, i) => {
  const p = tempoCasa.value.promotores[i] || 0;
  const n = tempoCasa.value.neutros[i] || 0;
  const d = tempoCasa.value.detratores[i] || 0;
  const total = p + n + d;
  return { rotulo: NOMES_TEMPO[l] || l, total, nps: total ? Math.round(((p - d) / total) * 100) : null, partes: [
    { nome: 'promotores', valor: p, pct: pct(p, total), cor: 'bg-emerald-500' },
    { nome: 'neutros', valor: n, pct: pct(n, total), cor: 'bg-amber-400' },
    { nome: 'detratores', valor: d, pct: pct(d, total), cor: 'bg-rose-500' },
  ] };
}));
const temTempo = computed(() => gruposTempo.value.some(g => g.total > 0));

// ---------------------------------------------------------------- assuntos (nota x frequência)
const grafico = computed(() => {
  const faixa = (min, max) => assuntos.value.filter(a => a.y >= min && a.y < max);
  return { datasets: [
    { label: 'Média abaixo de 7', data: faixa(-1, 7), backgroundColor: HEX.ruim },
    { label: 'Média de 7 a 9', data: faixa(7, 9), backgroundColor: HEX.medio },
    { label: 'Média 9 ou mais', data: faixa(9, 11), backgroundColor: HEX.bom },
  ].filter(d => d.data.length) };
});
const fonte = { size: 12 };
const opcoesGrafico = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 16, right: 24 } },
  elements: { point: { radius: 7, hoverRadius: 9 } },
  plugins: {
    legend: { position: 'bottom', labels: { color: HEX.eixo, font: fonte, usePointStyle: true, boxWidth: 8 } },
    tooltip: { callbacks: { label: (c) => `${c.raw.tema}: ${c.raw.x} respostas · nota média ${String(c.raw.y).replace('.', ',')}` } },
    datalabels: { formatter: (v) => v.tema, align: 'top', offset: 6, color: HEX.eixo, font: { ...fonte, weight: '600' }, clip: false },
  },
  scales: {
    x: { beginAtZero: true, grace: '10%', title: { display: true, text: 'Quantas respostas citaram o assunto', color: HEX.eixo, font: fonte }, ticks: { color: HEX.eixo, font: fonte, precision: 0 }, grid: { color: HEX.grade } },
    y: { min: 0, max: 10, title: { display: true, text: 'Nota média (0 a 10)', color: HEX.eixo, font: fonte }, ticks: { color: HEX.eixo, font: fonte, stepSize: 2 }, grid: { color: HEX.grade } },
  },
};
const plugins = [ChartDataLabels];
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Filtros -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-3">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label class="flex flex-col gap-1 min-w-0">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Segmento</span>
          <Dropdown :modelValue="filtros.segmento" @update:modelValue="alterar('segmento', $event)" :options="opcoesSegmento" optionLabel="rotulo" optionValue="valor" class="w-full campo" />
        </label>
        <label class="flex flex-col gap-1 min-w-0">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Valor do contrato</span>
          <Dropdown :modelValue="filtros.arr" @update:modelValue="alterar('arr', $event)" :options="opcoesValor" optionLabel="rotulo" optionValue="valor" class="w-full campo" />
        </label>
        <label class="flex flex-col gap-1 min-w-0">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Tempo como cliente</span>
          <Dropdown :modelValue="filtros.safra" @update:modelValue="alterar('safra', $event)" :options="opcoesTempo" optionLabel="rotulo" optionValue="valor" class="w-full campo" />
        </label>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span><i class="pi pi-info-circle text-xs mr-1"></i>Considera as respostas dos últimos 6 meses.</span>
        <button v-if="temFiltro" type="button" @click="limpar" class="font-semibold text-orange-600 hover:underline">Limpar filtros</button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" :class="{ 'opacity-60': carregando }">
      <!-- NPS por segmento -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">NPS por segmento</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Como cada ramo de atuação dos seus clientes avalia você.</p>
        <div v-if="carregando && !segmentos.length" class="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
        <ul v-else-if="segmentos.length" class="flex flex-col gap-3">
          <li v-for="s in segmentos" :key="s.segmento">
            <div class="flex items-center justify-between gap-2 text-sm mb-1">
              <span class="font-semibold text-slate-700 dark:text-slate-200 truncate">{{ s.segmento }}</span>
              <span class="shrink-0"><b :class="corNps(s.nps)">{{ Math.round(s.nps) }}</b> <span class="text-slate-400 text-xs">· {{ s.total_respostas }} {{ s.total_respostas === 1 ? 'resposta' : 'respostas' }}</span></span>
            </div>
            <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full" :class="barraNps(s.nps)" :style="{ width: Math.max(4, (s.nps + 100) / 2) + '%' }"></div>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-500 py-8 text-center">Nenhuma resposta com esses filtros.</p>
      </section>

      <!-- Tempo como cliente -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">Por tempo como cliente</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Clientes novos e antigos estão igualmente satisfeitos? Contado a partir do cadastro da empresa.</p>
        <div v-if="carregando && !temTempo" class="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
        <ul v-else-if="temTempo" class="flex flex-col gap-4">
          <li v-for="g in gruposTempo" :key="g.rotulo">
            <div class="flex items-center justify-between gap-2 text-sm mb-1">
              <span class="font-semibold text-slate-700 dark:text-slate-200">{{ g.rotulo }}</span>
              <span v-if="g.total" class="shrink-0">NPS <b :class="corNps(g.nps)">{{ g.nps }}</b> <span class="text-slate-400 text-xs">· {{ g.total }} {{ g.total === 1 ? 'resposta' : 'respostas' }}</span></span>
              <span v-else class="text-xs text-slate-400">Sem respostas</span>
            </div>
            <div class="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div v-for="p in g.partes" :key="p.nome" :class="p.cor" :style="{ width: p.pct + '%' }" :title="`${p.valor} ${p.nome}`"></div>
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-slate-500 py-8 text-center">Nenhuma resposta com esses filtros.</p>
        <div v-if="temTempo" class="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-slate-500 dark:text-slate-400">
          <span><i class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></i>Promotores (9-10)</span>
          <span><i class="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></i>Neutros (7-8)</span>
          <span><i class="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1"></i>Detratores (0-6)</span>
        </div>
      </section>
    </div>

    <!-- Assuntos a priorizar -->
    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5" :class="{ 'opacity-60': carregando }">
      <h2 class="text-base font-bold text-slate-900 dark:text-white">O que resolver primeiro</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Cada ponto é um assunto das respostas. Priorize os que estão <b>embaixo e à direita</b>: muito citados e com nota baixa.</p>
      <div v-if="carregando && !assuntos.length" class="h-72 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      <div v-else-if="assuntos.length" class="h-80">
        <Chart type="scatter" :data="grafico" :options="opcoesGrafico" :plugins="plugins" class="h-full" />
      </div>
      <p v-else class="text-sm text-slate-500 py-8 text-center">Ainda não há assuntos citados em mais de uma resposta com esses filtros.</p>
    </section>
  </div>
</template>

<style scoped>
@reference "../../style.css";
/* Mesma aparência dos outros campos, também no modo escuro */
:deep(.campo.p-dropdown) { @apply rounded-xl! border-slate-200! dark:border-slate-700! bg-white! dark:bg-slate-900! shadow-none!; }
:deep(.campo .p-dropdown-label) { @apply text-sm! py-2.5! text-slate-700! dark:text-slate-200! bg-transparent!; }
:deep(.campo .p-dropdown-trigger) { @apply bg-transparent! text-slate-400!; }
</style>
