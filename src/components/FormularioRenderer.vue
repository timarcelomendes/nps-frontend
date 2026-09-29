<script setup>
/**
 * Mostra um formulário da Rakiti (página pública e pré-visualização do construtor).
 * Layouts: "uma_por_vez" (estilo Typeform) ou "lista" (páginas separadas por quebras).
 * Lógica: perguntas com "condicao" só aparecem conforme a nota principal.
 */
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  formulario: { type: Object, required: true },   // { perguntas, tema, principal_id, principal_tipo }
  notaInicial: { type: Number, default: null },
  enviando: { type: Boolean, default: false },
  erro: { type: String, default: '' },
  concluido: { type: Boolean, default: false },
  preview: { type: Boolean, default: false },
});
const emit = defineEmits(['enviar', 'reiniciar']);

const respostas = ref({});
const passo = ref(0);
const erroLocal = ref('');

const tema = computed(() => ({
  cor: '#f97316', layout: 'uma_por_vez', texto_botao: 'Enviar resposta', titulo_final: 'Obrigado!', mensagem_final: '',
  ...(props.formulario.tema || {}),
}));
const perguntas = computed(() => props.formulario.perguntas || []);
const principal = computed(() => perguntas.value.find(p => p.id === props.formulario.principal_id) || null);
const notaPrincipal = computed(() => {
  if (!principal.value) return null;
  const v = respostas.value[principal.value.id];
  return v === undefined || v === null || v === '' ? null : Number(v);
});

const grupo = (tipo, nota) => {
  if (nota === null) return null;
  if (tipo === 'nps') return nota <= 6 ? 'detrator' : nota <= 8 ? 'neutro' : 'promotor';
  return nota <= 2 ? 'detrator' : nota === 3 ? 'neutro' : 'promotor';
};
const visivel = (p) => {
  const c = p.condicao;
  if (!c || !principal.value) return true;
  const n = notaPrincipal.value;
  if (n === null) return false;
  if (c.tipo === 'grupo') return grupo(principal.value.tipo, n) === c.valor;
  if (c.tipo === 'lte') return n <= c.valor;
  return n >= c.valor;
};

// Etapas: cada etapa é uma lista de perguntas visíveis
const etapas = computed(() => {
  if (tema.value.layout === 'lista') {
    const paginas = [[]];
    perguntas.value.forEach(p => {
      if (p.tipo === 'pagina') paginas.push([]);
      else if (visivel(p)) paginas[paginas.length - 1].push(p);
    });
    return paginas.filter(pg => pg.length);
  }
  return perguntas.value.filter(p => p.tipo !== 'pagina' && visivel(p)).map(p => [p]);
});
const etapaAtual = computed(() => etapas.value[Math.min(passo.value, Math.max(etapas.value.length - 1, 0))] || []);
const ultima = computed(() => passo.value >= etapas.value.length - 1);
const progresso = computed(() => etapas.value.length ? Math.round(((passo.value + 1) / etapas.value.length) * 100) : 0);

const faixa = (p) => {
  if (p.tipo === 'nps') return [0, 10];
  if (p.tipo === 'csat' || p.tipo === 'estrelas') return [1, 5];
  return [p.escala?.min ?? 1, p.escala?.max ?? 5];
};
const numeros = (p) => { const [a, b] = faixa(p); return Array.from({ length: b - a + 1 }, (_, i) => a + i); };
const ROSTOS = [
  { n: 1, emoji: '😡', rotulo: 'Péssimo' }, { n: 2, emoji: '🙁', rotulo: 'Ruim' }, { n: 3, emoji: '😐', rotulo: 'Regular' },
  { n: 4, emoji: '🙂', rotulo: 'Bom' }, { n: 5, emoji: '😍', rotulo: 'Excelente' },
];
const corNps = (n, sel) => {
  if (!sel) return n <= 6 ? 'border-red-200 text-red-600 hover:bg-red-50' : n <= 8 ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50';
  return n <= 6 ? 'bg-red-500 text-white border-red-500' : n <= 8 ? 'bg-amber-500 text-white border-amber-500' : 'bg-emerald-500 text-white border-emerald-500';
};
const estrelaHover = ref({});

