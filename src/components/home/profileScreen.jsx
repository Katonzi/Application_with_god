import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { ArrowLeft, Heart, MessageCircle, Share2, MoreVertical, Edit2, Trash2, X, Mail, Calendar, Award, Camera, ChevronDown, ChevronUp, Clock, Loader2, Send } from 'lucide-react';

function ProfileScreen({ onBack }) {
    const { user, token } = useContext(AuthContext);
    
    const [userPrayers, setUserPrayers] = useState([]);
    const [prayersCount, setPrayersCount] = useState(0);
    const [loadingStats, setLoadingStats] = useState(true);

    const [activeMenuId, setActiveMenuId] = useState(null);
    const [prayerToDelete, setPrayerToDelete] = useState(null);
    
    // État pour savoir quelle carte a sa liste déroulée
    const [expandedLikesPrayerId, setExpandedLikesPrayerId] = useState(null);

    // ÉTATS DÉDIÉS AUX COMMENTAIRES
    const [activeCommentPrayerId, setActiveCommentPrayerId] = useState(null);
    const [commentsMap, setCommentsMap] = useState({});
    const [loadingCommentsId, setLoadingCommentsId] = useState(null);
    const [newCommentTexts, setNewCommentTexts] = useState({});
    const [sendingCommentId, setSendingCommentId] = useState(null);

    const userName = user?.name || '';
    const userEmail = user?.email || '';
    const userRole = "Membre de la communauté";
    const created_at = user?.created;

    const currentUserPseudo = user?.username || user?.name || '';
    const supportCount = 48; 
    const bio = "Marcher chaque jour par la foi, guidé par l'amour et le courage.";

    useEffect(() => {
        const handleOutsideClick = () => setActiveMenuId(null);
        if (activeMenuId !== null) {
            window.addEventListener('click', handleOutsideClick);
        }
        return () => window.removeEventListener('click', handleOutsideClick);
    }, [activeMenuId]);

    // CHARGEMENT INITIAL + SYNCHRONISATION DES COMMENTAIRES EN ARRIÈRE-PLAN
    useEffect(() => {
        const loadProfileData = async () => {
            try {
                const activeToken = localStorage.getItem('token') || token;
                if (!activeToken) return;
                
                const response = await authApi.getAllPrayers(activeToken);
                const allPrayers = response.data?.data || response.data || [];
                
                const myPrayers = allPrayers.filter(p => p.username === currentUserPseudo);
                
                setUserPrayers(myPrayers);
                setPrayersCount(myPrayers.length);

                // SYNCHRONISATION EN ARRIÈRE-PLAN DES COMPTEURS AU RECHARGEMENT
                if (myPrayers.length > 0) {
                    myPrayers.forEach(async (prayer) => {
                        const prayerId = prayer.id || prayer.prayer_id;
                        try {
                            const commRes = await authApi.getComments(prayerId, activeToken);
                            const commentsArray = commRes.data || [];
                            
                            setCommentsMap(prev => ({ ...prev, [prayerId]: commentsArray }));
                            
                            setUserPrayers(prevPrayers => 
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
                            console.error(`Erreur synchro compteur profil prière ${prayerId}:`, err);
                        }
                    });
                }
            } catch (error) {
                console.error("Erreur lors du chargement des données du profil :", error);
            } finally {
                setLoadingStats(false);
            }
        };

        loadProfileData();
    }, [token, currentUserPseudo]);

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

    const handleToggleSupport = async (prayerId) => {
        try {
            const activeToken = localStorage.getItem('token') || token;
            if (!activeToken || !currentUserPseudo) return;

            const response = await authApi.toggleSupport(prayerId, activeToken);

            if (response.success) {
                setUserPrayers(prevPrayers => 
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

            setUserPrayers(prevPrayers => 
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

                setUserPrayers(prevPrayers => 
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

    const handleEditAction = (prayer, e) => {
        e.stopPropagation();
        setActiveMenuId(null);
        alert(`Modification de : "${prayer.description.substring(0, 20)}..."`);
    };

    const triggerDeleteModal = (prayerId, e) => {
        e.stopPropagation();
        setActiveMenuId(null);
        setPrayerToDelete(prayerId);
    };

    const confirmDeleteAction = async () => {
        try {
            setUserPrayers(prev => prev.filter(p => (p.id || p.prayer_id) !== prayerToDelete));
            setPrayersCount(prev => Math.max(0, prev - 1));
            setPrayerToDelete(null);
        } catch (error) {
            console.error("Erreur suppression :", error);
        }
    };

    const toggleMenu = (prayerId, e) => {
        e.stopPropagation();
        setActiveMenuId(activeMenuId === prayerId ? null : prayerId);
    };

    const toggleExpandLikes = (prayerId, e) => {
        e.stopPropagation();
        setExpandedLikesPrayerId(expandedLikesPrayerId === prayerId ? null : prayerId);
    };

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
        const targetId = prayer.id || prayer.prayer_id;

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
                            onClick={(e) => toggleExpandLikes(targetId, e)}
                            className="btn p-0 border-0 bg-transparent fs-9 text-primary-god fw-bold d-inline-flex align-items-center gap-0.5 ms-1"
                            style={{ textDecoration: 'underline', color: '#0d6efd', fontStyle: 'normal' }}
                        >
                            et {remainingCount} autre{remainingCount > 1 ? 's' : ''}
                            {expandedLikesPrayerId === targetId ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    )}
                </div>

                {expandedLikesPrayerId === targetId && (
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

    return (
        <div className="profile-screen-container animated-fadeIn px-2 pb-5">
            
            {/* BARRE DE NAVIGATION */}
            <div className="d-flex align-items-center justify-content-between mb-4 pt-3">
                <button className="btn-back-unique border-0 d-flex align-items-center justify-content-center shadow-sm" onClick={onBack}>
                    <ArrowLeft size={20} />
                </button>
                <span className="profile-tag-top">Espace Personnel</span>
                <div className="profile-nav-spacer"></div>
            </div>

            {/* EN-TÊTE PROFIL */}
            <div className="profile-unique-card text-center mb-4 py-3">
                <div className="profile-avatar-wrapper mx-auto mb-3">
                    <div className="profile-avatar-circle-unique shadow">
                        <div className="profile-avatar-text-unique">
                            {userName.charAt(0).toUpperCase()}
                        </div> 
                    </div>
                    <button className="btn-camera-float shadow" onClick={() => alert("Prêt pour Multer.")}>
                        <Camera size={14} color="green" />
                    </button>
                </div>
                <h2 className="profile-name-unique">{userName}</h2>
                <div className="profile-badge-status mx-auto mb-3">{userRole}</div>
                <p className="profile-bio-text px-3 mt-2">"{bio}"</p>
            </div>

            {/* BLOCS STATS */}
            <div className="row g-3 mb-4">
                <div className="col-6">
                    <div className="stat-box-unique p-3 text-center">
                        <Award size={24} className="text-warning mb-2 mx-auto" />
                        <span className="stat-number-unique">{loadingStats ? "..." : prayersCount}</span>
                        <span className="stat-label-unique">Prières partagées</span>
                    </div>
                </div>
                <div className="col-6">
                    <div className="stat-box-unique p-3 text-center">
                        <Heart size={24} className="text-danger mb-2 mx-auto" />
                        <span className="stat-number-unique">{supportCount}</span>
                        <span className="stat-label-unique">Soutiens accordés</span>
                    </div>
                </div>
            </div>

            {/* COORDONNÉES */}
            <div className="info-card-unique p-3 mb-4">
                <div className="d-flex align-items-center mb-3 pb-3 border-bottom-unique">
                    <Mail size={18} className="text-muted me-3" />
                    <div>
                        <span className="info-title-unique">Adresse de contact</span>
                        <span className="info-value-unique">{userEmail}</span>
                    </div>
                </div>
                <div className="d-flex align-items-center">
                    <Calendar size={18} className="text-muted me-3" />
                    <div>
                        <span className="info-title-unique">Engagement au chemin</span>
                        <span className="info-value-unique">Membre depuis le {created_at ? new Date(created_at).toLocaleDateString('fr-FR', { month: 'long', day:'numeric', year:'numeric' }) : "À l'instant"}</span>
                    </div>
                </div>
            </div>

            {/* === HISTORIQUE DES INTENTIONS === */}
            <div className="profile-history-section mb-5 d-flex flex-column">
                <h3 className="text-dark-custom fs-6 fw-bold mb-3 px-1">
                    Historique de prières partagées
                </h3>

                {loadingStats ? (
                    <div className="text-center py-4">
                        <span className="fs-7 text-muted">Chargement de vos publications...</span>
                    </div>
                ) : userPrayers.length === 0 ? (
                    <div className="text-center py-5 rounded-4 shadow-sm p-4 prayer-feed-card">
                        <p className="text-danger m-0 fs-7">Aucune intention de prière partagée pour le moment.</p>
                    </div>
                ) : (
                    <div className="prayers-feed-list d-flex flex-column gap-3">
                        {userPrayers.map((prayer) => {
                            const targetId = prayer.id || prayer.prayer_id;
                            const currentSupporters = prayer.supporter_names ? prayer.supporter_names.split(', ') : [];
                            const isPersonallyLiked = currentUserPseudo && currentSupporters.includes(currentUserPseudo);

                            const currentComments = commentsMap[targetId] || [];

                            // DÉTECTION : L'UTILISATEUR CONNECTÉ A-T-IL DÉJÀ COMMENTÉ CETTE PRIÈRE ?
                            const hasPersonallyCommented = currentUserPseudo && currentComments.some(comment => {
                                const commentAuthor = comment.username || comment.name || '';
                                return commentAuthor === currentUserPseudo;
                            });

                            const totalCommentsCount = commentsMap[targetId] !== undefined
                                ? commentsMap[targetId].length
                                : (prayer.comments_count || prayer.commentsCount || 0);

                            return (
                                <div key={targetId} className="prayer-feed-card p-3 rounded-4 shadow-sm position-relative" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    
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
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-light text-muted border-0 rounded-pill px-2.5 py-1 fs-9">Intention</span>
                                            <button type="button" className="btn p-0 border-0 text-muted" onClick={(e) => toggleMenu(targetId, e)}>
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Menu contextuel */}
                                    {String(activeMenuId) === String(targetId) && (
                                        <div className="shadow-sm border border-light position-absolute rounded-3 py-1 bg-white" style={{ zIndex: 15, right: '15px', top: '45px', width: '130px' }}>
                                            <button className="dropdown-item d-flex align-items-center gap-2 py-2 px-3 text-secondary fs-8 border-0 bg-transparent w-100" onClick={(e) => handleEditAction(prayer, e)}>
                                                <Edit2 size={13} /> Modifier
                                            </button>
                                            <button className="dropdown-item d-flex align-items-center gap-2 py-2 px-3 text-danger fs-8 border-0 bg-transparent w-100" onClick={(e) => triggerDeleteModal(targetId, e)}>
                                                <Trash2 size={13} /> Supprimer
                                            </button>
                                        </div>
                                    )}

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
                                        
                                        {/* BOUTON COMMENTAIRE DYNAMIQUE : DEVIENT BLEU SI L'UTILISATEUR A COMMENTÉ */}
                                        <button 
                                            type="button"
                                            onClick={() => handleToggleCommentsSection(targetId)}
                                            className="btn btn-action-feed d-flex align-items-center gap-1.5 fs-8 fw-semibold bg-transparent border-0 p-0"
                                            style={{ 
                                                color: hasPersonallyCommented ? '#0d6efd' : (String(activeCommentPrayerId) === String(targetId) ? '#0d6efd' : '#6c757d'),
                                                transition: 'color 0.2s ease'
                                            }}
                                        >
                                            <MessageCircle 
                                                size={18} 
                                                style={{ 
                                                    fill: hasPersonallyCommented ? 'rgba(13, 110, 253, 0.15)' : 'none'
                                                }}
                                            /> 
                                            <span>{totalCommentsCount} Commentaire{totalCommentsCount > 1 ? 's' : ''}</span>
                                        </button>

                                        <button className="btn btn-action-feed d-flex align-items-center gap-1.5 fs-8 fw-semibold text-muted bg-transparent border-0 p-0">
                                            <Share2 size={16} />
                                        </button>
                                    </div>

                                    {renderLikeSentence(prayer)}

                                    {/* ZONE DES COMMENTAIRES DÉROULANTE */}
                                    {String(activeCommentPrayerId) === String(targetId) && (
                                        <div className="comment-section-wrapper border-top border-light-subtle pt-3 mt-1" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            
                                            {/* Formulaire de saisie d'un encouragement */}
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

                                            {/* Bloc de scroll de la liste de messages */}
                                            <div 
                                                className="comments-scroll-container"
                                                style={{ 
                                                    maxHeight: '200px', 
                                                    overflowY: 'auto',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px',
                                                    paddingRight: '2px',
                                                    WebkitOverflowScrolling: 'touch'
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

            {/* MODALE DE CONFIRMATION */}
            {prayerToDelete !== null && (
                <div className="custom-modal-overlay d-flex align-items-center justify-content-center px-3">
                    <div className="custom-modal-card bg-white p-4 shadow rounded-4 w-100 profile-modal-max">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h5 className="m-0 fs-6 fw-bold text-dark">Confirmer la suppression</h5>
                            <button className="btn border-0 p-0 text-muted" onClick={() => setPrayerToDelete(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-muted fs-7 mb-4">Cette action est irréversible. Êtes-vous sûr de vouloir retirer cette intention ?</p>
                        <div className="d-flex align-items-center justify-content-end gap-2">
                            <button type="button" className="btn btn-light rounded-pill px-4 fs-8 border-0 fw-medium" onClick={() => setPrayerToDelete(null)}>Annuler</button>
                            <button type="button" className="btn btn-danger rounded-pill px-4 fs-8 fw-medium shadow-sm" onClick={confirmDeleteAction}>Supprimer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProfileScreen;