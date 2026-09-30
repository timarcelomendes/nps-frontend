<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode } from 'primevue/api';
import { temPermissao } from '../utils/permissoes';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import InputSwitch from 'primevue/inputswitch';
import Toast from 'primevue/toast';
import EstadoVazio from '../components/clientes/EstadoVazio.vue';
import TabelaCadastroSimples from '../components/clientes/TabelaCadastroSimples.vue';

const toast = useToast();
const router = useRouter();

const podeCriar = temPermissao('clientes:criar');
const podeEditar = temPermissao('clientes:editar');
const podeExcluir = temPermissao('clientes:excluir');

// ---------- Dados ----------
const clientes = ref([]);
const empresas = ref([]);
const segmentos = ref([]);
const perfis = ref([]);
const cargos = ref([]);
const gestores = ref([]);
const companhias = ref([]);
const loading = ref(true);
const saving = ref(false);

// A API devolve "ativo" como 1/0, "1"/"0", true/false ou nulo (nulo = ativo)
const ehAtivo = (v) => !(v === 0 || v === false || v === '0' || String(v).toLowerCase() === 'false');

const carregarTudo = async () => {
  loading.value = true;
  try {
    const [resCli, resEmp, resSeg, resPerf, resCargos, resGestores, resCompanhias] = await Promise.all([
      api.get('/clientes'), api.get('/cadastros/empresas'), api.get('/cadastros/segmentos'),
      api.get('/cadastros/perfis'), api.get('/cadastros/cargos'), api.get('/cadastros/gestores'),
      api.get('/cadastros/companhias')
    ]);
    clientes.value = resCli.data.map(c => ({ ...c, ativo: ehAtivo(c.ativo) }));
    empresas.value = resEmp.data.map(e => ({ ...e, ativo: ehAtivo(e.ativo) }));
    segmentos.value = resSeg.data;
    perfis.value = resPerf.data;
    cargos.value = resCargos.data;
    gestores.value = resGestores.data;
    companhias.value = resCompanhias.data;
  } catch (error) {
    avisarErro(error, 'Não foi possível carregar os clientes', 'Tente atualizar em alguns segundos.');
  } finally {
    loading.value = false;
  }
};

// HTTP 402 = limite de clientes do plano: mostra o aviso com o botão para a Assinatura
const avisarErro = (error, titulo, padrao) => {
  const detalhe = error?.response?.data?.detail;
  const texto = typeof detalhe === 'string' && detalhe ? detalhe : padrao;
  if (error?.response?.status === 402) {
    toast.add({ group: 'limite-plano', severity: 'warn', summary: 'Seu plano chegou ao limite', detail: texto, life: 12000 });
    return;
  }
  toast.add({ severity: 'error', summary: titulo, detail: texto, life: 6000 });
};
const irParaAssinatura = () => {
  toast.removeGroup('limite-plano');
  router.push('/assinatura');
};

// ---------- Abas, busca e filtros ----------
const abaAtiva = ref(0);
const lerMaisCadastros = () => { try { return localStorage.getItem('contas_mais_cadastros') === '1'; } catch (e) { return false; } };
const maisCadastros = ref(lerMaisCadastros());
const alternarMaisCadastros = () => {
  maisCadastros.value = !maisCadastros.value;
  if (maisCadastros.value) abaAtiva.value = 3;
  else if (abaAtiva.value > 2) abaAtiva.value = 0;
  try { localStorage.setItem('contas_mais_cadastros', maisCadastros.value ? '1' : '0'); } catch (e) { /* navegador sem armazenamento */ }
};

// A busca filtra na própria tela (não faz requisições)
const pesquisa = ref('');
const buscando = computed(() => pesquisa.value.trim() !== '');
const filtros = computed(() => ({ global: { value: pesquisa.value.trim() || null, matchMode: FilterMatchMode.CONTAINS } }));
const limparBusca = () => { pesquisa.value = ''; };

const mostrarInativos = ref(false);
const clientesVisiveis = computed(() => (mostrarInativos.value ? clientes.value : clientes.value.filter(c => c.ativo)));
const empresasVisiveis = computed(() => (mostrarInativos.value ? empresas.value : empresas.value.filter(e => e.ativo)));
const clientesInativos = computed(() => clientes.value.length - clientes.value.filter(c => c.ativo).length);
const empresasInativas = computed(() => empresas.value.length - empresas.value.filter(e => e.ativo).length);

const contatosPorEmpresa = computed(() => {
  const mapa = {};
  clientes.value.forEach(c => { if (c.empresa_id !== '' && c.empresa_id != null) mapa[String(c.empresa_id)] = (mapa[String(c.empresa_id)] || 0) + 1; });
  return mapa;
});
const empresaDoContato = (c) => empresas.value.find(e => String(e.id) === String(c.empresa_id)) || empresas.value.find(e => c.empresa && e.nome === c.empresa);
const responsavelDoContato = (c) => empresaDoContato(c)?.gestor || c.gestor || '';

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const iniciais = (nome) => (nome ? nome.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?');

// ---------- Contatos ----------
const dialogContato = ref(false);
const editandoContato = ref(false);
const contatoVazio = () => ({ cliente_id: null, nome: '', email: '', telefone: '', empresa_id: null, perfil_id: null, cargo_id: null, ativo: true });
const contato = ref(contatoVazio());

const abrirNovoContato = () => {
  contato.value = contatoVazio();
  editandoContato.value = false;
  dialogContato.value = true;
};

const editarContato = (dados) => {
  contato.value = {
    ...dados,
    empresa_id: dados.empresa_id ? Number(dados.empresa_id) : null,
    cargo_id: dados.cargo_id ? Number(dados.cargo_id) : null,
    perfil_id: dados.perfil_id ? Number(dados.perfil_id) : null,
    ativo: ehAtivo(dados.ativo),
  };
  editandoContato.value = true;
  dialogContato.value = true;
};

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

const salvarContato = async () => {
  if (!contato.value.nome?.trim() || !emailValido(contato.value.email)) {
    toast.add({ severity: 'warn', summary: 'Faltam dados', detail: 'Preencha o nome e um e-mail válido.', life: 4000 });
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...contato.value,
      empresa_id: contato.value.empresa_id ? Number(contato.value.empresa_id) : null,
      perfil_id: contato.value.perfil_id ? Number(contato.value.perfil_id) : null,
      cargo_id: contato.value.cargo_id ? Number(contato.value.cargo_id) : null,
      segmento_id: contato.value.segmento_id ? Number(contato.value.segmento_id) : null,
    };
    if (editandoContato.value) {
      await api.put(`/clientes/${contato.value.cliente_id || contato.value.id}`, payload);
    } else {
      await api.post('/clientes', payload);
    }
    dialogContato.value = false;
    toast.add({ severity: 'success', summary: editandoContato.value ? 'Contato atualizado' : 'Contato cadastrado', detail: contato.value.nome, life: 3000 });
    carregarTudo();
  } catch (error) {
    avisarErro(error, 'Não foi possível salvar o contato', 'Tente novamente em alguns segundos.');
  } finally {
    saving.value = false;
  }
};

