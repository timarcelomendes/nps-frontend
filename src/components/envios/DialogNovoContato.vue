<script setup>
// Cadastro rápido de um contato direto da tela de Envios.
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import api from '../../services/api';
import AvisoAssinatura from './AvisoAssinatura.vue';
import { detalheDoErro, ehErroAssinatura } from './mensagens';

const props = defineProps({
  visible: Boolean,
  empresas: { type: Array, default: () => [] },
  perfis: { type: Array, default: () => [] },
  cargos: { type: Array, default: () => [] },
  gestores: { type: Array, default: () => [] },
  segmentos: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:visible', 'salvo']);
const toast = useToast();

// O backend grava os IDs (empresa_id, cargo_id...), não os nomes.
const vazio = () => ({ nome: '', email: '', telefone: '', empresa_id: null, perfil_id: null, cargo_id: null, gestor: null, segmento_id: null });
const cliente = ref(vazio());
const salvando = ref(false);
const erroPlano = ref('');

watch(() => props.visible, (aberto) => { if (aberto) { cliente.value = vazio(); erroPlano.value = ''; } });

const salvar = async () => {
  const c = cliente.value;
  if (!c.nome?.trim() || !c.email?.trim()) {
    toast.add({ severity: 'warn', summary: 'Faltam dados', detail: 'Preencha o nome e o e-mail.', life: 3000 });
    return;
  }
  salvando.value = true;
  erroPlano.value = '';
  try {
    await api.post('/clientes', { ...c, nome: c.nome.trim(), email: c.email.trim(), gestor: c.gestor || '' });
    toast.add({ severity: 'success', summary: 'Contato adicionado', detail: `${c.nome} já aparece na fila de envios.`, life: 3000 });
    emit('salvo');
    emit('update:visible', false);
  } catch (error) {
    const detalhe = detalheDoErro(error);
    if (ehErroAssinatura(detalhe, error?.response?.status)) erroPlano.value = detalhe || 'Seu plano chegou ao limite de clientes.';
    else toast.add({ severity: 'error', summary: 'Não foi possível salvar', detail: detalhe || 'Tente de novo em instantes.', life: 5000 });
  } finally {
    salvando.value = false;
  }
};
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" header="Novo contato" modal :draggable="false"
    class="env-dialog" :style="{ width: '560px' }" :breakpoints="{ '640px': '94vw' }">
    <div class="flex flex-col gap-4">
      <AvisoAssinatura v-if="erroPlano" :mensagem="erroPlano" titulo="Seu plano chegou ao limite" botao="Ver planos" />
      <div class="env-campo">
        <label for="env-nome">Nome *</label>
        <InputText id="env-nome" v-model="cliente.nome" placeholder="Ex.: João Silva" />
      </div>
      <div class="env-campo">
        <label for="env-email">E-mail *</label>
        <InputText id="env-email" v-model="cliente.email" type="email" placeholder="joao@empresa.com.br" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="env-campo">
          <label for="env-tel">Telefone</label>
          <InputText id="env-tel" v-model="cliente.telefone" placeholder="(11) 99999-0000" />
        </div>
        <div class="env-campo">
          <label>Empresa</label>
          <Dropdown v-model="cliente.empresa_id" :options="empresas" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione" emptyMessage="Nenhuma empresa cadastrada" panelClass="env-painel" />
        </div>
        <div class="env-campo">
          <label>Cargo</label>
          <Dropdown v-model="cliente.cargo_id" :options="cargos" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione" emptyMessage="Nenhum cargo cadastrado" panelClass="env-painel" />
        </div>
        <div class="env-campo">
          <label>Perfil</label>
          <Dropdown v-model="cliente.perfil_id" :options="perfis" optionLabel="nome" optionValue="id" showClear placeholder="Selecione" emptyMessage="Nenhum perfil cadastrado" panelClass="env-painel" />
        </div>
        <div class="env-campo">
          <label>Responsável</label>
          <Dropdown v-model="cliente.gestor" :options="gestores" optionLabel="nome" optionValue="nome" filter showClear placeholder="Quem cuida da conta" emptyMessage="Nenhum responsável cadastrado" panelClass="env-painel" />
        </div>
        <div class="env-campo">
          <label>Segmento</label>
          <Dropdown v-model="cliente.segmento_id" :options="segmentos" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione" emptyMessage="Nenhum segmento cadastrado" panelClass="env-painel" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button @click="emit('update:visible', false)" class="env-btn-secundario">Cancelar</button>
        <button @click="salvar" :disabled="salvando" class="env-btn-primario">
          <i :class="['pi text-xs', salvando ? 'pi-spin pi-spinner' : 'pi-plus']"></i>Adicionar contato
        </button>
      </div>
    </template>
  </Dialog>
</template>
