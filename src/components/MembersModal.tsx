import React, { useState } from 'react';
import { X, UserPlus, Camera, Trash2, LogOut, Shield, User, Eye, Crown, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useNotifStore } from '../store/useNotifStore';
import { useAuthStore } from '../store/useAuthStore';
import { useEmailStore } from '../store/useEmailStore';
import { avatarInitials, uid } from '../utils';
import { NeumorphicSelect, SelectOption } from './ui/NeumorphicSelect';
import { MemberRole } from '../types';

interface Props {
  onClose: () => void;
}

type AssignableRole = 'admin' | 'member' | 'observer';

const OWNER_ROLE_OPTIONS: SelectOption<AssignableRole>[] = [
  { value: 'admin', label: 'Admin', subLabel: 'Full board management', icon: <Shield size={13} />, color: 'hsl(var(--primary))' },
  { value: 'member', label: 'Member', subLabel: 'Active team member', icon: <User size={13} />, color: 'hsl(var(--foreground))' },
  { value: 'observer', label: 'Observer', subLabel: 'Intern / Architecture study', icon: <Eye size={13} />, color: '#f59e0b' },
];

const ADMIN_ROLE_OPTIONS: SelectOption<AssignableRole>[] = [
  { value: 'member', label: 'Member', subLabel: 'Active team member', icon: <User size={13} />, color: 'hsl(var(--foreground))' },
  { value: 'observer', label: 'Observer', subLabel: 'Intern / Architecture study', icon: <Eye size={13} />, color: '#f59e0b' },
];

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
  const [role, setRole] = useState<'admin' | 'member' | 'observer'>('member');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const updateMemberRole = useWorkStore(s => s.updateMemberRole);

  if (!board) return null;

  const members = board.members || [];
  const currentEmail = currentUser?.email?.toLowerCase().trim();
  const isOwner = !!(board.createdBy && currentEmail && board.createdBy.toLowerCase().trim() === currentEmail);
  const currentMemberObj = members.find(m => m.email && currentEmail && m.email.toLowerCase().trim() === currentEmail);
  const isAdmin = !isOwner && currentMemberObj?.role === 'admin';
  const canManage = isOwner || isAdmin || !board.createdBy;

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
    const result = addMember(name.trim(), trimmedEmail, avatarUrl, role);
    if (result === null && trimmedEmail) {
      showToast('Member with that email is already on this board', 'error');
    } else {
      const adderName = currentUser?.name || currentUser?.email || 'A team member';
      
      // In-app notification for the newly added member
      if (trimmedEmail) {
        useNotifStore.getState().addNotification(
          `Invited to board: ${board.name}`,
          `${adderName} added you as ${role === 'observer' ? 'an Observer' : 'a Member'} on "${board.name}".`,
          'users',
          null,
          board.id,
          trimmedEmail
        );

        // Dispatched email notification log
        useEmailStore.getState().sendEmailNotification({
          recipient: { id: result || uid(), name: name.trim(), email: trimmedEmail, color: '#6366f1' },
          subject: `You've been added to board "${board.name}" on Worklane`,
          body: `Hi ${name.trim()},\n\n${adderName} added you as ${role === 'observer' ? 'an Observer (study mode)' : 'a Member'} to collaborate on board "${board.name}".\n\nWorklane Team`,
          eventType: 'member_added',
        });
      }

      showToast(`Added ${name.trim()} (${role === 'observer' ? 'Observer' : 'Member'}) to "${board.name}"`, 'success');
      setName('');
      setEmail('');
      setRole('member');
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
        style={{ transformStyle: 'preserve-3d', maxWidth: 520 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="modal-title">Board Team & Roles</h2>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', padding: '2px 8px', borderRadius: 9999 }}>
              {members.length}
            </span>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>

        <div className="modal-body">
          {/* Current Members List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label className="field-label" style={{ margin: 0 }}>Current Team & Access Levels</label>
            </div>

            {members.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
                No members yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(m => {
                  const isCurrent = currentEmail && m.email && m.email.toLowerCase().trim() === currentEmail;
                  const isMemberOwner = board.createdBy && m.email && m.email.toLowerCase().trim() === board.createdBy.toLowerCase().trim();
                  const memberRole = isMemberOwner ? 'owner' : (m.role || 'member');

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
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
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            boxShadow: 'var(--neu-shadow-raised-sm)'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
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
                          {isCurrent && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 9999, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
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

                      {/* Role Selector / Badge */}
                      <div>
                        {isMemberOwner ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '4px 9px',
                              borderRadius: 8,
                              backgroundColor: 'hsl(var(--primary) / 0.15)',
                              color: 'hsl(var(--primary))',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                            }}
                          >
                            <Crown size={12} strokeWidth={2.5} /> Owner
                          </span>
                        ) : isOwner ? (
                          // Owner can assign Admin, Member, or Observer
                          <NeumorphicSelect
                            value={m.role || 'member'}
                            options={OWNER_ROLE_OPTIONS}
                            size="sm"
                            onChange={(newRole) => {
                              updateMemberRole(board.id, m.id, newRole);
                              const roleLabel = newRole === 'admin' ? 'Admin' : newRole === 'observer' ? 'Observer (Intern)' : 'Member';
                              showToast(`${m.name}'s role updated to ${roleLabel}`, 'success');
                            }}
                          />
                        ) : isAdmin ? (
                          // Admin can change roles between Member and Observer
                          <NeumorphicSelect
                            value={m.role === 'observer' ? 'observer' : 'member'}
                            options={ADMIN_ROLE_OPTIONS}
                            size="sm"
                            onChange={(newRole) => {
                              updateMemberRole(board.id, m.id, newRole);
                              showToast(`${m.name}'s role updated to ${newRole === 'observer' ? 'Observer (Intern)' : 'Member'}`, 'success');
                            }}
                          />
                        ) : (
                          // Read-only badge for regular members & observers
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '4px 9px',
                              borderRadius: 8,
                              backgroundColor: m.role === 'admin'
                                ? 'hsl(var(--primary) / 0.15)'
                                : m.role === 'observer'
                                ? 'hsl(38 92% 50% / 0.15)'
                                : 'hsl(var(--muted))',
                              color: m.role === 'admin'
                                ? 'hsl(var(--primary))'
                                : m.role === 'observer'
                                ? '#f59e0b'
                                : 'hsl(var(--foreground))',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                            }}
                          >
                            {m.role === 'admin' ? (
                              <>
                                <Shield size={12} /> Admin
                              </>
                            ) : m.role === 'observer' ? (
                              <>
                                <Eye size={12} /> Observer
                              </>
                            ) : (
                              <>
                                <User size={12} /> Member
                              </>
                            )}
                          </span>
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
                        canManage && (
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
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid hsl(var(--border) / 0.6)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="field-label" style={{ margin: 0 }}>Add New Team Member</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.1fr', gap: 8, alignItems: 'center' }}>
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
              <NeumorphicSelect
                value={role}
                options={isOwner ? OWNER_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS}
                onChange={setRole}
                size="md"
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 8,
                backgroundColor: 'hsl(var(--muted) / 0.35)',
                border: '1px solid hsl(var(--border) / 0.5)',
                fontSize: 11.5,
                color: 'hsl(var(--muted-foreground))',
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Info size={13} style={{ color: 'hsl(var(--primary))' }} />
                <span>Role Permissions:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>
                  <strong style={{ color: 'hsl(var(--foreground))' }}>Admin:</strong> Assign tasks, manage members, and configure boards.
                </li>
                <li>
                  <strong style={{ color: 'hsl(var(--foreground))' }}>Member:</strong> Complete assigned cards, edit details, and post comments.
                </li>
                <li>
                  <strong style={{ color: 'hsl(var(--foreground))' }}>Observer:</strong> Read-only intern mode — study architecture, view task guides, and reply to comments.
                </li>
              </ul>
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
          {!isOwner && !!currentMemberObj && (
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
