import { useState, useEffect } from 'react';
import myLogo from '../assets/logo.png'; 
import MenuScreen from '../components/home/MenuScreen';
import FeedScreen from '../components/home/feedScreen';
import DailyVerseWidget from '../components/verses/DailyVerseWidget';
import ChatWindow from '../components/chats/ChatWindow';
import { Home as HomeIcon, MessageSquare, Bell, BookOpen, Menu } from 'lucide-react';
import './Home.css';

function Home() {
    // États pour la gestion des écrans et onglets
    const [showSplash, setShowSplash] = useState(true);
    const [activeTab, setActiveTab] = useState('home');

    // --- LOGIQUE DE L'EFFET DE FRAPPE (TYPEWRITER) ---
    const fullText = '"Avec Dieu, nous ferons des exploits ; Il écrasera nos ennemis."';
    const [typedText, setTypedText] = useState('');

    useEffect(() => {
        let index = 0;
        setTypedText(fullText.charAt(0)); 

        const typingInterval = setInterval(() => {
            index++;
            if (index < fullText.length) {
                setTypedText((prev) => prev + fullText.charAt(index));
            } else {
                clearInterval(typingInterval);
            }
        }, 50); 

        return () => clearInterval(typingInterval);
    }, []);

    // Effet pour fermer le Splash Screen après 5 secondes
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);


    // =========================================================
    // RENDU 1 : LE SPLASH SCREEN AVEC LE LOGO EN ROND INVISIBLE
    // =========================================================
    if (showSplash) {
        return (
            <div className="splash-screen bg-gradient-god text-white">
                <div className="splash-content px-3 text-center">
                    
                    {/* Le conteneur du logo reste inchangé */}
                    <div className="splash-logo-circle mb-3">
                        <img 
                            src={myLogo} 
                            alt="Logo With God" 
                            className="splash-custom-logo" 
                        />
                    </div>
                    
                    {/* Sur affichage mobile, tout le reste en dessous du logo est masqué (d-none d-md-block) */}
                    <div className="d-none d-md-block">
                        <h2 className="display-6 fw-bold mb-3">WITHGOD</h2>
                        <div className="splash-divider my-4"></div>
                        
                        <p className="fst-italic fs-5 lh-base px-2 typewriter-text">
                            {typedText}
                            <span className="cursor">|</span>
                        </p> <br />
                        <span className="badge bg-white text-primary fw-bold px-3 py-2 rounded-pill shadow-sm mt-2 animated-fadeIn">
                            Psaumes Chapitre 108 verset 14
                        </span>
                    </div>

                </div>
            </div>
        );
    }

    // =========================================================
    // RENDU 2 : L'INTERFACE PRINCIPALE RESPONSIVE
    // =========================================================
    return (
        <div className="home-layout container-fluid p-0">
            <div className="row g-0">

                {/* BARRE LATÉRALE À GAUCHE (S'affiche uniquement sur les écrans moyens et grands) */}
                <div className="bare-lateral dark-theme col-md-4 col-lg-2 d-none d-md-flex flex-column bg-white border-end p-3 vh-100 position-sticky top-0">
                    <div className="d-flex align-items-center mb-4">
                        <div className="header-logo-circle me-2">
                            <img src={myLogo} alt="Logo With God" className="header-custom-logo" />
                        </div>
                        <h1 className="m-0 fs-4 fw-bold text-primary-god logo-text">WithGod</h1>
                    </div>

                    {/* Zone de recherche non fonctionnelle pour l'instant */}
                    <div className="mt-2 mb-4">
                        <label className="form-label text-muted small fw-bold text-uppercase">Rechercher</label>
                        <div className="input-group">
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Rechercher des prières, membres..." 
                                disabled 
                            />
                            <button className="input-group-text bg-light text-muted">🔍</button>
                        </div>
                    </div>

                    <div className="mt-auto text-muted small text-center">
                        &copy; 2026 With God
                    </div>
                </div>

                {/* ZONE DE CONTENU PRINCIPALE (Prend tout l'espace sur mobile, et le reste sur desktop) */}
                <div className="col-12 col-md-8 col-lg-9 d-flex flex-column vh-100">
                    
                    {/* 1. HEADER (Masqué sur grand écran car déjà présent dans la sidebar gauche) */}
                    <header className="home-header px-3 bg-white d-flex align-items-center d-md-none">
                        <div className="d-flex align-items-center">
                            <div className="header-logo-circle me-2">
                                <img 
                                    src={myLogo} 
                                    alt="Logo With God" 
                                    className="header-custom-logo" 
                                />
                            </div>
                            <h1 className="m-0 fs-4 fw-bold text-primary-god logo-text">WithGod</h1>
                        </div>
                    </header>

                    {/* 2. BARRE DE NAVIGATION */}
                    <nav className="home-nav-tabs bg-white border-bottom d-flex justify-content-around">
                        <button 
                            className={`nav-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                            onClick={() => setActiveTab('home')}
                            title="Accueil"
                        >
                            <HomeIcon size={24} />
                            
                        </button>
                        
                        <button 
                            className={`nav-tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
                            onClick={() => setActiveTab('messages')}
                            title="Messages"
                        >
                            <MessageSquare size={24} />
                        </button>

                        <button 
                            className={`nav-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
                            onClick={() => setActiveTab('notifications')}
                            title="Notifications"
                        >
                            <Bell size={24} />
                        </button>

                        <button 
                            className={`nav-tab-btn ${activeTab === 'verses' ? 'active' : ''}`}
                            onClick={() => setActiveTab('verses')}
                            title="Verset du jour"
                        >
                            <BookOpen size={24} />
                        </button>

                        <button 
                            className={`nav-tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
                            onClick={() => setActiveTab('menu')}
                            title="Menu"
                        >
                            <Menu size={24} />
                        </button>
                    </nav>

                    {/* 3. ZONE DE CONTENU DYNAMIQUE */}
                    <main className="home-main-content flex-grow-1 overflow-auto py-3">
                        
                        {activeTab === 'home' && (
                            <FeedScreen />
                        )}

                        {activeTab === 'messages' && (
                            <div className="tab-content-placeholder text-center mt-4 text-muted">
                                <ChatWindow/>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="tab-content-placeholder text-center mt-4 text-muted">
                                <div>Barre de notification à venir</div>
                            </div>
                        )}

                        {activeTab === 'verses' && (
                            <div className="tab-content-placeholder text-center mt-4 text-muted">
                                <DailyVerseWidget/> 
                            </div>
                        )}

                        {activeTab === 'menu' && (
                            <MenuScreen />
                        )}

                    </main>
                </div>

            </div>
        </div>
    );
}

export default Home;