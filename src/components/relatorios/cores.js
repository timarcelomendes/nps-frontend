// Cores de bom / médio / ruim usadas nos relatórios (mesmos cortes da Visão geral).
export const corNps = (n) => (n >= 50 ? 'text-emerald-600 dark:text-emerald-400' : n >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400');
export const barraNps = (n) => (n >= 50 ? 'bg-emerald-500' : n >= 0 ? 'bg-amber-400' : 'bg-rose-500');
export const resumoNps = (n) => (n >= 75 ? 'Excelente' : n >= 50 ? 'Muito bom' : n >= 0 ? 'Pode melhorar' : 'Crítico');

// Nota de 0 a 10
export const corNota = (nota) => (nota >= 9
  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  : nota >= 7
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400');
export const barraNota = (nota) => (nota >= 9 ? 'bg-emerald-500' : nota >= 7 ? 'bg-amber-400' : 'bg-rose-500');

// Hex para os gráficos (Chart.js não lê classes)
export const HEX = { bom: '#10b981', medio: '#f59e0b', ruim: '#f43f5e', eixo: '#94a3b8', grade: 'rgba(148,163,184,0.18)' };
