<script setup>
// Plano, situação da assinatura, faturas e troca de plano (cobrança pelo Asaas).
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import api from '../services/api';

const toast = useToast();
const dados = ref(null);
const carregando = ref(true);
const ehAdmin = (sessionStorage.getItem('usuario_tipo') || '').toLowerCase() === 'admin';

const dialogo = ref(false);
const planoEscolhido = ref('');
const cobranca = ref({ cpf_cnpj: '', email_cobranca: '', telefone: '', razao_social: '' });
const enviando = ref(false);
const erro = ref('');

const carregar = async () => {
  carregando.value = true;
  try { dados.value = (await api.get('/assinatura')).data; } finally { carregando.value = false; }
};
onMounted(carregar);

const SITUACAO = {
  cortesia: { rotulo: 'Cortesia', cor: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  teste: { rotulo: 'Teste grátis', cor: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  teste_expirado: { rotulo: 'Teste encerrado', cor: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  ativa: { rotulo: 'Ativa', cor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  atrasada: { rotulo: 'Pagamento em atraso', cor: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  cancelada: { rotulo: 'Cancelada', cor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const STATUS_FATURA = { PENDING: 'Aguardando', RECEIVED: 'Paga', CONFIRMED: 'Paga', OVERDUE: 'Vencida', REFUNDED: 'Estornada', RECEIVED_IN_CASH: 'Paga' };
const FORMA = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: '—' };
const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (d) => (d ? new Date(String(d).length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('pt-BR') : '—');

const planoAtual = computed(() => dados.value?.planos?.[dados.value.plano]);
const usoPct = computed(() => {
  const lim = dados.value?.limite_clientes;
  return lim ? Math.min(100, Math.round((dados.value.uso.clientes_ativos / lim) * 100)) : 0;
});

const abrirAssinar = (plano) => {
  planoEscolhido.value = plano;
  const d = dados.value.dados_cobranca;
  cobranca.value = { cpf_cnpj: d.cpf_cnpj, email_cobranca: d.email, telefone: d.telefone, razao_social: '' };
  erro.value = '';
  dialogo.value = true;
};

const assinar = async () => {
  enviando.value = true; erro.value = '';
  try {
    const { data: r } = await api.post('/assinatura', { plano: planoEscolhido.value, ...cobranca.value });
    dialogo.value = false;
    await carregar();
    if (r.link_pagamento) {
      window.open(r.link_pagamento, '_blank');
      toast.add({ severity: 'success', summary: 'Plano escolhido', detail: 'Abrimos a fatura em outra aba. Pague por Pix, boleto ou cartão.', life: 7000 });
    } else {
      toast.add({ severity: 'success', summary: 'Plano atualizado', detail: 'O novo valor vale a partir da próxima fatura.', life: 6000 });
    }
  } catch (e) {
    erro.value = e.response?.data?.detail || 'Não foi possível concluir. Tente novamente.';
  } finally {
    enviando.value = false;
  }
};

const cancelar = async () => {
  if (!confirm('Cancelar a assinatura? Os envios de pesquisa param, mas seus dados continuam guardados e você pode voltar quando quiser.')) return;
  try {
    await api.post('/assinatura/cancelar');
    toast.add({ severity: 'info', summary: 'Assinatura cancelada', life: 5000 });
    carregar();
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Erro', detail: e.response?.data?.detail, life: 6000 });
  }
};
</script>

<template>
  <div class="max-w-6xl mx-auto flex flex-col gap-6 pb-16">
    <header>
      <h1 class="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Assinatura<span class="text-orange-500">.</span></h1>
      <p class="text-sm text-slate-500 mt-1">Seu plano, faturas e forma de pagamento.</p>
    </header>

    <div v-if="carregando" class="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>

    <template v-else-if="dados">
      <!-- Situação -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-5">
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span :class="['text-sm font-semibold px-2.5 py-1 rounded-lg', SITUACAO[dados.status]?.cor]">{{ SITUACAO[dados.status]?.rotulo || dados.status }}</span>
            <span v-if="planoAtual && dados.status !== 'cortesia'" class="text-sm text-slate-600 dark:text-slate-300">Plano <b>{{ planoAtual.nome }}</b> · {{ moeda(planoAtual.preco) }}/mês</span>
          </div>
          <p v-if="dados.mensagem" class="text-sm text-slate-600 dark:text-slate-300 mt-2">{{ dados.mensagem }}</p>
          <p v-if="dados.status === 'cortesia'" class="text-sm text-slate-600 dark:text-slate-300 mt-2">Sua conta está liberada sem cobrança.</p>
        </div>
        <div class="md:w-72">
          <p class="text-sm text-slate-600 dark:text-slate-300">Clientes ativos: <b>{{ dados.uso.clientes_ativos.toLocaleString('pt-BR') }}</b><span v-if="dados.limite_clientes"> de {{ dados.limite_clientes.toLocaleString('pt-BR') }}</span></p>
          <div v-if="dados.limite_clientes" class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
            <div class="h-full rounded-full" :class="usoPct >= 90 ? 'bg-rose-500' : usoPct >= 75 ? 'bg-amber-400' : 'bg-emerald-500'" :style="{ width: usoPct + '%' }"></div>
          </div>
        </div>
        <a v-if="dados.link_pagamento" :href="dados.link_pagamento" target="_blank" class="h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center justify-center">
          <i class="pi pi-wallet mr-2"></i>Pagar fatura em aberto
        </a>
      </section>

      <p v-if="!dados.cobranca_configurada" class="text-sm text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 rounded-xl p-3">
        A cobrança online ainda não está ativa na plataforma. Fale com o suporte para assinar.
      </p>

      <!-- Planos -->
      <section>
        <h2 class="text-base font-bold text-slate-900 dark:text-white mb-3">{{ dados.assinatura_ativa ? 'Trocar de plano' : 'Escolha o seu plano' }}</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div v-for="(p, chave) in dados.planos" :key="chave" class="bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col gap-3 shadow-sm"
            :class="p.recomendado ? 'border-orange-300 dark:border-orange-500/40' : 'border-slate-200 dark:border-slate-800'">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-slate-900 dark:text-white">{{ p.nome }}</h3>
              <span v-if="p.recomendado" class="text-xs font-semibold text-orange-700 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-300 px-2 py-0.5 rounded-md">Mais escolhido</span>
            </div>
            <p class="text-3xl font-black text-slate-900 dark:text-white">{{ moeda(p.preco) }}<span class="text-sm font-normal text-slate-500">/mês</span></p>
            <ul class="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300 flex-1">
              <li v-for="d in p.destaques" :key="d"><i class="pi pi-check text-emerald-500 text-xs mr-2"></i>{{ d }}</li>
            </ul>
            <button v-if="dados.assinatura_ativa && dados.plano === chave" disabled class="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-semibold">Plano atual</button>
            <button v-else :disabled="!ehAdmin || !dados.cobranca_configurada" @click="abrirAssinar(chave)"
              class="h-10 rounded-xl text-sm font-semibold disabled:opacity-50"
              :class="p.recomendado ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'">
              {{ dados.assinatura_ativa ? 'Mudar para este' : 'Assinar' }}
            </button>
          </div>
        </div>
        <p v-if="!ehAdmin" class="text-sm text-slate-500 mt-2">Só administradores podem alterar a assinatura.</p>
      </section>

      <!-- Faturas -->
      <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 class="text-base font-bold text-slate-900 dark:text-white mb-3">Faturas</h2>
        <table v-if="dados.cobrancas.length" class="w-full text-sm">
          <thead><tr class="text-left text-slate-500 border-b border-slate-100 dark:border-slate-800"><th class="py-2 font-medium">Vencimento</th><th class="font-medium">Valor</th><th class="font-medium">Forma</th><th class="font-medium">Situação</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(c, i) in dados.cobrancas" :key="i" class="border-b border-slate-50 dark:border-slate-800/50 text-slate-700 dark:text-slate-200">
              <td class="py-2.5">{{ data(c.vencimento) }}</td>
              <td>{{ moeda(c.valor) }}</td>
              <td>{{ FORMA[c.forma] || c.forma || '—' }}</td>
              <td><span :class="['text-xs font-semibold px-2 py-0.5 rounded-md', c.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700' : ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(c.status) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600']">{{ STATUS_FATURA[c.status] || c.status }}</span></td>
              <td class="text-right"><a v-if="c.link" :href="c.link" target="_blank" class="text-orange-600 font-semibold hover:underline">Ver</a></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-slate-500">Nenhuma fatura ainda.</p>
      </section>

      <div v-if="ehAdmin && dados.assinatura_ativa" class="text-right">
        <button @click="cancelar" class="text-sm text-slate-500 hover:text-rose-600 underline">Cancelar assinatura</button>
      </div>
    </template>

    <Dialog v-model:visible="dialogo" modal :header="`Assinar o plano ${dados?.planos?.[planoEscolhido]?.nome || ''}`" :style="{ width: '480px', maxWidth: '95vw' }">
      <form @submit.prevent="assinar" class="flex flex-col gap-4">
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ moeda(dados?.planos?.[planoEscolhido]?.preco) }} por mês. A primeira fatura vence hoje e você escolhe pagar por <b>Pix, boleto ou cartão</b> na página do Asaas.
        </p>
        <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">CNPJ ou CPF
          <input v-model="cobranca.cpf_cnpj" required inputmode="numeric" placeholder="00.000.000/0000-00" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
        </label>
        <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Razão social <span class="font-normal text-slate-400">(se diferente do nome da conta)</span>
          <input v-model="cobranca.razao_social" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail para faturas
            <input v-model="cobranca.email_cobranca" type="email" required class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
          </label>
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Celular <span class="font-normal text-slate-400">(opcional)</span>
            <input v-model="cobranca.telefone" type="tel" class="h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-normal" />
          </label>
        </div>
        <p v-if="erro" class="text-sm text-rose-600">{{ erro }}</p>
        <button type="submit" :disabled="enviando" class="h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-60">
          {{ enviando ? 'Gerando fatura...' : 'Confirmar e ir para o pagamento' }}
        </button>
      </form>
    </Dialog>
  </div>
</template>
