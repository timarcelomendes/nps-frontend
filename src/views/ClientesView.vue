<script setup>
import { ref, onMounted, computed } from 'vue';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';
import { FilterMatchMode } from 'primevue/api';
import { temPermissao } from '../utils/permissoes';

// Modo simples: Contatos, Empresas e Responsáveis. Grupos, segmentos, perfis e cargos ficam em "Mais cadastros".
const lerMaisCadastros = () => { try { return localStorage.getItem('contas_mais_cadastros') === '1'; } catch (e) { return false; } };
const maisCadastros = ref(lerMaisCadastros());
const alternarMaisCadastros = () => {
  maisCadastros.value = !maisCadastros.value;
  try { localStorage.setItem('contas_mais_cadastros', maisCadastros.value ? '1' : '0'); } catch (e) {}
};

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import Tag from 'primevue/tag';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import InputSwitch from 'primevue/inputswitch';

const toast = useToast();
const saving = ref(false);

const clientes = ref([]);
const empresas = ref([]);
const segmentos = ref([]);
const perfis = ref([]);
const cargos = ref([]); 
const gestores = ref([]); 
const companhias = ref([]);
const loading = ref(true);

const dialogVisivel = ref(false);
const editando = ref(false);
const dialogExclusao = ref(false);
const idParaExcluir = ref(null);
const tipoExclusao = ref(''); // Vai salvar a rota (ex: 'cadastros/empresas')
const nomeExclusao = ref(''); // Vai salvar o texto (ex: 'esta empresa')
const excluindo = ref(false);

const dialogEmpresa = ref(false);
const editandoEmpresa = ref(false);
const empresaForm = ref({
  id: null, nome: '', segmento: null, valor_contrato: 0, gestor: null, companhia: null // 👈 GRUPO NO FORMULÁRIO DA EMPRESA
});

const dialogSegmento = ref(false);
const editandoSegmento = ref(false);
const segmentoForm = ref({ id: null, nome: '' });

const dialogPerfil = ref(false);
const editandoPerfil = ref(false);
const perfilForm = ref({ id: null, nome: '' });

const dialogCargo = ref(false);
const editandoCargo = ref(false);
const cargoForm = ref({ id: null, nome: '' });

const dialogGestor = ref(false);
const editandoGestor = ref(false);

const dialogCompanhia = ref(false);
const editandoCompanhia = ref(false);
const companhiaForm = ref({ id: null, nome: '' });

// 👇 VARIÁVEIS PARA A PESQUISA GLOBAL 👇
const pesquisa = ref('');
const filtrosTabela = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS }
});
const atualizarFiltro = () => {
  filtrosTabela.value.global.value = pesquisa.value;
};

// 👇 FILTRO DE INATIVOS (Oculta por padrão)
const mostrarInativos = ref(false);

const clientesFiltrados = computed(() => {
  if (mostrarInativos.value) return clientes.value;
  return clientes.value.filter(c => {
    if (c.ativo === undefined || c.ativo === null) return true;
    const st = String(c.ativo).toLowerCase();
    return st !== '0' && st !== 'false';
  });
});

const empresasFiltradas = computed(() => {
  if (mostrarInativos.value) return empresas.value;

  return empresas.value.filter(e => {
    if (e.ativo === undefined || e.ativo === null) return true;
    
    return e.ativo === true || e.ativo === 1 || e.ativo === "1";
  });
});

const carregarTudo = async () => {
  loading.value = true;
  try {
    const [resCli, resEmp, resSeg, resPerf, resCargos, resGestores, resCompanhias] = await Promise.all([
      api.get('/clientes'), api.get('/cadastros/empresas'), api.get('/cadastros/segmentos'),
      api.get('/cadastros/perfis'), api.get('/cadastros/cargos'), api.get('/cadastros/gestores'),
      api.get('/cadastros/companhias')
    ]);
    
    clientes.value = resCli.data; empresas.value = resEmp.data;
    segmentos.value = resSeg.data; perfis.value = resPerf.data;
    cargos.value = resCargos.data; gestores.value = resGestores.data;
    companhias.value = resCompanhias.data;
  } catch (error) {
    console.error(error);
    
    const mensagemErro = error.response?.data?.detail || 'Falha ao carregar os dados.';
    
    toast.add({ 
        severity: 'error', 
        summary: 'Erro de Comunicação', 
        detail: mensagemErro, 
        life: 6000 
    });
  } finally {
    loading.value = false;
  } 
}; 

// 1. Atualizar o objeto para usar os sufixos _id
const cliente = ref({
  cliente_id: null, nome: '', email: '', telefone: '', empresa_id: null, perfil_id: null, cargo_id: null, ativo: true
});

// 2. Limpar os _ids ao criar um novo
const abrirNovo = () => { 
  cliente.value = { cliente_id: null, nome: '', email: '', telefone: '', empresa_id: null, perfil_id: null, cargo_id: null, ativo: true }; 
  editando.value = false; 
  dialogVisivel.value = true; 
};

// 3. Garantir que a edição carrega os _ids que vieram do banco
const editarCliente = (dados) => {
  cliente.value = { 
    ...dados,
    empresa_id: dados.empresa_id || null,
    cargo_id: dados.cargo_id || null,
    perfil_id: dados.perfil_id || null
  }; 
  cliente.value.ativo = dados.ativo === 1 || dados.ativo === true; 
  editando.value = true;
  dialogVisivel.value = true;
};

