<script setup>
// Guia lateral: como usar o quadro de Planos de Ação.
import Sidebar from 'primevue/sidebar';
import './acoes.css';

defineProps({
  visible: { type: Boolean, default: false },
  regras: { type: Object, required: true },
});
const emit = defineEmits(['update:visible']);
</script>

<template>
  <Sidebar :visible="visible" @update:visible="emit('update:visible', $event)" position="right" header="Como usar os Planos de Ação" class="acoes-ajuda w-full md:w-[28rem]">
    <div class="flex flex-col gap-4">
      <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        Cada nota baixa vira uma ação. O objetivo é <b>falar com o cliente</b>, resolver o problema e registrar o que foi feito.
      </p>

      <section class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100 mb-3">O passo a passo</h3>
        <ol class="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
          <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 text-xs font-bold flex items-center justify-center">1</span>
            <span><b>A fazer:</b> ações novas. Clique em <b>Começar</b> quando alguém assumir o caso.</span></li>
          <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 text-xs font-bold flex items-center justify-center">2</span>
            <span><b>Em andamento:</b> fale com o cliente e clique em <b>Registrar contato</b> para anotar o que foi combinado.</span></li>
          <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 text-xs font-bold flex items-center justify-center">3</span>
            <span><b>Concluído:</b> para concluir é preciso ter um responsável e o registro do contato.</span></li>
        </ol>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-3">No computador você também pode arrastar os cartões entre as colunas. No celular, use o botão <i class="pi pi-ellipsis-v text-xs"></i> do cartão.</p>
      </section>

      <section class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100 mb-1">Prazos padrão</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Contados a partir da criação, quando a ação não tem prazo próprio. Mude em Configurações.</p>
        <ul class="flex flex-col gap-2 text-sm">
          <li class="flex items-center justify-between gap-3"><span class="text-slate-700 dark:text-slate-200"><span class="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 mr-2"></span>Detratores (nota 0 a 6)</span><b class="text-slate-800 dark:text-slate-100">{{ regras.sla_detrator_dias }} dias</b></li>
          <li class="flex items-center justify-between gap-3"><span class="text-slate-700 dark:text-slate-200"><span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-2"></span>Neutros (nota 7 e 8)</span><b class="text-slate-800 dark:text-slate-100">{{ regras.sla_neutro_dias }} dias</b></li>
          <li class="flex items-center justify-between gap-3"><span class="text-slate-700 dark:text-slate-200"><span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></span>Promotores (nota 9 e 10)</span><b class="text-slate-800 dark:text-slate-100">{{ regras.sla_promotor_dias }} dias</b></li>
        </ul>
      </section>

      <section class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h3 class="font-semibold text-slate-800 dark:text-slate-100 mb-2">Cores do prazo</h3>
        <ul class="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
          <li><span class="px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">Venceu há 2 dias</span> passou do prazo: trate primeiro.</li>
          <li><span class="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Vence hoje</span> vence hoje ou amanhã.</li>
          <li><span class="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Prazo 04/10</span> dentro do prazo.</li>
        </ul>
      </section>

      <p class="text-sm text-slate-500 dark:text-slate-400 italic">
        Um cliente insatisfeito que tem o problema resolvido rápido costuma voltar a recomendar a sua empresa.
      </p>
    </div>
  </Sidebar>
</template>
