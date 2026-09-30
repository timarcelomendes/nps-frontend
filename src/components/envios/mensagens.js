// Traduz erros técnicos de envio para uma frase que o dono da empresa entende.

const FRASES_ASSINATURA = ['teste grátis terminou', 'pagamento em atraso', 'assinatura cancelada', 'limite do plano atingido'];

// A mensagem pede para regularizar a assinatura? (então mostramos o botão para /assinatura)
export const ehErroAssinatura = (texto, status) => {
  if (status === 402) return true;
  const t = String(texto || '').toLowerCase();
  return FRASES_ASSINATURA.some(f => t.includes(f));
};

// Texto do "detail" de uma resposta de erro do axios, se houver.
export const detalheDoErro = (error) => {
  const d = error?.response?.data?.detail;
  return typeof d === 'string' ? d : '';
};

// O log de e-mails junta assunto, link e erro num texto só; pega só a parte do erro.
export const extrairErroDoLog = (mensagem) => {
  const m = String(mensagem || '');
  const i = m.indexOf('Log de Erro:');
  return (i >= 0 ? m.slice(i + 'Log de Erro:'.length) : m).trim();
};

export const causaSimples = (erro) => {
  const bruto = String(erro || '').trim();
  const t = bruto.toLowerCase();
  if (!t) return { texto: 'O e-mail não saiu e o servidor não informou o motivo. Tente enviar de novo.' };
  if (ehErroAssinatura(t)) return { texto: bruto.replace(/^erro[^:]*:\s*/i, ''), assinatura: true };
  if (t.includes('link do formulário') || t.includes('link do formulario'))
    return { texto: 'O link da pesquisa ainda não foi configurado. Ajuste em Configurações e envie de novo.', configuracao: true };
  if (t.includes('falha de rede') || t.includes('max retries') || t.includes('connection') || t.includes('timeout') || t.includes('timed out'))
    return { texto: 'Não conseguimos falar com o serviço de e-mail naquele momento. Tente enviar de novo.' };
  if (t.includes('invalid_grant') || t.includes('401') || t.includes('unauthorized') || t.includes('token'))
    return { texto: 'A conta de e-mail que envia as pesquisas precisa ser conectada de novo em Configurações.', configuracao: true };
  if (t.includes('domain') || t.includes('domínio') || t.includes('dominio'))
    return { texto: 'O domínio do e-mail remetente não está liberado para envio. Confira em Configurações.', configuracao: true };
  if (t.includes('mailbox') || t.includes('recipient') || t.includes('550') || t.includes('invalid') || t.includes('inválido'))
    return { texto: 'O endereço de e-mail do contato parece não existir. Confira o e-mail no cadastro.' };
  if (t.includes('lembrete')) return { texto: 'Um lembrete não saiu. O sistema tenta de novo no próximo dia.' };
  return { texto: 'O e-mail não saiu. Tente enviar de novo; se continuar, fale com o suporte.' };
};

export const formatarData = (valor, comHora = false) => {
  if (!valor || valor === 'None' || valor === 'null') return '';
  const s = String(valor);
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  if (isNaN(d.getTime())) return '';
  return comHora
    ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR');
};

export const plural = (n, um, varios) => `${Number(n).toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
