<script setup>
// Confirmação do envio manual: mostra quantas pessoas vão receber e quem fica de fora.
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import AvisoAssinatura from './AvisoAssinatura.vue';
import { plural } from './mensagens';

const props = defineProps({
  visible: Boolean,
  pessoas: { type: Array, default: () => [] },        // quem vai receber
  inativos: { type: Number, default: 0 },              // selecionados que ficam de fora
  origem: { type: String, default: 'selecao' },        // 'selecao' | 'fila' | 'individual'
  bloqueio: { type: String, default: '' },             // mensagem da assinatura, quando os envios estão pausados
  enviando: Boolean,
});
const emit = defineEmits(['update:visible', 'confirmar']);

const total = computed(() => props.pessoas.length);
const recentes = computed(() => props.pessoas.filter(p => ['Enviado', 'Respondido'].includes(p.status_envio)).length);
const amostra = computed(() => props.pessoas.slice(0, 6));
const titulo = computed(() => props.origem === 'individual' ? 'Enviar pesquisa agora?' : `Enviar pesquisa para ${plural(total.value, 'pessoa', 'pessoas')}?`);
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" :header="titulo" modal :draggable="false"
    class="env-dialog" :style="{ width: '480px' }" :breakpoints="{ '640px': '94vw' }">
    <div class="flex flex-col gap-4">
      <AvisoAssinatura v-if="bloqueio" :mensagem="bloqueio" />

      <template v-else-if="total > 0">
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <template v-if="origem === 'fila'">Todos que estão na fila vão receber o convite por e-mail agora, sem esperar o envio automático.</template>
          <template v-else>O convite sai por e-mail agora.</template>
          Quem não responder recebe os lembretes configurados.
        </p>
        <ul class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
          <li v-for="p in amostra" :key="p.cliente_id" class="flex flex-col px-3 py-2 min-w-0">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ p.nome || 'Sem nome' }}</span>
            <span class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ p.email }}</span>
          </li>
          <li v-if="total > amostra.length" class="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">e mais {{ plural(total - amostra.length, 'pessoa', 'pessoas') }}</li>
        </ul>
        <p v-if="recentes > 0" class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
          {{ recentes === 1 ? 'Uma dessas pessoas já recebeu' : `${recentes} dessas pessoas já receberam` }} a pesquisa neste ciclo e vai receber de novo.
        </p>
      </template>

      <p v-else class="text-sm text-slate-600 dark:text-slate-300">Ninguém para enviar agora: selecione contatos ativos na lista.</p>

      <p v-if="inativos > 0" class="text-sm text-slate-500 dark:text-slate-400">
        {{ inativos === 1 ? '1 contato selecionado está inativo e não vai receber.' : `${inativos} contatos selecionados estão inativos e não vão receber.` }}
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button @click="emit('update:visible', false)" class="env-btn-secundario">Cancelar</button>
        <button v-if="!bloqueio && total > 0" @click="emit('confirmar')" :disabled="enviando" class="env-btn-primario">
          <i :class="['pi text-xs', enviando ? 'pi-spin pi-spinner' : 'pi-send']"></i>{{ total === 1 ? 'Enviar agora' : `Enviar para ${total}` }}
        </button>
      </div>
    </template>
  </Dialog>
</template>
