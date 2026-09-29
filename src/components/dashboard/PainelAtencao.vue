<script setup>
// "Precisa de atenção": o que o gestor deve resolver hoje.
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { diasAtras } from '../../utils/formatters';

const props = defineProps({
  ranking: { type: Array, default: () => [] },
  acoesAbertas: { type: Number, default: 0 },
  acoesVencidas: { type: Number, default: 0 },
  quedas: { type: Number, default: 0 },
  emRisco: { type: Number, default: 0 },
  receitaEmRisco: { type: Number, default: 0 },
});
const emit = defineEmits(['ver-risco']);
const router = useRouter();

const vencida = (item) => item.acao_prazo && new Date(item.acao_prazo) < new Date();

// Empresas com ação em aberto: vencidas primeiro, depois as mais antigas
const pendencias = computed(() => props.ranking
  .filter(i => i.ativo !== 0 && i.acao_id && i.acao_status && i.acao_status !== 'Concluído')
  .sort((a, b) => (vencida(b) - vencida(a)) || (new Date(a.acao_criada_em) - new Date(b.acao_criada_em)))
  .slice(0, 5));

const tudoEmDia = computed(() => !pendencias.value.length && !props.acoesAbertas && !props.emRisco);
const corNps = (n) => (n >= 50 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  : n > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400');
const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const tratar = (item) => router.push({ path: '/acoes', query: item.acao_id ? { abrir: item.acao_id } : { empresa: item.nome } });
</script>

<template>
  <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
    <header class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
      <div>
        <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i class="pi pi-flag text-orange-500"></i> Precisa de atenção
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">O que resolver primeiro para não perder clientes.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <button v-if="acoesVencidas" @click="router.push('/acoes')" class="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 font-semibold">
          <i class="pi pi-clock mr-1 text-xs"></i>{{ acoesVencidas }} {{ acoesVencidas === 1 ? 'ação vencida' : 'ações vencidas' }}
        </button>
        <button @click="router.push('/acoes')" class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700">
          {{ acoesAbertas }} {{ acoesAbertas === 1 ? 'ação aberta' : 'ações abertas' }} <i class="pi pi-arrow-right ml-1 text-xs"></i>
        </button>
      </div>
    </header>

    <div v-if="tudoEmDia" class="px-5 py-8 flex items-center gap-4">
      <span class="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0"><i class="pi pi-check"></i></span>
      <div>
        <p class="font-semibold text-slate-800 dark:text-slate-100">Tudo em dia</p>
        <p class="text-sm text-slate-500">Nenhum cliente com pendência aberta neste período.</p>
      </div>
    </div>

    <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
      <li v-for="item in pendencias" :key="item.nome" class="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <span :class="['w-12 shrink-0 text-center rounded-lg py-1.5 text-sm font-bold', corNps(item.nps)]" v-tooltip.top="'NPS da empresa no período'">{{ item.nps }}</span>
          <div class="min-w-0">
            <p class="font-semibold text-slate-800 dark:text-slate-100 truncate">{{ item.nome }}</p>
            <p class="text-sm text-slate-500 flex flex-wrap gap-x-2">
              <span>Ação aberta {{ diasAtras(item.acao_criada_em) }}</span>
              <span v-if="vencida(item)" class="text-rose-600 font-semibold">· prazo vencido</span>
              <span v-if="item.gestor">· {{ item.gestor }}</span>
            </p>
            <p v-if="item.ultimo_comentario" class="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 italic">"{{ item.ultimo_comentario }}"</p>
          </div>
        </div>
        <button @click="tratar(item)" class="self-start sm:self-center shrink-0 h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">
          Tratar
        </button>
      </li>

      <li v-if="emRisco" class="px-5 py-3">
        <button @click="emit('ver-risco')" class="w-full flex items-center gap-3 text-left text-sm">
          <span class="w-12 shrink-0 text-center"><i class="pi pi-arrow-down-right text-rose-500"></i></span>
          <span class="flex-1 text-slate-700 dark:text-slate-200">
            <b>{{ emRisco }}</b> {{ emRisco === 1 ? 'cliente deixou' : 'clientes deixaram' }} de ser promotor<span v-if="quedas"> ({{ quedas }} {{ quedas === 1 ? 'virou detrator' : 'viraram detratores' }})</span>
          </span>
          <span class="text-orange-600 font-semibold">Ver quem <i class="pi pi-angle-right text-xs"></i></span>
        </button>
      </li>
      <li v-if="receitaEmRisco > 0" class="px-5 py-3 text-sm flex items-center gap-3">
        <span class="w-12 shrink-0 text-center"><i class="pi pi-wallet text-rose-500"></i></span>
        <span class="text-slate-700 dark:text-slate-200"><b>{{ moeda(receitaEmRisco) }}</b> em contratos de empresas com detratores no período</span>
      </li>
    </ul>
  </section>
</template>
