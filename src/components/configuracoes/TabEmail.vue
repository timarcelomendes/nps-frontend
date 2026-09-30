<script setup>
// Aba E-mail: liga/pausa todos os envios, mostra o remetente e edita os modelos de e-mail.
import { ref, computed } from 'vue';
import InputSwitch from 'primevue/inputswitch';
import api from '../../services/api';
import CfgSecao from './CfgSecao.vue';
import EditorModelos from './EditorModelos.vue';
import BancoImagens from './BancoImagens.vue';
import { useConfig } from './useConfiguracoes';

const cfg = useConfig();
const email = cfg.email;

const PROVEDORES = { zeptomail: 'Zoho ZeptoMail', resend: 'Resend' };
const remetente = computed(() => {
  const e = email.value;
  if (e.remetente_nome) return `${e.remetente_nome} <${e.remetente_email}>`;
  return e.remetente_email || '—';
});

const salvandoChave = ref(false);
const alternarEnvios = async (valor) => {
  const anterior = email.value.envios_ativos;
  email.value.envios_ativos = valor;
  salvandoChave.value = true;
  const ok = await cfg.salvarEmail({
    titulo: valor ? 'E-mails ligados' : 'E-mails pausados',
    texto: valor ? 'Convites, lembretes e agradecimentos voltam a sair.' : 'Nenhum e-mail de pesquisa sai até você ligar de novo.',
  });
  if (!ok) email.value.envios_ativos = anterior;
  salvandoChave.value = false;
};

const enviandoTeste = ref(false);
const enviarTeste = async () => {
  enviandoTeste.value = true;
  try {
    await api.post('/config/email/teste');
    cfg.ok('E-mail de teste enviado', `Confira a caixa de entrada de ${cfg.meuEmail || 'seu e-mail'}.`);
  } catch (e) {
    cfg.erro(e, 'O teste falhou', 'Não foi possível enviar o e-mail de teste.');
  } finally {
    enviandoTeste.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-5">
    <CfgSecao titulo="Envio de e-mails" icone="pi-envelope" selo="essencial"
      descricao="Chave geral: desligada, nenhum convite, lembrete ou agradecimento é enviado.">
      <div class="flex flex-col md:flex-row md:items-center gap-4">
        <label class="flex items-center gap-3 flex-1 cursor-pointer">
          <InputSwitch :modelValue="email.envios_ativos" @update:modelValue="alternarEnvios" :disabled="salvandoChave" class="cfg-switch" inputId="cfg-envios" />
          <span>
            <span class="block text-sm font-semibold" :class="email.envios_ativos ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'">
              {{ email.envios_ativos ? 'Ligado: os e-mails estão saindo' : 'Pausado: nenhum e-mail sai' }}
            </span>
            <span class="block text-sm text-slate-500 dark:text-slate-400">As datas continuam sendo contadas enquanto estiver pausado. Salva na hora.</span>
          </span>
        </label>
        <button class="cfg-btn-secundario" :disabled="enviandoTeste || !cfg.emailPronto.value" @click="enviarTeste">
          <i :class="['pi text-xs', enviandoTeste ? 'pi-spin pi-spinner' : 'pi-send']"></i>Enviar e-mail de teste para mim
        </button>
      </div>

      <dl class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
        <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 min-w-0">
          <dt class="text-sm font-semibold text-slate-600 dark:text-slate-300">Quem aparece como remetente</dt>
          <dd class="text-sm text-slate-800 dark:text-slate-100 mt-0.5 break-all">{{ remetente }}</dd>
        </div>
        <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
          <dt class="text-sm font-semibold text-slate-600 dark:text-slate-300">Serviço de envio</dt>
          <dd class="text-sm mt-0.5 flex items-center gap-2">
            <span v-if="cfg.emailPronto.value" class="text-slate-800 dark:text-slate-100"><i class="pi pi-check-circle text-emerald-500 mr-1"></i>{{ PROVEDORES[email.provedor] || email.provedor }} (gerenciado pela Rakiti)</span>
            <span v-else class="text-amber-700 dark:text-amber-300"><i class="pi pi-exclamation-triangle mr-1"></i>Não configurado. Fale com o suporte.</span>
          </dd>
        </div>
      </dl>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-3">Você não precisa configurar servidor de e-mail: a Rakiti cuida do envio.</p>
    </CfgSecao>

    <CfgSecao titulo="Texto dos e-mails" icone="pi-pencil" selo="opcional"
      descricao="Personalize o convite, os lembretes e os agradecimentos. Em branco, a Rakiti usa um modelo pronto.">
      <EditorModelos />
    </CfgSecao>

    <CfgSecao titulo="Imagens para os e-mails" icone="pi-images" selo="opcional"
      descricao="Hospede aqui as imagens usadas nos seus modelos personalizados.">
      <BancoImagens />
    </CfgSecao>
  </div>
</template>
