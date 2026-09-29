<script setup>
import { ref, onMounted } from 'vue';
import { FilterMatchMode, FilterOperator } from 'primevue/api';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import api from '../services/api';
import { formatarDataLocal } from '../utils/formatters';

const toast = useToast();

// --- ESTADOS DA ABA ---
const abaAtiva = ref(0);

// --- ESTADOS: LOGS DO SISTEMA ---
const logs = ref([]);
const loadingLogs = ref(true);
const filtersLogs = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    nivel: { value: null, matchMode: FilterMatchMode.EQUALS },
    acao: { value: null, matchMode: FilterMatchMode.CONTAINS },
    mensagem: { value: null, matchMode: FilterMatchMode.CONTAINS },
    usuario_nome: { value: null, matchMode: FilterMatchMode.CONTAINS },
    data_criacao: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

// --- ESTADOS: E-MAILS ENVIADOS ---
const emails = ref([]);
const loadingEmails = ref(false);
const dialogEmailVisivel = ref(false);
const emailSelecionado = ref(null);
const filtersEmails = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    destinatario: { value: null, matchMode: FilterMatchMode.CONTAINS },
    assunto: { value: null, matchMode: FilterMatchMode.CONTAINS },
    status: { value: null, matchMode: FilterMatchMode.EQUALS }
});

// --- FUNÇÕES DOS LOGS ---
const carregarLogs = async () => {
    loadingLogs.value = true;
    try {
        const response = await api.get('/logs'); 
        logs.value = response.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar os logs do sistema.', life: 5000 });
    } finally {
        loadingLogs.value = false;
    }
};

const getBadgeClass = (nivel) => {
    const level = (nivel || '').toUpperCase();
    if (level === 'ERROR' || level === 'FALHA') return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30';
    if (level === 'WARN' || level === 'PENDENTE') return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30';
    if (level === 'SUCCESS' || level === 'ENVIADO') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30';
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30';
};

// --- FUNÇÕES DOS E-MAILS ---
const carregarEmails = async () => {
    loadingEmails.value = true;
    try {
        // 🎯 O seu backend precisará desta rota
        const response = await api.get('/logs/emails'); 
        emails.value = response.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar o histórico de e-mails.', life: 5000 });
    } finally {
        loadingEmails.value = false;
    }
};

const onTabChange = (e) => {
    // Carrega os emails apenas quando o usuário clica na aba pela primeira vez (Lazy Load)
    if (e.index === 1 && emails.value.length === 0) {
        carregarEmails();
    }
};

const verDetalhesEmail = (dados) => {
    emailSelecionado.value = dados;
    dialogEmailVisivel.value = true;
};

onMounted(() => {
    carregarLogs();
});
</script>

