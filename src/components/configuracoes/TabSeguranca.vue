<script setup>
// Aba Segurança (avançada): minha senha, tempo de sessão, aparelhos conectados e domínios de e-mail liberados.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import Password from 'primevue/password';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig, useRascunho } from './useConfiguracoes';

const cfg = useConfig();

// ---------- Minha senha ----------
const senha = ref({ atual: '', nova: '', confirmacao: '' });
const trocandoSenha = ref(false);
const trocarSenha = async () => {
  if (!senha.value.atual || !senha.value.nova) { cfg.aviso('Preencha as senhas', 'Informe a senha atual e a nova.'); return; }
  if (senha.value.nova.length < 8) { cfg.aviso('Senha curta', 'Use pelo menos 8 caracteres.'); return; }
  if (senha.value.nova !== senha.value.confirmacao) { cfg.aviso('As senhas não conferem', 'Digite a mesma senha nova nos dois campos.'); return; }
  trocandoSenha.value = true;
  try {
    await api.post('/usuarios/alterar-senha', { senha_atual: senha.value.atual, nova_senha: senha.value.nova });
    cfg.ok('Senha alterada', 'Use a nova senha no próximo acesso.');
    senha.value = { atual: '', nova: '', confirmacao: '' };
  } catch (e) {
    cfg.erro(e, 'Não foi possível alterar a senha', 'Confira a senha atual.');
  } finally {
    trocandoSenha.value = false;
  }
};

// ---------- Tempo de sessão ----------
const sessao = useRascunho({ tempo_minutos: 60 });
const TEMPOS = [30, 60, 120, 240, 480, 600, 720, 1440];
const rotuloTempo = (m) => (m < 60 ? `${m} minutos` : m % 60 === 0 ? `${m / 60} hora${m === 60 ? '' : 's'}` : `${m} minutos`);
const tempos = computed(() => {
  const atual = Number(sessao.atual.value.tempo_minutos);
  return TEMPOS.includes(atual) ? TEMPOS : [...TEMPOS, atual].sort((a, b) => a - b);
});
const salvarSessao = async () => {
  try {
    await api.put('/config/seguranca', { tempo_minutos: Number(sessao.atual.value.tempo_minutos) });
    sessao.confirmar();
    cfg.ok('Alterações salvas', `Tempo de sessão: ${rotuloTempo(Number(sessao.atual.value.tempo_minutos))}.`);
    return true;
  } catch (e) {
    cfg.erro(e, 'Não foi possível salvar o tempo de sessão', 'Tente novamente.');
    return false;
  }
};

// ---------- Aparelhos conectados ----------
const sessoes = ref([]);
const carregandoSessoes = ref(false);
const carregarSessoes = async () => {
  const id = cfg.eu.value?.usuario_id;
  if (!id) return;
  carregandoSessoes.value = true;
  try {
    const { data } = await api.get(`/usuarios/sessoes?usuario_id=${id}`);
    // a lista vem da mais recente para a mais antiga; a primeira costuma ser este aparelho
    sessoes.value = (data || []).map((s, i) => ({ ...s, atual: i === 0 }));
  } catch (e) {
    sessoes.value = [];
  } finally {
    carregandoSessoes.value = false;
  }
};
watch(() => cfg.eu.value?.usuario_id, carregarSessoes);
const dataHora = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') : '');
const ehCelular = (s) => /iphone|android|mobile|ipad/i.test(s.dispositivo || '');

const encerrar = async (s) => {
  try {
    await api.delete(`/usuarios/sessoes/${s.id}`);
    sessoes.value = sessoes.value.filter((x) => x.id !== s.id);
    cfg.ok('Aparelho desconectado', s.dispositivo || '');
  } catch (e) {
    cfg.erro(e, 'Não foi possível desconectar', 'Tente novamente.');
  }
};
const encerrarOutras = async () => {
  if (!confirm('Desconectar a sua conta de todos os outros computadores e celulares?')) return;
  carregandoSessoes.value = true;
  try {
    for (const s of sessoes.value.filter((x) => !x.atual)) await api.delete(`/usuarios/sessoes/${s.id}`);
    sessoes.value = sessoes.value.filter((x) => x.atual);
    cfg.ok('Outros aparelhos desconectados');
  } catch (e) {
    cfg.erro(e, 'Não foi possível desconectar todos', 'Tente novamente.');
  } finally {
    carregandoSessoes.value = false;
  }
};

