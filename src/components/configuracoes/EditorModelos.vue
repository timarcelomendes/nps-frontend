<script setup>
// Editor dos modelos de e-mail (convite, lembretes e agradecimentos), com prévia e envio de teste.
import { ref, computed, watch, nextTick } from 'vue';
import api from '../../services/api';
import { useConfig } from './useConfiguracoes';

const cfg = useConfig();
const r = cfg.regras;

const BASE_CONVITE = `<!DOCTYPE html><html><body style="background-color: #f4f4f4; padding: 40px; font-family: sans-serif;"><div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; text-align: center;"><h2 style="color: #333;">Olá, {nome}!</h2><p style="color: #555; font-size: 16px;">De 0 a 10, quanto você recomendaria a nossa empresa a um amigo ou colega?</p>{botoes_nota}<a href="{survey_url}" style="display: inline-block; padding: 14px 28px; background-color: #F97316; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px;">Responder Pesquisa</a></div></body></html>`;
const BASE_LEMBRETE = `<!DOCTYPE html><html><body style="background-color: #f4f4f4; padding: 40px; font-family: sans-serif;"><div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto; text-align: center;"><h2 style="color: #333;">Olá novamente, {nome}!</h2><p style="color: #555; font-size: 16px;">Ainda não recebemos o seu feedback sobre a <strong>{empresa}</strong>. Leva menos de 1 minuto!</p><a href="{survey_url}" style="display: inline-block; padding: 14px 28px; background-color: #F97316; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 25px;">Responder Agora</a></div></body></html>`;
const BASE_AGRADECIMENTO = `<!DOCTYPE html><html><body style="background-color: #f4f4f4; padding: 40px; font-family: sans-serif;"><div style="background-color: #ffffff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;"><h2 style="color: #333;">Obrigado, {nome}!</h2><p>A sua avaliação da parceria com a <strong>{empresa}</strong> é muito importante.</p><p>A sua nota final foi: <strong style="font-size: 18px; color: #F97316;">{nota}/10</strong></p><div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #F97316; margin: 20px 0;"><p style="margin: 0; font-style: italic; color: #555;">"{motivo}"</p></div><p>A nossa equipe já está analisando o seu feedback.</p></div></body></html>`;

const V_CONVITE = [
  { v: '{nome}', d: 'Primeiro nome do cliente' }, { v: '{empresa}', d: 'Nome da empresa' },
  { v: '{survey_url}', d: 'Link da pesquisa (obrigatório)' }, { v: '{botoes_nota}', d: 'Botões de 0 a 10 para responder no próprio e-mail' },
];
const V_AGRADECIMENTO = [
  { v: '{nome}', d: 'Primeiro nome do cliente' }, { v: '{empresa}', d: 'Nome da empresa' }, { v: '{nota}', d: 'Nota que o cliente deu' },
  { v: '{motivo}', d: 'Comentário do cliente' }, { v: '{expectativas}', d: 'Resposta sobre expectativas' }, { v: '{o_que_faltava}', d: 'O que faltou, segundo o cliente' },
];

const modelos = computed(() => {
  const qtd = r.value?.lembrete_qtd_maxima || 0;
  const lista = [{ id: 'convite', campo: 'email_template_html', nome: 'Convite', categoria: 'convite', vars: V_CONVITE, base: BASE_CONVITE, link: true,
    quando: 'Enviado quando a pesquisa sai para o cliente.' }];
  for (let n = 1; n <= qtd; n++) {
    lista.push({ id: `lembrete${n}`, campo: `email_template_lembrete_${n}`, nome: `${n}º lembrete`, categoria: 'lembrete', vars: V_CONVITE, base: BASE_LEMBRETE, link: true,
      quando: `Enviado ${r.value[`lembrete_dias_${n}`]} dias depois do convite, se o cliente não respondeu.${n > 1 ? ' Em branco, usa o texto do 1º lembrete.' : ''}` });
  }
  lista.push(
    { id: 'agradecimento_promotor', campo: 'email_agradecimento_promotor', nome: 'Obrigado: nota alta', categoria: 'promotor', vars: V_AGRADECIMENTO, base: BASE_AGRADECIMENTO, quando: 'Enviado a quem deu nota 9 ou 10.' },
    { id: 'agradecimento_neutro', campo: 'email_agradecimento_neutro', nome: 'Obrigado: nota média', categoria: 'neutro', vars: V_AGRADECIMENTO, base: BASE_AGRADECIMENTO, quando: 'Enviado a quem deu nota 7 ou 8.' },
    { id: 'agradecimento_detrator', campo: 'email_agradecimento_detrator', nome: 'Obrigado: nota baixa', categoria: 'detrator', vars: V_AGRADECIMENTO, base: BASE_AGRADECIMENTO, quando: 'Enviado a quem deu nota de 0 a 6.' },
  );
  return lista;
});