// 4. Converter as strings vazias para 'null' e forçar números antes de enviar à API
const salvarCliente = async () => {
  if (!cliente.value.nome || !cliente.value.email || !cliente.value.cargo_id) {
    toast.add({ severity: 'warn', summary: 'Campos Obrigatórios', detail: 'Por favor, preencha o Nome, E-mail e Cargo.', life: 4000 });
    return;
  }
  
  saving.value = true;
  try {
    const payload = {
      ...cliente.value,
      
      empresa_id: cliente.value.empresa_id ? Number(cliente.value.empresa_id) : null,
      perfil_id: cliente.value.perfil_id ? Number(cliente.value.perfil_id) : null,
      cargo_id: cliente.value.cargo_id ? Number(cliente.value.cargo_id) : null,
      
      segmento_id: cliente.value.segmento_id ? Number(cliente.value.segmento_id) : null 
    };

    if (editando.value) {
      await api.put(`/clientes/${cliente.value.cliente_id || cliente.value.id}`, payload);
    } else {
      await api.post('/clientes', payload);
    }
    
    dialogVisivel.value = false; 
    carregarTudo();
    toast.add({ severity: 'success', summary: 'Atualizado', detail: 'Contato salvo com sucesso.', life: 3000 });
  } catch (error) { 
    console.error(error);
    const mensagemErro = error.response?.data?.detail || 'Falha ao salvar os dados.';
    toast.add({ severity: 'error', summary: 'Ação Bloqueada', detail: mensagemErro, life: 6000 }); 
  } finally { 
    saving.value = false; 
  }
};

// --- MOTOR UNIVERSAL DE EXCLUSÃO ---
const confirmarExclusao = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'clientes'; nomeExclusao.value = 'esta pessoa'; dialogExclusao.value = true; };
const confirmarExclusaoEmpresa = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'cadastros/empresas'; nomeExclusao.value = 'esta empresa'; dialogExclusao.value = true; };
const confirmarExclusaoCompanhia = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'cadastros/companhias'; nomeExclusao.value = 'este grupo'; dialogExclusao.value = true; };
const confirmarExclusaoGestor = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'cadastros/gestores'; nomeExclusao.value = 'este gestor'; dialogExclusao.value = true; };
const confirmarExclusaoSegmento = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'cadastros/segmentos'; nomeExclusao.value = 'este segmento'; dialogExclusao.value = true; };
const confirmarExclusaoPerfil = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'cadastros/perfis'; nomeExclusao.value = 'este perfil'; dialogExclusao.value = true; };
const confirmarExclusaoCargo = (id) => { idParaExcluir.value = id; tipoExclusao.value = 'cadastros/cargos'; nomeExclusao.value = 'este cargo'; dialogExclusao.value = true; };

const executarExclusao = async () => {
  excluindo.value = true;
  try { 
    // Apaga na rota dinâmica com base na aba clicada
    await api.delete(`/${tipoExclusao.value}/${idParaExcluir.value}`); 
    toast.add({ severity: 'success', summary: 'Removido', detail: 'Registro excluído com sucesso.', life: 3000 });
    dialogExclusao.value = false; 
    carregarTudo(); 
  } catch (error) { 
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir. O registro pode estar sendo usado em outro lugar.', life: 4000 }); 
  } finally { 
    excluindo.value = false; 
    idParaExcluir.value = null; 
    tipoExclusao.value = '';
  }
};
// -----------------------------------

const abrirNovaEmpresa = () => { empresaForm.value = { id: null, nome: '', segmento: null, valor_contrato: 0, gestor: null, companhia: null }; editandoEmpresa.value = false; dialogEmpresa.value = true; };
const editarFichaEmpresa = (dados) => { 
  empresaForm.value = { 
    id: dados.id, 
    nome: dados.nome, 
    segmento: dados.segmento, 
    valor_contrato: dados.arr_total || 0, 
    gestor: gestores.value.find(g => g.nome === dados.gestor) || null,
    companhia: companhias.value.find(c => c.id === dados.companhia_id) || null,
    ativo: dados.ativo !== 0 && dados.ativo !== false && dados.ativo !== '0' && dados.ativo !== 'false'
  }; 
  editandoEmpresa.value = true; 
  dialogEmpresa.value = true; 
};

const salvarEmpresa = async () => {
  saving.value = true;
  
  // 🎯 Payload Blindado: Força a conversão para Número ou devolve null
  const payload = {
    nome: empresaForm.value.nome,
    valor_contrato: empresaForm.value.valor_contrato,
    ativo: empresaForm.value.ativo,

    segmento_id: empresaForm.value.segmento ? Number(empresaForm.value.segmento) : null,

    gestor_id: empresaForm.value.gestor ? Number(empresaForm.value.gestor.id || empresaForm.value.gestor) : null,
    
    companhia_id: empresaForm.value.companhia ? Number(empresaForm.value.companhia.id || empresaForm.value.companhia) : null
  };

  try {
    const url = editandoEmpresa.value ? `/cadastros/empresas/${empresaForm.value.id}` : '/cadastros/empresas';
    const metodo = editandoEmpresa.value ? 'put' : 'post';
    
    await api[metodo](url, payload);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Conta salva com sucesso!', life: 3000 });
    dialogEmpresa.value = false;
    carregarTudo(); 
  } catch (error) {
    const mensagemErro = error.response?.data?.detail || 'Falha ao comunicar com o servidor.';
    toast.add({ severity: 'error', summary: 'Ação Bloqueada', detail: mensagemErro, life: 5000 });
  } finally {
    saving.value = false;
  }
};

const abrirNovaCompanhia = () => { companhiaForm.value = { id: null, nome: '' }; editandoCompanhia.value = false; dialogCompanhia.value = true; };
const editarFichaCompanhia = (dados) => { companhiaForm.value = { ...dados }; editandoCompanhia.value = true; dialogCompanhia.value = true; };
const salvarCompanhia = async () => {
  if (!companhiaForm.value.nome) return toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O nome da companhia é obrigatório.', life: 3000 });
  saving.value = true;
  try {
    if (editandoCompanhia.value) await api.put(`/cadastros/companhias/${companhiaForm.value.id}`, companhiaForm.value);
    else await api.post('/cadastros/companhias', companhiaForm.value);
    dialogCompanhia.value = false; carregarTudo();
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Grupo salvo.' });
  } catch (e) {} finally { saving.value = false; }
};

const abrirNovoSegmento = () => { segmentoForm.value = { id: null, nome: '' }; editandoSegmento.value = false; dialogSegmento.value = true; };
const editarFichaSegmento = (dados) => { segmentoForm.value = { ...dados }; editandoSegmento.value = true; dialogSegmento.value = true; };
const salvarSegmento = async () => {
  if (!segmentoForm.value.nome) return toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O nome do segmento é obrigatório.', life: 3000 });
  saving.value = true;
  try {
    if (editandoSegmento.value) await api.put(`/cadastros/segmentos/${segmentoForm.value.id}`, segmentoForm.value);
    else await api.post('/cadastros/segmentos', segmentoForm.value);
    dialogSegmento.value = false; carregarTudo();
  } catch (e) {} finally { saving.value = false; }
};

