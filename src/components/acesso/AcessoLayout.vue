<script setup>
// Moldura comum das telas de acesso: fundo, botão de tema, marca e cartão central.
import { ref, onMounted, useSlots } from 'vue';

const slots = useSlots();
const escuro = ref(false);

onMounted(() => {
  const salvo = localStorage.getItem('darkMode');
  escuro.value = salvo === 'true' || (salvo === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', escuro.value);
});

const alternarTema = () => {
  escuro.value = !escuro.value;
  document.documentElement.classList.toggle('dark', escuro.value);
  localStorage.setItem('darkMode', String(escuro.value));
};
</script>

<template>
  <!-- -m-6/-m-8 anula o padding que o App.vue aplica em volta do router-view nestas rotas -->
  <div class="-m-6 md:-m-8 min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
    <header class="flex items-center justify-between px-4 md:px-8 pt-4">
      <p class="text-2xl font-black text-slate-900 dark:text-white">rakiti<span class="text-orange-500">.</span></p>
      <button type="button" @click="alternarTema" :aria-label="escuro ? 'Usar tema claro' : 'Usar tema escuro'" :title="escuro ? 'Tema claro' : 'Tema escuro'"
        class="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 acesso-foco">
        <i :class="escuro ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true"></i>
      </button>
    </header>

    <div class="flex-1 flex items-center justify-center px-4 py-8">
      <div :class="['w-full grid grid-cols-1 gap-10 items-center', slots.lateral ? 'max-w-5xl lg:grid-cols-2' : 'max-w-md']">
        <section v-if="slots.lateral" class="hidden lg:block">
          <slot name="lateral" />
        </section>
        <section class="w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
          <slot />
        </section>
      </div>
    </div>

    <footer class="px-4 pb-4 text-center text-xs text-slate-500 dark:text-slate-400">
      Rakiti © {{ new Date().getFullYear() }} ·
      <a href="/termos" class="hover:text-orange-600 dark:hover:text-orange-400 underline-offset-2 hover:underline acesso-foco">Termos</a> ·
      <a href="/privacidade" class="hover:text-orange-600 dark:hover:text-orange-400 underline-offset-2 hover:underline acesso-foco">Privacidade</a>
    </footer>
  </div>
</template>

<!-- Estilos compartilhados pelas três telas de acesso (sem scoped para valerem no conteúdo do slot). -->
<style>
@reference "../../style.css";

.acesso-foco {
  @apply outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900;
}
.acesso-rotulo {
  @apply block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1;
}
.acesso-campo {
  @apply w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30;
}
.acesso-campo[aria-invalid="true"] {
  @apply border-rose-500 dark:border-rose-500 focus:ring-rose-500/30;
}
.acesso-erro-campo {
  @apply mt-1 text-sm text-rose-600 dark:text-rose-400;
}
.acesso-botao {
  @apply w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900;
}
.acesso-botao-sec {
  @apply w-full h-12 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-orange-500;
}
.acesso-link {
  @apply font-semibold text-orange-700 dark:text-orange-400 hover:underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-sm;
}
</style>
