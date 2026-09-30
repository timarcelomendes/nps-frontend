<script setup>
// Aba Plataforma (só para a administração da Rakiti): criar contas de empresas e ajustar a situação delas.
import { ref, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Password from 'primevue/password';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig } from './useConfiguracoes';

const cfg = useConfig();
const contas = ref([]);
const carregando = ref(false);
const vazia = () => ({ nome: '', admin_nome: '', admin_email: '', admin_senha: '', dominios: '' });
const nova = ref(vazia());
const criando = ref(false);

const SITUACOES = {
  cortesia: ['Cortesia', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'],
  teste: ['Teste grátis', 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'],
  ativa: ['Ativa', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  atrasada: ['Em atraso', 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'],
  cancelada: ['Cancelada', 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'],
};
const rotulo = (s) => (SITUACOES[s] || [s || '—'])[0];
const cor = (s) => (SITUACOES[s] || ['', SITUACOES.cancelada[1]])[1];

const carregar = async () => {
  carregando.value = true;
  try { contas.value = (await api.get('/superadmin/contas')).data || []; } catch (e) { cfg.erro(e, 'Não foi possível listar as contas', 'Tente novamente.'); } finally { carregando.value = false; }
};
const ajustar = async (conta, dados, texto) => {
  if (!confirm(`${texto} para "${conta.nome}"?`)) return;
  try {
    await api.put(`/superadmin/contas/${conta.id}`, dados);
    cfg.ok('Conta atualizada', conta.nome);
    carregar();
  } catch (e) {
    cfg.erro(e, 'Não foi possível ajustar', 'Tente novamente.');
  }
};
const criar = async () => {
  const n = nova.value;
  if (!n.nome.trim() || !n.admin_nome.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.admin_email) || n.admin_senha.length < 8) {
    cfg.aviso('Faltam dados', 'Preencha empresa, nome e e-mail do administrador e uma senha com 8 caracteres ou mais.');
    return;
  }
  criando.value = true;
  try {
    const { data } = await api.post('/superadmin/contas', n);
    cfg.ok('Conta criada', data.message);
    nova.value = vazia();
    carregar();
  } catch (e) {
    cfg.erro(e, 'Não foi possível criar a conta', 'Tente novamente.');
  } finally {
    criando.value = false;
  }
};
onMounted(carregar);
</script>

<template>
  <div class="flex flex-col gap-5">
    <CfgSecao titulo="Nova empresa cliente" icone="pi-building" descricao="Cria uma conta separada (os dados não se misturam) com o primeiro administrador.">
      <form class="grid grid-cols-1 md:grid-cols-2 gap-4" @submit.prevent="criar">
        <div class="cfg-campo"><label for="cfg-p-nome">Nome da empresa</label><input id="cfg-p-nome" v-model="nova.nome" placeholder="Distribuidora Exemplo" class="cfg-input" /></div>
        <div class="cfg-campo"><label for="cfg-p-dom">Domínios liberados</label><input id="cfg-p-dom" v-model="nova.dominios" placeholder="exemplo.com.br" class="cfg-input" /><span class="cfg-ajuda">Separe por vírgula se forem vários.</span></div>
        <div class="cfg-campo"><label for="cfg-p-anome">Nome do administrador</label><input id="cfg-p-anome" v-model="nova.admin_nome" class="cfg-input" /></div>
        <div class="cfg-campo"><label for="cfg-p-aemail">E-mail do administrador</label><input id="cfg-p-aemail" v-model.trim="nova.admin_email" type="email" placeholder="admin@exemplo.com.br" class="cfg-input" /></div>
        <div class="cfg-campo"><label for="cfg-p-senha">Senha inicial</label><Password inputId="cfg-p-senha" v-model="nova.admin_senha" toggleMask :feedback="false" class="w-full" inputClass="w-full" placeholder="Mínimo de 8 caracteres" /></div>
        <div class="flex items-end"><button type="submit" class="cfg-btn-primario w-full" :disabled="criando"><i :class="['pi text-xs', criando ? 'pi-spin pi-spinner' : 'pi-plus']"></i>Criar conta</button></div>
      </form>
    </CfgSecao>

    <CfgSecao titulo="Contas na plataforma" icone="pi-list" :descricao="`${contas.length} empresa${contas.length === 1 ? '' : 's'}`">
      <DataTable :value="contas" :loading="carregando" responsiveLayout="stack" breakpoint="960px" class="cfg-tabela" dataKey="id" rowHover>
        <Column field="nome" header="Empresa">
          <template #body="{ data }"><span class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ data.nome }}</span> <span class="text-sm text-slate-400">#{{ data.id }}</span></template>
        </Column>
        <Column header="Situação">
          <template #body="{ data }">
            <span :class="['text-sm font-semibold px-2 py-0.5 rounded-md', cor(data.status_assinatura)]">{{ rotulo(data.status_assinatura) }}</span>
            <span v-if="data.status_assinatura === 'teste' && data.teste_ate" class="block text-sm text-slate-500 mt-1">até {{ new Date(data.teste_ate).toLocaleDateString('pt-BR') }}</span>
          </template>
        </Column>
        <Column field="plano" header="Plano" />
        <Column field="origem" header="Origem" />
        <Column field="usuarios" header="Usuários" />
        <Column header="Clientes">
          <template #body="{ data }">{{ data.clientes }}<span v-if="data.limite_clientes" class="text-slate-400"> / {{ data.limite_clientes }}</span></template>
        </Column>
        <Column field="respostas" header="Respostas" />
        <Column header="Ações">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1 justify-end">
              <button class="cfg-btn-mini" @click="ajustar(data, { dias_teste: 14 }, 'Dar mais 14 dias de teste')" v-tooltip.top="'Dá mais 14 dias de teste'">+14 dias</button>
              <button class="cfg-btn-mini" @click="ajustar(data, { status_assinatura: 'cortesia' }, 'Liberar como cortesia (sem cobrança e sem limite)')" v-tooltip.top="'Libera sem cobrança e sem limite'">Cortesia</button>
            </div>
          </template>
        </Column>
      </DataTable>
    </CfgSecao>
  </div>
</template>
