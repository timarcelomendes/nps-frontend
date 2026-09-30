<script setup>
// Detalhes de uma ação: criar, editar, registrar o contato e concluir.
import { ref, computed, watch, nextTick } from 'vue';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Calendar from 'primevue/calendar';
import { dataISO } from '../../utils/formatters';
import { origem, iniciais, statusDe, calcularPrazo, corPrazo, tituloCurto } from './acoesUtils';
import './acoes.css';

const props = defineProps({
  visible: { type: Boolean, default: false },
  acao: { type: Object, default: () => ({}) },
  // 'editar' | 'concluir' (abre com a situação em Concluído e o foco no registro do contato)
  modo: { type: String, default: 'editar' },
  empresas: { type: Array, default: () => [] },         // nomes
  empresasDetalhes: { type: Array, default: () => [] }, // cadastro completo
  gestores: { type: Array, default: () => [] },
  regras: { type: Object, required: true },
  salvando: { type: Boolean, default: false },
  podeSalvar: { type: Boolean, default: false },
  podeExcluir: { type: Boolean, default: false },
});
const emit = defineEmits(['update:visible', 'salvar', 'excluir']);

const SITUACOES = [
  { valor: 'Pendente', rotulo: 'A fazer' },
  { valor: 'Em Andamento', rotulo: 'Em andamento' },
  { valor: 'Concluído', rotulo: 'Concluído' },
];

const form = ref({});
const prazoData = ref(null);
const campoResolucao = ref(null);
const tentouSalvar = ref(false);

watch(() => props.visible, (v) => {
  if (!v) return;
  tentouSalvar.value = false;
  form.value = {
    ...props.acao,
    status: props.modo === 'concluir' ? 'Concluído' : statusDe(props.acao),
    resolucao: props.acao.resolucao || '',
  };
  prazoData.value = props.acao.prazo_limite ? new Date(String(props.acao.prazo_limite).replace(' ', 'T')) : null;
});

const novo = computed(() => !form.value.id);
const nota = computed(() => origem(form.value));
const concluindo = computed(() => form.value.status === 'Concluído');
const prazoAtual = computed(() => (novo.value ? null : calcularPrazo(props.acao, props.regras)));
const grupoDaEmpresa = computed(() => {
  const emp = props.empresasDetalhes.find(e => (e.empresa || e.nome) === form.value.empresa_nome);
  return emp?.companhia || form.value.companhia || '';
});
const getGestor = (id) => props.gestores.find(g => g.id === id);

const faltaTitulo = computed(() => novo.value && !String(form.value.titulo || '').trim());
const faltaGestor = computed(() => concluindo.value && !form.value.gestor_id);
const faltaResolucao = computed(() => concluindo.value && !String(form.value.resolucao || '').trim());

const aoMudarEmpresa = () => {
  const emp = props.empresasDetalhes.find(e => (e.empresa || e.nome) === form.value.empresa_nome);
  if (!emp) return;
  form.value.empresa_id = emp.id;
  if (emp.gestor_id) form.value.gestor_id = Number(emp.gestor_id);
};

const aoAbrir = async () => {
  if (props.modo !== 'concluir') return;
  await nextTick();
  campoResolucao.value?.$el?.focus();
};

const salvar = () => {
  tentouSalvar.value = true;
  if (faltaTitulo.value || faltaGestor.value || faltaResolucao.value) {
    if (faltaResolucao.value) campoResolucao.value?.$el?.focus();
    return;
  }
  emit('salvar', {
    ...form.value,
    gestor_id: form.value.gestor_id ? Number(form.value.gestor_id) : null,
    empresa_id: form.value.empresa_id ? Number(form.value.empresa_id) : null,
    prazo_limite: prazoData.value ? dataISO(prazoData.value) : (form.value.prazo_limite || null),
  });
};

