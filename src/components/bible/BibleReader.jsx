import React, { useState, useEffect } from 'react';
import { authApi } from '../../api/authApi';
import './BibleReader.css'; 
import { ArrowLeft } from 'lucide-react';

// Importation sécurisée de ton image locale
import bibleBg from '../../assets/bibleBg.jpg'; 

const BibleReader = ({onBack}) => {
    const [books, setBooks] = useState([]);
    const [filteredBooks, setFilteredBooks] = useState([]);
    const [chapters, setChapters] = useState(null); 
    const [currentChapterContent, setCurrentChapterContent] = useState(null); 

    const [selectedBookId, setSelectedBookId] = useState(null);
    const [selectedChapterId, setSelectedChapterId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

    // États de recherche
    const [bookSearchQuery, setBookSearchQuery] = useState('');
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState([]);
    const [searchingVerses, setSearchingVerses] = useState(false);
    
    // État pour gérer la navigation depuis la recherche plein écran
    const [cameFromSearch, setCameFromSearch] = useState(false);

    // État pour synchroniser le mode sombre/clair
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme') || 'light');

    const token = localStorage.getItem('token');

    // Écouteur actif des changements de thème dans le localStorage
    useEffect(() => {
        const checkTheme = () => {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme && savedTheme !== currentTheme) {
                setCurrentTheme(savedTheme);
            }
        };
        const interval = setInterval(checkTheme, 400);
        return () => clearInterval(interval);
    }, [currentTheme]);

    // Récupération initiale des livres
    useEffect(() => {
        const fetchBooks = async () => {
            if (!token) return;
            try {
                setLoading(true);
                const response = await authApi.getBibleBooks(token);
                if (response.success) {
                    setBooks(response.data);
                    setFilteredBooks(response.data);
                }
            } catch (error) {
                console.error("Erreur chargement livres:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, [token]);

    // Filtrage local des livres dans la sidebar
    useEffect(() => {
        const filtered = books.filter(book => 
            book.name.toLowerCase().includes(bookSearchQuery.toLowerCase())
        );
        setFilteredBooks(filtered);
    }, [bookSearchQuery, books]);

    // Recherche globale de versets (Débounce de 400ms)
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (globalSearchQuery.trim().length < 3) {
                setGlobalSearchResults([]);
                return;
            }
            try {
                setSearchingVerses(true);
                const response = await authApi.searchBibleVerses(token, globalSearchQuery);
                if (response.success) {
                    setGlobalSearchResults(response.data); 
                }
            } catch (error) {
                console.error("Erreur recherche versets:", error);
            } finally {
                setSearchingVerses(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [globalSearchQuery, token]);

    const handleBookClick = async (bookId) => {
        setGlobalSearchQuery('');
        setGlobalSearchResults([]);
        setCameFromSearch(false);

        setSelectedBookId(bookId);
        setSelectedChapterId(null);
        setCurrentChapterContent(null);
        setIsSidebarOpen(false); 
        
        try {
            setLoading(true);
            const response = await authApi.getBibleChaptersCount(token, bookId);
            if (response.success) {
                setChapters(response.data);
            }
        } catch (error) {
            console.error("Erreur chapitres:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChapterClick = async (chapterId, targetBookId = selectedBookId) => {
        setSelectedChapterId(chapterId);
        try {
            setLoading(true);
            const response = await authApi.getBibleVerses(token, targetBookId, chapterId);
            if (response.success) {
                setCurrentChapterContent(response.data);
            }
        } catch (error) {
            console.error("Erreur versets:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchResultClick = async (result) => {
        setCameFromSearch(true); 
        setSelectedBookId(result.bookId);
        
        try {
            setLoading(true);
            const chaptersResponse = await authApi.getBibleChaptersCount(token, result.bookId);
            if (chaptersResponse.success) {
                setChapters(chaptersResponse.data);
            }
            await handleChapterClick(result.chapter, result.bookId);
        } catch (error) {
            console.error("Erreur redirection verset:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToChapters = () => {
        setSelectedChapterId(null);
        setCurrentChapterContent(null);
    };

    const handleBackToSearchResults = () => {
        setCameFromSearch(false);
        setSelectedBookId(null);
        setSelectedChapterId(null);
        setCurrentChapterContent(null);
    };

    // Fonction utilitaire pour mettre en surbrillance orange le mot recherché
    const highlightText = (text, search) => {
        if (!search.trim()) return text;
        
        const regex = new RegExp(`(${search.trim()})`, 'gi');
        const parts = text.split(regex);
        
        return parts.map((part, index) => 
            regex.test(part) ? (
                <mark key={index} className="highlight-orange">{part}</mark>
            ) : (
                part
            )
        );
    };

    const showFullScreenSearch = globalSearchQuery.trim().length >= 3 && !cameFromSearch;

    return (
        <div className={`bible-container theme-${currentTheme === 'dark' ? 'dark' : 'light'}`}>
            
            {/* Volet mobile overlay */}
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
            )}

            {/* BARRE LATÉRALE */}
            <div className={`bible-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <button className="btn-back-unique border-0 d-flex align-items-center justify-content-center shadow-sm" onClick={onBack}>
                <ArrowLeft size={20} />
            </button>
                <div className="p-3 border-bottom">
                    <h5 className="m-0 fw-bold mb-2">La Sainte Bible <br /> <span className='fs-6'>(Louis Second 1910)</span> </h5>
                    <input 
                        type="text" 
                        className="form-control form-control-sm border shadow-none" 
                        placeholder="🔍 Chercher un livre..." 
                        value={bookSearchQuery}
                        onChange={(e) => setBookSearchQuery(e.target.value)}
                    />
                </div>
                
                <div className="overflow-auto flex-1 p-2">
                    {loading && books.length === 0 ? (
                        <div className="text-center p-3 text-muted">Chargement...</div>
                    ) : (
                        <div className="list-group list-group-flush">
                            {filteredBooks.map((book) => (
                                <button
                                    key={book.id}
                                    onClick={() => handleBookClick(book.id)}
                                    className={`list-group-item list-group-item-action ${
                                        selectedBookId === book.id && !showFullScreenSearch ? 'active' : ''
                                    }`}
                                >
                                    {book.name}
                                </button>
                            ))}
                            {filteredBooks.length === 0 && (
                                <div className="text-center text-muted p-3 small">Aucun livre trouvé</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ZONE PRINCIPALE DE LECTURE */}
            <div className="bible-main">
                
                {/* TOP BAR */}
                <div className="bible-top-bar d-flex align-items-center justify-content-between px-3 shadow-sm py-2">
                    <div className="d-flex align-items-center flex-1 me-2 text-truncate">
                        <button 
                            className="btn hamburger-btn p-0 border-0 me-3 flex-shrink-0" 
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            aria-label="Toggle navigation"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                                <path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
                            </svg>
                        </button>
                        
                        <div className="text-muted fw-medium text-truncate small">
                            {showFullScreenSearch 
                                ? "Résultats de recherche" 
                                : (currentChapterContent 
                                    ? `${currentChapterContent.bookName} - Ch. ${currentChapterContent.chapter}` 
                                    : (chapters ? chapters.bookName : "Espace Lecture"))}
                        </div>
                    </div>

                    {/* CHAMP DE FILTRAGE GLOBAL */}
                    <div className="global-search-container">
                        <div className="input-group input-group-sm rounded">
                            <input 
                                type="text" 
                                className="form-control border-0 shadow-none" 
                                placeholder="🔍 Chercher un verset..." 
                                value={globalSearchQuery}
                                onChange={(e) => {
                                    setGlobalSearchQuery(e.target.value);
                                    if(cameFromSearch) setCameFromSearch(false); 
                                }}
                            />
                            {(searchingVerses || (globalSearchQuery.trim().length >= 3 && !cameFromSearch)) && (
                                <button 
                                    className="btn btn-link text-secondary p-0 px-2 text-decoration-none sm"
                                    onClick={() => { setGlobalSearchQuery(''); setGlobalSearchResults([]); }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* CONTENU AXIAL */}
                <div className="overflow-auto p-3 p-md-4 flex-1">
                    <div className="bible-content-wrapper">
                        
                        {loading && globalSearchResults.length === 0 && (
                            <div className="text-center my-4 py-4">
                                <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                                <span className="text-muted">Chargement...</span>
                            </div>
                        )}

                        {/* VUE DE FILTRAGE : PLEIN ÉCRAN */}
                        {showFullScreenSearch ? (
                            <div className="full-screen-search-results animate-fade-in mb-5">
                                <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                                    <h4 className="fw-bold m-0 fs-5">Recherche pour : "{globalSearchQuery}"</h4>
                                    <span className="badge bg-primary rounded-pill">{globalSearchResults.length} trouvé(s)</span>
                                </div>

                                {searchingVerses ? (
                                    <div className="text-center py-4 text-muted">Recherche dans les Écritures...</div>
                                ) : globalSearchResults.length > 0 ? (
                                    <div className="list-group list-group-flush">
                                        {globalSearchResults.map((result) => (
                                            <button
                                                key={result.id}
                                                onClick={() => handleSearchResultClick(result)}
                                                className="list-group-item list-group-item-action p-3 text-start mb-2 rounded-3 card border-0 search-result-item"
                                            >
                                                <div className="fw-bold text-primary mb-1 small">{result.bookName} {result.chapter}:{result.verse}</div>
                                                <p className="m-0 small">
                                                    {highlightText(result.text, globalSearchQuery)}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-5 text-muted small">Aucun verset ne correspond à votre recherche.</div>
                                )}
                            </div>
                        ) : (
                            /* CYCLE DE VUES STANDARDS */
                            <>
                                {/* ÉTAT 1 : Écran de bienvenue avec image locale */}
                                {!selectedBookId && (
                                    <div className="bible-welcome-hero text-center animate-fade-in">
                                        <img src={bibleBg} alt="Bible Background" className="hero-bg-image" />
                                        <h2 className="mb-3">Que la Parole habite en vous</h2>
                                        <p className="fs-6 opacity-95 max-width-600 mx-auto mb-0">
                                            Ouvrez le menu pour choisir un livre ou lancez une recherche de verset en haut à droite.
                                        </p>
                                    </div>
                                )}

                                {/* ÉTAT 2 : Grille des chapitres */}
                                {selectedBookId && !selectedChapterId && chapters && (
                                    <div className="animate-fade-in">
                                        <h3 className="fw-bold mb-1">{chapters.bookName}</h3>
                                        <p className="text-muted mb-4 small">Sélectionnez un chapitre</p>
                                        
                                        <div className="chapters-grid gap-2">
                                            {Array.from({ length: chapters.totalChapters }, (_, i) => i + 1).map((num) => (
                                                <button 
                                                    key={num}
                                                    onClick={() => handleChapterClick(num)}
                                                    className="btn btn-outline-secondary py-3 fw-semibold rounded-3"
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ÉTAT 3 : Surface de lecture des versets */}
                                {selectedChapterId && currentChapterContent && (
                                    <div className="animate-fade-in mb-5">
                                        {cameFromSearch ? (
                                            <button 
                                                onClick={handleBackToSearchResults} 
                                                className="btn btn-sm btn-primary mb-4 px-3 shadow-sm"
                                            >
                                                ← Retour aux résultats
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={handleBackToChapters} 
                                                className="btn btn-sm btn-light border text-secondary mb-4 px-3"
                                            >
                                                ← Tous les chapitres
                                            </button>
                                        )}
                                        
                                        <div className="border-bottom pb-3 mb-4">
                                            <h2 className="fw-bold m-0">{currentChapterContent.bookName}</h2>
                                            <h4 className="text-muted fw-normal m-0 fs-5">Chapitre {currentChapterContent.chapter}</h4>
                                        </div>

                                        <div className="bible-text-area card p-3 p-md-4 border-0 rounded-3">
                                            {currentChapterContent.verses.map((v) => (
                                                <span key={v.id} className="verse-span">
                                                    <span className="verse-number">{v.verse}</span>
                                                    {v.text}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BibleReader;