// src/utils/permissoes.js
// Controle de tela por perfil. ATENÇÃO: isto só esconde botões e rotas; quem protege os dados
// de verdade é o backend (middleware + exigir_admin). Nunca confie só nesta checagem.

// "Usuário", "usuario", "USUARIO" -> "usuario" (sem acento e em minúsculas)
export const normalizarPerfil = (perfil) => String(perfil || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toLowerCase();

export const perfilAtual = () => normalizarPerfil(sessionStorage.getItem('usuario_tipo') || 'Usuário');

export const ehAdmin = () => perfilAtual() === 'admin';

// temPerfil(['Admin', 'Manager']) -> true se o perfil do usuário estiver na lista
export const temPerfil = (perfis = []) => perfis.map(normalizarPerfil).includes(perfilAtual());

export const temPermissao = (permissaoNecessaria) => {
  if (ehAdmin()) return true;

  const permissoesSalvas = sessionStorage.getItem('usuario_permissoes');
  if (!permissoesSalvas) return false;

  try {
    const permissoesDoPerfil = JSON.parse(permissoesSalvas);
    if (!Array.isArray(permissoesDoPerfil)) return false;
    return permissoesDoPerfil.includes(permissaoNecessaria) || permissoesDoPerfil.includes('*');
  } catch (e) {
    return false;
  }
};
