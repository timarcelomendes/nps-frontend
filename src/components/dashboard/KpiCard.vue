<script setup>
// Cartão de indicador da Visão geral. Só "levanta" no hover quando é clicável.
defineProps({
  titulo: { type: String, required: true },
  icone: { type: String, default: '' },
  clicavel: { type: Boolean, default: false },
  ajuda: { type: String, default: '' },
});
defineEmits(['click']);
</script>

<template>
  <component :is="clicavel ? 'button' : 'div'" type="button" @click="clicavel && $emit('click')"
    class="text-left w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-3 shadow-sm"
    :class="clicavel ? 'hover:border-orange-300 dark:hover:border-orange-500/40 hover:shadow-md transition-all cursor-pointer' : ''">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
        <i v-if="icone" :class="[icone, 'text-slate-400 text-sm']"></i>{{ titulo }}
      </span>
      <i v-if="ajuda" class="pi pi-info-circle text-slate-300 dark:text-slate-600 text-sm" v-tooltip.top="ajuda"></i>
      <i v-else-if="clicavel" class="pi pi-angle-right text-slate-300 text-sm"></i>
    </div>
    <slot />
  </component>
</template>
