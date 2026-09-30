<script setup>
// Aba Pesquisa: envio automático, formulário, frequência, lembretes e prazos para tratar as respostas.
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import InputSwitch from 'primevue/inputswitch';
import InputNumber from 'primevue/inputnumber';
import MultiSelect from 'primevue/multiselect';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig } from './useConfiguracoes';

const emit = defineEmits(['ir']);
const router = useRouter();
const cfg = useConfig();
const r = cfg.regras; // ref

// ---------- Envio automático ----------
const fila = ref(null);
const carregarFila = async () => {
  try {
    const total = parseInt((await api.get('/config/nps/elegiveis')).data?.total, 10);
    fila.value = Number.isNaN(total) ? 0 : total;
  } catch (e) { fila.value = null; }
};
const alternarAutomatico = (valor) => cfg.salvarCampoRegra('robo_ativo', valor, {
  titulo: valor ? 'Envio automático ligado' : 'Envio automático desligado',
  texto: valor ? 'As pesquisas saem sozinhas para quem estiver no prazo.' : 'Nenhuma pesquisa sai sozinha até você ligar de novo.',
});
const podeEnviarAgora = computed(() => r.value?.robo_ativo && cfg.email.value.envios_ativos);
const disparando = ref(false);
const enviarFilaAgora = async () => {
  disparando.value = true;
  try {
    await api.post('/config/nps/forcar-disparo');
    cfg.ok('Envio iniciado', 'As pesquisas estão saindo agora. Acompanhe em Envios.');
    setTimeout(carregarFila, 3000);
  } catch (e) {
    cfg.erro(e, 'Não foi possível iniciar o envio', 'Tente novamente em alguns segundos.');
  } finally {
    disparando.value = false;
  }
};

// ---------- Formulário ----------
const camposExterno = [
  { label: 'Código do cliente', value: 'clienteId' }, { label: 'E-mail', value: 'email' },
  { label: 'Nome', value: 'nome' }, { label: 'Empresa', value: 'empresa' },
  { label: 'Código da empresa', value: 'empresa_id' }, { label: 'Responsável', value: 'gestor' }, { label: 'Segmento', value: 'segmento' },
];

// ---------- Lembretes ----------
const numeros = [1, 2, 3];
const lembretesAlterados = computed(() => {
  const a = r.value, b = cfg.regrasBase.value;
  return !!a && !!b && ['lembrete_qtd_maxima', 'lembrete_dias_1', 'lembrete_dias_2', 'lembrete_dias_3'].some((c) => a[c] !== b[c]);
});
const motivoLembretesParados = computed(() => {
  const p = cfg.previaLembretes.value;
  if (!p || p.ativo) return '';
  if (!p.qtd_maxima) return 'Lembretes desligados.';
  return 'Os e-mails estão pausados na aba E-mail, então nenhum lembrete sai.';
});
const executandoLembretes = ref(false);
const enviarLembretesAgora = async () => {
  const n = cfg.previaLembretes.value?.pendentes_agora || 0;
  if (!confirm(`Enviar agora ${n} lembrete${n === 1 ? '' : 's'} para quem ainda não respondeu?`)) return;
  executandoLembretes.value = true;
  try {
    const { data } = await api.post('/lembretes/executar');
    const enviados = data?.enviados || 0;
    if (enviados) cfg.ok('Lembretes enviados', `${enviados} lembrete${enviados === 1 ? '' : 's'} enviado${enviados === 1 ? '' : 's'}.`);
    else cfg.aviso('Nenhum lembrete enviado', 'Não havia lembrete no prazo ou o envio de e-mails não está pronto.');
    await cfg.carregarPreviaLembretes();
  } catch (e) {
    cfg.erro(e, 'Não foi possível enviar os lembretes', 'Tente novamente em alguns segundos.');
  } finally {
    executandoLembretes.value = false;
  }
};