const alternarStatusCliente = async (dados) => {
  try {
    await api.put(`/clientes/${dados.cliente_id}/status`, { ativo: dados.ativo });
    toast.add({ severity: 'success', summary: dados.ativo ? 'Contato ativado' : 'Contato pausado', detail: dados.ativo ? `${dados.nome} volta a receber pesquisas.` : `${dados.nome} não recebe mais pesquisas.`, life: 3000 });
  } catch (error) {
    dados.ativo = !dados.ativo;
    avisarErro(error, 'Não foi possível alterar o contato', 'Tente novamente em alguns segundos.');
  }
};

// ---------- Empresas ----------
const dialogEmpresa = ref(false);
const editandoEmpresa = ref(false);
const empresaVazia = () => ({ id: null, nome: '', segmento: null, valor_contrato: 0, gestor_id: null, companhia_id: null, ativo: true, ativoOriginal: true });
const empresaForm = ref(empresaVazia());
let aoCriarEmpresa = null;

// O segmento da empresa é gravado pelo nome; mantém o valor atual mesmo que não esteja na lista
const opcoesSegmento = computed(() => {
  const nomes = segmentos.value.map(s => s.nome);
  const atual = empresaForm.value.segmento;
  return atual && !nomes.includes(atual) ? [atual, ...nomes] : nomes;
});

const abrirNovaEmpresa = (callback = null) => {
  aoCriarEmpresa = typeof callback === 'function' ? callback : null;
  empresaForm.value = empresaVazia();
  editandoEmpresa.value = false;
  dialogEmpresa.value = true;
};

const editarEmpresa = (dados) => {
  aoCriarEmpresa = null;
  empresaForm.value = {
    id: dados.id,
    nome: dados.nome,
    segmento: dados.segmento || null,
    valor_contrato: dados.arr_total || 0,
    gestor_id: dados.gestor_id ?? gestores.value.find(g => g.nome === dados.gestor)?.id ?? null,
    companhia_id: dados.companhia_id ?? null,
    ativo: ehAtivo(dados.ativo),
    ativoOriginal: ehAtivo(dados.ativo),
  };
  editandoEmpresa.value = true;
  dialogEmpresa.value = true;
};

const salvarEmpresa = async () => {
  const f = empresaForm.value;
  if (!f.nome?.trim()) {
    toast.add({ severity: 'warn', summary: 'Faltam dados', detail: 'Informe o nome da empresa.', life: 4000 });
    return;
  }
  saving.value = true;
  const payload = {
    nome: f.nome.trim(),
    segmento: f.segmento || null,
    valor_contrato: f.valor_contrato || 0,
    ativo: f.ativo,
    gestor_id: f.gestor_id ? Number(f.gestor_id) : null,
    gestor: gestores.value.find(g => g.id === f.gestor_id)?.nome || null,
    companhia_id: f.companhia_id ? Number(f.companhia_id) : null,
  };
  try {
    if (editandoEmpresa.value) {
      await api.put(`/cadastros/empresas/${f.id}`, payload);
      // o cadastro da empresa não grava a situação; ela tem rota própria
      if (f.ativo !== f.ativoOriginal) await api.put(`/empresas/${f.id}/status`, { ativo: f.ativo });
    } else {
      await api.post('/cadastros/empresas', payload);
    }
    dialogEmpresa.value = false;
    toast.add({ severity: 'success', summary: editandoEmpresa.value ? 'Empresa atualizada' : 'Empresa cadastrada', detail: payload.nome, life: 3000 });
    await carregarTudo();
    if (aoCriarEmpresa) aoCriarEmpresa(empresas.value.find(e => e.nome === payload.nome));
  } catch (error) {
    avisarErro(error, 'Não foi possível salvar a empresa', 'Tente novamente em alguns segundos.');
  } finally {
    saving.value = false;
    aoCriarEmpresa = null;
  }
};

const alternarStatusEmpresa = async (dados) => {
  try {
    await api.put(`/empresas/${dados.id}/status`, { ativo: dados.ativo });
    toast.add({ severity: 'success', summary: dados.ativo ? 'Empresa ativada' : 'Empresa inativada', detail: dados.nome, life: 3000 });
  } catch (error) {
    dados.ativo = !dados.ativo;
    avisarErro(error, 'Não foi possível alterar a empresa', 'Tente novamente em alguns segundos.');
  }
};

// ---------- Responsáveis ----------
const dialogGestor = ref(false);
const editandoGestor = ref(false);
const gestorForm = ref({ id: null, nome: '', papel: '', email: '', teams_webhook: '', avatar: '' });
const avatarQuebrado = ref(false);

const abrirNovoGestor = () => {
  gestorForm.value = { id: null, nome: '', papel: '', email: '', teams_webhook: '', avatar: '' };
  avatarQuebrado.value = false;
  editandoGestor.value = false;
  dialogGestor.value = true;
};
const editarGestor = (dados) => {
  gestorForm.value = { ...dados, avatar: dados.avatar || '' };
  avatarQuebrado.value = false;
  editandoGestor.value = true;
  dialogGestor.value = true;
};
const salvarGestor = async () => {
  if (!gestorForm.value.nome?.trim()) {
    toast.add({ severity: 'warn', summary: 'Faltam dados', detail: 'Informe o nome do responsável.', life: 4000 });
    return;
  }
  saving.value = true;
  try {
    if (editandoGestor.value) await api.put(`/cadastros/gestores/${gestorForm.value.id}`, gestorForm.value);
    else await api.post('/cadastros/gestores', gestorForm.value);
    dialogGestor.value = false;
    toast.add({ severity: 'success', summary: 'Responsável salvo', detail: gestorForm.value.nome, life: 3000 });
    carregarTudo();
  } catch (error) {
    avisarErro(error, 'Não foi possível salvar o responsável', 'Tente novamente em alguns segundos.');
  } finally {
    saving.value = false;
  }
};

const testandoWebhook = ref(false);
const testarWebhook = async () => {
  if (!gestorForm.value.teams_webhook) return;
  testandoWebhook.value = true;
  try {
    await api.post('/gestores/testar-webhook', { webhook_url: gestorForm.value.teams_webhook });
    toast.add({ severity: 'success', summary: 'Teste enviado', detail: 'Confira a mensagem no canal do Teams.', life: 4000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'O teste não chegou ao Teams', detail: 'Verifique se o endereço do webhook está correto.', life: 5000 });
  } finally {
    testandoWebhook.value = false;
  }
};

