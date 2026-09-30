<script setup>
// Caixa de período (intervalo de datas). Vazio = todo o histórico.
import Calendar from 'primevue/calendar';

defineProps({ modelValue: { type: Array, default: null } });
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 min-w-0">
    <i class="pi pi-calendar text-slate-400 text-sm"></i>
    <Calendar :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" selectionMode="range" :manualInput="false"
      dateFormat="dd/mm/yy" placeholder="Todo o histórico" hideOnRangeSelection class="filtro-periodo w-52 min-w-0" />
    <button v-if="modelValue" type="button" @click="emit('update:modelValue', null)" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Ver todo o histórico">
      <i class="pi pi-times text-xs"></i>
    </button>
  </div>
</template>

<style scoped>
:deep(.filtro-periodo .p-inputtext) {
  border: none !important; box-shadow: none !important; background: transparent !important;
  font-size: 0.875rem; padding: 0.25rem 0; color: inherit !important; width: 100%;
}
</style>