const vazio = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim());
const validarEtapa = () => {
  for (const p of etapaAtual.value) {
    const v = respostas.value[p.id];
    if (p.obrigatoria && vazio(v)) return `Responda: ${p.titulo}`;
    if (!vazio(v) && p.tipo === 'texto_curto' && p.formato === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'Informe um e-mail válido.';
  }
  return '';
};

const avancar = () => {
  erroLocal.value = validarEtapa();
  if (erroLocal.value) return;
  if (ultima.value) return enviar();
  passo.value += 1;
  focarPrimeiro();
};
const voltar = () => { erroLocal.value = ''; if (passo.value > 0) passo.value -= 1; };

const enviar = () => {
  erroLocal.value = validarEtapa();
  if (erroLocal.value) return;
  // só manda o que está visível (a lógica pode ter escondido respostas antigas)
  const visiveis = new Set(etapas.value.flat().map(p => p.id));
  const saida = {};
  Object.entries(respostas.value).forEach(([k, v]) => { if (visiveis.has(k) && !vazio(v)) saida[k] = v; });
  emit('enviar', saida);
};

const escolherNota = (p, n) => {
  respostas.value = { ...respostas.value, [p.id]: n };
  // estilo Typeform: nota escolhida avança sozinha
  if (tema.value.layout !== 'lista' && etapaAtual.value.length === 1 && !ultima.value) {
    setTimeout(() => { if (respostas.value[p.id] === n) avancar(); }, 280);
  }
};
const escolherUnica = (p, o) => {
  respostas.value = { ...respostas.value, [p.id]: o };
  if (tema.value.layout !== 'lista' && etapaAtual.value.length === 1 && !ultima.value) setTimeout(avancar, 280);
};
const alternarMultipla = (p, o) => {
  const atual = Array.isArray(respostas.value[p.id]) ? [...respostas.value[p.id]] : [];
  const i = atual.indexOf(o);
  if (i >= 0) atual.splice(i, 1); else atual.push(o);
  respostas.value = { ...respostas.value, [p.id]: atual };
};
const marcado = (p, o) => Array.isArray(respostas.value[p.id]) && respostas.value[p.id].includes(o);

const raiz = ref(null);
const focarPrimeiro = () => nextTick(() => {
  const el = raiz.value?.querySelector('input:not([type=hidden]), textarea');
  if (el && !props.preview) el.focus({ preventScroll: true });
});

const tipoInput = (p) => (p.formato === 'email' ? 'email' : p.formato === 'telefone' ? 'tel' : 'text');
const modoInput = (p) => (p.formato === 'numero' ? 'decimal' : p.formato === 'telefone' ? 'tel' : p.formato === 'email' ? 'email' : 'text');

const reiniciar = () => { respostas.value = {}; passo.value = 0; erroLocal.value = ''; aplicarNotaInicial(); emit('reiniciar'); };

const aplicarNotaInicial = () => {
  const p = principal.value;
  if (!p || props.notaInicial === null || props.notaInicial === undefined) return;
  const [a, b] = faixa(p);
  if (props.notaInicial < a || props.notaInicial > b) return;
  respostas.value = { ...respostas.value, [p.id]: props.notaInicial };
  // o cliente já escolheu a nota no e-mail: começa na próxima pergunta
  if (tema.value.layout !== 'lista' && etapas.value[0]?.[0]?.id === p.id && etapas.value.length > 1) passo.value = 1;
};
aplicarNotaInicial();

// no construtor, perguntas mudam: mantém o passo dentro do limite
watch(etapas, (e) => { if (passo.value > e.length - 1) passo.value = Math.max(e.length - 1, 0); });
defineExpose({ reiniciar });
</script>

<template>
  <div ref="raiz" class="w-full text-slate-900" :style="{ '--cor': tema.cor }">
    <div class="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div v-if="!concluido && tema.layout !== 'lista' && etapas.length > 1" class="h-1.5 bg-slate-100">
        <div class="h-full transition-all duration-300" :style="{ width: progresso + '%', background: tema.cor }"></div>
      </div>

      <div class="p-6 sm:p-8">
        <img v-if="tema.logo" :src="tema.logo" alt="Logo" class="h-10 max-w-[180px] object-contain mb-5" />

        <!-- Final -->
        <div v-if="concluido" class="py-10 text-center">
          <div class="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl" :style="{ background: tema.cor }">
            <i class="pi pi-check"></i>
          </div>
          <h1 class="text-xl font-bold mb-1">{{ tema.titulo_final || 'Obrigado!' }}</h1>
          <p class="text-slate-500 text-sm whitespace-pre-line">{{ tema.mensagem_final }}</p>
          <button v-if="preview" type="button" @click="reiniciar" class="mt-6 text-xs font-bold underline" :style="{ color: tema.cor }">Responder de novo (prévia)</button>
        </div>

        <div v-else-if="!etapas.length" class="py-12 text-center text-slate-400 text-sm">
          Adicione perguntas para ver a prévia.
        </div>

        <form v-else @submit.prevent="avancar" novalidate>
          <p v-if="passo === 0 && tema.mensagem_inicial" class="text-slate-600 text-sm mb-5 whitespace-pre-line">{{ tema.mensagem_inicial }}</p>

          <div v-for="p in etapaAtual" :key="p.id" class="mb-7 last:mb-2">
            <h2 class="text-lg sm:text-xl font-bold leading-snug">
              {{ p.titulo }}<span v-if="p.obrigatoria" class="ml-1" :style="{ color: tema.cor }">*</span>
            </h2>
            <p v-if="p.descricao" class="text-sm text-slate-500 mt-1 whitespace-pre-line">{{ p.descricao }}</p>

            <!-- NPS 0-10 -->
            <div v-if="p.tipo === 'nps'" class="mt-4">
              <div class="grid grid-cols-6 sm:grid-cols-11 gap-2">
                <button v-for="n in numeros(p)" :key="n" type="button" @click="escolherNota(p, n)" :aria-pressed="respostas[p.id] === n"
                  :class="['h-11 rounded-lg border-2 font-bold transition-colors', corNps(n, respostas[p.id] === n)]">{{ n }}</button>
              </div>
              <div class="flex justify-between text-xs text-slate-400 mt-2">
                <span>{{ p.escala?.rotulo_min || 'Nada provável' }}</span><span>{{ p.escala?.rotulo_max || 'Muito provável' }}</span>
              </div>
            </div>

            <!-- CSAT rostos -->
            <div v-else-if="p.tipo === 'csat'" class="mt-4 grid grid-cols-5 gap-2">
              <button v-for="r in ROSTOS" :key="r.n" type="button" @click="escolherNota(p, r.n)" :aria-pressed="respostas[p.id] === r.n"
                :class="['flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all', respostas[p.id] === r.n ? 'scale-105' : 'border-slate-200 hover:border-slate-300']"
                :style="respostas[p.id] === r.n ? { borderColor: tema.cor, background: tema.cor + '14' } : {}">
                <span class="text-3xl sm:text-4xl">{{ r.emoji }}</span>
                <span class="text-[11px] text-slate-500">{{ r.rotulo }}</span>
              </button>
            </div>

            <!-- Estrelas -->
            <div v-else-if="p.tipo === 'estrelas'" class="mt-4 flex gap-1" @mouseleave="estrelaHover[p.id] = 0">
              <button v-for="n in 5" :key="n" type="button" @click="escolherNota(p, n)" @mouseenter="estrelaHover[p.id] = n"
                :aria-label="`${n} estrela${n > 1 ? 's' : ''}`" class="text-4xl sm:text-5xl leading-none transition-transform hover:scale-110"
                :class="n <= (estrelaHover[p.id] || respostas[p.id] || 0) ? 'text-amber-400' : 'text-slate-200'">★</button>
            </div>

            <!-- Escala numérica -->
            <div v-else-if="p.tipo === 'escala'" class="mt-4">
              <div class="flex flex-wrap gap-2">
                <button v-for="n in numeros(p)" :key="n" type="button" @click="escolherNota(p, n)" :aria-pressed="respostas[p.id] === n"
                  class="h-11 min-w-[2.75rem] px-2 rounded-lg border-2 font-bold transition-colors"
                  :class="respostas[p.id] === n ? 'text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300'"
                  :style="respostas[p.id] === n ? { background: tema.cor, borderColor: tema.cor } : {}">{{ n }}</button>
              </div>
              <div v-if="p.escala?.rotulo_min || p.escala?.rotulo_max" class="flex justify-between text-xs text-slate-400 mt-2">
                <span>{{ p.escala?.rotulo_min }}</span><span>{{ p.escala?.rotulo_max }}</span>
              </div>
            </div>

            <!-- Texto curto -->
            <input v-else-if="p.tipo === 'texto_curto'" v-model="respostas[p.id]" :type="tipoInput(p)" :inputmode="modoInput(p)" maxlength="300"
              class="mt-3 w-full rounded-xl border border-slate-300 px-3 h-12 text-base bg-white text-slate-900 focus:outline-none focus:ring-2"
              :style="{ '--tw-ring-color': tema.cor }" placeholder="Digite aqui..." />

            <!-- Texto longo -->
            <textarea v-else-if="p.tipo === 'texto_longo'" v-model="respostas[p.id]" rows="3" maxlength="4000"
              class="mt-3 w-full rounded-xl border border-slate-300 p-3 text-base bg-white text-slate-900 focus:outline-none focus:ring-2"
              :style="{ '--tw-ring-color': tema.cor }" placeholder="Escreva aqui..."></textarea>

            <!-- Escolha única / múltipla -->
            <div v-else-if="p.tipo === 'escolha_unica' || p.tipo === 'escolha_multipla'" class="mt-3 flex flex-col gap-2">
              <p v-if="p.tipo === 'escolha_multipla'" class="text-xs text-slate-400 -mt-1">Pode marcar mais de uma.</p>
              <button v-for="(o, i) in p.opcoes" :key="o" type="button"
                @click="p.tipo === 'escolha_unica' ? escolherUnica(p, o) : alternarMultipla(p, o)"
                class="flex items-center gap-3 text-left px-4 py-3 rounded-xl border-2 transition-colors"
                :class="(p.tipo === 'escolha_unica' ? respostas[p.id] === o : marcado(p, o)) ? '' : 'border-slate-200 hover:border-slate-300'"
                :style="(p.tipo === 'escolha_unica' ? respostas[p.id] === o : marcado(p, o)) ? { borderColor: tema.cor, background: tema.cor + '14' } : {}">
                <span class="w-6 h-6 shrink-0 flex items-center justify-center text-[11px] font-bold border rounded-md"
                  :class="p.tipo === 'escolha_unica' ? 'rounded-full' : ''"
                  :style="(p.tipo === 'escolha_unica' ? respostas[p.id] === o : marcado(p, o)) ? { background: tema.cor, borderColor: tema.cor, color: '#fff' } : { borderColor: '#cbd5e1', color: '#64748b' }">
                  <i v-if="(p.tipo === 'escolha_unica' ? respostas[p.id] === o : marcado(p, o))" class="pi pi-check text-[10px]"></i>
                  <span v-else>{{ String.fromCharCode(65 + (i % 26)) }}</span>
                </span>
                <span class="text-sm sm:text-base">{{ o }}</span>
              </button>
            </div>

            <!-- Sim / Não -->
            <div v-else-if="p.tipo === 'sim_nao'" class="mt-3 grid grid-cols-2 gap-3">
              <button v-for="o in ['Sim', 'Não']" :key="o" type="button" @click="escolherUnica(p, o)"
                class="h-14 rounded-xl border-2 font-bold text-base transition-colors"
                :class="respostas[p.id] === o ? 'text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300'"
                :style="respostas[p.id] === o ? { background: tema.cor, borderColor: tema.cor } : {}">
                <i :class="o === 'Sim' ? 'pi pi-thumbs-up' : 'pi pi-thumbs-down'" class="mr-2"></i>{{ o }}
              </button>
            </div>

            <!-- Data -->
            <input v-else-if="p.tipo === 'data'" v-model="respostas[p.id]" type="date"
              class="mt-3 w-full sm:w-64 rounded-xl border border-slate-300 px-3 h-12 text-base bg-white text-slate-900 focus:outline-none" />
          </div>

          <p v-if="erroLocal || erro" class="mt-2 text-sm text-red-600">{{ erroLocal || erro }}</p>

          <div class="mt-5 flex items-center gap-3">
            <button v-if="passo > 0" type="button" @click="voltar"
              class="h-12 px-4 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50">
              <i class="pi pi-arrow-left"></i>
            </button>
            <button type="submit" :disabled="enviando"
              class="flex-1 h-12 rounded-xl text-white font-bold transition-opacity disabled:opacity-60 hover:opacity-90"
              :style="{ background: tema.cor }">
              <template v-if="ultima">{{ enviando ? 'Enviando...' : tema.texto_botao || 'Enviar resposta' }}</template>
              <template v-else>Continuar <i class="pi pi-arrow-right ml-1 text-sm"></i></template>
            </button>
          </div>
          <p v-if="etapas.length > 1" class="text-center text-[11px] text-slate-400 mt-3">{{ passo + 1 }} de {{ etapas.length }}</p>
        </form>
      </div>
    </div>
    <p class="text-center text-[11px] text-slate-400 mt-4">Pesquisa feita com Rakiti</p>
  </div>
</template>