<template>
  <div class="p-6 md:p-8 animate-fadein">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight italic">
          Auditoria <span class="text-orange-500">.</span>
        </h1>
        <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">Registro de atividades, disparos e erros do sistema.</p>
      </div>
    </div>

    <TabView v-model:activeIndex="abaAtiva" @tab-change="onTabChange" class="custom-tabs">
      
      <TabPanel header="Logs do Sistema">
        <div class="flex justify-end mb-4">
          <span class="p-input-icon-left w-full md:w-auto relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <InputText v-model="filtersLogs['global'].value" placeholder="Pesquisar nos logs..." class="w-full md:w-80 custom-input pl-10" />
          </span>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/60 dark:border-slate-800 overflow-hidden">
          <DataTable :value="logs" :paginator="true" :rows="15" v-model:filters="filtersLogs" :loading="loadingLogs"
            :globalFilterFields="['nivel', 'acao', 'mensagem', 'usuario_nome']" responsiveLayout="scroll" class="p-datatable-sm" rowHover>
            
            <Column field="nivel" header="Nível" :sortable="true" style="width: 10%">
              <template #body="slotProps">
                <span :class="getBadgeClass(slotProps.data.nivel)" class="font-black text-[10px] tracking-widest uppercase px-2 py-1 rounded-md">
                  {{ slotProps.data.nivel }}
                </span>
              </template>
            </Column>

            <Column field="data_criacao" header="Data/Hora" :sortable="true" style="width: 15%">
              <template #body="slotProps">
                <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {{ formatarDataLocal(slotProps.data.data_criacao) }}
                </span>
              </template>
            </Column>

            <Column field="acao" header="Ação" :sortable="true" style="width: 15%">
              <template #body="slotProps">
                <span class="text-slate-500 dark:text-slate-400 font-black tracking-widest uppercase text-[9px] bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                  {{ slotProps.data.acao || 'N/A' }}
                </span>
              </template>
            </Column>

            <Column field="mensagem" header="Mensagem" style="width: 45%">
              <template #body="slotProps">
                <span class="text-slate-700 dark:text-slate-200 block truncate max-w-[400px] text-xs font-medium" :title="slotProps.data.mensagem">
                  {{ slotProps.data.mensagem }}
                </span>
              </template>
            </Column>

            <Column field="usuario_nome" header="Origem" :sortable="true" style="width: 15%">
              <template #body="slotProps">
                <div class="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  <i :class="slotProps.data.usuario_nome === 'Sistema/Robô' ? 'pi pi-cog text-orange-500' : 'pi pi-user text-slate-400'"></i>
                  <span class="truncate">{{ slotProps.data.usuario_nome }}</span>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </TabPanel>

      <TabPanel header="Disparos de E-mail">
        <div class="flex justify-end mb-4">
          <span class="p-input-icon-left w-full md:w-auto relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <InputText v-model="filtersEmails['global'].value" placeholder="Pesquisar destinatário ou assunto..." class="w-full md:w-80 custom-input pl-10" />
          </span>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/60 dark:border-slate-800 overflow-hidden">
          <DataTable :value="emails" :paginator="true" :rows="15" v-model:filters="filtersEmails" :loading="loadingEmails"
            :globalFilterFields="['destinatario', 'assunto', 'status']" responsiveLayout="scroll" class="p-datatable-sm" rowHover>
            
            <template #empty>
              <div class="text-center py-12">
                <i class="pi pi-envelope text-4xl text-slate-300 mb-3 block"></i>
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Nenhum e-mail disparado encontrado.</span>
              </div>
            </template>

            <Column field="status" header="Status" :sortable="true" style="width: 12%">
              <template #body="slotProps">
                <span :class="getBadgeClass(slotProps.data.status)" class="font-black text-[9px] tracking-widest uppercase px-2 py-1 rounded-md flex items-center gap-1.5 w-max">
                  <i :class="slotProps.data.status === 'Enviado' ? 'pi pi-check' : slotProps.data.status === 'Falha' ? 'pi pi-times' : 'pi pi-clock'" class="text-[8px]"></i>
                  {{ slotProps.data.status }}
                </span>
              </template>
            </Column>

            <Column field="data_envio" header="Data de Disparo" :sortable="true" style="width: 18%">
              <template #body="slotProps">
                <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {{ formatarDataLocal(slotProps.data.data_envio || slotProps.data.created_at) }}
                </span>
              </template>
            </Column>

            <Column field="destinatario" header="Destinatário" :sortable="true" style="width: 25%">
              <template #body="slotProps">
                <div class="flex flex-col">
                  <span class="text-[11px] font-bold text-slate-800 dark:text-white">{{ slotProps.data.nome_cliente || 'Cliente' }}</span>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5"><i class="pi pi-envelope text-[8px] mr-1"></i>{{ slotProps.data.destinatario }}</span>
                </div>
              </template>
            </Column>

            <Column field="assunto" header="Assunto / Tipo" :sortable="true" style="width: 35%">
              <template #body="slotProps">
                <span class="text-slate-700 dark:text-slate-200 font-medium text-xs truncate max-w-[300px] block" :title="slotProps.data.assunto">
                  {{ slotProps.data.assunto }}
                </span>
              </template>
            </Column>

            <Column header="Detalhes" style="width: 10%" alignFrozen="right">
              <template #body="slotProps">
                <Button icon="pi pi-eye" class="p-button-rounded p-button-text p-button-sm !text-slate-400 hover:!text-orange-500 transition-colors" v-tooltip.top="'Ver conteúdo'" @click="verDetalhesEmail(slotProps.data)" />
              </template>
            </Column>

          </DataTable>
        </div>
      </TabPanel>
    </TabView>

    <Dialog v-model:visible="dialogEmailVisivel" :modal="true" :style="{width: '600px'}" :closable="false" class="rounded-[2.5rem] overflow-hidden p-0 custom-dialog-no-header shadow-2xl">
      <div class="bg-slate-900 text-white p-6 flex justify-between items-center relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl"></div>
        <div class="relative z-10">
          <h2 class="text-lg font-black italic tracking-tight flex items-center gap-2">
            <i class="pi pi-envelope text-orange-500"></i> Auditoria de Mensagem
          </h2>
        </div>
        <button @click="dialogEmailVisivel = false" class="text-slate-400 hover:text-white transition-colors relative z-10 p-2"><i class="pi pi-times text-xl"></i></button>
      </div>

      <div class="p-6 bg-white dark:bg-slate-900 space-y-4" v-if="emailSelecionado">
        
        <div class="flex flex-col gap-1 pb-4 border-b border-slate-100 dark:border-slate-800">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Assunto</span>
          <span class="text-sm font-bold text-slate-800 dark:text-white">{{ emailSelecionado.assunto }}</span>
        </div>

        <div class="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div class="flex flex-col gap-1">
            <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Enviado Para</span>
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ emailSelecionado.destinatario }}</span>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Data de Disparo</span>
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ formatarDataLocal(emailSelecionado.data_envio || emailSelecionado.created_at) }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-2 pt-2">
           <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Corpo do E-mail / Log Técnico</span>
           <div class="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-slate-100 dark:border-slate-700">
              {{ emailSelecionado.mensagem || emailSelecionado.corpo_email || 'Conteúdo não armazenado no log.' }}
           </div>
        </div>

      </div>
    </Dialog>

  </div>
