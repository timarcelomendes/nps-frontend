<script setup>
// Importação de planilha: baixar modelo → enviar planilha → conferir prévia → importar.
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import MultiSelect from 'primevue/multiselect';
import api from '../services/api';
import PassosImportacao from '../components/importacao/PassosImportacao.vue';
import ResultadoImportacao from '../components/importacao/ResultadoImportacao.vue';
import { MODELOS, baixarModelo, problemasDaLinha, normalizarLinha } from '../components/importacao/validacao';

const router = useRouter();

// ---------- Etapas ----------
const passo = ref(1);                 // 1 = escolher e enviar, 2 = conferir, 3 = pronto
const tipo = ref('clientes');         // 'clientes' | 'respostas'
const modeloBaixado = ref(false);
const passoVisual = computed(() => passo.value === 1 ? (modeloBaixado.value ? 2 : 1) : passo.value === 2 ? 3 : 5);
const modelo = computed(() => MODELOS[tipo.value]);

const TIPOS = [
  { valor: 'clientes', titulo: 'Clientes e contatos', texto: 'Quem vai receber as pesquisas: nome, e-mail, empresa, cargo e telefone.', icone: 'pi-users' },
  { valor: 'respostas', titulo: 'Respostas antigas', texto: 'Notas de 0 a 10 e comentários de pesquisas que você já fez fora da Rakiti.', icone: 'pi-star' },
];

const escolherTipo = (valor) => { tipo.value = valor; modeloBaixado.value = false; };
const baixar = () => { baixarModelo(tipo.value); modeloBaixado.value = true; };

// ---------- Leitura do arquivo ----------
const fileInput = ref(null);
const arquivo = ref(null);
const lendo = ref(false);
const erroLeitura = ref('');
const arrastando = ref(false);

const dados = ref([]);
const colunas = ref([]);
const chavesCliente = ref([]);
const chavesResposta = ref([]);

const escolherArquivo = () => { if (!lendo.value) fileInput.value?.click(); };

const lerArquivo = async (file) => {
  if (!file) return;
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    erroLeitura.value = 'Esse tipo de arquivo não serve. Envie uma planilha do Excel (.xlsx ou .xls) ou um arquivo .csv.';
    return;
  }
  arquivo.value = file;
  erroLeitura.value = '';
  lendo.value = true;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const r = await api.post('/importar/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    const linhas = Array.isArray(r.data) ? r.data : [];
    if (!linhas.length) {
      erroLeitura.value = 'A planilha está vazia. Preencha a partir da segunda linha, abaixo dos nomes das colunas.';
      return;
    }
    dados.value = linhas;
    colunas.value = Object.keys(linhas[0]).filter(k => k !== 'tipo_pendencia' && k !== 'detalhe');
    chavesCliente.value = colunas.value.includes('email') ? ['email'] : [];
    chavesResposta.value = tipo.value === 'respostas' && colunas.value.includes('data_resposta') ? ['data_resposta'] : [];
    mostrarSoProblemas.value = false;
    ignorarErros.value = false;
    erroImportacao.value = null;
    passo.value = 2;
  } catch (error) {
    const detalhe = error?.response?.data?.detail;
    erroLeitura.value = 'Não conseguimos ler esse arquivo. Salve de novo como .xlsx ou .csv a partir do modelo e tente outra vez.'
      + (typeof detalhe === 'string' && detalhe ? ` (${detalhe.replace(/^Erro ao ler arquivo:\s*/, '')})` : '');
  } finally {
    lendo.value = false;
  }
};

const aoEscolherArquivo = (event) => { lerArquivo(event.target.files[0]); event.target.value = ''; };
const aoSoltar = (event) => { arrastando.value = false; lerArquivo(event.dataTransfer?.files?.[0]); };

// ---------- Conferência ----------
const mostrarSoProblemas = ref(false);
const ignorarErros = ref(false);
const overwrite = ref(true);
const companhias = ref([]);
const companhia = ref(null);
const opcoesAvancadas = ref(false);

onMounted(async () => {
  try { const r = await api.get('/cadastros/companhias'); companhias.value = r.data || []; } catch (e) { /* grupos são opcionais */ }
});

