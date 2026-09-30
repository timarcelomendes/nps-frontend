<script setup>
import { ref, computed, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
import api from '../services/api';
import { formatarDataLocal } from '../utils/formatters';
import {
  GRUPOS_EVENTO, NIVEIS, nivelDe, tipoDe, mensagemSimples, origemDe,
  statusEmailDe, detalhesEmail, erroSimples,
} from '../components/auditoria/eventos';

const toast = useToast();
const LIMITE_API_LOGS = 200; // o backend devolve só os 200 eventos mais recentes

const abaAtiva = ref(0);

// Converte a data UTC do banco em Date (mesma regra de formatarDataLocal)
const paraData = (s) => {
  if (!s) return null;
  let iso = String(s).replace(' ', 'T');
  if (!/Z$|[+-]\d\d:?\d\d$/.test(iso)) iso += 'Z';
  const d = new Date(iso);
  return isNaN(d) ? null : d;
};

const PERIODOS = [
  { valor: 'tudo', rotulo: 'Qualquer data' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7', rotulo: 'Últimos 7 dias' },
  { valor: '30', rotulo: 'Últimos 30 dias' },
];
const dentroDoPeriodo = (data, periodo) => {
  if (periodo === 'tudo') return true;
  if (!data) return false;
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  if (periodo !== 'hoje') inicio.setDate(inicio.getDate() - (Number(periodo) - 1));
  return data >= inicio;
};
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Atividades (logs do sistema) ----------
const logs = ref([]);
const carregandoLogs = ref(true);
const filtroLog = ref({ busca: '', periodo: 'tudo', grupo: '', nivel: '' });

const carregarLogs = async () => {
  carregandoLogs.value = true;
  try {
    const { data } = await api.get('/logs');
    logs.value = (Array.isArray(data) ? data : []).map((l) => {
      const tipo = tipoDe(l.acao);
      const origem = origemDe(l);
      const texto = mensagemSimples(l);
      return {
        ...l,
        _data: paraData(l.data_criacao),
        _tipo: tipo,
        _nivel: nivelDe(l.nivel),
        _nivelChave: String(l.nivel || 'INFO').toUpperCase(),
        _origem: origem,
        _texto: texto,
        _busca: semAcento([texto, l.mensagem, tipo.rotulo, origem.nome].join(' ')),
      };
    });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Não foi possível carregar', detail: 'Não conseguimos buscar o registro de atividades. Tente de novo em instantes.', life: 5000 });
  } finally {
    carregandoLogs.value = false;
  }
};

const gruposPresentes = computed(() => GRUPOS_EVENTO.filter((g) => logs.value.some((l) => l._tipo.grupo === g)));

const logsVisiveis = computed(() => {
  const f = filtroLog.value;
  const termo = semAcento(f.busca.trim());
  return logs.value.filter((l) =>
    dentroDoPeriodo(l._data, f.periodo)
    && (!f.grupo || l._tipo.grupo === f.grupo)
    && (!f.nivel || l._nivelChave === f.nivel)
    && (!termo || l._busca.includes(termo)));
});

const filtrosLogAtivos = computed(() => {
  const f = filtroLog.value;
  return !!(f.busca || f.grupo || f.nivel || f.periodo !== 'tudo');
});
const limparFiltrosLog = () => { filtroLog.value = { busca: '', periodo: 'tudo', grupo: '', nivel: '' }; };

// ---------- E-mails enviados ----------
const emails = ref([]);
const carregandoEmails = ref(false);
const emailsCarregados = ref(false);
const filtroEmail = ref({ busca: '', periodo: 'tudo', status: '' });
const dialogEmailVisivel = ref(false);
const emailSelecionado = ref(null);

const carregarEmails = async () => {
  carregandoEmails.value = true;
  try {
    const { data } = await api.get('/logs/emails');
    emails.value = (Array.isArray(data) ? data : []).map((e) => {
      const status = statusEmailDe(e.status);
      return {
        ...e,
        _data: paraData(e.data_envio || e.created_at),
        _status: status,
        _busca: semAcento([e.nome_cliente, e.destinatario, e.assunto, status.rotulo].join(' ')),
      };
    });
    emailsCarregados.value = true;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Não foi possível carregar', detail: 'Não conseguimos buscar o histórico de e-mails. Tente de novo em instantes.', life: 5000 });
  } finally {
    carregandoEmails.value = false;
  }
};

const statusPresentes = computed(() => [...new Set(emails.value.map((e) => e._status.rotulo))].sort());

const emailsVisiveis = computed(() => {
  const f = filtroEmail.value;
  const termo = semAcento(f.busca.trim());
  return emails.value.filter((e) =>
    dentroDoPeriodo(e._data, f.periodo)
    && (!f.status || e._status.rotulo === f.status)
    && (!termo || e._busca.includes(termo)));
});
const totalFalhas = computed(() => emails.value.filter((e) => e._status.rotulo === 'Falhou').length);

const filtrosEmailAtivos = computed(() => {
  const f = filtroEmail.value;
  return !!(f.busca || f.status || f.periodo !== 'tudo');
});
const limparFiltrosEmail = () => { filtroEmail.value = { busca: '', periodo: 'tudo', status: '' }; };
const verSoFalhas = () => { filtroEmail.value = { ...filtroEmail.value, status: 'Falhou' }; };

const detalhe = computed(() => (emailSelecionado.value ? detalhesEmail(emailSelecionado.value) : null));

const verDetalhesEmail = (dados) => {
  emailSelecionado.value = dados;
  dialogEmailVisivel.value = true;
};

// Os e-mails só são buscados quando a aba é aberta pela primeira vez
const aoTrocarAba = (e) => {
  if (e.index === 1 && !emailsCarregados.value) carregarEmails();
};

const atualizar = () => (abaAtiva.value === 1 ? carregarEmails() : carregarLogs());
const carregando = computed(() => (abaAtiva.value === 1 ? carregandoEmails.value : carregandoLogs.value));

onMounted(carregarLogs);
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-6 pb-24">
    <header class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Auditoria<span class="text-orange-500">.</span></h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Quem fez o quê na sua conta, os envios automáticos e os e-mails que falharam.</p>
      </div>
      <button @click="atualizar" class="aud-btn-quadrado" title="Atualizar" aria-label="Atualizar">
        <i :class="['pi pi-refresh text-sm', carregando ? 'pi-spin' : '']"></i>
      </button>
    </header>

    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 sm:p-5 min-w-0">
      <TabView v-model:activeIndex="abaAtiva" @tab-change="aoTrocarAba" class="aud-abas">
        <!-- ATIVIDADES -->
        <TabPanel>
          <template #header>
            <i class="pi pi-history"></i><span>Atividades</span>
            <span v-if="!carregandoLogs" class="aud-contador">{{ logs.length }}</span>
          </template>

          <div class="aud-filtros">
            <div class="aud-busca">
              <i class="pi pi-search"></i>
              <input v-model="filtroLog.busca" type="text" role="searchbox" aria-label="Buscar nas atividades" placeholder="Buscar por pessoa ou descrição" />
              <button v-if="filtroLog.busca" @click="filtroLog.busca = ''" aria-label="Limpar busca"><i class="pi pi-times text-xs"></i></button>
            </div>
            <select v-model="filtroLog.periodo" class="aud-select" aria-label="Período">
              <option v-for="p in PERIODOS" :key="p.valor" :value="p.valor">{{ p.rotulo }}</option>
            </select>
            <select v-model="filtroLog.grupo" class="aud-select" aria-label="Tipo de evento">
              <option value="">Todos os tipos</option>
              <option v-for="g in gruposPresentes" :key="g" :value="g">{{ g }}</option>
            </select>
            <select v-model="filtroLog.nivel" class="aud-select" aria-label="Gravidade">
              <option value="">Toda gravidade</option>
              <option v-for="(n, chave) in NIVEIS" :key="chave" :value="chave">{{ n.rotulo }}</option>
            </select>
            <button v-if="filtrosLogAtivos" @click="limparFiltrosLog" class="aud-link">Limpar filtros</button>
          </div>

          <p v-if="!carregandoLogs && logs.length >= LIMITE_API_LOGS" class="aud-aviso">
            <i class="pi pi-info-circle"></i> Mostrando as {{ LIMITE_API_LOGS }} atividades mais recentes.
          </p>

          <DataTable :value="logsVisiveis" :loading="carregandoLogs" dataKey="id" paginator :rows="15"
            paginatorTemplate="PrevPageLink PageLinks NextPageLink CurrentPageReport" currentPageReportTemplate="{first}–{last} de {totalRecords}"
            responsiveLayout="stack" breakpoint="768px" class="aud-tabela" rowHover>
            <template #empty>
              <div class="aud-vazio">
                <i class="pi pi-history"></i>
                <template v-if="filtrosLogAtivos">
                  <strong>Nenhuma atividade com esses filtros</strong>
                  <button @click="limparFiltrosLog" class="aud-link">Limpar filtros</button>
                </template>
                <template v-else>
                  <strong>Nenhuma atividade registrada ainda</strong>
                  <span>Envios, exclusões e mudanças de configuração aparecem aqui.</span>
                </template>
              </div>
            </template>

            <Column field="data_criacao" header="Quando" sortable style="width: 11rem">
              <template #body="{ data }">
                <span class="text-sm text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{{ formatarDataLocal(data.data_criacao) }}</span>
              </template>
            </Column>

            <Column header="O que aconteceu" bodyClass="aud-col-evento">
              <template #body="{ data }">
                <div class="flex items-start gap-3 min-w-0">
                  <span class="aud-icone-evento" :class="data._nivel.classe"><i :class="['pi', data._tipo.icone]"></i></span>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span class="text-sm font-semibold text-slate-900 dark:text-white">{{ data._tipo.rotulo }}</span>
                      <span v-if="data._nivelChave !== 'INFO'" class="aud-selo" :class="data._nivel.classe">{{ data._nivel.rotulo }}</span>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mt-0.5 break-words" :title="data.mensagem">{{ data._texto }}</p>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="usuario_nome" header="Quem" sortable style="width: 14rem">
              <template #body="{ data }">
                <span class="inline-flex items-center gap-2 text-sm min-w-0" :class="data._origem.automatico ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'">
                  <i :class="['pi text-xs', data._origem.automatico ? 'pi-cog' : 'pi-user']"></i>
                  <span class="truncate">{{ data._origem.nome }}</span>
                </span>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- E-MAILS ENVIADOS -->
        <TabPanel>
          <template #header>
            <i class="pi pi-envelope"></i><span>E-mails enviados</span>
            <span v-if="emailsCarregados" class="aud-contador">{{ emails.length }}</span>
          </template>

          <div v-if="totalFalhas > 0 && filtroEmail.status !== 'Falhou'" class="aud-alerta-erro">
            <i class="pi pi-exclamation-circle"></i>
            <span class="flex-1">{{ totalFalhas }} e-mail{{ totalFalhas === 1 ? '' : 's' }} não {{ totalFalhas === 1 ? 'foi enviado' : 'foram enviados' }}.</span>
            <button @click="verSoFalhas" class="font-semibold underline underline-offset-2">Ver quais</button>
          </div>

          <div class="aud-filtros">
            <div class="aud-busca">
              <i class="pi pi-search"></i>
              <input v-model="filtroEmail.busca" type="text" role="searchbox" aria-label="Buscar nos e-mails" placeholder="Buscar por contato, e-mail ou assunto" />
              <button v-if="filtroEmail.busca" @click="filtroEmail.busca = ''" aria-label="Limpar busca"><i class="pi pi-times text-xs"></i></button>
            </div>
            <select v-model="filtroEmail.periodo" class="aud-select" aria-label="Período">
              <option v-for="p in PERIODOS" :key="p.valor" :value="p.valor">{{ p.rotulo }}</option>
            </select>
            <select v-model="filtroEmail.status" class="aud-select" aria-label="Situação">
              <option value="">Toda situação</option>
              <option v-for="s in statusPresentes" :key="s" :value="s">{{ s }}</option>
            </select>
            <button v-if="filtrosEmailAtivos" @click="limparFiltrosEmail" class="aud-link">Limpar filtros</button>
          </div>

          <DataTable :value="emailsVisiveis" :loading="carregandoEmails" dataKey="id" paginator :rows="15"
            paginatorTemplate="PrevPageLink PageLinks NextPageLink CurrentPageReport" currentPageReportTemplate="{first}–{last} de {totalRecords}"
            responsiveLayout="stack" breakpoint="768px" class="aud-tabela" rowHover>
            <template #empty>
              <div class="aud-vazio">
                <i class="pi pi-envelope"></i>
                <template v-if="filtrosEmailAtivos">
                  <strong>Nenhum e-mail com esses filtros</strong>
                  <button @click="limparFiltrosEmail" class="aud-link">Limpar filtros</button>
                </template>
                <template v-else>
                  <strong>Nenhum e-mail enviado ainda</strong>
                  <span>Os convites de pesquisa e avisos enviados aparecem aqui.</span>
                </template>
              </div>
            </template>

            <Column field="data_envio" header="Quando" sortable style="width: 11rem">
              <template #body="{ data }">
                <span class="text-sm text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{{ formatarDataLocal(data.data_envio || data.created_at) }}</span>
              </template>
            </Column>

            <Column field="destinatario" header="Para" sortable>
              <template #body="{ data }">
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ data.nome_cliente || 'Contato sem nome' }}</span>
                  <span class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ data.destinatario }}</span>
                </div>
              </template>
            </Column>

            <Column field="assunto" header="Assunto" sortable>
              <template #body="{ data }">
                <span class="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 break-words" :title="data.assunto">{{ data.assunto }}</span>
              </template>
            </Column>

            <Column field="status" header="Situação" sortable style="width: 9rem">
              <template #body="{ data }">
                <span class="aud-selo" :class="data._status.classe"><i :class="['pi', data._status.icone]"></i>{{ data._status.rotulo }}</span>
              </template>
            </Column>

            <Column header="Detalhes" style="width: 6rem">
              <template #body="{ data }">
                <button class="aud-btn-icone" @click="verDetalhesEmail(data)" v-tooltip.top="'Ver detalhes'" aria-label="Ver detalhes do e-mail">
                  <i class="pi pi-eye"></i>
                </button>
              </template>
            </Column>
          </DataTable>
        </TabPanel>
      </TabView>
    </section>

    <Dialog v-model:visible="dialogEmailVisivel" modal header="Detalhes do e-mail" :style="{ width: '36rem' }" :breakpoints="{ '640px': '94vw' }" class="aud-dialog" dismissableMask>
      <div v-if="emailSelecionado && detalhe" class="flex flex-col gap-4">
        <div class="aud-campo">
          <span>Assunto</span>
          <p class="font-semibold text-slate-900 dark:text-white">{{ emailSelecionado.assunto }}</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="aud-campo">
            <span>Para</span>
            <p>{{ emailSelecionado.nome_cliente || 'Contato sem nome' }}<br /><span class="text-slate-500 dark:text-slate-400 break-all">{{ emailSelecionado.destinatario }}</span></p>
          </div>
          <div class="aud-campo">
            <span>Quando</span>
            <p>{{ formatarDataLocal(emailSelecionado.data_envio || emailSelecionado.created_at) }}</p>
          </div>
        </div>
        <div class="aud-campo">
          <span>Situação</span>
          <p><span class="aud-selo" :class="emailSelecionado._status.classe"><i :class="['pi', emailSelecionado._status.icone]"></i>{{ emailSelecionado._status.rotulo }}</span></p>
        </div>
        <div v-if="detalhe.link" class="aud-campo">
          <span>Link da pesquisa</span>
          <a :href="detalhe.link" target="_blank" rel="noopener" class="text-sm text-orange-600 dark:text-orange-400 hover:underline break-all">{{ detalhe.link }}</a>
        </div>
        <div v-if="detalhe.erro" class="aud-alerta-erro !mb-0 items-start">
          <i class="pi pi-exclamation-circle mt-0.5"></i>
          <span>{{ erroSimples(detalhe.erro) }}</span>
        </div>
        <details v-if="detalhe.erro || (!detalhe.link && detalhe.bruto)" class="aud-tecnico">
          <summary>Detalhe técnico</summary>
          <pre>{{ detalhe.erro || detalhe.bruto }}</pre>
        </details>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
@reference "../style.css";

/* Abas */
:deep(.aud-abas .p-tabview-nav-container),
:deep(.aud-abas .p-tabview-nav-content) { @apply bg-transparent! border-0!; }
:deep(.aud-abas .p-tabview-nav-content) { @apply overflow-x-auto; scrollbar-width: none; }
:deep(.aud-abas .p-tabview-nav) { @apply bg-transparent! border-0! border-b! border-slate-200! dark:border-slate-800! flex-nowrap gap-1 mb-4; }
:deep(.aud-abas .p-tabview-nav li .p-tabview-nav-link) {
  @apply bg-transparent! border-0! border-b-2! border-transparent! rounded-none! px-3! py-2.5! gap-2 text-sm! font-semibold! text-slate-500! dark:text-slate-400! whitespace-nowrap shadow-none!;
  margin: 0 !important;
}
:deep(.aud-abas .p-tabview-nav li .p-tabview-nav-link:hover) { @apply text-slate-800! dark:text-slate-200!; }
:deep(.aud-abas .p-tabview-nav li.p-highlight .p-tabview-nav-link) { @apply border-orange-500! text-orange-700! dark:text-orange-400!; }
:deep(.aud-abas .p-tabview-ink-bar) { display: none; }
:deep(.aud-abas .p-tabview-nav-link > .pi) { @apply hidden sm:inline-block; }
:deep(.aud-abas .p-tabview-panels) { @apply bg-transparent! p-0! text-slate-700 dark:text-slate-200; }
.aud-contador { @apply text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tabular-nums; }
:deep(.p-highlight .aud-contador) { @apply bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300; }

