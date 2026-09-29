<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';

// Componentes PrimeVue
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Chart from 'primevue/chart';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Timeline from 'primevue/timeline';
import Tag from 'primevue/tag';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Calendar from 'primevue/calendar';

// Plugin de Rótulos
import ChartDataLabels from 'chartjs-plugin-datalabels';

const toast = useToast();
const pluginsGlobais = [ChartDataLabels];

// ==========================================
// 🎛️ ESTADOS GERAIS E FILTRO DE DATA
// ==========================================
const abaAtiva = ref(0);
const loadingDados = ref(true);
const datasFiltro = ref(null);

const filtros = ref({
  segmento: 'Todos',
  arr: 'Todos',
  safra: 'Todos',
  data_inicio: null,
  data_fim: null
});

const opcoesSegmento = ref(['Todos']);
const opcoesARR = ref(['Todos', '> € 100k', '€ 50k - € 100k', '< € 50k']);
const opcoesSafra = ref(['Todos', '0-3 Meses (Onboarding)', '3-12 Meses', '+1 Ano']);

const formatarParaAPI = (data) => {
  if (!data) return null;
  const d = new Date(data);
  return d.toISOString().split('T')[0];
};

// ==========================================
// 📊 CONFIGURAÇÕES DE GRÁFICOS (OPTIONS)
// ==========================================

// Configuração comum para exibir rótulos
const labelPluginConfig = {
  anchor: 'end',
  align: 'top',
  formatter: (value) => value,
  font: { weight: '900', size: 11, family: 'Inter' },
  color: '#64748b'
};

const chartOptionsSegmento = ref({
    plugins: {
        legend: { display: false },
        datalabels: labelPluginConfig
    },
    scales: {
        y: { beginAtZero: true, grid: { display: false }, ticks: { display: false } },
        x: { grid: { display: false }, ticks: { font: { weight: '700', size: 10 }, color: '#94a3b8' } }
    }
});

const optionsScatter = ref({ 
  responsive: true, 
  maintainAspectRatio: false,
  plugins: { datalabels: { display: false } } // Oculto no scatter para não poluir
});

const optionsStackedBar = ref({ 
  responsive: true, 
  maintainAspectRatio: false, 
  plugins: { 
    datalabels: { ...labelPluginConfig, align: 'center', color: '#fff' } 
  },
  scales: { x: { stacked: true }, y: { stacked: true } } 
});

// ==========================================
// 📊 CARREGAMENTO DE DADOS
// ==========================================
const dataScatter = ref(null);
const dataStackedBar = ref(null);
const chartDataSegmento = ref({});

