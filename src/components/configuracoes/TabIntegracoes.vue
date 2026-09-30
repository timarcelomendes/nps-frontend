<script setup>
// Aba Integrações: pesquisa após entrega via API (CSAT), formulário externo (Fillout) e Microsoft Teams.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig, useRascunho } from './useConfiguracoes';

const cfg = useConfig();

// ---------- Conta: endereços e chave ----------
const webhookUrl = ref('');
const csat = ref({ url: '', chave: '' });
const mostrarChave = ref(false);
const carregarConta = async () => {
  try {
    const { data } = await api.get('/conta');
    webhookUrl.value = data.webhook_url || '';
    csat.value = { url: data.csat_api_url || '', chave: data.api_key || '' };
  } catch (e) {
    cfg.erro(e, 'Não foi possível carregar as integrações', 'Atualize a página em alguns segundos.');
  }
};
const copiar = async (texto, rotulo) => {
  try { await navigator.clipboard.writeText(texto); cfg.ok(rotulo); } catch (e) { cfg.aviso('Não foi possível copiar', 'Selecione o texto e copie manualmente.'); }
};
const gerarNovaChave = async () => {
  if (!confirm('Gerar uma nova chave? O endereço do Fillout e a chave da API atuais param de funcionar na hora, e você terá de atualizar os sistemas que os usam.')) return;
  try {
    await api.post('/conta/webhook/regenerar');
    await carregarConta();
    cfg.ok('Nova chave gerada', 'Atualize o endereço no Fillout e a chave no seu sistema.');
  } catch (e) {
    cfg.erro(e, 'Não foi possível gerar a chave', 'Tente novamente.');
  }
};
const exemploCurl = computed(() => `curl -X POST "${csat.value.url}" \\
  -H "X-Api-Key: ${mostrarChave.value ? csat.value.chave : 'SUA_CHAVE'}" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "cliente@exemplo.com", "nome": "Maria", "referencia": "PED-1234", "assunto": "a entrega do pedido 1234"}'`);

// ---------- Envio avulso de CSAT ----------
const avulso = ref({ email: '', nome: '', referencia: '', assunto: '' });
const enviandoAvulso = ref(false);
const ultimoLink = ref('');
const enviarAvulso = async () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(avulso.value.email || '')) { cfg.aviso('Informe o e-mail do cliente', 'É para onde a pesquisa vai.'); return; }
  enviandoAvulso.value = true;
  try {
    const { data } = await api.post('/csat/enviar', { ...avulso.value, enviar_email: true });
    ultimoLink.value = data.link;
    if (data.status === 'Enviado') cfg.ok('Pesquisa enviada', `Convite enviado para ${avulso.value.email}.`);
    else cfg.aviso('Link criado, mas o e-mail não saiu', data.erro || 'Confira a aba E-mail.');
  } catch (e) {
    cfg.erro(e, 'Não foi possível enviar', 'Tente novamente em alguns segundos.');
  } finally {
    enviandoAvulso.value = false;
  }
};

// ---------- Fillout ----------
const testando = ref(false);
const testarWebhook = async () => {
  testando.value = true;
  try {
    const token = new URL(webhookUrl.value).searchParams.get('token');
    const { data } = await api.get('/webhook/fillout', { params: { token } });
    if (data?.status === 'success') cfg.ok('Endereço funcionando', 'Pronto para receber as respostas do Fillout.');
    else cfg.aviso('Resposta inesperada', 'O endereço respondeu, mas não confirmou o recebimento.');
  } catch (e) {
    cfg.erro(e, 'O endereço não respondeu', 'Tente de novo em alguns minutos ou fale com o suporte.');
  } finally {
    testando.value = false;
  }
};
const usaExterno = computed(() => cfg.regras.value?.formulario_tipo === 'externo');

// ---------- Teams ----------
const teams = useRascunho({ webhook_global: '', webhook_tecnico: '' });
const carregandoTeams = ref(false);
const carregarTeams = async () => {
  carregandoTeams.value = true;
  try {
    const { data } = await api.get('/configuracoes/integracoes');
    teams.definir({ webhook_global: data?.webhook_global || '', webhook_tecnico: data?.webhook_tecnico || '' });
  } catch (e) {
    cfg.erro(e, 'Não foi possível carregar o Teams', 'Atualize a página em alguns segundos.');
  } finally {
    carregandoTeams.value = false;
  }
};
const salvarTeams = async () => {
  try {
    await api.put('/configuracoes/integracoes', teams.atual.value);
    teams.confirmar();
    cfg.ok('Alterações salvas', 'Canais do Microsoft Teams.');
    return true;
  } catch (e) {
    cfg.erro(e, 'Não foi possível salvar o Teams', 'Tente novamente.');
    return false;
  }
};
const soltar = cfg.registrarSecao('teams', { nome: 'Canais do Teams', alterado: () => teams.alterado.value, salvar: salvarTeams, descartar: teams.descartar });
onBeforeUnmount(soltar);

