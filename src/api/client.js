import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/with-god"; 


// On crée une instance Axios pointant vers le backend Node.js
const apiClient = axios.create({
    baseURL: API_URL, 
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






















