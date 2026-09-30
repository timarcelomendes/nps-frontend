// Regras da planilha de importação: colunas do modelo e conferência de cada linha.

export const MODELOS = {
  clientes: {
    arquivo: 'modelo_clientes_rakiti.csv',
    obrigatorias: ['nome', 'email', 'empresa'],
    colunas: [
      { nome: 'nome', explicacao: 'Nome da pessoa que recebe a pesquisa' },
      { nome: 'email', explicacao: 'E-mail para onde vai a pesquisa' },
      { nome: 'empresa', explicacao: 'Empresa cliente onde a pessoa trabalha' },
      { nome: 'cargo', explicacao: 'Ex.: Comprador, Gerente de logística' },
      { nome: 'perfil_decisor', explicacao: 'Decisor ou Influenciador' },
      { nome: 'segmento', explicacao: 'Ex.: Farma, Varejo, Construção' },
      { nome: 'telefone', explicacao: 'Com DDD' },
      { nome: 'ativo', explicacao: 'sim ou não (em branco = sim)' },
      { nome: 'ultimo_envio', explicacao: 'Data da última pesquisa, se já enviou antes (AAAA-MM-DD)' },
    ],
    exemplos: [
      ['Ana Souza', 'ana.souza@exemplo.com.br', 'Distribuidora Exemplo', 'Compradora', 'Decisor', 'Varejo', '(11) 99999-0000', 'sim', ''],
      ['Bruno Lima', 'bruno.lima@exemplo.com.br', 'Transportes Exemplo', 'Gerente de logística', 'Influenciador', 'Logística', '(21) 98888-0000', 'sim', ''],
    ],
  },
  respostas: {
    arquivo: 'modelo_respostas_rakiti.csv',
    obrigatorias: ['email', 'empresa', 'nota', 'data_resposta'],
    colunas: [
      { nome: 'email', explicacao: 'E-mail do contato (precisa já estar cadastrado)' },
      { nome: 'empresa', explicacao: 'Empresa do contato' },
      { nome: 'data_resposta', explicacao: 'Data em que respondeu (AAAA-MM-DD)' },
      { nome: 'nota', explicacao: 'Número inteiro de 0 a 10' },
      { nome: 'comentario', explicacao: 'O que a pessoa escreveu (opcional)' },
      { nome: 'perfil_decisor', explicacao: 'Decisor ou Influenciador (opcional)' },
      { nome: 'segmento', explicacao: 'Opcional' },
    ],
    exemplos: [
      ['ana.souza@exemplo.com.br', 'Distribuidora Exemplo', '2026-03-15', '10', 'Entrega sempre no prazo', 'Decisor', 'Varejo'],
    ],
  },
};

// CSV com ";" e BOM: abre certinho no Excel em português, com acentos.
export const baixarModelo = (tipo) => {
  const m = MODELOS[tipo];
  const escapar = (v) => (/[";\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const linhas = [m.colunas.map(c => c.nome), ...m.exemplos].map(l => l.map(escapar).join(';'));
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = m.arquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const vazio = (v) => v === null || v === undefined || String(v).trim() === '';

// Lista de problemas de uma linha, em português simples (vazia = linha pronta).
export const problemasDaLinha = (row, tipo, chaves = []) => {
  const p = [];
  if (row.detalhe) p.push(String(row.detalhe));
  if (row.tipo_pendencia) p.push('Pendência: ' + row.tipo_pendencia);

  if (vazio(row.email)) p.push('Falta o e-mail');
  else if (!String(row.email).includes('@')) p.push(`E-mail incompleto: "${String(row.email).trim()}"`);

  if (tipo === 'clientes') {
    if (vazio(row.nome)) p.push('Falta o nome');
    if (vazio(row.empresa)) p.push('Falta a empresa');
  } else {
    if (vazio(row.empresa)) p.push('Falta a empresa');
    if (vazio(row.nota)) p.push('Falta a nota');
    else {
      const n = Number(String(row.nota).replace(',', '.'));
      if (!Number.isInteger(n) || n < 0 || n > 10) p.push(`A nota precisa ser um número inteiro de 0 a 10 (veio "${row.nota}")`);
    }
    if (vazio(row.data_resposta)) p.push('Falta a data da resposta');
  }

  const faltando = chaves.filter(c => vazio(row[c]) && !(c === 'email' && vazio(row.email)));
  if (faltando.length) p.push(`Falta preencher ${faltando.map(c => `"${c}"`).join(', ')}, usada para reconhecer quem já está cadastrado`);
  return p;
};

// Excel às vezes entrega a nota como "10.0"; o servidor só aceita número inteiro.
export const normalizarLinha = (row, tipo) => {
  if (tipo !== 'respostas' || vazio(row.nota)) return row;
  const n = Number(String(row.nota).replace(',', '.'));
  return Number.isInteger(n) ? { ...row, nota: String(n) } : row;
};
