import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { Loader2, Plus, Calendar, Heart, MessageCircle, ArrowLeft } from 'lucide-react';
import './PrayerRequestsWidget.css';

function PrayerRequestsWidget({ onBack }) {
    const { token } = useContext(AuthContext);  
    const [prayers, setPrayers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // On récupère le thème actuel ("dark" ou "light") directement du localStorage
    const currentThemeMode = localStorage.getItem('theme') || 'light';

    useEffect(() => {
        const fetchUserPrayers = async () => {
            try {
                const activeToken = localStorage.getItem('token') || token;
                const response = await authApi.getUserPrayersPersonnal(activeToken);
                
                if (response && response.data) {
                    const extractedData = response.data.data || response.data;
                    setPrayers(Array.isArray(extractedData) ? extractedData : []);
                }
            } catch (error) {
                console.error("Erreur lors de la récupération des intentions :", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserPrayers();
    }, [token]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('fr-FR', options);
    };

    const colorThemes = ['theme-grace', 'theme-peace', 'theme-hope', 'theme-light'];

    if (loading) {
        return (
            <div className={`prayer-loader ${currentThemeMode}`}>
                <Loader2 size={16} className="prayer-spin" />
                <span>Chargement de tes intentions...</span>
            </div>
        );
    }

    return (
        /* On injecte dynamiquement la classe "dark" ou "light" ici sur le wrapper principal */
        <div className={`prayer-widget-wrapper ${currentThemeMode}`}>
            
            <button className="btn-back-unique border-0 d-flex align-items-center justify-content-center shadow-sm" onClick={onBack}>
                <ArrowLeft size={20} />
            </button>

            <div className="prayer-widget-header">
                <div className="header-title-zone">
                    <h3 className="prayer-title">Mes Intentions</h3>
                    <span className="prayer-count">{prayers.length}</span>
                </div>
                <button type="button" className="add-prayer-mini-btn" title="Nouvelle intention">
                    <Plus size={16} />
                </button>
            </div>

            {prayers.length === 0 ? (
                <div className="prayer-empty-state">
                    <p>Aucune intention déposée pour le moment. Confie ce que tu as sur le cœur.</p>
                </div>
            ) : (
                <div className="prayers-vibrant-list">
                    {prayers.map((prayer, index) => {
                        const currentTheme = colorThemes[index % colorThemes.length];
                        const totalLikes = prayer.likes_count || prayer.likes || 0;
                        const totalComments = prayer.comments_count || prayer.comments || 0;
                        
                        return (
                            <div 
                                key={prayer.id || index} 
                                className={`prayer-vibrant-card ${currentTheme}`}
                                style={{ animationDelay: `${index * 0.08}s` }} 
                            >
                                <div className="prayer-card-body">
                                    <p className="prayer-text-content">{prayer.description || prayer.content}</p>
                                </div>
                                
                                <div className="prayer-card-footer">
                                    <div className="prayer-date">
                                        <Calendar size={11} />
                                        <span>{formatDate(prayer.created_at || prayer.date)}</span>
                                    </div>
                                    
                                    <div className="prayer-stats-zone">
                                        <div className="prayer-stat-item support-stat">
                                            <Heart size={12} className="heart-pulse-icon" />
                                            <span>Soutenu par {totalLikes}</span>
                                        </div>
                                        
                                        <div className="prayer-stat-item comment-stat">
                                            <MessageCircle size={12} />
                                            <span>{totalComments} coms</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default PrayerRequestsWidget;