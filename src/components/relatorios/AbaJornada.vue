<script setup>
// Aba "Histórico de uma empresa": todas as respostas de uma empresa, da mais recente para a mais antiga.
import { ref, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dropdown from 'primevue/dropdown';
import api from '../../services/api';
import FiltroPeriodo from './FiltroPeriodo.vue';
import { corNps, resumoNps, corNota } from './cores';

const props = defineProps({
  filtros: { type: Object, required: true },
  periodo: { type: Array, default: null },
});
const emit = defineEmits(['update:periodo']);
const toast = useToast();

const empresas = ref([]);
const empresa = ref(null);
const carregando = ref(false);
const resultado = ref(null); // { nps, total, historico }

let versao = 0;
const buscar = async () => {
  if (!empresa.value) return;
  const minha = ++versao;
  carregando.value = true;
  try {
    const res = await api.get('/reports/jornada', { params: { empresa: empresa.value, ...props.filtros } });
    if (minha !== versao) return;
    resultado.value = { nps: res.data.nps_atual, total: res.data.total_respostas || 0, historico: res.data.historico || [] };
  } catch (e) {
    if (minha === versao) toast.add({ severity: 'error', summary: 'Não foi possível carregar o histórico', life: 4000 });
  } finally {
    if (minha === versao) carregando.value = false;
  }
};

watch(empresa, buscar);
watch(() => `${props.filtros.data_inicio}|${props.filtros.data_fim}`, buscar);
onMounted(() => {
  api.get('/cadastros/empresas').then(res => { empresas.value = res.data.map(e => e.nome); }).catch(() => {});
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row md:items-end gap-3">
      <label class="flex flex-col gap-1 flex-1 min-w-0">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresa</span>
        <Dropdown v-model="empresa" :options="empresas" filter filterPlaceholder="Buscar empresa" placeholder="Escolha uma empresa" emptyMessage="Nenhuma empresa cadastrada" class="w-full campo" />
      </label>
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Período</span>
        <FiltroPeriodo :modelValue="periodo" @update:modelValue="emit('update:periodo', $event)" />
      </div>
    </div>

    <div v-if="!empresa" class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
      <i class="pi pi-building text-2xl text-slate-400"></i>
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">Escolha uma empresa para ver o histórico</p>
      <p class="text-sm text-slate-500 mt-1">Você verá o NPS dela e cada resposta, com nota e comentário, em ordem de data.</p>
    </div>

    <div v-else-if="carregando && !resultado" class="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>

    <template v-else-if="resultado">
      <div v-if="!resultado.total" class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center" :class="{ 'opacity-60': carregando }">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ empresa }} ainda não tem respostas{{ periodo ? ' neste período' : '' }}.</p>
        <p v-if="periodo" class="text-sm text-slate-500 mt-1">Tente ampliar o período ou limpar as datas.</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start" :class="{ 'opacity-60': carregando }">
        <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-2 lg:sticky lg:top-4">
          <p class="text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">{{ empresa }}</p>
          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-black" :class="corNps(resultado.nps)">{{ resultado.nps }}</span>
            <span class="text-sm text-slate-500">NPS · {{ resumoNps(resultado.nps) }}</span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ resultado.total }} {{ resultado.total === 1 ? 'resposta' : 'respostas' }}{{ periodo ? ' no período' : ' no total' }}</p>
        </section>

        <section class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 class="text-base font-bold text-slate-900 dark:text-white mb-4">Respostas, da mais recente para a mais antiga</h2>
          <ol class="flex flex-col">
            <li v-for="(r, i) in resultado.historico" :key="i" class="relative flex gap-3 pb-5 last:pb-0">
              <span v-if="i < resultado.historico.length - 1" class="absolute left-5 top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-700"></span>
              <span :class="['w-10 h-10 shrink-0 rounded-xl text-base font-black flex items-center justify-center', corNota(r.nota)]" title="Nota de 0 a 10">{{ r.nota }}</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm">
                  <b class="text-slate-800 dark:text-slate-100">{{ r.cliente_nome || 'Cliente sem nome' }}</b>
                  <span v-if="r.cargo && r.cargo !== 'Sem Cargo'" class="text-slate-500"> · {{ r.cargo }}</span>
                </p>
                <p class="text-xs text-slate-500">{{ r.data_formatada }}<span v-if="r.canal"> · via {{ r.canal }}</span></p>
                <p v-if="r.motivo" class="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line">{{ r.motivo }}</p>
                <p v-else class="text-sm text-slate-400 italic mt-1">Sem comentário.</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
@reference "../../style.css";
/* Mesma aparência dos outros campos, também no modo escuro */
:deep(.campo.p-dropdown) { @apply rounded-xl! border-slate-200! dark:border-slate-700! bg-white! dark:bg-slate-900! shadow-none!; }
:deep(.campo .p-dropdown-label) { @apply text-sm! py-2.5! text-slate-700! dark:text-slate-200! bg-transparent!; }
:deep(.campo .p-dropdown-trigger) { @apply bg-transparent! text-slate-400!; }
</style>
