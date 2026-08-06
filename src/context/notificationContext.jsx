// contexts/NotificationContext.jsx
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { io } from 'socket.io-client';
import { authApi } from '../api/authApi'; // Import de tes fonctions API

// Décodage du token pour récupérer l'ID utilisateur
const getUserIdFromToken = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return parsed.id || parsed.userId || parsed.sub;
  } catch (e) {
    console.error("Erreur de décodage token:", e);
    return null;
  }
};

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastNotification, setToastNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');
  const userId = useMemo(() => getUserIdFromToken(token), [token]);

  // 1. Récupération des notifications via authApi
  const fetchMyNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await authApi.getUserNotifications(token);
      if (data && data.success && Array.isArray(data.data)) {
        setNotifications(data.data);
        const unread = data.data.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Erreur fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyNotifications();
  }, [token]);

  // 2. Écoute Socket.io Temps Réel
  useEffect(() => {
    if (!userId) return;

    const socket = io('http://localhost:5000', {
      auth: { token }
    });

    socket.emit('join_user_room', userId);

    socket.on('new_notification', (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      setToastNotification(newNotif);
      setTimeout(() => {
        setToastNotification(null);
      }, 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, token]);

  // 3. Actions via authApi
  const markAsRead = async (notificationId) => {
    // Maj optimiste dans l'UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await authApi.markNotificationAsRead(notificationId, token);
    } catch (error) {
      // Annulation en cas d'erreur
      fetchMyNotifications();
    }
  };

  const markAllAsRead = async () => {
    // Maj optimiste dans l'UI
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await authApi.markAllNotificationsAsRead(token);
    } catch (error) {
      fetchMyNotifications();
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toastNotification,
        loading,
        fetchMyNotifications,
        markAsRead,
        markAllAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);