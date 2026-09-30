<script setup>
// Aba Geral (avançada): endereço em uso e limpeza dos dados guardados no navegador.
import CfgSecao from './CfgSecao.vue';
import { useConfig } from './useConfiguracoes';

const cfg = useConfig();
const origem = window.location.origin;

const limparNavegador = () => {
  localStorage.removeItem('nps_ver_arquivados');
  cfg.ok('Pronto', 'Recarregando a página com os dados atualizados...');
  setTimeout(() => window.location.reload(), 1500);
};
</script>

<template>
  <div class="flex flex-col gap-5">
    <CfgSecao titulo="Endereço da Rakiti" icone="pi-link" descricao="Endereço detectado automaticamente e usado nos links de login e de retorno. Não precisa alterar.">
      <p class="text-sm font-mono text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 break-all">{{ origem }}</p>
    </CfgSecao>
    <CfgSecao titulo="Limpar dados deste navegador" icone="pi-eraser" descricao="Resolve logo desatualizado ou filtros antigos presos na tela. Não apaga nada da sua conta.">
      <button class="cfg-btn-secundario" @click="limparNavegador"><i class="pi pi-refresh text-xs"></i>Limpar e recarregar</button>
    </CfgSecao>
  </div>
</template>
