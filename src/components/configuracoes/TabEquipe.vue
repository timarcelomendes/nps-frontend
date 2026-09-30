<script setup>
// Aba Equipe: quem acessa a Rakiti, com qual perfil, e cadastro de novos usuários.
import { ref, computed, onMounted } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import Password from 'primevue/password';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig } from './useConfiguracoes';
import { PERFIS, VALORES_PERFIL, rotuloPerfil } from './perfis';

const cfg = useConfig();

const busca = ref('');
const lista = computed(() => {
  const t = busca.value.trim().toLowerCase();
  if (!t) return cfg.usuarios.value;
  return cfg.usuarios.value.filter((u) => [u.nome, u.email, u.cargo].some((c) => String(c || '').toLowerCase().includes(t)));
});
const souEu = (u) => String(u.email).toLowerCase() === cfg.meuEmail;

const dataHora = (d) => {
  if (!d) return 'Nunca entrou';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
};
const iniciais = (nome) => (nome ? nome.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : '?');

// ---------- Diálogo ----------
const dialogo = ref(false);
const editando = ref(false);
const salvando = ref(false);
const trocarSenha = ref(false);
const vazio = () => ({ nome: '', email: '', cargo: '', tipo: 'Viewer', ativo: true, password: '' });
const usuario = ref(vazio());

const abrirNovo = () => {
  usuario.value = vazio();
  editando.value = false;
  trocarSenha.value = true;
  dialogo.value = true;
};
const editar = (dados) => {
  usuario.value = { ...dados, ativo: !!dados.ativo, password: '' };
  editando.value = true;
  trocarSenha.value = false;
  dialogo.value = true;
};

const gerarSenha = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const valores = new Uint32Array(12);
  window.crypto.getRandomValues(valores);
  usuario.value.password = Array.from(valores, (v) => chars[v % chars.length]).join('');
  cfg.ok('Senha gerada', 'Clique no olho para ver e copie antes de salvar.');
};

const salvar = async () => {
  const u = usuario.value;
  if (!u.nome?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email || '')) {
    cfg.aviso('Faltam dados', 'Preencha o nome e um e-mail válido.');
    return;
  }
  if (u.ativo && !VALORES_PERFIL.includes(u.tipo)) {
    cfg.aviso('Escolha o perfil', 'Defina o perfil de acesso antes de liberar a conta.');
    return;
  }
  if ((!editando.value || trocarSenha.value) && u.password && u.password.length < 8) {
    cfg.aviso('Senha curta', 'Use pelo menos 8 caracteres.');
    return;
  }
  if (!editando.value && !u.password) {
    cfg.aviso('Defina a senha inicial', 'Digite ou gere uma senha para o primeiro acesso.');
    return;
  }
  salvando.value = true;
  try {
    if (editando.value) {
      await api.put(`/usuarios/${u.usuario_id}`, u);
      cfg.ok('Usuário atualizado', u.nome);
    } else {
      await api.post('/usuarios', u);
      // o cadastro já grava o perfil; se o admin marcou "inativo", aplica em seguida
      await cfg.carregarUsuarios();
      const novo = cfg.usuarios.value.find((x) => String(x.email).toLowerCase() === u.email.toLowerCase());
      if (novo && (novo.tipo !== u.tipo || !!novo.ativo !== u.ativo)) {
        await api.put(`/usuarios/${novo.usuario_id}`, { ...novo, tipo: u.tipo, ativo: u.ativo, password: '' });
      }
      cfg.ok('Usuário criado', `${u.nome} já pode entrar com o e-mail e a senha definidos.`);
    }
    dialogo.value = false;
    cfg.carregarUsuarios();
  } catch (e) {
    cfg.erro(e, 'Não foi possível salvar o usuário', 'Tente novamente em alguns segundos.');
  } finally {
    salvando.value = false;
  }
};

const alternarAcesso = async (u) => {
  const novo = !u.ativo;
  if (novo && !VALORES_PERFIL.includes(u.tipo)) {
    cfg.aviso('Escolha o perfil primeiro', 'Defina o perfil de acesso antes de liberar a conta.');
    editar(u);
    return;
  }
  if (!novo && !confirm(`Bloquear o acesso de ${u.nome}? A pessoa não consegue mais entrar até ser liberada.`)) return;
  try {
    await api.put(`/usuarios/${u.usuario_id}`, { ...u, ativo: novo });
    u.ativo = novo;
    cfg.ok(novo ? 'Acesso liberado' : 'Acesso bloqueado', u.nome);
  } catch (e) {
    cfg.erro(e, 'Não foi possível alterar o acesso', 'Tente novamente.');
  }
};

