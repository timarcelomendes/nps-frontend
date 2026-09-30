<script setup>
// Cartão de uma ação no quadro. A ação principal muda conforme a coluna.
import { computed } from 'vue';
import { origem, tituloCurto, resumoDescricao, corPrazo, iniciais, statusDe, dataCriacao } from './acoesUtils';

const props = defineProps({
  acao: { type: Object, required: true },
  prazo: { type: Object, default: null },
  gestor: { type: Object, default: null }, // { nome, avatar }
  grupo: { type: String, default: '' },
  podeMover: { type: Boolean, default: false },
  podeEditar: { type: Boolean, default: false },
  temMenu: { type: Boolean, default: false },
});
const emit = defineEmits(['abrir', 'comecar', 'registrar', 'menu']);

const status = computed(() => statusDe(props.acao));
const nota = computed(() => origem(props.acao));
const resumo = computed(() => resumoDescricao(props.acao));
const vencida = computed(() => props.prazo?.nivel === 'vencido');
// Títulos automáticos repetem o nome da empresa; nesse caso mostramos o que fazer.
const PROXIMO_PASSO = { detrator: 'Cliente insatisfeito: entender e resolver', neutro: 'Cliente neutro: descobrir o que falta', promotor: 'Cliente satisfeito: agradecer o retorno' };
const titulo = computed(() => {
  const t = tituloCurto(props.acao.titulo);
  return t === props.acao.empresa_nome && PROXIMO_PASSO[nota.value.tipo] ? PROXIMO_PASSO[nota.value.tipo] : t;
});
const criadaEm = computed(() => dataCriacao(props.acao)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) || '');
</script>

<template>
  <article
    @click="emit('abrir')"
    @keydown.enter.self="emit('abrir')"
    tabindex="0"
    :aria-label="`Ação ${acao.id}: ${titulo}`"
    class="relative bg-white dark:bg-slate-900 rounded-xl border p-4 flex flex-col gap-3 shadow-sm cursor-pointer transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
    :class="vencida
      ? 'border-rose-300 dark:border-rose-500/50 border-l-4 border-l-rose-500 dark:border-l-rose-500'
      : 'border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-500/40'">

    <!-- Quem e de onde veio -->
    <div class="flex items-start gap-3">
      <span :class="['min-w-10 h-8 px-1.5 shrink-0 rounded-lg text-sm font-bold flex items-center justify-center', nota.cor]" v-tooltip.top="nota.dica">{{ nota.rotulo }}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ acao.empresa_nome || 'Sem empresa' }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
          <span v-if="grupo">{{ grupo }} · </span>#{{ acao.id }} · criada em {{ criadaEm }}
        </p>
      </div>
      <button v-if="temMenu" type="button" @click.stop="emit('menu', $event)" @keydown.enter.stop
        class="w-8 h-8 -mr-1 -mt-1 shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Mais opções" title="Mover, editar ou excluir">
        <i class="pi pi-ellipsis-v text-sm"></i>
      </button>
    </div>

    <!-- O quê -->
    <div>
      <h3 class="text-sm font-semibold text-slate-900 dark:text-white leading-snug">{{ titulo }}</h3>
      <p v-if="status === 'Concluído' && acao.resolucao" class="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-line">
        <span class="font-semibold text-emerald-700 dark:text-emerald-400">Feito: </span>{{ acao.resolucao }}
      </p>
      <p v-else-if="resumo" class="mt-1.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-line" :class="{ italic: resumo.citacao }">
        {{ resumo.citacao ? `"${resumo.texto}"` : resumo.texto }}
      </p>
    </div>

    <!-- Prazo, responsável e próximo passo -->
    <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
      <span v-if="prazo" :class="['inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold', corPrazo(prazo.nivel)]"
        v-tooltip.top="prazo.nivel === 'ok' ? `Faltam ${prazo.diff} dias` : `Prazo: ${prazo.data}`">
        <i :class="['pi text-xs', prazo.nivel === 'vencido' ? 'pi-exclamation-circle' : 'pi-clock']"></i>{{ prazo.texto }}
      </span>
      <span v-else-if="status === 'Concluído'" class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        <i class="pi pi-check text-xs"></i>Concluída
      </span>

      <span class="flex items-center gap-1.5 min-w-0 text-xs text-slate-600 dark:text-slate-300" :title="gestor?.nome ? `Responsável: ${gestor.nome}` : 'Ninguém responsável ainda'">
        <span class="w-6 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <img v-if="gestor?.avatar" :src="gestor.avatar" alt="" class="w-full h-full object-cover" @error="(e) => e.target.remove()" />
          <template v-else-if="gestor?.nome">{{ iniciais(gestor.nome) }}</template>
          <i v-else class="pi pi-user text-xs text-slate-400"></i>
        </span>
        <span class="truncate max-w-[9rem]" :class="{ 'italic text-slate-400': !gestor?.nome }">{{ gestor?.nome || 'Sem responsável' }}</span>
      </span>

      <span v-if="acao.prioridade === 'Alta' && status !== 'Concluído'" class="text-xs font-semibold text-orange-600 dark:text-orange-400" title="Prioridade alta">
        <i class="pi pi-flag-fill text-xs mr-0.5"></i>Alta
      </span>

      <button v-if="status === 'Pendente' && podeMover" type="button" @click.stop="emit('comecar')" @keydown.enter.stop
        class="ml-auto h-8 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold"
        title="Passa a ação para Em andamento">
        Começar
      </button>
      <button v-else-if="status === 'Em Andamento' && podeEditar" type="button" @click.stop="emit('registrar')" @keydown.enter.stop
        class="ml-auto h-8 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold"
        title="Anote o que foi feito com o cliente e conclua">
        Registrar contato
      </button>
    </div>
  </article>
</template>
