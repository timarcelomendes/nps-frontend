// Estado compartilhado da tela de Configurações.
// A tela-mãe cria o "store" (criarStoreConfig) e as abas o recebem com useConfig().
// Também guarda o registro das seções com alterações não salvas, usado pela barra "Salvar alterações".
import { ref, reactive, computed, provide, inject } from 'vue';
import api from '../../services/api';

const CHAVE = Symbol('configuracoes');

// Campos de HTML dos modelos de e-mail (as imagens usam {backend_url} no banco)
export const CAMPOS_MODELO = [
  'email_template_html', 'email_template_lembrete_1', 'email_template_lembrete_2', 'email_template_lembrete_3',
  'email_agradecimento_promotor', 'email_agradecimento_neutro', 'email_agradecimento_detrator',
];
const CAMPOS_TEAMS = ['teams_horario_resumo'];

const PERGUNTA_NPS = 'De 0 a 10, quanto você recomendaria a {empresa} a um amigo ou colega?';
const PERGUNTA_CSAT = 'Como você avalia {assunto}?';

const inteiro = (v, padrao) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? padrao : n;
};
const copia = (o) => JSON.parse(JSON.stringify(o));

export function criarStoreConfig(toast) {
  const ok = (summary, detail) => toast.add({ severity: 'success', summary, detail, life: 3500 });
  const aviso = (summary, detail) => toast.add({ severity: 'warn', summary, detail, life: 5000 });
  const erro = (e, summary, padrao) => {
    const d = e?.response?.data?.detail;
    toast.add({ severity: 'error', summary, detail: typeof d === 'string' && d ? d : padrao, life: 6000 });
  };

  // ---------- Seções com alterações pendentes ----------
  const secoes = reactive(new Map());
  const registrarSecao = (id, def) => { secoes.set(id, def); return () => secoes.delete(id); };
  const pendentes = computed(() => [...secoes.entries()]
    .filter(([, s]) => s.alterado())
    .map(([id, s]) => ({ id, nome: typeof s.nome === 'function' ? s.nome() : s.nome, salvar: s.salvar, descartar: s.descartar })));

  // ---------- Imagens hospedadas (usadas nos modelos de e-mail) ----------
  const imagens = ref([]);
  const carregarImagens = async () => {
    try { imagens.value = (await api.get('/config/imagens')).data || []; } catch (e) { imagens.value = []; }
  };
  const urlServidor = () => {
    if (imagens.value.length > 0) return imagens.value[0].url.split('/uploads')[0];
    return (api.defaults.baseURL || window.location.origin).replace(/\/api$/, '');
  };

  // ---------- Regras da pesquisa (/config/regras) ----------
  const regras = ref(null);
  const regrasBase = ref(null); // último estado salvo, para saber o que mudou
  const carregandoRegras = ref(false);
  const salvandoRegras = ref(false);

  const carregarRegras = async () => {
    carregandoRegras.value = true;
    try {
      const d = (await api.get('/config/regras')).data || {};
      const qtd = inteiro(d.lembrete_qtd_maxima, 2); // sem valor salvo, o envio usa 2 lembretes
      const r = {
        ...d,
        scheduler_hora_inicio: d.scheduler_hora_inicio || '09:00',
        scheduler_horas: inteiro(d.scheduler_horas, 6),
        teams_horario_resumo: d.teams_horario_resumo || '08:00',
        sla_detrator_dias: inteiro(d.sla_detrator_dias, 2),
        sla_neutro_dias: inteiro(d.sla_neutro_dias, 5),
        sla_promotor_dias: inteiro(d.sla_promotor_dias, 7),
        recorrencia_dias: inteiro(d.recorrencia_dias, 90),
        survey_url: d.survey_url || '',
        robo_ativo: String(d.robo_ativo).toLowerCase() === 'true',
        formulario_tipo: d.formulario_tipo === 'externo' ? 'externo' : 'proprio',
        pergunta_nps: d.pergunta_nps || PERGUNTA_NPS,
        pergunta_csat: d.pergunta_csat || PERGUNTA_CSAT,
        fillout_campos: d.fillout_campos ? d.fillout_campos.split(',') : [],
        lembrete_qtd_maxima: Math.min(3, Math.max(0, qtd)),
        lembrete_dias_1: inteiro(d.lembrete_dias_1, 3) || 3,
        lembrete_dias_2: inteiro(d.lembrete_dias_2, 7) || 7,
        lembrete_dias_3: inteiro(d.lembrete_dias_3, 15) || 15,
      };
      const url = urlServidor();
      CAMPOS_MODELO.forEach((c) => { r[c] = (r[c] || '').replaceAll('{backend_url}', url); });
      regras.value = r;
      regrasBase.value = copia(r);
    } catch (e) {
      erro(e, 'Não foi possível carregar as regras da pesquisa', 'Atualize a página em alguns segundos.');
    } finally {
      carregandoRegras.value = false;
    }
  };

  const montarPayload = (fonte) => {
    const payload = copia(fonte);
    if (Array.isArray(payload.fillout_campos)) payload.fillout_campos = payload.fillout_campos.join(',');
    const url = urlServidor();
    CAMPOS_MODELO.forEach((c) => { if (payload[c]) payload[c] = payload[c].replaceAll(url, '{backend_url}'); });
    return payload;
  };

  const mudou = (campos) => regras.value && regrasBase.value
    && campos.some((c) => JSON.stringify(regras.value[c]) !== JSON.stringify(regrasBase.value[c]));
  const camposRegras = () => Object.keys(regras.value || {}).filter((c) => !CAMPOS_MODELO.includes(c) && !CAMPOS_TEAMS.includes(c));
  const partesAlteradas = () => {
    const partes = [];
    if (mudou(camposRegras())) partes.push('Regras da pesquisa');
    if (mudou(CAMPOS_MODELO)) partes.push('Modelos de e-mail');
    if (mudou(CAMPOS_TEAMS)) partes.push('Horário do resumo no Teams');
    return partes;
  };
  const regrasAlteradas = computed(() => partesAlteradas().length > 0);

  const errosRegras = computed(() => {
    const r = regras.value;
    if (!r) return [];
    const lista = [];
    if (r.formulario_tipo === 'externo' && !String(r.survey_url || '').trim().startsWith('https://')) {
      lista.push('Informe o link do formulário externo (começando com https://).');
    }
    if (r.lembrete_qtd_maxima >= 2 && r.lembrete_dias_2 <= r.lembrete_dias_1) lista.push('O 2º lembrete precisa sair depois do 1º.');
    if (r.lembrete_qtd_maxima >= 3 && r.lembrete_dias_3 <= r.lembrete_dias_2) lista.push('O 3º lembrete precisa sair depois do 2º.');
    return lista;
  });

  const salvarRegras = async () => {
    if (errosRegras.value.length) {
      aviso('Confira antes de salvar', errosRegras.value.join(' '));
      return false;
    }
    const partes = partesAlteradas();
    salvandoRegras.value = true;
    try {
      await api.post('/config/regras', montarPayload(regras.value));
      regrasBase.value = copia(regras.value);
      ok('Alterações salvas', `${partes.join(', ') || 'Regras da pesquisa'}.`);
      carregarPreviaLembretes();
      return true;
    } catch (e) {
      erro(e, 'Não foi possível salvar', 'Tente novamente em alguns segundos.');
      return false;
    } finally {
      salvandoRegras.value = false;
    }
  };

  // Salva só um campo (ex.: o interruptor do envio automático) sem levar junto o que ainda está em edição
  const salvarCampoRegra = async (campo, valor, mensagem) => {
    const anterior = regrasBase.value[campo];
    try {
      await api.post('/config/regras', montarPayload({ ...regrasBase.value, [campo]: valor }));
      regrasBase.value[campo] = valor;
      regras.value[campo] = valor;
      if (mensagem) ok(mensagem.titulo, mensagem.texto);
      return true;
    } catch (e) {
      regras.value[campo] = anterior;
      erro(e, 'Não foi possível salvar', 'Tente novamente em alguns segundos.');
      return false;
    }
  };

  const descartarRegras = () => { regras.value = copia(regrasBase.value); };
  registrarSecao('regras', { nome: () => partesAlteradas().join(', '), alterado: () => regrasAlteradas.value, salvar: salvarRegras, descartar: descartarRegras });

  // ---------- Lembretes: prévia e envio manual ----------
  const previaLembretes = ref(null);
  const carregarPreviaLembretes = async () => {
    try { previaLembretes.value = (await api.get('/lembretes/previa')).data; } catch (e) { previaLembretes.value = null; }
  };

  // ---------- Formulários padrão ----------
  const formularios = ref([]);
  const carregarFormularios = async () => {
    try { formularios.value = (await api.get('/formularios')).data || []; } catch (e) { formularios.value = []; }
  };
  const formulariosDoTipo = (uso) => formularios.value.filter((f) => f.tipo === uso);
  const formularioPadrao = (uso) => formularios.value.find((f) => f[`padrao_${uso}`]);
  const trocarPadrao = async (uso, fid) => {
    if (!fid) return;
    try {
      await api.post(`/formularios/${fid}/padrao`, { uso });
      await carregarFormularios();
      ok('Formulário padrão salvo', `As pesquisas de ${uso.toUpperCase()} vão usar "${formularioPadrao(uso)?.nome || 'o formulário escolhido'}".`);
    } catch (e) {
      erro(e, 'Não foi possível trocar o formulário', 'Tente novamente.');
    }
  };

  // ---------- Envio de e-mails (/config/email) ----------
  const email = ref({
    tenant_id: '', client_id: '', client_secret: '', email_remetente: '',
    base_url_frontend: window.location.origin, envios_ativos: true, sso_microsoft_ativo: false, provedor: '',
  });
  const carregandoEmail = ref(false);
  const carregarEmail = async () => {
    carregandoEmail.value = true;
    try {
      const d = (await api.get('/config/email')).data;
      const dados = Array.isArray(d) ? d[0] : d;
      if (dados) email.value = { ...email.value, ...dados, base_url_frontend: window.location.origin };
    } catch (e) {
      erro(e, 'Não foi possível carregar o envio de e-mails', 'Atualize a página em alguns segundos.');
    } finally {
      carregandoEmail.value = false;
    }
  };
  const emailPronto = computed(() => !!email.value.provedor && email.value.provedor !== 'nao_configurado');
  const salvarEmail = async (mensagem) => {
    try {
      await api.post('/config/email', {
        tenant_id: email.value.tenant_id,
        client_id: email.value.client_id,
        client_secret: email.value.client_secret,
        email_remetente: email.value.email_remetente,
        base_url_frontend: email.value.base_url_frontend,
        envios_ativos: email.value.envios_ativos,
        sso_microsoft_ativo: email.value.sso_microsoft_ativo,
        // este endpoint também grava o envio automático: manda o valor salvo para não desligá-lo sem querer
        robo_ativo: !!regrasBase.value?.robo_ativo,
      });
      if (mensagem) ok(mensagem.titulo, mensagem.texto);
      carregarPreviaLembretes();
      return true;
    } catch (e) {
      erro(e, 'Não foi possível salvar', 'Tente novamente em alguns segundos.');
      return false;
    }
  };

  // ---------- Equipe ----------
  const usuarios = ref([]);
  const carregandoUsuarios = ref(false);
  const meuEmail = (sessionStorage.getItem('usuario_email') || '').toLowerCase();
  const carregarUsuarios = async () => {
    carregandoUsuarios.value = true;
    try {
      const d = (await api.get('/usuarios')).data;
      const lista = Array.isArray(d) ? d : [d];
      usuarios.value = lista.sort((a, b) => Number(b.ativo) - Number(a.ativo) || String(a.nome).localeCompare(String(b.nome)));
    } catch (e) {
      erro(e, 'Não foi possível listar a equipe', 'Tente atualizar em alguns segundos.');
    } finally {
      carregandoUsuarios.value = false;
    }
  };
  const eu = computed(() => usuarios.value.find((u) => String(u.email).toLowerCase() === meuEmail));

  const store = {
    ok, aviso, erro, registrarSecao, pendentes,
    imagens, carregarImagens, urlServidor,
    regras, regrasBase, carregandoRegras, salvandoRegras, carregarRegras, salvarRegras, salvarCampoRegra, errosRegras, regrasAlteradas,
    previaLembretes, carregarPreviaLembretes,
    formularios, carregarFormularios, formulariosDoTipo, formularioPadrao, trocarPadrao,
    email, carregandoEmail, carregarEmail, emailPronto, salvarEmail,
    usuarios, carregandoUsuarios, carregarUsuarios, eu, meuEmail,
    ehSuperAdmin: sessionStorage.getItem('usuario_superadmin') === 'true',
    ehAdmin: (sessionStorage.getItem('usuario_tipo') || '').toLowerCase() === 'admin',
  };
  provide(CHAVE, store);
  return store;
}

export const useConfig = () => inject(CHAVE);

// Rascunho com "o que mudou desde o último salvamento" para seções simples
export function useRascunho(inicial) {
  const atual = ref(copia(inicial));
  const base = ref(copia(inicial));
  const alterado = computed(() => JSON.stringify(atual.value) !== JSON.stringify(base.value));
  const definir = (valor) => { atual.value = copia(valor); base.value = copia(valor); };
  const confirmar = () => { base.value = copia(atual.value); };
  const descartar = () => { atual.value = copia(base.value); };
  return { atual, base, alterado, definir, confirmar, descartar };
}
