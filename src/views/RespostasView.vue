<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import api from '../services/api';
import { useRouter } from 'vue-router';
import { formatarDataLocal } from '../utils/formatters';

import { useToast } from 'primevue/usetoast';
import Calendar from 'primevue/calendar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import InputSwitch from 'primevue/inputswitch';
import Skeleton from 'primevue/skeleton';

const toast = useToast();
const respostas = ref([]);
const loading = ref(true);
const router = useRouter();

// Função que encaminha o usuário para o Planos de Ação com o ID da ação
const irParaAcao = (acaoId) => {
  if (acaoId) {
    router.push({ path: '/acoes', query: { abrir: acaoId } });
  }
};

// ==========================================
// 1. DECLARAÇÃO DOS FILTROS (Variáveis primeiro)
// ==========================================
const dataFinal = new Date();
const dataInicial = new Date();
dataInicial.setDate(dataFinal.getDate() - 90);

const datasFiltro = ref(null); 

const filtros = ref({
  q: '',
  companhia: 'Todas',
  empresa: 'Todas',
  categoria: 'Todas',
  perfil: 'Todos',
  incluir_excluidas: false,
  tipo_data: 'data_resposta'
});

const opcoesTipoData = [
  { label: 'Data da Resposta (Real)', value: 'data_resposta' },
  { label: 'Data de Cadastro (Sistema)', value: 'created_at' }
];

const opcoesCategoria = ['Todas', 'Promotor', 'Neutro', 'Detrator'];
const opcoesPerfil = ['Todos', 'Decisor', 'Influenciador', 'Outro'];

const formatarDataSegura = (valor) => {
  if (!valor || String(valor).trim() === '' || valor === 'NaT' || valor === 'None' || valor === 'null') {
    return null;
  }
  
  try {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return null;
    
    return formatarDataLocal(valor);
  } catch (e) {
    return null;
  }
};

const tratarData = (dataOriginal) => {
  if (!dataOriginal || dataOriginal === 'NaT' || dataOriginal === 'None' || dataOriginal === '') {
    return null; // O HTML vai mostrar "Sem data"
  }
  
  try {
    let dataCorrigida = String(dataOriginal).trim();
    
    // nós não inventamos uma hora falsa. Apenas invertemos para o padrão PT/BR.
    if (dataCorrigida.length === 10) {
      const [ano, mes, dia] = dataCorrigida.split('-');
      return `${dia}/${mes}/${ano}`; // Retorna "08/04/2026"
    }
    
    // Se a base enviar uma data completa (com horas), passa pelo formatador global
    const d = new Date(dataCorrigida);
    if (isNaN(d.getTime())) return null;
    
    return formatarDataLocal(dataCorrigida);
  } catch (error) {
    return null;
  }
};

// ==========================================
// 2. COMBOS (Grupos e Empresas)
// ==========================================
const empresasData = ref([]);
const opcoesCompanhia = ref(['Todas']);

const opcoesEmpresa = computed(() => {
  let filtradas = empresasData.value;
  if (filtros.value.companhia && filtros.value.companhia !== 'Todas') {
    filtradas = empresasData.value.filter(e => e.companhia === filtros.value.companhia);
  }
  return ['Todas', ...filtradas.map(e => e.nome).sort()];
});

const carregarCombos = async () => {
  try {
    const [resEmp, resComp] = await Promise.all([
      api.get('/cadastros/empresas'),
      api.get('/cadastros/companhias')
    ]);
    
    if (resEmp.data) {
      empresasData.value = resEmp.data;
    }
    
    if (resComp.data) {
      const isArrayOfStrings = typeof resComp.data[0] === 'string';
      const nomes = isArrayOfStrings 
          ? resComp.data.filter(c => c !== 'Todos os grupos' && c !== 'Todas')
          : resComp.data.map(c => c.nome);
          
      opcoesCompanhia.value = ['Todas', ...nomes.sort()];
    }
  } catch (error) {
    console.error("Erro ao carregar combos:", error);
  }
};

// ==========================================
// 3. WATCHERS (Memória e pesquisa)
// ==========================================
let timeoutPesquisa = null;

watch(() => filtros.value.companhia, (nova, antiga) => {
  if (nova !== antiga) {
    filtros.value.empresa = 'Todas';
  }
});

watch(filtros, (novosFiltros) => {
  localStorage.setItem('nps_ver_arquivados', novosFiltros.incluir_excluidas);
  
  clearTimeout(timeoutPesquisa);
  timeoutPesquisa = setTimeout(() => {
    carregarRespostas();
  }, 500);
}, { deep: true }); 

