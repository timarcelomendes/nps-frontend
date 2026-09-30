// Markdown -> HTML seguro para o Assistente.
// A resposta da IA pode repetir texto escrito por clientes (comentários da pesquisa), então:
// - HTML cru vira texto (sem <script>, <img onerror>, <iframe>...);
// - links só http(s)/mailto, abrindo em nova aba sem acesso à janela;
// - imagens NUNCA são carregadas (uma imagem com URL externa vazaria dados ao ser exibida).
import { Marked } from 'marked';

const escapar = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const urlSegura = (href) => {
  const h = String(href || '').trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
};

const md = new Marked({ gfm: true, breaks: true });
md.use({
  renderer: {
    html({ text }) { return escapar(text); },
    image({ text }) { return escapar(text || ''); },
    link({ href, title, tokens }) {
      const rotulo = this.parser.parseInline(tokens);
      const url = urlSegura(href);
      if (!url) return rotulo;
      const t = title ? ` title="${escapar(title)}"` : '';
      return `<a href="${escapar(url)}"${t} target="_blank" rel="noopener noreferrer nofollow">${rotulo}</a>`;
    },
  },
});

export const markdownSeguro = (texto) => {
  if (!texto) return '';
  try {
    return md.parse(String(texto));
  } catch (e) {
    return `<p>${escapar(texto)}</p>`;
  }
};

export default markdownSeguro;
