<script setup>
// Edição de uma pergunta (o objeto é alterado diretamente; o pai observa as mudanças)
import { computed } from 'vue';
import { infoTipo, rotulosGrupo } from './tipos';

const props = defineProps({
  pergunta: { type: Object, required: true },
  principal: { type: Object, default: null },
  podeTerCondicao: { type: Boolean, default: false },
  ehPrincipal: { type: Boolean, default: false },
});

const p = props.pergunta;
const info = computed(() => infoTipo(p.tipo));

// ---- opções
const adicionarOpcao = () => { p.opcoes = [...(p.opcoes || []), `Opção ${(p.opcoes?.length || 0) + 1}`]; };
const removerOpcao = (i) => { p.opcoes = p.opcoes.filter((_, j) => j !== i); };
const moverOpcao = (i, d) => {
  const j = i + d;
  if (j < 0 || j >= p.opcoes.length) return;
  const o = [...p.opcoes];
  [o[i], o[j]] = [o[j], o[i]];
  p.opcoes = o;
};
const colarOpcoes = (e) => {
  // colar uma lista (uma por linha) cria várias opções de uma vez
  const texto = e.clipboardData?.getData('text') || '';
  if (!texto.includes('\n')) return;
  e.preventDefault();
  const novas = texto.split('\n').map(s => s.trim()).filter(Boolean);
  p.opcoes = [...new Set([...(p.opcoes || []).filter(o => !/^Opção \d+$/.test(o)), ...novas])];
};

// ---- escala
if ((p.tipo === 'escala' || ['nps', 'csat', 'estrelas'].includes(p.tipo)) && !p.escala) p.escala = {};

