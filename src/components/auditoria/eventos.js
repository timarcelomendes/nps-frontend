// Tradução dos eventos de auditoria (gravados pelo backend em nps_logs) para linguagem simples.

export const TIPOS_EVENTO = {
  DISPARO_AUTOMATICO: { rotulo: 'Envio automático', icone: 'pi-send', grupo: 'Envios' },
  DISPARO_MANUAL: { rotulo: 'Envio manual', icone: 'pi-send', grupo: 'Envios' },
  LEMBRETES: { rotulo: 'Lembretes', icone: 'pi-bell', grupo: 'Envios' },
  CONFIG_MOTOR: { rotulo: 'Envio de e-mails', icone: 'pi-cog', grupo: 'Configurações' },
  CONFIG_ROBO: { rotulo: 'Envio automático', icone: 'pi-cog', grupo: 'Configurações' },
  EXCLUSAO_CLIENTE: { rotulo: 'Contato excluído', icone: 'pi-trash', grupo: 'Exclusões' },
  EXCLUSAO_EMPRESA: { rotulo: 'Empresa excluída', icone: 'pi-trash', grupo: 'Exclusões' },
  EXCLUSAO_RESPOSTA: { rotulo: 'Resposta excluída', icone: 'pi-trash', grupo: 'Exclusões' },
  EXCLUSAO_USUARIO: { rotulo: 'Usuário excluído', icone: 'pi-trash', grupo: 'Exclusões' },
  LIMPEZA_DADOS: { rotulo: 'Limpeza em massa', icone: 'pi-trash', grupo: 'Exclusões' },
  APROVACAO_USUARIO: { rotulo: 'Acesso liberado', icone: 'pi-user-plus', grupo: 'Usuários e acesso' },
  LOGIN_SSO: { rotulo: 'Entrada com Microsoft', icone: 'pi-sign-in', grupo: 'Usuários e acesso' },
  CADASTRO_EMPRESA: { rotulo: 'Cadastro da empresa', icone: 'pi-building', grupo: 'Conta e assinatura' },
  ASSINATURA: { rotulo: 'Assinatura', icone: 'pi-credit-card', grupo: 'Conta e assinatura' },
};

export const GRUPOS_EVENTO = ['Envios', 'Configurações', 'Exclusões', 'Usuários e acesso', 'Conta e assinatura', 'Outros'];

export const NIVEIS = {
  INFO: { rotulo: 'Informação', classe: 'aud-selo-info', icone: 'pi-info-circle' },
  SUCCESS: { rotulo: 'Sucesso', classe: 'aud-selo-ok', icone: 'pi-check-circle' },
  WARN: { rotulo: 'Atenção', classe: 'aud-selo-atencao', icone: 'pi-exclamation-circle' },
  ERROR: { rotulo: 'Erro', classe: 'aud-selo-erro', icone: 'pi-times-circle' },
};

export const nivelDe = (nivel) => NIVEIS[String(nivel || '').toUpperCase()] || NIVEIS.INFO;

export const tipoDe = (acao) => {
  const chave = String(acao || '').toUpperCase();
  if (TIPOS_EVENTO[chave]) return TIPOS_EVENTO[chave];
  const texto = chave.replace(/_/g, ' ').toLowerCase().trim();
  return { rotulo: texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : 'Outro evento', icone: 'pi-circle', grupo: 'Outros' };
};

const ligadoDesligado = (msg) => (/DESATIVOU/.test(msg) ? 'desligou' : 'ligou');