// ---------- Cadastros que só têm nome: grupos, segmentos, perfis e cargos ----------
const CADASTROS = {
  companhias: { rota: 'cadastros/companhias', lista: companhias, titulo: 'Grupos', coluna: 'Grupo', singular: 'grupo', icone: 'pi-sitemap',
    descricao: 'Junte empresas do mesmo grupo econômico para ver os resultados somados.' },
  segmentos: { rota: 'cadastros/segmentos', lista: segmentos, titulo: 'Segmentos', coluna: 'Segmento', singular: 'segmento', icone: 'pi-tags',
    descricao: 'Ramo de atuação da empresa (ex.: Farmácia, Logística). Serve para comparar resultados por setor.' },
  perfis: { rota: 'cadastros/perfis', lista: perfis, titulo: 'Perfis', coluna: 'Perfil', singular: 'perfil', icone: 'pi-id-card',
    descricao: 'Papel do contato na decisão de compra (ex.: Decisor, Usuário, Influenciador).' },
  cargos: { rota: 'cadastros/cargos', lista: cargos, titulo: 'Cargos', coluna: 'Cargo', singular: 'cargo', icone: 'pi-briefcase',
    descricao: 'Cargo do contato na empresa cliente (ex.: Comprador, Gerente de Logística).' },
};
const abasExtras = ['companhias', 'segmentos', 'perfis', 'cargos'];

const dialogNome = ref(false);
const nomeForm = ref({ tipo: 'cargos', original: null, nome: '' });
let aoCriarNome = null;
const cadastroNome = computed(() => CADASTROS[nomeForm.value.tipo]);

const abrirNome = (tipo, item = null, callback = null) => {
  aoCriarNome = typeof callback === 'function' ? callback : null;
  nomeForm.value = { tipo, original: item, nome: item?.nome || '' };
  dialogNome.value = true;
};
const salvarNome = async () => {
  const cad = cadastroNome.value;
  const nome = nomeForm.value.nome.trim();
  if (!nome) {
    toast.add({ severity: 'warn', summary: 'Faltam dados', detail: `Informe o nome do ${cad.singular}.`, life: 3000 });
    return;
  }
  saving.value = true;
  try {
    const original = nomeForm.value.original;
    if (original) await api.put(`/${cad.rota}/${original.id}`, { ...original, nome });
    else await api.post(`/${cad.rota}`, { id: null, nome });
    dialogNome.value = false;
    toast.add({ severity: 'success', summary: `${cad.coluna} salvo`, detail: nome, life: 3000 });
    await carregarTudo();
    if (aoCriarNome) aoCriarNome(cad.lista.value.find(i => i.nome === nome));
  } catch (error) {
    avisarErro(error, `Não foi possível salvar o ${cad.singular}`, 'Tente novamente em alguns segundos.');
  } finally {
    saving.value = false;
    aoCriarNome = null;
  }
};

// Atalhos "+ Novo" dentro do formulário do contato: já selecionam o item criado
const criarEmpresaParaContato = () => abrirNovaEmpresa((nova) => { if (nova) contato.value.empresa_id = nova.id; });
const criarNomeParaContato = (tipo, campo) => abrirNome(tipo, null, (novo) => { if (novo) contato.value[campo] = novo.id; });

// ---------- Exclusão ----------
const dialogExclusao = ref(false);
const exclusao = ref({ rota: '', id: null, descricao: '', aviso: '' });
const excluindo = ref(false);

const pedirExclusao = (rota, id, descricao, aviso = '') => {
  exclusao.value = { rota, id, descricao, aviso };
  dialogExclusao.value = true;
};
const excluirContato = (c) => pedirExclusao('clientes', c.cliente_id || c.id, `o contato ${c.nome}`,
  'As respostas deste contato também serão apagadas. Se ele só não deve receber pesquisas, prefira desativá-lo.');
const excluirEmpresa = (e) => pedirExclusao('cadastros/empresas', e.id, `a empresa ${e.nome}`,
  'Os contatos continuam cadastrados, mas ficam sem empresa. Para só esconder a empresa, desative-a.');
const excluirGestor = (g) => pedirExclusao('cadastros/gestores', g.id, `o responsável ${g.nome}`, 'As empresas dele ficam sem responsável.');
const excluirNome = (tipo, item) => pedirExclusao(CADASTROS[tipo].rota, item.id, `o ${CADASTROS[tipo].singular} ${item.nome}`);

const executarExclusao = async () => {
  excluindo.value = true;
  try {
    await api.delete(`/${exclusao.value.rota}/${exclusao.value.id}`);
    toast.add({ severity: 'success', summary: 'Excluído', detail: `Você excluiu ${exclusao.value.descricao}.`, life: 3000 });
    dialogExclusao.value = false;
    carregarTudo();
  } catch (error) {
    avisarErro(error, 'Não foi possível excluir', 'Talvez o registro ainda esteja em uso em outro lugar.');
  } finally {
    excluindo.value = false;
  }
};

onMounted(carregarTudo);
</script>

