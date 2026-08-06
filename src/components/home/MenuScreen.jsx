import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/authContext';
import ProfileScreen from './profileScreen';
import PrayerRequestsWidget from '../intentions/PrayerRequestsWidget';
import BibleReader from '../bible/BibleReader';
import { User, BookMarked, Settings, Moon, Sun, BookOpen, HeartHandshake, LogOut, PcCase, ChevronRight, FileAudio2} from 'lucide-react';


function MenuScreen() {
    const { logoutUser } = useContext(AuthContext);
    const { user } = useContext(AuthContext);

    const userName = user?.name || "Denis Katonzi";
    const userEmail = user?.email || "exemple@gmail.com";
    const userRole = "Membre de la communauté";
    
    // Nouvel état pour savoir si on affiche le sous-écran Profil
    const [currentSubScreen, setCurrentSubScreen] = useState('menu-home');
    
    // Nouvel état pour piloter la boîte de dialogue de déconnexion
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark'; 
    });

    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const menuOptions = [
        { id: 'profile', label: 'Mon Profil', icon: <User size={20} className="text-primary" /> },
        { id: 'my-prayers', label: 'Mes intentions de prières', icon: <BookMarked size={20} className="text-success" /> },
        { id: 'read-bible', label: 'Lire la sainte Bible', icon: <BookOpen size={20} className="text-warning" /> },
        { id: 'all-prayers', label: 'Toutes les intentions', icon: <HeartHandshake size={20} className="text-info" /> },
        {id:'audio-musique', label:'Écouter la musique', icon: <FileAudio2 size={20}/>},
        { id: 'settings', label: 'Paramètres du compte', icon: <Settings size={20} className="text-secondary" /> },
        { id: 'developper', label: 'Développeur', icon: <PcCase size={20} className="text-danger" /> },
    ];

    // FONCTION POUR GÉRER LES CLICS SUR LES OPTIONS
    const handleOptionClick = (optionId) => {
        if (optionId === 'profile') {
            setCurrentSubScreen('profile'); // Ouvre l'écran de profil
        } 
        else if(optionId ==='my-prayers'){
            setCurrentSubScreen('my-prayers')
        }
        else if(optionId ==='read-bible'){
            setCurrentSubScreen('read-bible');
        }
        else {
            alert(`Option cliquée ! Prochaine étape.`);
        }
    };

    // SI L'ÉTAT EST SUR 'profile', ON REND LE COMPOSANT DU PROFIL
    if (currentSubScreen === 'profile') {
        return <ProfileScreen onBack={() => setCurrentSubScreen('menu-home')} />;
    }
    else if(currentSubScreen === 'my-prayers'){
        return <PrayerRequestsWidget onBack={()=>setCurrentSubScreen('menu-home')}/>
    }
    else if(currentSubScreen ==='read-bible'){
        return <BibleReader onBack={()=>setCurrentSubScreen('menu-home')}/>
    }


    return (
        <div className="menu-screen-container animated-fadeIn position-relative">
            
            {/* 1. SECTION PROFIL RAPIDE (Cliquable également pour aller au profil) */}
            <div 
                className="menu-profile-card p-3 mb-3 bg-white rounded-4 shadow-sm d-flex align-items-center justify-content-between style-profile-click"
                onClick={() => setCurrentSubScreen('profile')}
            >
                <div className="d-flex align-items-center">
                    <div className="menu-avatar-placeholder me-3">
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="fs-6 fw-bold m-0 text-dark-custom">{userName}</h3>
                        <p className="m-0 text-muted fs-8">{userRole}</p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-muted" />
            </div>

            {/* 2. INTERRUPTEUR MODE SOMBRE */}
            <div className="p-3 mb-3 bg-white rounded-4 shadow-sm d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    {isDarkMode ? <Moon size={20} className="text-purple me-3" /> : <Sun size={20} className="text-warning me-3" />}
                    <span className="fw-semibold text-dark-custom fs-7">Mode Sombre</span>
                </div>
                <div className="form-check form-switch m-0 fs-5">
                    <input 
                        className="form-check-input style-switch" 
                        type="checkbox" 
                        role="switch"
                        checked={isDarkMode}
                        onChange={() => setIsDarkMode(!isDarkMode)}
                        id="themeSwitch"
                    />
                </div>
            </div>

            {/* 3. LISTE DES OPTIONS DYNAMIQUES */}
            <div className="bg-white rounded-4 shadow-sm overflow-hidden mb-3">
                {menuOptions.map((option, index) => (
                    <button 
                        key={option.id}
                        className={`w-100 p-3 text-start border-0 bg-transparent d-flex align-items-center justify-content-between menu-item-btn ${index < menuOptions.length - 1 ? 'border-bottom-gray' : ''}`}
                        onClick={() => handleOptionClick(option.id)}
                    >
                        <div className="d-flex align-items-center">
                            <span className="me-3 d-flex align-items-center">{option.icon}</span>
                            <span className="fw-semibold text-dark-custom fs-7">{option.label}</span>
                        </div>
                        <ChevronRight size={16} className="text-muted opacity-50" />
                    </button>
                ))}
            </div>

            {/* 4. BOUTON DÉCONNEXION */}
            <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-100 p-3 rounded-4 border-0 btn-logout-custom d-flex align-items-center justify-content-center fw-bold fs-7"
            >
                <LogOut size={18} className="me-2" />
                Se déconnecter
            </button>

            {/* =========================================================
                BOÎTE DE DIALOGUE PERSONNALISÉE (MODALE DE DÉCONNEXION)
                ========================================================= */}
            {showLogoutConfirm && (
                <div 
                    className="logout-modal-overlay position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                        zIndex: 1050,
                        backdropFilter: 'blur(8px)'
                    }}
                >
                    <div 
                        className="logout-modal-card bg-white text-center p-4 shadow-lg animated-scaleUp"
                        style={{
                            width: '100%',
                            maxWidth: '380px',
                            borderRadius: '24px',
                            margin: '0 15px'
                        }}
                    >
                        <div 
                            className="logout-icon-wrapper mx-auto mb-3 d-flex align-items-center justify-content-center bg-danger-subtle rounded-circle"
                            style={{ width: '60px', height: '60px' }}
                        >
                            <LogOut size={26} className="text-danger" />
                        </div>

                        <h3 className="fs-5 fw-bold text-dark mb-2">Déconnexion</h3>
                        <p className="text-muted mb-4 px-2 fs-7">
                            Voulez-vous vraiment vous déconnecter de votre espace communautaire ?
                        </p>

                        <div className="d-flex flex-column-reverse flex-sm-row gap-2 justify-content-center">
                            <button 
                                type="button"
                                className="btn btn-light border-0 py-2 px-4 fw-semibold flex-grow-1 fs-7"
                                onClick={() => setShowLogoutConfirm(false)}
                                style={{ borderRadius: '12px' }}
                            >
                                Annuler
                            </button>
                            <button 
                                type="button"
                                className="btn btn-danger border-0 py-2 px-4 fw-bold flex-grow-1 fs-7"
                                onClick={() => {
                                    setShowLogoutConfirm(false);
                                    logoutUser();
                                }}
                                style={{ borderRadius: '12px' }}
                            >
                                Oui, quitter
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default MenuScreen;