<script setup>
// Envios: quem está na fila para receber a pesquisa, o que já saiu, quem respondeu,
// lembretes, erros (com a causa em linguagem simples) e envio manual com confirmação.
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputSwitch from 'primevue/inputswitch';
import api from '../services/api';
import { temPermissao } from '../utils/permissoes';
import EstadoVazio from '../components/clientes/EstadoVazio.vue';
import AvisoAssinatura from '../components/envios/AvisoAssinatura.vue';
import AjudaEnvios from '../components/envios/AjudaEnvios.vue';
import DialogRegrasEnvio from '../components/envios/DialogRegrasEnvio.vue';
import DialogConfirmarEnvio from '../components/envios/DialogConfirmarEnvio.vue';
import DialogNovoContato from '../components/envios/DialogNovoContato.vue';
import HistoricoEnvios from '../components/envios/HistoricoEnvios.vue';
import { causaSimples, detalheDoErro, ehErroAssinatura, extrairErroDoLog, formatarData, plural } from '../components/envios/mensagens';

const toast = useToast();
const router = useRouter();

const podeDisparar = temPermissao('audiencia:disparar');
const podeCriar = temPermissao('clientes:criar');
const ehAdmin = sessionStorage.getItem('usuario_tipo') === 'Admin';

// ---------- Dados ----------
const clientes = ref([]);
const empresas = ref([]);
const perfis = ref([]);
const cargos = ref([]);
const segmentos = ref([]);
const gestores = ref([]);
const companhias = ref([]);
const logs = ref([]);
const regras = ref({});
const lembretes = ref({ ativo: false, qtd_maxima: 0, dias: [] });
const bloqueioAssinatura = ref('');
const loading = ref(true);
const carregandoLogs = ref(true);

const recorrencia = computed(() => parseInt(regras.value.recorrencia_dias, 10) || 90);
const enviosAtivos = computed(() => String(regras.value.envios_ativos).toLowerCase() === 'true');
const roboAtivo = computed(() => String(regras.value.robo_ativo).toLowerCase() === 'true');
const automaticoLigado = computed(() => enviosAtivos.value && roboAtivo.value);
const textoDiasLembrete = computed(() => {
  const d = lembretes.value.dias || [];
  const lista = d.length > 1 ? d.slice(0, -1).join(', ') + ' e ' + d[d.length - 1] : String(d[0] ?? '');
  return `${d.length === 1 ? 'Lembrete' : 'Lembretes'} ${lista} dias depois do envio, às 10h20`;
});

const carregarCadastros = async () => {
  const pegar = async (url, alvo) => { try { const r = await api.get(url); if (Array.isArray(r.data)) alvo.value = r.data; } catch (e) { /* cadastro opcional */ } };
  await Promise.all([
    pegar('/cadastros/empresas', empresas), pegar('/cadastros/perfis', perfis), pegar('/cadastros/cargos', cargos),
    pegar('/cadastros/segmentos', segmentos), pegar('/cadastros/gestores', gestores), pegar('/cadastros/companhias', companhias),
  ]);
};

const carregarRegras = async () => {
  try { const r = await api.get('/config/regras'); regras.value = r.data || {}; } catch (e) { regras.value = {}; }
  try { const r = await api.get('/lembretes/previa'); lembretes.value = r.data || lembretes.value; } catch (e) { /* sem prévia */ }
};

const carregarAssinatura = async () => {
  try {
    const r = await api.get('/assinatura');
    bloqueioAssinatura.value = r.data && r.data.pode_enviar === false ? (r.data.mensagem || 'Os envios estão pausados pela assinatura.') : '';
  } catch (e) { /* sem dados de assinatura: não bloqueia */ }
};

const carregarLogs = async () => {
  try { const r = await api.get('/logs/emails'); logs.value = Array.isArray(r.data) ? r.data : []; } catch (e) { /* histórico indisponível */ }
  finally { carregandoLogs.value = false; }
};

// Linhas enviadas há pouco ficam protegidas: o backend envia em segundo plano e demora alguns segundos
const idsRecemEnviados = ref([]);
const idsEnviando = ref([]);

const sincronizar = async () => {
  try {
    const r = await api.get('/clientes', { params: { _t: Date.now() }, headers: { 'Cache-Control': 'no-cache' } });
    const selecionados = new Set(clientesSelecionados.value.map(c => c.cliente_id));
    clientes.value = r.data.map(novo => {
      if (!idsRecemEnviados.value.includes(novo.cliente_id)) return novo;
      const antigo = clientes.value.find(c => c.cliente_id === novo.cliente_id);
      return antigo ? { ...novo, status_envio: antigo.status_envio } : novo;
    });
    if (selecionados.size) clientesSelecionados.value = clientes.value.filter(c => selecionados.has(c.cliente_id));
  } catch (e) { /* tenta de novo no próximo ciclo */ }
};

const carregarTudo = async () => {
  loading.value = true;
  await Promise.all([sincronizar(), carregarCadastros(), carregarRegras(), carregarAssinatura(), carregarLogs()]);
  loading.value = false;
};

