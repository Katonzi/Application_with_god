import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';           
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import './DailyVerseWidget.css';

function DailyVerseWidget() {
    const { token } = useContext(AuthContext);
    const [verse, setVerse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState(null);

    // On récupère dynamiquement le thème actuel stocké
    const currentThemeMode = localStorage.getItem('theme') || 'light';

    useEffect(() => {
        const fetchDailyVerse = async () => {
            try {
                const activeToken = localStorage.getItem('token') || token;
                const response = await authApi.getVersesDays(token);
                
                if (response && response.data) {
                    const extractedData = response.data.data || response.data;
                    setVerse(extractedData);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération du verset du jour :", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDailyVerse();
    }, [token]);

    const toggleAudio = () => {
        if (!verse?.audio_url) return;

        if (!audio) {
            const newAudio = new Audio(verse.audio_url);
            newAudio.onended = () => setIsPlaying(false);
            setAudio(newAudio);
            newAudio.play();
            setIsPlaying(true);
        } else {
            if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
            } else {
                audio.play();
                setIsPlaying(true);
            }
        }
    };

    if (loading) {
        return (
            <div className={`spiritual-loader-container ${currentThemeMode}`}>
                <Loader2 size={18} className="spiritual-spin" />
                <span>Préparation de la Parole...</span>
            </div>
        );
    }

    if (!verse || !verse.content) return null;

    return (
        /* On injecte la classe dynamique ici sur le wrapper principal */
        <div className={`spiritual-main-wrapper ${currentThemeMode}`}>
            
            {/* BLOC PRINCIPAL : LE VERSET DU JOUR STYLISÉ */}
            <div className="spiritual-verse-container">
                <div className="spiritual-watermark">†</div>

                <div className="spiritual-verse-header">
                    <span className="spiritual-badge">Méditation Quotidienne</span>
                    {verse.audio_url && (
                        <button 
                            type="button" 
                            onClick={toggleAudio}
                            className={`spiritual-audio-btn ${isPlaying ? 'playing' : ''}`}
                            title={isPlaying ? "Mettre en pause" : "Écouter la Parole"}
                        >
                            {isPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>
                    )}
                </div>

                <div className="spiritual-verse-content">
                    “ {verse.content} ”
                </div>

                <div className="spiritual-divider">
                    <div className="spiritual-line"></div>
                    <div className="spiritual-dot"></div>
                    <div className="spiritual-line"></div>
                </div>

                <div className="spiritual-verse-footer">
                    <span className="spiritual-reference">{verse.reference || "Sainte Bible"}</span>
                </div>
            </div>

            {/* CONTENEUR DU BAS DE LA PAGE */}
            <div className="home-content-feed">
                
                {/* ACTIONS & DÉFIS DU JOUR */}
                <div className="daily-challenge-card">
                    <div className="challenge-badge">Défi de Courage</div>
                    <p className="challenge-text">
                        "Fortifie-toi et prends courage. Ne crains point, car l'Éternel ton Dieu est avec toi." Applique cette promesse aujourd'hui en tendant courageusement la main à un frère en difficulté.
                    </p>
                </div>

                {/* SÉLECTION PAR ÉTAT D'ESPRIT */}
                <div className="topics-section">
                    <h3 className="section-title">De quoi as-tu besoin aujourd'hui ?</h3>
                    <div className="topics-grid">
                        <button type="button" className="topic-chip">🔥 Besoin de Courage</button>
                        <button type="button" className="topic-chip">🕊️ Trouver la Paix</button>
                        <button type="button" className="topic-chip">⚓ Grandir en Foi</button>
                        <button type="button" className="topic-chip">🙏 Gratitude</button>
                    </div>
                </div>

                {/* RACCOURCIS RAPIDES */}
                <div className="quick-actions-row">
                    <div className="action-box">
                        <span className="action-icon">📖</span>
                        <span className="action-label">Plan de lecture</span>
                    </div>
                    <div className="action-box">
                        <span className="action-icon">📝</span>
                        <span className="action-label">Mes Notes</span>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default DailyVerseWidget;