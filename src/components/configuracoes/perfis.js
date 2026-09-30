// Perfis de acesso: o valor gravado no banco continua em inglês; a tela mostra o nome em português.
export const PERFIS = [
  { value: 'Admin', label: 'Administrador', descricao: 'Acesso total, inclusive a estas Configurações.' },
  { value: 'Manager', label: 'Gestor', descricao: 'Trabalha no dia a dia. O que pode fazer é definido em Permissões.' },
  { value: 'Viewer', label: 'Consulta', descricao: 'Só acompanha. O que pode ver é definido em Permissões.' },
];
export const VALORES_PERFIL = PERFIS.map((p) => p.value);
export const rotuloPerfil = (valor) => PERFIS.find((p) => p.value === valor)?.label || valor || 'Sem perfil';
