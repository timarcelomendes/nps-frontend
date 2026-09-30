<script setup>
// Termos de uso e política de privacidade (modelo inicial: revisar com um advogado antes de vender).
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const EMPRESA = 'Rakiti';
const CONTATO = 'contato@rakiti.com';
const privacidade = computed(() => route.name === 'Privacidade');
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-10">
    <article class="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-10 text-slate-700 dark:text-slate-300 leading-relaxed">
      <a href="/cadastro" class="text-sm text-orange-600 hover:underline">← Voltar</a>

      <template v-if="!privacidade">
        <h1 class="text-2xl font-black text-slate-900 dark:text-white mt-4">Termos de uso</h1>
        <p class="text-sm text-slate-500 mb-6">Última atualização: setembro de 2026</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">1. O serviço</h2>
        <p>A {{ EMPRESA }} é uma plataforma para empresas enviarem pesquisas de satisfação (NPS e CSAT) aos seus clientes, acompanharem os resultados e tratarem as avaliações negativas.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">2. Conta e teste grátis</h2>
        <p>Quem cria a conta declara ter poderes para representar a empresa cadastrada. O período de teste é gratuito e não exige cartão. Ao final, os envios de pesquisa ficam pausados até a contratação de um plano; os dados continuam guardados.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">3. Planos, pagamento e cancelamento</h2>
        <p>Os planos são mensais e cobrados antecipadamente por meio do Asaas (Pix, boleto ou cartão). O cancelamento pode ser feito a qualquer momento na tela Assinatura e vale para as cobranças seguintes; não há multa nem devolução proporcional do mês em curso. Com pagamento em atraso por mais de 7 dias, os envios são pausados até a confirmação.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">4. Uso adequado</h2>
        <p>A empresa cliente só deve cadastrar contatos com quem tem relação comercial e deve respeitar a legislação aplicável, incluindo a LGPD e as regras contra envio de mensagens não solicitadas. É proibido usar a plataforma para propaganda em massa, conteúdo ilícito ou para se passar por outra pessoa ou empresa.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">5. Dados da empresa cliente</h2>
        <p>Os contatos e respostas pertencem à empresa cliente. A {{ EMPRESA }} os trata apenas para prestar o serviço, conforme a Política de Privacidade. A empresa pode exportar seus dados a qualquer momento.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">6. Disponibilidade e responsabilidade</h2>
        <p>Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. A responsabilidade da {{ EMPRESA }} fica limitada ao valor pago nos últimos 12 meses.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">7. Contato</h2>
        <p>Dúvidas: {{ CONTATO }}.</p>
      </template>

      <template v-else>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white mt-4">Política de privacidade</h1>
        <p class="text-sm text-slate-500 mb-6">Última atualização: setembro de 2026</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">1. Quem somos</h2>
        <p>A {{ EMPRESA }} é a controladora dos dados de quem cria conta na plataforma e operadora dos dados que as empresas clientes cadastram (os contatos que recebem pesquisas).</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">2. Dados que tratamos</h2>
        <ul class="list-disc pl-6">
          <li>Usuários da plataforma: nome, e-mail, telefone, senha (guardada de forma cifrada) e registros de acesso.</li>
          <li>Cobrança: razão social, CNPJ ou CPF e e-mail de faturamento, compartilhados com o Asaas para emitir as faturas.</li>
          <li>Contatos das empresas clientes: nome, e-mail, telefone, empresa e as respostas às pesquisas.</li>
        </ul>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">3. Para que usamos</h2>
        <p>Para prestar o serviço (enviar pesquisas, lembretes e relatórios), cobrar, dar suporte, manter a segurança e cumprir obrigações legais. Não vendemos dados. Resumos de IA são gerados a partir dos comentários do período, apenas quando a empresa cliente pede.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">4. Com quem compartilhamos</h2>
        <p>Com fornecedores necessários para operar o serviço: hospedagem (Render), envio de e-mails (Zoho ZeptoMail), cobrança (Asaas) e IA (OpenAI). Todos tratam os dados apenas para essas finalidades.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">5. Por quanto tempo</h2>
        <p>Enquanto a conta estiver ativa. Após o cancelamento, os dados podem ser excluídos a pedido da empresa cliente ou após 12 meses, salvo o que a lei obrigar a manter.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">6. Seus direitos</h2>
        <p>Você pode pedir acesso, correção, exclusão ou portabilidade dos seus dados, e deixar de receber pesquisas, pelo e-mail {{ CONTATO }}. Se você recebeu uma pesquisa de uma empresa que usa a {{ EMPRESA }}, também pode falar diretamente com ela.</p>
        <h2 class="font-bold text-slate-900 dark:text-white mt-6 mb-2">7. Segurança</h2>
        <p>Usamos conexão cifrada, senhas com hash, separação de dados entre empresas no próprio banco de dados e cópias de segurança diárias.</p>
      </template>
    </article>
  </div>
</template>
