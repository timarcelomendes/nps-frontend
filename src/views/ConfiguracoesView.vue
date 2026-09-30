<script setup>
// Configurações da conta. Cada aba é um componente em components/configuracoes/;
// o estado compartilhado (regras, e-mail, equipe) e as alterações pendentes ficam em useConfiguracoes.js.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import api from '../services/api';
import { criarStoreConfig } from '../components/configuracoes/useConfiguracoes';
import TabPesquisa from '../components/configuracoes/TabPesquisa.vue';
import TabEmail from '../components/configuracoes/TabEmail.vue';
import TabEquipe from '../components/configuracoes/TabEquipe.vue';
import TabIntegracoes from '../components/configuracoes/TabIntegracoes.vue';
import TabIA from '../components/configuracoes/TabIA.vue';
import TabPermissoes from '../components/configuracoes/TabPermissoes.vue';
import TabSeguranca from '../components/configuracoes/TabSeguranca.vue';
import TabGeral from '../components/configuracoes/TabGeral.vue';
import TabPlataforma from '../components/configuracoes/TabPlataforma.vue';

const toast = useToast();
const route = useRoute();
const router = useRouter();
const cfg = criarStoreConfig(toast);

// ---------- Abas ----------
const ABAS = [
  { chave: 'pesquisa', rotulo: 'Pesquisa', icone: 'pi-send', componente: TabPesquisa },
  { chave: 'email', rotulo: 'E-mail', icone: 'pi-envelope', componente: TabEmail },
  { chave: 'equipe', rotulo: 'Equipe', icone: 'pi-users', componente: TabEquipe },
  { chave: 'integracoes', rotulo: 'Integrações', icone: 'pi-link', componente: TabIntegracoes },
  { chave: 'ia', rotulo: 'IA', icone: 'pi-sparkles', componente: TabIA, avancada: true, secoes: ['ia'] },
  { chave: 'permissoes', rotulo: 'Permissões', icone: 'pi-shield', componente: TabPermissoes, avancada: true, secoes: ['permissoes'] },
  { chave: 'seguranca', rotulo: 'Segurança', icone: 'pi-lock', componente: TabSeguranca, avancada: true, secoes: ['sessao', 'dominios'] },
  { chave: 'geral', rotulo: 'Geral', icone: 'pi-cog', componente: TabGeral, avancada: true },
  { chave: 'plataforma', rotulo: 'Plataforma', icone: 'pi-building', componente: TabPlataforma, superadmin: true },
];

const lerAvancado = () => { try { return localStorage.getItem('config_modo_avancado') === '1'; } catch (e) { return false; } };
const avancado = ref(lerAvancado());
const abas = computed(() => ABAS.filter((a) => (!a.avancada || avancado.value) && (!a.superadmin || cfg.ehSuperAdmin)));

const indicePorChave = (chave) => Math.max(0, abas.value.findIndex((a) => a.chave === chave));
const abaAtiva = ref(indicePorChave(route.query.aba));
const irPara = (chave) => {
  if (ABAS.find((a) => a.chave === chave)?.avancada && !avancado.value) alternarAvancado();
  abaAtiva.value = indicePorChave(chave);
  document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
};
watch(abaAtiva, (i) => {
  const chave = abas.value[i]?.chave;
  if (chave && route.query.aba !== chave) router.replace({ query: { ...route.query, aba: chave } });
});

const alternarAvancado = () => {
  if (avancado.value) {
    const perdidas = cfg.pendentes.value.filter((p) => ABAS.some((a) => a.avancada && a.secoes?.includes(p.id)));
    if (perdidas.length && !confirm(`Você alterou ${perdidas.map((p) => p.nome).join(', ')} e não salvou. Ocultar mesmo assim e perder essas alterações?`)) return;
  }
  const chaveAtual = abas.value[abaAtiva.value]?.chave;
  avancado.value = !avancado.value;
  try { localStorage.setItem('config_modo_avancado', avancado.value ? '1' : '0'); } catch (e) { /* navegador sem armazenamento */ }
  abaAtiva.value = indicePorChave(abas.value.some((a) => a.chave === chaveAtual) ? chaveAtual : 'pesquisa');
};

