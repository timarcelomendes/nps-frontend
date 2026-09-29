<script setup>
import Sidebar from 'primevue/sidebar';
defineProps({ visible: { type: Boolean, default: false } });
const emit = defineEmits(['update:visible']);

const ITENS = [
  { titulo: 'NPS', texto: 'Mede a lealdade, de -100 a +100. É a % de promotores menos a % de detratores. Acima de 50 é muito bom; abaixo de 0 pede atenção.' },
  { titulo: 'Promotores, neutros e detratores', texto: 'Notas 9 e 10 são promotores (recomendam você). 7 e 8 são neutros (satisfeitos, mas trocam fácil). 0 a 6 são detratores (risco de perder o cliente).' },
  { titulo: 'Satisfação (CSAT)', texto: 'Pesquisa curta depois de uma entrega ou atendimento, de 1 a 5. Mostramos a % de notas 4 e 5 (satisfeitos).' },
  { titulo: 'Taxa de resposta', texto: 'Quantos dos clientes cadastrados responderam no período. Abaixo de 20% os números podem não representar bem a sua carteira.' },
  { titulo: 'Resgatados e em risco', texto: 'Compara a última resposta de cada cliente com a anterior. Resgatado: era detrator e virou promotor. Em risco: era promotor e caiu.' },
  { titulo: 'Decisores', texto: 'NPS só de quem decide a compra. Aparece quando você marca o perfil "Decisor" nos contatos.' },
  { titulo: 'Assuntos mais citados', texto: 'Agrupa os comentários por assunto (prazo, avarias, atendimento, preço, comunicação, pedidos) e mostra a nota média de quem falou de cada um.' },
];
</script>

<template>
  <Sidebar :visible="visible" @update:visible="emit('update:visible', $event)" position="right" header="Como ler os números" class="w-full md:w-[28rem]">
    <dl class="flex flex-col gap-4">
      <div v-for="i in ITENS" :key="i.titulo" class="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <dt class="font-semibold text-slate-800 dark:text-slate-100 mb-1">{{ i.titulo }}</dt>
        <dd class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{{ i.texto }}</dd>
      </div>
    </dl>
  </Sidebar>
</template>