const selecionado = ref('convite');
const modelo = computed(() => modelos.value.find((m) => m.id === selecionado.value) || modelos.value[0]);
watch(modelos, (lista) => { if (!lista.some((m) => m.id === selecionado.value)) selecionado.value = 'convite'; });

const html = computed({
  get: () => r.value?.[modelo.value.campo] || '',
  set: (v) => { r.value[modelo.value.campo] = v; },
});
const personalizado = (m) => !!(r.value?.[m.campo] || '').trim();
const semLink = computed(() => modelo.value.link && personalizado(modelo.value) && !html.value.includes('{survey_url}'));
const alteradoNaoSalvo = (m) => cfg.regrasBase.value && (r.value[m.campo] || '') !== (cfg.regrasBase.value[m.campo] || '');

// ---------- Código x prévia ----------
const modo = ref('codigo');
const EXEMPLO = {
  '{nome}': 'Maria', '{empresa}': 'Distribuidora Exemplo', '{survey_url}': '#', '{nota}': '9',
  '{motivo}': 'Entrega rápida e equipe atenciosa.', '{expectativas}': 'Sim', '{o_que_faltava}': 'Nada',
  '{botoes_nota}': `<div style="margin:16px 0">${Array.from({ length: 11 }, (_, i) => `<span style="display:inline-block;width:28px;height:28px;line-height:28px;margin:2px;border-radius:6px;background:#f1f5f9;color:#0f172a;font:600 13px sans-serif;text-align:center">${i}</span>`).join('')}</div>`,
};
const htmlPrevia = computed(() => {
  let h = (html.value || modelo.value.base).replaceAll('{backend_url}', cfg.urlServidor());
  Object.entries(EXEMPLO).forEach(([k, v]) => { h = h.replaceAll(k, v); });
  return h;
});

// ---------- Inserir variável e buscar no código ----------
const areaTexto = ref(null);
const inserir = async (variavel) => {
  const el = areaTexto.value;
  if (!el || modo.value !== 'codigo') { await navigator.clipboard?.writeText(variavel).catch(() => {}); cfg.ok('Copiado', variavel); return; }
  const ini = el.selectionStart ?? html.value.length;
  const fim = el.selectionEnd ?? ini;
  html.value = html.value.slice(0, ini) + variavel + html.value.slice(fim);
  await nextTick();
  el.focus();
  el.setSelectionRange(ini + variavel.length, ini + variavel.length);
};

const busca = ref({ termo: '', posicoes: [], atual: -1 });
watch([selecionado, () => busca.value.termo], () => { busca.value.posicoes = []; busca.value.atual = -1; });
const buscar = () => {
  const b = busca.value;
  const termo = b.termo.toLowerCase();
  if (!termo || !html.value) return;
  if (!b.posicoes.length) {
    const texto = html.value.toLowerCase();
    for (let i = texto.indexOf(termo); i > -1; i = texto.indexOf(termo, i + termo.length)) b.posicoes.push(i);
    if (!b.posicoes.length) { cfg.aviso('Não encontrado', `"${b.termo}" não aparece neste modelo.`); return; }
  }
  b.atual = (b.atual + 1) % b.posicoes.length;
  const pos = b.posicoes[b.atual];
  const el = areaTexto.value;
  if (el) {
    el.focus();
    el.setSelectionRange(pos, pos + termo.length);
    el.scrollTop = (html.value.slice(0, pos).split('\n').length - 2) * 20;
  }
};

