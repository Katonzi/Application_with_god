import apiClient from './client';

export const authApi = {

    login: async (email, password) => {
        const response = await apiClient.post('/auth/login', { email, password });   
        return response.data; 
    },

    register: async (username, email, password) => {
        const response = await apiClient.post('/auth/register', { username, email, password });
        return response.data;
    },

    getUserPrayers: async (token) => {
    const response = await apiClient.get(`/prayers/get/user-stats`, {
        headers: {  
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
},

// À ajouter à l'intérieur de ton objet 'authApi'
getAllPrayers: async (token) => {
    return await apiClient.get(`/prayers/get/all-prayers`, {
        headers: {
            'Authorization': `Bearer ${token}` 
        }
    });
},
createPrayer: async (prayerData, token) => {
    const response =  await apiClient.post(`/prayers/post/create-prayers`, prayerData, {
        headers: {
            'Authorization': `Bearer ${token}`   
        }
    });

    return response.data;
},

getUsersInformation: async(token)=>{
    const user = await apiClient.get('/auth/user-connect', {
        Authorization:`Bearer ${token}`
    });

    return user;
},
getUserPrayersPersonnal : async(token)=>{
    const user = await apiClient.get('prayers/get/user-prayers', {
        Authorization:`Bearer ${token}`
    });

    return user.data;
},
toggleSupport: async (prayerId, token) => {
    const response = await apiClient.post(`/prayers/post/toggle-support`, { prayerId }, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    return response.data;
},
// 1. Ajouter un nouveau commentaire
// On passe le prayerId pour l'URL, le texte emballé dans un objet pour le req.body, et le token pour l'auth
createComment: async (prayerId, commentText, token) => {
    try {
        const response = await apiClient.post(`/comments/post/${prayerId}`, 
            { comment_text: commentText }, // Enrobé sous la clé attendue par le contrôleur
            {
                headers: {
                    Authorization: `Bearer ${token}` // Ton système d'authentification
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error(`Erreur authApi.createComment pour la prière ${prayerId}:`, error);
        throw error;
    }
},

// 2. Récupérer tous les commentaires d'une intention spécifique
// On passe le prayerId pour savoir quelle liste charger, et le token
getComments: async (prayerId, token) => {
    try {
        const response = await apiClient.get(`/comments/get/${prayerId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data; // Renverra l'objet { success: true, data: [les_commentaires] }
    } catch (error) {
        console.error(`Erreur authApi.getComments pour la prière ${prayerId}:`, error); 
        throw error;
    }
},
removePrayers: async (prayerId, token)=>{
    try{
        const response = await apiClient.delete(`/delete/${prayerId}`, {
            Authorization:`Bearer ${token}`
        });
    }catch(error){
        console.error("Error lors de la récupération des données : ", error);
        throw error
    }
    
}, 
//Fonction pour récupérer les veresets de la basee de données de la bible;
getVersesDays:async(token)=>{
    try{
        const response = await apiClient.get(`verses/today`, {
            Authorization:`Bearer ${token}`
        });
        return response.data;
    }catch(error){
        console.error("Error lors de la récupération des données : ", error);
    }
},
// Récupérer tous les livres (pour la barre latérale)
getBibleBooks: async (token) => {
    try {
        const response = await apiClient.get(`bible/books`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Erreur lors de la récupération des livres : ", error);
        throw error;
    }
},

// Récupérer le nombre de chapitres d'un livre spécifique
getBibleChaptersCount: async (token, bookId) => {
    try {
        const response = await apiClient.get(`bible/books/${bookId}/chapters`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des chapitres pour le livre ${bookId} : `, error);
        throw error;
    }
},

// Récupérer les versets d'un chapitre précis
getBibleVerses: async (token, bookId, chapterId) => {
    try {
        const response = await apiClient.get(`bible/books/${bookId}/chapters/${chapterId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`Erreur lors de la récupération des versets (${bookId}:${chapterId}) : `, error);
        throw error;
    }
},
//Fonction pour filtrer les résultat d'un versets recherché.
searchBibleVerses: async (token, query) => {
    try {
        const response = await apiClient.get(`bible/search?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Erreur lors de la recherche : ", error);
        throw error;
    }
},

// 1. Rechercher un utilisateur par son nom complet exact
searchUserByUsername: async (token, username) => {
    try {
        const response = await apiClient.get(`/chats/search?username=${encodeURIComponent(username)}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data; // Renvoie { success: true, user: { id, username } }
    } catch (error) {
        console.error("Erreur lors de la recherche de l'utilisateur : ", error);
        throw error;
    }
},

// Trouver ou créer la conversation avec le contact sélectionné
getOrCreateConversation: async (token, receiverId) => {
    try {
        // On envoie bien 'receiverId' pour correspondre à ce que le contrôleur backend attend
        const response = await apiClient.post(`/chats/conversation`, { receiverId }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data; // Renvoie { success: true, conversationId: X }
    } catch (error) {
        console.error("Erreur lors de la création/récupération du salon : ", error);
        throw error;
    }
},

// 3. Charger tout l'historique des messages déchiffrés d'une conversation précise
getChatHistory: async (token, conversationId) => {
    try {
        const response = await apiClient.get(`/chats/history/${conversationId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data; // Renvoie { success: true, messages: [...] }
    } catch (error) {
        console.error(`Erreur lors du chargement de l'historique ${conversationId} : `, error);
        throw error;
    }
},

// Récupérer tous les messages décryptés d'une conversation précise
getMessages: async (token, conversationId) => {
    try {
        // Appelle ta route GET du backend /api/chat/history/:conversationId
        const response = await apiClient.get(`/chats/history/${conversationId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        // Renvoie directement l'objet du contrôleur backend : { success: true, data: [...] }
        return response.data; 
    } catch (error) {
        console.error("Erreur lors de la récupération des messages : ", error);
        throw error;
    }
},
//La récuperation des tous les messages des utilisateur toute conversation confondues.
getAllUserMessages:async(token)=>{
   try{
     const response = await apiClient.get(`/chats/all-messages`, {
        headers:{
            Authorization:`Baerer ${token}`
        }
    });
    return response.data;
   }catch(err){
    console.error("Une erreur s'est produite...", err);
   }

},

// Vos fonctions pour les notifications dans authApi.js

// 1. Récupérer toutes les notifications de l'utilisateur
getUserNotifications: async (token) => {
  try {
    const response = await apiClient.get('/notifications', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.error("Erreur lors de la récupération des notifications :", err);
    throw err;
  }
},

// 2. Marquer une notification spécifique comme lue
markNotificationAsRead: async (notificationId, token) => {
  try {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.error("Erreur lors du changement de statut de la notification :", err);
    throw err;
  }
},

// 3. Marquer toutes les notifications comme lues
markAllNotificationsAsRead: async (token) => {
  try {
    const response = await apiClient.patch('/notifications/read-all', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (err) {
    console.error("Erreur lors de la mise à jour globale des notifications :", err);
    throw err;
  }
}
}





