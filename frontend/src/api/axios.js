import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT token to every request automatically
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cloudsewa_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token expiry globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRequest = (error.config?.url || '').startsWith('/auth/');
      if (!isAuthRequest) {
        localStorage.removeItem('cloudsewa_token');
        localStorage.removeItem('cloudsewa_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;