const abrirNovoPerfil = () => { perfilForm.value = { id: null, nome: '' }; editandoPerfil.value = false; dialogPerfil.value = true; };
const editarFichaPerfil = (dados) => { perfilForm.value = { ...dados }; editandoPerfil.value = true; dialogPerfil.value = true; };
const salvarPerfil = async () => {
  if (!perfilForm.value.nome) return toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O nome do perfil é obrigatório.', life: 3000 });
  saving.value = true;
  try {
    if (editandoPerfil.value) await api.put(`/cadastros/perfis/${perfilForm.value.id}`, perfilForm.value);
    else await api.post('/cadastros/perfis', perfilForm.value);
    dialogPerfil.value = false; carregarTudo();
  } catch (e) {} finally { saving.value = false; }
};

const abrirNovoCargo = () => { cargoForm.value = { id: null, nome: '' }; editandoCargo.value = false; dialogCargo.value = true; };
const editarFichaCargo = (dados) => { cargoForm.value = { ...dados }; editandoCargo.value = true; dialogCargo.value = true; };
const salvarCargo = async () => {
  if (!cargoForm.value.nome) return toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O nome do cargo é obrigatório.', life: 3000 });
  saving.value = true;
  try {
    if (editandoCargo.value) await api.put(`/cadastros/cargos/${cargoForm.value.id}`, cargoForm.value);
    else await api.post('/cadastros/cargos', cargoForm.value);
    dialogCargo.value = false; carregarTudo();
  } catch (e) {} finally { saving.value = false; }
};

const abrirNovoGestor = () => { 
  gestorForm.value = { id: null, nome: '', papel: '', email: '', teams_webhook: '' }; 
  editandoGestor.value = false; 
  dialogGestor.value = true; 
};

const gestorForm = ref({ id: null, nome: '', papel: '', email: '', teams_webhook: '', avatar: '' });
const editarFichaGestor = (dados) => { 
  gestorForm.value = { ...dados, avatar: dados.avatar || '' }; 
  editandoGestor.value = true; 
  dialogGestor.value = true; 
};

const salvarGestor = async () => {
  if (!gestorForm.value.nome) return toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O nome do gestor é obrigatório.', life: 3000 });
  saving.value = true;
  try {
    if (editandoGestor.value) await api.put(`/cadastros/gestores/${gestorForm.value.id}`, gestorForm.value);
    else await api.post('/cadastros/gestores', gestorForm.value);
    dialogGestor.value = false; carregarTudo();
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Responsável salvo.' });
  } catch (e) {} finally { saving.value = false; }
};

const testandoWebhook = ref(false);

const testarWebhook = async () => {
  if (!gestorForm.value.teams_webhook) return;
  
  try {
    testandoWebhook.value = true;
    // Dispara para a nova rota que criámos no main.py
    await api.post('/gestores/testar-webhook', { 
      webhook_url: gestorForm.value.teams_webhook 
    });
    
    toast.add({ 
      severity: 'success', 
      summary: 'Sucesso', 
      detail: 'Mensagem de teste enviada para o Teams!', 
      life: 4000 
    });
  } catch (error) {
    toast.add({ 
      severity: 'error', 
      summary: 'Erro', 
      detail: 'Falha ao enviar mensagem. Verifique se a URL está correta.', 
      life: 5000 
    });
  } finally {
    testandoWebhook.value = false;
  }
};

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const getIniciais = (nome) => nome ? nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'CL';

const getGestorPorEmpresa = (nomeEmpresa) => {
  if (!nomeEmpresa || nomeEmpresa === '-') return 'Sem Empresa';
  const emp = empresas.value.find(e => e.nome === nomeEmpresa);
  if (emp && emp.gestor) {
    return typeof emp.gestor === 'object' ? emp.gestor.nome : emp.gestor;
  }
  return 'Não definido';
};

// ==========================================
// 🛑 FUNÇÕES DE ATIVAR / INATIVAR
// ==========================================
const alternarStatusCliente = async (dadosCliente) => {
  try {
    await api.put(`/clientes/${dadosCliente.cliente_id}/status`, { 
      ativo: dadosCliente.ativo 
    });
    
    const statusTexto = dadosCliente.ativo ? 'ativada' : 'inativada';
    toast.add({ severity: 'success', summary: 'Sucesso', detail: `Contato ${statusTexto} com sucesso!`, life: 3000 });
  } catch (error) {
    // Se der erro no servidor, revertemos o botão na tela automaticamente
    dadosCliente.ativo = !dadosCliente.ativo;
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao alterar o status da pessoa.' });
  }
};

const alternarStatusEmpresa = async (dadosEmpresa) => {
  try {
    await api.put(`/empresas/${dadosEmpresa.id}/status`, { 
      ativo: dadosEmpresa.ativo 
    });
    
    const statusTexto = dadosEmpresa.ativo ? 'ativada' : 'inativada';
    toast.add({ severity: 'success', summary: 'Sucesso', detail: `Empresa ${statusTexto} com sucesso!`, life: 3000 });
  } catch (error) {
    dadosEmpresa.ativo = !dadosEmpresa.ativo;
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao alterar o status da empresa.' });
  }
};

onMounted(carregarTudo);

</script>