const chavesUsadas = computed(() => tipo.value === 'clientes' ? chavesCliente.value : [...chavesCliente.value, ...chavesResposta.value]);
const linhas = computed(() => dados.value.map((row, i) => ({ row, numero: i + 2, problemas: problemasDaLinha(row, tipo.value, chavesUsadas.value) })));
const comProblema = computed(() => linhas.value.filter(l => l.problemas.length));
const prontas = computed(() => linhas.value.filter(l => !l.problemas.length));
const linhasVisiveis = computed(() => mostrarSoProblemas.value ? comProblema.value : linhas.value);
const colunasFaltando = computed(() => modelo.value.obrigatorias.filter(c => !colunas.value.includes(c)));
const colunasIgnoradas = computed(() => colunas.value.filter(c => !modelo.value.colunas.some(m => m.nome === c)));

const linhasParaEnviar = computed(() => (ignorarErros.value ? prontas.value : linhas.value).map(l => normalizarLinha(l.row, tipo.value)));
const bloqueio = computed(() => {
  if (!chavesCliente.value.length) return 'Escolha em "Opções avançadas" a coluna usada para reconhecer quem já está cadastrado (recomendado: email).';
  if (comProblema.value.length && !ignorarErros.value) return 'Corrija as linhas com problema na planilha e envie de novo, ou marque "Importar só as linhas sem problema".';
  if (!linhasParaEnviar.value.length) return 'Nenhuma linha está pronta para importar.';
  return '';
});
const rotuloImportar = computed(() => {
  const n = comProblema.value.length && !ignorarErros.value ? prontas.value.length : linhasParaEnviar.value.length;
  return tipo.value === 'clientes' ? `Importar ${n} ${n === 1 ? 'contato' : 'contatos'}` : `Importar ${n} ${n === 1 ? 'resposta' : 'respostas'}`;
});

// ---------- Importar ----------
const importando = ref(false);
const erroImportacao = ref(null);   // { texto, plano }
const resumo = ref(null);
const areaErro = ref(null);

const importar = async () => {
  if (bloqueio.value) return;
  const enviados = linhasParaEnviar.value;
  importando.value = true;
  erroImportacao.value = null;
  try {
    const r = await api.post('/importar/processar', {
      tipo: tipo.value,
      dados: enviados,
      chaves_cliente: chavesCliente.value,
      chaves_resposta: tipo.value === 'respostas' ? chavesResposta.value : [],
      companhia_id: companhia.value,
      configuracao: { overwrite: overwrite.value, companhia_id: companhia.value },
    });
    const processados = Number(r.data?.inseridos ?? 0);
    // O servidor informa novos e atualizados separadamente
    const novos = r.data?.novos ?? null;
    const atualizados = r.data?.atualizados ?? null;
    resumo.value = {
      processados, novos, atualizados,
      naoImportados: Number(r.data?.erros ?? 0),
      descartados: ignorarErros.value ? comProblema.value.length : 0,
      detalhes: Array.isArray(r.data?.detalhes) ? r.data.detalhes : [],
    };
    passo.value = 3;
  } catch (error) {
    const detalhe = error?.response?.data?.detail;
    const texto = typeof detalhe === 'string' ? detalhe : '';
    if (error?.response?.status === 402 || texto.includes('Limite do plano atingido')) {
      erroImportacao.value = { plano: true, texto: texto || 'Seu plano chegou ao limite de clientes ativos.' };
    } else {
      erroImportacao.value = { plano: false, texto: texto && texto.length < 200 ? texto : 'Não conseguimos salvar a planilha agora. Nada foi importado; tente de novo em instantes.' };
    }
    await nextTick();
    areaErro.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    importando.value = false;
  }
};

const reiniciar = () => {
  passo.value = 1;
  arquivo.value = null;
  dados.value = [];
  colunas.value = [];
  chavesCliente.value = [];
  chavesResposta.value = [];
  resumo.value = null;
  ignorarErros.value = false;
  mostrarSoProblemas.value = false;
  companhia.value = null;
  erroImportacao.value = null;
  erroLeitura.value = '';
};
</script>

