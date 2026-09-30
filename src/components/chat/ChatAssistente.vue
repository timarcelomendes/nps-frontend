<script setup>
// Assistente de IA (botão flutuante + painel lateral).
// Usa só os dados da empresa do usuário (o backend filtra pela conta do token).
// Cada pergunta usa 1 análise do limite mensal de IA do plano.
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import Sidebar from 'primevue/sidebar';
import api from '../../services/api';
import { markdownSeguro } from './markdownSeguro';

const MAX_CARACTERES = 1000;
const MAX_HISTORICO = 8;
const TEMPO_MAXIMO_MS = 90000;

const router = useRouter();

const aberto = ref(false);
const texto = ref('');
const carregando = ref(false);
const mensagens = ref([]);        // { role: 'user' | 'assistant', content, erro?, acao? }
const sugestoes = ref([]);
const clientesRecentes = ref([]);
const atalhosCarregados = ref(false);
const uso = ref(null);            // { usadas, limite, ativa }
const limiteAtingido = ref(false);
const listaRef = ref(null);
const campoRef = ref(null);
let controlador = null;

const primeiroNome = computed(() => (sessionStorage.getItem('usuario_nome') || '').trim().split(/\s+/)[0] || '');
const restantes = computed(() => (uso.value && uso.value.limite ? Math.max(0, uso.value.limite - uso.value.usadas) : null));
const podeEnviar = computed(() => !!texto.value.trim() && !carregando.value && !limiteAtingido.value && texto.value.length <= MAX_CARACTERES);

const atalhos = computed(() => [
  ...clientesRecentes.value.slice(0, 3).map((c) => ({ rotulo: `Resumo de ${c}`, pergunta: `Resumo de ${c} nos últimos 30 dias`, icone: 'pi pi-building' })),
  { rotulo: 'Visão da carteira', pergunta: 'Como está o NPS da carteira nos últimos 90 dias?', icone: 'pi pi-chart-bar' },
  { rotulo: 'Comparativo trimestral', pergunta: 'Compare o NPS da carteira com o trimestre anterior', icone: 'pi pi-chart-line' },
  { rotulo: 'Principais críticas', pergunta: 'Quais são as principais críticas recentes dos clientes?', icone: 'pi pi-exclamation-circle' },
]);

const rolarParaFim = () => nextTick(() => {
  if (listaRef.value) listaRef.value.scrollTop = listaRef.value.scrollHeight;
});

const carregarUso = async () => {
  try {
    uso.value = (await api.get('/ia/uso')).data;
    limiteAtingido.value = !!(uso.value && uso.value.limite && uso.value.usadas >= uso.value.limite);
  } catch (e) { uso.value = null; }
};

const carregarAtalhos = async () => {
  if (atalhosCarregados.value) return;
  try {
    const r = await api.get('/chat/clientes-recentes');
    clientesRecentes.value = Array.isArray(r.data) ? r.data : [];
    atalhosCarregados.value = true;
  } catch (e) { clientesRecentes.value = []; }
};

const abrir = () => {
  aberto.value = true;
  carregarUso();
  carregarAtalhos();
  nextTick(() => campoRef.value && campoRef.value.focus());
};

const novaConversa = () => {
  if (controlador) controlador.abort();
  mensagens.value = [];
  sugestoes.value = [];
  texto.value = '';
};

const entrarDeNovo = () => {
  sessionStorage.clear();
  router.push('/login');
};

// Mensagens claras para cada situação (sem detalhes técnicos)
const MSG = {
  rede: 'Não consegui falar com o servidor. Verifique sua internet e tente de novo.',
  tempo: 'A resposta demorou demais. Tente de novo com uma pergunta mais curta.',
  sessao: 'Sua sessão expirou. Entre novamente para continuar usando o Assistente.',
  limite: 'O limite mensal de análises de IA do seu plano acabou. Ele renova no início do próximo mês.',
  ritmo: 'Você enviou muitas perguntas seguidas. Aguarde um minuto e tente de novo.',
  indisponivel: 'O Assistente está temporariamente indisponível. Tente novamente mais tarde.',
  invalida: `Não entendi a pergunta. Escreva de outro jeito (até ${MAX_CARACTERES.toLocaleString('pt-BR')} caracteres).`,
  geral: 'Não consegui responder agora. Tente de novo em alguns instantes.',
  vazia: 'Não recebi resposta desta vez. Tente perguntar de novo.',
};

