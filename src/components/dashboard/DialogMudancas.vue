<script setup>
// Lista de clientes que mudaram de grupo entre a penúltima e a última resposta.
import Dialog from 'primevue/dialog';
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  tipo: { type: String, default: 'risco' }, // risco | resgatados
  lista: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:visible']);

const info = computed(() => (props.tipo === 'risco'
  ? { titulo: 'Deixaram de ser promotores', texto: 'Davam nota 9 ou 10 e, na última resposta, deram 8 ou menos.', icone: 'pi pi-arrow-down-right text-rose-500' }
  : { titulo: 'Clientes resgatados', texto: 'Eram detratores (0 a 6) e, na última resposta, deram 9 ou 10.', icone: 'pi pi-arrow-up-right text-emerald-500' }));
const cor = (n) => (n >= 9 ? 'text-emerald-600' : n >= 7 ? 'text-amber-600' : 'text-rose-600');
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" modal :header="info.titulo" :style="{ width: '480px', maxWidth: '95vw' }">
    <p class="text-sm text-slate-500 mb-4"><i :class="[info.icone, 'mr-1']"></i>{{ info.texto }}</p>
    <ul class="divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-y-auto">
      <li v-for="(c, i) in lista" :key="i" class="py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-slate-800 dark:text-slate-100 truncate">{{ c.cliente_nome || 'Cliente' }}</p>
          <p class="text-sm text-slate-500 truncate">{{ c.empresa_nome }}</p>
        </div>
        <span class="text-lg font-bold" :class="cor(c.nota_anterior)">{{ c.nota_anterior }}</span>
        <i class="pi pi-arrow-right text-slate-300 text-xs"></i>
        <span class="text-lg font-bold" :class="cor(c.nota_atual)">{{ c.nota_atual }}</span>
      </li>
      <li v-if="!lista.length" class="py-6 text-center text-sm text-slate-500">Ninguém neste grupo no período.</li>
    </ul>
  </Dialog>
</template>