// ---------- O essencial para começar ----------
const passos = computed(() => {
  const r = cfg.regrasBase.value;
  if (!r) return [];
  const formularioOk = r.formulario_tipo === 'externo' ? String(r.survey_url || '').startsWith('https://') : !!cfg.formularioPadrao('nps');
  return [
    { chave: 'pesquisa', feito: formularioOk, titulo: 'Formulário escolhido', pendente: 'Escolha o formulário da pesquisa' },
    { chave: 'email', feito: cfg.emailPronto.value && cfg.email.value.envios_ativos, titulo: 'E-mails ligados', pendente: 'Ligue o envio de e-mails' },
    { chave: 'pesquisa', feito: !!r.robo_ativo, titulo: 'Envio automático ligado', pendente: 'Ligue o envio automático' },
    { chave: 'equipe', feito: cfg.usuarios.value.length > 1, titulo: 'Equipe cadastrada', pendente: 'Adicione sua equipe (opcional)' },
  ];
});
const tudoPronto = computed(() => passos.value.length && passos.value.every((p) => p.feito));

// ---------- Alterações não salvas ----------
const salvandoTudo = ref(false);
const salvarTudo = async () => {
  salvandoTudo.value = true;
  try {
    for (const p of [...cfg.pendentes.value]) await p.salvar();
  } finally {
    salvandoTudo.value = false;
  }
};
const descartarTudo = () => {
  if (!confirm('Desfazer todas as alterações que ainda não foram salvas?')) return;
  cfg.pendentes.value.forEach((p) => p.descartar());
};
const avisoSaida = (e) => {
  if (!cfg.pendentes.value.length) return;
  e.preventDefault();
  e.returnValue = '';
};
onBeforeRouteLeave(() => {
  if (!cfg.pendentes.value.length) return true;
  return confirm(`Você tem alterações não salvas em: ${cfg.pendentes.value.map((p) => p.nome).join(', ')}. Sair e perder essas alterações?`);
});

// Retorno da autorização da Microsoft (fluxo antigo de e-mail próprio; a URL volta com ?code=)
const processarCallbackMicrosoft = async () => {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;
  try {
    await api.post('/config/email/autorizar', { code, redirect_uri: `${window.location.origin}/configuracoes` });
    cfg.ok('Conta Microsoft conectada', 'Autorização concluída.');
    window.history.replaceState({}, document.title, window.location.pathname);
    cfg.carregarEmail();
  } catch (e) {
    cfg.erro(e, 'Falha na autorização da Microsoft', 'Não foi possível gerar o acesso.');
  }
};

onMounted(async () => {
  window.addEventListener('beforeunload', avisoSaida);
  processarCallbackMicrosoft();
  cfg.carregarEmail();
  cfg.carregarFormularios();
  cfg.carregarUsuarios();
  cfg.carregarPreviaLembretes();
  await cfg.carregarImagens(); // antes das regras: o endereço das imagens entra nos modelos de e-mail
  cfg.carregarRegras();
});
onBeforeUnmount(() => window.removeEventListener('beforeunload', avisoSaida));
</script>

