import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { authApi } from '../../api/authApi';
import apiClient from '../../api/client';
import './ChatWindow.css';

// ============================================================
// URL DE L'API REST
// ============================================================

const API_URL =
    import.meta.env.VITE_API_WEBSOCKET ||
    "http://localhost:5000";

// ============================================================
// URL SOCKET.IO
// ============================================================

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (API_URL.includes('/api/with-god')
        ? API_URL.replace(/\/api\/with-god\/?$/, '')
        : API_URL);

// ============================================================
// DÉCODAGE JWT
// ============================================================

const decodeJwt = (token) => {
    try {
        if (!token) return null;

        const base64Url = token.split('.')[1];
        if (!base64Url) return null;

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

        const jsonPayload = decodeURIComponent(
            window.atob(base64).split('').map((c) =>
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join('')
        );

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Erreur lors du décodage du token :", error);
        return null;
    }
};

// ============================================================
// COMPOSANT
// ============================================================

const ChatWindow = () => {
    const [recentChats, setRecentChats] = useState([]);
    const [activeContact, setActiveContact] = useState(null);
    const [conversationId, setConversationId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchError, setSearchError] = useState('');
    const [loadingSearch, setLoadingSearch] = useState(false);

    const [typedMessage, setTypedMessage] = useState('');
    const [isOtherTyping, setIsOtherTyping] = useState(false);

    const [onlineUsers, setOnlineUsers] = useState([]);

    const [globalMessages, setGlobalMessages] = useState([]);
    const [loadingGlobal, setLoadingGlobal] = useState(false);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const activeContactRef = useRef(null);
    const conversationIdRef = useRef(null);

    const token = localStorage.getItem('token');

    const currentUser = useMemo(
        () => decodeJwt(token),
        [token]
    );

    const myId = currentUser?.id || currentUser?.userId;

    // ========================================================
    // REFS SYNCHRONISÉES
    // ========================================================

    useEffect(() => {
        activeContactRef.current = activeContact;
    }, [activeContact]);

    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    // ========================================================
    // NORMALISATION D'UN MESSAGE
    // ========================================================

    /*
     * Cette fonction garantit que tous les messages reçus
     * possèdent les mêmes propriétés côté React.
     *
     * Le backend fournit normalement :
     * sender_id
     * sender_name
     * text
     * created_at
     *
     * Mais on ajoute plusieurs fallback pour éviter qu'un
     * message reçu en temps réel perde le nom de son expéditeur.
     */

    const normalizeMessage = (message) => {
        if (!message) return null;

        const senderId =
            message.sender_id ||
            message.senderId;

        let senderName =
            message.sender_name ||
            message.senderName ||
            message.sender_username ||
            message.username;

        if (!senderName && Number(senderId) === Number(myId)) {
            senderName = "Moi";
        }

        if (
            !senderName &&
            activeContactRef.current &&
            Number(senderId) === Number(activeContactRef.current.id)
        ) {
            senderName = activeContactRef.current.username;
        }

        return {
            ...message,
            sender_id: senderId,
            sender_name: senderName || `Utilisateur #${senderId}`
        };
    };

    // ========================================================
    // SCROLL
    // ========================================================

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

    // ========================================================
    // CHARGEMENT DES DISCUSSIONS RÉCENTES
    // ========================================================

    useEffect(() => {
        if (!myId) return;

        const storedChats = localStorage.getItem(`chats_${myId}`);

        if (!storedChats) return;

        try {
            setRecentChats(JSON.parse(storedChats));
        } catch (error) {
            console.error(
                "Erreur lors de la lecture des discussions locales :",
                error
            );
        }
    }, [myId]);

    // ========================================================
    // CHARGEMENT DU FLUX GLOBAL
    // ========================================================

    useEffect(() => {
        const fetchGlobalInbox = async () => {
            if (!token) return;

            setLoadingGlobal(true);

            try {
                const res = await authApi.getAllUserMessages(token);

                if (res?.success) {
                    const messages = Array.isArray(res.data)
                        ? res.data.map(normalizeMessage)
                        : [];

                    setGlobalMessages(messages);
                } else {
                    setGlobalMessages([]);
                }
            } catch (error) {
                console.error(
                    "Erreur lors du chargement de la boîte globale :",
                    error
                );

                setGlobalMessages([]);
            } finally {
                setLoadingGlobal(false);
            }
        };

        if (!activeContact) {
            fetchGlobalInbox();
        }
    }, [activeContact, token]);

    // ========================================================
    // INITIALISATION SOCKET.IO
    // ========================================================

    useEffect(() => {
        if (!myId) return;

        console.log(
            "🔌 Initialisation Socket.IO vers :",
            SOCKET_URL
        );

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

        // ====================================================
        // CONNEXION
        // ====================================================

        const handleConnect = () => {
            console.log(`✅ Socket.IO connecté : ${socket.id}`);

            socket.emit('join_global_inbox', {
                userId: myId
            });

            const currentConversationId =
                conversationIdRef.current;

            if (currentConversationId) {
                socket.emit('join_conversation', {
                    conversationId: currentConversationId
                });
            }
        };

        // ====================================================
        // ERREUR
        // ====================================================

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

        // ====================================================
        // DÉCONNEXION
        // ====================================================

        const handleDisconnect = (reason) => {
            console.warn(
                "⚠️ Socket.IO déconnecté :",
                reason
            );
        };

        // ====================================================
        // RECONNEXION
        // ====================================================

        const handleReconnectAttempt = (attempt) => {
            console.log(
                `🔄 Tentative de reconnexion Socket.IO #${attempt}`
            );
        };

        // ====================================================
        // TRAITEMENT MESSAGE PRIVÉ
        // ====================================================

        const processPrivateMessage = (rawMessage) => {
            const newMessage = normalizeMessage(rawMessage);

            if (!newMessage) return;

            const currentConvId =
                newMessage.conversation_id ||
                newMessage.conversationId;

            const senderId =
                newMessage.sender_id ||
                newMessage.senderId;

            const currentConversationId =
                conversationIdRef.current;

            const currentContact =
                activeContactRef.current;

            if (
                currentContact &&
                Number(currentConvId) === Number(currentConversationId)
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
                            status:
                                newMessage.status ||
                                'read'
                        }
                    ];
                });

                if (
                    socket.connected &&
                    Number(senderId) !== Number(myId)
                ) {
                    socket.emit('message_read', {
                        messageId: newMessage.id,
                        conversationId: currentConversationId,
                        readerId: myId
                    });
                }
            }
        };

        // ====================================================
        // RÉCEPTION MESSAGE
        // ====================================================

        const handleReceiveMessage = (rawMessage) => {
            console.log(
                "📨 Message reçu :",
                rawMessage
            );

            const newMessage =
                normalizeMessage(rawMessage);

            if (!newMessage) return;

            // -----------------------------------------------
            // CONVERSATION PRIVÉE
            // -----------------------------------------------

            processPrivateMessage(newMessage);

            // -----------------------------------------------
            // FLUX GLOBAL
            // -----------------------------------------------

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

                /*
                 * IMPORTANT :
                 * On ajoute le nouveau message À LA FIN.
                 *
                 * Le backend renvoie les anciens messages
                 * dans l'ordre ASC et le nouveau message
                 * arrive ici après son INSERT.
                 *
                 * Le dernier message est donc le plus récent.
                 */

                return [
                    ...prev,
                    newMessage
                ];
            });

            // -----------------------------------------------
            // DISCUSSIONS RÉCENTES
            // -----------------------------------------------

            const senderId =
                newMessage.sender_id ||
                newMessage.senderId;

            setRecentChats((prev) => {
                let contactToMove = prev.find(
                    (c) =>
                        Number(c.id) ===
                        Number(senderId)
                );

                const currentContact =
                    activeContactRef.current;

                if (
                    !contactToMove &&
                    currentContact &&
                    Number(currentContact.id) ===
                        Number(senderId)
                ) {
                    contactToMove = currentContact;
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

        // ====================================================
        // RÉCEPTION FLUX GLOBAL
        // ====================================================

        const handleReceiveGlobalMessage = (rawMessage) => {
            console.log(
                "🌍 Nouveau message dans le flux global :",
                rawMessage
            );

            const newMessage =
                normalizeMessage(rawMessage);

            if (!newMessage) return;

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

                return [
                    ...prev,
                    newMessage
                ];
            });
        };

        // ====================================================
        // MESSAGE MARQUÉ COMME LU
        // ====================================================

        const handleMessagesMarkedRead = ({
            conversationId: msgConvId,
            readerId
        }) => {
            const currentConversationId =
                conversationIdRef.current;

            const currentContact =
                activeContactRef.current;

            if (
                currentContact &&
                Number(msgConvId) ===
                    Number(currentConversationId) &&
                Number(readerId) !== Number(myId)
            ) {
                setChatHistory((prev) =>
                    prev.map((msg) => {
                        const senderId =
                            msg.sender_id ||
                            msg.senderId;

                        if (
                            msg.status !== 'read' &&
                            Number(senderId) ===
                                Number(myId)
                        ) {
                            return {
                                ...msg,
                                status: 'read'
                            };
                        }

                        return msg;
                    })
                );
            }
        };

        // ====================================================
        // TYPING
        // ====================================================

        const handleUserTyping = ({
            conversationId: msgConvId,
            userId
        }) => {
            const currentConversationId =
                conversationIdRef.current;

            const currentContact =
                activeContactRef.current;

            if (
                currentContact &&
                Number(msgConvId) ===
                    Number(currentConversationId) &&
                Number(userId) !== Number(myId)
            ) {
                setIsOtherTyping(true);
            }
        };

        // ====================================================
        // STOP TYPING
        // ====================================================

        const handleUserStopTyping = ({
            conversationId: msgConvId,
            userId
        }) => {
            const currentConversationId =
                conversationIdRef.current;

            const currentContact =
                activeContactRef.current;

            if (
                currentContact &&
                Number(msgConvId) ===
                    Number(currentConversationId) &&
                Number(userId) !== Number(myId)
            ) {
                setIsOtherTyping(false);
            }
        };

        // ====================================================
        // UTILISATEURS EN LIGNE
        // ====================================================

        const handleOnlineUsers = (usersList) => {
            const ids = Array.isArray(usersList)
                ? usersList.map((u) =>
                      typeof u === 'object'
                          ? Number(u.userId || u.id)
                          : Number(u)
                  )
                : [];

            setOnlineUsers(ids);
        };

        // ====================================================
        // STATUT UTILISATEUR
        // ====================================================

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

        // ====================================================
        // EVENTS SOCKET.IO
        // ====================================================

        socket.on('connect', handleConnect);
        socket.on('connect_error', handleConnectError);
        socket.io.on('reconnect_attempt', handleReconnectAttempt);
        socket.on('disconnect', handleDisconnect);

        socket.on(
            'receive_message',
            handleReceiveMessage
        );

        socket.on(
            'receive_global_message',
            handleReceiveGlobalMessage
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

        // ====================================================
        // NETTOYAGE
        // ====================================================

        return () => {
            console.log(
                "🧹 Nettoyage de la connexion Socket.IO"
            );

            socket.off('connect', handleConnect);
            socket.off('connect_error', handleConnectError);
            socket.io.off(
                'reconnect_attempt',
                handleReconnectAttempt
            );
            socket.off('disconnect', handleDisconnect);

            socket.off(
                'receive_message',
                handleReceiveMessage
            );

            socket.off(
                'receive_global_message',
                handleReceiveGlobalMessage
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

    // ========================================================
    // RECHERCHE UTILISATEUR
    // ========================================================

    const handleSearchUser = async (e) => {
        e.preventDefault();

        if (!searchQuery.trim()) return;

        setLoadingSearch(true);
        setSearchError('');
        setSearchResults([]);

        try {
            const res =
                await authApi.searchUserByUsername(
                    token,
                    searchQuery.trim()
                );

            let users = [];

            if (res?.user) {
                users = Array.isArray(res.user)
                    ? res.user
                    : [res.user];
            } else if (Array.isArray(res?.data)) {
                users = res.data;
            } else if (res?.data?.user) {
                users = Array.isArray(res.data.user)
                    ? res.data.user
                    : [res.data.user];
            }

            const filteredUsers = users.filter(
                (user) =>
                    Number(user.id) !==
                    Number(myId)
            );

            if (filteredUsers.length === 0) {
                setSearchError(
                    "Aucun autre utilisateur trouvé."
                );
            } else {
                setSearchResults(
                    filteredUsers
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

    // ========================================================
    // OUVERTURE CONVERSATION
    // ========================================================

    const handleSelectContact = async (contact) => {
        const oldConversationId =
            conversationIdRef.current;

        if (
            oldConversationId &&
            socketRef.current?.connected
        ) {
            socketRef.current.emit(
                'leave_conversation',
                {
                    conversationId:
                        oldConversationId
                }
            );

            socketRef.current.emit(
                'stop_typing',
                {
                    conversationId:
                        oldConversationId,
                    userId: myId
                }
            );
        }

        setActiveContact(contact);
        activeContactRef.current = contact;

        setIsChatOpen(true);
        setLoadingHistory(true);
        setChatHistory([]);
        setSearchQuery('');
        setSearchResults([]);
        setSearchError('');
        setIsOtherTyping(false);
        setTypedMessage('');

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        setRecentChats((prev) => {
            const filtered = prev.filter(
                (c) =>
                    Number(c.id) !==
                    Number(contact.id)
            );

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

            if (!convData?.success) {
                console.error(
                    "❌ Impossible d'initialiser la conversation."
                );
                return;
            }

            const convId =
                convData.conversationId;

            setConversationId(convId);
            conversationIdRef.current = convId;

            if (socketRef.current?.connected) {
                socketRef.current.emit(
                    'join_conversation',
                    {
                        conversationId: convId
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

            if (historyData?.success) {
                setChatHistory(
                    Array.isArray(historyData.data)
                        ? historyData.data
                        : []
                );
            } else {
                setChatHistory([]);
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

    // ========================================================
    // SAISIE MESSAGE
    // ========================================================

    const handleInputChange = (e) => {
        const value = e.target.value;

        setTypedMessage(value);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height =
                `${textareaRef.current.scrollHeight}px`;
        }

        if (
            !conversationIdRef.current ||
            !socketRef.current?.connected
        ) {
            return;
        }

        socketRef.current.emit('typing', {
            conversationId:
                conversationIdRef.current,
            userId: myId
        });

        if (typingTimeoutRef.current) {
            clearTimeout(
                typingTimeoutRef.current
            );
        }

        typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit(
                    'stop_typing',
                    {
                        conversationId:
                            conversationIdRef.current,
                        userId: myId
                    }
                );
            }
        }, 2000);
    };

    // ========================================================
    // ENTER
    // ========================================================

    const handleKeyDown = (e) => {
        if (
            e.key === 'Enter' &&
            !e.shiftKey
        ) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    // ========================================================
    // ENVOI MESSAGE
    // ========================================================

    const handleSendMessage = (e) => {
        e.preventDefault();

        if (
            !typedMessage.trim() ||
            !conversationIdRef.current
        ) {
            return;
        }

        if (!socketRef.current?.connected) {
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
                conversationId:
                    conversationIdRef.current,
                userId: myId
            }
        );

        socketRef.current.emit(
            'send_message',
            {
                conversationId:
                    conversationIdRef.current,
                senderId: myId,
                text: messageText
            }
        );

        setTypedMessage('');

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    // ========================================================
    // STATUT
    // ========================================================

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

    // ========================================================
    // RENDER
    // ========================================================

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

                        {searchResults.length > 0 && (
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
                    {recentChats.length > 0 ? (
                        recentChats.map((contact) => {
                            const isContactOnline =
                                onlineUsers.includes(
                                    Number(contact.id)
                                );

                            return (
                                <div
                                    key={contact.id}
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
                                            {contact.username
                                                ?.charAt(0)
                                                .toUpperCase()}
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
                        })
                    ) : (
                        <div className="text-center p-4 text-muted-custom small">
                            Aucune discussion en cours.
                        </div>
                    )}
                </div>
            </div>

            {/* ESPACE PRINCIPAL */}

            <div
                className={`chat-main-space flex-grow-1 ${
                    isChatOpen
                        ? 'd-flex'
                        : 'd-none d-md-flex'
                }`}
            >
                {/* HEADER */}

                <div className="chat-main-header d-flex align-items-center justify-content-between px-3 border-bottom">
                    <div className="d-flex align-items-center">
                        {isChatOpen && (
                            <button
                                className="btn-back-nav d-md-none me-3 shadow-none border-0 bg-transparent text-primary p-0"
                                onClick={() => {
                                    if (
                                        conversationIdRef.current &&
                                        socketRef.current?.connected
                                    ) {
                                        socketRef.current.emit(
                                            'leave_conversation',
                                            {
                                                conversationId:
                                                    conversationIdRef.current
                                            }
                                        );
                                    }

                                    setIsChatOpen(false);
                                    setActiveContact(null);
                                    activeContactRef.current = null;
                                    setConversationId(null);
                                    conversationIdRef.current = null;
                                    setIsOtherTyping(false);
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
                                    Flux Global des Messages
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

                {/* ZONE DES MESSAGES */}

                <div className="chat-history-viewport flex-grow-1 overflow-hidden d-flex flex-column">
                    {activeContact ? (
                        <div className="chat-messages-container d-flex flex-column h-100">
                            <div className="messages-flow flex-grow-1 overflow-auto p-3 d-flex flex-column gap-3">
                                {loadingHistory ? (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Chargement...
                                    </div>
                                ) : chatHistory.length > 0 ? (
                                    chatHistory.map((msg) => {
                                        const senderId =
                                            msg.sender_id ||
                                            msg.senderId;

                                        const isMe =
                                            myId &&
                                            senderId &&
                                            Number(senderId) ===
                                                Number(myId);

                                        return (
                                            <div
                                                key={msg.id}
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
                                    })
                                ) : (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Canal sécurisé initialisé. Dites bonjour !
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
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
                                        Synchronisation du flux général...
                                    </div>
                                ) : globalMessages.length > 0 ? (
                                    globalMessages.map((msg) => {
                                        const senderId =
                                            msg.sender_id ||
                                            msg.senderId;

                                        const isMe =
                                            myId &&
                                            senderId &&
                                            Number(senderId) ===
                                                Number(myId);

                                        /*
                                         * Le nom est maintenant
                                         * directement récupéré depuis
                                         * sender_name.
                                         *
                                         * Le fallback protège aussi
                                         * l'affichage si un ancien
                                         * message ne possède pas encore
                                         * cette propriété.
                                         */

                                        const displayName =
                                            isMe
                                                ? "Moi"
                                                : msg.sender_name ||
                                                  msg.senderName ||
                                                  msg.sender_username ||
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
                                    })
                                ) : (
                                    <div className="chat-status-message text-center text-muted-custom small my-auto">
                                        Aucun message dans votre boîte de réception pour le moment.
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;

