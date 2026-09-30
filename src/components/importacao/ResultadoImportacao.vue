<script setup>
// Resumo do fim da importação, com o próximo passo.
import { useRouter } from 'vue-router';

defineProps({
  tipo: { type: String, required: true },
  resumo: { type: Object, required: true },
  // { processados, novos, atualizados (null = não dá para separar), naoImportados, descartados, detalhes: [{email, motivo}] }
});
const emit = defineEmits(['reiniciar']);
const router = useRouter();

const nome = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
const TRADUCAO = {
  'Cliente não existe no banco.': 'Esse e-mail não está cadastrado. Importe primeiro a planilha de clientes.',
  'Falta coluna de identificação.': 'A coluna usada para reconhecer o contato está vazia nesta linha.',
  'Resposta já existe e overwrite=False.': 'Essa resposta já estava cadastrada e foi mantida como estava.',
};
const motivo = (m) => TRADUCAO[m] || (String(m).startsWith('Nota inválida') ? 'A nota precisa ser um número inteiro de 0 a 10.' : m);
</script>

<template>
  <section class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-8 flex flex-col gap-6">
    <div class="flex items-start gap-4">
      <span :class="['w-12 h-12 rounded-full flex items-center justify-center shrink-0', resumo.processados > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400']">
        <i :class="['pi text-xl', resumo.processados > 0 ? 'pi-check' : 'pi-exclamation-triangle']"></i>
      </span>
      <div class="min-w-0">
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ resumo.processados > 0 ? 'Importação concluída' : 'Nenhuma linha foi importada' }}</h2>
        <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
          <template v-if="tipo === 'clientes' && resumo.processados > 0">Seus contatos já estão na fila de envios. O próximo passo é mandar a primeira pesquisa.</template>
          <template v-else-if="resumo.processados > 0">As respostas já aparecem nos relatórios e na tela de Respostas.</template>
          <template v-else>Confira os motivos abaixo, corrija a planilha e envie de novo.</template>
        </p>
      </div>
    </div>

    <dl class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <template v-if="resumo.atualizados !== null">
        <div class="imp-numero"><dt>Novos</dt><dd>{{ resumo.novos.toLocaleString('pt-BR') }}</dd></div>
        <div class="imp-numero"><dt>Atualizados</dt><dd>{{ resumo.atualizados.toLocaleString('pt-BR') }}</dd></div>
      </template>
      <div v-else class="imp-numero sm:col-span-2"><dt>Importados (novos ou atualizados)</dt><dd>{{ resumo.processados.toLocaleString('pt-BR') }}</dd></div>
      <div class="imp-numero"><dt>Não importados</dt><dd :class="resumo.naoImportados + resumo.descartados > 0 ? 'text-rose-600! dark:text-rose-400!' : ''">{{ (resumo.naoImportados + resumo.descartados).toLocaleString('pt-BR') }}</dd></div>
    </dl>

    <div v-if="resumo.descartados > 0 || resumo.naoImportados > 0" class="flex flex-col gap-2">
      <p v-if="resumo.descartados > 0" class="text-sm text-slate-600 dark:text-slate-300">
        {{ nome(resumo.descartados, 'linha tinha problema na planilha e ficou de fora', 'linhas tinham problema na planilha e ficaram de fora') }}.
      </p>
      <p v-if="resumo.naoImportados > 0 && !resumo.detalhes.length" class="text-sm text-slate-600 dark:text-slate-300">
        {{ nome(resumo.naoImportados, 'linha foi recusada', 'linhas foram recusadas') }} pelo sistema: o contato já existia e a opção de atualizar estava desligada, ou a coluna de identificação estava vazia.
      </p>
      <ul v-if="resumo.detalhes.length" class="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="(d, i) in resumo.detalhes" :key="i" class="px-3 py-2 text-sm">
          <span class="font-semibold text-slate-800 dark:text-slate-100 break-all">{{ d.email }}</span>
          <span class="text-slate-600 dark:text-slate-300"> — {{ motivo(d.motivo) }}</span>
        </li>
      </ul>
    </div>

    <div class="flex flex-col sm:flex-row flex-wrap gap-2">
      <template v-if="tipo === 'clientes'">
        <button v-if="resumo.processados > 0" @click="router.push('/audiencia')" class="imp-btn-primario"><i class="pi pi-send text-xs"></i>Enviar primeira pesquisa</button>
        <button @click="router.push('/clientes')" class="imp-btn-secundario"><i class="pi pi-users text-xs"></i>Ver clientes</button>
      </template>
      <button v-else @click="router.push('/respostas')" class="imp-btn-primario"><i class="pi pi-comments text-xs"></i>Ver respostas</button>
      <button @click="emit('reiniciar')" class="imp-btn-secundario"><i class="pi pi-upload text-xs"></i>Importar outra planilha</button>
    </div>
  </section>
</template>
