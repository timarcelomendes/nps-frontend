<script setup>
// Janela "Criar plano de ação" a partir de uma resposta.
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import api from '../../services/api';
import './respostas.css';

const props = defineProps({
  visible: { type: Boolean, default: false },
  resposta: { type: Object, default: null },
});
const emit = defineEmits(['update:visible', 'criada']);
const toast = useToast();

const form = ref({ titulo: '', gestor_id: null, empresa_id: null, prioridade: 'Alta', descricao: '' });
const gestores = ref([]);
const salvando = ref(false);

const carregarGestores = async () => {
  if (gestores.value.length) return;
  try {
    const res = await api.get('/cadastros/gestores');
    gestores.value = res.data;
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os responsáveis.', life: 3000 });
  }
};

watch(() => props.visible, (aberto) => {
  if (!aberto || !props.resposta) return;
  const r = props.resposta;
  carregarGestores();
  form.value = {
    titulo: `Retornar ao cliente: ${r.empresa || r.cliente_nome || 'Cliente'}`,
    gestor_id: r.gestor_id ? Number(r.gestor_id) : null,
    empresa_id: r.empresa_id ? Number(r.empresa_id) : null,
    prioridade: 'Alta',
    descricao: `Nota ${r.nota} de ${r.cliente_nome || 'cliente'}${r.empresa ? ` (${r.empresa})` : ''}.\n\nComentário do cliente: "${r.motivo || 'Sem comentário'}"`,
  };
});

const criar = async () => {
  if (!form.value.titulo?.trim()) {
    toast.add({ severity: 'warn', summary: 'Falta o título', detail: 'Dê um título para a ação.', life: 3000 });
    return;
  }
  salvando.value = true;
  try {
    await api.post('/acoes', {
      resposta_id: props.resposta.id,
      titulo: form.value.titulo,
      gestor_id: form.value.gestor_id,
      empresa_id: form.value.empresa_id,
      prioridade: form.value.prioridade,
      descricao: form.value.descricao,
    });
    toast.add({ severity: 'success', summary: 'Ação criada', detail: 'O responsável foi avisado e a ação está nos Planos de Ação.', life: 4000 });
    emit('update:visible', false);
    emit('criada');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível criar a ação. Tente novamente.', life: 4000 });
  } finally {
    salvando.value = false;
  }
};
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal header="Criar plano de ação"
    class="resp-dialog" :style="{ width: '480px' }" :breakpoints="{ '640px': '95vw' }">
    <p class="text-sm text-slate-500 dark:text-slate-400 -mt-1 mb-5 flex items-center gap-2">
      <i class="pi pi-building text-slate-400"></i>{{ resposta?.empresa || 'Empresa não identificada' }}
    </p>

    <div class="flex flex-col gap-4">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Título <span class="text-rose-500">*</span></span>
        <InputText v-model="form.titulo" class="resp-campo" />
      </label>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Responsável</span>
          <Dropdown v-model="form.gestor_id" :options="gestores" optionLabel="nome" optionValue="id" filter
            placeholder="Escolha…" emptyMessage="Nenhum responsável cadastrado" class="resp-campo" panel-class="resp-painel" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Prioridade</span>
          <Dropdown v-model="form.prioridade" :options="['Alta', 'Média', 'Baixa']" class="resp-campo" panel-class="resp-painel" />
        </label>
      </div>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">O que precisa ser feito</span>
        <Textarea v-model="form.descricao" rows="5" autoResize class="resp-campo" />
      </label>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
        <button type="button" @click="emit('update:visible', false)" class="h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
        <button type="button" @click="criar" :disabled="salvando"
          class="h-10 px-5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60">
          <i :class="['pi text-xs mr-1', salvando ? 'pi-spin pi-spinner' : 'pi-check']"></i>Criar ação
        </button>
      </div>
    </template>
  </Dialog>
</template>
