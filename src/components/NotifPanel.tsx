import React, { useMemo } from 'react';
import { Bell, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifStore } from '../store/useNotifStore';
import { useAuthStore } from '../store/useAuthStore';
import { formatTime } from '../utils';

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock size={14} color="#f59e0b" />,
  alert: <AlertTriangle size={14} color="#ef4444" />,
  bell:  <Bell size={14} color="#3b82f6" />,
  check: <CheckCircle2 size={14} color="#10b981" />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenCard: (cardId: string, boardId: string) => void;
}

export default function NotifPanel({ open, onClose, onOpenCard }: Props) {
  const rawNotifications = useNotifStore(s => s.notifications);
  const clearAll         = useNotifStore(s => s.clearAll);
  const user             = useAuthStore(s => s.user);

  const notifications = useMemo(() => {
    if (!user?.email) return rawNotifications.filter(n => !n.recipientEmail);
    const email = user.email.toLowerCase().trim();
    return rawNotifications.filter(n => !n.recipientEmail || n.recipientEmail === email);
  }, [rawNotifications, user?.email]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          backgroundColor: 'transparent'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            top: 56,
            right: 20,
            width: 320,
            maxHeight: 420,
            backgroundColor: 'hsl(var(--card))',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--neu-shadow-floating)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: 'none'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Notifications</span>
            {notifications.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '2px 6px' }}
                onClick={() => clearAll(user?.email)}
              >
                Clear all
              </motion.button>
            )}
          </div>

          <div style={{ padding: '8px 12px 12px 12px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: 'hsl(var(--primary))' }} />
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>All caught up!</div>
              </div>
            ) : (
              notifications.map(n => (
                <motion.div
                  key={n.id}
                  whileTap={{ scale: 0.98 }}
                  className="sidebar-nav-item"
                  style={{ padding: '8px 10px', alignItems: 'flex-start', boxShadow: 'var(--neu-shadow-raised-sm)', backgroundColor: 'hsl(var(--card))' }}
                  onClick={() => {
                    if (n.boardId && n.cardId) {
                      onOpenCard(n.cardId, n.boardId);
                      onClose();
                    }
                  }}
                >
                  <div style={{ marginTop: 2 }}>
                    {iconMap[n.icon] ?? <Bell size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>
                      {n.sub}
                    </div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground) / 0.8)', marginTop: 3 }}>
                      {formatTime(n.time)}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