<template>
  <div class="max-w-5xl mx-auto flex flex-col gap-6 pb-24">
    <header>
      <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Importação<span class="text-orange-500">.</span></h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Traga seus clientes de uma planilha do Excel em poucos minutos.</p>
    </header>

    <PassosImportacao :atual="passoVisual" />

    <!-- 1 e 2: escolher, baixar modelo e enviar -->
    <template v-if="passo === 1">
      <section class="imp-cartao">
        <h2 class="imp-titulo">O que você vai importar?</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Tipo de importação">
          <button v-for="t in TIPOS" :key="t.valor" type="button" role="radio" :aria-checked="tipo === t.valor" @click="escolherTipo(t.valor)"
            class="text-left flex gap-3 p-4 rounded-xl border-2 transition-colors"
            :class="tipo === t.valor ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-500/40'">
            <span :class="['w-10 h-10 rounded-full flex items-center justify-center shrink-0', tipo === t.valor ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400']"><i :class="['pi', t.icone]"></i></span>
            <span class="min-w-0">
              <span class="block font-semibold text-slate-900 dark:text-white">{{ t.titulo }}</span>
              <span class="block text-sm text-slate-600 dark:text-slate-300 mt-0.5">{{ t.texto }}</span>
            </span>
          </button>
        </div>
      </section>

      <section class="imp-cartao">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 class="imp-titulo"><span class="imp-numero-passo">1</span>Baixe o modelo e preencha</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">Abra no Excel, apague os exemplos e cole seus dados a partir da segunda linha. Não mude os nomes da primeira linha.</p>
          </div>
          <button @click="baixar" class="imp-btn-secundario shrink-0" :class="modeloBaixado ? '' : 'border-orange-300! text-orange-700! dark:text-orange-300!'">
            <i :class="['pi text-xs', modeloBaixado ? 'pi-check' : 'pi-download']"></i>{{ modeloBaixado ? 'Modelo baixado' : 'Baixar modelo' }}
          </button>
        </div>
        <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <tr><th class="text-left font-semibold px-3 py-2">Coluna</th><th class="text-left font-semibold px-3 py-2">O que colocar</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="c in modelo.colunas" :key="c.nome">
                <td class="px-3 py-2 align-top whitespace-nowrap">
                  <code class="text-slate-800 dark:text-slate-100">{{ c.nome }}</code>
                  <span v-if="modelo.obrigatorias.includes(c.nome)" class="ml-2 text-xs font-semibold text-orange-700 dark:text-orange-300">obrigatória</span>
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300">{{ c.explicacao }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="imp-cartao">
        <h2 class="imp-titulo"><span class="imp-numero-passo">2</span>Envie a planilha preenchida</h2>
        <input type="file" ref="fileInput" accept=".csv,.xlsx,.xls" class="hidden" @change="aoEscolherArquivo" />
        <button type="button" @click="escolherArquivo" @dragover.prevent="arrastando = true" @dragleave.prevent="arrastando = false" @drop.prevent="aoSoltar" :disabled="lendo"
          class="mt-3 w-full border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center transition-colors"
          :class="arrastando || lendo ? 'border-orange-400 bg-orange-50/60 dark:bg-orange-500/10' : 'border-slate-300 dark:border-slate-700 hover:border-orange-400 hover:bg-orange-50/40 dark:hover:bg-orange-500/5'">
          <template v-if="lendo">
            <i class="pi pi-spin pi-spinner text-2xl text-orange-500"></i>
            <span class="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Lendo {{ arquivo?.name }}...</span>
          </template>
          <template v-else>
            <span class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"><i class="pi pi-upload text-lg"></i></span>
            <span class="mt-3 text-base font-semibold text-slate-900 dark:text-white">Clique para escolher a planilha</span>
            <span class="text-sm text-slate-500 dark:text-slate-400 mt-1">ou arraste o arquivo para cá · .xlsx, .xls ou .csv</span>
          </template>
        </button>
        <p v-if="erroLeitura" role="alert" class="mt-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3 flex gap-2">
          <i class="pi pi-times-circle mt-0.5 shrink-0"></i><span>{{ erroLeitura }}</span>
        </p>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">Nada é gravado agora: primeiro você confere a prévia.</p>
      </section>
    </template>

    <!-- 3: conferir -->
    <template v-else-if="passo === 2">
      <section class="imp-cartao flex flex-col gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="imp-titulo">Confira antes de importar</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1 break-all">
              <i class="pi pi-file text-xs mr-1"></i>{{ arquivo?.name }} · {{ linhas.length }} {{ linhas.length === 1 ? 'linha' : 'linhas' }}
            </p>
          </div>
          <button @click="reiniciar" class="imp-btn-secundario shrink-0"><i class="pi pi-arrow-left text-xs"></i>Trocar arquivo</button>
        </div>

        <div v-if="colunasFaltando.length" role="alert" class="text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-500/10 rounded-xl p-3">
          <p class="font-semibold">Faltam colunas na planilha: {{ colunasFaltando.map(c => `"${c}"`).join(', ') }}</p>
          <p class="mt-1">Confira se a primeira linha tem os nomes exatamente como no modelo<span v-if="tipo === 'respostas'"> e se você escolheu "Respostas antigas" de propósito</span>.</p>
        </div>
        <p v-if="colunasIgnoradas.length" class="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          Estas colunas não fazem parte do modelo e serão ignoradas: {{ colunasIgnoradas.join(', ') }}.
        </p>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p class="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2"><i class="pi pi-check-circle text-emerald-500"></i>Prontas</p>
            <p class="text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-1">{{ prontas.length }}</p>
          </div>
          <button type="button" @click="comProblema.length && (mostrarSoProblemas = !mostrarSoProblemas)" :aria-pressed="mostrarSoProblemas" :disabled="!comProblema.length"
            class="text-left rounded-xl border p-4 transition-colors disabled:cursor-default"
            :class="mostrarSoProblemas ? 'border-orange-400 ring-2 ring-orange-500/20' : comProblema.length ? 'border-slate-200 dark:border-slate-800 hover:border-orange-300' : 'border-slate-200 dark:border-slate-800'">
            <span class="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2"><i :class="['pi pi-exclamation-triangle', comProblema.length ? 'text-rose-500' : 'text-slate-400']"></i>Com problema</span>
            <span class="block text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-1">{{ comProblema.length }}</span>
            <span v-if="comProblema.length" class="block text-sm text-orange-700 dark:text-orange-300">{{ mostrarSoProblemas ? 'Mostrar todas' : 'Ver só essas' }}</span>
          </button>
        </div>

        <DataTable :value="linhasVisiveis" :paginator="linhasVisiveis.length > 10" :rows="10" dataKey="numero" class="imp-tabela" scrollable>
          <template #empty><p class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma linha com problema.</p></template>
          <Column header="Linha" style="width: 70px">
            <template #body="{ data }"><span class="tabular-nums text-slate-500 dark:text-slate-400">{{ data.numero }}</span></template>
          </Column>
          <Column header="Situação" style="min-width: 240px">
            <template #body="{ data }">
              <span v-if="!data.problemas.length" class="imp-tag imp-tag-ok"><i class="pi pi-check text-xs"></i>Pronta</span>
              <ul v-else class="flex flex-col gap-1">
                <li v-for="p in data.problemas" :key="p" class="flex gap-1.5 text-rose-700 dark:text-rose-300"><i class="pi pi-times-circle text-xs mt-1 shrink-0"></i><span>{{ p }}</span></li>
              </ul>
            </template>
          </Column>
          <Column v-for="col in colunas" :key="col" :header="col" style="min-width: 150px">
            <template #body="{ data }">
              <span class="block max-w-[220px] truncate" :title="String(data.row[col] ?? '')" :class="data.row[col] === '' || data.row[col] == null ? 'text-slate-400' : ''">{{ data.row[col] === '' || data.row[col] == null ? '—' : data.row[col] }}</span>
            </template>
          </Column>
        </DataTable>
      </section>

      <section class="imp-cartao flex flex-col gap-5">
        <h2 class="imp-titulo">Como importar</h2>

        <label v-if="comProblema.length" class="flex items-start justify-between gap-4 cursor-pointer">
          <span>
            <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">Importar só as linhas sem problema</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ comProblema.length }} {{ comProblema.length === 1 ? 'linha fica' : 'linhas ficam' }} de fora; você pode corrigir e importar depois.</span>
          </span>
          <InputSwitch v-model="ignorarErros" class="imp-switch shrink-0" ariaLabel="Importar só as linhas sem problema" />
        </label>

        <label class="flex items-start justify-between gap-4 cursor-pointer">
          <span>
            <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">Atualizar quem já está cadastrado</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {{ overwrite ? 'Os dados da planilha substituem os antigos.' : 'Quem já existe fica como está; só entram os novos.' }}
            </span>
          </span>
          <InputSwitch v-model="overwrite" class="imp-switch shrink-0" ariaLabel="Atualizar quem já está cadastrado" />
        </label>

        <div v-if="companhias.length" class="imp-campo">
          <label for="imp-grupo">Grupo das empresas (opcional)</label>
          <Dropdown inputId="imp-grupo" v-model="companhia" :options="companhias" optionLabel="nome" optionValue="id" placeholder="Sem grupo" filter showClear class="w-full sm:max-w-md" panelClass="imp-painel" />
          <small class="text-sm text-slate-500 dark:text-slate-400">Todas as empresas desta planilha entram nesse grupo.</small>
        </div>

        <div>
          <button type="button" @click="opcoesAvancadas = !opcoesAvancadas" :aria-expanded="opcoesAvancadas" class="imp-link inline-flex items-center gap-1">
            <i :class="['pi text-xs', opcoesAvancadas ? 'pi-chevron-up' : 'pi-chevron-down']"></i>Opções avançadas
          </button>
          <div v-if="opcoesAvancadas" class="mt-3 flex flex-col gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <div class="imp-campo">
              <label>{{ tipo === 'clientes' ? 'Reconhecer quem já está cadastrado pela coluna' : 'Encontrar o contato de cada resposta pela coluna' }}</label>
              <MultiSelect v-model="chavesCliente" :options="colunas" placeholder="Escolha (recomendado: email)" display="chip" class="w-full" panelClass="imp-painel" />
              <small class="text-sm text-slate-500 dark:text-slate-400">Recomendado: email. Assim a mesma pessoa não é cadastrada duas vezes.</small>
            </div>
            <div v-if="tipo === 'respostas'" class="imp-campo">
              <label>Reconhecer respostas repetidas pela coluna</label>
              <MultiSelect v-model="chavesResposta" :options="colunas" placeholder="Escolha (recomendado: data_resposta)" display="chip" class="w-full" panelClass="imp-painel" />
              <small class="text-sm text-slate-500 dark:text-slate-400">Se o mesmo contato já tiver resposta nessa data, ela é atualizada em vez de duplicada.</small>
            </div>
          </div>
        </div>

        <div v-if="erroImportacao" ref="areaErro" role="alert"
          class="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10">
          <i :class="['pi text-rose-600 dark:text-rose-400', erroImportacao.plano ? 'pi-lock' : 'pi-times-circle']"></i>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-rose-800 dark:text-rose-200">{{ erroImportacao.plano ? 'Seu plano chegou ao limite' : 'A importação não foi feita' }}</p>
            <p class="text-sm text-rose-700 dark:text-rose-300 mt-0.5">{{ erroImportacao.texto }}</p>
          </div>
          <button v-if="erroImportacao.plano" @click="router.push('/assinatura')" class="imp-btn-primario shrink-0"><i class="pi pi-wallet text-xs"></i>Ver planos</button>
        </div>

        <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ bloqueio }}</p>
          <button @click="importar" :disabled="!!bloqueio || importando" class="imp-btn-primario shrink-0">
            <i :class="['pi text-xs', importando ? 'pi-spin pi-spinner' : 'pi-check']"></i>{{ importando ? 'Importando...' : rotuloImportar }}
          </button>
        </div>
      </section>
    </template>

    <!-- 4: pronto -->
    <ResultadoImportacao v-else-if="resumo" :tipo="tipo" :resumo="resumo" @reiniciar="reiniciar" />
  </div>
