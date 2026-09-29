<script setup>
// Síntese da IA. Só chama a API quando a pessoa clica (cada análise conta no limite mensal).
// O resultado fica guardado no navegador por conta + filtro + dia.
import { ref, watch, onUnmounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import api from '../../services/api';
import { contaAtualId } from '../../utils/formatters';

const props = defineProps({ filtros: { type: String, default: '' } });
const toast = useToast();

const resultado = ref(null);
const geradaEm = ref(null);
const carregando = ref(false);
const espera = ref(0);
let timer = null;

const chave = () => `rakiti_ia_${contaAtualId() ?? 'x'}_${props.filtros}_${new Date().toISOString().slice(0, 10)}`;

const lerCache = () => {
  resultado.value = null;
  geradaEm.value = null;
  try {
    const salvo = JSON.parse(localStorage.getItem(chave()) || 'null');
    if (salvo?.insights) { resultado.value = salvo.insights; geradaEm.value = salvo.em; }
  } catch (e) { /* sem cache */ }
};

const gerar = async () => {
  carregando.value = true;
  try {
    const { data } = await api.get(`/dashboard/magic-ai${props.filtros}`);
    if (data.status === 'success' && data.insights?.arder) {
      resultado.value = data.insights;
      geradaEm.value = new Date().toISOString();
      try { localStorage.setItem(chave(), JSON.stringify({ insights: data.insights, em: geradaEm.value })); } catch (e) { /* cheio */ }
      espera.value = 30;
      clearInterval(timer);
      timer = setInterval(() => { espera.value -= 1; if (espera.value <= 0) clearInterval(timer); }, 1000);
    } else {
      toast.add({ severity: 'warn', summary: 'Análise indisponível', detail: data.insights?.recomendacao || 'Tente novamente mais tarde.', life: 5000 });
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro na análise', detail: e.response?.data?.detail || 'A IA não respondeu. Tente de novo.', life: 5000 });
  } finally {
    carregando.value = false;
  }
};

watch(() => props.filtros, lerCache, { immediate: true });
onUnmounted(() => clearInterval(timer));

const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const BLOCOS = [
  { chave: 'arder', titulo: 'O que precisa melhorar', icone: 'pi pi-exclamation-circle', cor: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' },
  { chave: 'amar', titulo: 'O que está funcionando', icone: 'pi pi-heart', cor: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  { chave: 'recomendacao', titulo: 'Próximo passo sugerido', icone: 'pi pi-directions', cor: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10' },
];
</script>

<template>
  <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
    <header class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"><i class="pi pi-sparkles text-orange-500"></i> Resumo da IA</h2>
        <p class="text-sm text-slate-500">
          <template v-if="geradaEm">Gerado hoje às {{ hora(geradaEm) }} com os filtros atuais.</template>
          <template v-else>Lê os comentários do período e resume em três frases.</template>
        </p>
      </div>
      <button @click="gerar" :disabled="carregando || espera > 0"
        class="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
        <i :class="['pi mr-1 text-xs', carregando ? 'pi-spin pi-spinner' : 'pi-sparkles']"></i>
        {{ carregando ? 'Analisando...' : espera > 0 ? `Aguarde ${espera}s` : resultado ? 'Gerar de novo' : 'Gerar resumo' }}
      </button>
    </header>

    <div v-if="resultado" class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div v-for="b in BLOCOS" :key="b.chave" class="rounded-xl border border-slate-100 dark:border-slate-800 p-4">
        <p class="text-sm font-semibold flex items-center gap-2 mb-2 text-slate-700 dark:text-slate-200">
          <span :class="['w-7 h-7 rounded-lg flex items-center justify-center', b.cor]"><i :class="[b.icone, 'text-xs']"></i></span>{{ b.titulo }}
        </p>
        <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{{ resultado[b.chave] }}</p>
      </div>
    </div>
    <p v-else-if="!carregando" class="text-sm text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4">
      Clique em <b>Gerar resumo</b> quando quiser. Cada resumo conta no limite mensal de análises de IA do seu plano.
    </p>
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div v-for="i in 3" :key="i" class="h-28 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    </div>
  </section>
</template>
