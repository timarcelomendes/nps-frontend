<script setup>
// Caixa de aviso das telas de acesso (sucesso, erro, atenção, informação), anunciada por leitores de tela.
import { computed } from 'vue';

const props = defineProps({
  tipo: { type: String, default: 'info' }, // sucesso | erro | atencao | info
  titulo: { type: String, default: '' },
});
const estilos = {
  sucesso: ['bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200', 'pi-check-circle'],
  erro: ['bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-200', 'pi-times-circle'],
  atencao: ['bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200', 'pi-exclamation-triangle'],
  info: ['bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200', 'pi-info-circle'],
};
const estilo = computed(() => estilos[props.tipo] || estilos.info);
</script>

<template>
  <div :class="['rounded-xl border p-4 flex gap-3 text-sm leading-relaxed', estilo[0]]" :role="tipo === 'erro' ? 'alert' : 'status'">
    <i :class="['pi mt-0.5 shrink-0', estilo[1]]" aria-hidden="true"></i>
    <div class="min-w-0">
      <p v-if="titulo" class="font-bold">{{ titulo }}</p>
      <div><slot /></div>
    </div>
  </div>
</template>
