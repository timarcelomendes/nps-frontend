// Cores e textos comuns da tela de Respostas (NPS de 0 a 10).

export const grupoDaNota = (nota) => {
  const n = Number(nota);
  if (n >= 9) return 'Promotor';
  if (n >= 7) return 'Neutro';
  return 'Detrator';
};

/** Quadrado da nota: verde (9-10), amarelo (7-8), vermelho (0-6) */
export const corNotaSolida = (nota) => ({
  Promotor: 'bg-emerald-500 text-white',
  Neutro: 'bg-amber-400 text-slate-900',
  Detrator: 'bg-rose-500 text-white',
}[grupoDaNota(nota)]);

/** Etiqueta de classificação (Promotor / Neutro / Detrator ou outro texto livre) */
export const corClassificacao = (cat) => ({
  Promotor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  Neutro: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  Detrator: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
}[cat] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300');

export const OPCOES_NOTA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const OPCOES_CLASSIFICACAO = ['Promotor', 'Neutro', 'Detrator'];