const PRAZOS = [
  { campo: 'sla_detrator_dias', titulo: 'Notas baixas (0 a 6)', texto: 'Cliente insatisfeito: trate primeiro.', cor: 'bg-rose-500', texto_cor: 'text-rose-700 dark:text-rose-300' },
  { campo: 'sla_neutro_dias', titulo: 'Notas médias (7 e 8)', texto: 'Cliente neutro: vale entender o que falta.', cor: 'bg-amber-400', texto_cor: 'text-amber-700 dark:text-amber-300' },
  { campo: 'sla_promotor_dias', titulo: 'Notas altas (9 e 10)', texto: 'Cliente satisfeito: agradeça e mantenha.', cor: 'bg-emerald-500', texto_cor: 'text-emerald-700 dark:text-emerald-300' },
];

onMounted(() => { carregarFila(); cfg.carregarPreviaLembretes(); });
</script>

<template>
  <div v-if="r" class="flex flex-col gap-5">
    <!-- Envio automático -->
    <CfgSecao titulo="Envio automático das pesquisas" icone="pi-send" selo="essencial"
      descricao="Quando ligado, a Rakiti verifica a sua lista a cada 6 horas e envia a pesquisa para quem estiver no prazo.">
      <div class="flex flex-col lg:flex-row lg:items-center gap-4">
        <label class="flex items-center gap-3 flex-1 cursor-pointer">
          <InputSwitch :modelValue="r.robo_ativo" @update:modelValue="alternarAutomatico" class="cfg-switch" inputId="cfg-robo" />
          <span>
            <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">{{ r.robo_ativo ? 'Ligado' : 'Desligado' }}</span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">{{ r.robo_ativo ? 'As pesquisas saem sozinhas.' : 'Nenhuma pesquisa sai sozinha.' }} Salva na hora.</span>
          </span>
        </label>
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            <b class="text-2xl font-black text-slate-900 dark:text-white tabular-nums mr-1">{{ fila ?? '—' }}</b>
            {{ fila === 1 ? 'cliente no prazo para receber' : 'clientes no prazo para receber' }}
          </p>
          <button class="cfg-btn-primario" :disabled="!podeEnviarAgora || disparando" @click="enviarFilaAgora">
            <i :class="['pi', disparando ? 'pi-spin pi-spinner' : 'pi-play']"></i>Enviar agora
          </button>
        </div>
      </div>
      <p v-if="!cfg.email.value.envios_ativos" class="cfg-aviso mt-4">
        <i class="pi pi-exclamation-triangle"></i>
        <span>Os e-mails estão pausados, então nada é enviado. <button class="cfg-link" @click="emit('ir', 'email')">Ligar na aba E-mail</button></span>
      </p>
      <p v-else-if="!r.robo_ativo" class="text-sm text-slate-500 dark:text-slate-400 mt-3">Para usar "Enviar agora", ligue o envio automático.</p>
    </CfgSecao>

    <!-- Formulário -->
    <CfgSecao titulo="Formulário da pesquisa" icone="pi-file-edit" selo="essencial"
      descricao="As perguntas que o cliente responde quando abre o convite.">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button type="button" @click="r.formulario_tipo = 'proprio'" :class="['cfg-opcao', r.formulario_tipo === 'proprio' && 'cfg-opcao-ativa']">
          <span class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <i :class="['pi', r.formulario_tipo === 'proprio' ? 'pi-check-circle text-orange-500' : 'pi-circle text-slate-400']"></i>
            Formulário da Rakiti <span class="cfg-selo cfg-selo-essencial">Recomendado</span>
          </span>
          <span class="block text-sm text-slate-500 dark:text-slate-400 mt-1">Pronto para usar. O cliente responde com um clique no e-mail.</span>
        </button>
        <button type="button" @click="r.formulario_tipo = 'externo'" :class="['cfg-opcao', r.formulario_tipo === 'externo' && 'cfg-opcao-ativa']">
          <span class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <i :class="['pi', r.formulario_tipo === 'externo' ? 'pi-check-circle text-orange-500' : 'pi-circle text-slate-400']"></i>
            Formulário de outro site
          </span>
          <span class="block text-sm text-slate-500 dark:text-slate-400 mt-1">Use um formulário seu (ex.: Fillout). Exige ligar a integração.</span>
        </button>
      </div>

      <div v-if="r.formulario_tipo !== 'externo'" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div v-for="uso in ['nps', 'csat']" :key="uso" class="cfg-campo">
          <label :for="`cfg-form-${uso}`">{{ uso === 'nps' ? 'Pesquisa de recomendação (NPS)' : 'Pesquisa de satisfação (CSAT)' }}</label>
          <div class="flex gap-2">
            <select :id="`cfg-form-${uso}`" :value="cfg.formularioPadrao(uso)?.id || ''" @change="cfg.trocarPadrao(uso, $event.target.value)" class="cfg-input flex-1 min-w-0">
              <option v-if="!cfg.formularioPadrao(uso)" value="">{{ cfg.formulariosDoTipo(uso).length ? 'Escolha um formulário' : 'Nenhum formulário deste tipo' }}</option>
              <option v-for="f in cfg.formulariosDoTipo(uso)" :key="f.id" :value="f.id">{{ f.nome }}</option>
            </select>
            <button v-if="cfg.formularioPadrao(uso)" type="button" class="cfg-btn-secundario" @click="router.push(`/formularios/${cfg.formularioPadrao(uso).id}`)">Editar</button>
          </div>
          <span class="cfg-ajuda">{{ uso === 'nps' ? 'Usado nos envios periódicos para a sua lista de clientes.' : 'Usado após uma entrega ou atendimento (integração ou envio avulso).' }} Salva na hora.</span>
        </div>
        <button type="button" class="cfg-link justify-self-start text-left md:col-span-2" @click="router.push('/formularios')">
          <i class="pi pi-external-link text-xs mr-1"></i>Criar e editar formulários
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div class="cfg-campo">
          <label for="cfg-link-externo">Link do formulário</label>
          <input id="cfg-link-externo" v-model.trim="r.survey_url" placeholder="https://forms.fillout.com/t/..." class="cfg-input font-mono"
            :class="{ 'cfg-input-erro': !r.survey_url.startsWith('https://') }" />
          <span v-if="!r.survey_url.startsWith('https://')" class="text-sm text-rose-600 dark:text-rose-400">Obrigatório: começa com https://</span>
          <span v-else class="cfg-ajuda">As respostas chegam pelo endereço da aba Integrações.</span>
        </div>
        <div class="cfg-campo">
          <label for="cfg-campos-externo">Dados do cliente enviados junto</label>
          <MultiSelect inputId="cfg-campos-externo" v-model="r.fillout_campos" :options="camposExterno" optionLabel="label" optionValue="value" display="chip"
            placeholder="Escolha os dados" panelClass="cfg-painel" class="w-full" />
          <span class="cfg-ajuda">Vão escondidos no link, para identificar quem respondeu.</span>
        </div>
      </div>
    </CfgSecao>

    <!-- Frequência -->
    <CfgSecao titulo="Frequência" icone="pi-sync" descricao="Quantos dias esperar antes de pesquisar o mesmo cliente de novo.">
      <div class="cfg-campo max-w-xs">
        <label for="cfg-recorrencia">Dias entre pesquisas</label>
        <InputNumber inputId="cfg-recorrencia" v-model="r.recorrencia_dias" :min="1" :max="365" suffix=" dias" showButtons buttonLayout="horizontal"
          incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus" class="cfg-numero" />
        <span class="cfg-ajuda">Ex.: 90 dias = cerca de 4 pesquisas por ano para cada cliente.</span>
      </div>
    </CfgSecao>

    <!-- Lembretes -->
    <CfgSecao titulo="Lembretes automáticos" icone="pi-bell"
      descricao="Para quem recebeu a pesquisa e ainda não respondeu. Param assim que o cliente responde.">
      <div class="flex flex-col gap-5">
        <div class="cfg-campo">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200" id="cfg-qtd-lembretes">Quantos lembretes no máximo</span>
          <div class="cfg-segmentado" role="radiogroup" aria-labelledby="cfg-qtd-lembretes">
            <button v-for="n in [0, 1, 2, 3]" :key="n" type="button" role="radio" :aria-checked="r.lembrete_qtd_maxima === n"
              :class="{ 'cfg-segmentado-ativo': r.lembrete_qtd_maxima === n }" @click="r.lembrete_qtd_maxima = n">
              {{ n === 0 ? 'Nenhum' : n }}
            </button>
          </div>
        </div>

        <div v-if="r.lembrete_qtd_maxima > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div v-for="n in numeros.slice(0, r.lembrete_qtd_maxima)" :key="n" class="cfg-campo">
            <label :for="`cfg-lembrete-${n}`">{{ n }}º lembrete</label>
            <InputNumber :inputId="`cfg-lembrete-${n}`" v-model="r[`lembrete_dias_${n}`]" :min="1" :max="60" suffix=" dias" class="cfg-numero" />
            <span class="cfg-ajuda">depois do convite</span>
          </div>
        </div>
        <p v-for="e in cfg.errosRegras.value.filter(x => x.includes('lembrete'))" :key="e" class="text-sm text-rose-600 dark:text-rose-400">
          <i class="pi pi-exclamation-circle mr-1"></i>{{ e }}
        </p>

        <div class="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div class="flex-1 text-sm text-slate-600 dark:text-slate-300">
            <p><i class="pi pi-clock mr-1 text-slate-400"></i>A Rakiti envia os lembretes todo dia às 10h20.</p>
            <p v-if="lembretesAlterados" class="mt-1 text-amber-700 dark:text-amber-300">Salve as alterações para atualizar a contagem abaixo.</p>
            <p v-else-if="motivoLembretesParados" class="mt-1 text-amber-700 dark:text-amber-300">{{ motivoLembretesParados }}</p>
            <p v-else-if="cfg.previaLembretes.value" class="mt-1">
              <b class="text-slate-900 dark:text-white">{{ cfg.previaLembretes.value.pendentes_agora }}</b>
              {{ cfg.previaLembretes.value.pendentes_agora === 1 ? 'lembrete seria enviado agora.' : 'lembretes seriam enviados agora.' }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="cfg-btn-secundario" @click="emit('ir', 'email')"><i class="pi pi-pencil text-xs"></i>Texto do lembrete</button>
            <button v-if="cfg.ehAdmin" class="cfg-btn-primario" @click="enviarLembretesAgora"
              :disabled="executandoLembretes || lembretesAlterados || !cfg.previaLembretes.value?.ativo || !cfg.previaLembretes.value?.pendentes_agora">
              <i :class="['pi', executandoLembretes ? 'pi-spin pi-spinner' : 'pi-send']"></i>Enviar agora
            </button>
          </div>
        </div>
      </div>
    </CfgSecao>

    <!-- Prazos -->
    <CfgSecao titulo="Prazo para tratar cada resposta" icone="pi-stopwatch"
      descricao="Cada resposta vira uma tarefa no Plano de Ação. Aqui você define em quantos dias ela deve ser resolvida.">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div v-for="p in PRAZOS" :key="p.campo" class="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3 relative overflow-hidden">
          <span :class="['absolute left-0 top-0 bottom-0 w-1', p.cor]"></span>
          <div>
            <label :for="`cfg-${p.campo}`" :class="['text-sm font-semibold', p.texto_cor]">{{ p.titulo }}</label>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ p.texto }}</p>
          </div>
          <div class="cfg-campo">
            <InputNumber :inputId="`cfg-${p.campo}`" v-model="r[p.campo]" :min="1" :max="90" suffix=" dias" class="cfg-numero" />
          </div>
        </div>
      </div>
    </CfgSecao>
  </div>
  <div v-else class="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
</template>
