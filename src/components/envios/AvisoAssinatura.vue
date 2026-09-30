<script setup>
// Faixa que explica por que os envios estão bloqueados pela assinatura e leva para a tela de Assinatura.
import { useRouter } from 'vue-router';

defineProps({
  mensagem: { type: String, required: true },
  titulo: { type: String, default: 'Os envios estão pausados' },
  botao: { type: String, default: 'Ver assinatura' },
});
const router = useRouter();
</script>

<template>
  <div role="alert" class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10">
    <i class="pi pi-lock text-rose-600 dark:text-rose-400 text-lg shrink-0"></i>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-rose-800 dark:text-rose-200">{{ titulo }}</p>
      <p class="text-sm text-rose-700 dark:text-rose-300 mt-0.5">{{ mensagem }}</p>
    </div>
    <button @click="router.push('/assinatura')"
      class="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold whitespace-nowrap shrink-0">
      <i class="pi pi-wallet text-xs"></i>{{ botao }}
    </button>
  </div>
</template>