<template>
  <div class="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 lg:p-8">
    <div class="max-w-[1600px] mx-auto space-y-8 animate-fadein">
      
      <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 class="text-4xl font-black tracking-tighter italic text-slate-900 dark:text-white">Clientes <span class="text-orange-500">.</span></h1>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Contatos, empresas e responsáveis</p>
        </div>

        <div class="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          
          <div class="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
            <InputSwitch v-model="mostrarInativos" />
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">Mostrar Inativos</span>
          </div>

          <div class="relative w-full md:w-64">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <InputText 
              v-model="pesquisa" 
              @input="atualizarFiltro" 
              placeholder="Pesquisar..." 
              class="!pl-9 !bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !py-2 !rounded-xl w-full text-sm font-bold shadow-sm transition-all focus:!ring-2 focus:!ring-orange-500/20 outline-none" 
            />
          </div>
          
          <button @click="alternarMaisCadastros" class="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all"
            :class="maisCadastros ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-orange-300'">
            <i class="pi mr-1" :class="maisCadastros ? 'pi-eye-slash' : 'pi-sliders-h'"></i>{{ maisCadastros ? 'Menos cadastros' : 'Mais cadastros' }}
          </button>
          <Button icon="pi pi-refresh" @click="carregarTudo" :loading="loading" class="w-10 h-10 shrink-0 !bg-white dark:!bg-slate-900 !text-slate-600 dark:!text-slate-300 !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm hover:!bg-slate-50" v-tooltip.top="'Atualizar'" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-2 sm:p-4">
        <TabView class="custom-tabview">
          
          <TabPanel>
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-users text-indigo-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Contatos</span></div></template>
            <div class="pt-4">
              <div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Novo Contato" icon="pi pi-plus" @click="abrirNovo" class="!bg-indigo-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div>
              
              <DataTable :value="clientesFiltrados" v-model:filters="filtrosTabela" :globalFilterFields="['nome', 'email', 'empresa', 'cargo', 'perfil_decisor']" :paginator="true" :rows="10" dataKey="cliente_id" :loading="loading" class="p-datatable-sm custom-table" rowHover>
                <template #empty>
                  <div class="py-12 text-center">
                    <i class="pi pi-users text-4xl text-slate-300 dark:text-slate-600"></i>
                    <p class="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">Nenhum contato cadastrado ainda</p>
                    <p class="mt-1 text-xs text-slate-400">O jeito mais rápido é importar uma planilha com seus clientes.</p>
                    <router-link to="/importacao" class="inline-block mt-4 text-[10px] font-black uppercase tracking-widest text-orange-600 hover:underline">Importar planilha <i class="pi pi-arrow-right text-[9px]"></i></router-link>
                  </div>
                </template>
                
                <Column header="Contato" sortable field="nome" style="min-width: 250px">
                  <template #body="{ data }">
                    <div class="flex items-center gap-4 py-2">
                      <div class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-[11px] font-black text-slate-500 border border-slate-100 dark:border-slate-700 shrink-0">{{ getIniciais(data.nome) }}</div>
                      <div class="flex flex-col"><span class="text-[13px] font-black text-slate-800 dark:text-white">{{ data.nome }}</span><span class="text-[10px] text-slate-400 font-medium">{{ data.email }}</span></div>
                    </div>
                  </template>
                </Column>
                
                <Column header="Empresa" sortable field="empresa">
                  <template #body="{ data }">
                    <div class="flex flex-col">
                      <span class="text-[12px] font-bold text-slate-600 dark:text-slate-300">{{ data.empresa || '-' }}</span>
                      <span v-if="data.cargo" class="text-[9px] text-slate-400 uppercase tracking-tighter mt-0.5">{{ data.cargo }}</span>
                    </div>
                  </template>
                </Column>

                <Column header="Responsável">
                  <template #body="slotProps">
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <i class="pi pi-shield text-slate-400 text-[10px]"></i>
                        <span class="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                          {{ getGestorPorEmpresa(slotProps.data.empresa) }}
                        </span>
                      </div>
                      <span class="text-[9px] text-slate-400 uppercase font-black tracking-tighter mt-1">
                        Vinculado via Empresa
                      </span>
                    </div>
                  </template>
                </Column>

                <Column header="Perfil">
                  <template #body="{ data }"><div v-if="data.perfil_decisor" class="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-tight"><i :class="data.perfil_decisor === 'Decisor' ? 'pi pi-star-fill text-orange-500' : 'pi pi-user'"></i> {{ data.perfil_decisor }}</div></template>
                </Column>

                <Column header="Ações" alignFrozen="right" style="width: 100px">
                  <template #body="slotProps">
                    <div class="flex gap-2 justify-end">
                      <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" v-tooltip.top="'Editar'" @click="editarCliente(slotProps.data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none hover:!text-slate-700 rounded-lg transition-colors !text-[10px]" />
                      <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" v-tooltip.top="'Excluir'" @click="confirmarExclusao(slotProps.data.cliente_id || slotProps.data.id)" class="w-8 h-8 !bg-rose-50 dark:!bg-rose-500/10 !text-rose-400 !border-none hover:!bg-rose-100 rounded-lg transition-colors !text-[10px]" />
                    </div>
                  </template>
                </Column>

                <Column field="ativo" header="Status" style="width: 120px">
                  <template #body="{ data }">
                    <div class="flex flex-col items-center gap-1">
                      <InputSwitch v-model="data.ativo" @change="alternarStatusCliente(data)" />
                      
                      <span class="text-[9px] font-black uppercase tracking-widest" :class="data.ativo ? 'text-emerald-500' : 'text-slate-400'">
                        {{ data.ativo ? 'Ativo' : 'Inativo' }}
                      </span>
                    </div>
                  </template>
                </Column>

              </DataTable>
            </div>
          </TabPanel>

          <TabPanel>
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-building text-orange-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Empresas</span></div></template>
            <div class="pt-4">
              <div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Nova Empresa" icon="pi pi-plus" @click="abrirNovaEmpresa" class="!bg-orange-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div>
              <DataTable 
                  :key="mostrarInativos"
                  :value="empresasFiltradas" 
                  v-model:filters="filtrosTabela" 
                  :globalFilterFields="['nome', 'companhia', 'gestor', 'segmento']" 
                  :paginator="true" 
                  :rows="10" 
                  class="p-datatable-sm custom-table"
                >
                <Column field="nome" header="Nome" sortable>
                  <template #body="{ data }">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-3">
                      <Avatar v-if="data.avatar" :image="data.avatar" shape="circle" class="w-7 h-7 shadow-sm shrink-0 border border-slate-200 dark:border-slate-700" />
                      <i v-else class="pi pi-user text-sky-500"></i> 
                      {{ data.nome }}
                    </span>
                  </template>
                </Column>

                <Column field="companhia" header="Grupo">
                  <template #body="{ data }">
                    <Tag v-if="data.companhia" :value="data.companhia" class="!bg-indigo-50 dark:!bg-indigo-500/10 !text-indigo-600 dark:!text-indigo-400 !border !border-indigo-100 dark:!border-indigo-500/20 !text-[9px] !font-black !uppercase !tracking-widest !px-3" />
                    <span v-else class="text-[10px] text-slate-400 italic font-medium">Não associada</span>
                  </template>
                </Column>

                <Column field="gestor" header="Responsável">
                  <template #body="{ data }">
                    <span v-if="data.gestor" class="text-[10px] font-bold text-sky-600 dark:text-sky-400"><i class="pi pi-briefcase text-xs mr-1"></i> {{ typeof data.gestor === 'object' ? data.gestor.nome : data.gestor }}</span>
                    <span v-else class="text-[10px] text-slate-400 italic">Não associado</span>
                  </template>
                </Column>
                <Column field="segmento" header="Segmento">
                  <template #body="{ data }"><Tag v-if="data.segmento" :value="data.segmento" class="!bg-slate-100 !text-slate-600 dark:!bg-slate-800 dark:!text-slate-300 !text-[9px] !font-black !uppercase !tracking-widest !px-3" /></template>
                </Column>
                <Column field="total_contatos" header="Contatos" sortable align="center">
                  <template #body="{ data }"><div class="text-[11px] font-bold text-slate-500"><i class="pi pi-users mr-1"></i> {{ data.total_contatos }}</div></template>
                </Column>
                <Column field="arr_total" header="Receita" sortable align="right">
                  <template #body="{ data }"><span class="text-sm font-black text-emerald-600 dark:text-emerald-400">{{ formatarMoeda(data.arr_total) }}</span></template>
                </Column>
                <Column alignFrozen="right" style="width: 100px">
                  <template #body="{ data }">
                    <div class="flex gap-2 justify-end">
                      <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" @click="editarFichaEmpresa(data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-indigo-50 hover:!text-indigo-500 transition-colors" />
                      <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" @click="confirmarExclusaoEmpresa(data.id)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-rose-50 hover:!text-rose-500 transition-colors" />
                    </div>
                  </template>
                </Column>

                <Column field="ativo" header="Status" style="width: 120px">
                  <template #body="{ data }">
                    <div class="flex flex-col items-center gap-1">
                      <InputSwitch v-model="data.ativo" @change="alternarStatusEmpresa(data)" />
                      
                      <span class="text-[9px] font-black uppercase tracking-widest" :class="data.ativo ? 'text-emerald-500' : 'text-slate-400'">
                        {{ data.ativo ? 'Ativa' : 'Inativa' }}
                      </span>
                    </div>
                  </template>
                </Column>

              </DataTable>
            </div>
          </TabPanel>

          <TabPanel>
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-star-fill text-sky-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Responsáveis</span></div></template>
            <div class="pt-4">
              <div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Novo Responsável" icon="pi pi-plus" @click="abrirNovoGestor" class="!bg-sky-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div>
              <DataTable :value="gestores" v-model:filters="filtrosTabela" :globalFilterFields="['nome', 'papel', 'email']" :paginator="true" :rows="10" class="p-datatable-sm custom-table">
                <Column field="id" header="ID" style="width: 80px" class="text-slate-400 text-xs font-bold"></Column>
                <Column field="nome" header="Nome" sortable><template #body="{ data }"><span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><i class="pi pi-user text-sky-500"></i> {{ data.nome }}</span></template></Column>
                <Column field="papel" header="Papel / Função"><template #body="{ data }"><span class="text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700">{{ data.papel || 'Não definido' }}</span></template></Column>
                <Column field="email" header="E-mail"><template #body="{ data }"><span class="text-[11px] font-medium text-slate-400">{{ data.email || 'Sem e-mail' }}</span></template></Column>
                <Column alignFrozen="right" style="width: 100px">
                  <template #body="{ data }">
                    <div class="flex gap-2 justify-end">
                      <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" @click="editarFichaGestor(data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-indigo-50 hover:!text-indigo-500 transition-colors" />
                      <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" @click="confirmarExclusaoGestor(data.id)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-rose-50 hover:!text-rose-500 transition-colors" />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel v-if="maisCadastros">
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-sitemap text-indigo-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Grupos</span></div></template>
            <div class="pt-4">
              <div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Novo Grupo" icon="pi pi-plus" @click="abrirNovaCompanhia" class="!bg-indigo-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div>
              <DataTable :value="companhias" v-model:filters="filtrosTabela" :globalFilterFields="['nome']" :paginator="true" :rows="10" class="p-datatable-sm custom-table">
                <Column field="id" header="ID" style="width: 80px" class="text-slate-400 text-xs font-bold"></Column>
                <Column field="nome" header="Grupo" sortable>
                  <template #body="{ data }"><span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><i class="pi pi-sitemap text-indigo-500"></i> {{ data.nome }}</span></template>
                </Column>
                <Column alignFrozen="right" style="width: 100px">
                  <template #body="{ data }">
                    <div class="flex gap-2 justify-end">
                      <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" @click="editarFichaCompanhia(data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-indigo-50 hover:!text-indigo-500 transition-colors" />
                      <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" @click="confirmarExclusaoCompanhia(data.id)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-rose-50 hover:!text-rose-500 transition-colors" />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel v-if="maisCadastros">
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-chart-pie text-emerald-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Segmentos</span></div></template>
            <div class="pt-4"><div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Novo Segmento" icon="pi pi-plus" @click="abrirNovoSegmento" class="!bg-emerald-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div>
            <DataTable :value="segmentos" v-model:filters="filtrosTabela" :globalFilterFields="['nome']" :paginator="true" :rows="10" class="p-datatable-sm custom-table">
              <Column field="id" header="ID" style="width: 80px" class="text-slate-400 text-xs font-bold"></Column>
              <Column field="nome" header="Nome do Segmento" sortable><template #body="{ data }"><span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ data.nome }}</span></template></Column>
              <Column alignFrozen="right" style="width: 100px">
                <template #body="{ data }">
                  <div class="flex gap-2 justify-end">
                    <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" @click="editarFichaSegmento(data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-indigo-50 hover:!text-indigo-500 transition-colors" />
                    <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" @click="confirmarExclusaoSegmento(data.id)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-rose-50 hover:!text-rose-500 transition-colors" />
                  </div>
                </template>
                </Column>          
              </DataTable></div>
          </TabPanel>
          <TabPanel v-if="maisCadastros">
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-id-card text-rose-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Perfis</span></div></template>
            <div class="pt-4"><div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Novo Perfil" icon="pi pi-plus" @click="abrirNovoPerfil" class="!bg-rose-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div><DataTable :value="perfis" v-model:filters="filtrosTabela" :globalFilterFields="['nome']" :paginator="true" :rows="10" class="p-datatable-sm custom-table"><Column field="id" header="ID" style="width: 80px" class="text-slate-400 text-xs font-bold"></Column><Column field="nome" header="Papel na Conta" sortable><template #body="{ data }"><span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><i class="pi pi-user text-rose-500"></i> {{ data.nome }}</span></template></Column>
            <Column alignFrozen="right" style="width: 100px">
              <template #body="{ data }">
                <div class="flex gap-2 justify-end">
                  <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" @click="editarFichaPerfil(data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-indigo-50 hover:!text-indigo-500 transition-colors" />
                  <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" @click="confirmarExclusaoPerfil(data.id)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-rose-50 hover:!text-rose-500 transition-colors" />
                </div>
              </template>
            </Column>
          </DataTable></div>
          </TabPanel>
          <TabPanel v-if="maisCadastros">
            <template #header><div class="flex items-center gap-2 px-2"><i class="pi pi-briefcase text-purple-500"></i><span class="font-black tracking-widest uppercase text-[10px]">Cargos</span></div></template>
            <div class="pt-4"><div class="flex justify-end mb-4"><Button v-if="temPermissao('clientes:criar')" label="Novo Cargo" icon="pi pi-plus" @click="abrirNovoCargo" class="!bg-purple-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-6 shadow-xl hover:scale-105" /></div><DataTable :value="cargos" v-model:filters="filtrosTabela" :globalFilterFields="['nome']" :paginator="true" :rows="10" class="p-datatable-sm custom-table"><Column field="id" header="ID" style="width: 80px" class="text-slate-400 text-xs font-bold"></Column><Column field="nome" header="Cargo" sortable><template #body="{ data }"><span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><i class="pi pi-briefcase text-purple-500"></i> {{ data.nome }}</span></template></Column>
              <Column alignFrozen="right" style="width: 100px">
                <template #body="{ data }">
                  <div class="flex gap-2 justify-end">
                    <Button v-if="temPermissao('clientes:editar')" icon="pi pi-pencil" @click="editarFichaCargo(data)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-indigo-50 hover:!text-indigo-500 transition-colors" />
                    <Button v-if="temPermissao('clientes:excluir')" icon="pi pi-trash" @click="confirmarExclusaoCargo(data.id)" class="w-8 h-8 !bg-slate-50 dark:!bg-slate-800 !text-slate-400 !border-none !text-[10px] rounded-lg hover:!bg-rose-50 hover:!text-rose-500 transition-colors" />
                  </div>
                </template>
              </Column>
            </DataTable></div>
          </TabPanel>

        </TabView>
      </div>

      <Dialog v-model:visible="dialogVisivel" :header="editando ? 'Editar Contato' : 'Novo Contato'" modal :style="{width: '550px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog">
        <div class="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5 md:col-span-2"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Completo *</label><InputText v-model="cliente.nome" class="custom-input w-full" /></div>
          <div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">E-mail *</label><InputText v-model="cliente.email" type="email" class="custom-input w-full" /></div>
          <div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Telefone</label><InputText v-model="cliente.telefone" class="custom-input w-full" /></div>
          <div class="flex flex-col gap-1.5 md:col-span-2">
            <label class="text-[10px] font-black uppercase text-slate-500 ml-1">Empresa</label>
            <Dropdown v-model="cliente.empresa_id" :options="empresas" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione a Empresa" class="custom-dropdown w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase text-slate-500 ml-1">Perfil</label>
            <Dropdown v-model="cliente.perfil_id" :options="perfis" optionLabel="nome" optionValue="id" showClear placeholder="Selecione o Perfil" class="custom-dropdown w-full" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase text-slate-500 ml-1">Cargo *</label>
            <Dropdown v-model="cliente.cargo_id" :options="cargos" optionLabel="nome" optionValue="id" filter showClear placeholder="Selecione o Cargo" class="custom-dropdown w-full" />
          </div>
          
          <div class="flex flex-col gap-2 pt-2 md:col-span-2">
            <div class="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Status do Envio</label>
              <div class="flex items-center gap-3">
                <InputSwitch v-model="cliente.ativo" />
                <span class="text-xs font-bold" :class="cliente.ativo ? 'text-emerald-500' : 'text-slate-500'">
                  {{ cliente.ativo ? '🟢 Contato Ativo (Recebe pesquisas)' : '⏸️ Contato Inativo (Pausado)' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900 flex gap-3 w-full"><Button label="Cancelar" text class="flex-1 font-bold text-[11px] text-slate-400" @click="dialogVisivel = false" /><Button :label="editando ? 'Salvar' : 'Adicionar'" :loading="saving" class="flex-1 !bg-indigo-500 !text-white !rounded-xl font-bold text-[11px] shadow-lg border-none py-3" @click="salvarCliente" /></div></template>
      </Dialog>

      <Dialog v-model:visible="dialogEmpresa" :header="editandoEmpresa ? 'Editar Conta' : 'Nova Conta'" modal :style="{width: '450px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog">
        <div class="p-6 md:p-8 space-y-4 bg-slate-50/50 dark:bg-slate-900">
          <div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome da Empresa *</label><InputText v-model="empresaForm.nome" class="custom-input w-full" /></div>
          
          <div class="flex flex-col gap-1.5 pt-2">
            <label class="text-[10px] font-black uppercase text-indigo-500 ml-1">
              <i class="pi pi-sitemap text-[8px]"></i> Grupo (Vínculo)
            </label>
            <Dropdown 
              v-model="empresaForm.companhia" 
              :options="companhias" 
              optionLabel="nome" 
              placeholder="Selecione o Grupo" 
              filter
              showClear
              class="custom-dropdown w-full" 
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase text-slate-500 ml-1">Segmento</label>
            <Dropdown 
              v-model="empresa.segmento_id" 
              :options="segmentos" 
              optionLabel="nome" 
              optionValue="id" 
              filter 
              showClear 
              placeholder="Selecione o Segmento" 
              class="custom-dropdown w-full" 
            />
          </div>
          
          <div class="flex flex-col gap-1.5 pt-2">
            <label class="text-[10px] font-black uppercase text-sky-500 ml-1">
              <i class="pi pi-star-fill text-[8px]"></i> Responsável
            </label>
            <Dropdown 
              v-model="empresaForm.gestor" 
              :options="gestores" 
              optionLabel="nome" 
              placeholder="Selecione o Responsável" 
              filter
              showClear
              class="custom-dropdown w-full" 
            />
          </div>

          <div class="flex flex-col gap-1.5 pt-2">
            <label class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 ml-1 flex items-center gap-1"><i class="pi pi-money-bill"></i> Valor do contrato (mensal)</label>
            <InputNumber v-model="empresaForm.valor_contrato" mode="currency" currency="BRL" locale="pt-BR" class="w-full" inputClass="custom-input w-full !text-lg !font-black !text-emerald-600 dark:!text-emerald-400 !bg-emerald-50 dark:!bg-emerald-900/10" />
          </div>

          <div class="flex flex-col gap-2 pt-2">
            <div class="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Status da Conta</label>
              <div class="flex items-center gap-3">
                <InputSwitch v-model="empresaForm.ativo" />
                <span class="text-xs font-bold" :class="empresaForm.ativo ? 'text-emerald-500' : 'text-slate-500'">
                  {{ empresaForm.ativo ? '🟢 Conta Ativa' : '⏸️ Conta Inativa' }}
                </span>
              </div>
            </div>
          </div>
          
        </div>
        <template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900"><Button :label="editandoEmpresa ? 'Atualizar Conta' : 'Criar Conta'" @click="salvarEmpresa" :loading="saving" class="w-full !bg-orange-500 !text-white py-4 !rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl" /></div></template>
      </Dialog>

      <Dialog v-model:visible="dialogCompanhia" :header="editandoCompanhia ? 'Editar Grupo' : 'Novo Grupo'" modal :style="{width: '400px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog">
        <div class="p-6 md:p-8 space-y-4 bg-slate-50/50 dark:bg-slate-900">
          <div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome do Grupo *</label><InputText v-model="companhiaForm.nome" class="custom-input w-full" /></div>
        </div>
        <template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900"><Button :label="editandoCompanhia ? 'Atualizar Grupo' : 'Criar Grupo'" @click="salvarCompanhia" :loading="saving" class="w-full !bg-indigo-500 !text-white py-4 !rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-transform" /></div></template>
      </Dialog>

      <Dialog 
        v-model:visible="dialogGestor" 
        :header="editandoGestor ? 'Editar Perfil do Responsável' : 'Novo Responsável'" 
        modal 
        :style="{ width: '500px' }" 
        class="custom-dialog"
        :draggable="false"
      >
        <div class="p-6 md:p-8 flex flex-col gap-6 bg-white dark:bg-slate-900">
          
          <div class="flex flex-col items-center justify-center gap-4 py-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700">
            <div class="relative group">
              <div class="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <img 
                  v-if="gestorForm.avatar" 
                  :src="gestorForm.avatar" 
                  @error="(e) => e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'"
                  class="w-full h-full object-cover"
                />
                <i v-else class="pi pi-user text-4xl text-slate-400"></i>
              </div>
              
              <div class="absolute bottom-0 right-0 w-8 h-8 bg-sky-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-lg">
                <i class="pi pi-camera text-[10px] text-white"></i>
              </div>
            </div>

            <div class="w-full px-6">
              <label class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-2 text-center">URL da Imagem de Perfil</label>
              <InputText 
                v-model="gestorForm.avatar" 
                placeholder="https://link-da-foto.com/foto.jpg" 
                class="!bg-white dark:!bg-slate-900 !border-slate-200 dark:!border-slate-700 !rounded-xl !py-2.5 !text-[11px] w-full text-center focus:!ring-2 focus:!ring-sky-500/20" 
              />
            </div>
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Nome Completo</label>
                <InputText v-model="gestorForm.nome" placeholder="Ex: Marcelo Mendes" class="custom-input-alt" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Cargo / Papel</label>
                <InputText v-model="gestorForm.papel" placeholder="Ex: Chapter Lead" class="custom-input-alt" />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-mail de Trabalho</label>
              <InputText v-model="gestorForm.email" placeholder="email@empresa.com" class="custom-input-alt" />
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-2">
                <i class="pi pi-microsoft text-indigo-500 text-[9px]"></i> Teams Webhook
              </label>
              <div class="flex gap-2">
                <InputText v-model="gestorForm.teams_webhook" placeholder="https://outlook.office.com/webhook/..." class="custom-input-alt flex-1" />
                <Button 
                  icon="pi pi-send" 
                  @click="testarWebhook" 
                  :loading="testandoWebhook" 
                  v-tooltip.top="'Enviar teste'"
                  class="!bg-indigo-50 dark:!bg-indigo-500/10 !text-indigo-600 dark:!text-indigo-400 !border-none !rounded-xl !w-12 hover:!bg-indigo-500 hover:!text-white transition-all shadow-sm" 
                />
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-4">
            <button 
              @click="dialogGestor = false" 
              class="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <Button 
              label="Salvar Alterações" 
              icon="pi pi-check" 
              @click="salvarGestor" 
              :loading="saving" 
              class="!bg-slate-900 dark:!bg-white !text-white dark:!text-slate-900 !py-3 !px-8 !rounded-2xl !font-black !text-[11px] uppercase tracking-widest !border-none shadow-xl hover:scale-105 active:scale-95 transition-all" 
            />
          </div>
        </template>
      </Dialog>

      <Dialog v-model:visible="dialogExclusao" header="Confirmar Exclusão" modal :style="{width: '400px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog">
        <div class="p-6 md:p-8 bg-slate-50/50 dark:bg-slate-900 text-center flex flex-col items-center">
          <div class="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mb-4"><i class="pi pi-exclamation-triangle text-rose-500 text-3xl"></i></div>
          <p class="text-slate-700 dark:text-slate-300 font-bold text-sm">Tem certeza absoluta que deseja excluir {{ nomeExclusao }}?</p>
          <p class="text-slate-500 dark:text-slate-400 text-xs mt-2 font-medium">Esta ação não poderá ser desfeita.</p>
        </div>
        <template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900 flex gap-3 w-full"><Button label="Cancelar" text class="flex-1 font-bold text-[11px] text-slate-400" @click="dialogExclusao = false" /><Button label="Sim, confirmo!" :loading="excluindo" @click="executarExclusao" class="flex-1 !bg-rose-500 !text-white !rounded-xl font-bold text-[11px] shadow-lg border-none py-3" /></div></template>
      </Dialog>

      <Dialog v-model:visible="dialogSegmento" :header="editandoSegmento ? 'Editar Segmento' : 'Novo Segmento'" modal :style="{width: '400px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog"><div class="p-6 md:p-8 space-y-4 bg-slate-50/50 dark:bg-slate-900"><div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome do Segmento *</label><InputText v-model="segmentoForm.nome" class="custom-input w-full" /></div></div><template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900"><Button :label="editandoSegmento ? 'Atualizar Segmento' : 'Criar Segmento'" @click="salvarSegmento" :loading="saving" class="w-full !bg-emerald-500 !text-white py-4 !rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-transform" /></div></template></Dialog>
      <Dialog v-model:visible="dialogPerfil" :header="editandoPerfil ? 'Editar Perfil' : 'Novo Perfil'" modal :style="{width: '400px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog"><div class="p-6 md:p-8 space-y-4 bg-slate-50/50 dark:bg-slate-900"><div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome do Perfil *</label><InputText v-model="perfilForm.nome" class="custom-input w-full" /></div></div><template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900"><Button :label="editandoPerfil ? 'Atualizar Perfil' : 'Criar Perfil'" @click="salvarPerfil" :loading="saving" class="w-full !bg-rose-500 !text-white py-4 !rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-transform" /></div></template></Dialog>
      <Dialog v-model:visible="dialogCargo" :header="editandoCargo ? 'Editar Cargo' : 'Novo Cargo'" modal :style="{width: '400px'}" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog"><div class="p-6 md:p-8 space-y-4 bg-slate-50/50 dark:bg-slate-900"><div class="flex flex-col gap-1.5"><label class="text-[10px] font-black uppercase text-slate-500 ml-1">Nome do Cargo *</label><InputText v-model="cargoForm.nome" class="custom-input w-full" /></div></div><template #footer><div class="px-8 pb-8 pt-4 bg-slate-50/50 dark:bg-slate-900"><Button :label="editandoCargo ? 'Atualizar Cargo' : 'Criar Cargo'" @click="salvarCargo" :loading="saving" class="w-full !bg-purple-500 !text-white py-4 !rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-transform" /></div></template></Dialog>
    </div>
  </div>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";
.animate-fadein { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

:deep(.p-tabview-panels), :deep(.p-tabview-panel) { @apply bg-transparent !important; padding: 0 !important; }
:deep(.p-datatable .p-datatable-thead > tr > th) { @apply bg-slate-50 dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 py-6 px-4; }
:deep(.p-datatable .p-datatable-tbody > tr) { @apply bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800/50 text-slate-700 dark:text-slate-300; }
:deep(.p-datatable .p-datatable-tbody > tr > td) { @apply py-4 px-4; }
:deep(.p-datatable .p-datatable-emptymessage > td) { @apply bg-white dark:bg-slate-900 text-center text-slate-400 py-8 text-sm font-medium; }

:deep(.custom-input), :deep(.p-dropdown.custom-dropdown) { @apply bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium !important; }
:deep(.p-dropdown.custom-dropdown .p-dropdown-trigger), :deep(.p-dropdown.custom-dropdown .p-dropdown-trigger-icon), :deep(.p-dropdown.custom-dropdown .p-dropdown-trigger svg) { @apply text-slate-400 dark:text-slate-400 !important; }
:deep(.p-dropdown.custom-dropdown .p-dropdown-label) { @apply bg-transparent py-0 text-xs text-slate-700 dark:text-slate-200 !important; }
:deep(.custom-dropdown.w-full) { @apply flex items-center px-1; }
:deep(.p-dropdown-panel) { @apply dark:bg-slate-800 dark:border-slate-700 !important; }
:deep(.p-dropdown-panel .p-dropdown-item) { @apply dark:text-slate-300 hover:dark:bg-slate-700 !important; }
:deep(.p-dropdown-panel .p-dropdown-item.p-highlight) { @apply dark:bg-orange-500/20 dark:text-orange-500 !important; }

:deep(.custom-dialog .p-dialog-header) { @apply bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6; }
:deep(.custom-dialog .p-dialog-content) { @apply dark:bg-slate-900; }
:deep(.custom-dialog .p-dialog-title) { @apply text-lg font-black italic tracking-tight text-slate-800 dark:text-white; }

/* TABS: REMOÇÃO DE MARGENS E FUNDOS */
:deep(.p-tabview), 
:deep(.p-tabview-nav-container), 
:deep(.p-tabview-nav-content), 
:deep(.p-tabview-nav) {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
}

:deep(.p-tabview-panels) {
    background: transparent !important;
    padding: 0 !important;   
    margin-top: -10px !important; 
}

:deep(.p-tabview-nav li) {
    background: transparent !important;
    border: none !important;
    margin-right: 6px !important;
    margin-bottom: 0 !important; 
}

:deep(.p-tabview-nav li .p-tabview-nav-link) {
    @apply bg-slate-100 dark:bg-slate-800 text-slate-500 !important;
    border: none !important;
    border-radius: 12px !important;
    padding: 10px 18px !important; 
    transition: all 0.2s ease !important;
}

:deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
    @apply bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md !important;
}

:deep(.p-tabview .p-tabview-nav) {
    border-bottom: none !important;
}
</style>