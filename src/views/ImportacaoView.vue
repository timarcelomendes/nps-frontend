<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../services/api';
import { useToast } from 'primevue/usetoast';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputSwitch from 'primevue/inputswitch';
import MultiSelect from 'primevue/multiselect';

const toast = useToast();

// --- ESTADOS DO WIZARD ---
const passoAtual = ref(1); 
const tipoImportacao = ref('clientes'); // 'clientes' | 'respostas'
const fileInput = ref(null);
const ficheiroSelecionado = ref(null);
const isProcessando = ref(false);
const progresso = ref(0);

// --- ESTADOS DE DADOS & CHAVES DINÂMICAS ---
const dadosPreview = ref([]);
const colunasDisponiveis = ref([]); 
const chavesCliente = ref([]); 
const chavesResposta = ref([]); 
const configuracaoImportacao = ref({ overwrite: true });
const ignorarErros = ref(false);
const resumoFinal = ref(null);
const companhiasDisponiveis = ref([]);
const companhiaSelecionada = ref(null);

// ==========================================
// 📥 CARREGAR DADOS INICIAIS
// ==========================================
onMounted(async () => {
  try {
    const response = await api.get('/cadastros/companhias');
    companhiasDisponiveis.value = response.data || [];
  } catch (error) {
    console.error("Erro ao carregar companhias:", error);
    toast.add({ severity: 'error', summary: 'Erro de Conexão', detail: 'Não foi possível carregar as companhias.' });
  }
});

// ==========================================
// 📥 DOWNLOAD DO TEMPLATE DINÂMICO
// ==========================================
const baixarTemplate = () => {
  let cabecalhos, exemplo, nomeArquivo;

  if (tipoImportacao.value === 'clientes') {
    cabecalhos = ['nome', 'email', 'empresa', 'perfil_decisor', 'segmento', 'telefone', 'cargo', 'valor_contrato', 'ativo', 'ultimo_envio'];
    exemplo = ['Marcelo Mendes', 'marcelo@empresa.com', 'Distribuidora Exemplo', 'Decisor', 'Tecnologia', '+55 11 99999-0000', 'Product Manager', '50000', 'True', '2026-01-01'];
    nomeArquivo = 'template_clientes_nps.csv';
  } else {
    cabecalhos = ['email', 'empresa', 'data_resposta', 'nota', 'comentario', 'perfil_decisor', 'segmento'];
    exemplo = ['marcelo@empresa.com', 'Distribuidora Exemplo', '2026-03-15', '10', 'Excelente serviço!', 'Decisor', 'Tecnologia'];
    nomeArquivo = 'template_respostas_nps.csv';
  }

  const csvContent = [
    cabecalhos.join(','),
    exemplo.join(',')
  ].join('\n');

  // \uFEFF é o BOM UTF-8. Garante que o Excel em PT-BR/PT-PT lê os acentos perfeitamente!
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ==========================================
// 🛡️ VALIDAÇÃO DINÂMICA ROBUSTA
// ==========================================
const getMotivoErro = (row) => {
  if (row.detalhe) return row.detalhe;
  if (row.tipo_pendencia) return 'Pendência: ' + row.tipo_pendencia;

  if (tipoImportacao.value === 'clientes') {
    if (!row.email || String(row.email).trim() === '') return "Email ausente (Obrigatório)";
    if (!row.nome || String(row.nome).trim() === '') return "Nome ausente (Obrigatório)";
    if (!row.empresa || String(row.empresa).trim() === '') return "Empresa não vinculada";
  } 
  else if (tipoImportacao.value === 'respostas') {
    if (!row.email || String(row.email).trim() === '') return "Email ausente (Obrigatório)";
    if (!row.empresa || String(row.empresa).trim() === '') return "Empresa não vinculada";
    
    if (row.nota === null || row.nota === undefined || String(row.nota).trim() === '') return "Nota NPS ausente";
    
    const notaNum = Number(row.nota);
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) return "A nota deve ser um número entre 0 e 10";
    
    if (!row.data_resposta || String(row.data_resposta).trim() === '') return "Data de resposta ausente";
  }

  const chavesSelecionadas = tipoImportacao.value === 'clientes' 
    ? chavesCliente.value || []
    : [...(chavesCliente.value || []), ...(chavesResposta.value || [])];

  if (chavesSelecionadas.length > 0) {
    const chavesFaltando = chavesSelecionadas.filter(chave => {
      const valor = row[chave];
      return valor === null || valor === undefined || String(valor).trim() === '';
    });
    
    if (chavesFaltando.length > 0) {
      return `Falta preencher: ${chavesFaltando.join(', ')}`;
    }
  }

  return null;
};

