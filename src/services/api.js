import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + '/api'
});

api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// INTERCEPTOR DE RESPOSTA
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;

    if (status === 429) {
      window.dispatchEvent(new CustomEvent('api-rate-limit'));
      return Promise.reject(error);
    }

    // Só 401 (sessão expirada/encerrada) derruba o login. 403 = "seu perfil não pode fazer isso":
    // a tela mostra a mensagem e o usuário continua logado.
    if (status === 401) {
      const ehLogin = error.config && error.config.url && error.config.url.includes('/login');
      const estavaLogado = !!sessionStorage.getItem('token');
      if (!ehLogin && estavaLogado) {
        sessionStorage.clear();
        const motivo = error.response?.data?.detail;
        if (motivo) sessionStorage.setItem('aviso_login', motivo);
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;