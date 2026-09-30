<script setup>
// Aba Permissões (avançada): o que os perfis Gestor e Consulta podem ver e fazer.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import { useConfig, useRascunho } from './useConfiguracoes';
import { VALORES_PERFIL } from './perfis';

const cfg = useConfig();

const MODULOS = [
  { nome: 'Visão geral e relatórios', permissoes: [
    { chave: 'dashboard:ler', label: 'Ver a visão geral e os indicadores' },
    { chave: 'dashboard:exportar', label: 'Baixar os dados em planilha' },
  ] },
  { nome: 'Planos de ação', permissoes: [
    { chave: 'acoes:ler', label: 'Ver as tarefas' },
    { chave: 'acoes:criar', label: 'Criar tarefas' },
    { chave: 'acoes:editar', label: 'Editar tarefas' },
    { chave: 'acoes:mover', label: 'Mudar a etapa das tarefas' },
    { chave: 'acoes:excluir', label: 'Excluir tarefas' },
  ] },
  { nome: 'Clientes', permissoes: [
    { chave: 'clientes:ler', label: 'Ver os clientes' },
    { chave: 'clientes:criar', label: 'Cadastrar clientes e empresas' },
    { chave: 'clientes:editar', label: 'Editar clientes e empresas' },
    { chave: 'clientes:excluir', label: 'Excluir clientes e empresas' },
  ] },
  { nome: 'Envios e respostas', permissoes: [
    { chave: 'audiencia:ler', label: 'Ver os envios e o histórico' },
    { chave: 'audiencia:disparar', label: 'Enviar pesquisas' },
    { chave: 'respostas:ler', label: 'Ver as respostas completas' },
  ] },
];
const COLUNAS = [{ perfil: 'Manager', rotulo: 'Gestor' }, { perfil: 'Viewer', rotulo: 'Consulta' }];

const perm = useRascunho({ Viewer: [], Manager: [] });
const carregando = ref(false);

const carregar = async () => {
  carregando.value = true;
  try {
    const { data } = await api.get('/permissoes');
    if (data.status === 'success') {
      perm.definir({ Viewer: [...(data.permissoes.Viewer || [])].sort(), Manager: [...(data.permissoes.Manager || [])].sort() });
    }
  } catch (e) {
    cfg.erro(e, 'Não foi possível carregar as permissões', 'Atualize a página em alguns segundos.');
  } finally {
    carregando.value = false;
  }
};

const marcado = (perfil, chave) => perm.atual.value[perfil].includes(chave);
const alternar = (perfil, chave) => {
  const lista = perm.atual.value[perfil];
  perm.atual.value[perfil] = (lista.includes(chave) ? lista.filter((c) => c !== chave) : [...lista, chave]).sort();
};

const salvar = async () => {
  try {
    await api.post('/permissoes', [
      { perfil: 'Viewer', chaves: perm.atual.value.Viewer },
      { perfil: 'Manager', chaves: perm.atual.value.Manager },
    ]);
    perm.confirmar();
    cfg.ok('Alterações salvas', 'Permissões dos perfis. Valem a partir do próximo login de cada pessoa.');
    return true;
  } catch (e) {
    cfg.erro(e, 'Não foi possível salvar as permissões', 'Tente novamente.');
    return false;
  }
};
const soltar = cfg.registrarSecao('permissoes', { nome: 'Permissões', alterado: () => perm.alterado.value, salvar, descartar: perm.descartar });
onBeforeUnmount(soltar);

const semPerfil = computed(() => cfg.usuarios.value.filter((u) => !VALORES_PERFIL.includes(u.tipo)));

onMounted(carregar);
</script>

<template>
  <CfgSecao titulo="Permissões por perfil" icone="pi-shield"
    descricao="Escolha o que Gestores e Consulta podem ver e fazer. Administradores sempre têm acesso total.">
    <p v-if="semPerfil.length" class="cfg-aviso mb-4">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ semPerfil.map(u => u.nome).join(', ') }} {{ semPerfil.length === 1 ? 'está' : 'estão' }} sem um destes perfis e não {{ semPerfil.length === 1 ? 'recebe' : 'recebem' }} nenhuma permissão. Ajuste na aba Equipe.</span>
    </p>

    <div v-if="carregando" class="h-64 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
    <div v-else class="flex flex-col gap-5">
      <div v-for="m in MODULOS" :key="m.nome" class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div class="grid grid-cols-[1fr_4.5rem_4.5rem] sm:grid-cols-[1fr_6rem_6rem] items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60">
          <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ m.nome }}</h3>
          <span v-for="c in COLUNAS" :key="c.perfil" class="text-sm font-semibold text-slate-500 dark:text-slate-400 text-center">{{ c.rotulo }}</span>
        </div>
        <div v-for="p in m.permissoes" :key="p.chave" class="grid grid-cols-[1fr_4.5rem_4.5rem] sm:grid-cols-[1fr_6rem_6rem] items-center gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
          <span class="text-sm text-slate-700 dark:text-slate-200">{{ p.label }}</span>
          <label v-for="c in COLUNAS" :key="c.perfil" class="flex justify-center cursor-pointer py-1">
            <span class="sr-only">{{ c.rotulo }}: {{ p.label }}</span>
            <input type="checkbox" class="cfg-check" :checked="marcado(c.perfil, p.chave)" @change="alternar(c.perfil, p.chave)" />
          </label>
        </div>
      </div>
      <p class="text-sm text-slate-500 dark:text-slate-400"><i class="pi pi-info-circle text-xs mr-1"></i>As mudanças valem a partir do próximo login de cada pessoa.</p>
    </div>
  </CfgSecao>
</template>