// ==========================================
// 📡 COMUNICAÇÃO COM A API E FILTROS LOCAIS
// ==========================================
const carregarRespostas = async () => {
  loading.value = true;
  try {
    const params = {
      q: filtros.value.q,
      companhia: filtros.value.companhia === 'Todas' ? '' : filtros.value.companhia,
      empresa: filtros.value.empresa === 'Todas' ? '' : filtros.value.empresa,
      categoria: filtros.value.categoria === 'Todas' ? '' : filtros.value.categoria,
      perfil: filtros.value.perfil === 'Todos' ? '' : filtros.value.perfil,
      incluir_excluidas: filtros.value.incluir_excluidas,
      tipo_data: filtros.value.tipo_data // 🎯 Adicionado
    };

    if (datasFiltro.value && datasFiltro.value[0] && datasFiltro.value[1]) {
      params.data_inicio = new Date(datasFiltro.value[0]).toISOString().split('T')[0];
      params.data_fim = new Date(datasFiltro.value[1]).toISOString().split('T')[0];
    }

    if (datasFiltro.value && datasFiltro.value[0] && datasFiltro.value[1]) {
      const formatarDate = (data) => {
        const d = new Date(data);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      };
      params.data_inicio = formatarDate(datasFiltro.value[0]);
      params.data_fim = formatarDate(datasFiltro.value[1]);
    }
    
    const response = await api.get('/respostas', { params });
    
    respostas.value = response.data.map(item => {
      const estaArquivado = item.excluido === true || item.excluido === 'True' || item.excluido === 'true' || item.excluido === 1 || item.excluido === '1';
      return { ...item, excluido: estaArquivado };
    });

  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar feedbacks.', life: 3000 });
  } finally {
    loading.value = false;
  }
};

const respostasFiltradas = computed(() => {
    return respostas.value; 
});

// ==========================================
// 📊 MÉTRICAS EM TEMPO REAL
// ==========================================
const metricasAtuais = computed(() => {
  const total = respostasFiltradas.value.length;
  if (total === 0) return { nps: 0, promotores: 0, neutros: 0, detratores: 0, total: 0 };
  
  let p = 0, n = 0, d = 0;
  respostasFiltradas.value.forEach(r => {
    if (r.nota >= 9) p++;
    else if (r.nota >= 7) n++;
    else d++;
  });
  
  const nps = Math.round(((p / total) * 100) - ((d / total) * 100));
  return { nps, promotores: p, neutros: n, detratores: d, total };
});

// ==========================================
// 📝 ESTADO DE EDIÇÃO E AUDITORIA
// ==========================================
const dialogEdicao = ref(false);
const salvando = ref(false);
const respostaAtual = ref({
  id: '', nota: 0, categoria: '', motivo: '', canal: '', expectativas: '', o_que_faltava: ''
});

const abrirEdicao = (dados) => {
  respostaAtual.value = { 
    ...dados,
    id: dados.resposta_id,
    empresa: dados.nome || dados.empresa,
    empresa_id: dados.empresa_id ? Number(dados.empresa_id) : null,
    gestor_id: dados.gestor_id ? Number(dados.gestor_id) : null
  };
  dialogEdicao.value = true;
};

const salvarResposta = async () => {
  salvando.value = true;
  try {
    await api.put(`/respostas/${respostaAtual.value.id}`, respostaAtual.value);
    toast.add({ severity: 'success', summary: 'Enriquecido', detail: 'Feedback atualizado com sucesso.', life: 3000 });
    dialogEdicao.value = false;
    carregarRespostas();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a análise.', life: 3000 });
  } finally {
    salvando.value = false;
  }
};

// ==========================================
// 🗂️ ARQUIVO (SOFT DELETE)
// ==========================================
const alternarEstadoArquivo = async (dados) => {
  const estadoAnterior = dados.excluido;
  dados.excluido = !estadoAnterior; 
  
  try {
    if (!estadoAnterior) { 
      await api.post(`/respostas/${dados.resposta_id}/soft-delete`);
      toast.add({ severity: 'info', summary: 'Arquivado', detail: 'Feedback ocultado do Dashboard.', life: 3000 });
    } else {
      await api.post(`/respostas/${dados.resposta_id}/restore`);
      toast.add({ severity: 'success', summary: 'Restaurado', detail: 'Feedback voltou a ficar ativo.', life: 3000 });
    }

    if (!filtros.value.incluir_excluidas && !estadoAnterior) {
      respostas.value = respostas.value.filter(r => r.resposta_id !== dados.resposta_id);
    }
  } catch (error) {
    dados.excluido = estadoAnterior; 
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao comunicar com o servidor.', life: 3000 });
  }
};

// ==========================================
// 🚀 DELEGAR PLANO DE AÇÃO (KANBAN)
// ==========================================
const dialogNovaAcao = ref(false);
const salvandoAcao = ref(false);
const novaAcaoForm = ref({ titulo: '', gestor_id: null, prioridade: 'Alta', descricao: '' });
const gestoresLista = ref([]); 

const abrirNovaAcao = async () => {
  if (gestoresLista.value.length === 0) {
    try {
      const res = await api.get('/cadastros/gestores');
      gestoresLista.value = res.data;
    } catch(e) {
      console.error("Erro ao carregar lista de gestores:", e);
      toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar gestores.' });
    }
  }

  novaAcaoForm.value = {
    titulo: `Revisão de NPS: ${respostaAtual.value.empresa || 'Cliente'}`,
    gestor_id: respostaAtual.value.gestor_id ? Number(respostaAtual.value.gestor_id) : null,
    empresa_id: respostaAtual.value.empresa_id ? Number(respostaAtual.value.empresa_id) : null,
    prioridade: 'Alta',
    descricao: `Análise do feedback da ${respostaAtual.value.empresa || 'empresa'}. \n\nComentário original: "${respostaAtual.value.motivo || 'Sem comentário'}"`
  };
  
  dialogNovaAcao.value = true;
};

