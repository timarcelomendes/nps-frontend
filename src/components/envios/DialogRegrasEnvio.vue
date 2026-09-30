<script setup>
// Regras de envio: envio automático, intervalo entre pesquisas e lembretes.
// O backend grava TODAS as regras de uma vez; por isso reenviamos o conjunto completo
// que veio de GET /config/regras, trocando só os campos desta tela.
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import InputSwitch from 'primevue/inputswitch';
import InputNumber from 'primevue/inputnumber';
import api from '../../services/api';
import { detalheDoErro } from './mensagens';

const props = defineProps({
  visible: Boolean,
  regras: { type: Object, default: () => ({}) },
  enviosAtivos: Boolean,
});
const emit = defineEmits(['update:visible', 'salvo']);
const toast = useToast();

const CAMPOS_NUMERICOS = ['scheduler_horas', 'sla_detrator_dias', 'sla_neutro_dias', 'sla_promotor_dias', 'recorrencia_dias',
  'lembrete_qtd_maxima', 'lembrete_dias_1', 'lembrete_dias_2', 'lembrete_dias_3'];
const OPCOES_LEMBRETES = [0, 1, 2, 3];

const form = ref({});
const salvando = ref(false);

const num = (v, padrao) => { const n = parseInt(v, 10); return Number.isNaN(n) ? padrao : n; };

watch(() => props.visible, (aberto) => {
  if (!aberto) return;
  const r = props.regras || {};
  form.value = {
    robo_ativo: String(r.robo_ativo).toLowerCase() === 'true',
    recorrencia_dias: num(r.recorrencia_dias, 90),
    lembrete_qtd_maxima: Math.min(num(r.lembrete_qtd_maxima, 2), 3),
    lembrete_dias_1: num(r.lembrete_dias_1, 3),
    lembrete_dias_2: num(r.lembrete_dias_2, 7),
    lembrete_dias_3: num(r.lembrete_dias_3, 15),
  };
});

const fechar = () => emit('update:visible', false);

const salvar = async () => {
  const f = form.value;
  if (!f.recorrencia_dias || f.recorrencia_dias < 1) {
    toast.add({ severity: 'warn', summary: 'Confira o intervalo', detail: 'O intervalo entre pesquisas precisa ser de pelo menos 1 dia.', life: 4000 });
    return;
  }
  for (let i = 2; i <= f.lembrete_qtd_maxima; i++) {
    if (f[`lembrete_dias_${i}`] <= f[`lembrete_dias_${i - 1}`]) {
      toast.add({ severity: 'warn', summary: 'Confira os lembretes', detail: `O ${i}º lembrete precisa sair depois do ${i - 1}º.`, life: 4000 });
      return;
    }
  }
  salvando.value = true;
  try {
    const payload = { ...props.regras };
    // campos numéricos vazios fariam o backend recusar o conjunto inteiro
    CAMPOS_NUMERICOS.forEach(c => { if (payload[c] === '' || payload[c] === null) delete payload[c]; });
    Object.assign(payload, f);
    await api.post('/config/regras', payload);
    toast.add({ severity: 'success', summary: 'Regras salvas', detail: 'As regras de envio foram atualizadas.', life: 3000 });
    emit('salvo', { ...props.regras, ...f, robo_ativo: f.robo_ativo ? 'true' : 'false' });
    fechar();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Não foi possível salvar', detail: detalheDoErro(error) || 'Tente de novo em instantes.', life: 5000 });
  } finally {
    salvando.value = false;
  }
};
</script>

<template>
  <Dialog :visible="visible" @update:visible="emit('update:visible', $event)" header="Regras de envio" modal :draggable="false"
    class="env-dialog" :style="{ width: '480px' }" :breakpoints="{ '640px': '94vw' }">
    <div class="flex flex-col gap-5">
      <label class="flex items-start justify-between gap-4 cursor-pointer">
        <span>
          <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100">Envio automático</span>
          <span class="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">A cada 6 horas o sistema confere a fila e envia a pesquisa para quem está na vez.</span>
        </span>
        <InputSwitch v-model="form.robo_ativo" class="env-switch shrink-0 mt-0.5" ariaLabel="Envio automático" />
      </label>
      <p v-if="form.robo_ativo && !enviosAtivos" class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
        O envio de e-mails está desligado em Configurações. Enquanto estiver desligado, nada sai sozinho.
      </p>

      <div class="env-campo">
        <label for="env-recorrencia">Intervalo entre pesquisas para a mesma pessoa</label>
        <div class="flex items-center gap-2">
          <InputNumber inputId="env-recorrencia" v-model="form.recorrencia_dias" :min="1" :max="730" :useGrouping="false" class="w-28" />
          <span class="text-sm text-slate-600 dark:text-slate-300">dias</span>
        </div>
        <small class="text-sm text-slate-500 dark:text-slate-400">Depois de receber, a pessoa só volta para a fila depois desse prazo.</small>
      </div>

      <div class="env-campo">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Lembretes para quem não respondeu</span>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Quantidade de lembretes">
          <button v-for="q in OPCOES_LEMBRETES" :key="q" type="button" role="radio" :aria-checked="form.lembrete_qtd_maxima === q"
            @click="form.lembrete_qtd_maxima = q"
            class="h-9 px-3 rounded-lg border text-sm font-semibold transition-colors"
            :class="form.lembrete_qtd_maxima === q ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/50' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-300'">
            {{ q === 0 ? 'Nenhum' : q === 1 ? '1 lembrete' : `${q} lembretes` }}
          </button>
        </div>
        <div v-if="form.lembrete_qtd_maxima > 0" class="flex flex-col gap-2 mt-2">
          <div v-for="i in form.lembrete_qtd_maxima" :key="i" class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <label :for="`env-lemb-${i}`" class="w-24 shrink-0">{{ i }}º lembrete</label>
            <InputNumber :inputId="`env-lemb-${i}`" v-model="form[`lembrete_dias_${i}`]" :min="1" :max="90" :useGrouping="false" class="w-20" />
            <span>dias depois do envio</span>
          </div>
          <small class="text-sm text-slate-500 dark:text-slate-400">Os lembretes saem todo dia às 10h20 e param assim que a pessoa responde.</small>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button @click="fechar" class="env-btn-secundario">Cancelar</button>
        <button @click="salvar" :disabled="salvando" class="env-btn-primario">
          <i :class="['pi text-xs', salvando ? 'pi-spin pi-spinner' : 'pi-check']"></i>Salvar regras
        </button>
      </div>
    </template>
  </Dialog>
</template>
