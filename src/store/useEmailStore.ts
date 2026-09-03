import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EmailNotificationLog, EmailSettings, Member } from '../types';
import { uid } from '../utils';

interface EmailState {
  settings: EmailSettings;
  logs: EmailNotificationLog[];
  updateSettings: (patch: Partial<EmailSettings>) => void;
  sendEmailNotification: (params: {
    recipient: Member;
    subject: string;
    body: string;
    eventType: EmailNotificationLog['eventType'];
  }) => void;
  clearLogs: () => void;
  deleteLog: (id: string) => void;
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
      settings: {
        enabled: true,
        notifyOnAssign: true,
        notifyOnDue: true,
        notifyOnStatusChange: true,
        notifyOnMention: true,
        senderEmail: 'notifications@worklane.app',
      },
      logs: [],

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

      sendEmailNotification: ({ recipient, subject, body, eventType }) => {
        const { settings, logs } = get();
        if (!settings.enabled) return;

        if (eventType === 'card_assigned' && !settings.notifyOnAssign) return;
        if (eventType === 'due_reminder' && !settings.notifyOnDue) return;
        if (eventType === 'status_changed' && !settings.notifyOnStatusChange) return;
        if (eventType === 'mention' && settings.notifyOnMention === false) return;

        if (!recipient.email) return;

        const newLog: EmailNotificationLog = {
          id: uid(),
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          subject,
          body,
          sentAt: new Date().toISOString(),
          status: 'simulated',
          eventType,
        };

        set({ logs: [newLog, ...logs].slice(0, 100) });
      },

      clearLogs: () => set({ logs: [] }),
      deleteLog: (id: string) => set(s => ({ logs: s.logs.filter(l => l.id !== id) })),
    }),
    { name: 'worklane_email_store_v1' }
  )
);
