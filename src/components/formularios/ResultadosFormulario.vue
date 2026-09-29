<script setup>
import { ref, watch, onMounted } from 'vue';
import api from '../../services/api';
import { infoTipo, exemplo } from './tipos';

const props = defineProps({
  formularioId: { type: [Number, String], required: true },
  empresa: { type: String, default: '' },
  cor: { type: String, default: '#f97316' },
});

const dias = ref(90);
const dados = ref(null);
const carregando = ref(false);
const baixando = ref(false);
const abertos = ref({});

const carregar = async () => {
  carregando.value = true;
  try {
    dados.value = (await api.get(`/formularios/${props.formularioId}/resultados`, { params: { dias: dias.value } })).data;
  } finally {
    carregando.value = false;
  }
};

const baixarCsv = async () => {
  baixando.value = true;
  try {
    const res = await api.get(`/formularios/${props.formularioId}/resultados.csv`, { params: { dias: dias.value }, responseType: 'blob' });
    const nome = (res.headers['content-disposition'] || '').match(/filename="([^"]+)"/)?.[1] || 'respostas.csv';
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
  } finally {
    baixando.value = false;
  }
};

const pct = (v, total) => (total ? Math.round((v / total) * 100) : 0);
const maxDist = (d) => Math.max(1, ...Object.values(d || {}));
const somaContagem = (c) => Object.values(c || {}).reduce((a, b) => a + b, 0);
const corBarra = (tipo, n) => {
  if (tipo === 'nps') return n <= 6 ? '#ef4444' : n <= 8 ? '#f59e0b' : '#10b981';
  if (tipo === 'csat' || tipo === 'estrelas') return n <= 2 ? '#ef4444' : n === 3 ? '#f59e0b' : '#10b981';
  return props.cor;
};
const dataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const formatar = (v) => (Array.isArray(v) ? v.join(', ') : v);
const tituloPergunta = (id) => {
  const q = dados.value?.perguntas.find(x => x.id === id);
  return q ? exemplo(q.titulo, props.empresa) : id;
};

