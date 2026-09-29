// Catálogo dos tipos de pergunta do construtor de formulários
export const TIPOS_PERGUNTA = [
  { tipo: 'nps', rotulo: 'NPS (0 a 10)', icone: 'pi pi-chart-line', grupo: 'Notas', dica: 'Quanto recomendaria? Vai para o painel de NPS.' },
  { tipo: 'csat', rotulo: 'Satisfação (rostos)', icone: 'pi pi-face-smile', grupo: 'Notas', dica: 'De 1 a 5. Vai para o painel de CSAT.' },
  { tipo: 'estrelas', rotulo: 'Estrelas (1 a 5)', icone: 'pi pi-star', grupo: 'Notas', dica: 'Avaliação por estrelas.' },
  { tipo: 'escala', rotulo: 'Escala numérica', icone: 'pi pi-sliders-h', grupo: 'Notas', dica: 'Ex.: esforço de 1 a 7 (CES).' },
  { tipo: 'texto_curto', rotulo: 'Texto curto', icone: 'pi pi-minus', grupo: 'Texto', dica: 'Nome, e-mail, telefone, nº do pedido.' },
  { tipo: 'texto_longo', rotulo: 'Comentário', icone: 'pi pi-align-left', grupo: 'Texto', dica: 'Resposta aberta.' },
  { tipo: 'escolha_unica', rotulo: 'Escolha única', icone: 'pi pi-circle', grupo: 'Escolha', dica: 'Uma opção da lista.' },
  { tipo: 'escolha_multipla', rotulo: 'Múltipla escolha', icone: 'pi pi-check-square', grupo: 'Escolha', dica: 'Várias opções da lista.' },
  { tipo: 'sim_nao', rotulo: 'Sim / Não', icone: 'pi pi-thumbs-up', grupo: 'Escolha', dica: 'Pergunta direta.' },
  { tipo: 'data', rotulo: 'Data', icone: 'pi pi-calendar', grupo: 'Outros', dica: 'Ex.: data da compra.' },
  { tipo: 'pagina', rotulo: 'Quebra de página', icone: 'pi pi-arrows-v', grupo: 'Outros', dica: 'Separa etapas no layout "Página".' },
];

export const infoTipo = (tipo) => TIPOS_PERGUNTA.find(t => t.tipo === tipo) || { rotulo: tipo, icone: 'pi pi-question' };

export const novoId = () => 'p_' + Math.random().toString(16).slice(2, 10);

export const novaPergunta = (tipo) => {
  const base = { id: novoId(), tipo, titulo: '', descricao: '', obrigatoria: false };
  switch (tipo) {
    case 'pagina': return { id: base.id, tipo };
    case 'nps': return { ...base, titulo: 'De 0 a 10, quanto você recomendaria a {empresa} a um amigo ou colega?', obrigatoria: true, escala: { rotulo_min: '', rotulo_max: '' } };
    case 'csat': return { ...base, titulo: 'Como você avalia {assunto}?', obrigatoria: true, escala: { rotulo_min: '', rotulo_max: '' } };
    case 'estrelas': return { ...base, titulo: 'Como você avalia a sua experiência?', escala: { rotulo_min: '', rotulo_max: '' } };
    case 'escala': return { ...base, titulo: 'Foi fácil resolver o que você precisava?', escala: { min: 1, max: 7, rotulo_min: 'Muito difícil', rotulo_max: 'Muito fácil' } };
    case 'texto_curto': return { ...base, titulo: 'Qual o número do seu pedido?', formato: 'texto' };
    case 'texto_longo': return { ...base, titulo: 'Quer deixar um comentário?' };
    case 'escolha_unica': return { ...base, titulo: 'Qual foi o principal motivo?', opcoes: ['Opção 1', 'Opção 2', 'Opção 3'] };
    case 'escolha_multipla': return { ...base, titulo: 'O que mais pesa na sua nota?', opcoes: ['Prazo', 'Preço', 'Atendimento'] };
    case 'sim_nao': return { ...base, titulo: 'A entrega chegou no prazo?' };
    case 'data': return { ...base, titulo: 'Quando foi a sua última compra?' };
    default: return { ...base, titulo: 'Nova pergunta' };
  }
};

// Primeira pergunta de NPS; se não houver, a primeira de CSAT/estrelas
export const principalDe = (perguntas) =>
  perguntas.find(p => p.tipo === 'nps') || perguntas.find(p => p.tipo === 'csat' || p.tipo === 'estrelas') || null;

export const rotulosGrupo = (tipoPrincipal) => (tipoPrincipal === 'nps'
  ? { detrator: 'Detratores (0 a 6)', neutro: 'Neutros (7 e 8)', promotor: 'Promotores (9 e 10)' }
  : { detrator: 'Insatisfeitos (1 e 2)', neutro: 'Neutros (3)', promotor: 'Satisfeitos (4 e 5)' });

export const descreverCondicao = (c, tipoPrincipal) => {
  if (!c) return '';
  if (c.tipo === 'grupo') return 'Só para ' + rotulosGrupo(tipoPrincipal)[c.valor].split(' (')[0].toLowerCase();
  return c.tipo === 'lte' ? `Só se a nota for até ${c.valor}` : `Só se a nota for ${c.valor} ou mais`;
};

// Troca {empresa}, {nome}... por exemplos na prévia
export const exemplo = (texto, empresa) => (texto || '')
  .replaceAll('{empresa}', empresa || 'sua empresa')
  .replaceAll('{nome}', 'Maria')
  .replaceAll('{assunto}', 'a entrega do pedido 1234')
  .replaceAll('{referencia}', 'PED-1234');