const isRegistroValido = (row) => getMotivoErro(row) === null;

const mostrarApenasInvalidos = ref(false);
const registrosComErro = computed(() => dadosPreview.value.filter(row => !isRegistroValido(row)));
const errosCount = computed(() => registrosComErro.value.length);
const prontosCount = computed(() => dadosPreview.value.length - errosCount.value);

const dadosFiltrados = computed(() => {
  if (mostrarApenasInvalidos.value) return registrosComErro.value;
  return dadosPreview.value;
});

const rowClass = (data) => isRegistroValido(data) ? '' : '!bg-rose-50/50 dark:!bg-rose-500/5';

// ==========================================
// 🔄 PROCESSAMENTO DO ARQUIVO
// ==========================================
const triggerFileInput = () => { fileInput.value.click(); };

const processarFicheiro = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  ficheiroSelecionado.value = file;
  isProcessando.value = true;
  progresso.value = 30;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post('/importar/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    dadosPreview.value = response.data;
    if (dadosPreview.value.length > 0) {
      colunasDisponiveis.value = Object.keys(dadosPreview.value[0]).filter(k => k !== 'tipo_pendencia' && k !== 'detalhe');
    }
    
    progresso.value = 100;
    setTimeout(() => { passoAtual.value = 2; isProcessando.value = false; }, 500);

  } catch (error) {
    console.error("Erro na pré-visualização:", error);
    toast.add({ severity: 'error', summary: 'Erro de Leitura', detail: 'Não foi possível ler o arquivo. Verifique se o formato está correto (XLSX ou CSV).' });
    isProcessando.value = false;
  } finally {
    event.target.value = ''; 
  }
};

// ==========================================
// 🚀 ENVIO FINAL PARA O BACKEND
// ==========================================
const enviarParaBackend = async () => {
  if (errosCount.value > 0 && !ignorarErros.value) {
    toast.add({ severity: 'warn', summary: 'Ação Necessária', detail: `Existem ${errosCount.value} registros com erro. Corrija-os no arquivo ou ative a opção para os ignorar.`, life: 5000 });
    return;
  }

  const dadosFinais = ignorarErros.value 
    ? dadosPreview.value.filter(row => isRegistroValido(row)) 
    : dadosPreview.value;

  if (dadosFinais.length === 0) {
    toast.add({ severity: 'error', summary: 'Operação Abortada', detail: 'Não existem registros válidos para importar.' });
    return;
  }

  isProcessando.value = true;
  progresso.value = 20;

  try {
    const payload = {
      tipo: tipoImportacao.value,
      dados: dadosFinais,
      chaves_cliente: chavesCliente.value, 
      chaves_resposta: tipoImportacao.value === 'respostas' ? chavesResposta.value : [],
      
      companhia_id: companhiaSelecionada.value,
      configuracao: {
        overwrite: configuracaoImportacao.value.overwrite,
        companhia_id: companhiaSelecionada.value 
      }
    };

    progresso.value = 60;
    const response = await api.post('/importar/processar', payload);

    progresso.value = 100;
    resumoFinal.value = {
        inseridos: response.data.inseridos || dadosFinais.length,
        erros: response.data.erros || 0,
        detalhes: response.data.detalhes || []
    };
    
    setTimeout(() => { passoAtual.value = 3; isProcessando.value = false; }, 600);
    toast.add({ severity: 'success', summary: 'Importação Concluída', detail: 'Os dados foram gravados na plataforma com sucesso!' });

  } catch (error) {
    console.error("Erro na importação:", error);
    toast.add({ severity: 'error', summary: 'Falha no Servidor', detail: error.response?.data?.detail || 'Ocorreu um erro crítico ao salvar as informações na base de dados.' });
    isProcessando.value = false;
  }
};

