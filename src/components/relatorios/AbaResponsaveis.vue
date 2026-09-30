<script setup>
// Aba "Por responsável": NPS da carteira de um responsável e a nota média de cada empresa dela.
// Obs.: o servidor considera todo o histórico (não recebe período nem outros filtros).
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dropdown from 'primevue/dropdown';
import api from '../../services/api';
import { corNps, resumoNps, barraNota } from './cores';

const props = defineProps({ filtros: { type: Object, required: true } });
const toast = useToast();

const gestores = ref([]);
const gestor = ref(null);
const carregando = ref(false);
const dados = ref(null);

let versao = 0;
const carregar = async () => {
  if (!gestor.value) return;
  const minha = ++versao;
  carregando.value = true;
  try {
    const res = await api.get('/reports/gestor', { params: { gestor_id: gestor.value, ...props.filtros } });
    if (minha === versao) dados.value = res.data;
  } catch (e) {
    if (minha === versao) toast.add({ severity: 'error', summary: 'Não foi possível carregar os dados do responsável', life: 4000 });
  } finally {
    if (minha === versao) carregando.value = false;
  }
};

const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);
const distribuicao = computed(() => {
  const d = dados.value?.distribuicao || {};
  const t = dados.value?.total_respostas || 0;
  return [
    { rotulo: 'Promotores', valor: d.promotores || 0, pct: pct(d.promotores, t), cor: 'bg-emerald-500', texto: 'text-emerald-600 dark:text-emerald-400' },
    { rotulo: 'Neutros', valor: d.neutros || 0, pct: pct(d.neutros, t), cor: 'bg-amber-400', texto: 'text-amber-600 dark:text-amber-400' },
    { rotulo: 'Detratores', valor: d.detratores || 0, pct: pct(d.detratores, t), cor: 'bg-rose-500', texto: 'text-rose-600 dark:text-rose-400' },
  ];
});
const nps = computed(() => Math.round(dados.value?.nps || 0));
const media = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

onMounted(() => {
  api.get('/reports/lista-gestores').then(res => { gestores.value = res.data; }).catch(() => {});
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-2">
      <label class="flex flex-col gap-1 min-w-0 md:max-w-md">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Responsável</span>
        <Dropdown v-model="gestor" :options="gestores" optionLabel="nome" optionValue="id" filter filterPlaceholder="Buscar responsável"
          placeholder="Escolha um responsável" emptyMessage="Nenhum responsável cadastrado" class="w-full campo" @change="carregar" />
      </label>
      <p class="text-sm text-slate-500 dark:text-slate-400"><i class="pi pi-info-circle text-xs mr-1"></i>Considera todas as respostas das empresas que a pessoa atende.</p>
    </div>

    <div v-if="!gestor" class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
      <i class="pi pi-user text-2xl text-slate-400"></i>
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-2">Escolha um responsável</p>
      <p class="text-sm text-slate-500 mt-1">Você verá o NPS da carteira dele e como cada empresa atendida avalia o serviço.</p>
    </div>

    <div v-else-if="carregando && !dados" class="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>

    <div v-else-if="dados && !dados.total_respostas" class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center" :class="{ 'opacity-60': carregando }">
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">As empresas deste responsável ainda não têm respostas.</p>
      <p v-if="dados.ranking_empresas?.length" class="text-sm text-slate-500 mt-1">{{ dados.ranking_empresas.length }} {{ dados.ranking_empresas.length === 1 ? 'empresa' : 'empresas' }} na carteira.</p>
      <p v-else class="text-sm text-slate-500 mt-1">Nenhuma empresa está atribuída a esta pessoa.</p>
    </div>

    <div v-else-if="dados" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start" :class="{ 'opacity-60': carregando }">
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3">
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">NPS da carteira</p>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-black" :class="corNps(nps)">{{ nps }}</span>
          <span class="text-sm text-slate-500">{{ resumoNps(nps) }}</span>
        </div>
        <div class="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div v-for="d in distribuicao" :key="d.rotulo" :class="d.cor" :style="{ width: d.pct + '%' }"></div>
        </div>
        <ul class="flex flex-col gap-1 text-sm">
          <li v-for="d in distribuicao" :key="d.rotulo" class="flex justify-between">
            <span class="text-slate-600 dark:text-slate-300"><i :class="['inline-block w-2 h-2 rounded-full mr-2', d.cor]"></i>{{ d.rotulo }}</span>
            <span><b :class="d.texto">{{ d.valor }}</b> <span class="text-slate-400 text-xs">({{ d.pct }}%)</span></span>
          </li>
        </ul>
        <p class="text-xs text-slate-500">{{ dados.total_respostas }} {{ dados.total_respostas === 1 ? 'resposta' : 'respostas' }} no total</p>
      </section>

      <section class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">Nota média por empresa</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Média das notas de 0 a 10 de cada empresa da carteira.</p>
        <ul class="flex flex-col gap-3">
          <li v-for="e in dados.ranking_empresas" :key="e.nome">
            <div class="flex items-center justify-between gap-2 text-sm mb-1">
              <span class="font-semibold text-slate-700 dark:text-slate-200 truncate">{{ e.nome }}</span>
              <span v-if="e.qtd_respostas" class="shrink-0"><b class="text-slate-900 dark:text-white">{{ media(e.media_nota) }}</b> <span class="text-slate-400 text-xs">· {{ e.qtd_respostas }} {{ e.qtd_respostas === 1 ? 'resposta' : 'respostas' }}</span></span>
              <span v-else class="shrink-0 text-xs text-slate-400">Sem respostas</span>
            </div>
            <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div v-if="e.qtd_respostas" class="h-full rounded-full" :class="barraNota(e.media_nota)" :style="{ width: Math.max(4, e.media_nota * 10) + '%' }"></div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
@reference "../../style.css";
/* Mesma aparência dos outros campos, também no modo escuro */
:deep(.campo.p-dropdown) { @apply rounded-xl! border-slate-200! dark:border-slate-700! bg-white! dark:bg-slate-900! shadow-none!; }
:deep(.campo .p-dropdown-label) { @apply text-sm! py-2.5! text-slate-700! dark:text-slate-200! bg-transparent!; }
:deep(.campo .p-dropdown-trigger) { @apply bg-transparent! text-slate-400!; }
</style>