watch(dias, carregar);
onMounted(carregar);
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-500">Período:</span>
        <select v-model.number="dias" class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm px-2 py-1.5">
          <option :value="7">7 dias</option><option :value="30">30 dias</option><option :value="90">90 dias</option>
          <option :value="365">12 meses</option><option :value="3650">Tudo</option>
        </select>
        <span v-if="dados" class="text-sm font-bold text-slate-700 dark:text-slate-200 ml-2">{{ dados.total }} {{ dados.total === 1 ? 'resposta' : 'respostas' }}</span>
      </div>
      <button @click="baixarCsv" :disabled="baixando || !dados?.total" class="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40">
        <i class="pi pi-download mr-1 text-[10px]"></i>{{ baixando ? 'Gerando...' : 'Baixar planilha (CSV)' }}
      </button>
    </div>

    <div v-if="carregando && !dados" class="py-16 text-center text-slate-400"><i class="pi pi-spin pi-spinner text-xl"></i></div>

    <div v-else-if="dados && !dados.total" class="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
      <i class="pi pi-inbox text-3xl text-slate-300"></i>
      <p class="mt-2 font-bold text-slate-600 dark:text-slate-300">Ainda sem respostas neste período</p>
      <p class="text-xs text-slate-400">Envie a pesquisa ou compartilhe o link público.</p>
    </div>

    <div v-else-if="dados" class="flex flex-col gap-4">
      <div v-for="q in dados.perguntas" :key="q.id" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-400"><i :class="[infoTipo(q.tipo).icone, 'mr-1 text-[9px]']"></i>{{ infoTipo(q.tipo).rotulo }}<span v-if="q.principal" class="text-emerald-600 ml-2">· Nota principal</span></p>
            <h4 class="font-bold text-slate-800 dark:text-white mt-1">{{ exemplo(q.titulo, empresa) }}</h4>
          </div>
          <span class="text-xs text-slate-400 shrink-0">{{ q.respostas }} resp.</span>
        </div>

        <!-- Notas -->
        <template v-if="q.distribuicao">
          <div class="flex flex-wrap gap-6 mb-4" v-if="q.respostas">
            <div v-if="q.nps !== undefined && q.nps !== null"><p class="text-3xl font-black" :style="{ color: q.nps >= 50 ? '#10b981' : q.nps >= 0 ? '#f59e0b' : '#ef4444' }">{{ q.nps }}</p><p class="text-[10px] uppercase tracking-wider text-slate-400">NPS</p></div>
            <div v-if="q.satisfeitos_pct !== undefined"><p class="text-3xl font-black text-slate-800 dark:text-white">{{ q.satisfeitos_pct.toLocaleString('pt-BR') }}%</p><p class="text-[10px] uppercase tracking-wider text-slate-400">Satisfeitos</p></div>
            <div v-if="q.media !== null"><p class="text-3xl font-black text-slate-800 dark:text-white">{{ q.media.toLocaleString('pt-BR') }}</p><p class="text-[10px] uppercase tracking-wider text-slate-400">Média</p></div>
            <div v-if="q.grupos" class="text-xs text-slate-500 self-end">
              <span class="text-emerald-600 font-bold">{{ q.grupos.promotor }}</span> promotores ·
              <span class="text-amber-600 font-bold">{{ q.grupos.neutro }}</span> neutros ·
              <span class="text-red-600 font-bold">{{ q.grupos.detrator }}</span> detratores
            </div>
          </div>
          <div class="flex items-end gap-1 h-28">
            <div v-for="(v, n) in q.distribuicao" :key="n" class="flex-1 flex flex-col items-center justify-end h-full" :title="`${n}: ${v}`">
              <span class="text-[10px] text-slate-500 mb-1">{{ v || '' }}</span>
              <div class="w-full rounded-t-md transition-all" :style="{ height: Math.max(3, (v / maxDist(q.distribuicao)) * 80) + '%', background: corBarra(q.tipo, Number(n)), opacity: v ? 1 : 0.2 }"></div>
              <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-1">{{ q.tipo === 'estrelas' ? n + '★' : n }}</span>
            </div>
          </div>
        </template>

        <!-- Escolhas -->
        <div v-else-if="q.contagem" class="flex flex-col gap-2">
          <div v-for="(v, o) in q.contagem" :key="o">
            <div class="flex justify-between text-sm mb-1"><span class="text-slate-700 dark:text-slate-200">{{ o }}</span><span class="text-slate-500 text-xs">{{ v }} · {{ pct(v, q.tipo === 'escolha_multipla' ? q.respostas : somaContagem(q.contagem)) }}%</span></div>
            <div class="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: pct(v, q.tipo === 'escolha_multipla' ? q.respostas : somaContagem(q.contagem)) + '%', background: cor }"></div>
            </div>
          </div>
        </div>

        <!-- Textos -->
        <div v-else-if="q.ultimas">
          <p v-if="!q.ultimas.length" class="text-xs text-slate-400">Sem respostas.</p>
          <ul class="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
            <li v-for="(t, i) in q.ultimas" :key="i" class="py-2">
              <p class="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{{ t.valor }}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">{{ t.cliente }} · {{ dataHora(t.data) }}</p>
            </li>
          </ul>
        </div>
      </div>

      <!-- Respostas individuais -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <p class="px-5 pt-5 pb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Respostas individuais</p>
        <div v-for="r in dados.registros" :key="r.id" class="border-t border-slate-100 dark:border-slate-800">
          <button type="button" @click="abertos[r.id] = !abertos[r.id]" class="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <span v-if="r.nota !== null" class="w-8 h-8 rounded-lg text-white text-sm font-black flex items-center justify-center shrink-0"
              :style="{ background: corBarra(dados.perguntas.find(q => q.principal)?.tipo, r.nota) }">{{ r.nota }}</span>
            <span class="flex-1 min-w-0">
              <span class="block text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{{ r.cliente }}<span v-if="r.referencia" class="font-normal text-slate-400"> · {{ r.referencia }}</span></span>
              <span class="block text-[11px] text-slate-400">{{ dataHora(r.data) }}</span>
            </span>
            <i :class="['pi text-xs text-slate-400', abertos[r.id] ? 'pi-chevron-up' : 'pi-chevron-down']"></i>
          </button>
          <dl v-if="abertos[r.id]" class="px-5 pb-4 grid gap-2">
            <div v-for="(v, k) in r.respostas" :key="k">
              <dt class="text-[11px] text-slate-400">{{ tituloPergunta(k) }}</dt>
              <dd class="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{{ formatar(v) }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>
