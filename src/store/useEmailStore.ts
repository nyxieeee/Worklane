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
  const eventBadgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
    card_assigned: { label: 'Task Assigned', bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' },
    due_reminder: { label: 'Due Date Reminder', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    status_changed: { label: 'Status Movement', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    mention: { label: 'Mentioned You', bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
    test_ping: { label: 'System Test', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  };

  const badge = eventBadgeMap[eventType] || { label: 'Worklane Update', bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' };
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://worklane.app';
  
  // Official Worklane logo image URL (CDN backed by repository for 100% email client delivery)
  const logoUrl = 'https://cdn.jsdelivr.net/gh/nyxieeee/Worklane@main/public/logo.png';
  const cleanBody = body.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const previewSnippet = (body || subject || '').slice(0, 100).replace(/(\r\n|\n|\r)/gm, ' ');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 32px 14px; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  
  <!-- Inbox Preheader Snippet -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #0b1120; opacity: 0;">
    ${subject} &bull; ${previewSnippet}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto;">
    <tr>
      <td style="background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08);">
        
        <!-- Gradient Accent Bar -->
        <div style="height: 4px; background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #38bdf8 100%);"></div>

        <div style="padding: 32px 32px 28px 32px;">
          <!-- Header -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
            <tr>
              <td style="vertical-align: middle;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle; width: 40px;">
                      <img 
                        src="${logoUrl}" 
                        alt="Worklane Logo" 
                        width="38" 
                        height="38" 
                        style="display: block; width: 38px; height: 38px; border-radius: 10px; object-fit: contain;" 
                      />
                    </td>
                    <td style="padding-left: 12px; vertical-align: middle;">
                      <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; line-height: 1.1;">Worklane</div>
                      <div style="font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: 0.02em; margin-top: 3px; text-transform: uppercase;">Kanban Workspace</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; background-color: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; text-transform: uppercase; letter-spacing: 0.05em;">
                  ${badge.label}
                </span>
              </td>
            </tr>
          </table>

          <div style="height: 1px; background: #f1f5f9; margin-bottom: 24px;"></div>

          <!-- Greeting -->
          <p style="margin: 0 0 10px 0; font-size: 14.5px; font-weight: 600; color: #64748b; letter-spacing: -0.01em;">
            Hello <span style="color: #0f172a; font-weight: 700;">${recipientName || 'there'}</span> 👋,
          </p>

          <!-- Subject -->
          <h1 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.35; letter-spacing: -0.02em;">
            ${subject}
          </h1>

          <!-- Body Callout Box -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; font-size: 14.5px; line-height: 1.65; color: #334155; white-space: pre-line;">
            ${cleanBody}
          </div>

          ${(metadata?.cardTitle || metadata?.boardName || metadata?.dueDate || metadata?.actorName) ? `
          <!-- Metadata Spec Card -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 26px; font-size: 13px; color: #475569; overflow: hidden;">
            ${metadata?.cardTitle ? `
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #64748b; width: 100px; border-bottom: 1px solid #f1f5f9;">Task Card:</td>
              <td style="padding: 10px 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${metadata.cardTitle}</td>
            </tr>` : ''}
            ${metadata?.boardName ? `
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Board:</td>
              <td style="padding: 10px 16px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #f1f5f9;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; background-color: #e0e7ff; color: #4338ca; font-weight: 700; font-size: 11.5px;">${metadata.boardName}</span>
              </td>
            </tr>` : ''}
            ${metadata?.dueDate ? `
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid #f1f5f9;">Due Date:</td>
              <td style="padding: 10px 16px; font-weight: 700; color: #e11d48; border-bottom: 1px solid #f1f5f9;">
                📅 ${metadata.dueDate}
              </td>
            </tr>` : ''}
            ${metadata?.actorName ? `
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Updated by:</td>
              <td style="padding: 10px 16px; font-weight: 600; color: #1e293b;">👤 ${metadata.actorName}</td>
            </tr>` : ''}
          </table>
          ` : ''}

          <!-- CTA Button -->
          <div style="text-align: center; margin: 28px 0 24px 0;">
            <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: 0.01em; box-shadow: 0 4px 16px rgba(79, 70, 229, 0.4);">
              Open in Worklane &rarr;
            </a>
          </div>

          <div style="height: 1px; background: #f1f5f9; margin: 26px 0 18px 0;"></div>

          <!-- Footer -->
          <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.6; text-align: center;">
            Sent automatically by <strong>Worklane</strong> &bull; Agile workspace &amp; team collaboration.<br />
            To customize notification triggers, open <strong>Settings &rarr; Email Notifications</strong>.
          </p>

        </div>
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
            metadata: {
              isTest: true,
              cardTitle: 'Integration Verification Test',
              boardName: 'Worklane Kanban',
            },
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
