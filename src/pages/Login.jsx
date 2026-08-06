import { useState, useContext } from 'react';
import { authApi } from '../api/authApi';
import { AuthContext } from '../context/authContext';  
import './Login.css';

function Login({onNavigateToRegister}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const [showPassword, setShowPassword] = useState(false); 
    const [success, setSuccess] = useState(''); 
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { loginUser } = useContext(AuthContext);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const data = await authApi.login(email, password);
            if (data.data.token) {
                
                // MODIFICATION ICI : On construit proprement l'objet avec les infos de l'API
               
                const userProfile = {
                    name: data.data.user?.username,
                    email: data.data.user?.email,
                    id: data.data.user?.id,
                    created:data.data.user?.creer_le,
                    date_connexion:data.data.user?.date_connexion,
                };
        
                // On passe le token et le profil extrait à notre nouvelle fonction du contexte
                loginUser(data.data.token, userProfile);
            
                setSuccess(data.message);
                setError('');
                setEmail('');
                setPassword('');
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Une erreur est survenue lors de la connexion. Vérifiez votre connexion internet.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>With God 🕊️</h2>
                <p>Connectez-vous sur votre compte pour rejoindre la communauté de prière</p>
                {error && <div className="error-message fs-6" style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px', textAlign: 'left' }}>⚠️ {error}</div>}

                {success && <div className="success-message fs-6">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className='text-white' htmlFor="email">ADRESSE EMAIL</label>
                        <input 
                            type="email" 
                            id="email"
                            placeholder="exemple@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className='text-white' htmlFor="password">MOT DE PASSE</label>
                        <input 
                            type={showPassword ? "text" : "password"} 
                            id="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="show-password-container">
                        <input 
                            type="checkbox" 
                            id="show-pass" 
                            checked={showPassword}
                            onChange={() => setShowPassword(!showPassword)}
                        />
                        <label htmlFor="show-pass">Afficher le mot de passe</label>
                    </div>

                    <button 
                        type="submit" 
                        className="login-btn"
                        disabled={loading}
                    >
                        {loading ? 'Connexion en cours...' : 'Se connecter'}
                    </button>
                    
                    <div style={{ marginTop: '20px', fontSize: '15px', color: '#380808' }}>
                     Vous n'avez pas de compte ?{' '}
                    <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontLine: 'inherit', textDecoration:'underline', fontSize:'16px' }}
                        onClick={onNavigateToRegister}
                    >
                        Créer un compte
                    </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default Login;