const horas = computed(() => {
  const lista = Array.from({ length: 15 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
  const atual = cfg.regras.value?.teams_horario_resumo;
  return atual && !lista.includes(atual) ? [atual, ...lista] : lista;
});

onMounted(() => { carregarConta(); carregarTeams(); });
</script>

<template>
  <div class="flex flex-col gap-5">
    <p class="text-sm text-slate-500 dark:text-slate-400">Opcional. Conecte a Rakiti aos sistemas que você já usa. Se tiver dúvida, encaminhe esta página para quem cuida da TI.</p>

    <!-- CSAT por API -->
    <CfgSecao titulo="Pesquisa após a entrega (CSAT)" icone="pi-truck" selo="opcional"
      descricao="Seu sistema (ERP/TMS) avisa a Rakiti quando um pedido é entregue, e o cliente recebe na hora a pergunta de satisfação.">
      <p class="text-sm text-slate-600 dark:text-slate-300 mb-4">Notas 1 e 2 viram tarefa no Plano de Ação automaticamente.</p>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="cfg-campo">
          <label for="cfg-csat-url">Endereço da API (POST)</label>
          <div class="flex gap-2">
            <input id="cfg-csat-url" :value="csat.url" readonly class="cfg-input flex-1 min-w-0 font-mono" />
            <button class="cfg-btn-quadrado" @click="copiar(csat.url, 'Endereço copiado')" aria-label="Copiar endereço" v-tooltip.top="'Copiar'"><i class="pi pi-copy"></i></button>
          </div>
        </div>
        <div class="cfg-campo">
          <label for="cfg-csat-chave">Chave de acesso (cabeçalho X-Api-Key)</label>
          <div class="flex gap-2">
            <input id="cfg-csat-chave" :value="mostrarChave ? csat.chave : '••••••••••••••••••••••••'" readonly class="cfg-input flex-1 min-w-0 font-mono" />
            <button class="cfg-btn-quadrado" @click="mostrarChave = !mostrarChave" :aria-label="mostrarChave ? 'Ocultar chave' : 'Mostrar chave'" v-tooltip.top="mostrarChave ? 'Ocultar' : 'Mostrar'"><i :class="['pi', mostrarChave ? 'pi-eye-slash' : 'pi-eye']"></i></button>
            <button class="cfg-btn-quadrado" @click="copiar(csat.chave, 'Chave copiada')" aria-label="Copiar chave" v-tooltip.top="'Copiar'"><i class="pi pi-copy"></i></button>
          </div>
          <span class="cfg-ajuda">É secreta, como uma senha. <button class="cfg-link" @click="gerarNovaChave">Gerar nova chave</button></span>
        </div>
      </div>
      <details class="mt-4">
        <summary class="cfg-link cursor-pointer">Ver exemplo para o seu desenvolvedor</summary>
        <pre class="mt-2 p-3 bg-slate-950 text-slate-200 rounded-xl overflow-x-auto text-sm leading-relaxed">{{ exemploCurl }}</pre>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Campos: <b>email</b> (obrigatório), nome, referencia (nº do pedido ou nota), assunto (o que será avaliado) e <b>formulario_id</b> (opcional; sem ele, usa o formulário padrão de CSAT da aba Pesquisa). A resposta traz o <b>link</b> da pesquisa, que também pode ser enviado por WhatsApp.</p>
      </details>

      <form class="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800" @submit.prevent="enviarAvulso">
        <p class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Enviar uma pesquisa agora (teste ou avulsa)</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <label class="sr-only" for="cfg-av-email">E-mail do cliente</label>
          <input id="cfg-av-email" v-model.trim="avulso.email" type="email" placeholder="E-mail do cliente" class="cfg-input" />
          <label class="sr-only" for="cfg-av-nome">Nome</label>
          <input id="cfg-av-nome" v-model="avulso.nome" placeholder="Nome (opcional)" class="cfg-input" />
          <label class="sr-only" for="cfg-av-ref">Pedido ou nota</label>
          <input id="cfg-av-ref" v-model="avulso.referencia" placeholder="Pedido ou nota (opcional)" class="cfg-input" />
          <label class="sr-only" for="cfg-av-assunto">O que será avaliado</label>
          <input id="cfg-av-assunto" v-model="avulso.assunto" placeholder="Ex.: a entrega do pedido 1234" class="cfg-input" />
        </div>
        <div class="flex flex-wrap items-center gap-3 mt-3">
          <button type="submit" class="cfg-btn-primario" :disabled="enviandoAvulso"><i :class="['pi text-xs', enviandoAvulso ? 'pi-spin pi-spinner' : 'pi-send']"></i>Enviar pesquisa</button>
          <a v-if="ultimoLink" :href="ultimoLink" target="_blank" rel="noopener" class="cfg-link break-all">{{ ultimoLink }}</a>
        </div>
      </form>
    </CfgSecao>

    <!-- Fillout -->
    <CfgSecao titulo="Formulário externo (Fillout)" icone="pi-download" selo="opcional"
      descricao="Cole este endereço no webhook do seu formulário para as respostas chegarem sozinhas à Rakiti.">
      <p :class="['text-sm mb-3', usaExterno ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400']">
        <i :class="['pi text-xs mr-1', usaExterno ? 'pi-check-circle' : 'pi-info-circle']"></i>
        {{ usaExterno ? 'Em uso: a aba Pesquisa está com "Formulário de outro site".' : 'Não está em uso: a aba Pesquisa está com o formulário da Rakiti.' }}
      </p>
      <div class="cfg-campo">
        <label for="cfg-webhook">Endereço para receber as respostas (webhook)</label>
        <div class="flex flex-col sm:flex-row gap-2">
          <input id="cfg-webhook" :value="webhookUrl" readonly class="cfg-input w-full sm:flex-1 min-w-0 font-mono" />
          <div class="flex gap-2">
            <button class="cfg-btn-secundario" @click="copiar(webhookUrl, 'Endereço copiado')"><i class="pi pi-copy text-xs"></i>Copiar</button>
            <button class="cfg-btn-secundario" :disabled="testando || !webhookUrl" @click="testarWebhook"><i :class="['pi text-xs', testando ? 'pi-spin pi-spinner' : 'pi-bolt']"></i>Testar</button>
          </div>
        </div>
        <span class="cfg-ajuda">Contém a chave secreta da sua conta: não compartilhe. <button class="cfg-link" @click="gerarNovaChave">Gerar novo endereço</button></span>
      </div>
    </CfgSecao>

    <!-- Teams -->
    <CfgSecao titulo="Microsoft Teams" icone="pi-microsoft" selo="opcional"
      descricao="Receba no Teams os avisos de novas respostas e um resumo diário das pendências para os gestores.">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="cfg-campo">
          <label for="cfg-teams-global">Canal de avisos da equipe</label>
          <input id="cfg-teams-global" v-model.trim="teams.atual.value.webhook_global" placeholder="https://suaempresa.webhook.office.com/..." class="cfg-input font-mono" :disabled="carregandoTeams" />
          <span class="cfg-ajuda">Endereço "Incoming Webhook" do canal. Recebe as novas respostas e o resumo diário.</span>
        </div>
        <div class="cfg-campo">
          <label for="cfg-teams-tecnico">Canal técnico <span class="font-normal text-slate-400">(opcional)</span></label>
          <input id="cfg-teams-tecnico" v-model.trim="teams.atual.value.webhook_tecnico" placeholder="https://suaempresa.webhook.office.com/..." class="cfg-input font-mono" :disabled="carregandoTeams" />
          <span class="cfg-ajuda">Para quem cuida da TI: avisa quando algo falha no envio.</span>
        </div>
        <div v-if="cfg.regras.value" class="cfg-campo max-w-xs">
          <label for="cfg-teams-hora">Horário do resumo diário</label>
          <select id="cfg-teams-hora" v-model="cfg.regras.value.teams_horario_resumo" class="cfg-input">
            <option v-for="h in horas" :key="h" :value="h">{{ h }}</option>
          </select>
          <span class="cfg-ajuda">Segunda a sexta, no canal de avisos.</span>
        </div>
      </div>
    </CfgSecao>
  </div>
</template>
