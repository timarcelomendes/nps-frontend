<script setup>
import { ref, computed, nextTick } from 'vue';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
import api from '../services/api';

const toast = useToast();
const PALAVRA = 'APAGAR';

// Só o perfil Admin (o backend também bloqueia /api/admin/* para quem não é Admin)
const ehAdmin = sessionStorage.getItem('usuario_tipo') === 'Admin';

// Contagens lidas das listas que já existem na API (somente leitura)
const FONTES = {
  respostas: { url: '/respostas', params: { incluir_excluidas: true } },
  clientes: { url: '/clientes', params: { ativo: 'Todos' } },
  envios: { url: '/logs/emails' },
  empresas: { url: '/cadastros/empresas' },
  acoes: { url: '/acoes' },
};

const ACOES = [
  {
    tipo: 'respostas',
    titulo: 'Apagar as respostas de NPS',
    resumo: 'Zera as notas e comentários de NPS. Contatos e empresas continuam cadastrados.',
    apaga: [{ fonte: 'respostas', rotulo: 'respostas de NPS (notas e comentários)' }],
    afeta: [
      { rotulo: 'planos de ação continuam, mas perdem o vínculo com a resposta' },
      { rotulo: 'os indicadores de NPS e os gráficos voltam a zero' },
    ],
    mantem: 'Contatos, empresas, histórico de e-mails, planos de ação, respostas de CSAT e formulários, usuários e configurações.',
    botao: 'Apagar respostas',
  },
  {
    tipo: 'clientes',
    titulo: 'Apagar os contatos',
    resumo: 'Remove todos os contatos, as respostas de NPS deles e o histórico de e-mails enviados.',
    apaga: [
      { fonte: 'clientes', rotulo: 'contatos (ativos e inativos)' },
      { fonte: 'respostas', rotulo: 'respostas de NPS' },
      { fonte: 'envios', rotulo: 'registros de e-mails enviados (a aba "E-mails enviados" da Auditoria fica vazia)' },
    ],
    afeta: [
      { rotulo: 'planos de ação continuam, mas perdem o vínculo com a resposta' },
      { rotulo: 'respostas de CSAT e de formulários continuam, mas sem o contato' },
      { rotulo: 'lembretes e envios agendados param' },
    ],
    mantem: 'Empresas, planos de ação, respostas de CSAT e formulários, usuários e configurações.',
    botao: 'Apagar contatos',
  },
  {
    tipo: 'empresas',
    titulo: 'Recomeçar do zero',
    resumo: 'Apaga toda a carteira: empresas, contatos, respostas, e-mails enviados e planos de ação.',
    apaga: [
      { fonte: 'empresas', rotulo: 'empresas da carteira' },
      { fonte: 'clientes', rotulo: 'contatos' },
      { fonte: 'respostas', rotulo: 'respostas de NPS' },
      { fonte: 'envios', rotulo: 'registros de e-mails enviados' },
      { fonte: 'acoes', rotulo: 'planos de ação' },
    ],
    afeta: [{ rotulo: 'respostas de CSAT e de formulários continuam, mas sem contato e sem empresa' }],
    mantem: 'Sua conta na Rakiti, a assinatura, usuários, configurações, formulários, grupos, segmentos, perfis, cargos e gestores.',
    botao: 'Apagar tudo da carteira',
    total: true,
  },
];

const dialogVisivel = ref(false);
const acao = ref(null);
const textoConfirmacao = ref('');
const isProcessando = ref(false);
const carregandoContagem = ref(false);
const contagens = ref({}); // fonte -> número | null (não foi possível contar)
const campoConfirmacao = ref(null);

const contarFontes = async (fontes) => {
  carregandoContagem.value = true;
  const resultado = {};
  await Promise.all(fontes.map(async (f) => {
    try {
      const { data } = await api.get(FONTES[f].url, { params: FONTES[f].params });
      resultado[f] = Array.isArray(data) ? data.length : null;
    } catch (e) {
      resultado[f] = null;
    }
  }));
  contagens.value = resultado;
  carregandoContagem.value = false;
};

const fontesDa = (a) => [...new Set([...a.apaga, ...a.afeta].map((i) => i.fonte).filter(Boolean))];

const abrirConfirmacao = async (a) => {
  acao.value = a;
  textoConfirmacao.value = '';
  contagens.value = {};
  dialogVisivel.value = true;
  await contarFontes(fontesDa(a));
  await nextTick();
  campoConfirmacao.value?.focus();
};

