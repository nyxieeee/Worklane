import React, { useState } from 'react';
import { Mail, X, Send, Trash2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEmailStore } from '../store/useEmailStore';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { formatTime } from '../utils';

interface Props {
  onClose: () => void;
}

export default function EmailNotifModal({ onClose }: Props) {
  const board = useWorkStore(s => s.getActiveBoard());
  const settings = useEmailStore(s => s.settings);
  const logs = useEmailStore(s => s.logs);
  const updateSettings = useEmailStore(s => s.updateSettings);
  const sendEmailNotification = useEmailStore(s => s.sendEmailNotification);
  const clearLogs = useEmailStore(s => s.clearLogs);
  const showToast = useToastStore(s => s.showToast);

  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Task Update: Design review ready');
  const [testBody, setTestBody] = useState('Hello! Your assigned card "Design review ready" has been updated.');

  const members = board?.members || [];

  const handleSendTest = () => {
    if (!testEmail.trim()) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }
    const recipient = members.find(m => m.email.toLowerCase() === testEmail.trim().toLowerCase()) || {
      id: 'test',
      name: testEmail.split('@')[0],
      email: testEmail.trim(),
      color: '#2563eb',
    };

    sendEmailNotification({
      recipient,
      subject: testSubject,
      body: testBody,
      eventType: 'status_changed',
    });

    showToast(`Email notification dispatched to ${testEmail.trim()}`, 'success');
  };

  const handleOpenInGmail = (email: string, subject: string, body: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{ maxWidth: 580, maxHeight: '85vh', transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Email Notification Settings</h2>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>

        <div className="modal-body">
          {/* Automatic Settings Toggle */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Automatic Email Alerts</div>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Notify assignees when tasks are assigned or due</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={e => {
                    updateSettings({ enabled: e.target.checked });
                    showToast(e.target.checked ? 'Email notifications active' : 'Email notifications paused', 'info');
                  }}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: settings.enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                  {settings.enabled ? 'Enabled' : 'Paused'}
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.notifyOnAssign}
                  onChange={e => updateSettings({ notifyOnAssign: e.target.checked })}
                />
                Notify member on task assignment
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.notifyOnDue}
                  onChange={e => updateSettings({ notifyOnDue: e.target.checked })}
                />
                Notify member on due dates & overdue alerts
              </label>
            </div>
          </div>

          {/* Test Email */}
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="field-label">Send Direct Update</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="select-input"
                style={{ flex: 1 }}
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
              >
                <option value="">Select a team member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.email}>{m.name} ({m.email || 'No email'})</option>
                ))}
              </select>
              <input
                type="email"
                className="text-input"
                style={{ flex: 1 }}
                placeholder="or enter email address..."
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
              />
            </div>
            <input
              type="text"
              className="text-input"
              placeholder="Subject"
              value={testSubject}
              onChange={e => setTestSubject(e.target.value)}
            />
            <textarea
              className="textarea-input"
              rows={2}
              placeholder="Message body"
              value={testBody}
              onChange={e => setTestBody(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {testEmail && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-secondary"
                  onClick={() => handleOpenInGmail(testEmail, testSubject, testBody)}
                  style={{ fontSize: 12 }}
                >
                  <ExternalLink size={13} /> Open in Gmail
                </motion.button>
              )}
              <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={handleSendTest} style={{ fontSize: 12 }}>
                <Send size={13} /> Send Email
              </motion.button>
            </div>
          </div>

          {/* Logs */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="field-label">Notification History ({logs.length})</label>
              {logs.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={clearLogs}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '2px 6px', color: 'hsl(var(--destructive))' }}
                >
                  <Trash2 size={12} /> Clear history
                </motion.button>
              )}
            </div>

            <div style={{ maxHeight: 150, overflowY: 'auto', borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)' }}>
              {logs.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  No emails sent yet.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{log.recipientEmail}</div>
                      <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>{log.subject}</div>
                    </div>
                    <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{formatTime(log.sentAt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>Close</motion.button>
        </div>
      </motion.div>
    </div>
  );
}
