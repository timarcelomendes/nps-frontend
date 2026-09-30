<script setup>
import { ref } from 'vue';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';
import { temPermissao } from '../utils/permissoes';

import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';

const toast = useToast();

const isProcessando = ref(false);
const dialogVisivel = ref(false);
const acaoSelecionada = ref(null); // 'respostas' ou 'clientes'
const textoConfirmacao = ref('');

const abrirConfirmacao = (tipo) => {
  acaoSelecionada.value = tipo;
  textoConfirmacao.value = '';
  dialogVisivel.value = true;
};

const executarLimpeza = async () => {
  if (textoConfirmacao.value !== 'APAGAR') return;
  
  isProcessando.value = true;
  try {
    const response = await api.delete(`/admin/limpar-dados?tipo=${acaoSelecionada.value}`);
    toast.add({ severity: 'success', summary: 'Operação Concluída', detail: response.data.message, life: 5000 });
    dialogVisivel.value = false;
  } catch (error) {
    const msg = error.response?.data?.detail || 'Ocorreu um erro crítico ao limpar os dados.';
    toast.add({ severity: 'error', summary: 'Falha na Exclusão', detail: msg, life: 6000 });
  } finally {
    isProcessando.value = false;
  }
};
</script>

<template>
  <div class="max-w-5xl mx-auto animate-fadein p-4 lg:p-8">
    
    <div class="mb-8">
      <h1 class="text-3xl font-black text-slate-800 dark:text-white tracking-tight italic flex items-center gap-3">
        <i class="pi pi-database text-rose-500"></i> Administração de Dados
      </h1>
      <p class="text-xs text-slate-500 font-medium mt-1">Gestão massiva e limpeza da base de dados do sistema.</p>
    </div>

    <div v-if="!temPermissao('admin')" class="bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/30 p-12 rounded-[2rem] text-center">
      <div class="w-20 h-20 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6"><i class="pi pi-lock"></i></div>
      <h2 class="text-2xl font-black text-rose-600 dark:text-rose-400 mb-2">Acesso Restrito</h2>
      <p class="text-slate-600 dark:text-slate-300 font-medium max-w-md mx-auto">
        Apenas usuários com o perfil de Administrador têm permissão para acessar a área de exclusão em massa.
      </p>
    </div>

    <div v-else class="space-y-6">
      <div class="bg-rose-50/50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 p-6 md:p-8 rounded-[2rem] shadow-sm">
        <h3 class="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-2 mb-6">
          <i class="pi pi-exclamation-triangle animate-pulse"></i> Zona de Risco (Zona de Perigo)
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-[1.5rem] flex flex-col justify-between shadow-sm">
            <div>
              <h4 class="text-lg font-black text-slate-800 dark:text-white mb-2">Limpar Histórico</h4>
              <p class="text-[11px] text-slate-500 leading-relaxed mb-6 font-medium">
                Apaga <span class="text-rose-500 font-bold">todas as notas e comentários</span> de NPS. Os clientes e as contas permanecerão intactos.
              </p>
            </div>
            <Button 
              label="Apagar Apenas Respostas" 
              icon="pi pi-trash" 
              class="!bg-white dark:!bg-slate-800 !text-rose-500 !border-2 !border-rose-200 dark:!border-rose-500/30 hover:!bg-rose-50 dark:hover:!bg-rose-500/10 !w-full !rounded-xl !font-black !uppercase !tracking-widest !text-[10px]" 
              @click="abrirConfirmacao('respostas')" 
            />
          </div>

          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-[1.5rem] flex flex-col justify-between shadow-sm">
            <div>
              <h4 class="text-lg font-black text-slate-800 dark:text-white mb-2">Limpar Clientes</h4>
              <p class="text-[11px] text-slate-500 leading-relaxed mb-6 font-medium">
                Apaga <span class="text-orange-500 font-bold">todos os clientes e as suas respostas</span>. As empresas cadastradas permanecerão no sistema.
              </p>
            </div>
            <Button 
              label="Apagar Clientes" 
              icon="pi pi-users" 
              class="!bg-white dark:!bg-slate-800 !text-orange-500 !border-2 !border-orange-200 dark:!border-orange-500/30 hover:!bg-orange-50 dark:hover:!bg-orange-500/10 !w-full !rounded-xl !font-black !uppercase !tracking-widest !text-[10px]" 
              @click="abrirConfirmacao('clientes')" 
            />
          </div>

          <div class="bg-rose-500 dark:bg-rose-600 border border-rose-600 dark:border-rose-500 p-6 rounded-[1.5rem] flex flex-col justify-between shadow-lg shadow-rose-500/20">
            <div>
              <h4 class="text-lg font-black text-white mb-2 flex items-center gap-2">
                <i class="pi pi-building"></i> Wipe Total
              </h4>
              <p class="text-[11px] text-rose-100 leading-relaxed mb-6 font-medium">
                Apaga <span class="font-bold underline">absolutamente tudo</span>: Contas, Clientes e Respostas. Use isto para reiniciar o CRM do zero.
              </p>
            </div>
            <Button 
              label="Apagar Toda a Base" 
              icon="pi pi-warning" 
              class="!bg-white !text-rose-600 !border-none hover:scale-[1.02] transition-transform !w-full !rounded-xl !font-black !uppercase !tracking-widest !text-[10px] shadow-sm" 
              @click="abrirConfirmacao('empresas')" 
            />
          </div>

        </div>
      </div>
    </div>

    <Dialog v-model:visible="dialogVisivel" modal :closable="!isProcessando" class="custom-dialog w-full max-w-md mx-4">
      <template #header>
        <span class="text-lg font-black italic tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
          <i class="pi pi-shield text-rose-500"></i> Confirmação de Segurança
        </span>
      </template>
      
      <div class="py-4">
        <p class="text-sm text-slate-600 dark:text-slate-300 font-medium mb-4 leading-relaxed">
          Você está prestes a apagar 
          <span class="font-black text-rose-500">
            {{ acaoSelecionada === 'respostas' ? 'TODAS AS RESPOSTAS NPS' : 'TODOS OS CLIENTES E RESPOSTAS' }}
          </span>. 
          Esta ação <span class="underline">não pode ser desfeita</span>.
        </p>

        <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
          <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Para prosseguir, digite APAGAR abaixo:</label>
          <InputText v-model="textoConfirmacao" class="w-full !bg-white dark:!bg-slate-900 !font-mono !font-bold !text-center !text-rose-500" placeholder="APAGAR" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between w-full border-t border-slate-100 dark:border-slate-800 pt-4">
          <Button label="Cancelar" text class="!text-slate-500 !font-black !uppercase !tracking-widest !text-[10px]" @click="dialogVisivel = false" :disabled="isProcessando" />
          <Button 
            label="Confirmar Exclusão" 
            icon="pi pi-trash" 
            :loading="isProcessando"
            :disabled="textoConfirmacao !== 'APAGAR'"
            class="!bg-rose-500 hover:!bg-rose-600 !text-white !border-none !rounded-xl !font-black !uppercase !tracking-widest !text-[10px] shadow-lg shadow-rose-500/20" 
            @click="executarLimpeza" 
          />
        </div>
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
@reference "../style.css";
.animate-fadein { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

:deep(.custom-dialog .p-dialog-header) { @apply bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-5; }
:deep(.custom-dialog .p-dialog-content) { @apply dark:bg-slate-900 px-6; }
:deep(.custom-dialog .p-dialog-footer) { @apply dark:bg-slate-900 px-6 pb-5; }
</style>