const fechar = () => emit('update:visible', false);
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" @show="aoAbrir" modal maximizable
    :style="{ width: '600px' }" :breakpoints="{ '640px': '100vw' }" class="acoes-dialog">
    <template #header>
      <div class="flex items-start gap-3 min-w-0 pr-2">
        <span v-if="!novo" :class="['min-w-10 h-9 px-1.5 shrink-0 rounded-lg text-sm font-bold flex items-center justify-center', nota.cor]" v-tooltip.bottom="nota.dica">{{ nota.rotulo }}</span>
        <div class="min-w-0">
          <h2 class="text-base font-bold text-slate-900 dark:text-white leading-snug">
            {{ novo ? 'Nova ação' : tituloCurto(form.titulo) }}
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            <template v-if="novo">Uma tarefa para cuidar de um cliente.</template>
            <template v-else>#{{ form.id }} · {{ form.empresa_nome || 'Sem empresa' }}<span v-if="grupoDaEmpresa"> · {{ grupoDaEmpresa }}</span></template>
          </p>
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-5">
      <!-- Situação (na criação a ação sempre começa em "A fazer") -->
      <div v-if="!novo">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Situação</p>
        <div class="grid grid-cols-3 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1" role="radiogroup" aria-label="Situação">
          <button v-for="s in SITUACOES" :key="s.valor" type="button" role="radio" :aria-checked="form.status === s.valor"
            @click="form.status = s.valor"
            :class="['h-9 rounded-lg text-sm font-semibold transition-colors',
              form.status === s.valor ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200']">
            {{ s.rotulo }}
          </button>
        </div>
        <p v-if="prazoAtual && !concluindo" :class="['mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold', corPrazo(prazoAtual.nivel)]">
          <i class="pi pi-clock text-xs"></i>{{ prazoAtual.texto }}<span v-if="prazoAtual.nivel !== 'ok'"> ({{ prazoAtual.data }})</span>
        </p>
      </div>

      <!-- Contato com o cliente -->
      <div :class="['rounded-xl p-4 flex flex-col gap-2 border', novo ? 'order-last' : '', concluindo ? 'border-orange-300 bg-orange-50/60 dark:border-orange-500/40 dark:bg-orange-500/5' : 'border-slate-200 dark:border-slate-700']">
        <label for="acao-resolucao" class="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <i class="pi pi-phone text-orange-500 text-sm"></i>{{ novo ? 'Já falou com o cliente? (opcional)' : 'O que foi feito com o cliente?' }}<span v-if="concluindo" class="text-orange-600">*</span>
        </label>
        <p class="text-xs text-slate-500 dark:text-slate-400 -mt-1">Registre o contato: quando falou, com quem e o que foi combinado.<template v-if="!novo"> Obrigatório para concluir.</template></p>
        <Textarea id="acao-resolucao" ref="campoResolucao" v-model="form.resolucao" rows="3" autoResize class="acoes-campo w-full"
          placeholder="Ex.: Liguei para a Joana em 29/09, pedi desculpas pelo atraso e combinamos a entrega para sexta." />
        <p v-if="tentouSalvar && faltaResolucao" class="text-xs font-semibold text-rose-600">Descreva o que foi feito antes de concluir.</p>
      </div>

      <!-- Título (só na criação: o título não é alterado depois) -->
      <div v-if="novo" class="order-first flex flex-col gap-1.5">
        <label for="acao-titulo" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Título <span class="text-orange-600">*</span></label>
        <InputText id="acao-titulo" v-model="form.titulo" class="acoes-campo w-full" placeholder="Ex.: Ligar para o cliente sobre o atraso na entrega" />
        <p v-if="tentouSalvar && faltaTitulo" class="text-xs font-semibold text-rose-600">Dê um título para a ação.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-slate-700 dark:text-slate-200">Empresa</label>
          <Dropdown v-model="form.empresa_nome" :options="empresas" editable filter placeholder="Escolha a empresa" class="acoes-campo w-full" @change="aoMudarEmpresa" />
          <p v-if="grupoDaEmpresa" class="text-xs text-slate-500">Grupo: {{ grupoDaEmpresa }}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-slate-700 dark:text-slate-200">Responsável<span v-if="concluindo" class="text-orange-600"> *</span></label>
          <Dropdown v-model="form.gestor_id" :options="gestores" optionLabel="nome" optionValue="id" filter placeholder="Quem vai cuidar?" class="acoes-campo w-full">
            <template #value="{ value, placeholder }">
              <span v-if="value && getGestor(value)" class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <img v-if="getGestor(value).avatar" :src="getGestor(value).avatar" alt="" class="w-full h-full object-cover" />
                  <template v-else>{{ iniciais(getGestor(value).nome) }}</template>
                </span>
                {{ getGestor(value).nome }}
              </span>
              <span v-else>{{ placeholder }}</span>
            </template>
          </Dropdown>
          <p v-if="tentouSalvar && faltaGestor" class="text-xs font-semibold text-rose-600">Escolha um responsável para concluir.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-slate-700 dark:text-slate-200">Prazo</label>
          <Calendar v-model="prazoData" dateFormat="dd/mm/yy" :manualInput="false" showIcon iconDisplay="input" placeholder="Prazo padrão" class="acoes-campo w-full" />
          <p v-if="!prazoData" class="text-xs text-slate-500">Vazio: usa o prazo padrão pela nota do cliente.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-semibold text-slate-700 dark:text-slate-200">Prioridade</label>
          <Dropdown v-model="form.prioridade" :options="['Alta', 'Média', 'Baixa']" class="acoes-campo w-full" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="acao-descricao" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Detalhes e anotações internas</label>
        <Textarea id="acao-descricao" v-model="form.descricao" rows="5" autoResize class="acoes-campo w-full" placeholder="O que o cliente disse, próximos passos, observações..." />
      </div>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center gap-2 w-full">
        <button v-if="podeExcluir && !novo" type="button" @click="emit('excluir', form.id)" class="h-10 px-3 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
          <i class="pi pi-trash text-xs mr-1"></i>Excluir
        </button>
        <span class="flex-1"></span>
        <button type="button" @click="fechar" class="h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
          {{ podeSalvar ? 'Cancelar' : 'Fechar' }}
        </button>
        <button v-if="podeSalvar" type="button" @click="salvar" :disabled="salvando"
          class="h-10 px-5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold">
          <i :class="['pi text-xs mr-1', salvando ? 'pi-spin pi-spinner' : 'pi-check']"></i>
          {{ novo ? 'Criar ação' : concluindo && statusDe(acao) !== 'Concluído' ? 'Concluir ação' : 'Salvar' }}
        </button>
      </div>
    </template>
  </Dialog>
</template>