const numero = (fonte) => {
  const n = contagens.value[fonte];
  return typeof n === 'number' ? n.toLocaleString('pt-BR') : null;
};

const totalApagado = computed(() => {
  if (!acao.value) return null;
  let soma = 0;
  for (const i of acao.value.apaga) {
    const n = contagens.value[i.fonte];
    if (typeof n !== 'number') return null;
    soma += n;
  }
  return soma;
});

const nadaParaApagar = computed(() => totalApagado.value === 0);
const palavraOk = computed(() => textoConfirmacao.value.trim().toUpperCase() === PALAVRA);
const podeConfirmar = computed(() => palavraOk.value && !carregandoContagem.value && !isProcessando.value);

const rotuloConfirmar = computed(() => {
  if (typeof totalApagado.value === 'number' && totalApagado.value > 0) {
    return `Apagar ${totalApagado.value.toLocaleString('pt-BR')} registro${totalApagado.value === 1 ? '' : 's'}`;
  }
  return 'Apagar definitivamente';
});

const executarLimpeza = async () => {
  if (!podeConfirmar.value) return;
  isProcessando.value = true;
  try {
    const response = await api.delete(`/admin/limpar-dados?tipo=${acao.value.tipo}`);
    toast.add({ severity: 'success', summary: 'Dados apagados', detail: response.data?.message || 'A limpeza foi concluída.', life: 6000 });
    dialogVisivel.value = false;
  } catch (error) {
    const msg = error.response?.data?.detail || 'Não foi possível apagar os dados. Nada foi alterado; tente de novo.';
    toast.add({ severity: 'error', summary: 'A limpeza não foi feita', detail: msg, life: 8000 });
  } finally {
    isProcessando.value = false;
  }
};
</script>

<template>
  <div class="max-w-4xl mx-auto flex flex-col gap-6 pb-24">
    <header>
      <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Zona de risco<span class="text-orange-500">.</span></h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Apague em massa os dados da sua empresa na Rakiti. Use só quando tiver certeza.</p>
    </header>

    <div v-if="!ehAdmin" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center">
      <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-2xl"><i class="pi pi-lock"></i></div>
      <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">Acesso só para administradores</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">Somente quem tem o perfil Administrador pode apagar dados em massa. Fale com o administrador da sua empresa.</p>
    </div>

    <template v-else>
      <div class="zr-aviso">
        <i class="pi pi-exclamation-triangle text-lg mt-0.5"></i>
        <div class="flex flex-col gap-1">
          <strong>Não dá para desfazer.</strong>
          <span>Os dados apagados aqui somem de vez e a Rakiti não consegue recuperá-los pela tela. Antes, exporte o que quiser guardar (por exemplo, em Visão geral ou Respostas). Só os dados da sua empresa são afetados.</span>
        </div>
      </div>

      <section class="flex flex-col gap-4">
        <article v-for="a in ACOES" :key="a.tipo" class="zr-cartao" :class="{ 'zr-cartao-total': a.total }">
          <div class="flex-1 min-w-0">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{{ a.titulo }}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">{{ a.resumo }}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-2"><span class="font-semibold text-slate-600 dark:text-slate-300">Continua:</span> {{ a.mantem }}</p>
          </div>
          <button :class="a.total ? 'zr-btn-perigo-cheio' : 'zr-btn-perigo'" @click="abrirConfirmacao(a)">
            <i class="pi pi-trash text-sm"></i>{{ a.botao }}
          </button>
        </article>
      </section>
    </template>

    <Dialog v-model:visible="dialogVisivel" modal :closable="!isProcessando" :closeOnEscape="!isProcessando"
      :style="{ width: '34rem' }" :breakpoints="{ '640px': '94vw' }" class="zr-dialog">
      <template #header>
        <span class="p-dialog-title flex items-center gap-2"><i class="pi pi-exclamation-triangle text-rose-600 dark:text-rose-400"></i>{{ acao?.titulo }}</span>
      </template>

      <div v-if="acao" class="flex flex-col gap-4">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white mb-2">Será apagado:</p>
          <ul class="zr-lista">
            <li v-for="i in acao.apaga" :key="i.fonte">
              <span class="zr-numero">
                <i v-if="carregandoContagem" class="pi pi-spin pi-spinner text-xs"></i>
                <template v-else>{{ numero(i.fonte) ?? '?' }}</template>
              </span>
              <span>{{ i.rotulo }}</span>
            </li>
          </ul>
          <p v-if="!carregandoContagem && totalApagado === null" class="text-sm text-slate-500 dark:text-slate-400 mt-2">Não conseguimos contar tudo agora. A limpeza continua disponível, mas confira antes.</p>
          <p v-else-if="nadaParaApagar" class="text-sm text-slate-500 dark:text-slate-400 mt-2">Não há registros para apagar no momento.</p>
        </div>

        <div v-if="acao.afeta.length">
          <p class="text-sm font-semibold text-slate-900 dark:text-white mb-2">Também muda:</p>
          <ul class="zr-lista zr-lista-suave">
            <li v-for="(i, idx) in acao.afeta" :key="idx">
              <span v-if="i.fonte" class="zr-numero zr-numero-suave">
                <i v-if="carregandoContagem" class="pi pi-spin pi-spinner text-xs"></i>
                <template v-else>{{ numero(i.fonte) ?? '?' }}</template>
              </span>
              <i v-else class="pi pi-minus text-xs text-slate-400 w-10 text-center shrink-0"></i>
              <span>{{ i.rotulo }}</span>
            </li>
          </ul>
        </div>

        <p class="text-sm text-slate-600 dark:text-slate-300"><span class="font-semibold">Continua como está:</span> {{ acao.mantem }}</p>

        <div class="zr-irreversivel">
          <i class="pi pi-ban"></i>
          <span><strong>Esta ação não pode ser desfeita.</strong> Números de agora; podem mudar se chegarem respostas novas.</span>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="zr-palavra" class="text-sm font-semibold text-slate-700 dark:text-slate-200">Para confirmar, digite <span class="font-mono text-rose-700 dark:text-rose-300">{{ PALAVRA }}</span></label>
          <input id="zr-palavra" ref="campoConfirmacao" v-model="textoConfirmacao" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false"
            :disabled="isProcessando" :placeholder="PALAVRA" class="zr-input" @keyup.enter="executarLimpeza" />
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <button class="zr-btn-secundario" :disabled="isProcessando" @click="dialogVisivel = false">Cancelar</button>
          <button class="zr-btn-perigo-cheio" :disabled="!podeConfirmar" @click="executarLimpeza">
            <i :class="['pi text-sm', isProcessando ? 'pi-spin pi-spinner' : 'pi-trash']"></i>{{ isProcessando ? 'Apagando...' : rotuloConfirmar }}
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
@reference "../style.css";
.zr-aviso { @apply flex items-start gap-3 p-4 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-800 dark:text-rose-200; }
.zr-cartao { @apply flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm; }
.zr-cartao-total { @apply border-rose-300 dark:border-rose-500/40; }
.zr-cartao > button { @apply w-full sm:w-auto shrink-0; }
</style>

