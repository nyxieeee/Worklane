import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EmailNotificationLog, EmailSettings, Member } from '../types';
import { uid } from '../utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const PIPEDREAM_WEBHOOK_URL = (import.meta.env.VITE_PIPEDREAM_WEBHOOK_URL || '').trim();

function buildWorklaneEmailHtml({
  recipientName,
  subject,
  body,
  eventType,
  metadata,
}: {
  recipientName: string;
  subject: string;
  body: string;
  eventType: string;
  metadata?: {
    cardTitle?: string;
    boardName?: string;
    cardId?: string;
    boardId?: string;
    actorName?: string;
    dueDate?: string;
  };
}) {
  const eventBadgeMap: Record<string, { label: string; bg: string; text: string }> = {
    card_assigned: { label: 'Task Assigned', bg: '#eef2ff', text: '#4f46e5' },
    due_reminder: { label: 'Due Date Reminder', bg: '#fffbeb', text: '#d97706' },
    status_changed: { label: 'Status Movement', bg: '#ecfdf5', text: '#059669' },
    mention: { label: 'Mentioned You', bg: '#fdf2f8', text: '#db2777' },
    test_ping: { label: 'System Test', bg: '#f1f5f9', text: '#475569' },
  };

  const badge = eventBadgeMap[eventType] || { label: 'Worklane Update', bg: '#eef2ff', text: '#4f46e5' };
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://worklane.app';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 28px 12px; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto;">
    <tr>
      <td style="background: #ffffff; border-radius: 16px; padding: 32px 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
          <tr>
            <td style="vertical-align: middle;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #6366f1); border-radius: 9px; text-align: center; vertical-align: middle; color: #ffffff; font-weight: 800; font-size: 18px; line-height: 36px;">
                    W
                  </td>
                  <td style="padding-left: 10px; vertical-align: middle;">
                    <span style="font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">Worklane</span>
                    <span style="font-size: 11px; font-weight: 600; color: #64748b; display: block;">Kanban Workspace</span>
                  </td>
                </tr>
              </table>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background-color: ${badge.bg}; color: ${badge.text}; text-transform: uppercase; letter-spacing: 0.04em;">
                ${badge.label}
              </span>
            </td>
          </tr>
        </table>

        <div style="height: 1px; background: #f1f5f9; margin-bottom: 22px;"></div>

        <!-- Greeting -->
        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #64748b;">
          Hello ${recipientName || 'there'} 👋,
        </p>

        <!-- Subject -->
        <h1 style="margin: 0 0 16px 0; font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.35; letter-spacing: -0.01em;">
          ${subject}
        </h1>

        <!-- Body Box -->
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line;">
          ${body}
        </div>

        ${(metadata?.cardTitle || metadata?.boardName || metadata?.dueDate || metadata?.actorName) ? `
        <!-- Metadata Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 16px; margin-bottom: 22px; font-size: 12.5px; color: #475569;">
          ${metadata?.cardTitle ? `
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b; width: 85px;">Task Card:</td>
            <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${metadata.cardTitle}</td>
          </tr>` : ''}
          ${metadata?.boardName ? `
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Board:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">${metadata.boardName}</td>
          </tr>` : ''}
          ${metadata?.dueDate ? `
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Due Date:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #e11d48;">${metadata.dueDate}</td>
          </tr>` : ''}
          ${metadata?.actorName ? `
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Updated by:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #1e293b;">${metadata.actorName}</td>
          </tr>` : ''}
        </table>
        ` : ''}

        <!-- CTA Button -->
        <div style="text-align: center; margin: 26px 0 20px 0;">
          <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 13.5px; font-weight: 700; letter-spacing: 0.01em; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
            Open in Worklane &rarr;
          </a>
        </div>

        <div style="height: 1px; background: #f1f5f9; margin: 24px 0 16px 0;"></div>

        <!-- Footer -->
        <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center;">
          Sent automatically by Worklane. To customize notification triggers, open <strong>Settings &rarr; Email Notifications</strong>.
        </p>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

interface EmailState {
  settings: EmailSettings;
  logs: EmailNotificationLog[];
  updateSettings: (patch: Partial<EmailSettings>) => void;
  sendEmailNotification: (params: {
    recipient: Member;
    subject: string;
    body: string;
    eventType: EmailNotificationLog['eventType'];
    metadata?: {
      cardTitle?: string;
      boardName?: string;
      cardId?: string;
      boardId?: string;
      actorName?: string;
      dueDate?: string;
    };
  }) => Promise<void>;
  testEmailNotification: (recipientEmail: string) => Promise<{ success: boolean; message: string }>;
  isConfigured: () => boolean;
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

      isConfigured: () => Boolean(PIPEDREAM_WEBHOOK_URL),

      sendEmailNotification: async ({ recipient, subject, body, eventType, metadata }) => {
        const { settings } = get();
        if (!settings.enabled) return;

        if (eventType === 'card_assigned' && !settings.notifyOnAssign) return;
        if (eventType === 'due_reminder' && !settings.notifyOnDue) return;
        if (eventType === 'status_changed' && !settings.notifyOnStatusChange) return;
        if (eventType === 'mention' && settings.notifyOnMention === false) return;

        if (!recipient.email) return;

        // Only dispatch and log when a deployment webhook URL is configured
        if (!PIPEDREAM_WEBHOOK_URL) {
          return;
        }

        const logId = uid();

        try {
          const htmlContent = buildWorklaneEmailHtml({
            recipientName: recipient.name,
            subject,
            body,
            eventType,
            metadata,
          });

          const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            recipient: {
              name: recipient.name,
              email: recipient.email,
            },
            sender: settings.senderEmail || 'notifications@worklane.app',
            subject,
            body,
            html: htmlContent,
            metadata: metadata || {},
            source: 'Worklane Kanban',
          };

          const res = await fetch(PIPEDREAM_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*',
            },
            body: JSON.stringify(payload),
          });

          const isSuccess = res.ok;
          const finalStatus: 'sent' | 'failed' = isSuccess ? 'sent' : 'failed';

          const newLog: EmailNotificationLog = {
            id: logId,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject,
            body,
            sentAt: new Date().toISOString(),
            status: finalStatus,
            eventType,
          };

          set(s => ({
            logs: [newLog, ...s.logs.filter(l => l.status === 'sent' || l.status === 'failed')].slice(0, 100)
          }));

          // Also record into Supabase email_logs table
          if (isSupabaseConfigured()) {
            supabase.from('email_logs').insert({
              id: logId,
              recipient_email: recipient.email,
              recipient_name: recipient.name,
              subject,
              body,
              status: finalStatus,
              event_type: eventType,
              sent_at: new Date().toISOString(),
            }).then();
          }
        } catch (err) {
          console.warn('[useEmailStore] Dispatch error:', err);
          const failLog: EmailNotificationLog = {
            id: logId,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject,
            body,
            sentAt: new Date().toISOString(),
            status: 'failed',
            eventType,
          };
          set(s => ({
            logs: [failLog, ...s.logs.filter(l => l.status === 'sent' || l.status === 'failed')].slice(0, 100)
          }));
        }
      },

      testEmailNotification: async (recipientEmail: string) => {
        if (!PIPEDREAM_WEBHOOK_URL) {
          return { success: false, message: 'Pipedream webhook URL is not configured in the deployment environment (VITE_PIPEDREAM_WEBHOOK_URL).' };
        }

        try {
          const testHtml = buildWorklaneEmailHtml({
            recipientName: recipientEmail.split('@')[0] || 'Team Member',
            subject: '🔔 Worklane Email Notification Test',
            body: 'Hello! This is an automated test notification from your Worklane Kanban workspace. If you can see this email, your Pipedream webhook is functioning perfectly!',
            eventType: 'test_ping',
            metadata: {
              cardTitle: 'Integration Verification Test',
              boardName: 'Worklane Kanban',
            },
          });

          const testPayload = {
            event: 'test_ping',
            timestamp: new Date().toISOString(),
            recipient: {
              name: recipientEmail.split('@')[0] || 'Team Member',
              email: recipientEmail,
            },
            sender: 'notifications@worklane.app',
            subject: '🔔 Worklane Email Notification Test',
            body: 'Hello! This is an automated test notification from your Worklane Kanban workspace.',
            html: testHtml,
            metadata: { isTest: true },
            source: 'Worklane Integration Test',
          };

          const res = await fetch(PIPEDREAM_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*',
            },
            body: JSON.stringify(testPayload),
          });

          if (res.ok) {
            return { success: true, message: `Email notification sent successfully to ${recipientEmail}!` };
          } else {
            return { success: false, message: `Webhook responded with HTTP status ${res.status}` };
          }
        } catch (err: any) {
          return { success: false, message: err?.message || 'Network request failed' };
        }
      },

      clearLogs: () => set({ logs: [] }),
      deleteLog: (id: string) => set(s => ({ logs: s.logs.filter(l => l.id !== id) })),
    }),
    {
      name: 'worklane_email_store_v1',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.logs = (state.logs || []).filter(l => l.status === 'sent' || l.status === 'failed');
        }
      }
    }
  )
);
