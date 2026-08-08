import { useState, useEffect, useContext, useMemo } from 'react';
import { AuthContext } from '../../context/authContext'; 
import { authApi } from '../../api/authApi';
import { Search, Send, Heart, MessageCircle, Share2, Sparkles, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import './feedScreen.css';

function FeedScreen() {
    const { user, token } = useContext(AuthContext);
    
    const [prayers, setPrayers] = useState([]); 
    const [searchQuery, setSearchQuery] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [newPrayer, setNewPrayer] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // État pour gérer l'affichage de la mini-liste des soutiens par carte
    const [expandedLikesPrayerId, setExpandedLikesPrayerId] = useState(null);

    // ÉTATS DÉDIÉS AUX COMMENTAIRES
    const [activeCommentPrayerId, setActiveCommentPrayerId] = useState(null);
    const [commentsMap, setCommentsMap] = useState({});
    const [loadingCommentsId, setLoadingCommentsId] = useState(null);
    const [newCommentTexts, setNewCommentTexts] = useState({});
    const [sendingCommentId, setSendingCommentId] = useState(null);

    const currentUserPseudo = user?.username || user?.name || '';

    // CHARGEMENT INITIAL DU FIL ET DE TOUS LES COMPTEURS DE COMMENTAIRES
    useEffect(() => {
        const loadFeed = async () => {
            try {
                const activeToken = localStorage.getItem('token') || token;
                const response = await authApi.getAllPrayers(activeToken);
                const fetchedPrayers = response.data?.data || response.data || [];
                
                setPrayers(fetchedPrayers);

                // SYNCHRONISATION EN ARRIÈRE-PLAN : On récupère les commentaires de chaque prière pour avoir le vrai total au rechargement
                if (fetchedPrayers.length > 0 && activeToken) {
                    fetchedPrayers.forEach(async (prayer) => {
                        const prayerId = prayer.id || prayer.prayer_id;
                        try {
                            const commRes = await authApi.getComments(prayerId, activeToken);
                            const commentsArray = commRes.data || [];
                            
                            // On stocke les commentaires trouvés
                            setCommentsMap(prev => ({ ...prev, [prayerId]: commentsArray }));
                            
                            // On force la mise à jour du compteur dans le tableau des prières
                            setPrayers(prevPrayers => 
                                prevPrayers.map(p => {
                                    const pId = p.id || p.prayer_id;
                                    if (String(pId) === String(prayerId)) {
                                        return {
                                            ...p,
                                            comments_count: commentsArray.length,
                                            commentsCount: commentsArray.length
                                        };
                                    }
                                    return p;
                                })
                            );
                        } catch (err) {
                            console.error(`Erreur synchro compteur prière ${prayerId}:`, err);
                        }
                    });
                }

            } catch (error) {
                console.error("Erreur lors du chargement du fil d'actualité :", error);
            } finally {
                setLoading(false);
            }
        };
        //Fonction pour récupérer une API de la bible Gratuite 
        loadFeed();     

    }, [token]);

    // FONCTION DE CALCUL DU TEMPS ÉCOULÉ INTELLIGENT
    const formatCommentDate = (dateString) => {
        if (!dateString) return "À l'instant";
        const now = new Date();
        const commentDate = new Date(dateString);
        const diffInMs = now - commentDate;
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMins / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMins < 1) return "À l'instant";
        if (diffInMins < 60) return `Il y a ${diffInMins} min`;
        if (diffInHours < 24) return `Il y a ${diffInHours} h`;
        if (diffInDays < 7) return `Il y a ${diffInDays} j`;

        return `le ${commentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${commentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const handlePublishPrayer = async (e) => {
        e.preventDefault();
        if (!newPrayer.trim()) return;

        setSubmitting(true);
        try {
            const activeToken = localStorage.getItem('token') || token;
            const prayerData = { description: newPrayer };
            
            if (activeToken) {
                const response = await authApi.createPrayer(prayerData, activeToken); 
                if (response.success) {
                    setSuccessMessage(response.message);
                    setNewPrayer('');
                    
                    // Rechargement complet propre
                    const freshData = await authApi.getAllPrayers(activeToken);
                    const freshPrayers = freshData.data?.data || freshData.data || [];
                    setPrayers(freshPrayers);
                    
                    // On relance la synchro des compteurs pour le nouveau tableau
                    freshPrayers.forEach(async (p) => {
                        const pId = p.id || p.prayer_id;
                        const cRes = await authApi.getComments(pId, activeToken);
                        setCommentsMap(prev => ({ ...prev, [pId]: cRes.data || [] }));
                    });
                    return;
                }
            }
        } catch (error) {
            console.error("Erreur lors de la publication :", error);
            alert("Impossible de partager votre intention. Vérifiez votre connexion.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleSupport = async (prayerId) => {
        try {
            const activeToken = localStorage.getItem('token') || token;
            if (!activeToken || !currentUserPseudo) return;

            const response = await authApi.toggleSupport(prayerId , activeToken);

            if (response.success) {
                setPrayers(prevPrayers => 
                    prevPrayers.map(p => {
                        const pId = p.id || p.prayer_id;
                        if (String(pId) === String(prayerId)) {
                            let namesArray = p.supporter_names ? p.supporter_names.split(', ') : [];
                            let newCount = p.supports_count || 0;

                            if (response.supported) {
                                newCount += 1;
                                if (!namesArray.includes(currentUserPseudo)) {
                                    namesArray.push(currentUserPseudo);
                                }
                            } else {
                                newCount = Math.max(0, newCount - 1);
                                namesArray = namesArray.filter(name => name !== currentUserPseudo);
                            }

                            return {
                                ...p,
                                supports_count: newCount,
                                supporter_names: namesArray.length > 0 ? namesArray.join(', ') : null
                            };
                        }
                        return p;
                    })
                );
            }
        } catch (error) {
            console.error("Erreur lors du toggle support :", error);
        }
    };

    // ACTIONNEUR DE LA SECTION DES COMMENTAIRES
    const handleToggleCommentsSection = async (prayerId) => {
        if (activeCommentPrayerId === prayerId) {
            setActiveCommentPrayerId(null);
            return;
        }

        setActiveCommentPrayerId(prayerId);
        setLoadingCommentsId(prayerId);

        try {
            const activeToken = localStorage.getItem('token') || token;
            const response = await authApi.getComments(prayerId, activeToken);
            
            const commentsArray = response.data || [];
            
            setCommentsMap(prev => ({
                ...prev,
                [prayerId]: commentsArray
            }));

            setPrayers(prevPrayers => 
                prevPrayers.map(p => {
                    const pId = p.id || p.prayer_id;
                    if (String(pId) === String(prayerId)) {
                        return {
                            ...p,
                            comments_count: commentsArray.length,
                            commentsCount: commentsArray.length
                        };
                    }
                    return p;
                })
            );
        } catch (error) {
            console.error("Erreur lors de la récupération des commentaires :", error);
        } finally {
            setLoadingCommentsId(null);
        }
    };

    // SAUVEGARDE ET ENVOI DU COMMENTAIRE
    const handlePostComment = async (e, prayerId) => {
        e.preventDefault();
        const text = newCommentTexts[prayerId] || '';
        if (!text.trim()) return;

        setSendingCommentId(prayerId);
        try {
            const activeToken = localStorage.getItem('token') || token;
            const response = await authApi.createComment(prayerId, text, activeToken);

            if (response.success) {
                setNewCommentTexts(prev => ({ ...prev, [prayerId]: '' }));

                const updatedComments = await authApi.getComments(prayerId, activeToken);
                const commentsArray = updatedComments.data || [];
                
                setCommentsMap(prev => ({
                    ...prev,
                    [prayerId]: commentsArray
                }));

                setPrayers(prevPrayers => 
                    prevPrayers.map(p => {
                        const pId = p.id || p.prayer_id;
                        
                        if (String(pId) === String(prayerId)) {
                            const newCount = commentsArray.length;
                            
                            return { 
                                ...p, 
                                comments_count: newCount,
                                commentsCount: newCount
                            };
                        }
                        return p;
                    })
                );
            }
        } catch (error) {
            console.error("Erreur lors de l'envoi du commentaire :", error);
        } finally {
            setSendingCommentId(null);
        }
    };

    const handleCommentInputChange = (prayerId, value) => {
        setNewCommentTexts(prev => ({ ...prev, [prayerId]: value }));
    };

    const toggleExpandLikes = (prayerId, e) => {
        e.stopPropagation();
        setExpandedLikesPrayerId(expandedLikesPrayerId === prayerId ? null : prayerId);
    };

    // LOGIQUE DE RENDU DES SOUTIENS
    const renderLikeSentence = (prayer) => {
        if (!prayer.supporter_names) return null;

        let supporters = prayer.supporter_names.split(', ').map(name => name.trim()).filter(Boolean);
        if (supporters.length === 0) return null;

        const hasLiked = currentUserPseudo && supporters.includes(currentUserPseudo);
        let listWithoutMe = supporters.filter(name => name !== currentUserPseudo);

        let sentenceElements = [];
        let displayCount = 0;

        if (hasLiked) {
            sentenceElements.push("Vous");
            displayCount++;
        }

        if (listWithoutMe.length > 0) {
            if (sentenceElements.length > 0) sentenceElements.push(", ");
            sentenceElements.push(listWithoutMe[0]);
            displayCount++;
        }

        const remainingCount = supporters.length - displayCount;

        return (
            <div className="d-flex flex-column w-100">
                <div 
                    className="fs-9 text-muted border-top border-light-subtle pt-2 mt-1 d-flex align-items-center flex-wrap gap-1"
                    style={{ fontStyle: 'italic', lineHeight: '1.4' }}
                >
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Soutenu par :</span>
                    <span className="text-dark-custom fw-medium">
                        {sentenceElements.map((el, idx) => <span key={idx}>{el}</span>)}
                    </span>

                    {remainingCount > 0 && (
                        <button 
                            type="button"
                            onClick={(e) => toggleExpandLikes(prayer.id || prayer.prayer_id, e)}
                            className="btn p-0 border-0 bg-transparent fs-9 text-primary-god fw-bold d-inline-flex align-items-center gap-0.5 ms-1"
                            style={{ textDecoration: 'underline', color: '#0d6efd', fontStyle: 'normal' }}
                        >
                            et {remainingCount} autre{remainingCount > 1 ? 's' : ''}
                            {expandedLikesPrayerId === (prayer.id || prayer.prayer_id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                </div>

                {expandedLikesPrayerId === (prayer.id || prayer.prayer_id) && (
                    <div 
                        className="p-2.5 mt-2 rounded-3 bg-light border border-light-subtle animated-fadeIn shadow-inner"
                        style={{ 
                            maxHeight: '120px', 
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            WebkitOverflowScrolling: 'touch'
                        }}
                    >
                        <div className="fs-9 fw-bold text-secondary mb-1 border-bottom pb-1" style={{ fontSize: '10px' }}>
                            Soutiens à cette intention ({supporters.length}) :
                        </div>
                        <div className="d-flex flex-column gap-1">
                            {supporters.map((name, idx) => (
                                <div 
                                    key={idx} 
                                    className="fs-8 py-1 px-2 rounded-2 bg-white border border-light d-flex align-items-center gap-2 fw-medium text-dark-custom"
                                    style={{ fontSize: '11px' }}
                                >
                                    <div 
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" 
                                        style={{ 
                                            width: '18px', 
                                            height: '18px', 
                                            fontSize: '8px',
                                            backgroundColor: name === currentUserPseudo ? '#dc3545' : '#6c757d' 
                                        }}
                                    >
                                        {name.charAt(0).toUpperCase()}
                                    </div>
                                    <span>
                                        {name} {name === currentUserPseudo ? "(Moi)" : ""}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const filteredPrayers = useMemo(() => {
        return prayers.filter(prayer => {
            const content = prayer.description?.toLowerCase() || '';
            const author = prayer.username?.toLowerCase() || '';
            const query = searchQuery.toLowerCase();
            return content.includes(query) || author.includes(query);
        });
    }, [prayers, searchQuery]);

    return (
        <div className="feed-screen-container animated-fadeIn px-2 pb-5">
            
            {/* 1. BARRE DE RECHERCHE */}
            <div className="search-bar-wrapper mb-4 shadow-sm position-relative md-d-none">
                <Search size={18} className="search-iconposition position-absolute top-50 translate-middle-y text-muted" />
                <input 
                    type="text" 
                    className="form-control border-0 search-input-custom ps-5 py-2.5 fs-7" 
                    placeholder="Rechercher une intention, un frère ou une sœur..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* 2. ZONE DE SAISIE PRINCIPALE */}
            <div className="share-prayer-card p-3 mb-4 shadow-sm">
                <form onSubmit={handlePublishPrayer}>
                    <div className="d-flex gap-3 align-items-start mb-3">
                        <div className="feed-avatar-mini rounded-circle d-flex align-items-center justify-content-center fw-bold text-white shadow-sm">
                            {currentUserPseudo ? currentUserPseudo.charAt(0).toUpperCase() : '?'}
                        </div>
                        
                        <div className="textarea-box-container flex-grow-1">
                            <textarea 
                                className="form-control border-0 share-textarea-custom p-0"
                                rows="3"
                                placeholder="Cliquez ici pour écrire votre intention de prière..."
                                value={newPrayer}
                                onChange={(e) => setNewPrayer(e.target.value)}
                                disabled={submitting}
                            />
                        </div>
                    </div>
                    
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light">
                        <span className="small text-muted d-flex align-items-center gap-1 fs-8 fw-medium">
                            <Sparkles size={14} className="text-warning" /> Visible par toute la communauté
                        </span>
                        
                        <button 
                            type="submit" 
                            className="btn btn-god-primary d-flex align-items-center gap-2 px-4 py-1.5 rounded-3 fw-bold fs-7 shadow-sm text-white"
                            disabled={!newPrayer.trim() || submitting}
                        >
                            {submitting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <>
                                    Publier <Send size={10} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {successMessage && (
                <div className="alert alert-success py-2 px-3 rounded-3 fs-7 mb-3">{successMessage}</div>
            )}

            {/* 3. LISTE DYNAMIQUE DU FIL */}
            {loading ? (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 text-primary-god">
                    <Loader2 size={36} className="animate-spin mb-2" />
                    <span className="fs-7 fw-medium text-muted">Chargement...</span>
                </div>
            ) : filteredPrayers.length === 0 ? (
                <div className="text-center py-5 rounded-4 shadow-sm p-4 prayer-feed-card">
                    <p className="text-danger m-0 fs-7">Aucune intention de prière dans le fil d'actualité. ou rassurrez-vous d'être connecté sur internet.</p>
                </div>
            ) : (
                <div className="prayers-feed-list d-flex flex-column gap-3">
                    {filteredPrayers.map((prayer) => {
                        const targetId = prayer.id || prayer.prayer_id;
                        const currentSupporters = prayer.supporter_names ? prayer.supporter_names.split(', ') : [];
                        const isPersonallyLiked = currentUserPseudo && currentSupporters.includes(currentUserPseudo);
                        
                        const currentComments = commentsMap[targetId] || [];
                        
                        // Détermination dynamique et robuste du total des commentaires
                        const totalCommentsCount = commentsMap[targetId] !== undefined
                            ? commentsMap[targetId].length
                            : (prayer.comments_count || prayer.commentsCount || 0);

                        return (
                            <div key={targetId} className="prayer-feed-card p-3 rounded-4 shadow-sm" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="prayer-card-avatar rounded-circle d-flex align-items-center justify-content-center fw-bold fs-7 text-primary">
                                            {(prayer.username || "M").charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="m-0 fs-7 fw-bold text-dark-custom">{prayer.username || "Membre"}</h4>
                                            <span className="m-0 text-muted fs-9">
                                                {prayer.created_at ? new Date(prayer.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit' }) : "À l'instant"}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="badge bg-light text-muted border-0 rounded-pill px-2.5 py-1 fs-9">Intention</span>
                                </div>

                                <p className="prayer-card-text fs-7 lh-base m-0" style={{ wordBreak: 'break-word' }}>
                                    {prayer.description}
                                </p>

                                <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle">
                                    <button 
                                        type="button"
                                        onClick={() => handleToggleSupport(targetId)}
                                        className="btn btn-action-feed d-flex align-items-center gap-1.5 fs-8 fw-semibold bg-transparent border-0 p-0"
                                        style={{ color: isPersonallyLiked ? '#dc3545' : 'inherit', transition: 'color 0.2s ease' }}
                                    >
                                        <Heart 
                                            size={18} 
                                            style={{ fill: isPersonallyLiked ? '#dc3545' : 'none', color: isPersonallyLiked ? '#dc3545' : 'currentColor' }} 
                                        /> 
                                        <span>{prayer.supports_count || 0} Portés</span>
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => handleToggleCommentsSection(targetId)}
                                        className="btn btn-action-feed d-flex align-items-center gap-1.5 fs-8 fw-semibold bg-transparent border-0 p-0"
                                        style={{ color: String(activeCommentPrayerId) === String(targetId) ? '#0d6efd' : '#6c757d' }}
                                    >
                                        <MessageCircle size={18} /> 
                                        <span>{totalCommentsCount} Commentaire{totalCommentsCount > 1 ? 's' : ''}</span>
                                    </button>

                                    <button className="btn btn-action-feed d-flex align-items-center gap-1.5 fs-8 fw-semibold text-muted bg-transparent border-0 p-0">
                                        <Share2 size={16} />
                                    </button>
                                </div>

                                {renderLikeSentence(prayer)}

                                {/* ZONE DES COMMENTAIRES */}
                                {String(activeCommentPrayerId) === String(targetId) && (
                                    <div className="comment-section-wrapper border-top border-light-subtle pt-3 mt-1" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        
                                        {/* A. FORMULAIRE DE SAISIE */}
                                        <form 
                                            onSubmit={(e) => handlePostComment(e, targetId)}
                                            className="d-flex gap-2 align-items-center bg-white border rounded-pill px-3 py-1.5 shadow-sm"
                                        >
                                            <input 
                                                type="text"
                                                className="form-control border-0 p-0 fs-8 flex-grow-1 bg-transparent"
                                                placeholder="Écrire un encouragement..."
                                                value={newCommentTexts[targetId] || ''}
                                                onChange={(e) => handleCommentInputChange(targetId, e.target.value)}
                                                disabled={sendingCommentId === targetId}
                                                style={{ boxShadow: 'none', outline: 'none' }}
                                            />
                                            <button 
                                                type="submit"
                                                className="btn p-0 border-0 bg-transparent text-primary d-flex align-items-center justify-content-center"
                                                disabled={!(newCommentTexts[targetId] || '').trim() || sendingCommentId === targetId}
                                                style={{ color: '#0d6efd' }}
                                            >
                                                {sendingCommentId === targetId ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Send size={14} />
                                                )}
                                            </button>
                                        </form>

                                        {/* B. BLOC DE SCROLL STABLE ET VIRTUALISÉ VIA CSS */}
                                        <div 
                                            className="comments-scroll-list-container"
                                            style={{ 
                                                maxHeight: '180px', 
                                                overflowY: 'auto',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '8px',
                                                paddingRight: '6px',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            {loadingCommentsId === targetId ? (
                                                <div className="d-flex align-items-center justify-content-center py-2 text-muted gap-2">
                                                    <Loader2 size={14} className="animate-spin text-primary" />
                                                    <span style={{ fontSize: '11px' }}>Chargement des messages...</span>
                                                </div>
                                            ) : currentComments.length === 0 ? (
                                                <div className="text-center py-2 text-muted rounded-3 bg-light" style={{ fontStyle: 'italic', fontSize: '11px' }}>
                                                    Aucun commentaire pour le moment. Soyez le premier à écrire !
                                                </div>
                                            ) : (
                                                currentComments.map((comment) => (
                                                    <div 
                                                        key={comment.id} 
                                                        className="p-2 rounded-3 bg-light border border-light-subtle d-flex flex-column gap-0.5"
                                                        style={{ flexShrink: 0 }}
                                                    >
                                                        <div className="d-flex align-items-center justify-content-between">
                                                            <span className="fs-8 fw-bold text-dark-custom">
                                                                {comment.username || comment.name || `Utilisateur #${comment.user_id || ''}`}
                                                            </span>
                                                            <span className="fs-9 text-muted d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                                                                <Clock size={10} /> {formatCommentDate(comment.created_at || comment.updated_at)}
                                                            </span>
                                                        </div>
                                                        <p className="m-0 text-secondary" style={{ fontSize: '12px', wordBreak: 'break-word', whiteSpace: 'pre-line', lineHeight: '1.3' }}>
                                                            {comment.comment_text || comment.description || comment.text || comment.content}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                    </div>
                                )}

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default FeedScreen;