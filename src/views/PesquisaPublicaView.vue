<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../services/api';
import FormularioRenderer from '../components/FormularioRenderer.vue';

// Atende dois endereços:
//   /r/:token   convite individual (e-mail, WhatsApp, integração)
//   /f/:codigo  link público do formulário (site, QR Code, redes sociais)
const route = useRoute();
const publico = computed(() => !!route.params.codigo);
const endpoint = computed(() => (publico.value ? `/pesquisa/f/${route.params.codigo}` : `/pesquisa/${route.params.token}`));

const estado = ref('carregando'); // carregando | form | respondida | erro
const dados = ref(null);
const enviando = ref(false);
const concluido = ref(false);
const erro = ref('');

const notaInicial = computed(() => {
  const n = parseInt(route.query.nota, 10);
  return Number.isNaN(n) ? null : n;
});

onMounted(async () => {
  try {
    const { data } = await api.get(endpoint.value);
    dados.value = data;
    document.title = `Pesquisa — ${data.empresa}`;
    estado.value = data.respondida ? 'respondida' : 'form';
  } catch (e) {
    erro.value = e.response?.data?.detail || 'Não foi possível abrir a pesquisa.';
    estado.value = 'erro';
  }
});

const enviar = async (respostas) => {
  enviando.value = true;
  erro.value = '';
  try {
    await api.post(endpoint.value, { respostas, referencia: route.query.ref || '' });
    concluido.value = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    erro.value = e.response?.status === 429
      ? 'Muitas respostas em sequência. Aguarde um minuto e tente de novo.'
      : e.response?.data?.detail || 'Não foi possível enviar. Tente novamente.';
  } finally {
    enviando.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen w-full bg-slate-100 flex items-start sm:items-center justify-center px-4 py-8 sm:py-12 text-slate-900">
    <div class="w-full max-w-xl">
      <div v-if="estado === 'carregando'" class="py-16 text-center text-slate-400">
        <i class="pi pi-spin pi-spinner text-2xl"></i>
      </div>

      <div v-else-if="estado === 'erro'" class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div class="text-4xl mb-3">🔗</div>
        <h1 class="text-lg font-bold mb-1">Link inválido</h1>
        <p class="text-slate-500 text-sm">{{ erro }}</p>
      </div>

      <div v-else-if="estado === 'respondida'" class="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <div class="text-4xl mb-3">✅</div>
        <h1 class="text-lg font-bold mb-1">Você já respondeu esta pesquisa</h1>
        <p class="text-slate-500 text-sm">Obrigado pela sua opinião, ela ajuda a {{ dados?.empresa }} a melhorar.</p>
      </div>

      <template v-else>
        <p v-if="!dados.formulario.tema?.logo" class="text-xs font-semibold uppercase tracking-wide mb-3 text-center"
           :style="{ color: dados.formulario.tema?.cor || '#f97316' }">{{ dados.empresa }}</p>
        <p v-if="dados.nome && !concluido" class="text-slate-500 mb-3 text-center">Olá, {{ dados.nome }}!</p>
        <FormularioRenderer :formulario="dados.formulario" :nota-inicial="notaInicial" :enviando="enviando"
          :erro="erro" :concluido="concluido" @enviar="enviar" />
        <p v-if="dados.referencia && !concluido" class="text-center text-[11px] text-slate-400 mt-2">Referência: {{ dados.referencia }}</p>
      </template>
    </div>
  </div>
</template>