<template>
  <div class="max-w-6xl mx-auto flex flex-col gap-5 pb-4 min-w-0">
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Configurações<span class="text-orange-500">.</span></h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Como e quando as pesquisas saem, os e-mails, a equipe e as integrações.</p>
      </div>
      <button type="button" class="cfg-btn-secundario self-start md:self-auto" :aria-pressed="avancado" @click="alternarAvancado">
        <i :class="['pi text-xs', avancado ? 'pi-eye-slash' : 'pi-sliders-h']"></i>
        {{ avancado ? 'Ocultar opções avançadas' : 'Mostrar opções avançadas' }}
      </button>
    </header>

    <!-- Essencial para começar -->
    <section v-if="passos.length" class="cfg-card py-4!" aria-label="Essencial para começar">
      <p v-if="tudoPronto" class="text-sm text-emerald-700 dark:text-emerald-400 font-semibold"><i class="pi pi-check-circle mr-2"></i>Tudo pronto: as pesquisas estão saindo automaticamente.</p>
      <template v-else>
        <h2 class="text-sm font-bold text-slate-900 dark:text-white mb-3">Essencial para começar</h2>
        <ol class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <li v-for="(p, i) in passos" :key="i">
            <button type="button" @click="irPara(p.chave)"
              :class="['w-full text-left flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border transition-colors',
                p.feito ? 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' : 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-slate-800 dark:text-slate-100 hover:border-orange-400 font-semibold']">
              <i :class="['pi', p.feito ? 'pi-check-circle text-emerald-500' : 'pi-arrow-right text-orange-500']"></i>
              {{ p.feito ? p.titulo : p.pendente }}
            </button>
          </li>
        </ol>
      </template>
    </section>

    <TabView v-model:activeIndex="abaAtiva" class="cfg-abas">
      <TabPanel v-for="a in abas" :key="a.chave">
        <template #header>
          <i :class="['pi', a.icone]"></i>
          <span>{{ a.rotulo }}</span>
          <span v-if="a.avancada" class="cfg-selo">Avançado</span>
        </template>
        <component :is="a.componente" @ir="irPara" />
      </TabPanel>
    </TabView>

    <!-- Barra de alterações não salvas -->
    <div v-if="cfg.pendentes.value.length" class="sticky bottom-24 z-20" role="region" aria-label="Alterações não salvas">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-white dark:bg-slate-900 shadow-lg p-3 sm:pl-4">
        <p class="flex-1 text-sm text-slate-700 dark:text-slate-200 min-w-0">
          <i class="pi pi-circle-fill text-amber-500 text-xs mr-2"></i>
          <b>Não salvo:</b> {{ cfg.pendentes.value.map(p => p.nome).join(' · ') }}
        </p>
        <div class="flex gap-2">
          <button type="button" class="cfg-btn-secundario flex-1 sm:flex-none" :disabled="salvandoTudo" @click="descartarTudo">Desfazer</button>
          <button type="button" class="cfg-btn-primario flex-1 sm:flex-none" :disabled="salvandoTudo" @click="salvarTudo">
            <i :class="['pi text-xs', salvandoTudo ? 'pi-spin pi-spinner' : 'pi-check']"></i>Salvar alterações
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";

:deep(.cfg-abas .p-tabview-nav-container),
:deep(.cfg-abas .p-tabview-nav-content) { @apply bg-transparent! border-0!; }
:deep(.cfg-abas .p-tabview-nav-content) { @apply overflow-x-auto; scrollbar-width: none; }
:deep(.cfg-abas .p-tabview-nav) { @apply bg-transparent! border-0! border-b! border-slate-200! dark:border-slate-800! flex-nowrap gap-1 mb-5; }
:deep(.cfg-abas .p-tabview-nav li .p-tabview-nav-link) {
  @apply bg-transparent! border-0! border-b-2! border-transparent! rounded-none! px-3! py-2.5! gap-2 text-sm! font-semibold! text-slate-500! dark:text-slate-400! whitespace-nowrap shadow-none!;
  margin: 0 !important;
}
:deep(.cfg-abas .p-tabview-nav li .p-tabview-nav-link:hover) { @apply text-slate-800! dark:text-slate-200!; }
:deep(.cfg-abas .p-tabview-nav li.p-highlight .p-tabview-nav-link) { @apply border-orange-500! text-orange-700! dark:text-orange-400!; }
:deep(.cfg-abas .p-tabview-nav-link:focus-visible) { @apply ring-2! ring-orange-500/40! ring-inset!; }
:deep(.cfg-abas .p-tabview-ink-bar) { display: none; }
:deep(.cfg-abas .p-tabview-nav-link > .pi) { @apply hidden sm:inline-block; }
:deep(.cfg-abas .p-tabview-panels) { @apply bg-transparent! p-0! text-slate-700 dark:text-slate-200; }
</style>

<style>
@reference "../style.css";
/* Classes das Configurações (prefixo cfg-). Globais porque também valem nos diálogos e painéis que abrem fora da página. */
.cfg-card { @apply bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 min-w-0; }
.cfg-selo { @apply inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap; }
.cfg-selo-essencial { @apply bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300; }
.cfg-selo-bom { @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300; }
.cfg-selo-alerta { @apply bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300; }
.cfg-aviso { @apply flex items-start gap-2 text-sm rounded-xl p-3 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200; }
.cfg-aviso .pi { @apply mt-0.5; }
.cfg-ajuda { @apply text-sm text-slate-500 dark:text-slate-400; }