// Atualização automática: rápida logo depois de um envio, lenta no resto do tempo
let temporizador = null;
const agendarAtualizacao = () => {
  clearTimeout(temporizador);
  const rapido = idsRecemEnviados.value.length > 0;
  temporizador = setTimeout(async () => {
    if (!document.hidden) {
      await sincronizar();
      if (rapido) await carregarLogs();
    }
    agendarAtualizacao();
  }, rapido ? 4000 : 30000);
};

onMounted(() => { carregarTudo(); agendarAtualizacao(); });
onUnmounted(() => clearTimeout(temporizador));

// ---------- Situação de cada contato ----------
const ativo = (c) => !(c.ativo === 0 || c.ativo === false);

const grupoDoStatus = (c) => {
  const s = (c.status_envio || '').trim();
  if (s === 'Processando...') return 'processando';
  if (s === 'Pendente') return 'fila';
  if (s === 'Enviado') return 'aguardando';
  if (s === 'Respondido') return 'respondido';
  if (s === 'Erro') return 'erro';
  return 'outro';
};

const SITUACAO = {
  processando: { rotulo: 'Enviando...', classe: 'env-tag-neutro' },
  fila: { rotulo: 'Na fila', classe: 'env-tag-neutro' },
  aguardando: { rotulo: 'Aguardando resposta', classe: 'env-tag-espera' },
  respondido: { rotulo: 'Respondeu', classe: 'env-tag-ok' },
  erro: { rotulo: 'Não saiu', classe: 'env-tag-erro' },
};
const situacao = (c) => {
  if (!ativo(c)) return { rotulo: 'Inativo', classe: 'env-tag-neutro' };
  const g = grupoDoStatus(c);
  if (g === 'outro') return { rotulo: c.status_envio === 'Criado' ? 'Link criado' : 'Não iniciado', classe: 'env-tag-neutro' };
  return SITUACAO[g];
};

// Último erro registrado para cada e-mail (o log vem do mais novo para o mais antigo)
const errosPorEmail = computed(() => {
  const m = new Map();
  logs.value.forEach(l => {
    const email = String(l.destinatario || '').trim().toLowerCase();
    if (l.status === 'Erro' && email && !m.has(email)) m.set(email, causaSimples(extrairErroDoLog(l.mensagem)));
  });
  return m;
});
const causaDoErro = (c) => errosPorEmail.value.get(String(c.email || '').trim().toLowerCase()) || causaSimples('');

const adicionarDias = (data, dias) => { const d = new Date(data); d.setDate(d.getDate() + dias); return d; };
const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// Próximo lembrete de quem recebeu e não respondeu
const proximoLembrete = (c) => {
  if (grupoDoStatus(c) !== 'aguardando' || !lembretes.value.ativo || !c.data_envio_inicial) return null;
  const n = Number(c.lembretes_enviados || 0);
  const dias = lembretes.value.dias || [];
  if (n >= dias.length) return null;
  const data = adicionarDias(c.data_envio_inicial, dias[n]);
  if (isNaN(data.getTime())) return null;
  const diff = Math.round((inicioDoDia(data) - inicioDoDia(new Date())) / 86400000);
  return { numero: n + 1, data, diff };
};

const textoLembrete = (c) => {
  const n = Number(c.lembretes_enviados || 0);
  const partes = [];
  if (n > 0) partes.push(`${plural(n, 'lembrete enviado', 'lembretes enviados')}${c.ultimo_envio ? ' (último em ' + formatarData(c.ultimo_envio) + ')' : ''}`);
  const p = proximoLembrete(c);
  if (p) partes.push(p.diff <= 0 ? `${p.numero}º lembrete sai hoje` : p.diff === 1 ? `${p.numero}º lembrete amanhã` : `${p.numero}º lembrete em ${formatarData(p.data)}`);
  else if (n === 0) partes.push('Sem lembretes programados');
  return partes.join(' · ');
};

// ---------- Resumo e filtros ----------
const ativos = computed(() => clientes.value.filter(ativo));
const resumo = computed(() => {
  const r = { fila: 0, aguardando: 0, respondido: 0, erro: 0 };
  ativos.value.forEach(c => { const g = grupoDoStatus(c); if (g in r) r[g]++; });
  return r;
});
const CARTOES = [
  { chave: 'fila', rotulo: 'Na fila', dica: 'Vão receber no próximo envio', icone: 'pi-inbox' },
  { chave: 'aguardando', rotulo: 'Aguardando resposta', dica: 'Receberam e ainda não responderam', icone: 'pi-clock' },
  { chave: 'respondido', rotulo: 'Responderam', dica: 'Neste ciclo', icone: 'pi-check-circle' },
  { chave: 'erro', rotulo: 'Com erro', dica: 'O e-mail não saiu', icone: 'pi-exclamation-triangle' },
];

const pesquisa = ref('');
const filtroStatus = ref(null);
const filtroGestor = ref('');
const filtroCompanhia = ref('');
const filtroTipoData = ref('proximo_envio');
const filtroDataInicio = ref('');
const filtroDataFim = ref('');
const mostrarInativos = ref(false);
const soLembreteProximo = ref(false);
const filtrosAbertos = ref(false);

