<script setup>
// Tabela para cadastros que só têm nome (grupos, segmentos, perfis e cargos).
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import EstadoVazio from './EstadoVazio.vue';

defineProps({
  cadastro: { type: Object, required: true }, // { titulo, coluna, singular, icone, descricao }
  itens: { type: Array, default: () => [] },
  filtros: { type: Object, required: true },
  buscando: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  podeCriar: { type: Boolean, default: false },
  podeEditar: { type: Boolean, default: false },
  podeExcluir: { type: Boolean, default: false },
});
defineEmits(['novo', 'editar', 'excluir', 'limpar-busca']);
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <p class="text-sm text-slate-500 dark:text-slate-400 max-w-xl">{{ cadastro.descricao }}</p>
      <button v-if="podeCriar" @click="$emit('novo')" class="cli-btn-primario">
        <i class="pi pi-plus text-xs"></i>Novo {{ cadastro.singular }}
      </button>
    </div>

    <DataTable :value="itens" :filters="filtros" :globalFilterFields="['nome']" :loading="loading"
      :paginator="itens.length > 10" :rows="10" sortField="nome" :sortOrder="1" dataKey="id"
      responsiveLayout="stack" breakpoint="640px" class="cli-tabela" rowHover>
      <template #empty>
        <EstadoVazio v-if="buscando" icone="pi-search" titulo="Nada encontrado" texto="Nenhum item corresponde à busca.">
          <button @click="$emit('limpar-busca')" class="cli-btn-secundario">Limpar busca</button>
        </EstadoVazio>
        <EstadoVazio v-else-if="!loading" :icone="cadastro.icone" :titulo="`Nenhum ${cadastro.singular} cadastrado`">
          <button v-if="podeCriar" @click="$emit('novo')" class="cli-btn-primario"><i class="pi pi-plus text-xs"></i>Cadastrar {{ cadastro.singular }}</button>
        </EstadoVazio>
      </template>

      <Column field="nome" :header="cadastro.coluna" sortable>
        <template #body="{ data }">
          <span class="font-medium text-slate-800 dark:text-slate-100">{{ data.nome }}</span>
        </template>
      </Column>
      <Column header="Ações" style="width: 110px">
        <template #body="{ data }">
          <div class="flex gap-1 justify-end">
            <button v-if="podeEditar" @click="$emit('editar', data)" class="cli-btn-icone" v-tooltip.top="'Editar'" :aria-label="`Editar ${data.nome}`"><i class="pi pi-pencil"></i></button>
            <button v-if="podeExcluir" @click="$emit('excluir', data)" class="cli-btn-icone cli-btn-perigo" v-tooltip.top="'Excluir'" :aria-label="`Excluir ${data.nome}`"><i class="pi pi-trash"></i></button>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