// ---- condição (lógica)
const condicaoModo = computed({
  get: () => {
    const c = p.condicao;
    if (!c) return 'sempre';
    return c.tipo === 'grupo' ? c.valor : c.tipo;
  },
  set: (v) => {
    if (v === 'sempre') delete p.condicao;
    else if (['detrator', 'neutro', 'promotor'].includes(v)) p.condicao = { tipo: 'grupo', valor: v };
    else p.condicao = { tipo: v, valor: p.condicao?.valor ?? (props.principal?.tipo === 'nps' ? 6 : 3) };
  },
});
const grupos = computed(() => rotulosGrupo(props.principal?.tipo));
const maxNota = computed(() => (props.principal?.tipo === 'nps' ? 10 : 5));
const minNota = computed(() => (props.principal?.tipo === 'nps' ? 0 : 1));
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Pergunta</label>
      <textarea v-model="p.titulo" rows="2" maxlength="500" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40" placeholder="Escreva a pergunta"></textarea>
      <p class="text-[10px] text-slate-400 mt-1">Pode usar: <code>{empresa}</code> <code>{nome}</code> <code>{assunto}</code> <code>{referencia}</code></p>
    </div>
    <div>
      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Texto de apoio (opcional)</label>
      <input v-model="p.descricao" maxlength="1000" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40" placeholder="Explique melhor, se precisar" />
    </div>

    <!-- Opções -->
    <div v-if="p.tipo === 'escolha_unica' || p.tipo === 'escolha_multipla'">
      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Opções</label>
      <div class="flex flex-col gap-2">
        <div v-for="(o, i) in p.opcoes" :key="i" class="flex items-center gap-2">
          <span class="w-6 text-center text-[11px] font-bold text-slate-400">{{ String.fromCharCode(65 + (i % 26)) }}</span>
          <input v-model="p.opcoes[i]" maxlength="200" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40 flex-1" @paste="colarOpcoes" />
          <button type="button" @click="moverOpcao(i, -1)" :disabled="i === 0" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 shrink-0" title="Subir"><i class="pi pi-angle-up text-xs"></i></button>
          <button type="button" @click="moverOpcao(i, 1)" :disabled="i === p.opcoes.length - 1" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 shrink-0" title="Descer"><i class="pi pi-angle-down text-xs"></i></button>
          <button type="button" @click="removerOpcao(i)" :disabled="p.opcoes.length <= 2" class="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 shrink-0 hover:!text-red-600" title="Remover"><i class="pi pi-times text-xs"></i></button>
        </div>
      </div>
      <button type="button" @click="adicionarOpcao" class="mt-2 text-xs font-bold text-orange-600 hover:underline"><i class="pi pi-plus text-[10px] mr-1"></i>Adicionar opção</button>
      <p class="text-[10px] text-slate-400 mt-1">Dica: cole uma lista (uma opção por linha) para criar várias de uma vez.</p>
    </div>

    <!-- Escala -->
    <div v-if="p.tipo === 'escala'" class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">De</label>
        <select v-model.number="p.escala.min" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40"><option :value="0">0</option><option :value="1">1</option></select>
      </div>
      <div>
        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Até</label>
        <select v-model.number="p.escala.max" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40"><option v-for="n in [3,4,5,6,7,8,9,10]" :key="n" :value="n">{{ n }}</option></select>
      </div>
    </div>
    <div v-if="p.escala && p.tipo !== 'csat'" class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Rótulo da menor nota</label>
        <input v-model="p.escala.rotulo_min" maxlength="40" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40" :placeholder="p.tipo === 'nps' ? 'Nada provável' : 'Opcional'" />
      </div>
      <div>
        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Rótulo da maior nota</label>
        <input v-model="p.escala.rotulo_max" maxlength="40" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40" :placeholder="p.tipo === 'nps' ? 'Muito provável' : 'Opcional'" />
      </div>
    </div>

    <!-- Formato do texto curto -->
    <div v-if="p.tipo === 'texto_curto'">
      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Formato</label>
      <select v-model="p.formato" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40">
        <option value="texto">Texto livre</option>
        <option value="email">E-mail (valida e identifica o cliente)</option>
        <option value="telefone">Telefone / WhatsApp</option>
        <option value="numero">Número</option>
      </select>
    </div>

    <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer select-none">
      <input type="checkbox" v-model="p.obrigatoria" class="accent-orange-500 w-4 h-4" /> Resposta obrigatória
    </label>

    <!-- Lógica -->
    <div v-if="ehPrincipal" class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs p-3">
      <i class="pi pi-star-fill mr-1"></i>Esta é a <b>nota principal</b>: vai para o painel de {{ p.tipo === 'nps' ? 'NPS' : 'satisfação (CSAT)' }},
      gera Plano de Ação para notas baixas e comanda a lógica das perguntas seguintes.
    </div>
    <div v-else-if="podeTerCondicao" class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
      <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5"><i class="pi pi-sitemap mr-1"></i>Quando mostrar esta pergunta</label>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="condicaoModo" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40 !w-auto">
          <option value="sempre">Sempre</option>
          <option value="detrator">Só para {{ grupos.detrator }}</option>
          <option value="neutro">Só para {{ grupos.neutro }}</option>
          <option value="promotor">Só para {{ grupos.promotor }}</option>
          <option value="lte">Se a nota for até...</option>
          <option value="gte">Se a nota for a partir de...</option>
        </select>
        <select v-if="p.condicao && p.condicao.tipo !== 'grupo'" v-model.number="p.condicao.valor" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40 !w-24">
          <option v-for="n in (maxNota - minNota + 1)" :key="n" :value="n - 1 + minNota">{{ n - 1 + minNota }}</option>
        </select>
      </div>
      <p class="text-[10px] text-slate-400 mt-1">Baseado na nota principal: "{{ principal.titulo?.slice(0, 60) }}"</p>
    </div>
    <p v-else-if="!principal && p.tipo !== 'pagina'" class="text-[10px] text-slate-400">
      <i class="pi pi-info-circle mr-1"></i>Para mostrar perguntas conforme a nota, adicione uma pergunta de NPS, satisfação ou estrelas antes desta.
    </p>
  </div>
</template>