const nomesGestores = computed(() => [...new Set([...gestores.value.map(g => g.nome), ...clientes.value.map(c => c.gestor)].filter(Boolean))].sort());
const companhiaPorEmpresa = computed(() => new Map(empresas.value.map(e => [e.nome, e.companhia])));

const filtrosExtras = computed(() => [filtroGestor.value, filtroCompanhia.value, filtroDataInicio.value, filtroDataFim.value, mostrarInativos.value, soLembreteProximo.value].filter(Boolean).length);
const algumFiltro = computed(() => !!pesquisa.value.trim() || !!filtroStatus.value || filtrosExtras.value > 0);

const limparFiltros = () => {
  pesquisa.value = ''; filtroStatus.value = null; filtroGestor.value = ''; filtroCompanhia.value = '';
  filtroTipoData.value = 'proximo_envio'; filtroDataInicio.value = ''; filtroDataFim.value = '';
  mostrarInativos.value = false; soLembreteProximo.value = false;
};

const clientesFiltrados = computed(() => {
  const termo = pesquisa.value.trim().toLowerCase();
  return clientes.value.filter(c => {
    if (!mostrarInativos.value && !ativo(c)) return false;
    if (filtroStatus.value && (grupoDoStatus(c) !== filtroStatus.value || !ativo(c))) return false;
    if (termo && ![c.nome, c.email, c.empresa].some(v => String(v || '').toLowerCase().includes(termo))) return false;
    if (filtroGestor.value && c.gestor !== filtroGestor.value) return false;
    if (filtroCompanhia.value && companhiaPorEmpresa.value.get(c.empresa) !== filtroCompanhia.value) return false;
    if (filtroDataInicio.value || filtroDataFim.value) {
      const valor = c[filtroTipoData.value];
      if (!valor) return false;
      const dia = String(valor).slice(0, 10);
      if (filtroDataInicio.value && dia < filtroDataInicio.value) return false;
      if (filtroDataFim.value && dia > filtroDataFim.value) return false;
    }
    if (soLembreteProximo.value) {
      const p = proximoLembrete(c);
      if (!p || p.diff > 1) return false;
    }
    return true;
  });
});

const contagemPerfis = computed(() => {
  const perfil = (c) => (c.perfil_decisor || '').trim().toLowerCase();
  return {
    decisores: clientesFiltrados.value.filter(c => perfil(c) === 'decisor').length,
    influenciadores: clientesFiltrados.value.filter(c => perfil(c) === 'influenciador').length,
  };
});

const alternarStatus = (chave) => { filtroStatus.value = filtroStatus.value === chave ? null : chave; aba.value = 'contatos'; };

// ---------- Abas ----------
const aba = ref('contatos');
const totalHistorico = computed(() => {
  const emails = new Set(clientes.value.map(c => String(c.email || '').trim().toLowerCase()));
  return logs.value.filter(l => emails.has(String(l.destinatario || '').trim().toLowerCase())).length;
});

// ---------- Envio manual ----------
const clientesSelecionados = ref([]);
const dialogEnvio = ref(false);
const origemEnvio = ref('selecao');
const pessoasEnvio = ref([]);
const inativosEnvio = ref(0);
const enviando = ref(false);

const naFila = computed(() => ativos.value.filter(c => grupoDoStatus(c) === 'fila'));
const rotuloBotaoEnvio = computed(() => clientesSelecionados.value.length > 0
  ? `Enviar para ${clientesSelecionados.value.length} ${clientesSelecionados.value.length === 1 ? 'selecionado' : 'selecionados'}`
  : 'Enviar pesquisa');

const abrirEnvio = (cliente = null) => {
  if (cliente) {
    origemEnvio.value = 'individual';
    pessoasEnvio.value = [cliente];
    inativosEnvio.value = 0;
  } else if (clientesSelecionados.value.length > 0) {
    origemEnvio.value = 'selecao';
    pessoasEnvio.value = clientesSelecionados.value.filter(ativo);
    inativosEnvio.value = clientesSelecionados.value.length - pessoasEnvio.value.length;
  } else {
    origemEnvio.value = 'fila';
    pessoasEnvio.value = naFila.value;
    inativosEnvio.value = 0;
  }
  dialogEnvio.value = true;
};

const protegerEnvio = (ids) => {
  idsRecemEnviados.value.push(...ids);
  clientes.value.forEach(c => { if (ids.includes(c.cliente_id)) c.status_envio = 'Processando...'; });
  setTimeout(() => {
    idsRecemEnviados.value = idsRecemEnviados.value.filter(id => !ids.includes(id));
    sincronizar();
    carregarLogs();
  }, 15000);
  agendarAtualizacao();
};