<template>
  <div class="max-w-[1400px] mx-auto flex flex-col gap-6 pb-24">
    <!-- Cabeçalho -->
    <header class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Clientes<span class="text-orange-500">.</span></h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Quem recebe suas pesquisas: contatos, as empresas deles e quem cuida de cada conta.</p>
        </div>
        <div class="flex items-center gap-2">
          <router-link to="/importacao" class="cli-btn-secundario"><i class="pi pi-upload text-xs"></i>Importar planilha</router-link>
          <button @click="carregarTudo" class="cli-btn-quadrado" title="Atualizar" aria-label="Atualizar"><i :class="['pi pi-refresh text-sm', loading ? 'pi-spin' : '']"></i></button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[220px] max-w-md">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
          <input v-model="pesquisa" type="text" role="searchbox" aria-label="Buscar" placeholder="Buscar por nome, e-mail ou empresa"
            class="w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20" />
          <button v-if="buscando" @click="limparBusca" class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Limpar busca"><i class="pi pi-times text-xs"></i></button>
        </div>
        <label class="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer" v-tooltip.bottom="'Contatos e empresas desativados não recebem pesquisas'">
          <InputSwitch v-model="mostrarInativos" class="cli-switch scale-75" /><span class="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap"><span class="sm:hidden">Inativos</span><span class="hidden sm:inline">Mostrar inativos</span></span>
        </label>
        <button @click="alternarMaisCadastros" :aria-pressed="maisCadastros"
          class="h-10 px-3 rounded-xl border text-sm font-semibold whitespace-nowrap transition-colors"
          :class="maisCadastros ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-orange-300'"
          v-tooltip.bottom="'Grupos, segmentos, perfis e cargos'">
          <i :class="['pi mr-1 text-xs', maisCadastros ? 'pi-chevron-up' : 'pi-sliders-h']"></i>{{ maisCadastros ? 'Ocultar mais cadastros' : 'Mais cadastros' }}
        </button>
      </div>
    </header>

    <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 sm:p-5 min-w-0">
      <TabView v-model:activeIndex="abaAtiva" class="cli-abas">
        <!-- CONTATOS -->
        <TabPanel>
          <template #header><i class="pi pi-users"></i><span>Contatos</span><span class="cli-contador">{{ clientesVisiveis.length }}</span></template>
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p class="text-sm text-slate-500 dark:text-slate-400">Pessoas que recebem as pesquisas por e-mail.</p>
            <button v-if="podeCriar" @click="abrirNovoContato" class="cli-btn-primario"><i class="pi pi-plus text-xs"></i>Novo contato</button>
          </div>

          <DataTable :value="clientesVisiveis" :filters="filtros" :globalFilterFields="['nome', 'email', 'telefone', 'empresa', 'cargo', 'perfil_decisor']"
            :paginator="clientesVisiveis.length > 10" :rows="10" dataKey="cliente_id" :loading="loading" sortField="nome" :sortOrder="1"
            responsiveLayout="stack" breakpoint="768px" class="cli-tabela" rowHover>
            <template #empty>
              <EstadoVazio v-if="buscando" icone="pi-search" :titulo="`Nenhum contato encontrado para “${pesquisa.trim()}”`" texto="Confira a grafia ou busque pelo e-mail ou pela empresa.">
                <button @click="limparBusca" class="cli-btn-secundario">Limpar busca</button>
              </EstadoVazio>
              <EstadoVazio v-else-if="!loading && clientesInativos" icone="pi-pause" titulo="Todos os contatos estão inativos" texto="Contatos inativos não recebem pesquisas.">
                <button @click="mostrarInativos = true" class="cli-btn-secundario">Mostrar inativos</button>
              </EstadoVazio>
              <EstadoVazio v-else-if="!loading" icone="pi-users" titulo="Nenhum contato ainda" texto="O jeito mais rápido é importar a planilha com seus clientes. Também dá para cadastrar um por um.">
                <router-link to="/importacao" class="cli-btn-primario"><i class="pi pi-upload text-xs"></i>Importar planilha</router-link>
                <button v-if="podeCriar" @click="abrirNovoContato" class="cli-btn-secundario"><i class="pi pi-plus text-xs"></i>Cadastrar contato</button>
              </EstadoVazio>
            </template>

            <Column header="Contato" field="nome" sortable style="min-width: 240px">
              <template #body="{ data }">
                <div class="flex items-center gap-3 min-w-0" :class="{ 'opacity-60': !data.ativo }">
                  <span class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">{{ iniciais(data.nome) }}</span>
                  <div class="min-w-0 text-left">
                    <p class="font-semibold text-slate-800 dark:text-slate-100 truncate">{{ data.nome }}</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ data.email }}</p>
                  </div>
                </div>
              </template>
            </Column>
            <Column header="Empresa" field="empresa" sortable>
              <template #body="{ data }">
                <div class="text-right md:text-left">
                  <p v-if="data.empresa" class="text-slate-700 dark:text-slate-200">{{ data.empresa }}</p>
                  <p v-else class="text-slate-400">Sem empresa</p>
                  <p v-if="data.cargo" class="text-sm text-slate-500 dark:text-slate-400">{{ data.cargo }}</p>
                </div>
              </template>
            </Column>
            <Column header="Responsável">
              <template #body="{ data }">
                <span v-if="responsavelDoContato(data)" class="text-slate-700 dark:text-slate-200">{{ responsavelDoContato(data) }}</span>
                <span v-else class="text-slate-400" v-tooltip.top="'O responsável vem da empresa do contato'">—</span>
              </template>
            </Column>
            <Column header="Perfil" field="perfil_decisor" sortable>
              <template #body="{ data }">
                <span v-if="data.perfil_decisor" class="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <i v-if="data.perfil_decisor === 'Decisor'" class="pi pi-star-fill text-orange-500 text-xs"></i>{{ data.perfil_decisor }}
                </span>
                <span v-else class="text-slate-400">—</span>
              </template>
            </Column>
            <Column header="Recebe pesquisas" style="width: 150px">
              <template #body="{ data }">
                <label class="inline-flex items-center gap-2 cursor-pointer">
                  <InputSwitch v-model="data.ativo" @change="alternarStatusCliente(data)" class="cli-switch scale-75" :ariaLabel="`Contato ${data.nome} recebe pesquisas`" />
                  <span class="text-sm" :class="data.ativo ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'">{{ data.ativo ? 'Sim' : 'Pausado' }}</span>
                </label>
              </template>
            </Column>
            <Column header="Ações" style="width: 100px">
              <template #body="{ data }">
                <div class="flex gap-1 justify-end">
                  <button v-if="podeEditar" @click="editarContato(data)" class="cli-btn-icone" v-tooltip.top="'Editar'" :aria-label="`Editar ${data.nome}`"><i class="pi pi-pencil"></i></button>
                  <button v-if="podeExcluir" @click="excluirContato(data)" class="cli-btn-icone cli-btn-perigo" v-tooltip.top="'Excluir'" :aria-label="`Excluir ${data.nome}`"><i class="pi pi-trash"></i></button>
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- EMPRESAS -->
        <TabPanel>
          <template #header><i class="pi pi-building"></i><span>Empresas</span><span class="cli-contador">{{ empresasVisiveis.length }}</span></template>
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p class="text-sm text-slate-500 dark:text-slate-400">Empresas clientes. Os resultados de NPS são somados por empresa.</p>
            <button v-if="podeCriar" @click="abrirNovaEmpresa" class="cli-btn-primario"><i class="pi pi-plus text-xs"></i>Nova empresa</button>
          </div>

          <DataTable :value="empresasVisiveis" :filters="filtros" :globalFilterFields="['nome', 'companhia', 'gestor', 'segmento']"
            :paginator="empresasVisiveis.length > 10" :rows="10" dataKey="id" :loading="loading" sortField="nome" :sortOrder="1"
            responsiveLayout="stack" breakpoint="768px" class="cli-tabela" rowHover>
            <template #empty>
              <EstadoVazio v-if="buscando" icone="pi-search" :titulo="`Nenhuma empresa encontrada para “${pesquisa.trim()}”`">
                <button @click="limparBusca" class="cli-btn-secundario">Limpar busca</button>
              </EstadoVazio>
              <EstadoVazio v-else-if="!loading && empresasInativas" icone="pi-pause" titulo="Todas as empresas estão inativas">
                <button @click="mostrarInativos = true" class="cli-btn-secundario">Mostrar inativas</button>
              </EstadoVazio>
              <EstadoVazio v-else-if="!loading" icone="pi-building" titulo="Nenhuma empresa ainda" texto="Ao importar a planilha de contatos, as empresas são criadas sozinhas.">
                <router-link to="/importacao" class="cli-btn-primario"><i class="pi pi-upload text-xs"></i>Importar planilha</router-link>
                <button v-if="podeCriar" @click="abrirNovaEmpresa" class="cli-btn-secundario"><i class="pi pi-plus text-xs"></i>Cadastrar empresa</button>
              </EstadoVazio>
            </template>

            <Column field="nome" header="Empresa" sortable style="min-width: 200px">
              <template #body="{ data }">
                <div class="text-right md:text-left" :class="{ 'opacity-60': !data.ativo }">
                  <p class="font-semibold text-slate-800 dark:text-slate-100">{{ data.nome }}</p>
                  <p v-if="data.companhia" class="text-sm text-slate-500 dark:text-slate-400"><i class="pi pi-sitemap text-xs mr-1"></i>{{ data.companhia }}</p>
                </div>
              </template>
            </Column>
            <Column field="gestor" header="Responsável" sortable>
              <template #body="{ data }">
                <span v-if="data.gestor" class="text-slate-700 dark:text-slate-200">{{ data.gestor }}</span>
                <span v-else class="text-slate-400">Sem responsável</span>
              </template>
            </Column>
            <Column field="segmento" header="Segmento" sortable>
              <template #body="{ data }">
                <span v-if="data.segmento" class="text-sm px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{{ data.segmento }}</span>
                <span v-else class="text-slate-400">—</span>
              </template>
            </Column>
            <Column header="Contatos" style="width: 100px">
              <template #body="{ data }">
                <span class="text-slate-600 dark:text-slate-300 tabular-nums">{{ contatosPorEmpresa[String(data.id)] || 0 }}</span>
              </template>
            </Column>
            <Column field="arr_total" header="Contrato/mês" sortable style="width: 140px">
              <template #body="{ data }">
                <span class="font-semibold text-slate-800 dark:text-slate-100 tabular-nums whitespace-nowrap">{{ formatarMoeda(data.arr_total) }}</span>
              </template>
            </Column>
            <Column header="Ativa" style="width: 110px">
              <template #body="{ data }">
                <label class="inline-flex items-center gap-2 cursor-pointer">
                  <InputSwitch v-model="data.ativo" @change="alternarStatusEmpresa(data)" class="cli-switch scale-75" :ariaLabel="`Empresa ${data.nome} ativa`" />
                  <span class="text-sm" :class="data.ativo ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'">{{ data.ativo ? 'Sim' : 'Não' }}</span>
                </label>
              </template>
            </Column>
            <Column header="Ações" style="width: 100px">
              <template #body="{ data }">
                <div class="flex gap-1 justify-end">
                  <button v-if="podeEditar" @click="editarEmpresa(data)" class="cli-btn-icone" v-tooltip.top="'Editar'" :aria-label="`Editar ${data.nome}`"><i class="pi pi-pencil"></i></button>
                  <button v-if="podeExcluir" @click="excluirEmpresa(data)" class="cli-btn-icone cli-btn-perigo" v-tooltip.top="'Excluir'" :aria-label="`Excluir ${data.nome}`"><i class="pi pi-trash"></i></button>
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- RESPONSÁVEIS -->
        <TabPanel>
          <template #header><i class="pi pi-user"></i><span>Responsáveis</span><span class="cli-contador">{{ gestores.length }}</span></template>
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p class="text-sm text-slate-500 dark:text-slate-400">Pessoas da sua equipe que cuidam das empresas e recebem os alertas de clientes insatisfeitos.</p>
            <button v-if="podeCriar" @click="abrirNovoGestor" class="cli-btn-primario"><i class="pi pi-plus text-xs"></i>Novo responsável</button>
          </div>

          <DataTable :value="gestores" :filters="filtros" :globalFilterFields="['nome', 'papel', 'email']"
            :paginator="gestores.length > 10" :rows="10" dataKey="id" :loading="loading" sortField="nome" :sortOrder="1"
            responsiveLayout="stack" breakpoint="768px" class="cli-tabela" rowHover>
            <template #empty>
              <EstadoVazio v-if="buscando" icone="pi-search" :titulo="`Nenhum responsável encontrado para “${pesquisa.trim()}”`">
                <button @click="limparBusca" class="cli-btn-secundario">Limpar busca</button>
              </EstadoVazio>
              <EstadoVazio v-else-if="!loading" icone="pi-user" titulo="Nenhum responsável ainda" texto="Cadastre quem cuida de cada empresa para receber os alertas certos.">
                <button v-if="podeCriar" @click="abrirNovoGestor" class="cli-btn-primario"><i class="pi pi-plus text-xs"></i>Cadastrar responsável</button>
              </EstadoVazio>
            </template>

            <Column field="nome" header="Nome" sortable style="min-width: 200px">
              <template #body="{ data }">
                <div class="flex items-center gap-3">
                  <img v-if="data.avatar" :src="data.avatar" alt="" class="w-9 h-9 rounded-full object-cover shrink-0" @error="(e) => e.target.style.display = 'none'" />
                  <span v-else class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">{{ iniciais(data.nome) }}</span>
                  <span class="font-semibold text-slate-800 dark:text-slate-100">{{ data.nome }}</span>
                </div>
              </template>
            </Column>
            <Column field="papel" header="Função">
              <template #body="{ data }"><span :class="data.papel ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'">{{ data.papel || '—' }}</span></template>
            </Column>
            <Column field="email" header="E-mail">
              <template #body="{ data }"><span :class="data.email ? 'text-slate-700 dark:text-slate-200 break-all' : 'text-slate-400'">{{ data.email || 'Sem e-mail' }}</span></template>
            </Column>
            <Column header="Teams" style="width: 130px">
              <template #body="{ data }">
                <span v-if="data.teams_webhook" class="text-sm text-slate-700 dark:text-slate-200"><i class="pi pi-check text-xs mr-1 text-emerald-600"></i>Conectado</span>
                <span v-else class="text-sm text-slate-400">Não conectado</span>
              </template>
            </Column>
            <Column header="Ações" style="width: 100px">
              <template #body="{ data }">
                <div class="flex gap-1 justify-end">
                  <button v-if="podeEditar" @click="editarGestor(data)" class="cli-btn-icone" v-tooltip.top="'Editar'" :aria-label="`Editar ${data.nome}`"><i class="pi pi-pencil"></i></button>
                  <button v-if="podeExcluir" @click="excluirGestor(data)" class="cli-btn-icone cli-btn-perigo" v-tooltip.top="'Excluir'" :aria-label="`Excluir ${data.nome}`"><i class="pi pi-trash"></i></button>
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- MAIS CADASTROS -->
        <TabPanel v-for="tipo in (maisCadastros ? abasExtras : [])" :key="tipo">
          <template #header><i :class="['pi', CADASTROS[tipo].icone]"></i><span>{{ CADASTROS[tipo].titulo }}</span><span class="cli-contador">{{ CADASTROS[tipo].lista.value.length }}</span></template>
          <TabelaCadastroSimples :cadastro="CADASTROS[tipo]" :itens="CADASTROS[tipo].lista.value" :filtros="filtros" :buscando="buscando" :loading="loading"
            :podeCriar="podeCriar" :podeEditar="podeEditar" :podeExcluir="podeExcluir"
            @novo="abrirNome(tipo)" @editar="(item) => abrirNome(tipo, item)" @excluir="(item) => excluirNome(tipo, item)" @limpar-busca="limparBusca" />
        </TabPanel>
      </TabView>
    </section>

    <!-- Contato -->
    <Dialog v-model:visible="dialogContato" :header="editandoContato ? 'Editar contato' : 'Novo contato'" modal :draggable="false"
      :style="{ width: '560px' }" :breakpoints="{ '640px': '94vw' }" class="cli-dialog">
      <form @submit.prevent="salvarContato" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="cli-campo sm:col-span-2">
          <label for="ct-nome">Nome <span class="text-orange-600">*</span></label>
          <InputText id="ct-nome" v-model="contato.nome" autofocus placeholder="Ex.: Ana Pereira" />
        </div>
        <div class="cli-campo">
          <label for="ct-email">E-mail <span class="text-orange-600">*</span></label>
          <InputText id="ct-email" v-model="contato.email" type="email" placeholder="ana@empresa.com.br" />
        </div>
        <div class="cli-campo">
          <label for="ct-tel">Telefone</label>
          <InputText id="ct-tel" v-model="contato.telefone" type="tel" placeholder="(11) 99999-0000" />
        </div>
        <div class="cli-campo sm:col-span-2">
          <div class="flex items-center justify-between"><label for="ct-emp">Empresa</label>
            <button v-if="podeCriar" type="button" @click="criarEmpresaParaContato" class="cli-link">+ Nova empresa</button></div>
          <Dropdown inputId="ct-emp" v-model="contato.empresa_id" :options="empresas" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione a empresa" emptyMessage="Nenhuma empresa cadastrada" emptyFilterMessage="Nenhuma empresa encontrada" />
        </div>
        <div class="cli-campo">
          <div class="flex items-center justify-between"><label for="ct-cargo">Cargo</label>
            <button v-if="podeCriar" type="button" @click="criarNomeParaContato('cargos', 'cargo_id')" class="cli-link">+ Novo</button></div>
          <Dropdown inputId="ct-cargo" v-model="contato.cargo_id" :options="cargos" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione" emptyMessage="Nenhum cargo cadastrado" emptyFilterMessage="Nenhum cargo encontrado" />
        </div>
        <div class="cli-campo">
          <div class="flex items-center justify-between"><label for="ct-perfil">Perfil</label>
            <button v-if="podeCriar" type="button" @click="criarNomeParaContato('perfis', 'perfil_id')" class="cli-link">+ Novo</button></div>
          <Dropdown inputId="ct-perfil" v-model="contato.perfil_id" :options="perfis" optionLabel="nome" optionValue="id" showClear placeholder="Selecione" emptyMessage="Nenhum perfil cadastrado" />
        </div>
        <label class="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
          <InputSwitch v-model="contato.ativo" class="cli-switch" />
          <span>
            <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">{{ contato.ativo ? 'Recebe pesquisas' : 'Pausado' }}</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">{{ contato.ativo ? 'Este contato entra nos próximos envios.' : 'Este contato não recebe pesquisas até ser reativado.' }}</span>
          </span>
        </label>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button @click="dialogContato = false" class="cli-btn-secundario">Cancelar</button>
          <button @click="salvarContato" :disabled="saving" class="cli-btn-primario"><i v-if="saving" class="pi pi-spin pi-spinner text-xs"></i>{{ editandoContato ? 'Salvar alterações' : 'Cadastrar contato' }}</button>
        </div>
      </template>
    </Dialog>

    <!-- Empresa -->
    <Dialog v-model:visible="dialogEmpresa" :header="editandoEmpresa ? 'Editar empresa' : 'Nova empresa'" modal :draggable="false"
      :style="{ width: '500px' }" :breakpoints="{ '640px': '94vw' }" class="cli-dialog">
      <form @submit.prevent="salvarEmpresa" class="flex flex-col gap-4">
        <div class="cli-campo">
          <label for="em-nome">Nome da empresa <span class="text-orange-600">*</span></label>
          <InputText id="em-nome" v-model="empresaForm.nome" autofocus placeholder="Ex.: Distribuidora Silva" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="cli-campo">
            <label for="em-seg">Segmento</label>
            <Dropdown inputId="em-seg" v-model="empresaForm.segmento" :options="opcoesSegmento" filter showClear placeholder="Selecione" emptyMessage="Nenhum segmento cadastrado" />
          </div>
          <div class="cli-campo">
            <label for="em-grupo">Grupo</label>
            <Dropdown inputId="em-grupo" v-model="empresaForm.companhia_id" :options="companhias" optionLabel="nome" optionValue="id" filter showClear placeholder="Nenhum" emptyMessage="Nenhum grupo cadastrado" />
          </div>
        </div>
        <div class="cli-campo">
          <label for="em-resp">Responsável</label>
          <Dropdown inputId="em-resp" v-model="empresaForm.gestor_id" :options="gestores" optionLabel="nome" optionValue="id" filter showClear placeholder="Quem cuida desta empresa" emptyMessage="Nenhum responsável cadastrado" />
        </div>
        <div class="cli-campo">
          <label for="em-valor">Valor do contrato por mês</label>
          <InputNumber inputId="em-valor" v-model="empresaForm.valor_contrato" mode="currency" currency="BRL" locale="pt-BR" :min="0" class="w-full" />
          <span class="text-sm text-slate-500 dark:text-slate-400">Usado para mostrar quanto de receita está em risco.</span>
        </div>
        <label v-if="editandoEmpresa" class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
          <InputSwitch v-model="empresaForm.ativo" class="cli-switch" />
          <span>
            <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">{{ empresaForm.ativo ? 'Empresa ativa' : 'Empresa inativa' }}</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">Empresas inativas somem das listas e dos relatórios.</span>
          </span>
        </label>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button @click="dialogEmpresa = false" class="cli-btn-secundario">Cancelar</button>
          <button @click="salvarEmpresa" :disabled="saving" class="cli-btn-primario"><i v-if="saving" class="pi pi-spin pi-spinner text-xs"></i>{{ editandoEmpresa ? 'Salvar alterações' : 'Cadastrar empresa' }}</button>
        </div>
      </template>
    </Dialog>

    <!-- Responsável -->
    <Dialog v-model:visible="dialogGestor" :header="editandoGestor ? 'Editar responsável' : 'Novo responsável'" modal :draggable="false"
      :style="{ width: '520px' }" :breakpoints="{ '640px': '94vw' }" class="cli-dialog">
      <form @submit.prevent="salvarGestor" class="flex flex-col gap-4">
        <div class="flex items-center gap-4">
          <img v-if="gestorForm.avatar && !avatarQuebrado" :src="gestorForm.avatar" alt="" class="w-14 h-14 rounded-full object-cover shrink-0" @error="avatarQuebrado = true" />
          <span v-else class="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold shrink-0">{{ gestorForm.nome ? iniciais(gestorForm.nome) : '' }}<i v-if="!gestorForm.nome" class="pi pi-user"></i></span>
          <div class="cli-campo flex-1 min-w-0">
            <label for="ge-foto">Link da foto (opcional)</label>
            <InputText id="ge-foto" v-model="gestorForm.avatar" @input="avatarQuebrado = false" placeholder="https://..." />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="cli-campo">
            <label for="ge-nome">Nome <span class="text-orange-600">*</span></label>
            <InputText id="ge-nome" v-model="gestorForm.nome" placeholder="Ex.: Marcos Lima" />
          </div>
          <div class="cli-campo">
            <label for="ge-papel">Função</label>
            <InputText id="ge-papel" v-model="gestorForm.papel" placeholder="Ex.: Gerente comercial" />
          </div>
        </div>
        <div class="cli-campo">
          <label for="ge-email">E-mail</label>
          <InputText id="ge-email" v-model="gestorForm.email" type="email" placeholder="marcos@suaempresa.com.br" />
          <span class="text-sm text-slate-500 dark:text-slate-400">Recebe os alertas quando um cliente dele der nota baixa.</span>
        </div>
        <div class="cli-campo">
          <label for="ge-teams">Canal do Microsoft Teams (opcional)</label>
          <div class="flex gap-2">
            <InputText id="ge-teams" v-model="gestorForm.teams_webhook" placeholder="Endereço do webhook do canal" class="flex-1 min-w-0" />
            <button type="button" @click="testarWebhook" :disabled="!gestorForm.teams_webhook || testandoWebhook" class="cli-btn-secundario shrink-0">
              <i :class="['pi text-xs', testandoWebhook ? 'pi-spin pi-spinner' : 'pi-send']"></i>Testar
            </button>
          </div>
          <span class="text-sm text-slate-500 dark:text-slate-400">Para receber os alertas também no Teams.</span>
        </div>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
      </form>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button @click="dialogGestor = false" class="cli-btn-secundario">Cancelar</button>
          <button @click="salvarGestor" :disabled="saving" class="cli-btn-primario"><i v-if="saving" class="pi pi-spin pi-spinner text-xs"></i>{{ editandoGestor ? 'Salvar alterações' : 'Cadastrar responsável' }}</button>
        </div>
      </template>
    </Dialog>

    <!-- Grupo / segmento / perfil / cargo -->
    <Dialog v-model:visible="dialogNome" :header="`${nomeForm.original ? 'Editar' : 'Novo'} ${cadastroNome.singular}`" modal :draggable="false"
      :style="{ width: '420px' }" :breakpoints="{ '640px': '94vw' }" class="cli-dialog">
      <form @submit.prevent="salvarNome" class="flex flex-col gap-2">
        <div class="cli-campo">
          <label for="nm-nome">Nome <span class="text-orange-600">*</span></label>
          <InputText id="nm-nome" v-model="nomeForm.nome" autofocus />
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ cadastroNome.descricao }}</p>
      </form>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button @click="dialogNome = false" class="cli-btn-secundario">Cancelar</button>
          <button @click="salvarNome" :disabled="saving" class="cli-btn-primario"><i v-if="saving" class="pi pi-spin pi-spinner text-xs"></i>Salvar</button>
        </div>
      </template>
    </Dialog>

    <!-- Exclusão -->
    <Dialog v-model:visible="dialogExclusao" header="Excluir?" modal :draggable="false"
      :style="{ width: '440px' }" :breakpoints="{ '640px': '94vw' }" class="cli-dialog">
      <div class="flex gap-4">
        <span class="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0"><i class="pi pi-trash"></i></span>
        <div>
          <p class="text-slate-800 dark:text-slate-100 font-semibold">Excluir {{ exclusao.descricao }}?</p>
          <p v-if="exclusao.aviso" class="text-sm text-slate-600 dark:text-slate-300 mt-1">{{ exclusao.aviso }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Não dá para desfazer.</p>
        </div>
      </div>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button @click="dialogExclusao = false" class="cli-btn-secundario">Cancelar</button>
          <button @click="executarExclusao" :disabled="excluindo" class="cli-btn-perigo-cheio"><i v-if="excluindo" class="pi pi-spin pi-spinner text-xs"></i>Excluir</button>
        </div>
      </template>
    </Dialog>

    <!-- Aviso de limite do plano (HTTP 402) -->
    <Toast group="limite-plano" position="bottom-right" class="cli-toast-limite">
      <template #message="{ message }">
        <div class="flex gap-3 flex-1">
          <i class="pi pi-lock text-orange-500 mt-0.5"></i>
          <div class="flex flex-col gap-2">
            <p class="font-semibold text-slate-900 dark:text-white">{{ message.summary }}</p>
            <p class="text-sm text-slate-600 dark:text-slate-300">{{ message.detail }}</p>
            <button @click="irParaAssinatura" class="cli-btn-primario self-start">Ver planos</button>
          </div>
        </div>
      </template>
    </Toast>
  </div>
</template>

<style scoped>
@reference "../style.css";

/* Abas */
:deep(.cli-abas .p-tabview-nav-container),
:deep(.cli-abas .p-tabview-nav-content) { @apply bg-transparent! border-0!; }
:deep(.cli-abas .p-tabview-nav-content) { @apply overflow-x-auto; scrollbar-width: none; }
:deep(.cli-abas .p-tabview-nav) { @apply bg-transparent! border-0! border-b! border-slate-200! dark:border-slate-800! flex-nowrap gap-1 mb-4; }
:deep(.cli-abas .p-tabview-nav li .p-tabview-nav-link) {
  @apply bg-transparent! border-0! border-b-2! border-transparent! rounded-none! px-3! py-2.5! gap-2 text-sm! font-semibold! text-slate-500! dark:text-slate-400! whitespace-nowrap shadow-none!;
  margin: 0 !important;
}
:deep(.cli-abas .p-tabview-nav li .p-tabview-nav-link:hover) { @apply text-slate-800! dark:text-slate-200!; }
:deep(.cli-abas .p-tabview-nav li.p-highlight .p-tabview-nav-link) { @apply border-orange-500! text-orange-700! dark:text-orange-400!; }
:deep(.cli-abas .p-tabview-ink-bar) { display: none; }
:deep(.cli-abas .p-tabview-nav-link > .pi) { @apply hidden sm:inline-block; }
:deep(.cli-abas .p-tabview-panels) { @apply bg-transparent! p-0! text-slate-700 dark:text-slate-200; }
:deep(.cli-contador) { @apply text-xs font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tabular-nums; }
:deep(.p-highlight .cli-contador) { @apply bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300; }

/* Tabelas */
:deep(.cli-tabela) { @apply bg-transparent!; }
:deep(.cli-tabela .p-datatable-wrapper) { @apply overflow-x-auto; }
:deep(.cli-tabela .p-datatable-thead > tr > th) { @apply bg-slate-50! dark:bg-slate-800/60! text-xs! font-semibold! text-slate-500! dark:text-slate-400! border-slate-100! dark:border-slate-800! py-3! px-4!; }
:deep(.cli-tabela .p-datatable-thead > tr > th .p-sortable-column-icon) { @apply text-slate-400! w-3! h-3!; }
:deep(.cli-tabela .p-datatable-tbody > tr) { @apply bg-white! dark:bg-slate-900! text-slate-700! dark:text-slate-200!; }
:deep(.cli-tabela .p-datatable-tbody > tr:hover) { @apply bg-slate-50! dark:bg-slate-800/50!; }
:deep(.cli-tabela .p-datatable-tbody > tr > td) { @apply py-3! px-4! text-sm border-slate-100! dark:border-slate-800!; }
:deep(.cli-tabela .p-datatable-emptymessage > td) { @apply p-0!; }
:deep(.cli-tabela .p-paginator) { @apply bg-transparent! border-0! text-sm; }
:deep(.cli-tabela .p-paginator .p-paginator-page.p-highlight) { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
:deep(.cli-tabela .p-paginator button) { @apply dark:text-slate-400!; }
:deep(.cli-tabela .p-datatable-loading-overlay) { @apply bg-white/60! dark:bg-slate-900/60!; }
/* Celular: cada linha vira um cartão (responsiveLayout="stack") */
:deep(.cli-tabela .p-column-title) { @apply text-sm font-semibold text-slate-500 dark:text-slate-400 mr-4 shrink-0; }
@media (max-width: 767px) {
  :deep(.cli-tabela .p-datatable-tbody > tr) { @apply border-b! border-slate-200! dark:border-slate-800! py-1; }
  :deep(.cli-tabela .p-datatable-tbody > tr > td) { @apply border-0! py-2! px-1! gap-2 min-w-0; }
  :deep(.cli-tabela .p-datatable-tbody > tr > td:last-child .flex) { @apply justify-end; }
  :deep(.cli-tabela .p-datatable-tbody > tr.p-datatable-emptymessage > td) { @apply block! w-full!; }
}
</style>

<style>
@reference "../style.css";
/* Estilos que também valem dentro dos diálogos e do toast (que são renderizados fora da página) */
.cli-btn-primario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap; }
.cli-btn-secundario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-orange-300 hover:text-orange-700 dark:hover:text-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap; }
.cli-btn-perigo-cheio { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-60; }
.cli-btn-quadrado { @apply w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-orange-600 hover:border-orange-300; }
.cli-btn-icone { @apply w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors; }
.cli-btn-icone.cli-btn-perigo:hover { @apply bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400; }
.cli-btn-icone .pi { @apply text-sm; }
.cli-link { @apply text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline; }
.cli-switch.p-inputswitch.p-highlight .p-inputswitch-slider { @apply bg-orange-500!; }
.cli-switch.p-inputswitch:not(.p-highlight) .p-inputswitch-slider { @apply dark:bg-slate-700!; }

