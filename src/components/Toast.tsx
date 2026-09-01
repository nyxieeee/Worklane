import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';
import type { ToastType } from '../store/useToastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} color="#10b981" />,
  error:   <XCircle size={16} color="#ef4444" />,
  warning: <AlertTriangle size={16} color="#f59e0b" />,
  info:    <Info size={16} color="#3b82f6" />,
};

export default function Toast() {
  const toasts = useToastStore(s => s.toasts);
  const removeToast = useToastStore(s => s.removeToast);

  return (
    <div className="toast-container" style={{ perspective: 1000 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.92, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 15, scale: 0.92, rotateX: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`toast ${t.type}`}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {iconMap[t.type]}
            </div>
            <span style={{ flex: 1, fontSize: 13, color: 'hsl(var(--foreground))' }}>{t.msg}</span>
            {t.action && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                className={t.action.variant === 'danger' ? 'btn' : t.action.variant === 'primary' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{
                  padding: '3px 9px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  borderRadius: 8,
                  flexShrink: 0,
                  cursor: 'pointer',
                  ...(t.action.variant === 'danger' ? {
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)'
                  } : {})
                }}
                onClick={() => { t.action!.onClick(); removeToast(t.id); }}
              >
                {t.action.label}
              </motion.button>
            )}
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', display: 'flex', padding: 2 }}
              onClick={() => removeToast(t.id)}
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