const confirmarEnvio = async () => {
  const ids = pessoasEnvio.value.map(c => c.cliente_id).filter(Boolean);
  if (!ids.length) return;
  enviando.value = true;
  idsEnviando.value.push(...ids);
  try {
    if (origemEnvio.value === 'individual') await api.post(`/clientes/${ids[0]}/forcar-envio`);
    else await api.post('/clientes/forcar-envio-lote', { cliente_ids: ids });
    protegerEnvio(ids);
    const quem = ids.length === 1 ? (pessoasEnvio.value[0].nome || 'o contato') : plural(ids.length, 'pessoa', 'pessoas');
    toast.add({ severity: 'success', summary: 'Pesquisa a caminho', detail: `O e-mail para ${quem} está saindo agora. A situação atualiza sozinha nesta tela.`, life: 5000 });
    if (origemEnvio.value !== 'individual') clientesSelecionados.value = [];
    dialogEnvio.value = false;
  } catch (error) {
    const detalhe = detalheDoErro(error);
    if (ehErroAssinatura(detalhe, error?.response?.status)) {
      bloqueioAssinatura.value = detalhe || 'Os envios estão pausados pela assinatura.';
    } else {
      toast.add({ severity: 'error', summary: 'O envio não começou', detail: detalhe || 'Não conseguimos iniciar o envio agora. Tente de novo em instantes.', life: 6000 });
    }
  } finally {
    enviando.value = false;
    idsEnviando.value = idsEnviando.value.filter(id => !ids.includes(id));
  }
};

