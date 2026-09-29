<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api';

const route = useRoute();
const token = route.params.token;

const estado = ref('carregando'); // carregando | form | enviado | respondida | erro
const pesquisa = ref(null);
const nota = ref(null);
const comentario = ref('');
const enviando = ref(false);
const erro = ref('');

const ROSTOS = [
  { n: 1, emoji: '😡', rotulo: 'Péssimo' },
  { n: 2, emoji: '🙁', rotulo: 'Ruim' },
  { n: 3, emoji: '😐', rotulo: 'Regular' },
  { n: 4, emoji: '🙂', rotulo: 'Bom' },
  { n: 5, emoji: '😍', rotulo: 'Excelente' },
];

const ehNps = computed(() => pesquisa.value?.tipo !== 'csat');

const corNps = (n) => {
  const ativo = nota.value === n;
  if (n <= 6) return ativo ? 'bg-red-500 text-white border-red-500' : 'border-red-200 text-red-600 hover:bg-red-50';
  if (n <= 8) return ativo ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-200 text-amber-600 hover:bg-amber-50';
  return ativo ? 'bg-emerald-500 text-white border-emerald-500' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50';
};

const perguntaComentario = computed(() => {
  if (nota.value === null) return 'Quer contar mais? (opcional)';
  if (ehNps.value) {
    if (nota.value <= 6) return 'O que podemos melhorar?';
    if (nota.value <= 8) return 'O que faltou para você dar nota 10?';
    return 'Que bom! O que você mais gosta?';
  }
  return nota.value <= 3 ? 'O que deu errado?' : 'Quer deixar um comentário? (opcional)';
});

onMounted(async () => {
  try {
    const { data } = await api.get(`/pesquisa/${token}`);
    pesquisa.value = data;
    document.title = `Pesquisa — ${data.empresa}`;
    if (data.respondida) { estado.value = 'respondida'; return; }
    const n = parseInt(route.query.nota, 10);
    const min = data.tipo === 'csat' ? 1 : 0;
    const max = data.tipo === 'csat' ? 5 : 10;
    if (!Number.isNaN(n) && n >= min && n <= max) nota.value = n;
    estado.value = 'form';
  } catch (e) {
    erro.value = e.response?.data?.detail || 'Não foi possível abrir a pesquisa.';
    estado.value = 'erro';
  }
});

const enviar = async () => {
  if (nota.value === null) { erro.value = 'Escolha uma nota para continuar.'; return; }
  enviando.value = true;
  erro.value = '';
  try {
    await api.post(`/pesquisa/${token}`, { nota: nota.value, comentario: comentario.value });
    estado.value = 'enviado';
  } catch (e) {
    erro.value = e.response?.data?.detail || 'Não foi possível enviar. Tente novamente.';
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen w-full bg-slate-100 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12 text-slate-900">
    <div class="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">

      <div v-if="estado === 'carregando'" class="py-16 text-center text-slate-400">
        <i class="pi pi-spin pi-spinner text-2xl"></i>
      </div>

      <div v-else-if="estado === 'erro'" class="py-10 text-center">
        <div class="text-4xl mb-3">🔗</div>
        <h1 class="text-lg font-bold mb-1">Link inválido</h1>
        <p class="text-slate-500 text-sm">{{ erro }}</p>
      </div>

      <div v-else-if="estado === 'respondida'" class="py-10 text-center">
        <div class="text-4xl mb-3">✅</div>
        <h1 class="text-lg font-bold mb-1">Você já respondeu esta pesquisa</h1>
        <p class="text-slate-500 text-sm">Obrigado pela sua opinião, ela ajuda a {{ pesquisa?.empresa }} a melhorar.</p>
      </div>

      <div v-else-if="estado === 'enviado'" class="py-10 text-center">
        <div class="text-5xl mb-3">🙏</div>
        <h1 class="text-xl font-bold mb-1">Obrigado{{ pesquisa?.nome ? ', ' + pesquisa.nome : '' }}!</h1>
        <p class="text-slate-500 text-sm">Sua resposta foi enviada para a equipe da {{ pesquisa?.empresa }}.</p>
      </div>

      <form v-else @submit.prevent="enviar">
        <p class="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-4">{{ pesquisa.empresa }}</p>
        <p v-if="pesquisa.nome" class="text-slate-500 mb-1">Olá, {{ pesquisa.nome }}!</p>
        <h1 class="text-xl sm:text-2xl font-bold leading-snug mb-1">{{ pesquisa.pergunta }}</h1>
        <p v-if="pesquisa.referencia" class="text-xs text-slate-400 mb-4">Referência: {{ pesquisa.referencia }}</p>

        <!-- NPS 0 a 10 -->
        <div v-if="ehNps" class="mt-6">
          <div class="grid grid-cols-6 sm:grid-cols-11 gap-2">
            <button v-for="n in 11" :key="n - 1" type="button" @click="nota = n - 1"
              :aria-pressed="nota === n - 1"
              :class="['h-11 rounded-lg border-2 font-bold transition-colors', corNps(n - 1)]">
              {{ n - 1 }}
            </button>
          </div>
          <div class="flex justify-between text-xs text-slate-400 mt-2">
            <span>Nada provável</span><span>Muito provável</span>
          </div>
        </div>

        <!-- CSAT 1 a 5 -->
        <div v-else class="mt-6 grid grid-cols-5 gap-2">
          <button v-for="r in ROSTOS" :key="r.n" type="button" @click="nota = r.n"
            :aria-pressed="nota === r.n"
            :class="['flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all',
              nota === r.n ? 'border-orange-500 bg-orange-50 scale-105' : 'border-slate-200 hover:border-slate-300']">
            <span class="text-3xl sm:text-4xl">{{ r.emoji }}</span>
            <span class="text-[11px] text-slate-500">{{ r.rotulo }}</span>
          </button>
        </div>

        <label class="block mt-6 text-sm font-semibold text-slate-700" for="comentario">{{ perguntaComentario }}</label>
        <textarea id="comentario" v-model="comentario" rows="3" maxlength="4000"
          class="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Escreva aqui..."></textarea>

        <p v-if="erro" class="mt-3 text-sm text-red-600">{{ erro }}</p>

        <button type="submit" :disabled="enviando"
          class="mt-5 w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold transition-colors">
          {{ enviando ? 'Enviando...' : 'Enviar resposta' }}
        </button>
        <p class="text-center text-[11px] text-slate-400 mt-4">Pesquisa feita com Rakiti</p>
      </form>
    </div>
  </div>
</template>
