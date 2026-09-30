<script setup>
// Pedido de link para criar uma nova senha. A resposta é sempre a mesma, exista ou não a conta.
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../services/api';
import AcessoLayout from '../components/acesso/AcessoLayout.vue';
import AvisoAcesso from '../components/acesso/AvisoAcesso.vue';
import { emailValido, comAvisoDeDemora, mensagemGenerica, TEMPO_LIMITE } from '../components/acesso/acesso.js';

const route = useRoute();
const router = useRouter();
const email = ref('');
const erroEmail = ref('');
const erro = ref('');
const enviando = ref(false);
const lento = ref(false);
const enviadoPara = ref('');

onMounted(() => {
  if (typeof route.query.email === 'string') email.value = route.query.email;
});

const recuperarSenha = async () => {
  if (enviando.value) return;
  erro.value = '';
  const alvo = email.value.trim();
  if (!emailValido(alvo)) {
    erroEmail.value = alvo ? 'Digite um e-mail válido, como nome@empresa.com.br.' : 'Digite o e-mail da sua conta.';
    document.getElementById('email')?.focus();
    return;
  }
  enviando.value = true;
  try {
    await comAvisoDeDemora(() => api.post('/esqueci-senha', { email: alvo }, { timeout: TEMPO_LIMITE }), (v) => { lento.value = v; });
    enviadoPara.value = alvo;
  } catch (e) {
    erro.value = mensagemGenerica(e, 'Não foi possível enviar o link. Tente de novo.');
  } finally {
    enviando.value = false;
  }
};

const voltarAoLogin = () => router.push({ path: '/login', query: emailValido(email.value) ? { email: email.value.trim() } : {} });
</script>

<template>
  <AcessoLayout>
    <div v-if="enviadoPara" class="text-center" role="status">
      <div class="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center text-2xl">
        <i class="pi pi-envelope" aria-hidden="true"></i>
      </div>
      <h1 class="text-xl font-bold text-slate-900 dark:text-white mt-4">Confira o seu e-mail</h1>
      <p class="text-slate-600 dark:text-slate-300 mt-2">
        Se existir uma conta com <strong class="break-all">{{ enviadoPara }}</strong>, enviamos um link para criar uma nova senha. O link vale por 30 minutos.
      </p>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-4">Não chegou em alguns minutos? Olhe o spam e confira se o e-mail está certo.</p>
      <div class="flex flex-col gap-3 mt-6">
        <button type="button" class="acesso-botao" @click="voltarAoLogin">Voltar para o login</button>
        <button type="button" class="acesso-botao-sec" @click="enviadoPara = ''">Usar outro e-mail ou enviar de novo</button>
      </div>
    </div>

    <form v-else @submit.prevent="recuperarSenha" class="flex flex-col gap-4" novalidate :aria-busy="enviando">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Esqueceu a senha?</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.</p>
      </div>

      <AvisoAcesso v-if="erro" tipo="erro">{{ erro }}</AvisoAcesso>

      <div>
        <label for="email" class="acesso-rotulo">E-mail</label>
        <input id="email" v-model="email" type="email" name="email" autocomplete="email" inputmode="email" placeholder="nome@empresa.com.br"
          class="acesso-campo" :aria-invalid="erroEmail ? 'true' : undefined" :aria-describedby="erroEmail ? 'email-erro' : undefined" @input="erroEmail = ''" />
        <p v-if="erroEmail" id="email-erro" class="acesso-erro-campo">{{ erroEmail }}</p>
      </div>

      <p v-if="lento" class="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2" role="status">
        <i class="pi pi-spin pi-spinner text-orange-600" aria-hidden="true"></i>
        Conectando ao servidor, isso pode levar alguns segundos.
      </p>

      <button type="submit" class="acesso-botao" :disabled="enviando">
        <i v-if="enviando" class="pi pi-spin pi-spinner" aria-hidden="true"></i>
        {{ enviando ? 'Enviando...' : 'Enviar link' }}
      </button>

      <p class="mt-2 pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-center text-slate-600 dark:text-slate-300">
        Lembrou a senha? <a href="/login" @click.prevent="voltarAoLogin" class="acesso-link">Entrar</a>
      </p>
    </form>
  </AcessoLayout>
</template>
