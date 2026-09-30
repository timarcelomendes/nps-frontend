<script setup>
// Estado vazio das tabelas de Clientes: diz o que aconteceu e qual é o próximo passo.
defineProps({
  icone: { type: String, default: 'pi-inbox' },
  titulo: { type: String, required: true },
  texto: { type: String, default: '' },
});
</script>

<template>
  <div class="py-10 px-4 flex flex-col items-center text-center">
    <span class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
      <i :class="['pi', icone, 'text-xl']"></i>
    </span>
    <p class="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">{{ titulo }}</p>
    <p v-if="texto" class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">{{ texto }}</p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