// ---------- Diálogos ----------
const ajudaVisivel = ref(false);
const dialogRegras = ref(false);
const dialogContato = ref(false);
const aoSalvarRegras = async (novas) => { regras.value = novas; try { const r = await api.get('/lembretes/previa'); lembretes.value = r.data; } catch (e) { /* mantém */ } };
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-6 pb-24">
    <!-- Cabeçalho -->
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Envios<span class="text-orange-500">.</span></h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Quem vai receber a pesquisa, o que já saiu, quem respondeu e o que deu erro.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button @click="ajudaVisivel = true" class="env-btn-quadrado" v-tooltip.bottom="'Como funciona'" aria-label="Como funciona esta tela"><i class="pi pi-question-circle text-sm"></i></button>
        <button @click="carregarTudo" class="env-btn-quadrado" v-tooltip.bottom="'Atualizar'" aria-label="Atualizar"><i :class="['pi pi-refresh text-sm', loading ? 'pi-spin' : '']"></i></button>
        <button v-if="podeCriar" @click="dialogContato = true" class="env-btn-secundario"><i class="pi pi-plus text-xs"></i>Novo contato</button>
        <button v-if="podeDisparar" @click="abrirEnvio()" class="env-btn-primario"><i class="pi pi-send text-xs"></i>{{ rotuloBotaoEnvio }}</button>
      </div>
    </header>

    <AvisoAssinatura v-if="bloqueioAssinatura" :mensagem="bloqueioAssinatura" />

    <!-- Como os envios estão funcionando -->
    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
      <div class="flex items-start gap-3 flex-1 min-w-0">
        <span :class="['mt-1.5 w-2.5 h-2.5 rounded-full shrink-0', automaticoLigado ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600']" aria-hidden="true"></span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Envio automático {{ automaticoLigado ? 'ligado' : 'desligado' }}</p>
          <p class="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
            <template v-if="automaticoLigado">A cada 6 horas o sistema confere a fila e envia para quem está na vez<span v-if="resumo.fila"> ({{ plural(resumo.fila, 'pessoa', 'pessoas') }} agora)</span>.</template>
            <template v-else-if="!enviosAtivos">O envio de e-mails está desligado em Configurações. Ninguém recebe sozinho; você ainda pode enviar manualmente.</template>
            <template v-else>Ninguém recebe sozinho. Envie agora pelo botão <b>Enviar pesquisa</b> ou ligue o envio automático.</template>
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
            A mesma pessoa recebe no máximo a cada {{ recorrencia }} dias ·
            <template v-if="lembretes.ativo && lembretes.dias.length">{{ textoDiasLembrete }}</template>
            <template v-else>Lembretes desligados</template>
          </p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 lg:justify-end">
        <router-link v-if="!enviosAtivos && ehAdmin" to="/configuracoes" class="env-btn-secundario"><i class="pi pi-cog text-xs"></i>Abrir Configurações</router-link>
        <button v-if="ehAdmin" @click="dialogRegras = true" class="env-btn-secundario"><i class="pi pi-sliders-h text-xs"></i>Regras de envio</button>
      </div>
    </section>

    <!-- Resumo: cada cartão filtra a lista -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <button v-for="c in CARTOES" :key="c.chave" @click="alternarStatus(c.chave)" :aria-pressed="filtroStatus === c.chave"
        class="text-left flex flex-col justify-start bg-white dark:bg-slate-900 rounded-2xl border p-4 transition-colors min-w-0"
        :class="filtroStatus === c.chave ? 'border-orange-400 ring-2 ring-orange-500/20 dark:border-orange-500/60' : 'border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-500/40'">
        <span class="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <i :class="['pi text-sm', c.icone, c.chave === 'erro' && resumo.erro ? 'text-rose-500' : c.chave === 'respondido' ? 'text-emerald-500' : c.chave === 'aguardando' ? 'text-amber-500' : 'text-slate-400']"></i>{{ c.rotulo }}
        </span>
        <span class="block text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">{{ resumo[c.chave] }}</span>
        <span class="block text-sm text-slate-500 dark:text-slate-400">{{ c.dica }}</span>
      </button>
    </div>

    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 sm:p-5 min-w-0">
      <!-- Abas -->
      <div class="flex gap-1 border-b border-slate-200 dark:border-slate-800 mb-4" role="tablist">
        <button role="tab" :aria-selected="aba === 'contatos'" @click="aba = 'contatos'" :class="['env-aba', aba === 'contatos' && 'env-aba-ativa']">
          <i class="pi pi-users hidden sm:inline-block"></i>Contatos<span class="env-contador">{{ clientesFiltrados.length }}</span>
        </button>
        <button role="tab" :aria-selected="aba === 'historico'" @click="aba = 'historico'" :class="['env-aba', aba === 'historico' && 'env-aba-ativa']">
          <i class="pi pi-history hidden sm:inline-block"></i>Histórico<span v-if="totalHistorico" class="env-contador">{{ totalHistorico }}</span>
        </button>
      </div>

      <div v-show="aba === 'contatos'" class="flex flex-col gap-4">
        <!-- Busca e filtros -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative flex-1 min-w-[200px] max-w-md">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
            <input v-model="pesquisa" type="search" aria-label="Buscar" placeholder="Buscar por nome, e-mail ou empresa" class="env-input w-full pl-9!" />
          </div>
          <button @click="filtrosAbertos = !filtrosAbertos" :aria-expanded="filtrosAbertos"
            class="env-btn-secundario" :class="filtrosExtras ? 'border-orange-300! text-orange-700! dark:text-orange-300!' : ''">
            <i class="pi pi-filter text-xs"></i>Filtros<span v-if="filtrosExtras" class="env-contador">{{ filtrosExtras }}</span>
          </button>
          <button v-if="algumFiltro" @click="limparFiltros" class="env-link px-2">Limpar filtros</button>
        </div>

        <div v-if="filtrosAbertos" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
          <label class="env-campo">
            <span>Grupo</span>
            <select v-model="filtroCompanhia" class="env-input"><option value="">Todos</option><option v-for="c in companhias" :key="c.id" :value="c.nome">{{ c.nome }}</option></select>
          </label>
          <label class="env-campo">
            <span>Responsável</span>
            <select v-model="filtroGestor" class="env-input"><option value="">Todos</option><option v-for="g in nomesGestores" :key="g" :value="g">{{ g }}</option></select>
          </label>
          <label class="env-campo">
            <span>Data do</span>
            <select v-model="filtroTipoData" class="env-input"><option value="proximo_envio">Próximo envio</option><option value="ultimo_envio">Último envio</option></select>
          </label>
          <div class="env-campo">
            <span>Entre</span>
            <div class="flex items-center gap-2">
              <input v-model="filtroDataInicio" type="date" aria-label="Data inicial" class="env-input flex-1 min-w-0" />
              <input v-model="filtroDataFim" type="date" aria-label="Data final" class="env-input flex-1 min-w-0" />
            </div>
          </div>
          <label class="flex items-center gap-2 cursor-pointer sm:col-span-1 lg:col-span-2">
            <InputSwitch v-model="soLembreteProximo" class="env-switch scale-75 shrink-0" />
            <span class="text-sm text-slate-600 dark:text-slate-300">Só quem recebe lembrete hoje ou amanhã</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer lg:col-span-2">
            <InputSwitch v-model="mostrarInativos" class="env-switch scale-75 shrink-0" />
            <span class="text-sm text-slate-600 dark:text-slate-300">Mostrar contatos inativos (não recebem pesquisas)</span>
          </label>
        </div>

        <p v-if="clientesFiltrados.length" class="text-sm text-slate-500 dark:text-slate-400">
          {{ plural(clientesFiltrados.length, 'contato', 'contatos') }} · {{ plural(contagemPerfis.decisores, 'decisor', 'decisores') }} · {{ plural(contagemPerfis.influenciadores, 'influenciador', 'influenciadores') }}
          <template v-if="podeDisparar"> · Marque contatos para enviar só para eles.</template>
        </p>

        <DataTable :value="clientesFiltrados" v-model:selection="clientesSelecionados" :paginator="clientesFiltrados.length > 10" :rows="10"
          :loading="loading" dataKey="cliente_id" responsiveLayout="stack" breakpoint="768px" class="env-tabela" rowHover>
          <template #empty>
            <EstadoVazio v-if="!clientes.length && !loading" icone="pi-users" titulo="Nenhum contato ainda" texto="Importe a planilha dos seus clientes ou cadastre o primeiro contato para começar a enviar pesquisas.">
              <router-link to="/importacao" class="env-btn-primario"><i class="pi pi-upload text-xs"></i>Importar planilha</router-link>
              <button v-if="podeCriar" @click="dialogContato = true" class="env-btn-secundario"><i class="pi pi-plus text-xs"></i>Cadastrar contato</button>
            </EstadoVazio>
            <EstadoVazio v-else-if="filtroStatus === 'fila' && !pesquisa && !filtrosExtras" icone="pi-inbox" titulo="Ninguém na fila agora" :texto="`Todos os contatos ativos já receberam a pesquisa nos últimos ${recorrencia} dias.`">
              <button @click="filtroStatus = null" class="env-btn-secundario">Ver todos os contatos</button>
            </EstadoVazio>
            <EstadoVazio v-else-if="filtroStatus === 'erro' && !pesquisa && !filtrosExtras" icone="pi-check-circle" titulo="Nenhum envio com erro" texto="Todos os e-mails saíram normalmente.">
              <button @click="filtroStatus = null" class="env-btn-secundario">Ver todos os contatos</button>
            </EstadoVazio>
            <EstadoVazio v-else-if="!loading" icone="pi-filter-slash" titulo="Ninguém com esses filtros" texto="Tente outra busca ou limpe os filtros.">
              <button @click="limparFiltros" class="env-btn-secundario">Limpar filtros</button>
            </EstadoVazio>
          </template>

          <Column v-if="podeDisparar" selectionMode="multiple" headerStyle="width: 3rem" />

          <Column field="nome" header="Contato" sortable style="min-width: 200px; max-width: 320px">
            <template #body="{ data }">
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {{ data.nome || 'Sem nome' }}
                  <i v-if="data.tem_acao_pendente" class="pi pi-bolt text-amber-500 text-xs ml-1" v-tooltip.top="'A empresa tem plano de ação em aberto'" aria-label="Plano de ação em aberto"></i>
                </span>
                <span class="text-sm text-slate-500 dark:text-slate-400 break-all">{{ data.email }}</span>
                <span class="text-sm text-slate-500 dark:text-slate-400">
                  {{ data.empresa || 'Sem empresa' }}<template v-if="data.cargo"> · {{ data.cargo }}</template><template v-if="data.perfil_decisor"> · {{ data.perfil_decisor }}</template>
                </span>
              </div>
            </template>
          </Column>

          <Column field="status_envio" header="Situação" sortable style="min-width: 220px">
            <template #body="{ data }">
              <div class="flex flex-col items-start gap-1 min-w-0">
                <span :class="['env-tag', situacao(data).classe]">
                  <i v-if="grupoDoStatus(data) === 'processando'" class="pi pi-spin pi-spinner text-xs"></i>{{ situacao(data).rotulo }}
                </span>
                <template v-if="ativo(data)">
                  <span v-if="grupoDoStatus(data) === 'aguardando'" class="text-sm text-slate-600 dark:text-slate-300">
                    Enviada em {{ formatarData(data.data_envio_inicial || data.ultimo_envio) || '—' }}
                  </span>
                  <span v-if="grupoDoStatus(data) === 'aguardando'" class="text-sm text-slate-500 dark:text-slate-400">{{ textoLembrete(data) }}</span>
                  <span v-else-if="grupoDoStatus(data) === 'respondido'" class="text-sm text-slate-500 dark:text-slate-400">
                    Respondeu<template v-if="Number(data.lembretes_enviados) > 0"> depois de {{ plural(Number(data.lembretes_enviados), 'lembrete', 'lembretes') }}</template>
                  </span>
                  <template v-else-if="grupoDoStatus(data) === 'erro'">
                    <span class="text-sm text-slate-600 dark:text-slate-300 max-w-[340px]">{{ causaDoErro(data).texto }}</span>
                    <button v-if="causaDoErro(data).assinatura" @click="router.push('/assinatura')" class="env-link">Ver assinatura</button>
                    <router-link v-else-if="causaDoErro(data).configuracao && ehAdmin" to="/configuracoes" class="env-link">Abrir Configurações</router-link>
                  </template>
                </template>
              </div>
            </template>
          </Column>

          <Column field="proximo_envio" header="Próximo envio" sortable style="min-width: 140px">
            <template #body="{ data }">
              <div class="flex flex-col">
                <span class="text-sm text-slate-700 dark:text-slate-200 tabular-nums">
                  {{ !ativo(data) ? '—' : grupoDoStatus(data) === 'fila' ? (automaticoLigado ? 'No próximo envio' : 'Quando você enviar') : (formatarData(data.proximo_envio) || '—') }}
                </span>
                <span v-if="formatarData(data.ultimo_envio) && grupoDoStatus(data) !== 'aguardando'" class="text-sm text-slate-500 dark:text-slate-400">Último: {{ formatarData(data.ultimo_envio) }}</span>
              </div>
            </template>
          </Column>

          <Column field="gestor" header="Responsável" sortable style="min-width: 130px">
            <template #body="{ data }">
              <span class="text-sm" :class="data.gestor ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'">{{ data.gestor || 'Sem responsável' }}</span>
            </template>
          </Column>

          <Column v-if="podeDisparar" header="" headerStyle="width: 1%">
            <template #body="{ data }">
              <div class="flex justify-end w-full">
                <button v-if="ativo(data)" @click="abrirEnvio(data)" :disabled="idsEnviando.includes(data.cliente_id) || grupoDoStatus(data) === 'processando'"
                  class="env-btn-secundario env-btn-pequeno" :aria-label="`Enviar pesquisa para ${data.nome}`">
                  <i :class="['pi text-xs', idsEnviando.includes(data.cliente_id) ? 'pi-spin pi-spinner' : grupoDoStatus(data) === 'erro' ? 'pi-refresh' : 'pi-send']"></i>
                  {{ grupoDoStatus(data) === 'erro' ? 'Tentar de novo' : 'Enviar' }}
                </button>
                <span v-else class="text-sm text-slate-400" v-tooltip.top="'Contatos inativos não recebem pesquisas'">Inativo</span>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <HistoricoEnvios v-if="aba === 'historico'" :logs="logs" :clientes="clientes" :carregando="carregandoLogs"
        :podeDisparar="podeDisparar" :idsEnviando="idsEnviando" @reenviar="abrirEnvio">
        <template #acao-vazio>
          <button v-if="podeDisparar" @click="aba = 'contatos'; abrirEnvio()" class="env-btn-primario"><i class="pi pi-send text-xs"></i>Enviar primeira pesquisa</button>
        </template>
      </HistoricoEnvios>
    </section>

    <AjudaEnvios v-model:visible="ajudaVisivel" :recorrencia="recorrencia" />
    <DialogRegrasEnvio v-model:visible="dialogRegras" :regras="regras" :enviosAtivos="enviosAtivos" @salvo="aoSalvarRegras" />
    <DialogConfirmarEnvio v-model:visible="dialogEnvio" :pessoas="pessoasEnvio" :inativos="inativosEnvio" :origem="origemEnvio"
      :bloqueio="bloqueioAssinatura" :enviando="enviando" @confirmar="confirmarEnvio" />
    <DialogNovoContato v-model:visible="dialogContato" :empresas="empresas" :perfis="perfis" :cargos="cargos" :gestores="gestores"
      :segmentos="segmentos" @salvo="sincronizar" />
  </div>