/* Filtros */
.aud-filtros { @apply flex flex-wrap items-center gap-2 mb-4; }
.aud-busca { @apply relative flex-1 min-w-[220px] max-w-md; }
.aud-busca > .pi-search { @apply absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none; }
.aud-busca input { @apply w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20; }
.aud-busca button { @apply absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200; }
.aud-select { @apply h-10 pl-3 pr-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 cursor-pointer max-w-full; }
.aud-link { @apply text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline px-1; }
.aud-aviso { @apply flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-3; }
.aud-icone-evento { @apply w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center text-sm border-0!; }
.aud-vazio { @apply flex flex-col items-center gap-1.5 py-12 text-center text-sm text-slate-500 dark:text-slate-400; }
.aud-vazio > .pi { @apply text-3xl text-slate-300 dark:text-slate-600 mb-2; }
.aud-vazio strong { @apply text-base text-slate-700 dark:text-slate-200; }

/* Tabelas */
:deep(.aud-tabela) { @apply bg-transparent!; }
:deep(.aud-tabela .p-datatable-wrapper) { @apply overflow-x-auto; }
:deep(.aud-tabela .p-datatable-thead > tr > th) { @apply bg-slate-50! dark:bg-slate-800/60! text-xs! font-semibold! text-slate-500! dark:text-slate-400! border-slate-100! dark:border-slate-800! py-3! px-4!; }
:deep(.aud-tabela .p-datatable-thead > tr > th .p-column-title) { @apply text-xs! normal-case! tracking-normal!; }
:deep(.aud-tabela .p-datatable-thead > tr > th .p-sortable-column-icon) { @apply text-slate-400! w-3! h-3!; }
:deep(.aud-tabela .p-datatable-tbody > tr) { @apply bg-white! dark:bg-slate-900! text-slate-700! dark:text-slate-200!; }
:deep(.aud-tabela .p-datatable-tbody > tr:hover) { @apply bg-slate-50! dark:bg-slate-800/50!; }
:deep(.aud-tabela .p-datatable-tbody > tr > td) { @apply py-3! px-4! text-sm border-slate-100! dark:border-slate-800! align-top; }
:deep(.aud-tabela .p-datatable-emptymessage > td) { @apply p-0!; }
:deep(.aud-tabela .p-paginator) { @apply bg-transparent! border-0! text-sm flex-wrap; }
:deep(.aud-tabela .p-paginator .p-paginator-current) { @apply text-sm text-slate-500 dark:text-slate-400; }
:deep(.aud-tabela .p-paginator .p-paginator-page.p-highlight) { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
:deep(.aud-tabela .p-paginator button) { @apply dark:text-slate-400!; }
:deep(.aud-tabela .p-datatable-loading-overlay) { @apply bg-white/60! dark:bg-slate-900/60!; }
/* Celular: cada linha vira um cartão (responsiveLayout="stack") */
:deep(.aud-tabela .p-column-title) { @apply text-sm font-semibold text-slate-500 dark:text-slate-400 mr-4 shrink-0; }
@media (max-width: 767px) {
  :deep(.aud-tabela .p-datatable-tbody > tr) { @apply border-b! border-slate-200! dark:border-slate-800! py-1; }
  :deep(.aud-tabela .p-datatable-tbody > tr > td) { @apply border-0! py-2! px-1! gap-2 min-w-0 text-right; }
  :deep(.aud-tabela .p-datatable-tbody > tr > td > *:not(.p-column-title)) { @apply min-w-0; }
  :deep(.aud-tabela .p-datatable-tbody > tr.p-datatable-emptymessage > td) { @apply block! w-full! text-center; }
  :deep(.aud-tabela .p-datatable-tbody > tr > td.aud-col-evento) { @apply block! text-left; }
  :deep(.aud-tabela td.aud-col-evento > .p-column-title) { @apply hidden!; }
  .aud-select { @apply flex-1 min-w-[45%]; }
}
</style>

<style>
@reference "../style.css";
/* Estilos que também valem dentro do diálogo (renderizado fora da página) */
.aud-btn-quadrado { @apply w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300; }
.aud-btn-icone { @apply w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-orange-600 dark:hover:text-orange-400 transition-colors; }
.aud-btn-icone .pi { @apply text-sm; }
.aud-alerta-erro { @apply flex items-center gap-2 text-sm px-3 py-2.5 mb-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300; }

.aud-selo { @apply inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap border; }
.aud-selo .pi { @apply text-xs; }
.aud-selo-info { @apply bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700; }
.aud-selo-ok { @apply bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30; }
.aud-selo-atencao { @apply bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30; }
.aud-selo-erro { @apply bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30; }

.aud-dialog.p-dialog { @apply rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl; }
.aud-dialog .p-dialog-header { @apply bg-white dark:bg-slate-900 px-6! py-4! border-b border-slate-100 dark:border-slate-800; }
.aud-dialog .p-dialog-title { @apply text-lg! font-bold! text-slate-900 dark:text-white; }
.aud-dialog .p-dialog-header-icon { @apply text-slate-500! dark:text-slate-400! hover:bg-slate-100! dark:hover:bg-slate-800!; }
.aud-dialog .p-dialog-content { @apply bg-white dark:bg-slate-900 px-6! py-5! text-slate-700 dark:text-slate-200; }
.aud-campo { @apply flex flex-col gap-1 min-w-0; }
.aud-campo > span { @apply text-sm font-semibold text-slate-500 dark:text-slate-400; }
.aud-campo p { @apply text-sm text-slate-700 dark:text-slate-200 break-words; }
.aud-tecnico summary { @apply text-sm font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200; }
.aud-tecnico pre { @apply mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-all max-h-60 overflow-y-auto font-mono; }
</style>