const fetchGraficos = async () => {
  loadingDados.value = true;
  try {
    const config = { params: filtros.value };
    const [resScatter, resSafra, resSegmento] = await Promise.all([
      api.get('/reports/bi-scatter', config),
      api.get('/reports/bi-safra', config),
      api.get('/reports/bi-segmento', config)
    ]);

    // 1. Scatter Chart
    dataScatter.value = {
      datasets: [
        { label: 'Tópicos Críticos', data: resScatter.data.filter(d => d.y <= 6), backgroundColor: 'rgba(244, 63, 94, 0.8)' },
        { label: 'Melhoria', data: resScatter.data.filter(d => d.y > 6), backgroundColor: 'rgba(245, 158, 11, 0.8)' }
      ]
    };

    // 2. Stacked Bar (Tempo de Casa)
    dataStackedBar.value = {
      labels: resSafra.data.labels,
      datasets: [
        { label: 'Promotores', backgroundColor: '#10b981', data: resSafra.data.promotores },
        { label: 'Neutros', backgroundColor: '#f59e0b', data: resSafra.data.neutros },
        { label: 'Detratores', backgroundColor: '#f43f5e', data: resSafra.data.detratores }
      ]
    };

    // 3. Segmento
    if (resSegmento.data) {
      chartDataSegmento.value = {
        labels: resSegmento.data.map(s => s.segmento),
        datasets: [{
          label: 'NPS Score',
          backgroundColor: resSegmento.data.map(s => s.nps >= 0 ? '#F97316' : '#EF4444'),
          borderRadius: 6,
          data: resSegmento.data.map(s => s.nps)
        }]
      };
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados de BI.' });
  } finally {
    loadingDados.value = false;
  }
};

// ==========================================
// ⚙️ OUTRAS ABAS (OPERACIONAL, JORNADA, RESPONSÁVEIS)
// ==========================================
const dadosOperacionais = ref({ taxa_resposta: 0, sla_medio_dias: 0 });
const clientesInativos = ref([]);
const loadingInativos = ref(false);

const carregarOperacional = async () => {
  api.get('/reports/operacional', { params: filtros.value }).then(res => dadosOperacionais.value = res.data);
};

const carregarInativos = async () => {
  loadingInativos.value = true;
  api.get('/reports/operacional/inativos', { params: filtros.value })
     .then(res => clientesInativos.value = res.data.lista)
     .finally(() => loadingInativos.value = false);
};

const empresaSelecionadaJornada = ref(null);
const historicoJornada = ref([]);
const loadingJornada = ref(false);
const listaEmpresas = ref([]);
const npsEmpresaJornada = ref(null);
const totalRespostasJornada = ref(0);

const buscarJornada = async () => {
  if (!empresaSelecionadaJornada.value) return;
  loadingJornada.value = true;
  try {
    const params = { empresa: empresaSelecionadaJornada.value, ...filtros.value };
    const res = await api.get('/reports/jornada', { params });
    historicoJornada.value = res.data.historico || [];
    npsEmpresaJornada.value = res.data.nps_atual;
    totalRespostasJornada.value = res.data.total_respostas || 0;
  } finally { loadingJornada.value = false; }
};

const gestorSelecionado = ref(null);
const listaGestores = ref([]);
const dadosGestor = ref(null);
const loadingGestor = ref(false);
const chartGestor = ref(null);

const carregarPerformanceGestor = async () => {
  if (!gestorSelecionado.value) return;
  loadingGestor.value = true;
  try {
    const res = await api.get('/reports/gestor', { params: { gestor_id: gestorSelecionado.value, ...filtros.value }});
    dadosGestor.value = res.data;
    chartGestor.value = {
      labels: res.data.ranking_empresas.map(e => e.nome),
      datasets: [{ label: 'Média', backgroundColor: '#6366f1', borderRadius: 8, data: res.data.ranking_empresas.map(e => e.media_nota) }]
    };
  } finally { loadingGestor.value = false; }
};

// ==========================================
// 📅 WATCHERS E INICIALIZAÇÃO
// ==========================================
watch(datasFiltro, (val) => {
  if (val && val[0] && val[1]) {
    filtros.value.data_inicio = formatarParaAPI(val[0]);
    filtros.value.data_fim = formatarParaAPI(val[1]);
  } else {
    filtros.value.data_inicio = null;
    filtros.value.data_fim = null;
  }
});

watch(filtros, () => {
  fetchGraficos();
  carregarOperacional();
  carregarInativos();
  if (empresaSelecionadaJornada.value) buscarJornada();
  if (gestorSelecionado.value) carregarPerformanceGestor();
}, { deep: true });

const labelPeriodo = computed(() => {
  if (!datasFiltro.value || !datasFiltro.value[0] || !datasFiltro.value[1]) return "Todo o Histórico";
  return `${datasFiltro.value[0].toLocaleDateString('pt-BR')} até ${datasFiltro.value[1].toLocaleDateString('pt-BR')}`;
});

const getCorNota = (nota) => nota >= 9 ? 'success' : (nota >= 7 ? 'warning' : 'danger');
const formatarData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '---';

onMounted(() => {
  fetchGraficos();
  carregarOperacional();
  carregarInativos();
  api.get('/reports/lista-gestores').then(res => listaGestores.value = res.data);
  api.get('/cadastros/empresas').then(res => listaEmpresas.value = res.data.map(e => e.nome));
  api.get('/cadastros/segmentos').then(res => opcoesSegmento.value = ['Todos', ...res.data.map(s => s.nome)]);
});
</script>

<template>
  <div class="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 lg:p-8">
    <div class="max-w-[1600px] mx-auto space-y-6">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <h1 class="text-4xl lg:text-5xl font-black tracking-tighter italic text-slate-900 dark:text-white">
            Relatórios <span class="text-indigo-500">.</span>
          </h1>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Relatórios Executivos e Visão de Jornada</p>
          
          <div v-if="datasFiltro" class="flex items-center gap-2 mt-4 animate-fadein">
            <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Exibindo:</span>
            <Tag :value="labelPeriodo" severity="info" class="!bg-indigo-500/10 !text-indigo-500 !text-[10px] !font-black !px-3 !rounded-full border border-indigo-500/20" />
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-sm transition-all hover:border-indigo-500/50">
            
            <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
              <i class="pi pi-calendar text-indigo-500 text-xs"></i>
              <span class="text-[9px] font-black uppercase tracking-widest text-slate-500">Período</span>
            </div>

            <Calendar 
              v-model="datasFiltro" 
              selectionMode="range" 
              :manualInput="false" 
              placeholder="Selecionar intervalo..." 
              dateFormat="dd/mm/yy" 
              class="custom-calendar-premium" 
              @hide="carregarDashboard"
              :showIcon="false"
              hideOnRangeSelection
            />

            <button 
              v-if="datasFiltro" 
              @click="datasFiltro = null; carregarDashboard()"
              class="ml-2 mr-2 w-7 h-7 flex items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer border-none"
            >
              <i class="pi pi-times text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>

      <TabView v-model:activeIndex="abaAtiva" class="custom-tabview-premium">
        
        <TabPanel>
          <template #header><i class="pi pi-chart-bar mr-2"></i> Estratégico</template>
          
          <div class="space-y-6 mt-6"> <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5 px-3">
                <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Segmento</span>
                <Dropdown v-model="filtros.segmento" :options="opcoesSegmento" class="custom-dropdown-minimal" />
              </div>
              <div class="flex flex-col gap-1.5 px-3 border-l border-slate-100 dark:border-slate-800">
                <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Receita</span>
                <Dropdown v-model="filtros.arr" :options="opcoesARR" class="custom-dropdown-minimal" />
              </div>
              <div class="flex flex-col gap-1.5 px-3 border-l border-slate-100 dark:border-slate-800">
                <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">Tempo de Casa</span>
                <Dropdown v-model="filtros.safra" :options="opcoesSafra" class="custom-dropdown-minimal" />
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-sm shrink-0">
                    <i class="pi pi-chart-bar text-lg"></i>
                  </div>
                  <div>
                    <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white leading-none mb-1">NPS por Segmento</h3>
                    <p class="text-[10px] text-slate-400 font-bold leading-tight">Desempenho da carteira por nicho</p>
                  </div>
                </div>
              </div>

              <div class="flex-1 w-full relative min-h-[250px]">
                <div v-if="loadingDados" class="absolute inset-0 flex items-center justify-center">
                    <i class="pi pi-spinner pi-spin text-orange-500 text-3xl opacity-50"></i>
                </div>
                
                <div v-else-if="!chartDataSegmento.datasets || chartDataSegmento.datasets.length === 0" class="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <i class="pi pi-folder-open text-2xl mb-2 opacity-50"></i>
                    <span class="text-[10px] font-bold uppercase tracking-widest">Sem dados para o filtro</span>
                </div>
                
                <Chart 
                  type="bar" 
                  :data="chartDataSegmento" 
                  :options="chartOptionsSegmento" 
                  :plugins="pluginsGlobais" 
                  class="h-full w-full absolute inset-0" 
                />
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm h-[400px]">
                <h3 class="text-xs font-black uppercase tracking-widest mb-4">Matriz de Priorização</h3>
                <Chart type="scatter" :data="dataScatter" :options="optionsScatter" class="h-[300px]" />
              </div>
              <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm h-[400px]">
                <h3 class="text-xs font-black uppercase tracking-widest mb-4">Clientes por Tempo de Casa</h3>
                <Chart type="bar" :data="dataStackedBar" :options="optionsStackedBar" class="h-[300px]" />
              </div>
            </div>

          </div>
        </TabPanel>

        <TabPanel>
          <template #header><i class="pi pi-cog mr-2"></i> Operacional</template>
          
          <div class="space-y-8 mt-6"> 
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
                 <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Taxa de Resposta no Período</span>
                 <div class="text-6xl font-black text-indigo-500">{{ dadosOperacionais.taxa_resposta }}%</div>
                 <p class="text-xs text-slate-500 mt-4 max-w-xs leading-relaxed">Porcentagem de clientes ativos que responderam no período selecionado.</p>
              </div>
              
              <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center">
                 <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Tempo médio para resolver</span>
                 <div class="text-6xl font-black text-emerald-500">{{ dadosOperacionais.sla_medio_dias }} <span class="text-2xl">dias</span></div>
                 <p class="text-xs text-slate-500 mt-4 max-w-xs leading-relaxed">Tempo médio de encerramento de ações corretivas no período.</p>
              </div>
            </div>

            <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                    <i class="pi pi-exclamation-triangle text-rose-500"></i> Clientes que pararam de responder
                  </h3>
                  <p class="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                    Clientes ativos sem qualquer interação recente.
                  </p>
                </div>
                <Tag severity="danger" :value="clientesInativos.length + ' Clientes Críticos'" class="!text-[10px] !font-black uppercase tracking-widest !px-4" />
              </div>

              <DataTable :value="clientesInativos" :loading="loadingInativos" :paginator="true" :rows="10" class="p-datatable-sm custom-table" responsiveLayout="scroll">
                <template #empty>
                   <div class="text-center py-12 text-emerald-500 text-[11px] uppercase tracking-widest font-black">
                     <i class="pi pi-check-circle text-3xl mb-3 block opacity-50"></i>
                     Base saudável no período selecionado.
                   </div>
                </template>
                <Column field="empresa" header="Empresa" sortable>
                  <template #body="sp">
                    <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{{ sp.data.empresa }}</span>
                  </template>
                </Column>
                <Column field="cliente_nome" header="Cliente" sortable>
                  <template #body="sp">
                    <div class="flex flex-col">
                      <span class="font-bold text-xs text-slate-800 dark:text-white">{{ sp.data.cliente_nome }}</span>
                      <span class="text-[10px] font-medium text-slate-400">{{ sp.data.cliente_email }}</span>
                    </div>
                  </template>
                </Column>
                <Column field="data_envio" header="Último Disparo" sortable>
                  <template #body="sp">
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">{{ formatarData(sp.data.data_envio) }}</span>
                  </template>
                </Column>
                <Column field="dias_sem_resposta" header="Atraso (Dias)" sortable>
                  <template #body="sp">
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                      <span class="text-rose-500 font-black text-sm">{{ sp.data.dias_sem_resposta }} dias</span>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header><i class="pi pi-history mr-2"></i> Jornada</template>
          
          <div class="space-y-6 mt-6">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-end">
              <div class="flex-1 space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Auditoria por Empresa</label>
                <Dropdown v-model="empresaSelecionadaJornada" :options="listaEmpresas" filter placeholder="Selecione uma conta..." class="w-full custom-dropdown-premium" />
              </div>
              <Button label="Filtrar Jornada" icon="pi pi-search" @click="buscarJornada" :loading="loadingJornada" class="!bg-slate-900 dark:!bg-white dark:!text-slate-900 !rounded-xl !px-8 !py-3 !font-black !text-xs !uppercase" />
            </div>

            <div v-if="npsEmpresaJornada !== null && historicoJornada.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fadein">
              
              <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
                <div :class="['w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg', 
                              npsEmpresaJornada >= 70 ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 
                              npsEmpresaJornada >= 0 ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-rose-500 text-white shadow-rose-500/20']">
                  {{ npsEmpresaJornada }}
                </div>
                <div>
                  <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400">NPS da Conta</h4>
                  <p class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase truncate max-w-[150px]">
                    {{ empresaSelecionadaJornada }}
                  </p>
                </div>
              </div>

              <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
                <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <i class="pi pi-comments text-2xl"></i>
                </div>
                <div>
                  <h4 class="text-[9px] font-black uppercase tracking-widest text-slate-400">Volume de Respostas</h4>
                  <p class="text-lg font-black text-slate-800 dark:text-white">{{ totalRespostasJornada }} Respostas</p>
                </div>
              </div>

            </div>

            <div v-if="historicoJornada.length > 0" class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <Timeline :value="historicoJornada" align="alternate" class="custom-timeline">
                <template #content="slotProps">
                  <div class="mb-12 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative shadow-sm hover:scale-[1.02] transition-transform">
                    <div class="flex justify-between items-start mb-4">
                      <div class="flex items-center gap-3">
                        <Tag :value="slotProps.item.nota" :severity="getCorNota(slotProps.item.nota)" class="!text-xl !font-black !px-4 !py-2 !rounded-xl" />
                        <div class="text-left">
                          <h4 class="text-sm font-black text-slate-800 dark:text-white">{{ slotProps.item.cliente_nome }}</h4>
                          <p class="text-[10px] font-bold text-slate-400 uppercase">{{ slotProps.item.cargo }}</p>
                        </div>
                      </div>
                      <span class="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">{{ slotProps.item.data_formatada }}</span>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed text-left">
                      "{{ slotProps.item.motivo || 'O cliente não deixou comentários adicionais.' }}"
                    </p>
                    <div class="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex gap-2">
                      <Tag :value="slotProps.item.canal" severity="secondary" class="!text-[8px] !font-black uppercase !px-2" />
                    </div>
                  </div>
                </template>
              </Timeline>
            </div>
            <div v-else-if="!loadingJornada" class="py-20 text-center text-slate-400 italic">
               <i class="pi pi-search text-4xl mb-4 opacity-20"></i>
               <p>Selecione uma empresa e aplique o filtro de data para ver a jornada.</p>
            </div>
          </div>
        </TabPanel>

        <TabPanel>
          <template #header><i class="pi pi-user mr-2"></i> Responsáveis</template>
          
          <div class="space-y-6 mt-6">
            <div class="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-end">
              <div class="flex-1 space-y-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Performance do Responsável</label>
                <Dropdown 
                  v-model="gestorSelecionado" 
                  :options="listaGestores" 
                  optionLabel="nome" 
                  optionValue="id" 
                  filter 
                  placeholder="Selecione um Responsável" 
                  class="w-full custom-dropdown-premium" 
                  @change="carregarPerformanceGestor" 
                />
              </div>
            </div>

            <div v-if="loadingGestor" class="py-20 text-center">
              <i class="pi pi-spin pi-spinner text-4xl text-indigo-500 mb-4"></i>
              <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">Cruzando dados da carteira no período...</p>
            </div>

            <div v-else-if="dadosGestor" class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadein">
              <div class="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
                 <span class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">NPS do Responsável no Período</span>
                 <div class="text-7xl font-black" :class="dadosGestor.nps >= 70 ? 'text-emerald-500' : 'text-orange-500'">
                   {{ dadosGestor.nps }}
                 </div>
                 <Tag :value="dadosGestor.total_respostas + ' respostas filtradas'" severity="secondary" class="mt-4" />
              </div>

              <div class="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                <h3 class="text-xs font-black uppercase tracking-widest mb-6">Média por Empresa na Carteira</h3>
                <Chart v-if="chartGestor" type="bar" :data="chartGestor" :options="optionsChartGestor" class="h-[250px]" />
              </div>

              <div class="lg:col-span-3 grid grid-cols-3 gap-4">
                <div class="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 text-center">
                  <div class="text-2xl font-black text-emerald-600">{{ dadosGestor.distribuicao.promotores }}</div>
                  <div class="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Promotores</div>
                </div>
                <div class="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-800/50 text-center">
                  <div class="text-2xl font-black text-amber-600">{{ dadosGestor.distribuicao.neutros }}</div>
                  <div class="text-[9px] font-black uppercase text-amber-500 tracking-widest">Neutros</div>
                </div>
                <div class="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-800/50 text-center">
                  <div class="text-2xl font-black text-rose-600">{{ dadosGestor.distribuicao.detratores }}</div>
                  <div class="text-[9px] font-black uppercase text-rose-500 tracking-widest">Detratores</div>
                </div>
              </div>
            </div>

            <div v-else class="py-20 text-center text-slate-400 italic">
               <p>Selecione um responsável e o período desejado no topo.</p>
            </div>
          </div>
        </TabPanel>

      </TabView>
    </div>
  </div>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";

/* --- ANIMAÇÕES --- */
.animate-fadein { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* ==========================================
   🌟 ESTRUTURA GLOBAL E ABAS (PADRÃO AUDIÊNCIA)
   ========================================== */

/* Torna o fundo das abas transparente para herdar o bg da página */
:deep(.p-tabview), 
:deep(.p-tabview-nav-container), 
:deep(.p-tabview-nav-content), 
:deep(.p-tabview-nav),
:deep(.p-tabview-panels) {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    padding: 0 !important;
}

/* Estilização das abas como "Pílulas" Modernas */
:deep(.p-tabview-nav li .p-tabview-nav-link) {
    @apply bg-white dark:bg-slate-900 text-slate-500 !important;
    border: none !important; 
    border-radius: 12px !important;
    padding: 10px 20px !important;
    margin-right: 8px !important;
    transition: all 0.3s ease !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important;
}

:deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
    @apply bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 !important;
}

/* Padronização de Cards no Dark Mode */
.bg-white {
    @apply dark:bg-slate-900 border-slate-100 dark:border-slate-800 !important;
}

/* ==========================================
   📅 CALENDÁRIO PREMIUM (PADRÃO DASHBOARD)
   ========================================== */

:deep(.custom-calendar-premium) {
  @apply border-none shadow-none !important;
}

:deep(.custom-calendar-premium .p-inputtext) {
  @apply border-none bg-transparent text-[11px] font-black uppercase text-slate-700 dark:text-slate-100 w-44 py-1 px-3 shadow-none focus:ring-0 !important;
}

:deep(.custom-calendar-premium .p-inputtext::placeholder) {
  @apply text-slate-400 dark:text-slate-500 font-bold !important;
}

/* Painel flutuante do Calendário (DatePicker) */
:deep(.p-datepicker) {
  @apply border-none shadow-2xl rounded-2xl bg-white dark:bg-slate-900 !important;
}

:deep(.p-datepicker table td > span.p-highlight) {
  @apply bg-indigo-500 text-white !important;
}

/* ==========================================
   📍 TIMELINE E OUTROS COMPONENTES
   ========================================== */

:deep(.custom-dropdown-minimal) {
  @apply !bg-transparent !border-none !shadow-none !p-0 !text-[11px] font-black uppercase text-slate-800 dark:text-white !important;
}

:deep(.p-timeline-event-marker) {
  @apply border-2 border-indigo-500 bg-white dark:bg-slate-900 !important;
}

:deep(.p-timeline-event-connector) {
  @apply bg-slate-200 dark:bg-slate-800;
}
</style>