</template>

<style scoped lang="postcss">
@reference "tailwindcss";

.animate-fadein { 
  animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
}
@keyframes fadeIn { 
  from { opacity: 0; transform: translateY(10px); } 
  to { opacity: 1; transform: translateY(0); } 
}

/* ==========================================
   🎨 ESTILOS DAS ABAS (TABVIEW)
   ========================================== */
:deep(.custom-tabs .p-tabview-nav) {
  @apply bg-transparent border-b border-slate-200 dark:border-slate-800 mb-6;
}
:deep(.custom-tabs .p-tabview-nav li .p-tabview-nav-link) {
  @apply bg-transparent border-none text-slate-400 font-black tracking-widest uppercase text-[11px] pb-4 transition-colors shadow-none outline-none;
}
:deep(.custom-tabs .p-tabview-nav li:not(.p-highlight) .p-tabview-nav-link:hover) {
  @apply text-slate-600 dark:text-slate-300;
}
:deep(.custom-tabs .p-tabview-nav li.p-highlight .p-tabview-nav-link) {
  @apply text-orange-500 border-b-2 border-orange-500;
}
:deep(.custom-tabs .p-tabview-panels) {
  @apply bg-transparent p-0;
}

/* ==========================================
   🎨 INPUTS E TABELAS
   ========================================== */
:deep(.custom-input) {
  @apply bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm focus:border-orange-500 dark:focus:border-orange-500 outline-none transition-all;
}

:deep(.p-datatable .p-datatable-thead > tr > th) {
  @apply bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest py-4 border-b border-slate-200 dark:border-slate-800;
}

:deep(.p-datatable .p-datatable-tbody > tr) {
  @apply bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
  @apply py-3;
}

/* ==========================================
   🪟 CUSTOMIZAÇÃO DO DIALOG
   ========================================== */
:deep(.custom-dialog-no-header .p-dialog-header) {
  display: none !important;
}
:deep(.custom-dialog-no-header .p-dialog-content) {
  padding: 0 !important;
  @apply dark:bg-slate-900;
}
</style>