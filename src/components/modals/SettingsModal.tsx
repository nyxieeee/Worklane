import React, { useState, useRef } from 'react';
import {
  X, Sun, Moon, Bell, Mail, Shield, Tag, Eye, EyeOff,
  Download, Upload, Trash2, Check, Send, ExternalLink,
  Sparkles, Sliders, Database, HardDrive, CheckCircle2,
  AlertTriangle, Clock, Layers, Lock, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../../store/useThemeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkStore } from '../../store/useWorkStore';
import { useNotifStore } from '../../store/useNotifStore';
import { useEmailStore } from '../../store/useEmailStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import { avatarInitials, formatTime, formatBytes } from '../../utils';
import { LABELS } from '../../types';

type TabKey = 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels';

interface Props {
  initialTab?: TabKey;
  onClose: () => void;
}

export default function SettingsModal({ initialTab = 'appearance', onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Stores
  const isDark = useThemeStore(s => s.isDark);
  const toggleTheme = useThemeStore(s => s.toggle);
  const labelMode = useSettingsStore(s => s.labelMode);
  const setLabelMode = useSettingsStore(s => s.setLabelMode);
  const customLabels = useSettingsStore(s => s.customLabels);
  const addLabel = useSettingsStore(s => s.addLabel);
  const removeLabel = useSettingsStore(s => s.removeLabel);

  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const notifications = useNotifStore(s => s.notifications);
  const clearNotifications = useNotifStore(s => s.clearAll);
  const user = useAuthStore(s => s.user);
  const showToast = useToastStore(s => s.showToast);

  const boards = getVisibleBoards(user?.email);

  const emailSettings = useEmailStore(s => s.settings);
  const updateEmailSettings = useEmailStore(s => s.updateSettings);
  const emailLogs = useEmailStore(s => s.logs);
  const clearEmailLogs = useEmailStore(s => s.clearLogs);
  const sendEmailNotification = useEmailStore(s => s.sendEmailNotification);

  // Local state for adding custom label
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Task Update: Project Milestone');
  const [testBody, setTestBody] = useState('Hi! This is a test email notification dispatched from Worklane.');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage metrics
  const totalCards = boards.reduce((acc, b) => acc + (b.columns?.reduce((cAcc, c) => cAcc + (c.cards?.length || 0), 0) || 0), 0);
  const totalAttachments = boards.reduce((acc, b) => acc + (b.columns?.reduce((cAcc, c) => cAcc + (c.cards?.reduce((aAcc, a) => aAcc + (a.attachments?.length || 0), 0) || 0), 0) || 0), 0);

  const storageBytes = new Blob([
    localStorage.getItem('worklane_data_v4') || '',
    localStorage.getItem('worklane_notifs_v3') || '',
    localStorage.getItem('worklane_auth_v2') || '',
    localStorage.getItem('worklane_emails_v2') || '',
    localStorage.getItem('worklane_settings_v1') || '',
  ]).size;
  const storageKB = (storageBytes / 1024).toFixed(1);

  const handleExportData = () => {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      boards: useWorkStore.getState().boards,
      notifications: useNotifStore.getState().notifications,
      emailSettings: useEmailStore.getState().settings,
      customLabels: useSettingsStore.getState().customLabels,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worklane-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Workspace backup exported successfully', 'success');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.boards && Array.isArray(parsed.boards)) {
          useWorkStore.setState({ boards: parsed.boards, activeBoardId: parsed.boards[0]?.id || null });
          if (parsed.customLabels && Array.isArray(parsed.customLabels)) {
            useSettingsStore.setState({ customLabels: parsed.customLabels });
          }
          showToast('Workspace backup restored successfully', 'success');
          onClose();
        } else {
          showToast('Invalid backup file structure', 'error');
        }
      } catch (err) {
        showToast('Failed to parse backup file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateCustomLabel = () => {
    if (!newLabelName.trim()) return;
    addLabel(newLabelName.trim(), newLabelColor);
    showToast(`Created label "${newLabelName.trim()}"`, 'success');
    setNewLabelName('');
  };

  const handleSendTestEmail = () => {
    if (!testEmail.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }
    sendEmailNotification({
      recipient: {
        id: 'test',
        name: testEmail.split('@')[0],
        email: testEmail.trim(),
        color: '#6366f1'
      },
      subject: testSubject,
      body: testBody,
      eventType: 'status_changed'
    });
    showToast(`Test notification logged for ${testEmail.trim()}`, 'success');
  };

  const navTabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'appearance', label: 'Appearance & Display', icon: <Sun size={15} /> },
    { key: 'notifications', label: 'In-App Alerts', icon: <Bell size={15} /> },
    { key: 'email', label: 'Email Updates', icon: <Mail size={15} /> },
    { key: 'labels', label: 'Custom Labels', icon: <Tag size={15} /> },
    { key: 'privacy', label: 'Privacy & Storage', icon: <Shield size={15} /> },
  ];

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{
          maxWidth: 720,
          width: '90vw',
          height: 540,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          transformStyle: 'preserve-3d'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid hsl(var(--border) / 0.4)',
            backgroundColor: 'hsl(var(--card))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'hsl(var(--card))',
                boxShadow: 'var(--neu-shadow-raised-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))'
              }}
            >
              <Sliders size={16} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Preferences & Settings</div>
              <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Configure workspace preferences, notifications, and security</div>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}>
            <X size={15} />
          </motion.button>
        </div>

        {/* 2-Column Body: Tabs Sidebar + Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Settings Tab List */}
          <div
            style={{
              padding: '12px 8px',
              borderRight: '1px solid hsl(var(--border) / 0.4)',
              backgroundColor: 'hsl(var(--card))',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            {navTabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <motion.button
                  key={tab.key}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    fontSize: 12.5,
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? 'hsl(var(--card))' : 'transparent',
                    boxShadow: isActive ? 'var(--neu-shadow-pressed)' : 'none',
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease'
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </motion.button>
              );
            })}

            {/* Current user profile pill at bottom of tabs */}
            <div
              style={{
                marginTop: 'auto',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--neu-shadow-input)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {avatarInitials(user?.name || 'User')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content Panel */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* ── TAB 1: APPEARANCE & DISPLAY ── */}
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Theme & Color Mode</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Choose between bright neumorphic daylight mode or deep dark gunmetal theme.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    onClick={() => { if (isDark) toggleTheme(); }}
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'hsl(var(--card))',
                      boxShadow: !isDark ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                      cursor: 'pointer',
                      border: !isDark ? '1.5px solid hsl(var(--primary) / 0.5)' : '1.5px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                        <Sun size={15} color="#f59e0b" /> Light Theme
                      </div>
                      {!isDark && <Check size={14} color="hsl(var(--primary))" />}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Soft dual-shadow raised tactile surfaces with rich contrast.</div>
                  </div>

                  <div
                    onClick={() => { if (!isDark) toggleTheme(); }}
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'hsl(var(--card))',
                      boxShadow: isDark ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                      cursor: 'pointer',
                      border: isDark ? '1.5px solid hsl(var(--primary) / 0.5)' : '1.5px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
                        <Moon size={15} color="#6366f1" /> Dark Theme
                      </div>
                      {isDark && <Check size={14} color="hsl(var(--primary))" />}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Deep slate midnight aesthetic with white typography and colorful glows.</div>
                  </div>
                </div>

                <div style={{ height: 1, backgroundColor: 'hsl(var(--border) / 0.4)' }} />

                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Task Card Labels</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Toggle how tags and categories are presented on Kanban cards.</p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    className={`btn ${labelMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: 12.5, justifyContent: 'center' }}
                    onClick={() => setLabelMode('text')}
                  >
                    <Eye size={14} /> Full Text Badges
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    className={`btn ${labelMode === 'dot' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: 12.5, justifyContent: 'center' }}
                    onClick={() => setLabelMode('dot')}
                  >
                    <EyeOff size={14} /> Minimalist Dots
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── TAB 2: IN-APP NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>In-App Alert Center</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Manage task due-date alerts, board invitations, and clear notifications.</p>
                </div>

                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Active Notifications</div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                      {notifications.length} stored notification {notifications.length === 1 ? 'alert' : 'alerts'}
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    className="btn btn-secondary"
                    style={{ color: 'hsl(var(--destructive))', fontSize: 11.5, gap: 6 }}
                    onClick={() => {
                      clearNotifications(user?.email);
                      showToast('Notification inbox cleared', 'info');
                    }}
                  >
                    <Trash2 size={13} /> Clear Inbox
                  </motion.button>
                </div>

                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Alert Rules Active</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} color="#10b981" /> Tasks approaching deadline within 24 hours
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} color="#10b981" /> Overdue task notifications & alerts
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} color="#10b981" /> Member board invitations & collaborative task assignments
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: EMAIL UPDATES ── */}
            {activeTab === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Automated Email Updates</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Configure email triggers for task assignments, due dates, and board invites.</p>
                </div>

                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Email Notifications Master Switch</div>
                      <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Send background email notifications to team members</div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.enabled}
                        onChange={e => {
                          updateEmailSettings({ enabled: e.target.checked });
                          showToast(e.target.checked ? 'Email notifications enabled' : 'Email notifications paused', 'info');
                        }}
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: emailSettings.enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                        {emailSettings.enabled ? 'Enabled' : 'Paused'}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 6, borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.notifyOnAssign}
                        onChange={e => updateEmailSettings({ notifyOnAssign: e.target.checked })}
                      />
                      <span>Task Assignments</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.notifyOnDue}
                        onChange={e => updateEmailSettings({ notifyOnDue: e.target.checked })}
                      />
                      <span>Due Date Reminders</span>
                    </label>
                  </div>
                </div>

                {/* Email Dispatch Logs */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Recent Dispatched Logs ({emailLogs.length})</span>
                    {emailLogs.length > 0 && (
                      <motion.button whileTap={{ scale: 0.92 }} className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={clearEmailLogs}>
                        Clear Logs
                      </motion.button>
                    )}
                  </div>
                  {emailLogs.length === 0 ? (
                    <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', borderRadius: 'var(--radius)', boxShadow: 'var(--neu-shadow-input)' }}>
                      No dispatched emails logged yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', padding: '4px', margin: '-4px' }}>
                      {emailLogs.slice(0, 5).map(log => (
                        <div key={log.id} style={{ padding: '8px 12px', borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', fontSize: 11.5 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span>To: {log.recipientEmail}</span>
                            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{formatTime(log.sentAt)}</span>
                          </div>
                          <div style={{ color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{log.subject}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 4: CUSTOM LABELS ── */}
            {activeTab === 'labels' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Custom Task Labels</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Create customized labels and tags to categorize project tasks.</p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="New Label Name..."
                    value={newLabelName}
                    onChange={e => setNewLabelName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={e => setNewLabelColor(e.target.value)}
                    style={{ width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent' }}
                  />
                  <motion.button whileTap={{ scale: 0.94 }} className="btn btn-primary" onClick={handleCreateCustomLabel}>
                    Add Label
                  </motion.button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="field-label">Available System & Custom Labels</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {LABELS.map(l => (
                      <span key={l.id} className="card-label-badge" style={{ backgroundColor: `${l.color}15`, color: l.color, padding: '4px 10px', fontSize: 12 }}>
                        {l.name}
                      </span>
                    ))}
                    {customLabels.map(l => (
                      <span
                        key={l.id}
                        className="card-label-badge"
                        style={{
                          backgroundColor: `${l.color}15`,
                          color: l.color,
                          padding: '4px 10px',
                          fontSize: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {l.name}
                        <X
                          size={11}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            removeLabel(l.id);
                            showToast(`Removed label "${l.name}"`, 'info');
                          }}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 5: PRIVACY & STORAGE ── */}
            {activeTab === 'privacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Local Storage & Security</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>All your project boards, files, and tasks remain 100% private in your local browser sandbox.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{boards.length}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Active Boards</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{totalCards}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Total Tasks</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--primary))' }}>{storageKB} KB</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Storage Size</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" style={{ justifyContent: 'center', gap: 6 }} onClick={handleExportData}>
                    <Download size={14} /> Export Backup JSON
                  </motion.button>

                  <label style={{ display: 'contents' }}>
                    <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" style={{ justifyContent: 'center', gap: 6 }} onClick={() => fileInputRef.current?.click()}>
                      <Upload size={14} /> Restore Backup JSON
                    </motion.button>
                    <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportData} />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid hsl(var(--border) / 0.4)',
            backgroundColor: 'hsl(var(--card))',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>
            Done
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