// ---------- Imagens: troca o endereço das imagens hospedadas pelo endereço deste servidor ----------
const ajustarImagens = () => {
  if (!html.value.trim()) { cfg.aviso('Modelo vazio', 'Cole ou escreva o HTML primeiro.'); return; }
  const url = cfg.urlServidor();
  let novo = html.value;
  let trocas = 0;
  cfg.imagens.value.forEach((img) => {
    const nome = img.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`([^"'\\s\\(]*\\/)?${nome}(?:\\?[^"'\\s\\)]*)?`, 'gi');
    const achados = novo.match(regex);
    if (achados) { novo = novo.replace(regex, `${url}/uploads/${img.nome}`); trocas += achados.length; }
  });
  if (trocas) { html.value = novo; cfg.ok('Imagens ajustadas', `${trocas} endereço(s) de imagem atualizado(s). Lembre de salvar.`); }
  else cfg.aviso('Nada para ajustar', 'Nenhuma das imagens enviadas aparece neste modelo.');
};

const usarBase = () => { html.value = modelo.value.base; };
const voltarPadrao = () => {
  if (confirm(`Apagar o texto personalizado de "${modelo.value.nome}"? Depois de salvar, a Rakiti volta a usar o modelo padrão.`)) html.value = '';
};

// ---------- Envio de teste ----------
const emailTeste = ref(cfg.meuEmail);
const enviandoTeste = ref(false);
const enviarTeste = async () => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTeste.value || '')) { cfg.aviso('Informe um e-mail válido', 'Para onde enviar o teste.'); return; }
  if (!html.value.trim()) { cfg.aviso('Modelo vazio', 'Este e-mail está usando o modelo padrão. Personalize para testar.'); return; }
  enviandoTeste.value = true;
  try {
    await api.post('/config/testar-template', {
      email_destino: emailTeste.value,
      html_content: html.value.replaceAll('{backend_url}', cfg.urlServidor()),
      categoria: modelo.value.categoria,
    });
    cfg.ok('Teste enviado', `Confira a caixa de entrada de ${emailTeste.value}.`);
  } catch (e) {
    cfg.erro(e, 'Não foi possível enviar o teste', 'Verifique o envio de e-mails e tente de novo.');
  } finally {
    enviandoTeste.value = false;
  }
};
</script>

