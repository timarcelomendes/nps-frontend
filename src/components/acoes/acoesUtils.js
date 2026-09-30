// Regras de exibição do quadro de Planos de Ação (sem chamadas à API).

export const COLUNAS = [
  { status: 'Pendente', titulo: 'A fazer', icone: 'pi pi-inbox', vazio: 'Nenhuma ação esperando. Novas notas baixas aparecem aqui.' },
  { status: 'Em Andamento', titulo: 'Em andamento', icone: 'pi pi-phone', vazio: 'Nada em andamento. Clique em "Começar" numa ação a fazer.' },
  { status: 'Concluído', titulo: 'Concluído', icone: 'pi pi-check-circle', vazio: 'Nenhuma ação concluída ainda.' },
];

// Ações antigas podem vir sem status: o backend as conta como pendentes.
export const statusDe = (acao) => acao.status || 'Pendente';

const DIA = 86400000;

/** Datas do banco sem fuso: created_at vem em UTC. */
const dataUTC = (s) => {
  if (!s) return null;
  let t = String(s).replace(' ', 'T');
  if (!/Z|[+-]\d\d:?\d\d$/.test(t)) t += 'Z';
  const d = new Date(t);
  return isNaN(d) ? null : d;
};
const dataLocal = (s) => {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? null : d;
};
const inicioDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export const dataCriacao = (acao) => dataUTC(acao.created_at);

/** Nota do cliente que originou a ação: NPS (0-10), CSAT (1-5, lida do título) ou manual. */
export const origem = (acao) => {
  const n = acao.resposta_nota;
  if (n !== null && n !== undefined) {
    const nota = Number(n);
    const tipo = nota <= 6 ? 'detrator' : nota <= 8 ? 'neutro' : 'promotor';
    return { tipo, rotulo: String(nota), dica: `Nota ${nota} de 0 a 10 no NPS (${tipo})`, cor: corNota(tipo) };
  }
  const csat = /^\[CSAT\s*(\d)\]/i.exec(acao.titulo || '');
  if (csat) {
    const nota = Number(csat[1]);
    const tipo = nota <= 2 ? 'detrator' : nota === 3 ? 'neutro' : 'promotor';
    return { tipo: 'csat', rotulo: `${nota}/5`, dica: `Nota ${nota} de 1 a 5 na pesquisa de satisfação`, cor: corNota(tipo) };
  }
  return { tipo: 'manual', rotulo: '—', dica: 'Criada manualmente, sem nota de cliente', cor: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' };
};

function corNota(tipo) {
  if (tipo === 'detrator') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
  if (tipo === 'neutro') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400';
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
}

/** Tira o prefixo técnico dos títulos automáticos ("[Detrator NPS 3] Ação Requerida: "). */
export const tituloCurto = (titulo) => {
  const t = String(titulo || '').replace(/^\[[^\]]*\]\s*/, '').replace(/^Ação Requerida:\s*/i, '').trim();
  return t || titulo || 'Ação sem título';
};

/** Comentário do cliente dentro da descrição automática; senão, a própria descrição. */
export const resumoDescricao = (acao) => {
  const d = acao.descricao || '';
  const m = /Coment[aá]rio Original:\s*\n?\s*"([\s\S]*?)"/i.exec(d);
  if (m && m[1].trim()) return { citacao: true, texto: m[1].trim() };
  const limpo = d.replace(/^\s*🚨[^\n]*\n*/u, '').trim();
  return limpo ? { citacao: false, texto: limpo } : null;
};

/**
 * Prazo da ação: usa prazo_limite quando existe; senão, data de criação + dias da regra.
 * nivel: 'vencido' | 'perto' (hoje ou amanhã) | 'ok'
 */
export const calcularPrazo = (acao, regras) => {
  if (statusDe(acao) === 'Concluído') return null;
  let alvo = dataLocal(acao.prazo_limite);
  if (!alvo) {
    const criada = dataCriacao(acao) || new Date();
    const n = acao.resposta_nota;
    let dias = regras.sla_promotor_dias;
    if (n !== null && n !== undefined && n <= 6) dias = regras.sla_detrator_dias;
    else if (n !== null && n !== undefined && n <= 8) dias = regras.sla_neutro_dias;
    alvo = new Date(criada.getTime() + dias * DIA);
  }
  const diff = Math.round((inicioDia(alvo) - inicioDia(new Date())) / DIA);
  const data = alvo.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (diff < 0) {
    const d = Math.abs(diff);
    return { nivel: 'vencido', diff, data, texto: `Venceu há ${d} ${d === 1 ? 'dia' : 'dias'}` };
  }
  if (diff === 0) return { nivel: 'perto', diff, data, texto: 'Vence hoje' };
  if (diff === 1) return { nivel: 'perto', diff, data, texto: 'Vence amanhã' };
  return { nivel: 'ok', diff, data, texto: `Prazo ${data}` };
};

export const corPrazo = (nivel) => ({
  vencido: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  perto: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  ok: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}[nivel]);

export const iniciais = (nome) => (nome
  ? nome.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map(n => n[0]).join('').toUpperCase()
  : '?');