const mensagemPorStatus = async (resposta) => {
  let detalhe = '';
  try { const corpo = await resposta.json(); if (typeof corpo.detail === 'string') detalhe = corpo.detail; } catch (e) { /* sem corpo */ }
  switch (resposta.status) {
    case 401: return { texto: MSG.sessao, acao: 'login' };
    case 402:
      limiteAtingido.value = true;
      if (uso.value && uso.value.limite) uso.value = { ...uso.value, usadas: uso.value.limite };
      return { texto: detalhe || MSG.limite };
    case 403: return { texto: 'Seu perfil não tem acesso ao Assistente. Fale com o administrador da sua empresa.' };
    case 422: return { texto: MSG.invalida };
    case 429: return { texto: detalhe || MSG.ritmo };
    case 503: return { texto: detalhe || MSG.indisponivel };
    default: return { texto: MSG.geral };
  }
};

const enviar = async (perguntaPronta) => {
  const pergunta = (perguntaPronta ?? texto.value).trim();
  if (!pergunta || carregando.value || limiteAtingido.value) return;
  if (pergunta.length > MAX_CARACTERES) return;

  const historico = mensagens.value
    .filter((m) => !m.erro && m.content && m.content.trim())
    .slice(-MAX_HISTORICO)
    .map((m) => ({ role: m.role, content: m.content }));

  mensagens.value.push({ role: 'user', content: pergunta });
  const resposta = { role: 'assistant', content: '' };
  mensagens.value.push(resposta);
  const idx = mensagens.value.length - 1;
  const falhar = (t, acao) => { mensagens.value[idx] = { role: 'assistant', content: t, erro: true, acao }; };

  texto.value = '';
  sugestoes.value = [];
  carregando.value = true;
  rolarParaFim();

  controlador = new AbortController();
  const meuControlador = controlador;
  let porTempo = false;
  const relogio = setTimeout(() => { porTempo = true; meuControlador.abort(); }, TEMPO_MAXIMO_MS);

  try {
    const token = sessionStorage.getItem('token');
    if (!token) { falhar(MSG.sessao, 'login'); return; }

    const r = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat/perguntar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mensagem: pergunta, historico }),
      signal: meuControlador.signal,
    });

    if (!r.ok || !r.body) {
      const erro = await mensagemPorStatus(r);
      falhar(erro.texto, erro.acao);
      return;
    }

    const leitor = r.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = '';
    let erroDoServidor = null;

    while (true) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += decodificador.decode(value, { stream: true });
      const blocos = buffer.split('\n\n');
      buffer = blocos.pop();
      for (const bloco of blocos) {
        if (!bloco.startsWith('data: ')) continue;
        let dados;
        try { dados = JSON.parse(bloco.slice(6)); } catch (e) { continue; }
        if (dados.texto) { mensagens.value[idx].content += dados.texto; rolarParaFim(); }
        if (Array.isArray(dados.sugestoes)) sugestoes.value = dados.sugestoes.slice(0, 4);
        if (dados.erro) erroDoServidor = String(dados.erro);
      }
    }

    if (erroDoServidor && !mensagens.value[idx].content) falhar(erroDoServidor);
    else if (erroDoServidor) mensagens.value.push({ role: 'assistant', content: erroDoServidor, erro: true });
    else if (!mensagens.value[idx].content.trim()) falhar(MSG.vazia);
    else if (uso.value) uso.value = { ...uso.value, usadas: uso.value.usadas + 1 };
  } catch (e) {
    if (meuControlador.signal.aborted && !porTempo) {
      // conversa limpa pelo usuário: nada a mostrar
    } else {
      const parcial = mensagens.value[idx] && mensagens.value[idx].content;
      if (parcial) mensagens.value.push({ role: 'assistant', content: porTempo ? MSG.tempo : MSG.rede, erro: true });
      else falhar(porTempo ? MSG.tempo : MSG.rede);
    }
  } finally {
    clearTimeout(relogio);
    if (controlador === meuControlador) controlador = null;
    carregando.value = false;
    rolarParaFim();
    nextTick(() => campoRef.value && campoRef.value.focus());
  }
};

const aoTeclar = (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
    ev.preventDefault();
    if (podeEnviar.value) enviar();
  }
};

onBeforeUnmount(() => { if (controlador) controlador.abort(); });
</script>

