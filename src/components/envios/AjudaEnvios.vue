<script setup>
// Guia rápido da tela de Envios.
import Sidebar from 'primevue/sidebar';

defineProps({ visible: Boolean, recorrencia: { type: Number, default: 90 } });
const emit = defineEmits(['update:visible']);
</script>

<template>
  <Sidebar :visible="visible" @update:visible="emit('update:visible', $event)" position="right" class="env-ajuda w-full! md:w-[420px]!">
    <template #header>
      <div class="flex flex-col">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Como funcionam os envios</h2>
        <span class="text-sm text-slate-500 dark:text-slate-400">Guia rápido desta tela</span>
      </div>
    </template>

    <div class="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
      <section class="env-ajuda-bloco">
        <h3><i class="pi pi-send text-orange-500"></i>Duas formas de enviar</h3>
        <ul class="list-disc pl-5 flex flex-col gap-1">
          <li><b>Automático:</b> com o envio automático ligado, o sistema confere a fila a cada 6 horas e envia para quem está na vez.</li>
          <li><b>Agora:</b> marque as pessoas na lista e clique em <b>Enviar pesquisa</b>. Sem ninguém marcado, o botão envia para todos que estão na fila.</li>
        </ul>
      </section>

      <section class="env-ajuda-bloco">
        <h3><i class="pi pi-tag text-orange-500"></i>O que cada situação quer dizer</h3>
        <dl class="flex flex-col gap-2">
          <div><dt><span class="env-tag env-tag-neutro">Na fila</span></dt><dd>Vai receber no próximo envio automático ou quando você enviar.</dd></div>
          <div><dt><span class="env-tag env-tag-espera">Aguardando resposta</span></dt><dd>Recebeu o e-mail e ainda não respondeu. Pode receber lembretes.</dd></div>
          <div><dt><span class="env-tag env-tag-ok">Respondeu</span></dt><dd>A resposta chegou. A pessoa só volta para a fila depois de {{ recorrencia }} dias.</dd></div>
          <div><dt><span class="env-tag env-tag-erro">Não saiu</span></dt><dd>O e-mail não foi entregue. A causa aparece na linha; corrija e clique em <b>Tentar de novo</b>.</dd></div>
        </dl>
      </section>

      <section class="env-ajuda-bloco">
        <h3><i class="pi pi-bell text-orange-500"></i>Lembretes</h3>
        <p>Quem não responde recebe até 3 lembretes, nos dias definidos em <b>Regras de envio</b>. Os lembretes saem todo dia às 10h20 e param quando a pessoa responde.</p>
      </section>

      <section class="env-ajuda-bloco">
        <h3><i class="pi pi-history text-orange-500"></i>Histórico</h3>
        <p>Na aba <b>Histórico</b> ficam todos os e-mails enviados aos seus contatos, com data e situação. Os que deram erro mostram o motivo.</p>
      </section>
    </div>
  </Sidebar>
</template>
