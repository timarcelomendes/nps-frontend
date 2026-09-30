<script setup>
// Imagens (logo, banner) hospedadas na Rakiti para usar nos modelos de e-mail.
import { ref } from 'vue';
import api from '../../services/api';
import { useConfig } from './useConfiguracoes';

const cfg = useConfig();
const arquivo = ref(null);
const enviando = ref(false);

const escolher = () => arquivo.value?.click();

const enviar = async (evento) => {
  const file = evento.target.files[0];
  if (!file) return;
  const indice = cfg.imagens.value.findIndex((img) => img.nome === file.name);
  if (indice !== -1 && !confirm(`Já existe uma imagem chamada "${file.name}". Substituir? Os e-mails que usam esta imagem passam a mostrar a nova.`)) {
    evento.target.value = '';
    return;
  }
  enviando.value = true;
  const dados = new FormData();
  dados.append('file', file);
  try {
    const res = await api.post('/upload-imagem', dados, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (indice !== -1) {
      cfg.imagens.value[indice].url = `${res.data.url}?v=${Date.now()}`;
      cfg.ok('Imagem substituída', file.name);
    } else {
      cfg.imagens.value.unshift(res.data);
      cfg.ok('Imagem enviada', 'Copie o link e use no modelo de e-mail.');
    }
  } catch (e) {
    cfg.erro(e, 'Não foi possível enviar a imagem', 'Use PNG, JPG, GIF ou WEBP.');
  } finally {
    enviando.value = false;
    evento.target.value = '';
  }
};

const copiar = async (url) => {
  try {
    await navigator.clipboard.writeText(url);
    cfg.ok('Link copiado', 'Cole no src="..." da imagem no seu HTML.');
  } catch (e) {
    cfg.aviso('Não foi possível copiar', url);
  }
};

const remover = async (nome) => {
  if (!confirm(`Apagar a imagem "${nome}"? Os e-mails que a usam deixam de mostrá-la.`)) return;
  try {
    await api.delete(`/config/imagens/${nome}`);
    cfg.imagens.value = cfg.imagens.value.filter((img) => img.nome !== nome);
    cfg.ok('Imagem apagada', nome);
  } catch (e) {
    cfg.erro(e, 'Não foi possível apagar a imagem', 'Tente novamente.');
  }
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">Envie o logo ou banner da sua empresa e copie o link para usar dentro do HTML dos e-mails.</p>
      <input type="file" ref="arquivo" accept="image/*" class="hidden" @change="enviar" />
      <button class="cfg-btn-secundario" :disabled="enviando" @click="escolher">
        <i :class="['pi text-xs', enviando ? 'pi-spin pi-spinner' : 'pi-upload']"></i>Enviar imagem
      </button>
    </div>
    <div v-if="cfg.imagens.value.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="img in cfg.imagens.value" :key="img.url" class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col min-w-0">
        <div class="h-32 flex items-center justify-center p-3 bg-slate-100 dark:bg-slate-800">
          <img :src="img.url" :alt="img.nome" class="max-w-full max-h-full object-contain" />
        </div>
        <div class="p-3 flex items-center gap-2 min-w-0">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate flex-1" :title="img.url">{{ img.nome }}</span>
          <button class="cfg-btn-icone" @click="copiar(img.url)" v-tooltip.top="'Copiar link'" :aria-label="`Copiar link de ${img.nome}`"><i class="pi pi-copy"></i></button>
          <button class="cfg-btn-icone cfg-btn-perigo" @click="remover(img.nome)" v-tooltip.top="'Apagar'" :aria-label="`Apagar ${img.nome}`"><i class="pi pi-trash"></i></button>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-slate-400">Nenhuma imagem enviada ainda.</p>
  </div>
</template>
