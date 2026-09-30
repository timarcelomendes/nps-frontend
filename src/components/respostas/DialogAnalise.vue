<script setup>
// Janela "Analisar resposta": corrigir nota/classificação/comentário e registrar a causa.
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import api from '../../services/api';
import { grupoDaNota, OPCOES_NOTA, OPCOES_CLASSIFICACAO } from './nota';
import './respostas.css';

const props = defineProps({
  visible: { type: Boolean, default: false },
  resposta: { type: Object, default: null },
});
const emit = defineEmits(['update:visible', 'salvo', 'criar-acao', 'ver-acao']);
const toast = useToast();

const form = ref({});
const salvando = ref(false);

watch(() => props.visible, (aberto) => {
  if (aberto && props.resposta) form.value = { ...props.resposta };
});

// Ao mudar a nota, a classificação padrão (Promotor/Neutro/Detrator) acompanha.
const aoMudarNota = () => {
  if (!form.value.categoria || OPCOES_CLASSIFICACAO.includes(form.value.categoria)) {
    form.value.categoria = grupoDaNota(form.value.nota);
  }
};

const fechar = () => emit('update:visible', false);

const salvar = async () => {
  salvando.value = true;
  try {
    await api.put(`/respostas/${form.value.id}`, form.value);
    toast.add({ severity: 'success', summary: 'Resposta atualizada', detail: 'As alterações foram salvas.', life: 3000 });
    fechar();
    emit('salvo');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a análise.', life: 3000 });
  } finally {
    salvando.value = false;
  }
};
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal header="Analisar resposta"
    class="resp-dialog" :style="{ width: '600px' }" :breakpoints="{ '640px': '95vw' }">
    <p class="text-sm text-slate-500 dark:text-slate-400 -mt-1 mb-5">
      <b class="text-slate-700 dark:text-slate-200">{{ form.cliente_nome || 'Cliente sem nome' }}</b>
      <span v-if="form.empresa"> · {{ form.empresa }}</span>
    </p>

    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Nota (0 a 10)</span>
          <Dropdown v-model="form.nota" :options="OPCOES_NOTA" @change="aoMudarNota" class="resp-campo" panel-class="resp-painel" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Classificação</span>
          <Dropdown v-model="form.categoria" :options="OPCOES_CLASSIFICACAO" editable placeholder="Promotor, Neutro ou Detrator"
            class="resp-campo" panel-class="resp-painel" />
        </label>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Comentário do cliente</span>
        <Textarea v-model="form.motivo" rows="3" autoResize class="resp-campo" placeholder="O cliente não deixou comentário." />
      </label>

      <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-4">
        <div>
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Causa e retorno ao cliente</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Anote o que você descobriu ao conversar com o cliente.</p>
        </div>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">O que faltou para o cliente?</span>
          <InputText v-model="form.o_que_faltava" class="resp-campo" placeholder="Ex.: a entrega chegou atrasada" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">O que combinamos para as próximas vezes?</span>
          <InputText v-model="form.expectativas" class="resp-campo" placeholder="Ex.: avisar o horário da entrega por WhatsApp" />
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row sm:items-center gap-2 w-full">
        <button v-if="form.acao_vinculada" type="button" @click="emit('ver-acao', form.acao_vinculada)"
          class="h-10 px-4 rounded-xl text-sm font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 sm:mr-auto">
          <i class="pi pi-external-link text-xs mr-1"></i>Ver plano de ação
        </button>
        <button v-else type="button" @click="emit('criar-acao', form)"
          class="h-10 px-4 rounded-xl text-sm font-semibold border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 sm:mr-auto">
          <i class="pi pi-bolt text-xs mr-1"></i>Criar plano de ação
        </button>
        <button type="button" @click="fechar" class="h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
        <button type="button" @click="salvar" :disabled="salvando"
          class="h-10 px-5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60">
          <i :class="['pi text-xs mr-1', salvando ? 'pi-spin pi-spinner' : 'pi-check']"></i>Salvar
        </button>
      </div>
    </template>
  </Dialog>
</template>