<template>
  <button
    type="button"
    @click="abrir"
    aria-label="Abrir o Assistente de IA"
    class="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white h-14 min-w-14 px-4 shadow-xl shadow-orange-900/25 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 dark:focus-visible:ring-orange-500/40"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 shrink-0" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
    <span class="font-bold text-sm hidden md:inline">Assistente</span>
  </button>

  <Sidebar v-model:visible="aberto" position="right" class="chat-painel !w-full md:!w-[440px]" aria-label="Assistente de IA">
    <template #header>
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
          <i class="pi pi-sparkles text-white text-lg" aria-hidden="true"></i>
        </div>
        <div class="min-w-0">
          <h2 class="font-bold text-base leading-tight text-slate-800 dark:text-slate-100">Assistente</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 truncate">Responde com os dados da sua empresa</p>
        </div>
        <button v-if="mensagens.length" type="button" @click="novaConversa" aria-label="Começar uma nova conversa"
                class="ml-auto shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <i class="pi pi-refresh text-sm sm:text-xs sm:mr-1" aria-hidden="true"></i><span class="hidden sm:inline">Nova conversa</span>
        </button>
      </div>
    </template>

    <div class="flex flex-col h-full min-h-0">
      <!-- Conversa -->
      <div ref="listaRef" class="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4" aria-live="polite">
        <div class="rounded-2xl rounded-tl-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <p class="font-semibold text-slate-800 dark:text-slate-100 mb-1">Olá{{ primeiroNome ? `, ${primeiroNome}` : '' }}! 👋</p>
          <p>Posso resumir o NPS de um cliente ou da carteira, comparar períodos e mostrar o que os clientes estão elogiando ou criticando.</p>
          <p class="mt-2 text-slate-500 dark:text-slate-400">Experimente um dos atalhos abaixo ou escreva sua pergunta.</p>
        </div>

        <template v-for="(msg, i) in mensagens" :key="i">
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <div class="max-w-[85%] rounded-2xl rounded-tr-sm bg-orange-500 text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">{{ msg.content }}</div>
          </div>

          <div v-else-if="msg.erro" class="flex" role="alert">
            <div class="max-w-[92%] rounded-2xl rounded-tl-sm border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-200 px-4 py-3 text-sm leading-relaxed">
              <p class="flex gap-2"><i class="pi pi-exclamation-triangle mt-0.5" aria-hidden="true"></i><span>{{ msg.content }}</span></p>
              <button v-if="msg.acao === 'login'" type="button" @click="entrarDeNovo"
                      class="mt-2 h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold">Entrar de novo</button>
            </div>
          </div>

          <div v-else class="flex">
            <div class="max-w-[92%] w-full rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 px-4 py-3">
              <div v-if="msg.content" class="chat-md text-sm leading-relaxed text-slate-700 dark:text-slate-200 break-words" v-html="markdownSeguro(msg.content)"></div>
              <div v-else class="flex items-center gap-3 py-1" role="status">
                <span class="flex gap-1.5" aria-hidden="true">
                  <span class="w-2 h-2 rounded-full bg-orange-500 animate-bounce"></span>
                  <span class="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:150ms]"></span>
                  <span class="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:300ms]"></span>
                </span>
                <span class="text-sm text-slate-500 dark:text-slate-400">Consultando seus dados…</span>
              </div>
            </div>
          </div>
        </template>

        <div v-if="sugestoes.length && !carregando && !limiteAtingido" class="flex flex-wrap gap-2 pt-1">
          <button v-for="s in sugestoes" :key="s" type="button" @click="enviar(s)"
                  class="px-3 py-2 rounded-full border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-500/20 text-left">
            {{ s }}
          </button>
        </div>
      </div>

      <!-- Rodapé: atalhos + campo -->
      <div class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-4">
        <div v-if="!mensagens.length && !limiteAtingido" class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <button v-for="a in atalhos" :key="a.rotulo" type="button" @click="enviar(a.pergunta)" :disabled="carregando"
                  class="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap hover:border-orange-300 hover:text-orange-700 dark:hover:border-orange-500/50 dark:hover:text-orange-300 disabled:opacity-50">
            <i :class="a.icone" class="text-xs text-orange-500" aria-hidden="true"></i>{{ a.rotulo }}
          </button>
        </div>

        <div v-if="limiteAtingido && !mensagens.length" class="mb-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 text-sm px-3 py-2">
          {{ MSG.limite }}
        </div>

        <form @submit.prevent="enviar()" class="flex items-end gap-2">
          <label for="chat-assistente-campo" class="sr-only">Sua pergunta</label>
          <textarea
            id="chat-assistente-campo"
            ref="campoRef"
            v-model="texto"
            rows="1"
            :maxlength="MAX_CARACTERES"
            :disabled="carregando || limiteAtingido"
            @keydown="aoTeclar"
            placeholder="Pergunte sobre seus clientes…"
            class="flex-1 resize-none max-h-32 min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 disabled:opacity-60"
          ></textarea>
          <button type="submit" :disabled="!podeEnviar" aria-label="Enviar pergunta"
                  class="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-orange-500 hover:bg-orange-600 text-white disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">
            <i :class="carregando ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-sm" aria-hidden="true"></i>
          </button>
        </form>
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-snug">
          Usa só os dados da sua empresa e pode errar: confira os números no painel.
          <template v-if="restantes !== null"> Restam <strong class="text-slate-700 dark:text-slate-200">{{ restantes }}</strong> de {{ uso.limite }} análises neste mês (cada pergunta usa 1).</template>
        </p>
      </div>
    </div>
  </Sidebar>
