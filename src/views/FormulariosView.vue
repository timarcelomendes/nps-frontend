<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import api from '../services/api';

const router = useRouter();
const toast = useToast();

const formularios = ref([]);
const carregando = ref(true);
const mostrarArquivados = ref(false);
const modelos = ref([]);
const dialogNovo = ref(false);
const nomeNovo = ref('');
const modeloEscolhido = ref('nps_padrao');
const criando = ref(false);

const TIPOS = {
  nps: { rotulo: 'NPS', classe: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' },
  csat: { rotulo: 'Satisfação (CSAT)', classe: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  personalizado: { rotulo: 'Personalizado', classe: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

const carregar = async () => {
  carregando.value = true;
  try {
    const { data } = await api.get('/formularios', { params: { incluir_arquivados: mostrarArquivados.value } });
    formularios.value = data;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os formulários.', life: 4000 });
  } finally {
    carregando.value = false;
  }
};

const abrirNovo = async () => {
  nomeNovo.value = '';
  modeloEscolhido.value = 'nps_padrao';
  dialogNovo.value = true;
  if (!modelos.value.length) {
    try { modelos.value = (await api.get('/formularios/modelos')).data; } catch (e) { console.error(e); }
  }
};

const criar = async () => {
  criando.value = true;
  try {
    const { data } = await api.post('/formularios', { nome: nomeNovo.value, modelo: modeloEscolhido.value });
    dialogNovo.value = false;
    router.push(`/formularios/${data.id}`);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro', detail: e.response?.data?.detail || 'Não foi possível criar.', life: 4000 });
  } finally {
    criando.value = false;
  }
};

const duplicar = async (f) => {
  try {
    const { data } = await api.post(`/formularios/${f.id}/duplicar`);
    toast.add({ severity: 'success', summary: 'Formulário duplicado', life: 2500 });
    router.push(`/formularios/${data.id}`);
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro', detail: e.response?.data?.detail || 'Não foi possível duplicar.', life: 4000 });
  }
};

const excluir = async (f) => {
  if (!confirm(`Excluir o formulário "${f.nome}"? Se ele já tiver respostas, será arquivado e as respostas continuam guardadas.`)) return;
  try {
    const { data } = await api.delete(`/formularios/${f.id}`);
    toast.add({ severity: 'success', summary: data.message, life: 4000 });
    carregar();
  } catch (e) {
    toast.add({ severity: 'warn', summary: 'Não foi possível excluir', detail: e.response?.data?.detail, life: 6000 });
  }
};

const copiar = async (texto) => {
  try { await navigator.clipboard.writeText(texto); toast.add({ severity: 'success', summary: 'Link copiado', life: 2000 }); } catch (e) { /* sem clipboard */ }
};

const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const temArquivados = computed(() => formularios.value.some(f => !f.ativo));

onMounted(carregar);
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-black italic text-slate-900 dark:text-white">Formulários<span class="text-orange-500">.</span></h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Crie pesquisas com as perguntas que fazem sentido para o seu negócio.</p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input type="checkbox" v-model="mostrarArquivados" @change="carregar" class="accent-orange-500" /> Mostrar arquivados
        </label>
        <button @click="abrirNovo" class="h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-sm">
          <i class="pi pi-plus mr-2 text-xs"></i>Novo formulário
        </button>
      </div>
    </div>

    <div v-if="carregando" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div v-for="i in 3" :key="i" class="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    </div>

    <div v-else-if="!formularios.length" class="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
      <i class="pi pi-file-edit text-4xl text-slate-300"></i>
      <p class="mt-3 font-bold text-slate-700 dark:text-slate-200">Nenhum formulário ainda</p>
      <p class="text-sm text-slate-500">Comece por um modelo pronto e ajuste as perguntas.</p>
      <button @click="abrirNovo" class="mt-5 h-10 px-5 rounded-xl bg-orange-500 text-white text-sm font-bold">Criar formulário</button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div v-for="f in formularios" :key="f.id"
        class="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col"
        :class="{ 'opacity-60': !f.ativo }">
        <div class="h-1.5 rounded-t-2xl" :style="{ background: f.tema?.cor || '#f97316' }"></div>
        <div class="p-5 flex-1 flex flex-col">
          <div class="flex items-start justify-between gap-3">
            <button @click="router.push(`/formularios/${f.id}`)" class="text-left">
              <h3 class="font-black text-slate-800 dark:text-white leading-tight group-hover:text-orange-600">{{ f.nome }}</h3>
            </button>
            <span :class="['text-[10px] font-bold px-2 py-1 rounded-md shrink-0', TIPOS[f.tipo]?.classe]">{{ TIPOS[f.tipo]?.rotulo }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5 mt-2">
            <span v-if="f.padrao_nps" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><i class="pi pi-send text-[8px] mr-1"></i>Usado nos envios de NPS</span>
            <span v-if="f.padrao_csat" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><i class="pi pi-truck text-[8px] mr-1"></i>Usado no CSAT</span>
            <span v-if="f.publico && f.ativo" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"><i class="pi pi-globe text-[8px] mr-1"></i>Link público</span>
            <span v-if="!f.ativo" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Arquivado</span>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-5 text-center">
            <div><p class="text-lg font-black text-slate-800 dark:text-white">{{ f.qtd_perguntas }}</p><p class="text-[10px] text-slate-400 uppercase tracking-wider">Perguntas</p></div>
            <div><p class="text-lg font-black text-slate-800 dark:text-white">{{ f.respostas }}</p><p class="text-[10px] text-slate-400 uppercase tracking-wider">Respostas</p></div>
            <div><p class="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">{{ dataCurta(f.ultima_resposta) }}</p><p class="text-[10px] text-slate-400 uppercase tracking-wider">Última</p></div>
          </div>
        </div>
        <div class="flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 px-3 py-2">
          <button @click="router.push(`/formularios/${f.id}`)" class="flex-1 text-xs font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg py-2"><i class="pi pi-pencil mr-1 text-[10px]"></i>Editar</button>
          <button @click="router.push(`/formularios/${f.id}?aba=respostas`)" class="flex-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg py-2"><i class="pi pi-chart-bar mr-1 text-[10px]"></i>Respostas</button>
          <button v-if="f.publico && f.ativo" @click="copiar(f.link_publico)" class="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800" v-tooltip.top="'Copiar link público'"><i class="pi pi-link text-xs"></i></button>
          <button @click="duplicar(f)" class="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800" v-tooltip.top="'Duplicar'"><i class="pi pi-copy text-xs"></i></button>
          <button v-if="f.ativo" @click="excluir(f)" class="w-9 h-9 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" v-tooltip.top="'Excluir'"><i class="pi pi-trash text-xs"></i></button>
        </div>
      </div>
    </div>
    <p v-if="!carregando && mostrarArquivados && !temArquivados" class="text-xs text-slate-400 mt-4">Nenhum formulário arquivado.</p>

    <Dialog v-model:visible="dialogNovo" modal header="Novo formulário" :style="{ width: '760px', maxWidth: '95vw' }">
      <div class="flex flex-col gap-2 mb-5">
        <label class="text-xs font-bold text-slate-600">Nome (opcional)</label>
        <InputText v-model="nomeNovo" placeholder="Ex.: Satisfação com a entrega — Região Sul" class="w-full" />
      </div>
      <p class="text-xs font-bold text-slate-600 mb-2">Comece por um modelo</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button v-for="m in modelos" :key="m.chave" type="button" @click="modeloEscolhido = m.chave"
          :class="['text-left p-4 rounded-xl border-2 transition-all flex gap-3', modeloEscolhido === m.chave ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300']">
          <span class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
            <i :class="[m.icone, 'text-orange-500']"></i>
          </span>
          <span>
            <span class="block font-bold text-sm text-slate-800 dark:text-white">{{ m.nome }}</span>
            <span class="block text-xs text-slate-500 mt-0.5">{{ m.descricao }}</span>
            <span v-if="m.qtd_perguntas" class="block text-[10px] text-slate-400 mt-1">{{ m.qtd_perguntas }} perguntas</span>
          </span>
        </button>
      </div>
      <template #footer>
        <button @click="dialogNovo = false" class="h-10 px-4 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100">Cancelar</button>
        <button @click="criar" :disabled="criando" class="h-10 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-60">
          {{ criando ? 'Criando...' : 'Criar e editar' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>
