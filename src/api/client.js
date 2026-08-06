import axios from 'axios';

// On crée une instance Axios pointant vers le backend Node.js
const apiClient = axios.create({
    baseURL: 'http://localhost:5000/api/with-god', 
    headers: {
        'Content-Type': 'application/json'
    }
});

// Un "intercepteur" : avant chaque requête, on regarde si on a un token en mémoire
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;






