/** Reescreve as mensagens técnicas mais comuns. O texto original continua disponível no título (hover). */
export const mensagemSimples = (log) => {
  const msg = String(log?.mensagem || '').trim();
  const acao = String(log?.acao || '').toUpperCase();
  let m;
  switch (acao) {
    case 'CONFIG_MOTOR':
      return `${ligadoDesligado(msg) === 'ligou' ? 'Ligou' : 'Desligou'} o envio de e-mails de pesquisa.`;
    case 'CONFIG_ROBO':
      return `${ligadoDesligado(msg) === 'ligou' ? 'Ligou' : 'Desligou'} o envio automático de pesquisas.`;
    case 'DISPARO_MANUAL':
      if ((m = msg.match(/lote de (\d+)/))) return `Enviou a pesquisa manualmente para ${m[1]} contato${m[1] === '1' ? '' : 's'}.`;
      break;
    case 'DISPARO_AUTOMATICO':
      if ((m = msg.match(/(\d+) pesquisas/))) return `${m[1]} pesquisa${m[1] === '1' ? '' : 's'} agendada${m[1] === '1' ? '' : 's'} enviada${m[1] === '1' ? '' : 's'} automaticamente.`;
      break;
    case 'LEMBRETES':
      if ((m = msg.match(/(\d+) lembrete/))) return `${m[1]} lembrete${m[1] === '1' ? '' : 's'} enviado${m[1] === '1' ? '' : 's'} para quem ainda não respondeu.`;
      break;
    case 'EXCLUSAO_CLIENTE':
      if ((m = msg.match(/ID (\S+)/))) return `Excluiu o contato nº ${m[1]} e tudo ligado a ele.`;
      break;
    case 'EXCLUSAO_EMPRESA':
      if ((m = msg.match(/ID (\S+)/))) return `Excluiu a empresa nº ${m[1]}.`;
      break;
    case 'EXCLUSAO_RESPOSTA':
      if ((m = msg.match(/ID (\S+)/))) return `Excluiu a resposta nº ${m[1]}.`;
      break;
    case 'EXCLUSAO_USUARIO':
      if ((m = msg.match(/ID (\S+)/))) return `Excluiu o usuário nº ${m[1]}.`;
      break;
    case 'APROVACAO_USUARIO':
      if ((m = msg.match(/usuário (\S+@\S+)/))) return `Liberou o acesso de ${m[1]}.`;
      break;
    case 'LOGIN_SSO':
      return 'Entrou na Rakiti com a conta Microsoft.';
    case 'CADASTRO_EMPRESA':
      if ((m = msg.match(/cadastro:\s*(.+)$/))) return `Empresa cadastrada na Rakiti: ${m[1]}`;
      break;
    case 'ASSINATURA':
      if ((m = msg.match(/^Plano (.+) escolhido/))) return `Escolheu o plano ${m[1]}.`;
      if (/cancelada/i.test(msg)) return 'Cancelou a assinatura.';
      break;
  }
  return msg || '-';
};

/** Nome de quem fez: o backend devolve "🤖 Sistema" quando não há usuário. */
export const origemDe = (log) => {
  const nome = String(log?.usuario_nome || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const automatico = !nome || /^sistema/i.test(nome);
  return { nome: automatico ? 'Rakiti (automático)' : nome, automatico };
};

// ----- E-mails enviados (nps_disparos) -----

export const STATUS_EMAIL = {
  ENVIADO: { rotulo: 'Enviado', classe: 'aud-selo-ok', icone: 'pi-check' },
  RESPONDIDO: { rotulo: 'Respondido', classe: 'aud-selo-ok', icone: 'pi-check-circle' },
  CRIADO: { rotulo: 'Na fila', classe: 'aud-selo-info', icone: 'pi-clock' },
  PENDENTE: { rotulo: 'Na fila', classe: 'aud-selo-info', icone: 'pi-clock' },
  ERRO: { rotulo: 'Falhou', classe: 'aud-selo-erro', icone: 'pi-times' },
  FALHA: { rotulo: 'Falhou', classe: 'aud-selo-erro', icone: 'pi-times' },
};

export const statusEmailDe = (status) =>
  STATUS_EMAIL[String(status || '').toUpperCase()] || { rotulo: status || 'Sem status', classe: 'aud-selo-info', icone: 'pi-circle' };

/** O backend junta assunto, link e erro num texto só; separa de volta para mostrar em campos. */
export const detalhesEmail = (email) => {
  const bruto = String(email?.mensagem || email?.corpo_email || '');
  const link = (bruto.match(/URL\/Link:[ \t]*(https?:\/\/\S+)/) || [])[1] || '';
  let erro = (bruto.match(/Log de Erro:\s*([\s\S]*)$/) || [])[1] || '';
  erro = erro.trim();
  if (/^Disparo realizado com sucesso/i.test(erro)) erro = '';
  return { link: link && link !== 'N/A' ? link : '', erro, bruto };
};

/** Explicação simples para os erros de envio mais comuns. */
export const erroSimples = (erro) => {
  const e = String(erro || '');
  if (!e) return '';
  if (/rede|connection|timeout|timed out|Max retries/i.test(e)) return 'Não foi possível falar com o servidor de e-mail. Confira a configuração de e-mail em Configurações e tente enviar de novo.';
  if (/autentica|auth|401|403|token/i.test(e)) return 'O servidor de e-mail recusou o acesso. Reconecte a conta de e-mail em Configurações.';
  if (/inválid|invalid|recipient|destinat/i.test(e)) return 'O endereço de e-mail do contato parece estar errado.';
  if (/limite|quota|429/i.test(e)) return 'O limite de envios foi atingido. Tente mais tarde.';
  return 'O e-mail não foi enviado. Veja o detalhe técnico abaixo.';
};
