<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import QRCode from 'qrcode';
import api from '../services/api';
import FormularioRenderer from '../components/FormularioRenderer.vue';
import PerguntaEditor from '../components/formularios/PerguntaEditor.vue';
import ResultadosFormulario from '../components/formularios/ResultadosFormulario.vue';
import { TIPOS_PERGUNTA, infoTipo, novaPergunta, principalDe, descreverCondicao, exemplo } from '../components/formularios/tipos';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const id = computed(() => route.params.id);

const form = ref(null);
const original = ref('');
const carregando = ref(true);
const salvando = ref(false);
const aba = ref(route.query.aba || 'perguntas');
const aberta = ref(null);
const menuAdicionar = ref(false);
const empresa = ref('');
const larguraPrevia = ref('celular');
const previa = ref(null);
const versao = ref(0); // recria os editores depois de salvar

const CORES = ['#f97316', '#ef4444', '#e11d48', '#8b5cf6', '#2563eb', '#0891b2', '#059669', '#65a30d', '#ca8a04', '#0f172a'];
const GRUPOS_TIPO = ['Notas', 'Texto', 'Escolha', 'Outros'];

// ---------- carregar / salvar
const snapshot = () => JSON.stringify({ n: form.value?.nome, d: form.value?.descricao, p: form.value?.perguntas, t: form.value?.tema, pub: form.value?.publico, a: form.value?.ativo });
const alterado = computed(() => !!form.value && snapshot() !== original.value);

const carregar = async () => {
  carregando.value = true;
  try {
    const [f, c] = await Promise.all([api.get(`/formularios/${id.value}`), api.get('/conta').catch(() => ({ data: {} }))]);
    form.value = f.data;
    empresa.value = c.data?.nome || '';
    original.value = snapshot();
    aberta.value = form.value.perguntas.find(p => p.tipo !== 'pagina')?.id || null;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Formulário não encontrado', life: 4000 });
    router.replace('/formularios');
  } finally {
    carregando.value = false;
  }
};

const salvar = async () => {
  salvando.value = true;
  try {
    const { data } = await api.put(`/formularios/${id.value}`, {
      nome: form.value.nome, descricao: form.value.descricao, perguntas: form.value.perguntas,
      tema: form.value.tema, publico: form.value.publico, ativo: form.value.ativo,
    });
    const abertaAntes = aberta.value;
    form.value = data;
    versao.value += 1;
    original.value = snapshot();
    aberta.value = data.perguntas.some(p => p.id === abertaAntes) ? abertaAntes : null;
    toast.add({ severity: 'success', summary: 'Formulário salvo', life: 2500 });
    return true;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Não foi possível salvar', detail: e.response?.data?.detail || 'Tente novamente.', life: 6000 });
    return false;
  } finally {
    salvando.value = false;
  }
};

onBeforeRouteLeave(() => (alterado.value ? confirm('Há alterações não salvas. Sair mesmo assim?') : true));
const avisoSaida = (e) => { if (alterado.value) { e.preventDefault(); e.returnValue = ''; } };
const atalhoSalvar = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (alterado.value) salvar(); } };
onMounted(() => { carregar(); window.addEventListener('beforeunload', avisoSaida); window.addEventListener('keydown', atalhoSalvar); });
onBeforeUnmount(() => { window.removeEventListener('beforeunload', avisoSaida); window.removeEventListener('keydown', atalhoSalvar); });

// ---------- perguntas
const perguntas = computed(() => form.value?.perguntas || []);
const principal = computed(() => principalDe(perguntas.value));
const indicePrincipal = computed(() => perguntas.value.findIndex(p => p.id === principal.value?.id));
const numeroDe = (p) => perguntas.value.filter(x => x.tipo !== 'pagina').indexOf(p) + 1;
const tipoForm = computed(() => (!principal.value ? 'personalizado' : principal.value.tipo === 'nps' ? 'nps' : 'csat'));

