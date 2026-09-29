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

    if (status === 401 || status === 403) {
          if (window.location.pathname === '/login' || window.location.pathname.startsWith('/r/') || (error.config && error.config.url.includes('/login'))) {
            return Promise.reject(error);
          }
          sessionStorage.clear();
          window.location.href = '/login'; 
        }
    
    return Promise.reject(error);
  }
);

export default api;