</template>

<style scoped>
@reference "../style.css";

.env-aba { @apply inline-flex items-center gap-2 px-3 py-2.5 -mb-px border-b-2 border-transparent text-sm font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200; }
.env-aba-ativa { @apply border-orange-500 text-orange-700 dark:text-orange-400; }

/* Tabelas (também usadas pelo Histórico) */
:deep(.env-tabela) { @apply bg-transparent!; font-family: inherit; }
:deep(.env-tabela .p-datatable-wrapper) { @apply overflow-x-auto; }
:deep(.env-tabela .p-datatable-thead > tr > th) { @apply bg-slate-50! dark:bg-slate-800/60! text-xs! font-semibold! text-slate-500! dark:text-slate-400! border-slate-100! dark:border-slate-800! py-3! px-4! whitespace-nowrap; }
:deep(.env-tabela .p-datatable-thead > tr > th .p-sortable-column-icon) { @apply text-slate-400! w-3! h-3!; }
:deep(.env-tabela .p-datatable-tbody > tr) { @apply bg-white! dark:bg-slate-900! text-slate-700! dark:text-slate-200!; }
:deep(.env-tabela .p-datatable-tbody > tr:hover) { @apply bg-slate-50! dark:bg-slate-800/50!; }
:deep(.env-tabela .p-datatable-tbody > tr.p-highlight) { @apply bg-orange-50! dark:bg-orange-500/10!; }
:deep(.env-tabela .p-datatable-tbody > tr > td) { @apply py-3! px-4! text-sm border-slate-100! dark:border-slate-800! align-top; }
:deep(.env-tabela .p-datatable-emptymessage > td) { @apply p-0!; }
:deep(.env-tabela .p-paginator) { @apply bg-transparent! border-0! text-sm; }
:deep(.env-tabela .p-paginator .p-paginator-page.p-highlight) { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
:deep(.env-tabela .p-paginator button) { @apply dark:text-slate-400!; }
:deep(.env-tabela .p-datatable-loading-overlay) { @apply bg-white/60! dark:bg-slate-900/60!; }
:deep(.env-tabela .p-checkbox .p-checkbox-box) { @apply border-slate-300! dark:border-slate-600! dark:bg-slate-900!; }
:deep(.env-tabela .p-checkbox .p-checkbox-box.p-highlight) { @apply border-orange-500! bg-orange-500!; }
:deep(.env-tabela .p-column-title) { @apply text-sm font-semibold text-slate-500 dark:text-slate-400 mr-4 shrink-0; }
@media (max-width: 767px) {
  :deep(.env-tabela .p-datatable-tbody > tr) { @apply border-b! border-slate-200! dark:border-slate-800! py-1; }
  :deep(.env-tabela .p-datatable-tbody > tr > td) { @apply border-0! py-2! px-1! gap-2 min-w-0; }
  :deep(.env-tabela .p-datatable-tbody > tr > td > div),
  :deep(.env-tabela .p-datatable-tbody > tr > td > span:not(.p-column-title)) { @apply flex-1 min-w-0 items-end text-right; }
  :deep(.env-tabela .p-datatable-tbody > tr > td > div > span) { @apply max-w-full; }
  :deep(.env-tabela .p-datatable-tbody > tr > td:last-child) { @apply justify-end!; }
  :deep(.env-tabela .p-datatable-tbody > tr > td:last-child .p-column-title) { @apply hidden; }
  :deep(.env-tabela .p-datatable-tbody > tr > td:last-child > div) { @apply flex-none w-auto; }
  :deep(.env-tabela .p-datatable-tbody > tr.p-datatable-emptymessage > td) { @apply block! w-full!; }
  :deep(.env-tabela .p-datatable-tbody > tr.p-datatable-emptymessage > td > div) { @apply items-center text-center; }
}
</style>

<style>
@reference "../style.css";
/* Estilos globais com prefixo env-: também valem nos diálogos e na ajuda (renderizados fora da página) */
.env-btn-primario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap; }
.env-btn-secundario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-orange-300 hover:text-orange-700 dark:hover:text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap; }
.env-btn-pequeno { @apply h-9 px-3; }
.env-btn-quadrado { @apply w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300; }
.env-link { @apply text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline; }
.env-input { @apply h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20; }
.dark .env-input { color-scheme: dark; }
.env-contador { @apply text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums; }
.env-switch.p-inputswitch.p-highlight .p-inputswitch-slider { @apply bg-orange-500!; }
.env-switch.p-inputswitch:not(.p-highlight) .p-inputswitch-slider { @apply dark:bg-slate-700!; }

