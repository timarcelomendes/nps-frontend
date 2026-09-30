// Funções compartilhadas pelas telas de acesso (login, esqueci a senha, redefinir senha).

// Mesmas regras de validar_senha_forte (backend/services/email_svc.py).
export const regrasSenha = (s = '') => [
  { ok: s.length >= 8, texto: '8 caracteres' },
  { ok: /[A-Z]/.test(s), texto: 'uma maiúscula' },
  { ok: /[0-9]/.test(s), texto: 'um número' },
  { ok: /[^A-Za-z0-9]/.test(s), texto: 'um símbolo (ex.: @ # ! -)' },
];
export const senhaValida = (s = '') => regrasSenha(s).every((r) => r.ok) && s.length <= 70;

export const emailValido = (e = '') => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

// Domínios de e-mail pessoal: não identificam a empresa (mesma lista do backend).
const DOMINIOS_GRATUITOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'yahoo.com.br',
  'icloud.com', 'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'msn.com', 'protonmail.com', 'gmx.com'];
export const emailPessoal = (e = '') => DOMINIOS_GRATUITOS.includes(e.trim().toLowerCase().split('@')[1] || '');

// Roda uma requisição e avisa (onLento(true)) se ela passar de 5s: o servidor gratuito pode estar "acordando".
export async function comAvisoDeDemora(requisicao, onLento, ms = 5000) {
  const timer = setTimeout(() => onLento(true), ms);
  try {
    return await requisicao();
  } finally {
    clearTimeout(timer);
    onLento(false);
  }
}

// Mensagens para falhas que não dependem da rota: sem conexão, excesso de tentativas, erro interno.
export function mensagemGenerica(erro, padrao = 'Não foi possível concluir. Tente de novo.') {
  if (!erro?.response) {
    return 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo em alguns segundos.';
  }
  const { status, data } = erro.response;
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde 1 minuto e tente de novo.';
  if (status >= 500) return 'O servidor teve um problema agora. Tente de novo em alguns minutos.';
  return (typeof data?.detail === 'string' && data.detail) || padrao;
}

export const TEMPO_LIMITE = 90000; // o plano gratuito do Render pode levar ~50s para acordar