</template>

<style>
/* Painel (o Sidebar do PrimeVue é teleportado para o body: estilos globais com prefixo próprio) */
.chat-painel.p-sidebar { background: #fff; color: #334155; }
.chat-painel.p-sidebar .p-sidebar-header { padding: 0.875rem 1rem; border-bottom: 1px solid #e2e8f0; gap: 0.5rem; }
.chat-painel.p-sidebar .p-sidebar-header-content { flex: 1; min-width: 0; }
.chat-painel.p-sidebar .p-sidebar-content { padding: 0; display: flex; flex-direction: column; min-height: 0; }
.dark .chat-painel.p-sidebar { background: #0f172a; color: #e2e8f0; }
.dark .chat-painel.p-sidebar .p-sidebar-header { border-bottom-color: #1e293b; }
.dark .chat-painel.p-sidebar .p-sidebar-close { color: #94a3b8; }
.dark .chat-painel.p-sidebar .p-sidebar-close:hover { background: #1e293b; color: #f1f5f9; }

/* Markdown das respostas */
.chat-md > :first-child { margin-top: 0; }
.chat-md > :last-child { margin-bottom: 0; }
.chat-md p { margin: 0.35rem 0; }
.chat-md h1 { font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0.25rem 0 0.5rem; }
.chat-md h2, .chat-md h3 { font-size: 0.875rem; font-weight: 700; color: #c2410c; margin: 0.9rem 0 0.35rem; }
.chat-md strong { font-weight: 700; color: #0f172a; }
.chat-md ul, .chat-md ol { margin: 0.35rem 0; padding-left: 1.25rem; }
.chat-md ul { list-style: disc; }
.chat-md ol { list-style: decimal; }
.chat-md li { margin: 0.15rem 0; }
.chat-md hr { margin: 0.75rem 0; border: 0; border-top: 1px solid #e2e8f0; }
.chat-md blockquote { margin: 0.5rem 0; padding: 0.5rem 0.75rem; border-left: 3px solid #f97316; background: #fff7ed; border-radius: 0 0.5rem 0.5rem 0; color: #7c2d12; }
.chat-md a { color: #c2410c; text-decoration: underline; }
.chat-md code { font-size: 0.8125rem; background: #f1f5f9; padding: 0.05rem 0.3rem; border-radius: 0.25rem; }
.chat-md table { display: block; overflow-x: auto; width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.8125rem; }
.chat-md th, .chat-md td { padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; text-align: left; white-space: nowrap; }
.chat-md th { font-weight: 700; color: #475569; background: #f8fafc; }

.dark .chat-md h1, .dark .chat-md strong { color: #f8fafc; }
.dark .chat-md h2, .dark .chat-md h3, .dark .chat-md a { color: #fb923c; }
.dark .chat-md hr, .dark .chat-md th, .dark .chat-md td { border-color: #334155; }
.dark .chat-md blockquote { background: rgba(249, 115, 22, 0.1); color: #fed7aa; }
.dark .chat-md code { background: #1e293b; }
.dark .chat-md th { color: #cbd5e1; background: #1e293b; }
</style>
