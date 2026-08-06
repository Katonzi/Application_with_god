import { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {

    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const checkLoggedInUser = () => {
            try {
                // On extrait directement les valeurs du localStorage
                const storedToken = localStorage.getItem('token');
                const savedUser = localStorage.getItem('user_data');
                
                // On met à jour les deux états globaux de React en même temps
                if (storedToken) {
                    setToken(storedToken); // REMPLIT L'ÉTAT DU TOKEN
                    setUser(savedUser ? JSON.parse(savedUser) : { loggedIn: true });
                } else {
                    setToken(null);
                    setUser(null);
                }

            } catch (error) {
                console.error("Erreur lors de la vérification du token", error);
                setToken(null);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkLoggedInUser();
    }, []);

    // Les fonctions globales de connexion et déconnexion
    const loginUser = (token, userData) => {
        localStorage.setItem('token', token);
        setToken(token); // AJUSTEMENT : On met à jour l'état local du token à la connexion
        
        // Si userData est fourni (ex: venant de ton formulaire/API), on l'enregistre
        if (userData) {
            localStorage.setItem('user_data', JSON.stringify(userData));
            setUser(userData);
            return;
        } else {
           setUser({loggedIn:true})
        }
    };

    const logoutUser = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user_data');
        setToken(null); // AJUSTEMENT : On remet l'état local du token à null à la déconnexion
        setUser(null);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#1a2a6c', fontWeight: 'bold' }}>
                Vérification de la session...
            </div>
        );
    }

    // 3. On distribue les états et les fonctions à tous les enfants (children)
    return (
        <AuthContext.Provider value={{ token, user, loginUser, logoutUser, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}