<template>
  <div v-if="r" class="flex flex-col gap-4 min-w-0">
    <div class="flex flex-wrap gap-2" role="tablist" aria-label="Qual e-mail editar">
      <button v-for="m in modelos" :key="m.id" type="button" role="tab" :aria-selected="selecionado === m.id"
        :class="['cfg-pilula', selecionado === m.id && 'cfg-pilula-ativa']" @click="selecionado = m.id">
        {{ m.nome }}
        <span v-if="alteradoNaoSalvo(m)" class="w-2 h-2 rounded-full bg-amber-500" title="Alterado, não salvo"></span>
        <i v-else-if="personalizado(m)" class="pi pi-pencil text-xs opacity-70" title="Personalizado"></i>
      </button>
    </div>
    <p v-if="!r.lembrete_qtd_maxima" class="text-sm text-slate-500 dark:text-slate-400">Os lembretes estão desligados (aba Pesquisa), por isso os modelos deles não aparecem.</p>

    <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-w-0">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ modelo.nome }}
            <span :class="['cfg-selo ml-1', personalizado(modelo) && 'cfg-selo-essencial']">{{ personalizado(modelo) ? 'Personalizado' : 'Usando o padrão da Rakiti' }}</span>
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ modelo.quando }}</p>
        </div>
        <div class="cfg-segmentado shrink-0" role="radiogroup" aria-label="Modo de exibição">
          <button type="button" :class="{ 'cfg-segmentado-ativo': modo === 'codigo' }" @click="modo = 'codigo'"><i class="pi pi-code text-xs mr-1"></i>Código</button>
          <button type="button" :class="{ 'cfg-segmentado-ativo': modo === 'previa' }" @click="modo = 'previa'"><i class="pi pi-eye text-xs mr-1"></i>Prévia</button>
        </div>
      </div>

      <div class="p-3 flex flex-col gap-3 border-b border-slate-200 dark:border-slate-700">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">Inserir:</span>
          <button v-for="v in modelo.vars" :key="v.v" type="button" class="cfg-variavel" :title="v.d" @click="inserir(v.v)">{{ v.v }}</button>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">Clique para colocar no ponto do cursor. Passe o mouse para ver o que cada um vira.</p>
        <p v-if="semLink" class="cfg-aviso"><i class="pi pi-exclamation-triangle"></i><span>Falta <code>{survey_url}</code>. Sem ele este modelo é ignorado e a Rakiti envia o padrão.</span></p>
      </div>

      <div v-show="modo === 'codigo'">
        <div class="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
          <label class="flex items-center gap-2 flex-1 min-w-[12rem]">
            <i class="pi pi-search text-slate-400 text-sm"></i>
            <span class="sr-only">Localizar no código</span>
            <input v-model="busca.termo" @keyup.enter="buscar" placeholder="Localizar no código (Enter)" class="bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0" spellcheck="false" />
          </label>
          <span v-if="busca.posicoes.length" class="text-sm text-slate-500 tabular-nums">{{ busca.atual + 1 }} de {{ busca.posicoes.length }}</span>
          <button v-if="busca.posicoes.length" type="button" class="cfg-btn-icone" @click="buscar" aria-label="Próximo resultado"><i class="pi pi-angle-down"></i></button>
        </div>
        <textarea ref="areaTexto" v-model="html" rows="14" spellcheck="false" :aria-label="`HTML do e-mail ${modelo.nome}`"
          placeholder="Em branco = a Rakiti usa o modelo padrão. Cole aqui o HTML do seu e-mail ou use o botão 'Começar com o modelo básico'."
          class="block w-full font-mono text-sm leading-5 p-4 bg-slate-950 text-slate-100 placeholder:text-slate-500 outline-none resize-y"></textarea>
      </div>
      <div v-if="modo === 'previa'" class="bg-slate-100 dark:bg-slate-950 p-3">
        <p v-if="!personalizado(modelo)" class="text-sm text-slate-500 dark:text-slate-400 mb-2">Mostrando o modelo básico como exemplo (o e-mail real usa o padrão da Rakiti).</p>
        <iframe :srcdoc="htmlPrevia" sandbox="" title="Prévia do e-mail" class="w-full h-[28rem] rounded-lg bg-white border border-slate-200 dark:border-slate-700"></iframe>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Os campos aparecem com dados de exemplo (Maria, Distribuidora Exemplo).</p>
      </div>

      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
        <div class="flex flex-wrap gap-2">
          <button v-if="!personalizado(modelo)" type="button" class="cfg-btn-secundario" @click="usarBase"><i class="pi pi-file text-xs"></i>Começar com o modelo básico</button>
          <button v-else type="button" class="cfg-btn-secundario" @click="voltarPadrao"><i class="pi pi-undo text-xs"></i>Voltar ao padrão</button>
          <button type="button" class="cfg-btn-secundario" @click="ajustarImagens" :disabled="!cfg.imagens.value.length"
            title="Troca o endereço das imagens enviadas abaixo pelo endereço deste servidor"><i class="pi pi-image text-xs"></i>Ajustar links das imagens</button>
        </div>
        <form class="flex flex-col sm:flex-row gap-2" @submit.prevent="enviarTeste">
          <label class="sr-only" for="cfg-email-teste">E-mail para o teste</label>
          <input id="cfg-email-teste" v-model.trim="emailTeste" type="email" placeholder="seu@email.com" class="cfg-input sm:w-60" />
          <button type="submit" class="cfg-btn-secundario" :disabled="enviandoTeste">
            <i :class="['pi text-xs', enviandoTeste ? 'pi-spin pi-spinner' : 'pi-send']"></i>Enviar teste
          </button>
        </form>
      </div>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400">O teste usa o texto que está na tela, mesmo sem salvar. Para valer nos envios, clique em "Salvar alterações".</p>
  </div>
</template>
