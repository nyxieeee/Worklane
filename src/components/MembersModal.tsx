import React, { useState } from 'react';
import { X, UserPlus, Camera, Trash2, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useNotifStore } from '../store/useNotifStore';
import { useAuthStore } from '../store/useAuthStore';
import { useEmailStore } from '../store/useEmailStore';
import { avatarInitials, uid } from '../utils';

interface Props {
  onClose: () => void;
}

export default function MembersModal({ onClose }: Props) {
  const board = useWorkStore(s => s.getActiveBoard());
  const addMember = useWorkStore(s => s.addMember);
  const updateMember = useWorkStore(s => s.updateMember);
  const removeMember = useWorkStore(s => s.removeMember);
  const leaveBoard = useWorkStore(s => s.leaveBoard);
  const showToast = useToastStore(s => s.showToast);
  const showConfirm = useConfirmStore(s => s.showConfirm);
  const currentUser = useAuthStore(s => s.user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  if (!board) return null;

  const members = board.members || [];
  const currentEmail = currentUser?.email?.toLowerCase().trim();
  const isOwner = board.createdBy && currentEmail && board.createdBy.toLowerCase().trim() === currentEmail;
  const isMember = members.some(m => m.email && currentEmail && m.email.toLowerCase().trim() === currentEmail);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>, memberId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar image must be under 2 MB', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = (ev.target?.result as string) ?? '';
      if (memberId) {
        updateMember(memberId, { avatarUrl: dataUrl });
        showToast('Profile photo updated', 'success');
      } else {
        setAvatarUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    const trimmedEmail = email.trim();
    const result = addMember(name.trim(), trimmedEmail, avatarUrl);
    if (result === null && trimmedEmail) {
      showToast('Member with that email is already on this board', 'error');
    } else {
      const adderName = currentUser?.name || currentUser?.email || 'A team member';
      
      // In-app notification for the newly added member
      if (trimmedEmail) {
        useNotifStore.getState().addNotification(
          `Invited to board: ${board.name}`,
          `${adderName} added you as a collaborator on "${board.name}".`,
          'users',
          null,
          board.id,
          trimmedEmail
        );

        // Dispatched email notification log
        useEmailStore.getState().sendEmailNotification({
          recipient: { id: result || uid(), name: name.trim(), email: trimmedEmail, color: '#6366f1' },
          subject: `You've been added to board "${board.name}" on Worklane`,
          body: `Hi ${name.trim()},\n\n${adderName} added you to collaborate on board "${board.name}". You can now view and edit tasks in this workspace.\n\nWorklane Team`,
          eventType: 'member_added',
        });
      }

      showToast(`Added ${name.trim()} to "${board.name}" and notified`, 'success');
      setName('');
      setEmail('');
      setAvatarUrl(undefined);
    }
  };

  const handleLeaveBoard = () => {
    if (!currentEmail) return;
    showConfirm({
      title: `Leave "${board.name}"?`,
      message: `Are you sure you want to leave this board? You will lose access unless re-invited.`,
      confirmText: 'Leave Board',
      variant: 'danger',
      icon: 'logout',
      onConfirm: () => {
        leaveBoard(board.id, currentEmail);
        showToast(`You left board "${board.name}"`, 'info');
        onClose();
      }
    });
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal small-modal"
        style={{ transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="modal-title">Board Members</h2>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', padding: '2px 8px', borderRadius: 9999 }}>
              {members.length}
            </span>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>

        <div className="modal-body">
          {/* Current Members List */}
          <div>
            <label className="field-label" style={{ marginBottom: 10, display: 'block' }}>Current Team</label>
            {members.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
                No members yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => {
                  const isCurrent = currentEmail && m.email && m.email.toLowerCase().trim() === currentEmail;
                  const isMemberOwner = board.createdBy && m.email && m.email.toLowerCase().trim() === board.createdBy.toLowerCase().trim();

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 12px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'hsl(var(--card))',
                        boxShadow: 'var(--neu-shadow-raised-sm)',
                      }}
                    >
                      {/* Avatar */}
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl}
                          alt={m.name}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            boxShadow: 'var(--neu-shadow-raised-sm)'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: m.color || '#6366f1',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 600,
                            flexShrink: 0,
                            boxShadow: 'var(--neu-shadow-raised-sm)'
                          }}
                        >
                          {avatarInitials(m.name)}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                            {m.name}
                          </span>
                          {isMemberOwner && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                              Owner
                            </span>
                          )}
                          {isCurrent && !isMemberOwner && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', color: 'hsl(var(--muted-foreground))' }}>
                              You
                            </span>
                          )}
                        </div>
                        {m.email && (
                          <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.email}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {isCurrent ? (
                        !isMemberOwner ? (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            className="icon-btn"
                            style={{ color: 'hsl(var(--destructive))' }}
                            title="Leave Board"
                            onClick={handleLeaveBoard}
                          >
                            <LogOut size={14} />
                          </motion.button>
                        ) : null
                      ) : (
                        (isOwner || !board.createdBy) && (
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            className="icon-btn"
                            style={{ color: 'hsl(var(--destructive))' }}
                            title="Remove Member"
                            onClick={() => {
                              showConfirm({
                                title: `Remove "${m.name}"?`,
                                message: `Are you sure you want to remove ${m.name} from this board? They will lose access to all tasks.`,
                                confirmText: 'Remove Member',
                                variant: 'danger',
                                icon: 'trash',
                                onConfirm: () => {
                                  removeMember(m.id);
                                  showToast(`${m.name} removed`, 'info');
                                }
                              });
                            }}
                          >
                            <Trash2 size={14} />
                          </motion.button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Member Form */}
          <div style={{ marginTop: 12, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="field-label">Add New Member</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                type="text"
                className="text-input"
                placeholder="Full Name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <input
                type="email"
                className="text-input"
                placeholder="Email Address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <motion.button
              whileTap={(name.trim() && email.trim()) ? { scale: 0.95 } : undefined}
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={!name.trim() || !email.trim()}
              style={{
                alignSelf: 'flex-start',
                opacity: (name.trim() && email.trim()) ? 1 : 0.5,
                cursor: (name.trim() && email.trim()) ? 'pointer' : 'not-allowed',
              }}
            >
              <UserPlus size={14} /> Add to Team
            </motion.button>
          </div>

          {/* Leave Board Option for enrolled non-owner members only */}
          {!isOwner && isMember && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--neu-shadow-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Leave this board</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>You will lose access to this board until re-invited.</div>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="btn btn-secondary"
                style={{ color: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive) / 0.3)', gap: 6, fontSize: 11.5, flexShrink: 0 }}
                onClick={handleLeaveBoard}
              >
                <LogOut size={13} />
                Leave Board
              </motion.button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>Close</motion.button>
        </div>
      </motion.div>
    </div>
  );
}