.cfg-btn-primario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500 whitespace-nowrap; }
.cfg-btn-secundario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-orange-300 hover:text-orange-700 dark:hover:text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:text-slate-700 whitespace-nowrap; }
.cfg-btn-quadrado { @apply w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300 transition-colors; }
.cfg-btn-icone { @apply w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors; }
.cfg-btn-icone.cfg-btn-perigo:hover { @apply bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400; }
.cfg-btn-icone .pi { @apply text-sm; }
.cfg-btn-mini { @apply text-sm font-medium px-2.5 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-500/10 dark:hover:text-orange-300 whitespace-nowrap; }
.cfg-link { @apply text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline; }

.cfg-campo { @apply flex flex-col gap-1.5 min-w-0; }
.cfg-campo > label { @apply text-sm font-semibold text-slate-700 dark:text-slate-200; }
.cfg-input { @apply h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 read-only:bg-slate-50 dark:read-only:bg-slate-900 disabled:opacity-60; }
.cfg-input-erro { @apply border-rose-400 dark:border-rose-500/60; }
select.cfg-input { @apply pr-8; }
.cfg-check { @apply w-5 h-5 cursor-pointer accent-orange-500; }

/* Componentes PrimeVue dentro de .cfg-campo */
.cfg-campo .p-inputtext,
.cfg-campo .p-dropdown,
.cfg-campo .p-multiselect { @apply w-full rounded-xl! border-slate-300! dark:border-slate-700! bg-white! dark:bg-slate-950! text-sm! text-slate-800! dark:text-slate-100! shadow-none!; }
.cfg-campo .p-inputtext { @apply h-10 px-3!; }
.cfg-campo .p-dropdown .p-inputtext,
.cfg-campo .p-multiselect .p-multiselect-label { @apply h-auto border-0! bg-transparent! py-2! text-sm!; }
.cfg-campo .p-multiselect-token { @apply bg-orange-50! text-orange-800! dark:bg-orange-500/15! dark:text-orange-200! text-sm; }
.cfg-campo .p-dropdown-trigger, .cfg-campo .p-multiselect-trigger { @apply text-slate-400!; }
.cfg-campo .p-inputtext::placeholder { @apply text-slate-400!; }
.cfg-campo .p-inputtext:enabled:focus,
.cfg-campo .p-dropdown:not(.p-disabled).p-focus,
.cfg-campo .p-multiselect:not(.p-disabled).p-focus { @apply border-orange-400! shadow-none! ring-2 ring-orange-500/20; }
.cfg-campo .p-password { @apply w-full; }
.cfg-campo .p-password-input { @apply pr-10!; }
.cfg-campo .p-password .p-icon, .cfg-campo .p-password i { @apply text-slate-400; }
.cfg-numero.p-inputnumber { @apply w-full; }
.cfg-numero .p-inputnumber-input { @apply text-center font-semibold; }
.cfg-numero .p-inputnumber-button { @apply bg-slate-100! dark:bg-slate-800! border-slate-300! dark:border-slate-700! text-slate-600! dark:text-slate-300! w-10!; }
.cfg-numero .p-inputnumber-button:hover { @apply text-orange-600!; }
.cfg-numero.p-inputnumber-buttons-horizontal .p-inputnumber-input { @apply rounded-none!; }
.cfg-numero .p-button.p-inputnumber-button-down { @apply rounded-l-xl! rounded-r-none!; }
.cfg-numero .p-button.p-inputnumber-button-up { @apply rounded-r-xl! rounded-l-none!; }

.cfg-switch.p-inputswitch.p-highlight .p-inputswitch-slider { @apply bg-orange-500!; }
.cfg-switch.p-inputswitch:not(.p-highlight) .p-inputswitch-slider { @apply dark:bg-slate-700!; }