/* Situação */
.env-tag { @apply inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap; }
.env-tag-neutro { @apply bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300; }
.env-tag-espera { @apply bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300; }
.env-tag-ok { @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300; }
.env-tag-erro { @apply bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300; }

/* Campos */
.env-campo { @apply flex flex-col gap-1.5 min-w-0; }
.env-campo > label, .env-campo > span { @apply text-sm font-semibold text-slate-700 dark:text-slate-200; }
.env-campo .p-inputtext,
.env-campo .p-dropdown { @apply w-full rounded-xl! border-slate-300! dark:border-slate-700! bg-white! dark:bg-slate-950! text-sm! text-slate-800! dark:text-slate-100!; }
.env-campo .p-inputtext { @apply h-10 px-3!; font-family: inherit; }
.env-painel li, .env-painel .p-inputtext { font-family: inherit; }
.env-campo .p-inputnumber .p-inputtext { @apply w-full; }
.env-campo .p-dropdown .p-inputtext { @apply h-auto border-0! bg-transparent!; }
.env-campo .p-dropdown .p-dropdown-label.p-placeholder,
.env-campo .p-inputtext::placeholder { @apply text-slate-400!; }
.env-campo .p-dropdown .p-dropdown-trigger { @apply text-slate-400!; }
.env-campo .p-inputtext:enabled:focus,
.env-campo .p-dropdown:not(.p-disabled).p-focus { @apply border-orange-400! shadow-none! ring-2 ring-orange-500/20; }
.env-painel.p-dropdown-panel { @apply dark:bg-slate-900! dark:border-slate-700!; }
.env-painel .p-dropdown-item { @apply text-sm! dark:text-slate-200!; }
.env-painel .p-dropdown-item.p-highlight { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
.env-painel .p-dropdown-filter { @apply dark:bg-slate-950! dark:text-slate-100! dark:border-slate-700!; }
.env-painel .p-dropdown-header { @apply dark:bg-slate-900!; }
.env-painel .p-dropdown-empty-message { @apply dark:text-slate-400!; }

/* Diálogos */
.env-dialog.p-dialog { @apply rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl; }
.env-dialog .p-dialog-header { @apply bg-white dark:bg-slate-900 px-6! py-4! border-b border-slate-100 dark:border-slate-800; }
.env-dialog .p-dialog-title { @apply text-lg! font-bold! text-slate-900 dark:text-white; }
.env-dialog .p-dialog-header-icon { @apply text-slate-500! dark:text-slate-400! hover:bg-slate-100! dark:hover:bg-slate-800!; }
.env-dialog .p-dialog-content { @apply bg-white dark:bg-slate-900 px-6! py-5! text-slate-700 dark:text-slate-200; }
.env-dialog .p-dialog-footer { @apply bg-slate-50 dark:bg-slate-900 px-6! py-4! border-t border-slate-100 dark:border-slate-800; }

/* Ajuda */
.env-ajuda.p-sidebar { @apply bg-white! dark:bg-slate-950! dark:border-l dark:border-slate-800; }
.env-ajuda .p-sidebar-header { @apply dark:bg-slate-950; }
.env-ajuda .p-sidebar-close { @apply text-slate-500! dark:text-slate-400!; }
.env-ajuda-bloco { @apply p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800; }
.env-ajuda-bloco h3 { @apply flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-2; }
.env-ajuda-bloco dd { @apply mt-1; }
</style>