/* Diálogos */
.cli-dialog.p-dialog { @apply rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl; }
.cli-dialog .p-dialog-header { @apply bg-white dark:bg-slate-900 px-6! py-4! border-b border-slate-100 dark:border-slate-800; }
.cli-dialog .p-dialog-title { @apply text-lg! font-bold! text-slate-900 dark:text-white; }
.cli-dialog .p-dialog-header-icon { @apply text-slate-500! dark:text-slate-400! hover:bg-slate-100! dark:hover:bg-slate-800!; }
.cli-dialog .p-dialog-content { @apply bg-white dark:bg-slate-900 px-6! py-5! text-slate-700 dark:text-slate-200; }
.cli-dialog .p-dialog-footer { @apply bg-slate-50 dark:bg-slate-900 px-6! py-4! border-t border-slate-100 dark:border-slate-800; }
.cli-campo { @apply flex flex-col gap-1.5 min-w-0; }
.cli-campo label { @apply text-sm font-semibold text-slate-700 dark:text-slate-200; }
.cli-campo .p-inputtext,
.cli-campo .p-dropdown { @apply w-full rounded-xl! border-slate-300! dark:border-slate-700! bg-white! dark:bg-slate-950! text-sm! text-slate-800! dark:text-slate-100!; }
.cli-campo .p-inputtext { @apply h-10 px-3!; }
.cli-campo .p-dropdown .p-inputtext { @apply h-auto border-0! bg-transparent!; }
.cli-campo .p-dropdown .p-dropdown-label.p-placeholder,
.cli-campo .p-inputtext::placeholder { @apply text-slate-400!; }
.cli-campo .p-dropdown .p-dropdown-trigger { @apply text-slate-400!; }
.cli-campo .p-inputtext:enabled:focus,
.cli-campo .p-dropdown:not(.p-disabled).p-focus { @apply border-orange-400! shadow-none! ring-2 ring-orange-500/20; }
.cli-campo .p-inputnumber { @apply w-full; }

/* Toast do limite do plano */
.cli-toast-limite .p-toast-message.p-toast-message-warn { @apply bg-white! dark:bg-slate-900! border! border-orange-200! dark:border-orange-500/30! border-l-4! border-l-orange-500! rounded-xl! shadow-lg!; }
.cli-toast-limite .p-toast-message-content { @apply p-4! items-start; }
.cli-toast-limite .p-toast-icon-close { @apply text-slate-400!; }
</style>