const excluir = async (u) => {
  if (!confirm(`Excluir ${u.nome} de vez? Isso não pode ser desfeito. Se for só por um tempo, prefira bloquear.`)) return;
  try {
    await api.delete(`/usuarios/${u.usuario_id}`);
    cfg.ok('Usuário excluído', u.nome);
    cfg.carregarUsuarios();
  } catch (e) {
    cfg.erro(e, 'Não foi possível excluir', 'Tente novamente.');
  }
};

const reenviarConfirmacao = async (emailUsuario) => {
  try {
    await api.post('/reenviar-confirmacao', { email: emailUsuario });
    cfg.ok('Link reenviado', `Enviamos de novo o link de confirmação para ${emailUsuario}.`);
  } catch (e) {
    cfg.erro(e, 'Não foi possível reenviar', 'Tente novamente em alguns minutos.');
  }
};

onMounted(() => { if (!cfg.usuarios.value.length) cfg.carregarUsuarios(); });
</script>

<template>
  <CfgSecao titulo="Equipe" icone="pi-users" selo="essencial" descricao="Quem da sua empresa acessa a Rakiti e o que cada pessoa pode fazer.">
    <template #acoes>
      <button class="cfg-btn-primario" @click="abrirNovo"><i class="pi pi-user-plus text-xs"></i>Adicionar pessoa</button>
    </template>

    <div class="flex flex-wrap items-center gap-2 mb-3">
      <label class="relative flex-1 min-w-[12rem] max-w-sm">
        <span class="sr-only">Procurar na equipe</span>
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input v-model="busca" placeholder="Procurar por nome, e-mail ou cargo" class="cfg-input w-full pl-9!" />
      </label>
      <button class="cfg-btn-quadrado" @click="cfg.carregarUsuarios" v-tooltip.top="'Atualizar lista'" aria-label="Atualizar lista">
        <i :class="['pi', cfg.carregandoUsuarios.value ? 'pi-spin pi-spinner' : 'pi-refresh']"></i>
      </button>
    </div>

    <DataTable :value="lista" :loading="cfg.carregandoUsuarios.value" responsiveLayout="stack" breakpoint="960px" class="cfg-tabela"
      :paginator="lista.length > 10" :rows="10" dataKey="usuario_id" rowHover>
      <template #empty>
        <p class="py-8 text-center text-sm text-slate-500">{{ busca ? 'Ninguém encontrado com essa busca.' : 'Nenhum usuário cadastrado.' }}</p>
      </template>

      <Column header="Pessoa">
        <template #body="{ data }">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-9 h-9 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold flex items-center justify-center">{{ iniciais(data.nome) }}</span>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">{{ data.nome }} <span v-if="souEu(data)" class="text-slate-400 font-normal">(você)</span></p>
              <p class="text-sm text-slate-500 dark:text-slate-400 truncate">{{ data.email }}</p>
              <p v-if="!data.email_verificado" class="text-sm text-amber-700 dark:text-amber-300 flex flex-wrap items-center gap-x-2">
                <span><i class="pi pi-clock text-xs mr-1"></i>E-mail não confirmado</span>
                <button class="cfg-link" @click="reenviarConfirmacao(data.email)">Reenviar link</button>
              </p>
            </div>
          </div>
        </template>
      </Column>
      <Column header="Cargo">
        <template #body="{ data }"><span class="text-sm text-slate-600 dark:text-slate-300">{{ data.cargo || '—' }}</span></template>
      </Column>
      <Column header="Perfil">
        <template #body="{ data }">
          <span :class="['cfg-selo', data.tipo === 'Admin' && 'cfg-selo-essencial', !VALORES_PERFIL.includes(data.tipo) && 'cfg-selo-alerta']">{{ rotuloPerfil(data.tipo) }}</span>
        </template>
      </Column>
      <Column header="Acesso">
        <template #body="{ data }">
          <span class="inline-flex items-center gap-1.5 text-sm font-medium" :class="data.ativo ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'">
            <span :class="['w-2 h-2 rounded-full', data.ativo ? 'bg-emerald-500' : 'bg-slate-400']"></span>{{ data.ativo ? 'Liberado' : 'Bloqueado' }}
          </span>
        </template>
      </Column>
      <Column field="ultimo_acesso" header="Último acesso" sortable>
        <template #body="{ data }"><span class="text-sm text-slate-500 dark:text-slate-400">{{ dataHora(data.ultimo_acesso) }}</span></template>
      </Column>
      <Column header="Ações" headerClass="text-right">
        <template #body="{ data }">
          <div class="flex gap-1 justify-end">
            <button class="cfg-btn-icone" @click="editar(data)" v-tooltip.top="'Editar'" :aria-label="`Editar ${data.nome}`"><i class="pi pi-pencil"></i></button>
            <template v-if="!souEu(data)">
              <button class="cfg-btn-icone" @click="alternarAcesso(data)" v-tooltip.top="data.ativo ? 'Bloquear acesso' : 'Liberar acesso'"
                :aria-label="`${data.ativo ? 'Bloquear' : 'Liberar'} ${data.nome}`"><i :class="['pi', data.ativo ? 'pi-lock' : 'pi-lock-open']"></i></button>
              <button class="cfg-btn-icone cfg-btn-perigo" @click="excluir(data)" v-tooltip.top="'Excluir'" :aria-label="`Excluir ${data.nome}`"><i class="pi pi-trash"></i></button>
            </template>
          </div>
        </template>
      </Column>
    </DataTable>
  </CfgSecao>

  <Dialog v-model:visible="dialogo" modal :header="editando ? 'Editar usuário' : 'Adicionar pessoa à equipe'" class="cfg-dialog" :style="{ width: '560px', maxWidth: '95vw' }">
    <form id="cfg-form-usuario" class="flex flex-col gap-4" @submit.prevent="salvar">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="cfg-campo sm:col-span-2">
          <label for="cfg-u-nome">Nome</label>
          <input id="cfg-u-nome" v-model="usuario.nome" class="cfg-input" placeholder="Ex.: Ana Souza" />
        </div>
        <div class="cfg-campo">
          <label for="cfg-u-email">E-mail</label>
          <input id="cfg-u-email" v-model.trim="usuario.email" type="email" class="cfg-input" placeholder="nome@empresa.com.br" />
        </div>
        <div class="cfg-campo">
          <label for="cfg-u-cargo">Cargo <span class="font-normal text-slate-400">(opcional)</span></label>
          <input id="cfg-u-cargo" v-model="usuario.cargo" class="cfg-input" placeholder="Ex.: Atendimento" />
        </div>
        <div class="cfg-campo">
          <label for="cfg-u-perfil">Perfil de acesso</label>
          <Dropdown inputId="cfg-u-perfil" v-model="usuario.tipo" :options="PERFIS" optionLabel="label" optionValue="value" placeholder="Escolha" panelClass="cfg-painel" class="w-full" />
          <span class="cfg-ajuda">{{ PERFIS.find(p => p.value === usuario.tipo)?.descricao || 'Escolha um perfil para liberar o acesso.' }}</span>
        </div>
        <div class="cfg-campo">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Acesso</span>
          <label class="flex items-center gap-3 h-10 cursor-pointer">
            <InputSwitch v-model="usuario.ativo" class="cfg-switch" :disabled="editando && souEu(usuario)" />
            <span class="text-sm" :class="usuario.ativo ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'">{{ usuario.ativo ? 'Liberado' : 'Bloqueado' }}</span>
          </label>
        </div>
      </div>

      <button v-if="editando && !trocarSenha" type="button" class="cfg-link self-start" @click="trocarSenha = true"><i class="pi pi-key text-xs mr-1"></i>Definir nova senha</button>
      <div v-if="trocarSenha" class="cfg-campo">
        <label for="cfg-u-senha">{{ editando ? 'Nova senha' : 'Senha para o primeiro acesso' }}</label>
        <div class="flex gap-2">
          <Password inputId="cfg-u-senha" v-model="usuario.password" toggleMask :feedback="false" class="flex-1 min-w-0" inputClass="w-full" placeholder="Mínimo de 8 caracteres" />
          <button type="button" class="cfg-btn-quadrado" @click="gerarSenha" v-tooltip.top="'Gerar senha segura'" aria-label="Gerar senha segura"><i class="pi pi-sync"></i></button>
        </div>
        <span class="cfg-ajuda">Envie a senha para a pessoa por um canal seguro. Ela pode trocar depois.</span>
      </div>
    </form>
    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row justify-end gap-2">
        <button type="button" class="cfg-btn-secundario" @click="dialogo = false">Cancelar</button>
        <button type="submit" form="cfg-form-usuario" class="cfg-btn-primario" :disabled="salvando">
          <i :class="['pi text-xs', salvando ? 'pi-spin pi-spinner' : 'pi-check']"></i>{{ editando ? 'Salvar usuário' : 'Adicionar' }}
        </button>
      </div>
    </template>
  </Dialog>
</template>