const criarPlanoAcao = async () => {
  if (!novaAcaoForm.value.titulo) {
    return toast.add({ severity: 'warn', summary: 'Aviso', detail: 'O título é obrigatório.'});
  }
  
  salvandoAcao.value = true;
  try {
    const payload = {
      resposta_id: respostaAtual.value.id,
      titulo: novaAcaoForm.value.titulo,
      gestor_id: novaAcaoForm.value.gestor_id,
      empresa_id: novaAcaoForm.value.empresa_id,
      prioridade: novaAcaoForm.value.prioridade,
      descricao: novaAcaoForm.value.descricao
    };
    
    await api.post('/acoes', payload);
    toast.add({ severity: 'success', summary: 'Ação Delegada', detail: 'O Responsável foi notificado e a ação criada nos Planos de Ação.' });
    dialogNovaAcao.value = false;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao delegar ação. Verifique a conexão.' });
  } finally {
    salvandoAcao.value = false;
  }
};

// ==========================================
// 🎨 UTILITÁRIOS DE UI
// ==========================================

const obterCorNPS = (nota) => {
  if (nota >= 9) return 'bg-emerald-500 shadow-emerald-500/30';
  if (nota >= 7) return 'bg-yellow-500 shadow-yellow-500/30 text-slate-900';
  return 'bg-rose-500 shadow-rose-500/30';
};

const modalNovaResposta = ref(false);
const salvandoResposta = ref(false);
const clientesDropdown = ref([]); // Deverá carregar isto da sua API de clientes

const formResposta = ref({
  cliente_id: null,
  nota: null,
  canal: 'Manual',
  motivo: ''
});

const abrirModalNovaResposta = () => {
  formResposta.value = { cliente_id: null, nota: null, canal: 'Manual', motivo: '' };
  modalNovaResposta.value = true;
};

const salvarRespostaManual = async () => {
  if (!formResposta.value.cliente_id || formResposta.value.nota === null) {
    return toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Cliente e Nota são obrigatórios.' });
  }

  salvandoResposta.value = true;
  try {
    // Chama a API para gravar a resposta
    await api.post('/respostas/manual', formResposta.value);
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Resposta cadastrada!' });
    modalNovaResposta.value = false;
    // recarregarRespostas(); <-- Chame a sua função que atualiza a tabela aqui
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar.' });
  } finally {
    salvandoResposta.value = false;
  }
};

const carregarClientesParaDropdown = async () => {
  try {
    const res = await api.get('/clientes', { params: { ativo: 1 } });
    
    clientesDropdown.value = res.data;
    console.log("Clientes carregados:", res.data.length); // Para confirmar no console
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
  }
};

// ==========================================
// 🗑️ EXCLUSÃO DEFINITIVA (APENAS ADMIN)
// ==========================================
// Adapte a chave 'usuario_tipo' conforme o que salvou no seu localStorage no momento do login
const isAdmin = computed(() => {
  const tipo = localStorage.getItem('usuario_tipo') || localStorage.getItem('tipo');
  return tipo === 'Admin';
});

const excluirRespostaDefinitiva = async (dados) => {
  if (confirm(`ATENÇÃO: Deseja EXCLUIR DEFINITIVAMENTE o feedback da empresa ${dados.empresa}? \n\nEsta ação apagará a nota e QUALQUER PLANO DE AÇÃO que esteja nos Planos de Ação vinculado a ela. Esta ação não pode ser desfeita.`)) {
    try {
      await api.delete(`/respostas/${dados.resposta_id}`);
      toast.add({ severity: 'success', summary: 'Excluído', detail: 'Feedback e ações apagados permanentemente.', life: 4000 });
      carregarRespostas(); 
    } catch (error) {
      toast.add({ severity: 'error', summary: 'Acesso Negado', detail: error.response?.data?.detail || 'Apenas Administradores podem realizar esta ação.', life: 4000 });
    }
  }
};

onMounted(async () => {
  await carregarCombos(); 
  carregarRespostas();
  carregarClientesParaDropdown();
});
</script>

