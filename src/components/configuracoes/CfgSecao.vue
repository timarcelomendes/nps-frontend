<script setup>
// Cartão de uma seção das Configurações: título, uma linha explicando para que serve e o conteúdo.
defineProps({
  titulo: { type: String, required: true },
  descricao: { type: String, default: '' },
  icone: { type: String, default: '' },
  selo: { type: String, default: '' }, // 'essencial' | 'opcional' | ''
});
</script>

<template>
  <section class="cfg-card">
    <header class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
      <div class="flex items-start gap-3 min-w-0">
        <span v-if="icone" class="w-9 h-9 shrink-0 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
          <i :class="['pi', icone]"></i>
        </span>
        <div class="min-w-0">
          <h2 class="text-base font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
            {{ titulo }}
            <span v-if="selo === 'essencial'" class="cfg-selo cfg-selo-essencial">Essencial</span>
            <span v-else-if="selo === 'opcional'" class="cfg-selo">Opcional</span>
          </h2>
          <p v-if="descricao" class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ descricao }}</p>
        </div>
      </div>
      <div v-if="$slots.acoes" class="flex flex-wrap items-center gap-2 shrink-0">
        <slot name="acoes" />
      </div>
    </header>
    <slot />
  </section>
</template>
