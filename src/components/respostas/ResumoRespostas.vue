<script setup>
// Resumo das respostas que estão na lista (respeita os filtros).
import { computed } from 'vue';

const props = defineProps({
  metricas: { type: Object, required: true }, // { total, nps, promotores, neutros, detratores }
});

const pct = (n) => (props.metricas.total ? Math.round((n / props.metricas.total) * 100) : 0);
const corNps = computed(() => (props.metricas.nps >= 50 ? 'text-emerald-600 dark:text-emerald-400'
  : props.metricas.nps > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'));

const grupos = computed(() => [
  { rotulo: 'Promotores', faixa: 'notas 9 e 10', valor: props.metricas.promotores, texto: 'text-emerald-600 dark:text-emerald-400', barra: 'bg-emerald-500' },
  { rotulo: 'Neutros', faixa: 'notas 7 e 8', valor: props.metricas.neutros, texto: 'text-amber-600 dark:text-amber-400', barra: 'bg-amber-400' },
  { rotulo: 'Detratores', faixa: 'notas 0 a 6', valor: props.metricas.detratores, texto: 'text-rose-600 dark:text-rose-400', barra: 'bg-rose-500' },
]);
</script>

<template>
  <section class="grid grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
    <div class="col-span-3 lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col gap-3">
      <span class="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
        NPS das respostas abaixo
        <i class="pi pi-info-circle text-slate-300 dark:text-slate-600 text-sm" v-tooltip.top="'% de promotores menos % de detratores. Vai de -100 a 100.'"></i>
      </span>
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-black" :class="corNps">{{ metricas.nps }}</span>
        <span class="text-sm text-slate-500 dark:text-slate-400">{{ metricas.total }} {{ metricas.total === 1 ? 'resposta' : 'respostas' }}</span>
      </div>
      <div class="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div v-for="g in grupos" :key="g.rotulo" :class="g.barra" :style="{ width: pct(g.valor) + '%' }"></div>
      </div>
    </div>

    <div v-for="g in grupos" :key="g.rotulo"
      class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 md:p-5 flex flex-col gap-1 min-w-0">
      <span class="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">{{ g.rotulo }}</span>
      <div class="flex items-baseline gap-1.5 flex-wrap">
        <span class="text-2xl md:text-3xl font-black" :class="g.texto">{{ g.valor }}</span>
        <span class="text-xs md:text-sm text-slate-500 dark:text-slate-400">{{ pct(g.valor) }}%</span>
      </div>
      <span class="text-xs text-slate-500 dark:text-slate-400">{{ g.faixa }}</span>
    </div>
  </section>
</template>
