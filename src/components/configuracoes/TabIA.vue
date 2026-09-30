<script setup>
// Aba IA (avançada): uso do mês e ajustes das análises automáticas das respostas.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig, useRascunho } from './useConfiguracoes';

const cfg = useConfig();

const uso = ref({ usadas: 0, limite: 0, ativa: false });
const usoPct = computed(() => Math.min(100, Math.round((uso.value.usadas / (uso.value.limite || 1)) * 100)));

const MODELOS = [
  { value: 'gpt-4o-mini', label: 'Rápido e econômico (recomendado)' },
  { value: 'gpt-4o', label: 'Equilibrado' },
  { value: 'gpt-4-turbo', label: 'Mais detalhado (mais lento)' },
];
const ESTILOS = [
  { value: '0.2', label: 'Mais objetiva' },
  { value: '0.4', label: 'Equilibrada' },
  { value: '0.7', label: 'Mais criativa' },
];

const ia = useRascunho({ openai_model: 'gpt-4o-mini', ai_temperature: '0.4' });
const chaveApi = ref(''); // reenviada como veio, para não apagar uma chave própria já gravada
const estilos = computed(() => {
  const atual = String(ia.atual.value.ai_temperature);
  return ESTILOS.some((e) => e.value === atual) ? ESTILOS : [...ESTILOS, { value: atual, label: `Personalizada (${atual})` }];
});
const modelos = computed(() => {
  const atual = ia.atual.value.openai_model;
  return MODELOS.some((m) => m.value === atual) ? MODELOS : [...MODELOS, { value: atual, label: atual }];
});

const carregar = async () => {
  try { uso.value = (await api.get('/ia/uso')).data; } catch (e) { /* uso indisponível: mostra zerado */ }
  try {
    const { data } = await api.get('/configuracoes');
    if (data?.status === 'success') {
      const d = data.data || {};
      chaveApi.value = d.openai_api_key || '';
      ia.definir({ openai_model: d.openai_model || 'gpt-4o-mini', ai_temperature: String(d.ai_temperature || '0.4') });
    }
  } catch (e) {
    cfg.erro(e, 'Não foi possível carregar os ajustes da IA', 'Atualize a página em alguns segundos.');
  }
};

const salvar = async () => {
  try {
    const valores = { openai_api_key: chaveApi.value, ...ia.atual.value };
    await api.post('/configuracoes', Object.keys(valores).map((chave) => ({ chave, valor: String(valores[chave] || '') })));
    ia.confirmar();
    cfg.ok('Alterações salvas', 'Ajustes da IA.');
    return true;
  } catch (e) {
    cfg.erro(e, 'Não foi possível salvar a IA', 'Tente novamente.');
    return false;
  }
};
const soltar = cfg.registrarSecao('ia', { nome: 'Ajustes da IA', alterado: () => ia.alterado.value, salvar, descartar: ia.descartar });
onBeforeUnmount(soltar);
onMounted(carregar);
</script>

<template>
  <CfgSecao titulo="Inteligência artificial" icone="pi-sparkles" descricao="A IA lê os comentários dos clientes e resume os principais motivos de elogio e reclamação.">
    <div class="flex flex-col gap-5 max-w-3xl">
      <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Incluída no seu plano</span>
          <span :class="['cfg-selo', uso.ativa ? 'cfg-selo-bom' : 'cfg-selo-alerta']">{{ uso.ativa ? 'Ativa' : 'Indisponível' }}</span>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">Análises usadas este mês: <b>{{ uso.usadas }}</b> de <b>{{ uso.limite }}</b></p>
        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div class="h-full rounded-full" :class="usoPct >= 90 ? 'bg-rose-500' : usoPct >= 75 ? 'bg-amber-400' : 'bg-emerald-500'" :style="{ width: usoPct + '%' }"></div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">Não precisa configurar nada. Se o limite acabar, fale com o suporte para ampliar.</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="cfg-campo">
          <label for="cfg-ia-modelo">Tipo de análise</label>
          <select id="cfg-ia-modelo" v-model="ia.atual.value.openai_model" class="cfg-input">
            <option v-for="m in modelos" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="cfg-campo">
          <label for="cfg-ia-estilo">Estilo dos textos</label>
          <select id="cfg-ia-estilo" v-model="ia.atual.value.ai_temperature" class="cfg-input">
            <option v-for="e in estilos" :key="e.value" :value="e.value">{{ e.label }}</option>
          </select>
          <span class="cfg-ajuda">"Mais objetiva" repete menos e inventa menos.</span>
        </div>
      </div>
    </div>
  </CfgSecao>
</template>
