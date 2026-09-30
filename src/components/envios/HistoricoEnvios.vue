<script setup>
// Histórico dos e-mails de pesquisa enviados aos contatos, com a causa dos erros em linguagem simples.
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import EstadoVazio from '../clientes/EstadoVazio.vue';
import { causaSimples, extrairErroDoLog, formatarData } from './mensagens';

const props = defineProps({
  logs: { type: Array, default: () => [] },
  clientes: { type: Array, default: () => [] },
  carregando: Boolean,
  podeDisparar: Boolean,
  idsEnviando: { type: Array, default: () => [] },
});
const emit = defineEmits(['reenviar']);
const router = useRouter();

const AGRADECIMENTO = /^(Obrigado pela sua nota|Recebemos a sua avalia|O seu feedback é muito importante)/i;
const filtro = ref('todos');
const limiteCelular = ref(10);

const porEmail = computed(() => {
  const m = new Map();
  props.clientes.forEach(c => { if (c.email) m.set(String(c.email).trim().toLowerCase(), c); });
  return m;
});

// Só e-mails enviados a contatos (tira e-mails de sistema, como troca de senha)
const linhas = computed(() => props.logs
  .map(l => {
    const cliente = porEmail.value.get(String(l.destinatario || '').trim().toLowerCase());
    if (!cliente) return null;
    const erro = l.status === 'Erro' ? causaSimples(extrairErroDoLog(l.mensagem)) : null;
    return { ...l, cliente, erro, tipo: AGRADECIMENTO.test(l.assunto || '') ? 'Agradecimento' : 'Pesquisa' };
  })
  .filter(Boolean));

// Só vale tentar de novo o erro mais recente de cada contato (se depois disso saiu outro e-mail, o erro ficou velho)
const ultimaPesquisaPorEmail = computed(() => {
  const m = new Map();
  linhas.value.forEach(l => { const e = String(l.destinatario).trim().toLowerCase(); if (l.tipo === 'Pesquisa' && !m.has(e)) m.set(e, l.id); });
  return m;
});
const podeReenviar = (l) => props.podeDisparar && l.status === 'Erro' && l.tipo === 'Pesquisa' && ativo(l.cliente)
  && ultimaPesquisaPorEmail.value.get(String(l.destinatario).trim().toLowerCase()) === l.id;

const contagem = computed(() => ({
  todos: linhas.value.length,
  erro: linhas.value.filter(l => l.status === 'Erro').length,
  respondido: linhas.value.filter(l => l.status === 'Respondido').length,
}));

const visiveis = computed(() => {
  if (filtro.value === 'erro') return linhas.value.filter(l => l.status === 'Erro');
  if (filtro.value === 'respondido') return linhas.value.filter(l => l.status === 'Respondido');
  return linhas.value;
});