const adicionar = async (tipo) => {
  const nova = novaPergunta(tipo);
  const i = perguntas.value.findIndex(p => p.id === aberta.value);
  if (i >= 0) form.value.perguntas.splice(i + 1, 0, nova); else form.value.perguntas.push(nova);
  menuAdicionar.value = false;
  if (tipo !== 'pagina') {
    aberta.value = nova.id;
    await nextTick();
    document.getElementById(`perg-${nova.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
const remover = (p) => {
  if (p.tipo !== 'pagina' && !confirm(`Remover a pergunta "${(p.titulo || '').slice(0, 60)}"?`)) return;
  form.value.perguntas = perguntas.value.filter(x => x.id !== p.id);
};
const duplicarPergunta = (p) => {
  const i = perguntas.value.indexOf(p);
  const copia = { ...JSON.parse(JSON.stringify(p)), id: 'p_' + Math.random().toString(16).slice(2, 10) };
  form.value.perguntas.splice(i + 1, 0, copia);
  aberta.value = copia.id;
};
const mover = (i, d) => {
  const j = i + d;
  if (j < 0 || j >= perguntas.value.length) return;
  const l = [...perguntas.value];
  [l[i], l[j]] = [l[j], l[i]];
  form.value.perguntas = l;
};

// arrastar e soltar
const arrastando = ref(null);
const sobre = ref(null);
const iniciarArraste = (i, e) => { arrastando.value = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); };
const soltar = (i) => {
  const de = arrastando.value;
  arrastando.value = null; sobre.value = null;
  if (de === null || de === i) return;
  const l = [...perguntas.value];
  const [item] = l.splice(de, 1);
  l.splice(i, 0, item);
  form.value.perguntas = l;
};

// ---------- prévia (textos com exemplos)
const formPrevia = computed(() => {
  if (!form.value) return null;
  const ps = perguntas.value.map(p => (p.tipo === 'pagina' ? p : { ...p, titulo: exemplo(p.titulo, empresa.value), descricao: exemplo(p.descricao, empresa.value) }));
  const t = { ...form.value.tema };
  ['titulo_final', 'mensagem_final', 'mensagem_inicial'].forEach(k => { t[k] = exemplo(t[k], empresa.value); });
  return { perguntas: ps, tema: t, principal_id: principal.value?.id || null, principal_tipo: principal.value?.tipo || null };
});
const previaConcluida = ref(false);
const reiniciarPrevia = () => { previaConcluida.value = false; previa.value?.reiniciar(); };

// ---------- aparência
const enviarLogo = (e) => {
  const arquivo = e.target.files?.[0];
  e.target.value = '';
  if (!arquivo || !arquivo.type.startsWith('image/')) return;
  const img = new Image();
  img.onload = () => {
    // reduz para no máximo 480x160 (o logo fica guardado no próprio formulário)
    const escala = Math.min(1, 480 / img.width, 160 / img.height);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/png');
    if (dataUrl.length > 390000) {
      toast.add({ severity: 'warn', summary: 'Imagem grande demais', detail: 'Use um logo mais simples ou menor.', life: 5000 });
      return;
    }
    form.value.tema.logo = dataUrl;
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(arquivo);
};

// ---------- compartilhar
const qrUrl = ref('');
watch(() => [form.value?.link_publico, form.value?.tema?.cor, aba.value], async () => {
  if (!form.value?.link_publico || aba.value !== 'compartilhar') return;
  qrUrl.value = await QRCode.toDataURL(form.value.link_publico, { width: 512, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
}, { immediate: true });

const copiar = async (t, msg = 'Copiado') => {
  try { await navigator.clipboard.writeText(t); toast.add({ severity: 'success', summary: msg, life: 2000 }); } catch (e) { /* sem clipboard */ }
};
const baixarQr = () => {
  const a = document.createElement('a');
  a.href = qrUrl.value; a.download = `qrcode-${(form.value.nome || 'formulario').replace(/\W+/g, '-').toLowerCase()}.png`; a.click();
};

const definirPadrao = async (uso) => {
  if (alterado.value && !(await salvar())) return;
  try {
    await api.post(`/formularios/${id.value}/padrao`, { uso });
    form.value[`padrao_${uso}`] = true;
    toast.add({ severity: 'success', summary: `Agora os envios de ${uso.toUpperCase()} usam este formulário`, life: 3500 });
  } catch (e) {
    toast.add({ severity: 'warn', summary: 'Não foi possível', detail: e.response?.data?.detail, life: 6000 });
  }
};

const exemploApi = computed(() => `{
  "email": "cliente@exemplo.com",
  "nome": "Maria",
  "referencia": "PED-1234",
  "assunto": "a entrega do pedido 1234",
  "formulario_id": ${form.value?.id}
}`);

const ABAS = [
  { chave: 'perguntas', rotulo: 'Perguntas', icone: 'pi pi-list' },
  { chave: 'aparencia', rotulo: 'Aparência', icone: 'pi pi-palette' },
  { chave: 'compartilhar', rotulo: 'Compartilhar e usar', icone: 'pi pi-share-alt' },
  { chave: 'respostas', rotulo: 'Respostas', icone: 'pi pi-chart-bar' },
];
watch(aba, (v) => router.replace({ query: v === 'perguntas' ? {} : { aba: v } }));
</script>

<template>
  <div v-if="carregando" class="py-24 text-center text-slate-400"><i class="pi pi-spin pi-spinner text-2xl"></i></div>

  <div v-else-if="form" class="max-w-[1400px] mx-auto">
    <!-- Cabeçalho -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <button @click="router.push('/formularios')" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0" title="Voltar"><i class="pi pi-arrow-left text-sm"></i></button>
        <div class="min-w-0 flex-1">
          <input v-model="form.nome" maxlength="150" class="w-full bg-transparent text-2xl font-black text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-900 rounded-lg px-1 -mx-1" />
          <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
            <span class="font-bold px-2 py-0.5 rounded-md" :class="tipoForm === 'nps' ? 'bg-orange-50 text-orange-600' : tipoForm === 'csat' ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-600'">
              {{ tipoForm === 'nps' ? 'NPS' : tipoForm === 'csat' ? 'Satisfação (CSAT)' : 'Personalizado' }}
            </span>
            <span v-if="form.padrao_nps" class="text-emerald-600 font-bold"><i class="pi pi-send text-[9px]"></i> envios de NPS</span>
            <span v-if="form.padrao_csat" class="text-emerald-600 font-bold"><i class="pi pi-truck text-[9px]"></i> CSAT</span>
            <span v-if="!form.ativo" class="text-slate-500 font-bold">Arquivado</span>
            <span v-if="alterado" class="text-amber-600 font-bold"><i class="pi pi-circle-fill text-[6px] mr-1"></i>Alterações não salvas</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <a v-if="form.publico && form.ativo" :href="form.link_publico" target="_blank" class="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center"><i class="pi pi-external-link mr-2 text-xs"></i>Abrir</a>
        <button @click="salvar" :disabled="salvando || !alterado" class="h-10 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50">
          <i class="pi pi-save mr-2 text-xs"></i>{{ salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>

    <!-- Abas -->
    <div class="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-6 overflow-x-auto">
      <button v-for="a in ABAS" :key="a.chave" @click="aba = a.chave"
        :class="['px-4 py-2.5 text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors', aba === a.chave ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300']">
        <i :class="[a.icone, 'mr-1.5 text-xs']"></i>{{ a.rotulo }}
      </button>
    </div>

    <!-- Respostas ocupa a largura toda -->
    <ResultadosFormulario v-if="aba === 'respostas'" :formulario-id="form.id" :empresa="empresa" :cor="form.tema.cor" />

    <div v-else class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
      <div class="min-w-0">
        <!-- ================= PERGUNTAS ================= -->
        <div v-if="aba === 'perguntas'">
          <div v-if="!perguntas.length" class="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 mb-4">
            <p class="font-bold text-slate-600 dark:text-slate-300">Formulário vazio</p>
            <p class="text-xs text-slate-400">Adicione a primeira pergunta abaixo.</p>
          </div>

          <div class="flex flex-col gap-3">
            <div v-for="(p, i) in perguntas" :key="p.id" :id="`perg-${p.id}`"
              @dragover.prevent="sobre = i" @dragleave="sobre === i && (sobre = null)" @drop.prevent="soltar(i)"
              :class="['rounded-2xl transition-all', sobre === i && arrastando !== i ? 'ring-2 ring-orange-400' : '', arrastando === i ? 'opacity-40' : '']">

              <!-- Quebra de página -->
              <div v-if="p.tipo === 'pagina'" class="flex items-center gap-3 py-1">
                <span draggable="true" @dragstart="iniciarArraste(i, $event)" @dragend="arrastando = null" class="cursor-grab text-slate-300 px-1"><i class="pi pi-bars text-xs"></i></span>
                <div class="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700"></div>
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Nova página</span>
                <div class="flex-1 border-t-2 border-dashed border-slate-300 dark:border-slate-700"></div>
                <button @click="remover(p)" class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600" title="Remover quebra"><i class="pi pi-times text-xs"></i></button>
              </div>

              <!-- Pergunta -->
              <div v-else class="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm"
                :class="aberta === p.id ? 'border-orange-300 dark:border-orange-500/40' : 'border-slate-100 dark:border-slate-800'">
                <div class="flex items-center gap-2 px-3 py-3 cursor-pointer" @click="aberta = aberta === p.id ? null : p.id">
                  <span draggable="true" @dragstart="iniciarArraste(i, $event)" @dragend="arrastando = null" @click.stop class="cursor-grab text-slate-300 hover:text-slate-500 px-1" title="Arraste para reordenar"><i class="pi pi-bars text-xs"></i></span>
                  <span class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0"><i :class="[infoTipo(p.tipo).icone, 'text-xs']"></i></span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      <span class="text-slate-400 mr-1">{{ numeroDe(p) }}.</span>{{ p.titulo || 'Sem título' }}
                    </p>
                    <p class="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
                      <span>{{ infoTipo(p.tipo).rotulo }}</span>
                      <span v-if="p.obrigatoria" class="text-orange-500">obrigatória</span>
                      <span v-if="principal && p.id === principal.id" class="text-emerald-600 font-bold"><i class="pi pi-star-fill text-[8px]"></i> nota principal</span>
                      <span v-if="p.condicao" class="text-violet-600"><i class="pi pi-sitemap text-[8px]"></i> {{ descreverCondicao(p.condicao, principal?.tipo) }}</span>
                    </p>
                  </div>
                  <div class="flex items-center shrink-0" @click.stop>
                    <button @click="mover(i, -1)" :disabled="i === 0" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Subir"><i class="pi pi-angle-up text-xs"></i></button>
                    <button @click="mover(i, 1)" :disabled="i === perguntas.length - 1" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30" title="Descer"><i class="pi pi-angle-down text-xs"></i></button>
                    <button @click="duplicarPergunta(p)" class="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Duplicar"><i class="pi pi-copy text-xs"></i></button>
                    <button @click="remover(p)" class="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" title="Remover"><i class="pi pi-trash text-xs"></i></button>
                  </div>
                </div>
                <div v-if="aberta === p.id" class="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <PerguntaEditor :key="p.id + p.tipo + versao" :pergunta="p" :principal="principal"
                    :eh-principal="!!principal && p.id === principal.id" :pode-ter-condicao="!!principal && i > indicePrincipal" />
                </div>
              </div>
            </div>
          </div>

          <!-- Adicionar -->
          <div class="mt-4">
            <button v-if="!menuAdicionar" @click="menuAdicionar = true" class="w-full h-12 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
              <i class="pi pi-plus mr-2 text-xs"></i>Adicionar pergunta
            </button>
            <div v-else class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div class="flex justify-between items-center mb-3">
                <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Escolha o tipo<span v-if="aberta" class="font-normal text-slate-400"> · entra logo abaixo da pergunta aberta</span></p>
                <button @click="menuAdicionar = false" class="text-slate-400 hover:text-slate-600"><i class="pi pi-times text-xs"></i></button>
              </div>
              <div v-for="g in GRUPOS_TIPO" :key="g" class="mb-3 last:mb-0">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{{ g }}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <button v-for="t in TIPOS_PERGUNTA.filter(x => x.grupo === g)" :key="t.tipo" @click="adicionar(t.tipo)"
                    class="flex items-start gap-2.5 text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-500/10 transition-colors">
                    <i :class="[t.icone, 'text-orange-500 text-sm mt-0.5']"></i>
                    <span><span class="block text-sm font-bold text-slate-700 dark:text-slate-200">{{ t.rotulo }}</span><span class="block text-[11px] text-slate-400 leading-snug">{{ t.dica }}</span></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p v-if="!principal && perguntas.length" class="mt-3 text-xs text-slate-500">
            <i class="pi pi-info-circle mr-1"></i>Sem pergunta de NPS, satisfação ou estrelas, as respostas ficam só neste formulário (não entram nos painéis de NPS/CSAT).
          </p>
        </div>

        <!-- ================= APARÊNCIA ================= -->
        <div v-else-if="aba === 'aparencia'" class="flex flex-col gap-5">
          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3">Cor e logo</h3>
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <button v-for="c in CORES" :key="c" @click="form.tema.cor = c" class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                :style="{ background: c, borderColor: form.tema.cor === c ? '#0f172a' : 'transparent' }" :title="c"></button>
              <label class="flex items-center gap-2 ml-2 text-xs text-slate-500 cursor-pointer">
                <input type="color" v-model="form.tema.cor" class="w-8 h-8 rounded cursor-pointer bg-transparent" /> Outra cor
              </label>
            </div>
            <div class="flex items-center gap-4">
              <div class="w-40 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center bg-white overflow-hidden">
                <img v-if="form.tema.logo" :src="form.tema.logo" class="max-h-14 max-w-[150px] object-contain" alt="Logo" />
                <span v-else class="text-[11px] text-slate-400">Sem logo</span>
              </div>
              <div class="flex flex-col gap-2">
                <label class="h-9 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center">
                  <i class="pi pi-upload mr-2 text-[10px]"></i>Enviar logo<input type="file" accept="image/*" class="hidden" @change="enviarLogo" />
                </label>
                <button v-if="form.tema.logo" @click="form.tema.logo = ''" class="text-xs text-red-500 hover:underline text-left">Remover logo</button>
              </div>
            </div>
          </section>

          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3">Como as perguntas aparecem</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button @click="form.tema.layout = 'uma_por_vez'" :class="['text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex flex-col gap-1 text-slate-800 dark:text-slate-100 transition-colors', form.tema.layout === 'uma_por_vez' ? '!border-orange-500 bg-orange-50/60 dark:bg-orange-500/10' : '']">
                <span class="font-bold text-sm">Uma pergunta por vez</span>
                <span class="text-xs text-slate-500">Estilo conversa, com barra de progresso. Ao tocar numa nota, avança sozinho. Melhor no celular.</span>
              </button>
              <button @click="form.tema.layout = 'lista'" :class="['text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex flex-col gap-1 text-slate-800 dark:text-slate-100 transition-colors', form.tema.layout === 'lista' ? '!border-orange-500 bg-orange-50/60 dark:bg-orange-500/10' : '']">
                <span class="font-bold text-sm">Páginas</span>
                <span class="text-xs text-slate-500">Várias perguntas na mesma tela. Use "Quebra de página" para dividir em etapas.</span>
              </button>
            </div>
          </section>

          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3">Textos</h3>
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Mensagem de abertura (opcional)</label>
            <textarea v-model="form.tema.mensagem_inicial" rows="2" maxlength="600" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40 mb-4" placeholder="Ex.: Leva menos de 1 minuto. Sua opinião nos ajuda a melhorar!"></textarea>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Texto do botão de envio</label><input v-model="form.tema.texto_botao" maxlength="40" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40" /></div>
              <div><label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Título do agradecimento</label><input v-model="form.tema.titulo_final" maxlength="120" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40" /></div>
            </div>
            <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 mt-4">Mensagem de agradecimento</label>
            <textarea v-model="form.tema.mensagem_final" rows="2" maxlength="600" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40"></textarea>
            <p class="text-[10px] text-slate-400 mt-1">Pode usar <code>{empresa}</code> e <code>{nome}</code>.</p>
          </section>
        </div>

        <!-- ================= COMPARTILHAR ================= -->
        <div v-else-if="aba === 'compartilhar'" class="flex flex-col gap-5">
          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3">Usar nos envios automáticos</h3>
            <p class="text-xs text-slate-500 mb-4">Os convites por e-mail (e, em breve, WhatsApp) usam o formulário padrão de cada tipo. Cada convite tem link próprio, então a resposta já chega ligada ao cliente.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p class="font-bold text-sm text-slate-800 dark:text-white"><i class="pi pi-send text-orange-500 mr-1"></i>Pesquisa de NPS</p>
                <p v-if="form.padrao_nps" class="text-xs text-emerald-600 font-bold mt-2"><i class="pi pi-check-circle mr-1"></i>Este é o formulário usado</p>
                <button v-else @click="definirPadrao('nps')" :disabled="tipoForm !== 'nps'" class="mt-2 text-xs font-bold text-orange-600 hover:underline disabled:text-slate-400 disabled:no-underline">Usar este formulário</button>
                <p v-if="tipoForm !== 'nps' && !form.padrao_nps" class="text-[10px] text-slate-400 mt-1">Precisa ter uma pergunta de NPS (0 a 10).</p>
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p class="font-bold text-sm text-slate-800 dark:text-white"><i class="pi pi-truck text-orange-500 mr-1"></i>Satisfação (CSAT)</p>
                <p v-if="form.padrao_csat" class="text-xs text-emerald-600 font-bold mt-2"><i class="pi pi-check-circle mr-1"></i>Este é o formulário usado</p>
                <button v-else @click="definirPadrao('csat')" :disabled="tipoForm !== 'csat'" class="mt-2 text-xs font-bold text-orange-600 hover:underline disabled:text-slate-400 disabled:no-underline">Usar este formulário</button>
                <p v-if="tipoForm !== 'csat' && !form.padrao_csat" class="text-[10px] text-slate-400 mt-1">Precisa ter satisfação (rostos) ou estrelas e nenhuma pergunta de NPS.</p>
              </div>
            </div>
          </section>

          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3 !mb-1">Link público e QR Code</h3>
                <p class="text-xs text-slate-500">Para colocar no site, no balcão, na nota fiscal ou no caminhão. Qualquer pessoa com o link pode responder.</p>
              </div>
              <label class="flex items-center gap-2 text-sm font-bold cursor-pointer shrink-0">
                <input type="checkbox" v-model="form.publico" class="accent-orange-500 w-4 h-4" /> Ativo
              </label>
            </div>
            <div v-if="form.publico" class="mt-4 flex flex-col sm:flex-row gap-5 items-start">
              <div class="flex-1 min-w-0 w-full">
                <div class="flex gap-2">
                  <input :value="form.link_publico" readonly class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/40 font-mono !text-xs" />
                  <button @click="copiar(form.link_publico, 'Link copiado')" class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"><i class="pi pi-copy text-xs"></i></button>
                </div>
                <p class="text-[11px] text-slate-500 mt-2"><i class="pi pi-lightbulb text-amber-500 mr-1"></i>Quer saber de onde veio a resposta? Acrescente <code>?ref=loja-centro</code> (ou o nome que quiser) no fim do link. Aparece como "Referência" nas respostas.</p>
                <p v-if="alterado" class="text-[11px] text-amber-600 mt-2 font-bold">Salve o formulário para ativar o link.</p>
                <p v-if="form.publico && tipoForm !== 'personalizado'" class="text-[11px] text-slate-500 mt-2">Dica: inclua uma pergunta de <b>texto curto com formato e-mail</b> para identificar quem respondeu.</p>
              </div>
              <div class="text-center shrink-0">
                <img v-if="qrUrl" :src="qrUrl" alt="QR Code" class="w-36 h-36 rounded-xl border border-slate-200" />
                <button @click="baixarQr" class="mt-2 text-xs font-bold text-orange-600 hover:underline"><i class="pi pi-download text-[10px] mr-1"></i>Baixar QR Code</button>
              </div>
            </div>
          </section>

          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3">Integração (ERP, TMS, sistema próprio)</h3>
            <p class="text-xs text-slate-500 mb-3">Para disparar este formulário depois de uma entrega ou atendimento, inclua <code>"formulario_id": {{ form.id }}</code> na chamada da API de CSAT (endereço e chave em Configurações › Integrações).</p>
            <pre class="p-3 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-[11px] leading-relaxed">{{ exemploApi }}</pre>
          </section>

          <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3">Situação</h3>
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" v-model="form.ativo" class="accent-orange-500 w-4 h-4" /> Formulário ativo
            </label>
            <p class="text-[11px] text-slate-400 mt-1">Formulários inativos ficam arquivados: não recebem respostas novas, mas o histórico continua disponível.</p>
          </section>
        </div>
      </div>

      <!-- Prévia -->
      <aside class="xl:sticky xl:top-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Prévia ao vivo</p>
          <div class="flex items-center gap-1">
            <button @click="larguraPrevia = 'celular'" :class="['w-8 h-8 rounded-lg text-xs', larguraPrevia === 'celular' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white' : 'text-slate-400']" title="Celular"><i class="pi pi-mobile"></i></button>
            <button @click="larguraPrevia = 'tela'" :class="['w-8 h-8 rounded-lg text-xs', larguraPrevia === 'tela' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white' : 'text-slate-400']" title="Computador"><i class="pi pi-desktop"></i></button>
            <button @click="reiniciarPrevia" class="w-8 h-8 rounded-lg text-xs text-slate-400 hover:text-slate-600" title="Recomeçar"><i class="pi pi-refresh"></i></button>
          </div>
        </div>
        <div :class="['mx-auto bg-slate-100 dark:bg-slate-800 rounded-[2rem] p-3 overflow-y-auto max-h-[78vh]', larguraPrevia === 'celular' ? 'max-w-[380px] border-[6px] border-slate-800 dark:border-slate-600' : 'w-full']">
          <FormularioRenderer v-if="formPrevia" ref="previa" :formulario="formPrevia" :concluido="previaConcluida" preview
            @enviar="previaConcluida = true" @reiniciar="previaConcluida = false" />
        </div>
        <p class="text-[10px] text-slate-400 text-center mt-2">Na prévia, {nome} e {assunto} aparecem com exemplos. Nada é gravado.</p>
      </aside>
    </div>
  </div>
</template>

