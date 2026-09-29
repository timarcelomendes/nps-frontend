/**
 * Recebe uma data em UTC (do SQL Server) e converte para o fuso horário 
 * local do usuário (ex: Brasil UTC-3) num formato legível.
 */
export const formatarDataLocal = (dataString) => {
  if (!dataString) return '-';
  
  // 1. Substitui espaços por 'T' (padrão ISO)
  let dataFormatada = dataString.replace(' ', 'T');
  
  // 2. Força o 'Z' no final para o navegador saber que a data original é UTC
  if (!dataFormatada.endsWith('Z')) {
    dataFormatada += 'Z';
  }

  // 3. Converte para o horário local (ex: pt-BR)
  const dataObj = new Date(dataFormatada);
  return dataObj.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
/** Conta do usuário logado (lida do token), usada para separar caches por conta. */
export const contaAtualId = () => {
  try {
    const token = sessionStorage.getItem('token') || '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.conta_id ?? null;
  } catch (e) {
    return null;
  }
};

/** "Hoje", "Ontem", "Há 5 dias" */
export const diasAtras = (dataString) => {
  if (!dataString) return '';
  const d = new Date(String(dataString).replace(' ', 'T'));
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
};

/** Data AAAA-MM-DD no fuso local */
export const dataISO = (data) => {
  const d = new Date(data);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};