<template>
  <div class="max-w-[1600px] mx-auto animate-fadein p-4">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
      <div>
        <h1 class="text-4xl font-black text-slate-800 dark:text-white tracking-tight italic">
          Auditoria de Feedbacks <span class="text-orange-500">.</span>
        </h1>
        <p class="text-[12px] text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-widest">
          Categorização e Enriquecimento Qualitativo (Retorno ao Cliente)
        </p>
    </div> <div class="flex items-center gap-3 shrink-0">
        
        <Button 
          label="Inserir Resposta" 
          icon="pi pi-plus" 
          @click="abrirModalNovaResposta" 
          class="!bg-orange-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-5 !py-3 shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform" 
        />

        <Button 
          icon="pi pi-refresh" 
          @click="carregarRespostas" 
          :loading="loading" 
          v-tooltip.top="'Sincronizar Dados'" 
          class="w-11 h-11 !bg-white dark:!bg-slate-900 !text-slate-500 hover:!text-orange-500 dark:hover:!text-orange-400 !border !border-slate-200 dark:!border-slate-700 !rounded-xl shadow-sm transition-all flex items-center justify-center" 
        />
        
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fadein">

      <div class="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Filtrado</span>
          <div class="text-2xl font-black text-slate-800 dark:text-white mt-1">{{ metricasAtuais.total }}</div>
        </div>
        <div class="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><i class="pi pi-list"></i></div>
      </div>
      <div class="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-[1.5rem] border border-emerald-100 dark:border-emerald-800/30 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Promotores</span>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-500 mt-1">{{ metricasAtuais.promotores }}</div>
        </div>
        <div class="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-500"><i class="pi pi-arrow-up-right"></i></div>
      </div>
      <div class="bg-rose-50 dark:bg-rose-500/10 p-5 rounded-[1.5rem] border border-rose-100 dark:border-rose-800/30 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">Detratores</span>
          <div class="text-2xl font-black text-rose-600 dark:text-rose-500 mt-1">{{ metricasAtuais.detratores }}</div>
        </div>
        <div class="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-rose-500"><i class="pi pi-arrow-down-right"></i></div>
      </div>
      <div class="bg-slate-900 dark:bg-white p-5 rounded-[1.5rem] shadow-xl relative overflow-hidden flex items-center justify-between group">
        <div class="absolute -right-6 -top-6 w-20 h-20 bg-orange-500/20 rounded-full blur-xl group-hover:bg-orange-500/40 transition-all"></div>
        <div class="relative z-10">
          <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">NPS (Visão Atual)</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-3xl font-black text-white dark:text-slate-900 tracking-tighter">{{ metricasAtuais.nps }}</span>
            <span class="text-orange-500 font-black text-xs">pts</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-900 p-4 md:p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden mb-6 flex flex-col gap-4 no-print">
          
      <div class="absolute left-0 top-0 w-1.5 h-full bg-orange-500"></div>
      
      <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pl-2 md:pl-3">
        
        <div class="md:col-span-4 flex flex-col gap-1">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <i class="pi pi-search text-[8px]"></i> Pesquisa
          </span>
          <InputText v-model="filtros.q" placeholder="Buscar por nome, e-mail ou comentário..." class="custom-minimal-element w-full" />
        </div>

        <div class="md:col-span-3 flex flex-col gap-1 md:border-l border-slate-100 dark:border-slate-800 md:pl-4">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <i class="pi pi-clock text-[8px]"></i> Referência
          </span>
          <Dropdown v-model="filtros.tipo_data" :options="opcoesTipoData" optionLabel="label" optionValue="value" class="custom-minimal-element w-full" @change="carregarRespostas" />
        </div>

        <div class="md:col-span-3 flex flex-col gap-1 md:border-l border-slate-100 dark:border-slate-800 md:pl-4 group">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between w-full">
            <span class="flex items-center gap-1.5">
              <i class="pi pi-calendar text-[8px]"></i> Período
            </span>
            <i v-if="datasFiltro && datasFiltro[1]" class="pi pi-times text-slate-300 hover:text-rose-500 cursor-pointer transition-colors" @click="datasFiltro = null" v-tooltip.top="'Limpar Filtro'"></i>
          </span>
          <Calendar v-model="datasFiltro" selectionMode="range" :manualInput="false" placeholder="Selecione o período..." dateFormat="dd/mm/yy" class="custom-minimal-element w-full" :showIcon="false" @hide="carregarRespostas" />
        </div>

        <div class="md:col-span-2 flex items-center md:justify-end md:border-l border-slate-100 dark:border-slate-800 md:pl-4 h-[38px]">
          <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl w-full md:w-auto justify-center border border-slate-100 dark:border-slate-700/50 hover:border-orange-500/30 transition-colors">
            <InputSwitch v-model="filtros.incluir_excluidas" inputId="toggle_arquivados" />
            <label for="toggle_arquivados" class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              Arquivados
            </label>
          </div>
        </div>

      </div>

      <div class="h-px w-full bg-slate-50 dark:bg-slate-800/60 my-1 ml-2"></div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center pl-2 md:pl-3">
        
        <div class="flex flex-col gap-1 pr-2">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <i class="pi pi-sitemap text-[8px]"></i> Grupo
          </span>
          <Dropdown v-model="filtros.companhia" :options="opcoesCompanhia" class="custom-minimal-element w-full" @change="carregarRespostas" />
        </div>
        
        <div class="flex flex-col gap-1 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-4">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <i class="pi pi-building text-[8px]"></i> Empresa
          </span>
          <Dropdown v-model="filtros.empresa" :options="opcoesEmpresa" filter placeholder="Todas" class="custom-minimal-element w-full" @change="carregarRespostas" />
        </div>

        <div class="flex flex-col gap-1 lg:border-l border-slate-100 dark:border-slate-800 lg:pl-4 pt-2 sm:pt-0">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <i class="pi pi-tag text-[8px]"></i> Categoria
          </span>
          <Dropdown v-model="filtros.categoria" :options="opcoesCategoria" class="custom-minimal-element w-full" @change="carregarRespostas" />
        </div>

        <div class="flex flex-col gap-1 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-4 pt-2 sm:pt-0">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
            <i class="pi pi-user text-[8px]"></i> Perfil
          </span>
          <Dropdown v-model="filtros.perfil" :options="opcoesPerfil" class="custom-minimal-element w-full" @change="carregarRespostas" />
        </div>

      </div>

    </div>

    <div class="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-6">
      
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="flex gap-4 p-4 border-b border-slate-50 dark:border-slate-800">
          <Skeleton shape="circle" size="3rem" class="shrink-0"></Skeleton>
          <div class="flex-1 space-y-2">
            <Skeleton width="20%"></Skeleton>
            <Skeleton width="80%"></Skeleton>
            <Skeleton width="60%"></Skeleton>
          </div>
        </div>
      </div>

      <DataTable v-else :value="respostasFiltradas" :paginator="true" :rows="10" dataKey="resposta_id" class="p-datatable-custom" rowHover>
        <template #empty>
          <div class="text-center py-20">
            <i class="pi pi-inbox text-4xl text-slate-300 mb-4 block"></i>
            <span class="text-xs font-black uppercase tracking-widest text-slate-400">Caixa Limpa. Nenhum feedback encontrado.</span>
          </div>
        </template>

        <Column field="nota" header="Score" style="width: 140px">
          <template #body="s">
            <div class="flex items-center">
              
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-lg z-10 relative shrink-0', obterCorNPS(s.data.nota)]">
                {{ s.data.nota }}
              </div>
              
              <div v-if="s.data.nota_anterior !== null && s.data.nota_anterior !== undefined && s.data.nota_anterior !== ''" 
                   class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 rounded-r-lg border border-l-0 border-slate-100 dark:border-slate-700 -ml-2 pl-4"
                   v-tooltip.top="'Nota Anterior'">
                   
                <i v-if="s.data.nota > s.data.nota_anterior" class="pi pi-arrow-up text-emerald-500 text-[9px] font-black"></i>
                <i v-else-if="s.data.nota < s.data.nota_anterior" class="pi pi-arrow-down text-rose-500 text-[9px] font-black"></i>
                <i v-else class="pi pi-minus text-slate-400 text-[9px] font-black"></i>
                
                <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {{ s.data.nota_anterior }}
                </span>
              </div>
              
              <div v-else class="flex items-center bg-sky-50 dark:bg-sky-500/10 px-2 py-1.5 rounded-r-lg border border-l-0 border-sky-100 dark:border-sky-500/20 -ml-2 pl-4" v-tooltip.top="'Primeira avaliação deste cliente'">
                <span class="text-[8px] font-black text-sky-500 uppercase tracking-widest">New</span>
              </div>

            </div>
          </template>
        </Column>

        <Column field="acao_vinculada" header="Ação" sortable>
          <template #body="slotProps">
            <Tag v-if="slotProps.data.acao_vinculada" 
                @click="irParaAcao(slotProps.data.acao_vinculada)"
                severity="warning" 
                :value="'Ação #' + String(slotProps.data.acao_vinculada).padStart(3, '0')" 
                class="cursor-pointer hover:scale-110 hover:!bg-orange-200 dark:hover:!bg-orange-500/40 transition-all !bg-orange-100 dark:!bg-orange-500/20 !text-orange-600 dark:!text-orange-400 !font-black !text-[10px] !px-3 shadow-sm border border-orange-200 dark:border-orange-500/30" 
                v-tooltip.top="'Abrir esta Ação nos Planos de Ação'" />
            
            <span v-else class="text-slate-300 dark:text-slate-700 font-bold text-xs">-</span>
          </template>
        </Column>

        <Column field="cliente_nome" header="Autoria" style="min-width: 220px">
          <template #body="s">
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="text-[12px] font-bold text-slate-800 dark:text-slate-100" :class="{'line-through text-slate-400': s.data.excluido}">
                  {{ s.data.cliente_nome || s.data.nome || 'Usuário Anônimo' }}
                </span>
                <i v-if="s.data.perfil_decisor === 'Decisor' || s.data.perfil_cliente === 'Decisor'" class="pi pi-star-fill text-yellow-500 text-[10px]" v-tooltip.top="'Decisor'"></i>
              </div>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{{ s.data.empresa || 'Sem Empresa' }}</span>
            </div>
          </template>
        </Column>

        <Column field="motivo" header="Comentário & Contexto" style="min-width: 350px">
          <template #body="s">
            <div class="py-2">
              <p class="text-[12px] text-slate-600 dark:text-slate-300 font-medium italic leading-relaxed mb-2" :class="{'opacity-50 line-through': s.data.excluido}">
                "{{ s.data.motivo || 'Nenhum comentário textual deixado.' }}"
              </p>
              
              <div class="flex flex-wrap gap-2 items-center">
                <Tag v-if="s.data.categoria" :value="s.data.categoria" severity="secondary" 
                    class="!bg-slate-100 dark:!bg-slate-800 !text-slate-500 !text-[8px] !font-black !px-2 uppercase tracking-widest border border-slate-200 dark:border-slate-700" />
                
                <Tag v-if="s.data.perfil_cliente" :value="s.data.perfil_cliente" 
                    icon="pi pi-user"
                    class="!bg-blue-50 dark:!bg-blue-900/20 !text-blue-600 dark:!text-blue-400 !text-[8px] !font-black !px-2 uppercase tracking-widest border border-blue-100 dark:border-blue-800/50" />

                <span v-if="s.data.excluido" 
                      class="text-[9px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md">
                  <i class="pi pi-folder"></i> Arquivado
                </span>
              </div>
            </div>
          </template>
        </Column>

        <Column field="canal" header="Canal" sortable>
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <i :class="[
                'pi text-[10px]',
                data.canal === 'Manual' ? 'pi-user-edit text-orange-500' : 
                data.canal === 'WhatsApp' ? 'pi-whatsapp text-emerald-500' : 
                data.canal === 'Telefone' ? 'pi-phone text-indigo-500' : 
                'pi-envelope text-sky-500'
              ]"></i>
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {{ data.canal || 'E-mail' }}
              </span>
            </div>
          </template>
        </Column>

        <Column header="Cronologia" class="min-w-[160px]">
          <template #body="{ data }">
            <div class="flex flex-col gap-1.5 py-1">
              
              <div class="flex items-center gap-2">
                <i class="pi pi-comment text-[10px] text-orange-500"></i>
                <span class="text-[11px] font-bold text-slate-700 dark:text-white">
                  {{ tratarData(data.data_resposta) || 'Sem data' }}
                </span>
              </div>

              <div class="flex items-center gap-2 opacity-50 ml-0.5">
                <i class="pi pi-database text-[9px]"></i>
                <span class="text-[9px] uppercase tracking-widest font-medium">
                  {{ tratarData(data.created_at) || '-' }}
                </span>
              </div>
              
            </div>
          </template>
        </Column>

        <Column header="Auditoria" alignFrozen="right" style="width: 170px">
          <template #body="s">
            <div class="flex gap-2 justify-end items-center">
              
              <Button icon="pi pi-sliders-h" label="Analisar" @click="abrirEdicao(s.data)" class="!bg-slate-50 dark:!bg-slate-800 !text-slate-600 dark:!text-slate-300 !border-none !text-[9px] !font-black !px-3 hover:!bg-slate-200 dark:hover:!bg-slate-700 transition-colors uppercase tracking-widest" />
              
              <Button :icon="s.data.excluido ? 'pi pi-undo' : 'pi pi-folder'" 
                      v-tooltip.top="s.data.excluido ? 'Desarquivar (Restaurar)' : 'Arquivar'" 
                      @click="alternarEstadoArquivo(s.data)" 
                      class="w-8 h-8 !p-0 flex items-center justify-center !text-slate-400 !bg-transparent !border-none hover:!bg-slate-100 dark:hover:!bg-slate-800 transition-colors rounded-lg shrink-0"
                      :class="{'!text-rose-400 hover:!text-rose-600': !s.data.excluido, '!text-emerald-500 hover:!text-emerald-600': s.data.excluido}" />

              <Button v-if="isAdmin" 
                      icon="pi pi-trash" 
                      v-tooltip.top="'Excluir Permanentemente'" 
                      @click="excluirRespostaDefinitiva(s.data)" 
                      class="w-8 h-8 !p-0 flex items-center justify-center !text-rose-300 !bg-transparent !border-none hover:!bg-rose-50 hover:!text-rose-600 dark:hover:!bg-rose-500/10 transition-colors rounded-lg shrink-0" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="dialogEdicao" :modal="true" :style="{width: '650px'}" :closable="false" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog-no-header shadow-2xl">
      <div class="bg-slate-900 text-white p-6 flex justify-between items-center relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl"></div>
        <div class="relative z-10">
          <h2 class="text-lg font-black italic tracking-tight flex items-center gap-2">
            <i class="pi pi-clipboard text-orange-500"></i> Enriquecimento Qualitativo
          </h2>
          <p class="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-bold">Retorno ao Cliente Tracker</p>
        </div>
        <button @click="dialogEdicao = false" class="text-slate-400 hover:text-white transition-colors relative z-10 p-2"><i class="pi pi-times text-xl"></i></button>
      </div>

      <div class="p-8 space-y-6 bg-white dark:bg-slate-900">
        
        <div class="grid grid-cols-2 gap-6">
          <div class="flex flex-col gap-2">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Revisão de Nota</label>
            <Dropdown v-model="respostaAtual.nota" :options="[0,1,2,3,4,5,6,7,8,9,10]" class="custom-dropdown !bg-slate-50 dark:!bg-slate-800" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Classificação (Tag)</label>
            <InputText v-model="respostaAtual.categoria" class="custom-input !bg-slate-50 dark:!bg-slate-800 !py-2.5 !text-xs" placeholder="Ex: UX, Preço..." />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Comentário Original (Voice of Customer)</label>
          <Button label="Criar Plano de Ação" icon="pi pi-bolt" @click="abrirNovaAcao" class="w-full !bg-orange-50 dark:!bg-orange-500/10 !text-orange-600 !border !border-orange-200 dark:!border-orange-500/30 !rounded-xl !py-3 !font-black !text-[10px] uppercase tracking-widest hover:!bg-orange-100 transition-colors mt-2" />
          <Textarea v-model="respostaAtual.motivo" rows="3" class="custom-input !bg-slate-50 dark:!bg-slate-800 !text-xs italic" />
        </div>

        <div class="p-6 bg-orange-50/50 dark:bg-orange-900/10 rounded-[2rem] border border-orange-100/50 dark:border-orange-800/30 space-y-5">
          <div class="flex items-center gap-2 mb-2">
            <i class="pi pi-sparkles text-orange-500 text-sm"></i>
            <h4 class="text-[10px] font-black uppercase tracking-widest text-orange-600 dark:text-orange-400">Análise Raiz</h4>
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-[9px] font-black uppercase text-slate-500 ml-1">O que faltava ao cliente?</label>
            <InputText v-model="respostaAtual.o_que_faltava" class="custom-input bg-white dark:bg-slate-900 !py-2.5 !text-xs border-orange-100 dark:border-slate-700" placeholder="Insira o ponto de falha..." />
          </div>
          
          <div class="flex flex-col gap-2">
            <label class="text-[9px] font-black uppercase text-slate-500 ml-1">Alinhamento de Expectativas</label>
            <InputText v-model="respostaAtual.expectativas" class="custom-input bg-white dark:bg-slate-900 !py-2.5 !text-xs border-orange-100 dark:border-slate-700" placeholder="Como resolver no futuro..." />
          </div>
        </div>

      </div>
      
      <div class="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-4 w-full">
        <Button label="Cancelar" text class="flex-1 font-black text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors" @click="dialogEdicao = false" />
        <Button label="Salvar Auditoria" :loading="salvando" icon="pi pi-save" class="flex-1 bg-slate-900 dark:bg-white dark:text-slate-900 border-none rounded-xl font-black text-[11px] uppercase tracking-widest text-white shadow-xl hover:-translate-y-0.5 transition-transform" @click="salvarResposta" />
      </div>
    </Dialog>

    <Dialog v-model:visible="dialogNovaAcao" :modal="true" :style="{width: '450px'}" :closable="false" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog-no-header shadow-2xl">
      <div class="bg-gradient-to-r from-orange-500 to-rose-500 text-white p-6 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-black italic tracking-tight"><i class="pi pi-bolt mr-2"></i> Delegar Ação</h2>
          <p class="text-[10px] text-orange-100 uppercase tracking-widest mt-1 font-bold">Plano de Ação</p>
        </div>
        <button @click="dialogNovaAcao = false" class="text-white/70 hover:text-white transition-colors p-2"><i class="pi pi-times text-xl"></i></button>
      </div>

      <div class="p-8 space-y-4 bg-white dark:bg-slate-900">
        
        <div class="flex flex-col gap-1.5">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Empresa Vinculada</label>
          <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <i class="pi pi-building text-orange-500"></i>
            {{ respostaAtual.empresa || 'Empresa não identificada' }}
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Título da Tarefa *</label>
          <InputText v-model="novaAcaoForm.titulo" class="custom-input !py-2.5 !text-xs" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Atribuir Responsável</label>
          <Dropdown 
            v-model="novaAcaoForm.gestor_id" 
            :options="gestoresLista" 
            optionLabel="nome" 
            optionValue="id" 
            placeholder="Selecione um responsável..." 
            class="custom-dropdown w-full" 
            filter 
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Prioridade</label>
          <Dropdown v-model="novaAcaoForm.prioridade" :options="['Alta', 'Média', 'Baixa']" class="custom-dropdown w-full" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Instruções / Contexto</label>
          <Textarea v-model="novaAcaoForm.descricao" rows="5" class="custom-input !text-[11px]" />
        </div>
      </div>
      
      <div class="p-6 bg-slate-50 dark:bg-slate-900/50 flex gap-4 w-full border-t border-slate-100 dark:border-slate-800">
        <Button label="Cancelar" text class="flex-1 font-black text-[11px] uppercase tracking-widest text-slate-400" @click="dialogNovaAcao = false" />
        <Button label="Criar Tarefa" :loading="salvandoAcao" icon="pi pi-check" class="flex-1 bg-orange-500 border-none rounded-xl font-black text-[11px] uppercase tracking-widest text-white shadow-xl hover:-translate-y-0.5 transition-transform" @click="criarPlanoAcao" />
      </div>
    </Dialog>

    <Dialog v-model:visible="modalNovaResposta" header="Inserir Resposta Manual" :modal="true" class="custom-dialog w-[95vw] sm:w-[500px]">
      <div class="p-2 space-y-5">
        
        <Dropdown 
          v-model="formResposta.cliente_id" 
          :options="clientesDropdown" 
          optionLabel="nome" 
          optionValue="cliente_id" 
          filter 
          placeholder="Selecione o Cliente..." 
          class="custom-input !py-1 w-full"
        >
          <template #option="slotProps">
            <div class="flex flex-col">
              <span class="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">
                {{ slotProps.option.nome }}
              </span>
              <span class="text-[9px] font-bold text-slate-400">
                {{ slotProps.option.empresa }}
              </span>
            </div>
          </template>
        </Dropdown>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Nota NPS (0 a 10)</label>
            <Dropdown 
              v-model="formResposta.nota" 
              :options="[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" 
              placeholder="Nota..." 
              class="custom-input !py-1 w-full font-black text-center text-lg" 
            />
          </div>
          
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Canal de Origem</label>
            <Dropdown v-model="formResposta.canal" :options="['Manual', 'WhatsApp', 'Telefone', 'E-mail', 'Reunião']" class="custom-input !py-1 w-full" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Feedback / Motivo principal</label>
          <Textarea v-model="formResposta.motivo" rows="4" class="custom-input !py-3 w-full resize-none" placeholder="O que o cliente disse?" />
        </div>

      </div>
      <template #footer>
        <div class="flex justify-end gap-3 mt-4">
          <Button label="Cancelar" icon="pi pi-times" @click="modalNovaResposta = false" class="!bg-transparent !text-slate-500 !border-none !text-[10px] !font-black !uppercase tracking-widest" />
          <Button label="Salvar Resposta" icon="pi pi-check" :loading="salvandoResposta" @click="salvarRespostaManual" class="!bg-orange-500 !text-white !border-none !rounded-xl !text-[10px] !font-black !uppercase tracking-widest !px-6 py-3 shadow-lg hover:scale-105 transition-transform" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";

