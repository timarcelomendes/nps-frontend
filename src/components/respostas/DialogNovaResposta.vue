<script setup>
// Janela "Registrar resposta": nota recebida por telefone, WhatsApp, reunião etc.
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import api from '../../services/api';
import { OPCOES_NOTA } from './nota';
import './respostas.css';

const props = defineProps({ visible: { type: Boolean, default: false } });
const emit = defineEmits(['update:visible', 'salva']);
const toast = useToast();

const vazio = () => ({ cliente_id: null, nota: null, canal: 'Manual', motivo: '' });
const form = ref(vazio());
const clientes = ref([]);
const carregandoClientes = ref(false);
const salvando = ref(false);

const carregarClientes = async () => {
  if (clientes.value.length) return;
  carregandoClientes.value = true;
  try {
    const res = await api.get('/clientes', { params: { ativo: 1 } });
    clientes.value = res.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os clientes.', life: 3000 });
  } finally {
    carregandoClientes.value = false;
  }
};

watch(() => props.visible, (aberto) => {
  if (!aberto) return;
  form.value = vazio();
  carregarClientes();
});

const salvar = async () => {
  if (!form.value.cliente_id || form.value.nota === null) {
    toast.add({ severity: 'warn', summary: 'Faltam dados', detail: 'Escolha o cliente e a nota.', life: 3000 });
    return;
  }
  salvando.value = true;
  try {
    await api.post('/respostas/manual', form.value);
    toast.add({ severity: 'success', summary: 'Resposta registrada', detail: 'Ela já aparece na lista.', life: 3000 });
    emit('update:visible', false);
    emit('salva');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a resposta.', life: 3000 });
  } finally {
    salvando.value = false;
  }
};
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal header="Registrar resposta"
    class="resp-dialog" :style="{ width: '500px' }" :breakpoints="{ '640px': '95vw' }">
    <p class="text-sm text-slate-500 dark:text-slate-400 -mt-1 mb-5">Use quando o cliente deu a nota fora da pesquisa, por telefone, WhatsApp ou em reunião.</p>

    <div class="flex flex-col gap-4">
      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Cliente <span class="text-rose-500">*</span></span>
        <Dropdown v-model="form.cliente_id" :options="clientes" optionLabel="nome" optionValue="cliente_id" filter
          :loading="carregandoClientes" placeholder="Busque pelo nome" emptyMessage="Nenhum cliente cadastrado"
          emptyFilterMessage="Nenhum cliente encontrado" class="resp-campo" panel-class="resp-painel">
          <template #option="{ option }">
            <div class="flex flex-col">
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ option.nome }}</span>
              <span v-if="option.empresa" class="text-xs text-slate-500">{{ option.empresa }}</span>
            </div>
          </template>
        </Dropdown>
      </label>

      <div class="grid grid-cols-2 gap-4">
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Nota (0 a 10) <span class="text-rose-500">*</span></span>
          <Dropdown v-model="form.nota" :options="OPCOES_NOTA" placeholder="Nota" class="resp-campo" panel-class="resp-painel" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Como chegou</span>
          <Dropdown v-model="form.canal" :options="['Manual', 'WhatsApp', 'Telefone', 'E-mail', 'Reunião']" class="resp-campo" panel-class="resp-painel" />
        </label>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">O que o cliente disse</span>
        <Textarea v-model="form.motivo" rows="4" autoResize class="resp-campo" placeholder="Resumo do comentário (opcional)" />
      </label>
      <p v-if="form.nota !== null && form.nota <= 6" class="text-sm text-slate-600 dark:text-slate-300 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">
        <i class="pi pi-info-circle text-rose-500 mr-1"></i>Nota de 0 a 6: se o cliente estiver ligado a uma empresa cadastrada, uma ação de prioridade alta é criada automaticamente.
      </p>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
        <button type="button" @click="emit('update:visible', false)" class="h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
        <button type="button" @click="salvar" :disabled="salvando"
          class="h-10 px-5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60">
          <i :class="['pi text-xs mr-1', salvando ? 'pi-spin pi-spinner' : 'pi-check']"></i>Salvar resposta
        </button>
      </div>
    </template>
  </Dialog>
</template>
