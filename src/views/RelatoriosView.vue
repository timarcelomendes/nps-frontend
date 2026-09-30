<script setup>
/**
 * Relatórios. Cada aba responde a uma pergunta do dono do negócio:
 *   - Por grupo de clientes: quais segmentos / tempos de casa estão piores e o que resolver primeiro
 *   - Operação: a pesquisa está chegando e os problemas estão sendo resolvidos?
 *   - Histórico de uma empresa: o que uma empresa específica respondeu ao longo do tempo
 *   - Por responsável: como está a carteira de cada pessoa da equipe
 * As abas só carregam quando abertas e guardam o estado ao alternar.
 */
import { ref, shallowRef, computed, watch } from 'vue';
import { dataISO } from '../utils/formatters';
import AbaEstrategica from '../components/relatorios/AbaEstrategica.vue';
import AbaOperacional from '../components/relatorios/AbaOperacional.vue';
import AbaJornada from '../components/relatorios/AbaJornada.vue';
import AbaResponsaveis from '../components/relatorios/AbaResponsaveis.vue';

const ABAS = [
  { chave: 'grupos', rotulo: 'Por grupo de clientes', icone: 'pi pi-chart-bar', componente: AbaEstrategica, editaFiltros: true },
  { chave: 'operacao', rotulo: 'Operação', icone: 'pi pi-cog', componente: AbaOperacional, periodo: true },
  { chave: 'empresa', rotulo: 'Histórico de uma empresa', icone: 'pi pi-history', componente: AbaJornada, periodo: true },
  { chave: 'responsavel', rotulo: 'Por responsável', icone: 'pi pi-user', componente: AbaResponsaveis },
];
const aba = shallowRef(ABAS[0]);

// Filtros enviados às APIs (mesmos parâmetros de sempre). Período vazio = todo o histórico.
const periodo = ref(null);
const filtros = ref({ segmento: 'Todos', arr: 'Todos', safra: 'Todos', data_inicio: null, data_fim: null });

watch(periodo, (p) => {
  if (p && !(p[0] && p[1])) return; // ainda escolhendo a segunda data
  filtros.value = { ...filtros.value, data_inicio: p ? dataISO(p[0]) : null, data_fim: p ? dataISO(p[1]) : null };
});

// Cada aba recebe só o que usa
const propsDaAba = computed(() => {
  const a = aba.value;
  const p = { filtros: filtros.value };
  if (a.editaFiltros) p['onUpdate:filtros'] = (v) => { filtros.value = v; };
  if (a.periodo) Object.assign(p, { periodo: periodo.value, 'onUpdate:periodo': (v) => { periodo.value = v; } });
  return p;
});
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-6 pb-24">
    <header>
      <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Relatórios<span class="text-orange-500">.</span></h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Olhe seus resultados por grupo de clientes, por empresa ou por responsável.</p>
    </header>

    <nav role="tablist" aria-label="Tipo de relatório" class="grid grid-cols-2 md:flex md:flex-wrap gap-2">
      <button v-for="a in ABAS" :key="a.chave" type="button" role="tab" :aria-selected="aba.chave === a.chave" @click="aba = a"
        class="flex items-center justify-center md:justify-start gap-2 min-h-10 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors text-center"
        :class="aba.chave === a.chave
          ? 'bg-orange-500 border-orange-500 text-white'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:text-orange-600'">
        <i :class="[a.icone, 'text-sm']"></i>{{ a.rotulo }}
      </button>
    </nav>

    <KeepAlive>
      <component :is="aba.componente" :key="aba.chave" v-bind="propsDaAba" />
    </KeepAlive>
  </div>
</template>
