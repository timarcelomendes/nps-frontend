<script setup>
// Linha do tempo da importação: baixar modelo → enviar planilha → conferir → pronto.
defineProps({ atual: { type: Number, required: true } }); // 1 a 4; 5 = tudo concluído
const PASSOS = ['Baixar modelo', 'Enviar planilha', 'Conferir', 'Pronto'];
</script>

<template>
  <ol class="grid grid-cols-4 gap-2" aria-label="Etapas da importação">
    <li v-for="(nome, i) in PASSOS" :key="nome" class="flex flex-col gap-2 min-w-0" :aria-current="atual === i + 1 ? 'step' : undefined">
      <span class="h-1.5 rounded-full" :class="atual > i + 1 ? 'bg-orange-500' : atual === i + 1 ? 'bg-orange-300 dark:bg-orange-500/60' : 'bg-slate-200 dark:bg-slate-800'"></span>
      <span class="flex items-start gap-1 text-xs sm:text-sm font-semibold leading-tight min-w-0"
        :class="atual >= i + 1 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'">
        <i v-if="atual > i + 1" class="pi pi-check text-xs text-orange-500 shrink-0 mt-px"></i>
        <span v-else class="text-xs tabular-nums shrink-0">{{ i + 1 }}.</span>
        <span>{{ nome }}</span>
      </span>
    </li>
  </ol>
</template>