.animate-fadein { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

/* ==========================================
   🌟 FILTROS ESTILO DASHBOARD (Barra de Topo)
   ========================================== */

/* Força transparência absoluta nos elementos de filtro */
:deep(.custom-minimal-element),
:deep(.custom-minimal-element.p-inputtext),
:deep(.custom-minimal-element .p-inputtext) {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    color: inherit !important;
    @apply text-[10px] font-black uppercase text-slate-800 dark:text-white w-full outline-none ring-0;
}

/* Cor dos Placeholders na barra */
:deep(.custom-minimal-element::placeholder),
:deep(.custom-minimal-element .p-inputtext::placeholder) {
    @apply text-slate-300 dark:text-slate-600 font-black !important;
}

/* Blindagem contra os fundos de hover/focus do PrimeVue */
:deep(.p-inputtext:enabled:focus),
:deep(.p-inputtext:enabled:hover),
:deep(.p-dropdown:not(.p-disabled):focus),
:deep(.p-dropdown:not(.p-disabled):hover) {
    background-color: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
}

/* Alinhamento do Dropdown na barra */
:deep(.custom-minimal-element.p-dropdown .p-dropdown-label) {
    @apply p-0 font-black flex items-center text-[10px] uppercase text-slate-800 dark:text-white !important;
}
:deep(.custom-minimal-element.p-dropdown .p-dropdown-trigger) {
    @apply w-4 text-slate-400 !important;
}

/* Menu de opções flutuante (Laranja para a aba de Respostas) */
:deep(.p-dropdown-panel) {
    @apply dark:bg-slate-800 dark:border-slate-700 shadow-xl !important;
}
:deep(.p-dropdown-panel .p-dropdown-item) {
    @apply text-xs font-medium text-slate-600 dark:text-slate-300 !important;
}
:deep(.p-dropdown-panel .p-dropdown-item.p-highlight) {
    @apply bg-orange-500/10 text-orange-600 dark:text-orange-400 !important;
}

/* ==========================================
   📝 INPUTS DO MODAL (Enriquecimento Qualitativo)
   ========================================== */

:deep(.custom-input), :deep(.custom-dropdown) {
  @apply bg-white dark:bg-slate-800 
         border-slate-200 dark:border-slate-700 
         p-4 rounded-xl outline-none 
         focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 
         transition-all font-medium text-slate-700 dark:text-slate-200;
}

:deep(.custom-dropdown .p-dropdown-label) { 
  @apply py-1 !important; 
}

/* ==========================================
   📊 CUSTOMIZAÇÃO DA TABELA (Cores Sólidas)
   ========================================== */

:deep(.p-datatable .p-datatable-thead > tr > th) {
  @apply bg-slate-50 dark:bg-slate-900 
         text-[10px] font-black uppercase tracking-widest text-slate-400 
         border-b border-slate-100 dark:border-slate-800 py-6 px-4;
}

:deep(.p-datatable .p-datatable-tbody > tr) {
  @apply bg-white dark:bg-slate-900 
         text-slate-600 dark:text-slate-300
         transition-colors border-b border-slate-50 dark:border-slate-800/50;
}

:deep(.p-datatable .p-datatable-tbody > tr:hover) {
  @apply bg-slate-50/80 dark:bg-slate-800/40 !important;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
  @apply py-5 px-4;
}

/* ==========================================
   🪟 CUSTOMIZAÇÃO DO DIALOG
   ========================================== */

:deep(.custom-dialog-no-header .p-dialog-header) {
  display: none !important;
}

:deep(.custom-dialog-no-header .p-dialog-content) {
  padding: 0 !important;
  @apply dark:bg-slate-900;
}

/* ==========================================
   🌙 MENU DO CALENDÁRIO (DATEPICKER)
   ========================================== */
:deep(.p-datepicker) {
  @apply dark:bg-slate-800 dark:border-slate-700 shadow-2xl !important;
}
:deep(.p-datepicker table td > span) {
  @apply text-xs font-medium dark:text-slate-300 !important;
}
:deep(.p-datepicker table td > span.p-highlight) {
  @apply bg-orange-500/10 text-orange-600 dark:text-orange-400 !important;
}
:deep(.p-datepicker table td > span:not(.p-highlight):not(.p-disabled):hover) {
  @apply bg-slate-100 dark:bg-slate-700/50 !important;
}
</style>