</template>

<style scoped>
@reference "../style.css";

.imp-cartao { @apply bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-6 min-w-0; }
.imp-titulo { @apply flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white; }
.imp-numero-passo { @apply w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold inline-flex items-center justify-center shrink-0; }

:deep(.imp-tabela) { @apply bg-transparent! rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden; font-family: inherit; }
:deep(.imp-tabela .p-datatable-wrapper) { @apply overflow-x-auto; }
:deep(.imp-tabela .p-datatable-thead > tr > th) { @apply bg-slate-50! dark:bg-slate-800! text-xs! font-semibold! text-slate-500! dark:text-slate-400! border-slate-100! dark:border-slate-800! py-3! px-3! whitespace-nowrap; }
:deep(.imp-tabela .p-datatable-tbody > tr) { @apply bg-white! dark:bg-slate-900! text-slate-700! dark:text-slate-200!; }
:deep(.imp-tabela .p-datatable-tbody > tr > td) { @apply py-2.5! px-3! text-sm border-slate-100! dark:border-slate-800! align-top; }
:deep(.imp-tabela .p-paginator) { @apply bg-transparent! border-0! border-t! border-slate-100! dark:border-slate-800! text-sm; }
:deep(.imp-tabela .p-paginator .p-paginator-page.p-highlight) { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
:deep(.imp-tabela .p-paginator button) { @apply dark:text-slate-400!; }
</style>

<style>
@reference "../style.css";
/* Globais com prefixo imp-: valem também no resumo final e nos painéis do Dropdown/MultiSelect (abertos fora da página) */
.imp-btn-primario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap; }
.imp-btn-secundario { @apply inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-orange-300 hover:text-orange-700 dark:hover:text-orange-300 transition-colors whitespace-nowrap; }
.imp-link { @apply text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline; }
.imp-tag { @apply inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap; }
.imp-tag-ok { @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300; }
.imp-numero { @apply rounded-xl border border-slate-200 dark:border-slate-800 p-4; }
.imp-numero dt { @apply text-sm font-semibold text-slate-600 dark:text-slate-300; }
.imp-numero dd { @apply text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-1; }
.imp-switch.p-inputswitch.p-highlight .p-inputswitch-slider { @apply bg-orange-500!; }
.imp-switch.p-inputswitch:not(.p-highlight) .p-inputswitch-slider { @apply dark:bg-slate-700!; }

