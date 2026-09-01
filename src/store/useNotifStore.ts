import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Notification } from '../types';
import { uid } from '../utils';

interface NotifState {
  notifications: Notification[];
  addNotification: (
    title: string,
    sub: string,
    icon?: string,
    cardId?: string | null,
    boardId?: string | null,
    recipientEmail?: string | null
  ) => void;
  getNotificationsForUser: (userEmail?: string) => Notification[];
  clearAll: (userEmail?: string) => void;
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (title, sub, icon = 'bell', cardId = null, boardId = null, recipientEmail = null) => {
        const notif: Notification = {
          id: uid(),
          title,
          sub,
          icon,
          cardId,
          boardId,
          recipientEmail: recipientEmail ? recipientEmail.toLowerCase().trim() : null,
          time: new Date().toISOString(),
        };
        set(s => {
          const notifications = [notif, ...s.notifications].slice(0, 50);
          return { notifications };
        });
        // Browser notification
        if (Notification.permission === 'granted') {
          new Notification(`Worklane: ${title}`, { body: sub });
        }
      },

      getNotificationsForUser: (userEmail) => {
        const { notifications } = get();
        if (!userEmail) return notifications.filter(n => !n.recipientEmail);
        const email = userEmail.toLowerCase().trim();
        return notifications.filter(n => !n.recipientEmail || n.recipientEmail === email);
      },

      clearAll: (userEmail) => {
        if (!userEmail) {
          set({ notifications: [] });
          return;
        }
        const email = userEmail.toLowerCase().trim();
        set(s => ({
          notifications: s.notifications.filter(n => (n.recipientEmail ? n.recipientEmail !== email : false))
        }));
      },
    }),
    { name: 'worklane_notifs_v2' }
  )
);
