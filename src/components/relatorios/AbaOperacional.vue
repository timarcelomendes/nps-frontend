<script setup>
// Aba "Operação": taxa de resposta, tempo para concluir planos de ação e clientes sem pesquisa recente.
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import api from '../../services/api';
import KpiCard from '../dashboard/KpiCard.vue';
import FiltroPeriodo from './FiltroPeriodo.vue';

const props = defineProps({
  filtros: { type: Object, required: true },
  periodo: { type: Array, default: null },
});
const emit = defineEmits(['update:periodo']);
const toast = useToast();

const carregando = ref(true);
const dados = ref({ taxa_resposta: 0, sla_medio_dias: 0 });
const carregarIndicadores = async () => {
  carregando.value = true;
  try {
    const res = await api.get('/reports/operacional', { params: props.filtros });
    dados.value = res.data;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Não foi possível carregar os indicadores', life: 4000 });
  } finally {
    carregando.value = false;
  }
};

// O servidor devolve todos os clientes ativos, do envio mais antigo para o mais recente.
const carregandoClientes = ref(false);
const clientes = ref([]);
const recorrencia = ref(90);
const verTodos = ref(false);
const carregarClientes = async () => {
  carregandoClientes.value = true;
  try {
    const res = await api.get('/reports/operacional/inativos', { params: props.filtros });
    clientes.value = res.data.lista || [];
    recorrencia.value = res.data.recorrencia_dias ?? 90;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Não foi possível carregar a lista de clientes', life: 4000 });
  } finally {
    carregandoClientes.value = false;
  }
};
const atrasado = (c) => c.dias_sem_resposta === null || c.dias_sem_resposta === undefined || c.dias_sem_resposta > recorrencia.value;
const atrasados = computed(() => clientes.value.filter(atrasado));
const lista = computed(() => (verTodos.value ? clientes.value : atrasados.value));

const dataCurta = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');
const semSla = computed(() => !dados.value.sla_medio_dias);

// Só os indicadores dependem do período; a lista de clientes mostra a situação atual.
watch(() => `${props.filtros.data_inicio}|${props.filtros.data_fim}`, carregarIndicadores);
onMounted(() => { carregarIndicadores(); carregarClientes(); });
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <FiltroPeriodo :modelValue="periodo" @update:modelValue="emit('update:periodo', $event)" />
      <span class="text-sm text-slate-500 dark:text-slate-400">O período vale para os dois indicadores abaixo.</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4" :class="{ 'opacity-60': carregando }">
      <KpiCard titulo="Taxa de resposta" icone="pi pi-inbox" ajuda="Clientes ativos que responderam no período, dividido por todos os clientes ativos.">
        <span class="text-4xl font-black text-slate-900 dark:text-white">{{ String(dados.taxa_resposta).replace('.', ',') }}%</span>
        <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div class="h-full bg-orange-500" :style="{ width: Math.min(100, dados.taxa_resposta) + '%' }"></div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">dos clientes ativos responderam no período.</p>
      </KpiCard>

      <KpiCard titulo="Tempo para concluir planos de ação" icone="pi pi-clock" ajuda="Média entre a criação e a conclusão dos planos de ação concluídos no período.">
        <template v-if="!semSla">
          <span class="text-4xl font-black text-slate-900 dark:text-white">{{ String(dados.sla_medio_dias).replace('.', ',') }} <span class="text-lg font-bold text-slate-500">{{ dados.sla_medio_dias === 1 ? 'dia' : 'dias' }}</span></span>
          <p class="text-sm text-slate-500 dark:text-slate-400">em média, da criação à conclusão.</p>
        </template>
        <p v-else class="text-sm text-slate-500 dark:text-slate-400 py-3">Nenhum plano de ação concluído no período.</p>
      </KpiCard>
    </div>

    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div class="min-w-0">
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Clientes sem pesquisa recente</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Clientes ativos que nunca receberam pesquisa ou cujo último envio passou de {{ recorrencia }} dias (sua regra de reenvio). Situação de hoje.</p>
        </div>
        <span v-if="!carregandoClientes" class="shrink-0 px-3 py-1 rounded-full text-sm font-semibold"
          :class="atrasados.length ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'">
          {{ atrasados.length }} {{ atrasados.length === 1 ? 'cliente' : 'clientes' }}
        </span>
      </div>

      <DataTable :value="lista" :loading="carregandoClientes" paginator :rows="10" :alwaysShowPaginator="false" class="p-datatable-sm tabela-clientes">
        <template #empty>
          <p class="text-center py-8 text-sm text-slate-500">
            <i class="pi pi-check-circle text-emerald-500 mr-1"></i>
            {{ clientes.length ? 'Todos os clientes ativos receberam pesquisa dentro do prazo.' : 'Nenhum cliente ativo cadastrado.' }}
          </p>
        </template>
        <Column field="cliente_nome" header="Cliente" sortable>
          <template #body="{ data }">
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ data.cliente_nome }}</p>
            <p class="text-xs text-slate-500 break-all">{{ data.cliente_email }}</p>
            <p v-if="data.empresa !== 'Sem Empresa'" class="text-xs text-slate-500 md:hidden">{{ data.empresa }}</p>
          </template>
        </Column>
        <Column field="empresa" header="Empresa" sortable headerClass="hidden md:table-cell" bodyClass="hidden md:table-cell">
          <template #body="{ data }">
            <span class="text-sm text-slate-600 dark:text-slate-300">{{ data.empresa === 'Sem Empresa' ? '—' : data.empresa }}</span>
          </template>
        </Column>
        <Column field="dias_sem_resposta" header="Último envio" sortable>
          <template #body="{ data }">
            <span v-if="data.dias_sem_resposta === null || data.dias_sem_resposta === undefined" class="text-sm font-semibold text-rose-600 dark:text-rose-400">Nunca recebeu</span>
            <template v-else>
              <p class="text-sm font-semibold" :class="atrasado(data) ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'">
                {{ data.dias_sem_resposta === 0 ? 'Hoje' : `Há ${data.dias_sem_resposta} ${data.dias_sem_resposta === 1 ? 'dia' : 'dias'}` }}
              </p>
              <p class="text-xs text-slate-500">{{ dataCurta(data.data_envio) }}</p>
            </template>
          </template>
        </Column>
      </DataTable>

      <button v-if="!carregandoClientes && clientes.length > atrasados.length" type="button" @click="verTodos = !verTodos"
        class="mt-3 text-sm font-semibold text-orange-600 hover:underline">
        {{ verTodos ? 'Mostrar só os que precisam de envio' : `Mostrar todos os ${clientes.length} clientes ativos` }}
      </button>
    </section>
  </div>
</template>

<style scoped>
:deep(.tabela-clientes .p-datatable-thead > tr > th) { font-size: 0.8125rem; }
</style>
