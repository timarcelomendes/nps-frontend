<script setup>
// Cadastro próprio da empresa: 14 dias grátis, sem cartão.
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';

const router = useRouter();
const form = ref({ empresa: '', nome: '', email: '', senha: '', telefone: '', aceite_termos: false });
const mostrarSenha = ref(false);
const enviando = ref(false);
const erro = ref('');
const concluido = ref('');
const planos = ref({});
const diasTeste = ref(14);

onMounted(async () => {
  try {
    const { data } = await api.get('/planos');
    planos.value = data.planos; diasTeste.value = data.dias_teste;
  } catch (e) { /* a página funciona sem a lista de planos */ }
});

const regrasSenha = (s) => [
  { ok: s.length >= 8, texto: '8 caracteres' },
  { ok: /[A-Z]/.test(s), texto: 'uma maiúscula' },
  { ok: /[0-9]/.test(s), texto: 'um número' },
  { ok: /[^A-Za-z0-9]/.test(s), texto: 'um símbolo' },
];

const cadastrar = async () => {
  erro.value = '';
  if (!form.value.aceite_termos) { erro.value = 'Para continuar, aceite os termos de uso e a política de privacidade.'; return; }
  enviando.value = true;
  try {
    const { data } = await api.post('/cadastro-empresa', form.value);
    concluido.value = data.message;
  } catch (e) {
    erro.value = e.response?.status === 429 ? 'Muitas tentativas. Aguarde um minuto.' : (e.response?.data?.detail || 'Não foi possível criar a conta.');
  } finally {
    enviando.value = false;
  }
};
const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
      <!-- Proposta -->
      <div class="order-2 lg:order-1">
        <p class="text-2xl font-black text-slate-900 dark:text-white">rakiti<span class="text-orange-500">.</span></p>
        <h1 class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mt-6 leading-tight">
          Saiba quem está insatisfeito<br class="hidden md:block" /> antes de perder o cliente.
        </h1>
        <p class="text-slate-600 dark:text-slate-300 mt-4">Pesquisas de NPS e satisfação por e-mail e link, com alerta para notas baixas e plano de ação. Feito para distribuidoras, transportadoras e PMEs.</p>
        <ul class="mt-6 flex flex-col gap-2 text-slate-700 dark:text-slate-200">
          <li><i class="pi pi-check-circle text-emerald-500 mr-2"></i>{{ diasTeste }} dias grátis, sem cartão</li>
          <li><i class="pi pi-check-circle text-emerald-500 mr-2"></i>Formulários prontos: é só importar os clientes</li>
          <li><i class="pi pi-check-circle text-emerald-500 mr-2"></i>Pague por Pix, boleto ou cartão. Cancele quando quiser</li>
        </ul>
        <div v-if="Object.keys(planos).length" class="mt-8 grid grid-cols-3 gap-2">
          <div v-for="(p, chave) in planos" :key="chave" class="rounded-xl border p-3 bg-white dark:bg-slate-900"
            :class="p.recomendado ? 'border-orange-300' : 'border-slate-200 dark:border-slate-800'">
            <p class="text-sm font-bold text-slate-800 dark:text-white">{{ p.nome }}</p>
            <p class="text-lg font-black text-slate-900 dark:text-white">{{ moeda(p.preco) }}<span class="text-xs font-normal text-slate-500">/mês</span></p>
            <p class="text-xs text-slate-500">{{ p.limite_clientes ? `até ${p.limite_clientes.toLocaleString('pt-BR')} clientes` : 'clientes ilimitados' }}</p>
          </div>
        </div>
      </div>

      <!-- Formulário -->
      <div class="order-1 lg:order-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
        <template v-if="concluido">
          <div class="text-center py-6">
            <div class="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center text-2xl"><i class="pi pi-envelope"></i></div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white mt-4">Confira o seu e-mail</h2>
            <p class="text-slate-600 dark:text-slate-300 mt-2">{{ concluido }}</p>
            <p class="text-sm text-slate-500 mt-4">Não chegou? Olhe a caixa de spam ou promoções.</p>
            <button @click="router.push('/login')" class="mt-6 h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold">Ir para o login</button>
          </div>
        </template>
        <form v-else @submit.prevent="cadastrar" class="flex flex-col gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Crie a conta da sua empresa</h2>
            <p class="text-sm text-slate-500">Leva menos de 1 minuto.</p>
          </div>
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Nome da empresa
            <input v-model="form.empresa" required maxlength="200" autocomplete="organization" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
          </label>
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Seu nome
            <input v-model="form.nome" required maxlength="150" autocomplete="name" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail
              <input v-model="form.email" type="email" required autocomplete="email" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
            </label>
            <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">WhatsApp <span class="font-normal text-slate-400">(opcional)</span>
              <input v-model="form.telefone" type="tel" autocomplete="tel" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
            </label>
          </div>
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Senha
            <div class="relative">
              <input v-model="form.senha" :type="mostrarSenha ? 'text' : 'password'" required autocomplete="new-password" class="w-full h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 pr-10 font-normal" />
              <button type="button" @click="mostrarSenha = !mostrarSenha" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" :aria-label="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"><i :class="mostrarSenha ? 'pi pi-eye-slash' : 'pi pi-eye'"></i></button>
            </div>
            <span class="flex flex-wrap gap-x-3 font-normal text-xs">
              <span v-for="r in regrasSenha(form.senha)" :key="r.texto" :class="r.ok ? 'text-emerald-600' : 'text-slate-400'"><i :class="['pi text-[10px] mr-0.5', r.ok ? 'pi-check' : 'pi-circle']"></i>{{ r.texto }}</span>
            </span>
          </label>
          <label class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" v-model="form.aceite_termos" class="mt-1 accent-orange-500" />
            <span>Li e aceito os <a href="/termos" target="_blank" class="text-orange-600 underline">termos de uso</a> e a <a href="/privacidade" target="_blank" class="text-orange-600 underline">política de privacidade</a>.</span>
          </label>
          <p v-if="erro" class="text-sm text-rose-600">{{ erro }}</p>
          <button type="submit" :disabled="enviando" class="h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-60">
            {{ enviando ? 'Criando...' : `Começar ${diasTeste} dias grátis` }}
          </button>
          <p class="text-center text-sm text-slate-500">Já tem conta? <a href="/login" @click.prevent="router.push('/login')" class="font-semibold text-slate-800 dark:text-white hover:text-orange-600">Entrar</a></p>
        </form>
      </div>
    </div>
  </div>
</template>
