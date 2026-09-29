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