.imp-campo { @apply flex flex-col gap-1.5 min-w-0; }
.imp-campo > label { @apply text-sm font-semibold text-slate-700 dark:text-slate-200; }
.imp-campo .p-dropdown,
.imp-campo .p-multiselect { @apply rounded-xl! border-slate-300! dark:border-slate-700! bg-white! dark:bg-slate-950! text-sm!; }
.imp-campo .p-dropdown .p-dropdown-label,
.imp-campo .p-multiselect .p-multiselect-label { @apply text-sm! text-slate-800! dark:text-slate-100!; }
.imp-campo .p-placeholder { @apply text-slate-400!; }
.imp-campo .p-inputtext, .imp-painel .p-inputtext, .imp-painel li { font-family: inherit; }
.imp-campo .p-dropdown-trigger, .imp-campo .p-multiselect-trigger { @apply text-slate-400!; }
.imp-campo .p-multiselect-token { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300! text-sm!; }
.imp-campo .p-dropdown:not(.p-disabled).p-focus,
.imp-campo .p-multiselect:not(.p-disabled).p-focus { @apply border-orange-400! shadow-none! ring-2 ring-orange-500/20; }
.imp-painel { @apply dark:bg-slate-900! dark:border-slate-700!; }
.imp-painel .p-dropdown-item, .imp-painel .p-multiselect-item { @apply text-sm! dark:text-slate-200!; }
.imp-painel .p-dropdown-item.p-highlight, .imp-painel .p-multiselect-item.p-highlight { @apply bg-orange-50! text-orange-700! dark:bg-orange-500/15! dark:text-orange-300!; }
.imp-painel .p-dropdown-header, .imp-painel .p-multiselect-header { @apply dark:bg-slate-900! dark:border-slate-700!; }
.imp-painel .p-inputtext { @apply dark:bg-slate-950! dark:text-slate-100! dark:border-slate-700!; }
.imp-painel .p-checkbox .p-checkbox-box.p-highlight { @apply border-orange-500! bg-orange-500!; }
</style>