// ---------- Domínios liberados ----------
const dominios = useRascunho({ lista: [] });
const novoDominio = ref('');
const meuDominio = computed(() => (cfg.meuEmail.split('@')[1] || '').toLowerCase());
const adicionarDominio = () => {
  let d = novoDominio.value.toLowerCase().trim();
  if (d.startsWith('@')) d = d.slice(1);
  if (!d) return;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) { cfg.aviso('Domínio inválido', 'Digite só a parte depois do @, ex.: suaempresa.com.br'); return; }
  if (dominios.atual.value.lista.includes(d)) { cfg.aviso('Já está na lista', d); return; }
  dominios.atual.value.lista.push(d);
  novoDominio.value = '';
};
const removerDominio = (d) => {
  if (d === meuDominio.value) { cfg.aviso('Não é possível remover', 'É o domínio do seu próprio e-mail: você perderia o acesso.'); return; }
  dominios.atual.value.lista = dominios.atual.value.lista.filter((x) => x !== d);
};
const salvarDominios = async () => {
  if (!dominios.atual.value.lista.length) { cfg.aviso('Lista vazia', 'Sem nenhum domínio, ninguém consegue entrar. Adicione pelo menos um.'); return false; }
  try {
    await api.put('/configuracoes/dominios', { dominios: dominios.atual.value.lista.join(', ') });
    dominios.confirmar();
    cfg.ok('Alterações salvas', 'Domínios de e-mail liberados.');
    return true;
  } catch (e) {
    cfg.erro(e, 'Não foi possível salvar os domínios', 'Tente novamente.');
    return false;
  }
};

const soltar = [
  cfg.registrarSecao('sessao', { nome: 'Tempo de sessão', alterado: () => sessao.alterado.value, salvar: salvarSessao, descartar: sessao.descartar }),
  cfg.registrarSecao('dominios', { nome: 'Domínios liberados', alterado: () => dominios.alterado.value, salvar: salvarDominios, descartar: dominios.descartar }),
];
onBeforeUnmount(() => soltar.forEach((f) => f()));