const reiniciar = () => {
  passoAtual.value = 1;
  ficheiroSelecionado.value = null;
  dadosPreview.value = [];
  colunasDisponiveis.value = [];
  chavesCliente.value = [];
  chavesResposta.value = [];
  resumoFinal.value = null;
  ignorarErros.value = false;
  mostrarApenasInvalidos.value = false;
  companhiaSelecionada.value = null; 
  if (fileInput.value) fileInput.value.value = '';
};
</script>

<template>
  <div class="max-w-[1400px] mx-auto animate-fadein p-4 lg:p-8">
    
    <div class="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-black text-slate-800 dark:text-white tracking-tight italic">
          Importação de Dados <span class="text-orange-500">.</span>
        </h1>
        <p class="text-[12px] text-slate-500 font-medium mt-1">Carregamento robusto de Clientes e Respostas NPS.</p>
      </div>
    </div>

    <div v-if="passoAtual === 1" class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
      
      <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white mb-4">1. O que deseja importar?</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div 
          @click="tipoImportacao = 'clientes'"
          :class="['p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all', tipoImportacao === 'clientes' ? 'border-orange-500 bg-orange-50/30 dark:bg-orange-500/10 shadow-md ring-4 ring-orange-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-orange-300 bg-white dark:bg-slate-900']"
        >
          <div class="flex items-center gap-4 mb-3">
             <div :class="['w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 transition-colors', tipoImportacao === 'clientes' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500']"><i class="pi pi-users"></i></div>
             <div>
               <h3 class="font-black text-slate-800 dark:text-white text-lg">Base de Clientes</h3>
               <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Contatos e Empresas</p>
             </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Importe ou atualize perfis, emails, empresas, cargos, segmentos e telefones de todos os seus clientes.</p>
        </div>

        <div 
          @click="tipoImportacao = 'respostas'"
          :class="['p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all', tipoImportacao === 'respostas' ? 'border-sky-500 bg-sky-50/30 dark:bg-sky-500/10 shadow-md ring-4 ring-sky-500/10' : 'border-slate-100 dark:border-slate-800 hover:border-sky-300 bg-white dark:bg-slate-900']"
        >
          <div class="flex items-center gap-4 mb-3">
             <div :class="['w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 transition-colors', tipoImportacao === 'respostas' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500']"><i class="pi pi-star-fill"></i></div>
             <div>
               <h3 class="font-black text-slate-800 dark:text-white text-lg">Respostas NPS</h3>
               <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Histórico de Pesquisas</p>
             </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Importe o histórico de notas (0 a 10), comentários de feedback e as datas exatas das respostas.</p>
        </div>
      </div>

      <hr class="border-slate-100 dark:border-slate-800 mb-8" />

      <div class="flex flex-col md:flex-row gap-8 items-stretch">
        <div class="flex-1 flex flex-col justify-center">
          <div :class="['p-6 rounded-2xl border mb-4', tipoImportacao === 'clientes' ? 'bg-orange-50/50 border-orange-100' : 'bg-sky-50/50 border-sky-100']">
            <h4 :class="['text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-2', tipoImportacao === 'clientes' ? 'text-orange-600' : 'text-sky-600']">
              <i class="pi pi-file-excel"></i> Template Obrigatório
            </h4>
            <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Para evitar erros nas colunas e garantir uma validação perfeita, utilize sempre a nossa estrutura base.
            </p>
            <Button label="Baixar Arquivo Base (CSV)" icon="pi pi-download" class="!bg-white dark:!bg-slate-800 !text-slate-700 dark:!text-white !border !border-slate-200 dark:!border-slate-700 !rounded-xl !text-[10px] !font-black !uppercase !tracking-widest !px-5 shadow-sm" @click="baixarTemplate" />
          </div>
        </div>

        <div class="flex-[2]">
          <input type="file" ref="fileInput" accept=".csv, .xlsx, .xls" class="hidden" @change="processarFicheiro" />
          
          <div @click="!isProcessando && triggerFileInput()" :class="['border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center text-center transition-all h-full min-h-[250px]', isProcessando ? 'border-orange-500 bg-orange-50/50' : 'border-slate-200 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50/30 cursor-pointer']">
            
            <div v-if="isProcessando" class="w-full max-w-xs flex flex-col items-center">
              <i class="pi pi-spin pi-spinner text-4xl text-orange-500 mb-4"></i>
              <span class="text-sm font-bold text-slate-700 dark:text-white mb-3">Analisando arquivo na nuvem...</span>
              <ProgressBar :value="progresso" :showValue="false" class="h-1.5 w-full bg-orange-100 rounded-full" />
            </div>

            <div v-else class="flex flex-col items-center">
              <div class="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform"><i class="pi pi-cloud-upload text-2xl"></i></div>
              <h3 class="text-base font-black text-slate-800 dark:text-white mb-2">Clique para anexar o seu arquivo</h3>
              <p class="text-xs text-slate-500 font-medium">Suporta .CSV e .XLSX</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="passoAtual === 2" class="space-y-6">
      
      <div class="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <h3 class="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2 mb-2">
          <i class="pi pi-key text-orange-500"></i> Chaves de Atualização
        </h3>
        <p class="text-[11px] text-slate-500 mb-6 font-medium">Defina como o sistema deve identificar se um registro já existe para evitar dados duplicados.</p>
        
        <div class="max-w-xl space-y-5">
          
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              {{ tipoImportacao === 'clientes' ? 'Identificadores de Clientes' : 'Vincular Resposta ao Cliente por:' }}
            </label>
            <MultiSelect v-model="chavesCliente" :options="colunasDisponiveis" placeholder="Recomendado: email" display="chip" class="custom-input w-full" />
          </div>
          
          <div v-if="tipoImportacao === 'respostas'" class="flex flex-col gap-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Identificadores da Resposta (Para evitar duplicatas)
            </label>
            <MultiSelect v-model="chavesResposta" :options="colunasDisponiveis" placeholder="Recomendado: data_resposta" display="chip" class="custom-input w-full" />
          </div>

        </div>
      </div>

      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mt-10 mb-6">
        <div class="flex gap-4">
          <div class="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-5 py-4 rounded-[1.25rem] flex items-center gap-4 min-w-[160px] shadow-sm">
             <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 shrink-0"><i class="pi pi-check text-xl"></i></div>
             <div>
                <div class="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 mb-0.5">Prontos</div>
                <div class="text-2xl font-black text-emerald-600 leading-none">{{ prontosCount }}</div>
             </div>
          </div>

          <div class="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 px-5 py-4 rounded-[1.25rem] flex items-center gap-4 min-w-[160px] shadow-sm transition-all" :class="errosCount > 0 ? 'animate-pulse ring-2 ring-rose-500/20' : 'opacity-50 grayscale'">
             <div class="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 shrink-0"><i class="pi pi-exclamation-triangle text-xl"></i></div>
             <div>
                <div class="text-[9px] font-black uppercase tracking-widest text-rose-600/70 mb-0.5">Erros Detectados</div>
                <div class="text-2xl font-black text-rose-600 leading-none">{{ errosCount }}</div>
             </div>
          </div>
        </div>
        
        <div v-if="errosCount > 0" class="flex items-center gap-3 bg-white dark:bg-slate-800 p-2.5 pr-4 rounded-[1.25rem] border border-slate-200 shadow-sm cursor-pointer hover:border-rose-300 transition-colors" @click="mostrarApenasInvalidos = !mostrarApenasInvalidos">
           <InputSwitch v-model="mostrarApenasInvalidos" class="pointer-events-none" />
           <span class="text-[10px] font-black uppercase tracking-widest transition-colors" :class="mostrarApenasInvalidos ? 'text-rose-500' : 'text-slate-500'">Ver apenas {{ errosCount }} erros</span>
        </div>
      </div>

      <DataTable :value="dadosFiltrados" :paginator="true" :rows="10" :rowClass="rowClass" class="p-datatable-sm custom-table border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm" responsiveLayout="scroll">
        <template #empty>
           <div class="text-center py-16 text-emerald-500 text-[11px] uppercase tracking-widest font-black flex flex-col items-center justify-center">
             <div class="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4"><i class="pi pi-check-circle text-3xl"></i></div>
             <span v-if="mostrarApenasInvalidos">Todos os registros estão perfeitos! Nenhum erro encontrado.</span>
             <span v-else>Nenhum dado carregado.</span>
           </div>
        </template>

        <Column v-for="col of colunasDisponiveis" :key="col" :field="col" :header="col" style="min-width: 200px;">
           <template #body="sp">
             <div class="truncate max-w-[200px] cursor-default" v-tooltip.top="sp.data[col]">
               <span class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ sp.data[col] || '---' }}</span>
             </div>
           </template>
        </Column>

        <Column header="Validação Extrema" alignFrozen="right" :frozen="true" style="min-width: 320px;" class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-l border-slate-100 shadow-[-10px_0_15px_rgba(0,0,0,0.02)]">
          <template #body="slotProps">
            <div v-if="isRegistroValido(slotProps.data)" class="flex items-center gap-2">
              <i class="pi pi-check text-emerald-500 font-bold"></i>
              <span class="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Válido para Base de {{ tipoImportacao === 'clientes' ? 'Clientes' : 'Respostas' }}</span>
            </div>
            <div v-else class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5">
                 <div class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                 <span class="text-[9px] font-black uppercase tracking-widest text-rose-500">Bloqueado</span>
              </div>
              <span class="text-[10px] font-bold text-slate-500 leading-relaxed pr-2">{{ getMotivoErro(slotProps.data) }}</span>
            </div>
          </template>
        </Column>
      </DataTable>

      <div class="bg-slate-50 dark:bg-slate-800/40 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 mt-8 mb-8">
        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><i class="pi pi-cog"></i> Execução e Segurança</h4>
        
        <div class="flex flex-col gap-6">
          
          <div class="flex flex-col gap-2 pb-6 border-b border-slate-200 dark:border-slate-700/50">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Vincular a um Grupo (Opcional)</label>
            <Dropdown 
              v-model="companhiaSelecionada" 
              :options="companhiasDisponiveis" 
              optionLabel="nome" 
              optionValue="id" 
              placeholder="Selecione um Grupo" 
              filter
              showClear
              class="custom-input w-full md:max-w-md !p-1" 
            />
            <span class="text-[10px] font-medium text-slate-400 ml-1">Todas as empresas deste arquivo serão associadas a este Grupo.</span>
          </div>

          <div class="flex items-center justify-between group">
            <div class="flex flex-col pr-4">
              <span class="text-sm font-bold text-slate-800 dark:text-white">Atualizar registros já existentes</span>
              <span class="text-[11px] text-slate-500 mt-1 leading-relaxed">Substitui as informações antigas no banco de dados pelos dados novos deste arquivo, baseando-se nas Chaves de Atualização.</span>
            </div>
            <InputSwitch v-model="configuracaoImportacao.overwrite" class="shrink-0" />
          </div>

          <div v-if="errosCount > 0" class="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700/50">
            <div class="flex flex-col pr-4">
              <span class="text-sm font-bold text-rose-600 flex items-center gap-2"><i class="pi pi-shield"></i> Forçar importação ignorando erros</span>
              <span class="text-[11px] text-slate-500 mt-1 leading-relaxed">Descarta os <span class="font-black text-rose-500">{{ errosCount }} bloqueados</span> e envia apenas os <span class="font-black text-emerald-500">{{ prontosCount }} prontos</span>.</span>
            </div>
            <InputSwitch v-model="ignorarErros" class="shrink-0" />
          </div>

        </div>
      </div>

      <div class="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button label="Voltar" icon="pi pi-arrow-left" text class="!text-slate-500 !font-black !uppercase !text-[10px] tracking-widest" @click="reiniciar" />
        <Button label="Executar Importação" icon="pi pi-cloud-upload" :loading="isProcessando" class="!bg-orange-500 hover:!bg-orange-600 !text-white !border-none !rounded-xl !px-8 !py-4 !font-black !uppercase !text-[10px] tracking-widest shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-all" @click="enviarParaBackend" />
      </div>
    </div>

    <div v-else-if="passoAtual === 3" class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-12 text-center shadow-sm">
      <div class="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm"><i class="pi pi-check-circle"></i></div>
      <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-2">Importação Concluída!</h2>
      <p class="text-slate-500 mb-8 font-medium">Operação finalizada com sucesso na base de {{ tipoImportacao === 'clientes' ? 'Clientes' : 'Respostas' }}.</p>
      
      <div class="max-w-md mx-auto bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-left border border-slate-100 dark:border-slate-700 mb-8">
        <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Relatório do Servidor</h3>
        <div class="space-y-3">
          
          <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">Linhas Processadas com Sucesso</span>
            <span class="text-lg font-black text-emerald-500">{{ resumoFinal?.inseridos || 0 }}</span>
          </div>
          
          <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-700">
            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">Falhas e Descartações</span>
            <span class="text-lg font-black text-rose-500">{{ resumoFinal?.erros || 0 }}</span>
          </div>

          <div v-if="resumoFinal.detalhes && resumoFinal.detalhes.length > 0" class="pt-4">
            <h3 class="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-3">Detalhes dos Registros Não Importados</h3>
            <div class="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
              <ul class="flex flex-col gap-2">
                <li v-for="(erro, index) in resumoFinal.detalhes" :key="index" class="text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <i class="pi pi-times-circle text-rose-500 mt-[3px]"></i>
                  <span><strong class="text-slate-800 dark:text-slate-200">{{ erro.email }}:</strong> {{ erro.motivo }}</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      <Button label="Iniciar Nova Importação" icon="pi pi-refresh" class="!bg-slate-800 hover:!bg-slate-700 !text-white !border-none !rounded-xl !px-8 !py-4 !font-black !uppercase !text-[10px] tracking-widest" @click="reiniciar" />
    </div>

  </div>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";

.animate-fadein { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

:deep(.p-progressbar-value) { @apply bg-orange-500 transition-all duration-300; }
:deep(.custom-input) { @apply bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 outline-none focus:ring-2 focus:ring-orange-500/20 transition-all font-medium text-slate-800 dark:text-white; }
:deep(.custom-table), :deep(.custom-table .p-datatable-wrapper) { @apply bg-white dark:bg-slate-900; }
:deep(.custom-table .p-datatable-thead > tr > th) { @apply bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 py-5 px-4; }
:deep(.custom-table .p-datatable-tbody > tr) { @apply border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors; }
:deep(.custom-table .p-datatable-tbody > tr > td) { @apply py-4 px-4; }

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { @apply bg-slate-200 dark:bg-slate-700 rounded-full; }
</style>