<style>
@reference "../style.css";
/* Estilos que também valem dentro do diálogo (renderizado fora da página) */
.zr-btn-perigo { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-rose-300 dark:border-rose-500/40 bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors whitespace-nowrap; }
.zr-btn-perigo-cheio { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-rose-600; }
.zr-btn-secundario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-orange-300 hover:text-orange-700 dark:hover:text-orange-300 transition-colors disabled:opacity-50; }

.zr-dialog.p-dialog { @apply rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl; }
.zr-dialog .p-dialog-header { @apply bg-white dark:bg-slate-900 px-6! py-4! border-b border-slate-100 dark:border-slate-800; }
.zr-dialog .p-dialog-title { @apply text-lg! font-bold! text-slate-900 dark:text-white; }
.zr-dialog .p-dialog-header-icon { @apply text-slate-500! dark:text-slate-400! hover:bg-slate-100! dark:hover:bg-slate-800!; }
.zr-dialog .p-dialog-content { @apply bg-white dark:bg-slate-900 px-6! py-5! text-slate-700 dark:text-slate-200; }
.zr-dialog .p-dialog-footer { @apply bg-slate-50 dark:bg-slate-900 px-6! py-4! border-t border-slate-100 dark:border-slate-800; }
.zr-lista { @apply flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200; }
.zr-lista li { @apply flex items-center gap-3; }
.zr-numero { @apply inline-flex items-center justify-center min-w-10 h-7 px-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold tabular-nums shrink-0; }
.zr-numero-suave { @apply bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold; }
.zr-lista-suave { @apply text-slate-600 dark:text-slate-300; }
.zr-irreversivel { @apply flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-800 dark:text-rose-200; }
.zr-irreversivel .pi { @apply mt-0.5; }
.zr-input { @apply w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-base font-mono font-semibold tracking-wider text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 disabled:opacity-60; }
</style>
