<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300 relative overflow-hidden font-sans">
    
    <div class="fixed inset-0 z-0 opacity-40 dark:opacity-100 pointer-events-none">
      <div v-for="n in 50" :key="n" 
           class="absolute bg-slate-300 dark:bg-white rounded-full animate-twinkle"
           :style="{
             width: Math.random() * 3 + 'px',
             height: Math.random() * 3 + 'px',
             top: Math.random() * 100 + '%',
             left: Math.random() * 100 + '%',
             animationDelay: Math.random() * 5 + 's',
             animationDuration: Math.random() * 3 + 2 + 's'
           }">
      </div>
    </div>

    <div class="w-full max-w-md z-10 animate-fadein">
      <div class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 md:p-10 rounded-[2rem] shadow-2xl border border-white/20 dark:border-slate-800/50">
        
        <div class="flex flex-col items-center mb-8 text-center">
          <div class="w-16 h-16 mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <i class="pi pi-refresh text-orange-500 text-3xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Recuperar Senha</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Insira o seu e-mail para receber o link.</p>
        </div>

        <transition name="fade-slide" mode="out-in">
          <div v-if="!enviado" key="form">
            <form @submit.prevent="recuperarSenha" class="space-y-6">
              <div class="space-y-2">
                <label class="text-[10px] font-bold uppercase text-slate-400 ml-1 tracking-widest">E-mail Corporativo</label>
                <InputText v-model="email" type="email" placeholder="exemplo@empresa.com" class="custom-input w-full" required />
              </div>

              <Button type="submit" :loading="loading" class="w-full !bg-sky-500 hover:!bg-sky-600 !border-none !py-4 !rounded-xl !font-bold !text-white transition-all shadow-lg shadow-sky-500/20">
                {{ loading ? 'Enviando...' : 'Enviar Instruções' }}
              </Button>
            </form>
          </div>

          <div v-else key="sucesso" class="text-center py-4">
            <div class="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="pi pi-check text-green-500 text-2xl"></i>
            </div>
            <p class="font-bold text-slate-800 dark:text-white">E-mail enviado!</p>
            <p class="text-sm text-slate-500 mt-1">Verifique a sua caixa de entrada.</p>
          </div>
        </transition>

        <div class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <button @click="router.push('/login')" class="text-xs font-bold text-slate-400 hover:text-orange-500 transition-colors bg-transparent border-none cursor-pointer flex items-center justify-center gap-2 mx-auto">
            <i class="pi pi-arrow-left text-[10px]"></i> Voltar ao Login
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '../services/api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const router = useRouter();
const toast = useToast();
const email = ref('');
const loading = ref(false);
const enviado = ref(false);

const recuperarSenha = async () => {
  if (!email.value) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Insira o e-mail.', life: 3000 });
    return;
  }
  loading.value = true;
  try {
    await api.post('/esqueci-senha', { email: email.value });
    enviado.value = true;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'E-mail não encontrado.', life: 5000 });
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
@reference "../style.css";

.animate-fadein { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}
.animate-twinkle { animation: twinkle infinite ease-in-out; }

:deep(.custom-input) {
  @apply bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-slate-800 dark:text-white;
}

.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: scale(0.95); }
.fade-slide-leave-to { opacity: 0; transform: scale(1.05); }
</style>