const SITUACAO = {
  Enviado: { rotulo: 'Enviado', classe: 'env-tag-espera' },
  Respondido: { rotulo: 'Respondeu', classe: 'env-tag-ok' },
  Erro: { rotulo: 'Não saiu', classe: 'env-tag-erro' },
  Criado: { rotulo: 'Link criado', classe: 'env-tag-neutro' },
};
const situacao = (s) => SITUACAO[s] || { rotulo: s || 'Sem status', classe: 'env-tag-neutro' };
const ativo = (c) => !(c.ativo === 0 || c.ativo === false);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar histórico">
      <button v-for="op in [['todos', 'Todos'], ['erro', 'Com erro'], ['respondido', 'Responderam']]" :key="op[0]"
        @click="filtro = op[0]" :aria-pressed="filtro === op[0]"
        class="h-9 px-3 rounded-lg border text-sm font-semibold transition-colors inline-flex items-center gap-2"
        :class="filtro === op[0] ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-300'">
        {{ op[1] }}<span class="text-xs tabular-nums opacity-80">{{ contagem[op[0]] }}</span>
      </button>
    </div>

    <!-- Celular: cartões -->
    <div class="md:hidden flex flex-col gap-3">
      <p v-if="carregando && !visiveis.length" class="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">Carregando histórico...</p>
      <template v-else-if="!visiveis.length">
        <EstadoVazio v-if="filtro === 'erro'" icone="pi-check-circle" titulo="Nenhum envio com erro" texto="Todos os e-mails registrados saíram normalmente." />
        <EstadoVazio v-else icone="pi-send" titulo="Nenhum envio ainda" texto="Quando uma pesquisa for enviada, ela aparece aqui com a data e a situação.">
          <slot name="acao-vazio" />
        </EstadoVazio>
      </template>
      <article v-for="l in visiveis.slice(0, limiteCelular)" :key="l.id" class="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-1.5 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <span :class="['env-tag', situacao(l.status).classe]">{{ situacao(l.status).rotulo }}</span>
          <span class="text-sm text-slate-500 dark:text-slate-400 tabular-nums">{{ formatarData(l.data_envio, true) }}</span>
        </div>
        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{{ l.cliente.nome || l.nome_cliente }} <span class="font-normal text-slate-500 dark:text-slate-400 break-all">· {{ l.destinatario }}</span></p>
        <p class="text-sm text-slate-600 dark:text-slate-300 break-words">{{ l.tipo }}: {{ l.assunto }}</p>
        <template v-if="l.erro">
          <p class="text-sm text-slate-600 dark:text-slate-300">{{ l.erro.texto }}</p>
          <button v-if="l.erro.assinatura" @click="router.push('/assinatura')" class="env-link self-start">Ver assinatura</button>
        </template>
        <button v-if="podeReenviar(l)" @click="emit('reenviar', l.cliente)" :disabled="idsEnviando.includes(l.cliente.cliente_id)" class="env-btn-secundario env-btn-pequeno self-start mt-1">
          <i :class="['pi text-xs', idsEnviando.includes(l.cliente.cliente_id) ? 'pi-spin pi-spinner' : 'pi-refresh']"></i>Tentar de novo
        </button>
      </article>
      <button v-if="visiveis.length > limiteCelular" @click="limiteCelular += 10" class="env-btn-secundario">Mostrar mais ({{ visiveis.length - limiteCelular }})</button>
    </div>

    <DataTable :value="visiveis" :loading="carregando" :paginator="visiveis.length > 10" :rows="10" dataKey="id"
      class="env-tabela hidden md:block" rowHover>
      <template #empty>
        <EstadoVazio v-if="filtro === 'erro'" icone="pi-check-circle" titulo="Nenhum envio com erro" texto="Todos os e-mails registrados saíram normalmente." />
        <EstadoVazio v-else icone="pi-send" titulo="Nenhum envio ainda" texto="Quando uma pesquisa for enviada, ela aparece aqui com a data e a situação.">
          <slot name="acao-vazio" />
        </EstadoVazio>
      </template>

      <Column header="Data" style="width: 150px">
        <template #body="{ data }"><span class="text-sm text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">{{ formatarData(data.data_envio, true) }}</span></template>
      </Column>
      <Column header="Contato" style="min-width: 200px">
        <template #body="{ data }">
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ data.cliente.nome || data.nome_cliente }}</span>
            <span class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ data.destinatario }}</span>
          </div>
        </template>
      </Column>
      <Column header="E-mail" style="min-width: 180px">
        <template #body="{ data }">
          <div class="flex flex-col min-w-0">
            <span class="text-sm text-slate-700 dark:text-slate-200">{{ data.tipo }}</span>
            <span class="text-sm text-slate-500 dark:text-slate-400 truncate max-w-[260px]" :title="data.assunto">{{ data.assunto }}</span>
          </div>
        </template>
      </Column>
      <Column header="Situação" style="min-width: 220px">
        <template #body="{ data }">
          <div class="flex flex-col items-start gap-1 min-w-0">
            <span :class="['env-tag', situacao(data.status).classe]">{{ situacao(data.status).rotulo }}</span>
            <template v-if="data.erro">
              <span class="text-sm text-slate-600 dark:text-slate-300 max-w-[320px]">{{ data.erro.texto }}</span>
              <button v-if="data.erro.assinatura" @click="router.push('/assinatura')" class="env-link">Ver assinatura</button>
            </template>
          </div>
        </template>
      </Column>
      <Column header="" style="width: 1%">
        <template #body="{ data }">
          <div class="flex justify-end w-full">
            <button v-if="podeReenviar(data)"
              @click="emit('reenviar', data.cliente)" :disabled="idsEnviando.includes(data.cliente.cliente_id)" class="env-btn-secundario env-btn-pequeno">
              <i :class="['pi text-xs', idsEnviando.includes(data.cliente.cliente_id) ? 'pi-spin pi-spinner' : 'pi-refresh']"></i>Tentar de novo
            </button>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
