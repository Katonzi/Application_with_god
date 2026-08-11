
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { authApi } from '../../api/authApi';
import apiClient from '../../api/client';
import './ChatWindow.css';

// URL de l'API REST
const API_URL =
    import.meta.env.VITE_API_WEBSOCKET ||
    "http://localhost:5000";

// URL dédiée à Socket.IO
// En production : https://backend-with-god.onrender.com
// En local : http://localhost:5000
const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (API_URL.includes('/api/with-god')
        ? API_URL.replace(/\/api\/with-god\/?$/, '')
        : API_URL);

const decodeJwt = (token) => {
    try {
        if (!token) return null;

        const base64Url = token.split('.')[1];

        if (!base64Url) return null;

        const base64 = base64Url
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const jsonPayload = decodeURIComponent(
            window.atob(base64)
                .split('')
                .map(
                    (c) =>
                        '%' +
                        ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                )
                .join('')
        );

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Erreur lors du décodage du token :", error);
        return null;
    }
};

const ChatWindow = () => {
    const [recentChats, setRecentChats] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchError, setSearchError] = useState('');
    const [loadingSearch, setLoadingSearch] = useState(false);

    const [activeContact, setActiveContact] = useState(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [typedMessage, setTypedMessage] = useState('');

    const [onlineUsers, setOnlineUsers] = useState([]);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const typingTimeoutRef = useRef(null);

    const [globalMessages, setGlobalMessages] = useState([]);
    const [loadingGlobal, setLoadingGlobal] = useState(false);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    const token = localStorage.getItem('token');

    const currentUser = useMemo(
        () => decodeJwt(token),
        [token]
    );

    const myId = currentUser?.id || currentUser?.userId;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth'
        });
    };

    useEffect(() => {
        if (isChatOpen || !activeContact) {
            scrollToBottom();
        }
    }, [
        chatHistory,
        globalMessages,
        isChatOpen,
        activeContact,
        isOtherTyping
    ]);

    // =========================================================
    // CHARGEMENT DES DISCUSSIONS RÉCENTES
    // =========================================================

    useEffect(() => {
        if (myId) {
            const storedChats = localStorage.getItem(
                `chats_${myId}`
            );

            if (storedChats) {
                try {
                    setRecentChats(JSON.parse(storedChats));
                } catch (error) {
                    console.error(
                        "Erreur lors de la lecture des discussions locales :",
                        error
                    );
                }
            }
        }
    }, [myId]);

    // =========================================================
    // CHARGEMENT DE LA BOÎTE GLOBALE
    // =========================================================

    useEffect(() => {
        const fetchGlobalInbox = async () => {
            if (!token) return;

            setLoadingGlobal(true);

            try {
                const res = await authApi.getAllUserMessages(token);

                if (res.success) {
                    setGlobalMessages(res.data || []);
                }
            } catch (error) {
                console.error(
                    "Erreur lors du chargement de la boîte globale :",
                    error
                );
            } finally {
                setLoadingGlobal(false);
            }
        };

        if (!activeContact) {
            fetchGlobalInbox();
        }
    }, [activeContact, token]);

    // =========================================================
    // INITIALISATION UNIQUE DE SOCKET.IO
    // =========================================================

    useEffect(() => {
        if (!myId) {
            return;
        }

        console.log(
            "🔌 Initialisation Socket.IO vers :",
            SOCKET_URL
        );

        /*
         * IMPORTANT :
         *
         * On utilise directement WebSocket.
         *
         * Socket.IO utilise normalement :
         *   1. polling
         *   2. puis upgrade vers websocket
         *
         * Ici, on évite cette phase de polling afin de ne pas
         * avoir de problème de session/sid lors du passage
         * vers WebSocket sur Render.
         */
        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            upgrade: false,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        socketRef.current = socket;

        // -----------------------------------------------------
        // CONNEXION
        // -----------------------------------------------------

        const handleConnect = () => {
            console.log(
                `✅ Socket.IO connecté : ${socket.id}`
            );

            /*
             * IMPORTANT :
             * On rejoint la boîte globale seulement APRÈS
             * que Socket.IO soit réellement connecté.
             */
            socket.emit('join_global_inbox', {
                userId: myId
            });
        };

        // -----------------------------------------------------
        // ERREUR DE CONNEXION
        // -----------------------------------------------------

        const handleConnectError = (error) => {
            console.error(
                "❌ Erreur de connexion Socket.IO :",
                error.message
            );

            console.error(
                "🔎 URL Socket utilisée :",
                SOCKET_URL
            );
        };

        // -----------------------------------------------------
        // DÉCONNEXION
        // -----------------------------------------------------

        const handleDisconnect = (reason) => {
            console.warn(
                "⚠️ Socket.IO déconnecté :",
                reason
            );
        };

        // -----------------------------------------------------
        // RECONNEXION
        // -----------------------------------------------------

        const handleReconnectAttempt = (attempt) => {
            console.log(
                `🔄 Tentative de reconnexion Socket.IO #${attempt}`
            );
        };

        // -----------------------------------------------------
        // RÉCEPTION D'UN MESSAGE
        // -----------------------------------------------------

        const handleReceiveMessage = (newMessage) => {
            const currentConvId =
                newMessage.conversation_id ||
                newMessage.conversationId;

            const senderId =
                newMessage.sender_id ||
                newMessage.senderId;

            // -------------------------------------------------
            // MESSAGE DANS LA CONVERSATION ACTIVE
            // -------------------------------------------------

            if (
                activeContact &&
                Number(currentConvId) === Number(conversationId)
            ) {
                setChatHistory((prev) => {
                    if (
                        prev.some(
                            (msg) =>
                                Number(msg.id) ===
                                Number(newMessage.id)
                        )
                    ) {
                        return prev;
                    }

                    return [
                        ...prev,
                        {
                            ...newMessage,
                            status: 'read'
                        }
                    ];
                });

                if (socket.connected) {
                    socket.emit('message_read', {
                        messageId: newMessage.id,
                        conversationId: conversationId,
                        readerId: myId
                    });
                }
            } else {
                setChatHistory((prev) => {
                    if (
                        prev.some(
                            (msg) =>
                                Number(msg.id) ===
                                Number(newMessage.id)
                        )
                    ) {
                        return prev;
                    }

                    return [...prev, newMessage];
                });
            }

            // -------------------------------------------------
            // MISE À JOUR DU FLUX GLOBAL
            // -------------------------------------------------

            setGlobalMessages((prev) => {
                if (
                    prev.some(
                        (msg) =>
                            Number(msg.id) ===
                            Number(newMessage.id)
                    )
                ) {
                    return prev;
                }

                return [...prev, newMessage];
            });

            // -------------------------------------------------
            // MISE À JOUR DES DISCUSSIONS RÉCENTES
            // -------------------------------------------------

            setRecentChats((prev) => {
                let contactToMove = prev.find(
                    (c) =>
                        Number(c.id) === Number(senderId)
                );

                if (
                    !contactToMove &&
                    activeContact &&
                    Number(activeContact.id) ===
                        Number(senderId)
                ) {
                    contactToMove = activeContact;
                }

                if (!contactToMove) {
                    return prev;
                }

                const filtered = prev.filter(
                    (c) =>
                        Number(c.id) !==
                        Number(contactToMove.id)
                );

                const updated = [
                    contactToMove,
                    ...filtered
                ];

                if (myId) {
                    localStorage.setItem(
                        `chats_${myId}`,
                        JSON.stringify(updated)
                    );
                }

                return updated;
            });
        };

        // -----------------------------------------------------
        // MESSAGE MARQUÉ COMME LU
        // -----------------------------------------------------

        const handleMessagesMarkedRead = ({
            conversationId: msgConvId,
            readerId
        }) => {
            if (
                activeContact &&
                Number(msgConvId) === Number(conversationId) &&
                Number(readerId) !== Number(myId)
            ) {
                setChatHistory((prev) =>
                    prev.map((msg) =>
                        msg.status !== 'read' &&
                        Number(
                            msg.sender_id ||
                            msg.senderId
                        ) === Number(myId)
                            ? {
                                  ...msg,
                                  status: 'read'
                              }
                            : msg
                    )
                );
            }
        };

        // -----------------------------------------------------
        // UTILISATEUR EN TRAIN D'ÉCRIRE
        // -----------------------------------------------------

        const handleUserTyping = ({
            conversationId: msgConvId,
            userId
        }) => {
            if (
                activeContact &&
                Number(msgConvId) === Number(conversationId) &&
                Number(userId) !== Number(myId)
            ) {
                setIsOtherTyping(true);
            }
        };

        // -----------------------------------------------------
        // UTILISATEUR ARRÊTE D'ÉCRIRE
        // -----------------------------------------------------

        const handleUserStopTyping = ({
            conversationId: msgConvId,
            userId
        }) => {
            if (
                activeContact &&
                Number(msgConvId) === Number(conversationId) &&
                Number(userId) !== Number(myId)
            ) {
                setIsOtherTyping(false);
            }
        };

        // -----------------------------------------------------
        // UTILISATEURS EN LIGNE
        // -----------------------------------------------------

        const handleOnlineUsers = (usersList) => {
            const ids = Array.isArray(usersList)
                ? usersList.map((u) =>
                      typeof u === 'object'
                          ? Number(
                                u.userId || u.id
                            )
                          : Number(u)
                  )
                : [];

            setOnlineUsers(ids);
        };

        // -----------------------------------------------------
        // CHANGEMENT DE STATUT UTILISATEUR
        // -----------------------------------------------------

        const handleUserStatusChange = ({
            userId,
            status
        }) => {
            setOnlineUsers((prev) => {
                const targetId = Number(userId);

                if (status === 'online') {
                    return prev.includes(targetId)
                        ? prev
                        : [...prev, targetId];
                }

                return prev.filter(
                    (u) => u !== targetId
                );
            });
        };

        // =====================================================
        // ENREGISTREMENT DES EVENTS
        // =====================================================

        socket.on('connect', handleConnect);

        socket.on(
            'connect_error',
            handleConnectError
        );

        socket.io.on(
            'reconnect_attempt',
            handleReconnectAttempt
        );

        socket.on(
            'disconnect',
            handleDisconnect
        );

        socket.on(
            'receive_message',
            handleReceiveMessage
        );

        socket.on(
            'messages_read_update',
            handleMessagesMarkedRead
        );

        socket.on(
            'user_typing',
            handleUserTyping
        );

        socket.on(
            'user_stop_typing',
            handleUserStopTyping
        );

        socket.on(
            'online_users',
            handleOnlineUsers
        );

        socket.on(
            'user_status_change',
            handleUserStatusChange
        );

        // =====================================================
        // NETTOYAGE
        // =====================================================

        return () => {
            console.log(
                "🧹 Nettoyage de la connexion Socket.IO"
            );

            socket.off(
                'connect',
                handleConnect
            );

            socket.off(
                'connect_error',
                handleConnectError
            );

            socket.io.off(
                'reconnect_attempt',
                handleReconnectAttempt
            );

            socket.off(
                'disconnect',
                handleDisconnect
            );

            socket.off(
                'receive_message',
                handleReceiveMessage
            );

            socket.off(
                'messages_read_update',
                handleMessagesMarkedRead
            );

            socket.off(
                'user_typing',
                handleUserTyping
            );

            socket.off(
                'user_stop_typing',
                handleUserStopTyping
            );

            socket.off(
                'online_users',
                handleOnlineUsers
            );

            socket.off(
                'user_status_change',
                handleUserStatusChange
            );

            socket.disconnect();

            if (socketRef.current === socket) {
                socketRef.current = null;
            }
        };
    }, [myId]);

    // =========================================================
    // RECHERCHE UTILISATEUR
    // =========================================================

    const handleSearchUser = async (e) => {
        e.preventDefault();

        if (!searchQuery.trim()) return;

        setLoadingSearch(true);
        setSearchError('');

        try {
            const res =
                await authApi.searchUserByUsername(
                    token,
                    searchQuery.trim()
                );

            let finalData =
                res?.data ||
                res?.data?.data ||
                res ||
                [];

            if (
                Array.isArray(finalData) &&
                finalData.length > 0
            ) {
                const filteredUsers =
                    finalData.filter(
                        (user) =>
                            Number(user.id) !==
                            Number(myId)
                    );

                if (filteredUsers.length === 0) {
                    setSearchError(
                        "C'est votre compte."
                    );
                } else {
                    setSearchResults(
                        filteredUsers
                    );
                }
            } else {
                setSearchError(
                    "Aucun utilisateur trouvé."
                );
            }
        } catch (error) {
            console.error(
                "Erreur recherche utilisateur :",
                error
            );

            setSearchError(
                "Erreur lors de la recherche."
            );
        } finally {
            setLoadingSearch(false);
        }
    };

    // =========================================================
    // OUVERTURE D'UNE CONVERSATION
    // =========================================================

    const handleSelectContact = async (contact) => {
        if (
            conversationId &&
            socketRef.current?.connected
        ) {
            socketRef.current.emit(
                'leave_conversation',
                {
                    conversationId
                }
            );

            socketRef.current.emit(
                'stop_typing',
                {
                    conversationId,
                    userId: myId
                }
            );
        }

        setActiveContact(contact);
        setIsChatOpen(true);
        setLoadingHistory(true);
        setChatHistory([]);
        setSearchQuery('');
        setSearchResults([]);
        setIsOtherTyping(false);
        setTypedMessage('');

        if (textareaRef.current) {
            textareaRef.current.style.height =
                'auto';
        }

        setRecentChats((prev) => {
            const exists = prev.some(
                (c) =>
                    Number(c.id) ===
                    Number(contact.id)
            );

            const filtered = exists
                ? prev.filter(
                      (c) =>
                          Number(c.id) !==
                          Number(contact.id)
                  )
                : prev;

            const updated = [
                contact,
                ...filtered
            ];

            if (myId) {
                localStorage.setItem(
                    `chats_${myId}`,
                    JSON.stringify(updated)
                );
            }

            return updated;
        });

        try {
            const convData =
                await authApi.getOrCreateConversation(
                    token,
                    contact.id
                );

            if (convData.success) {
                const convId =
                    convData.conversationId;

                setConversationId(convId);

                /*
                 * On vérifie que Socket.IO est bien connecté
                 * avant d'envoyer les événements.
                 */
                if (
                    socketRef.current?.connected
                ) {
                    socketRef.current.emit(
                        'join_conversation',
                        {
                            conversationId:
                                convId,
                            userId: myId,
                            contactId:
                                contact.id
                        }
                    );

                    socketRef.current.emit(
                        'open_chat',
                        {
                            conversationId:
                                convId,
                            userId: myId
                        }
                    );
                } else {
                    console.warn(
                        "⚠️ Socket non connecté au moment de l'ouverture de la conversation."
                    );
                }

                const historyData =
                    await authApi.getChatHistory(
                        token,
                        convId
                    );

                if (historyData.success) {
                    setChatHistory(
                        historyData.data || []
                    );
                }
            }
        } catch (error) {
            console.error(
                "Erreur historique :",
                error
            );
        } finally {
            setLoadingHistory(false);
        }
    };

    // =========================================================
    // SAISIE DU MESSAGE
    // =========================================================

    const handleInputChange = (e) => {
        const value = e.target.value;

        setTypedMessage(value);

        if (textareaRef.current) {
            textareaRef.current.style.height =
                'auto';

            textareaRef.current.style.height =
                `${textareaRef.current.scrollHeight}px`;
        }

        if (
            !conversationId ||
            !socketRef.current?.connected
        ) {
            return;
        }

        socketRef.current.emit(
            'typing',
            {
                conversationId,
                userId: myId
            }
        );

        if (typingTimeoutRef.current) {
            clearTimeout(
                typingTimeoutRef.current
            );
        }

        typingTimeoutRef.current =
            setTimeout(() => {
                if (
                    socketRef.current?.connected
                ) {
                    socketRef.current.emit(
                        'stop_typing',
                        {
                            conversationId,
                            userId: myId
                        }
                    );
                }
            }, 2000);
    };

    // =========================================================
    // TOUCHE ENTER
    // =========================================================

    const handleKeyDown = (e) => {
        if (
            e.key === 'Enter' &&
            !e.shiftKey
        ) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    // =========================================================
    // ENVOI DU MESSAGE
    // =========================================================

    const handleSendMessage = (e) => {
        e.preventDefault();

        if (
            !typedMessage.trim() ||
            !conversationId
        ) {
            return;
        }

        if (
            !socketRef.current?.connected
        ) {
            console.error(
                "❌ Impossible d'envoyer le message : Socket.IO n'est pas connecté."
            );
            return;
        }

        const messageText =
            typedMessage.trim();

        if (typingTimeoutRef.current) {
            clearTimeout(
                typingTimeoutRef.current
            );
        }

        socketRef.current.emit(
            'stop_typing',
            {
                conversationId,
                userId: myId
            }
        );

        socketRef.current.emit(
            'send_message',
            {
                conversationId:
                    conversationId,
                senderId: myId,
                text: messageText
            }
        );

        setTypedMessage('');

        if (textareaRef.current) {
            textareaRef.current.style.height =
                'auto';
        }
    };

    // =========================================================
    // STATUT DES MESSAGES
    // =========================================================

    const renderStatusTicks = (status) => {
        if (status === 'read') {
            return (
                <span className="status-tick read">
                    ✓✓
                </span>
            );
        }

        if (status === 'delivered') {
            return (
                <span className="status-tick delivered">
                    ✓✓
                </span>
            );
        }

        return (
            <span className="status-tick sent">
                ✓
            </span>
        );
    };

    const currentTheme =
        localStorage.getItem('theme') ||
        'light';

    const isContactActiveOnline =
        activeContact &&
        onlineUsers.includes(
            Number(activeContact.id)
        );

    return (
        <div
            className={`app-chat-workspace theme-${currentTheme}`}
        >
            {/* SIDEBAR */}

            <div
                className={`chat-sidebar ${
                    isChatOpen
                        ? 'd-none d-md-flex'
                        : 'd-flex'
                }`}
            >
                <div className="sidebar-header p-3 border-bottom">
                    <h5 className="mb-3 fw-bold">
                        Messages
                    </h5>

                    <div className="sidebar-search-block position-relative">
                        <form
                            onSubmit={
                                handleSearchUser
                            }
                            className="search-form-inline d-flex align-items-center rounded-pill px-3 py-2"
                        >
                            <input
                                type="text"
                                className="border-0 shadow-none bg-transparent flex-grow-1 custom-input-size"
                                placeholder={
                                    loadingSearch
                                        ? "Recherche..."
                                        : "Rechercher un utilisateur..."
                                }
                                value={
                                    searchQuery
                                }
                                onChange={(e) =>
                                    setSearchQuery(
                                        e.target.value
                                    )
                                }
                            />

                            <button
                                type="submit"
                                className="border-0 bg-transparent p-0"
                            >
                                🔍
                            </button>
                        </form>

                        {searchResults.length >
                            0 && (
                            <div className="search-dropdown-overlay position-absolute start-0 w-100 mt-2 shadow rounded border">
                                {searchResults.map(
                                    (user) => (
                                        <div
                                            key={
                                                user.id
                                            }
                                            className="dropdown-item-user p-2 border-bottom"
                                            onClick={() =>
                                                handleSelectContact(
                                                    user
                                                )
                                            }
                                        >
                                            <strong className="d-block small">
                                                {
                                                    user.username
                                                }
                                            </strong>

                                            <span className="text-muted-custom extra-small">
                                                {
                                                    user.email
                                                }
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {searchError && (
                            <div className="search-error-popup position-absolute start-0 w-100 mt-2 p-2 rounded text-white small">
                                {searchError}
                            </div>
                        )}
                    </div>
                </div>

                <div className="sidebar-list flex-grow-1 overflow-auto">
                    {recentChats.length >
                    0 ? (
                        recentChats.map(
                            (contact) => {
                                const isContactOnline =
                                    onlineUsers.includes(
                                        Number(
                                            contact.id
                                        )
                                    );

                                return (
                                    <div
                                        key={
                                            contact.id
                                        }
                                        className={`sidebar-chat-item d-flex align-items-center p-1 border-bottom ${
                                            Number(
                                                activeContact?.id
                                            ) ===
                                            Number(
                                                contact.id
                                            )
                                                ? 'active'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            handleSelectContact(
                                                contact
                                            )
                                        }
                                    >
                                        <div className="position-relative d-inline-block flex-shrink-0">
                                            <div className="avatar-placeholder">
                                                {contact.username?.charAt(
                                                    0
                                                ).toUpperCase()}
                                            </div>

                                            <span
                                                className={`status-badge-dot ${
                                                    isContactOnline
                                                        ? 'online'
                                                        : 'offline'
                                                }`}
                                            ></span>
                                        </div>

                                        <div className="chat-item-info ms-3 flex-grow-1">
                                            <div className="chat-item-name fw-semibold">
                                                {
                                                    contact.username
                                                }
                                            </div>

                                            <div className="chat-item-sub small text-muted-custom">
                                                {isContactOnline
                                                    ? "En ligne"
                                                    : "Hors ligne"}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        )
                    ) : (
                        <div className="text-center p-4 text-muted-custom small">
                            Aucune discussion
                            en cours.
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN SPACE */}

            <div
                className={`chat-main-space flex-grow-1 ${
                    isChatOpen
                        ? 'd-flex'
                        : 'd-none d-md-flex'
                }`}
            >
                <div className="chat-main-header d-flex align-items-center justify-content-between px-3 border-bottom">
                    <div className="d-flex align-items-center">
                        {isChatOpen && (
                            <button
                                className="btn-back-nav d-md-none me-3 shadow-none border-0 bg-transparent text-primary p-0"
                                onClick={() => {
                                    setIsChatOpen(
                                        false
                                    );
                                    setActiveContact(
                                        null
                                    );
                                }}
                            >
                                ⬅️
                            </button>
                        )}

                        <div className="active-user-title d-flex align-items-center">
                            {activeContact ? (
                                <div className="d-flex align-items-center">
                                    <span
                                        className={`status-indicator ${
                                            isContactActiveOnline
                                                ? 'online'
                                                : 'offline'
                                        } me-2`}
                                    ></span>

                                    <div className="d-flex flex-column header-meta-block">
                                        <strong className="fs-6">
                                            {
                                                activeContact.username
                                            }
                                        </strong>

                                        <span
                                            className={`extra-small ${
                                                isOtherTyping
                                                    ? 'text-primary fw-bold pulse-anim'
                                                    : 'text-muted-custom'
                                            }`}
                                        >
                                            {isOtherTyping
                                                ? "en train d'écrire..."
                                                : isContactActiveOnline
                                                ? "En ligne"
                                                : "Hors ligne"}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <strong className="fs-6">
                                    Flux Global des
                                    Messages
                                </strong>
                            )}
                        </div>
                    </div>

                    {activeContact && (
                        <div className="header-actions d-flex gap-3">
                            <button
                                className="border-0 bg-transparent"
                                onClick={() =>
                                    alert(
                                        "Appel audio bientôt disponible"
                                    )
                                }
                            >
                                📞
                            </button>

                            <button
                                className="border-0 bg-transparent"
                                onClick={() =>
                                    alert(
                                        "Appel vidéo bientôt disponible"
                                    )
                                }
                            >
                                📹
                            </button>
                        </div>
                    )}
                </div>

                <div className="chat-history-viewport flex-grow-1 overflow-hidden d-flex flex-column">
                    {activeContact ? (
                        <div className="chat-messages-container d-flex flex-column h-100">
                            <div className="messages-flow flex-grow-1 overflow-auto p-3 d-flex flex-column gap-3">
                                {loadingHistory ? (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Chargement...
                                    </div>
                                ) : chatHistory.length >
                                  0 ? (
                                    chatHistory.map(
                                        (msg) => {
                                            const senderId =
                                                msg.sender_id ||
                                                msg.senderId;

                                            const isMe =
                                                myId &&
                                                senderId &&
                                                Number(
                                                    senderId
                                                ) ===
                                                    Number(
                                                        myId
                                                    );

                                            return (
                                                <div
                                                    key={
                                                        msg.id
                                                    }
                                                    className={`message-row ${
                                                        isMe
                                                            ? 'me'
                                                            : 'other'
                                                    }`}
                                                >
                                                    <div className="message-text-wrapper max-width-75">
                                                        <p className="msg-body">
                                                            {
                                                                msg.text
                                                            }
                                                        </p>

                                                        <div className="msg-meta-block extra-small">
                                                            <span className="msg-meta">
                                                                {new Date(
                                                                    msg.created_at ||
                                                                        msg.createdAt
                                                                ).toLocaleTimeString(
                                                                    [],
                                                                    {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    }
                                                                )}
                                                            </span>

                                                            {isMe &&
                                                                renderStatusTicks(
                                                                    msg.status
                                                                )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )
                                ) : (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Canal sécurisé
                                        initialisé. Dites
                                        bonjour !
                                    </div>
                                )}

                                <div
                                    ref={
                                        messagesEndRef
                                    }
                                />
                            </div>

                            <div className="chat-input-dock p-3 border-top">
                                <form
                                    onSubmit={
                                        handleSendMessage
                                    }
                                    className="dock-form rounded-pill"
                                >
                                    <button
                                        type="button"
                                        className="border-0 bg-transparent px-2 text-muted-custom"
                                        onClick={() =>
                                            alert(
                                                "Pièce jointe"
                                            )
                                        }
                                    >
                                        📎
                                    </button>

                                    <textarea
                                        ref={
                                            textareaRef
                                        }
                                        rows="1"
                                        className="message-input"
                                        placeholder="Écrire un message..."
                                        value={
                                            typedMessage
                                        }
                                        onChange={
                                            handleInputChange
                                        }
                                        onKeyDown={
                                            handleKeyDown
                                        }
                                    />

                                    <div className="dock-action-buttons gap-2 px-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                alert(
                                                    "Enregistrement du message vocal démarré..."
                                                )
                                            }
                                            className="voice-action-btn"
                                        >
                                            🎙️
                                        </button>

                                        <button
                                            type="submit"
                                            className="submit-action-btn"
                                        >
                                            🕊️
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="chat-messages-container d-flex flex-column h-100">
                            <div className="messages-flow flex-grow-1 overflow-auto p-3 d-flex flex-column gap-3">
                                {loadingGlobal ? (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Synchronisation du
                                        flux général...
                                    </div>
                                ) : globalMessages.length >
                                  0 ? (
                                    globalMessages.map(
                                        (msg) => {
                                            const senderId =
                                                msg.sender_id ||
                                                msg.senderId;

                                            const isMe =
                                                myId &&
                                                senderId &&
                                                Number(
                                                    senderId
                                                ) ===
                                                    Number(
                                                        myId
                                                    );

                                            const displayName =
                                                isMe
                                                    ? "Moi"
                                                    : msg.sender_username ||
                                                      msg.username ||
                                                      `Utilisateur #${senderId}`;

                                            return (
                                                <div
                                                    key={
                                                        msg.id
                                                    }
                                                    className={`message-row ${
                                                        isMe
                                                            ? 'me'
                                                            : 'other'
                                                    }`}
                                                >
                                                    <div className="message-text-wrapper max-width-75">
                                                        <span className="global-sender-tag extra-small fw-bold mb-1 d-block">
                                                            {
                                                                displayName
                                                            }
                                                        </span>

                                                        <p className="msg-body">
                                                            {
                                                                msg.text
                                                            }
                                                        </p>

                                                        <span className="msg-meta extra-small text-muted-custom">
                                                            {new Date(
                                                                msg.created_at ||
                                                                    msg.createdAt
                                                            ).toLocaleTimeString(
                                                                [],
                                                                {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                }
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )
                                ) : (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Aucun message
                                        dans votre boîte
                                        de réception pour
                                        le moment.
                                    </div>
                                )}

                                <div
                                    ref={
                                        messagesEndRef
                                    }
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