onMounted(async () => {
  try {
    const { data } = await api.get('/config/seguranca');
    if (data?.tempo_minutos) sessao.definir({ tempo_minutos: Number(data.tempo_minutos) });
  } catch (e) { /* mantém o padrão */ }
  try {
    const { data } = await api.get('/configuracoes/dominios');
    dominios.definir({ lista: (data?.dominios || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) });
  } catch (e) {
    cfg.erro(e, 'Não foi possível carregar os domínios', 'Atualize a página em alguns segundos.');
  }
  carregarSessoes();
});
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
    <CfgSecao titulo="Minha senha" icone="pi-key" descricao="Troque a senha que você usa para entrar.">
      <form class="flex flex-col gap-3" @submit.prevent="trocarSenha">
        <div class="cfg-campo">
          <label for="cfg-s-atual">Senha atual</label>
          <Password inputId="cfg-s-atual" v-model="senha.atual" toggleMask :feedback="false" class="w-full" inputClass="w-full" autocomplete="current-password" />
        </div>
        <div class="cfg-campo">
          <label for="cfg-s-nova">Nova senha</label>
          <Password inputId="cfg-s-nova" v-model="senha.nova" toggleMask :feedback="false" class="w-full" inputClass="w-full" autocomplete="new-password" placeholder="Mínimo de 8 caracteres" />
        </div>
        <div class="cfg-campo">
          <label for="cfg-s-conf">Repita a nova senha</label>
          <Password inputId="cfg-s-conf" v-model="senha.confirmacao" toggleMask :feedback="false" class="w-full" inputClass="w-full" autocomplete="new-password" />
        </div>
        <button type="submit" class="cfg-btn-primario self-start" :disabled="trocandoSenha"><i :class="['pi text-xs', trocandoSenha ? 'pi-spin pi-spinner' : 'pi-check']"></i>Trocar senha</button>
      </form>
    </CfgSecao>

    <CfgSecao titulo="Tempo de sessão" icone="pi-clock" descricao="Depois desse tempo, a pessoa precisa entrar de novo com e-mail e senha.">
      <div class="cfg-campo max-w-xs">
        <label for="cfg-sessao">Manter conectado por</label>
        <select id="cfg-sessao" v-model.number="sessao.atual.value.tempo_minutos" class="cfg-input">
          <option v-for="t in tempos" :key="t" :value="t">{{ rotuloTempo(t) }}</option>
        </select>
        <span class="cfg-ajuda">Vale para todos da equipe a partir do próximo login.</span>
      </div>
    </CfgSecao>

    <CfgSecao titulo="Domínios de e-mail liberados" icone="pi-globe"
      descricao="Só e-mails destes domínios conseguem entrar na conta, ex.: suaempresa.com.br.">
      <form class="flex gap-2 mb-3" @submit.prevent="adicionarDominio">
        <label class="sr-only" for="cfg-dominio">Novo domínio</label>
        <input id="cfg-dominio" v-model="novoDominio" placeholder="suaempresa.com.br" class="cfg-input flex-1 min-w-0" />
        <button type="submit" class="cfg-btn-secundario"><i class="pi pi-plus text-xs"></i>Adicionar</button>
      </form>
      <div class="flex flex-wrap gap-2">
        <span v-for="d in dominios.atual.value.lista" :key="d" class="inline-flex items-center gap-1 pl-3 pr-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200">
          {{ d }}
          <span v-if="d === meuDominio" class="text-slate-400 px-1">(seu)</span>
          <button v-else type="button" class="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" @click="removerDominio(d)" :aria-label="`Remover ${d}`"><i class="pi pi-times text-xs"></i></button>
        </span>
      </div>
      <p v-if="!dominios.atual.value.lista.length" class="cfg-aviso mt-3"><i class="pi pi-exclamation-triangle"></i><span>Sem nenhum domínio, ninguém consegue entrar.</span></p>
    </CfgSecao>

    <CfgSecao titulo="Aparelhos conectados" icone="pi-desktop" descricao="Onde a sua conta está aberta agora. Desconecte o que você não reconhece.">
      <template #acoes>
        <button v-if="sessoes.length > 1" class="cfg-btn-secundario" :disabled="carregandoSessoes" @click="encerrarOutras">Desconectar os outros</button>
      </template>
      <p v-if="!sessoes.length" class="text-sm text-slate-500 dark:text-slate-400">{{ carregandoSessoes ? 'Carregando...' : 'Nenhum aparelho registrado.' }}</p>
      <ul class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="s in sessoes" :key="s.id" class="flex items-center gap-3 py-3">
          <span :class="['w-9 h-9 shrink-0 rounded-xl flex items-center justify-center', s.atual ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400']">
            <i :class="['pi', ehCelular(s) ? 'pi-mobile' : 'pi-desktop']"></i>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ s.dispositivo || 'Aparelho desconhecido' }}
              <span v-if="s.atual" class="cfg-selo cfg-selo-essencial ml-1">Mais recente</span>
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ [s.local, s.ip, dataHora(s.data)].filter(Boolean).join(' · ') }}</p>
          </div>
          <button v-if="!s.atual" class="cfg-btn-icone cfg-btn-perigo" @click="encerrar(s)" v-tooltip.top="'Desconectar'" :aria-label="`Desconectar ${s.dispositivo || 'aparelho'}`"><i class="pi pi-sign-out"></i></button>
        </li>
      </ul>
    </CfgSecao>
  </div>
</template>