/* Escolhas em cartão e botões segmentados */
.cfg-opcao { @apply text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-orange-300 transition-colors; }
.cfg-opcao-ativa { @apply border-orange-500 bg-orange-50/60 dark:bg-orange-500/10 hover:border-orange-500; }
.cfg-segmentado { @apply inline-flex self-start rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 gap-1; }
.cfg-segmentado > button { @apply h-8 min-w-12 px-3 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center justify-center; }
.cfg-segmentado > button.cfg-segmentado-ativo { @apply bg-white dark:bg-slate-950 text-orange-700 dark:text-orange-300 shadow-sm; }
.cfg-pilula { @apply inline-flex items-center gap-2 h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:border-orange-300; }
.cfg-pilula-ativa { @apply border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300; }
.cfg-variavel { @apply font-mono text-sm px-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-orange-400 hover:text-orange-700 dark:hover:text-orange-300; }

/* Tabelas */
.cfg-tabela.p-datatable, .cfg-tabela .p-datatable-wrapper { @apply bg-transparent!; }
.cfg-tabela .p-datatable-thead > tr > th { @apply bg-slate-50! dark:bg-slate-800/60! text-sm! font-semibold! text-slate-500! dark:text-slate-400! border-slate-100! dark:border-slate-800! py-3! px-4!; }
.cfg-tabela .p-datatable-tbody > tr { @apply bg-white! dark:bg-slate-900! text-slate-700! dark:text-slate-200!; }
.cfg-tabela .p-datatable-tbody > tr:hover { @apply bg-slate-50! dark:bg-slate-800/50!; }
.cfg-tabela .p-datatable-tbody > tr > td { @apply py-3! px-4! text-sm border-slate-100! dark:border-slate-800!; }
.cfg-tabela .p-paginator { @apply bg-transparent! border-0! text-sm; }
.cfg-tabela .p-paginator .p-paginator-page.p-highlight { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
.cfg-tabela .p-paginator button { @apply dark:text-slate-400!; }
.cfg-tabela .p-datatable-loading-overlay { @apply bg-white/60! dark:bg-slate-900/60!; }
.cfg-tabela .p-column-title { @apply text-sm font-semibold text-slate-500 dark:text-slate-400 mr-4 shrink-0; }
@media (max-width: 959px) {
  .cfg-tabela .p-datatable-tbody > tr { @apply border-b! border-slate-200! dark:border-slate-800!; }
  .cfg-tabela .p-datatable-tbody > tr > td { @apply border-0! py-2! px-1! gap-2 min-w-0; }
  .cfg-tabela .p-datatable-tbody > tr > td > *:not(.p-column-title) { @apply min-w-0 text-right; }
}

/* Diálogos e painéis (abrem fora da página) */
.cfg-dialog.p-dialog { @apply rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl; }
.cfg-dialog .p-dialog-header { @apply bg-white dark:bg-slate-900 px-6! py-4! border-b border-slate-100 dark:border-slate-800; }
.cfg-dialog .p-dialog-title { @apply text-lg! font-bold! text-slate-900 dark:text-white; }
.cfg-dialog .p-dialog-header-icon { @apply text-slate-500! dark:text-slate-400! hover:bg-slate-100! dark:hover:bg-slate-800!; }
.cfg-dialog .p-dialog-content { @apply bg-white dark:bg-slate-900 px-6! py-5! text-slate-700 dark:text-slate-200; }
.cfg-dialog .p-dialog-footer { @apply bg-slate-50 dark:bg-slate-900 px-6! py-4! border-t border-slate-100 dark:border-slate-800; }
.cfg-painel.p-dropdown-panel, .cfg-painel.p-multiselect-panel { @apply rounded-xl! border! border-slate-200! dark:border-slate-700! bg-white! dark:bg-slate-900! shadow-lg!; }
.cfg-painel .p-dropdown-item, .cfg-painel .p-multiselect-item { @apply text-sm! text-slate-700! dark:text-slate-200!; }
.cfg-painel .p-dropdown-item.p-highlight, .cfg-painel .p-multiselect-item.p-highlight { @apply bg-orange-50! text-orange-800! dark:bg-orange-500/15! dark:text-orange-200!; }
.cfg-painel .p-dropdown-item:not(.p-highlight):hover, .cfg-painel .p-multiselect-item:not(.p-highlight):hover { @apply bg-slate-50! dark:bg-slate-800!; }
.cfg-painel .p-multiselect-header { @apply bg-slate-50! dark:bg-slate-800! border-slate-200! dark:border-slate-700!; }
</style>
