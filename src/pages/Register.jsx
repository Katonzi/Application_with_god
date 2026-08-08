import { useState, useEffect } from 'react';
import { authApi } from '../api/authApi';
import Login from './Login';
import './Register.css';

function Register({ onNavigateToLogin }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [politique, setPolitique] = useState(false);

    const [step, setStep] = useState(1); 
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    
    const [countdown, setCountdown] = useState(5);
    const [redirectToLogin, setRedirectToLogin] = useState(false);

    // Gestion du compte à rebours pour la redirection
    useEffect(() => {
        if (!success) return;
        if (countdown === 0) {
            setRedirectToLogin(true);
            return;
        }
        const timer = setTimeout(() => {
            setCountdown(countdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
    }, [success, countdown]);

    const handleNextStep1 = (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !email.trim()) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        setStep(2);
    };

    // Étape 2 : Vérification stricte des mots de passe
    const handleNextStep2 = (e) => {
        e.preventDefault();
        setError('');

        
        
        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        setStep(3); 
        
    };

    // Étape 3 : Soumission finale réelle
    const handleRegisterSubmit = async () => {
        setError('');
        setLoading(true);
        if (password !== confirmPassword) {
            setError('Erreur : Les mots de passe ne correspondent pas.');
            setStep(2);
            setLoading(false);
            return;
        }

       
        try {
            const data = await authApi.register(username, email, password);
            console.log(name);
            setSuccess(true); 
            setMessage(data.message);
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Une erreur est survenue lors de l'inscription.";
            setError(errorMessage);
            setStep(1); 
            setLoading(false);
        }
    };

    const handleConfirmCancel = () => {
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError('');
        setStep(1);
        setShowCancelConfirm(false);
    };

    if (redirectToLogin) {
        onNavigateToLogin();
        return null;
    }

    return (
        <div className="register-container">
            
            {/* Backdrop de confirmation d'annulation */}
            {showCancelConfirm && (
                <div className="cancel-backdrop">
                    <div className="cancel-modal">
                        <h4>Annuler l'inscription ?</h4>
                        <p>Voulez-vous vraiment annuler ? Toutes vos informations saisies seront effacées.</p>
                        <div className="cancel-modal-actions">
                            <button type="button" className="confirm-btn" onClick={handleConfirmCancel}>
                                Oui
                            </button>
                            <button type="button" className="reject-btn" onClick={() => setShowCancelConfirm(false)}>
                                Non
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Backdrop de succès plein écran */}
            {success && (
                <div className="success-backdrop">
                    <div className="success-modal">
                        <h3>🕊️ Inscription Réussie !</h3>
                        <p>{message}</p>
                        <div className="countdown-number">{countdown}</div>
                    </div>
                </div>
            )}

            <div className="register-card">
                <h2>WithGod 🕊️</h2>
                
                {!success && (
                    <p>
                        {step === 1 && "Créez votre compte personnel"}
                        {step === 2 && "Sécurisez votre accès"}
                        {step === 3 && "Vérification de vos informations"}
                    </p>
                )}

                {error && <div className="error-message text-danger">⚠️ {error}</div>}

                {/* --- ÉTAPE 1 : Informations personnelles --- */}
                {step === 1 && (
                    <form onSubmit={handleNextStep1}>
                        <div className="form-group">
                            <label htmlFor="username">NOM</label>
                            <input 
                                type="text" 
                                id="username"
                                placeholder="Nom complet"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">ADRESSE EMAIL</label>
                            <input 
                                type="email" 
                                id="email"
                                placeholder="exemple@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="register-btn">
                            Suivant
                        </button>

                        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
                            Vous avez déjà un compte ?{' '}
                            <button type="button" style={{ background: 'none', border: 'none', color: '#2f80ed', fontWeight: 'bold', cursor: 'pointer', padding: 0 }} onClick={onNavigateToLogin}>
                                Connectez-vous
                            </button>
                        </div>
                        
                        <span className="step-indicator"> étape 1/3</span>
                    </form>
                )}

                {/* --- ÉTAPE 2 : Création du mot de passe --- */}
                {step === 2 && (
                    <form onSubmit={handleNextStep2} className="animated-step">
                        <div className="form-group">
                            <label htmlFor="password">CRÉER VOTRE MOT DE PASSE</label>
                            <div className="password-input-wrapper">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    id="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button type="button" className="toggle-password-btn" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? "Masquer" : "Afficher"}
                                </button>
                            </div>
                            
                            {/* MESSAGE EN TEMPS RÉEL : s'affiche uniquement si l'utilisateur a commencé à écrire ET qu'il y a moins de 6 caractères */}
                            {password.length > 0 && password.length < 6 && (
                                <span className="password-hint">
                                    💡 Le mot de passe doit avoir au moins 6 caractères ({password.length}/6)
                                               </span>
                            )}
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">CONFIRMER VOTRE MOT DE PASSE</label>
                            <div className="password-input-wrapper">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    id="confirmPassword"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    /* Désactivé tant que le premier mot de passe n'a pas 6 caractères */
                                    disabled={password.length < 6}
                                />
                            </div>
                        </div>

                        {/* Le bouton "Suivant" se désactive automatiquement si le mot de passe est trop court */}
                        <button 
                            type="submit" 
                            className="register-btn"
                            disabled={password.length < 6}
                        >
                            Suivant
                        </button>

                        <button type="button" style={{ background: 'none', border: 'none', color: '#666', marginTop: '15px', cursor: 'pointer', fontSize: '13px', display: 'block', width: '100%' }} onClick={() => setStep(1)}>
                            ← Retourner à l'étape précédente
                        </button>

                        <span className="step-indicator">étape 2/3</span>
                    </form>
                )}

                {/* --- ÉTAPE 3 : RÉCAPITULATIF ET CONFIRMATION FINALE --- */}
                {step === 3 && !success && (
                    <div className="animated-step">
                        <p style={{ fontSize: '13px', color: '#555', textAlign: 'left', marginBottom: '15px', lineHeight: '1.4' }}> <strong>{username}, </strong> 
                             Vous êtes sur le point de créer un compte sur <strong>With God</strong> avec les informations suivantes :
                        </p>

                        <div className="summary-box">
                            <div className="summary-item">
                                <div className="summary-label">Nom complet</div>
                                <div className="summary-value">{username}</div>
                            </div>
                            <div className="summary-item" style={{ marginTop: '12px' }}>
                                <div className="summary-label">Adresse Email</div>
                                <div className="summary-value">{email}</div>
                            </div>
                        </div>

                                <div className='dispotion-politique'>
                                    <p><input type="checkbox" name="politique" id="politique" /> Accepter nos <a href="#">politiques de confidentialité</a>
                                    </p> 
                                </div>
                        <button 
                            type="button" 
                            className="register-btn"
                            onClick={handleRegisterSubmit}
                            disabled={loading}
                        >
                            {loading ? "Création en cours..." : "Valider l'inscription"}
                        </button>

                        <button 
                            type="button" 
                            className="cancel-btn"
                            onClick={() => setShowCancelConfirm(true)}
                            disabled={loading}
                        >
                            Annuler
                        </button>
                            <button type="button" style={{ background: 'none', border: 'none', color: '#666', marginTop: '15px', cursor: 'pointer', fontSize: '13px', display: 'block', width: '100%' }} onClick={() => setStep(2)}>
                            ← Retourner à l'étape précédente
                        </button>
                        <span className="step-indicator" style={{ marginTop: '20px' }}> étape 3/3</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Register;