import React, { useEffect, useMemo } from 'react';
import {
  KanbanSquare, List, Calendar, Users, BellRing, Inbox,
  Mail, Shield, Plus, X, ChevronLeft, ChevronRight,
  ArrowLeft, Check, Sun, Moon, LayoutDashboard,
  Eye, EyeOff, LogOut, Settings, Sliders
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useThemeStore } from '../store/useThemeStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { avatarInitials } from '../utils';
import sidebarImg from '../assets/sidebar.png';
import sidebarDarkImg from '../assets/sidebar-dark.png';
import logoImg from '../assets/logo.png';

interface Props {
  page: 'dashboard' | 'board';
  activeView: 'board' | 'list' | 'calendar';
  onSelectView: (view: 'board' | 'list' | 'calendar') => void;
  onOpenInbox: () => void;
  isInboxOpen?: boolean;
  onManageMembers: () => void;
  onOpenSettings: (tab?: 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels') => void;
  onToggleNotif: () => void;
  onFilterMember: (memberId: string | null) => void;
  filterMemberId: string | null;
  onCreateBoard: () => void;
  onGoToDashboard: () => void;
  onSelectBoard: (boardId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  page, activeView, onSelectView, onOpenInbox, isInboxOpen = false,
  onManageMembers, onOpenSettings, onToggleNotif,
  onFilterMember, filterMemberId, onCreateBoard,
  onGoToDashboard, onSelectBoard,
  collapsed, onToggleCollapse,
}: Props) {
  const allBoards        = useWorkStore(s => s.boards);
  const activeBoardId    = useWorkStore(s => s.activeBoardId);
  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const deleteBoard      = useWorkStore(s => s.deleteBoard);
  const leaveBoard       = useWorkStore(s => s.leaveBoard);
  const user             = useAuthStore(s => s.user);
  const logout           = useAuthStore(s => s.logout);
  const labelMode        = useSettingsStore(s => s.labelMode);
  const setLabelMode     = useSettingsStore(s => s.setLabelMode);
  const showToast        = useToastStore(s => s.showToast);
  const showConfirm      = useConfirmStore(s => s.showConfirm);

  const boards = useMemo(() => getVisibleBoards(user?.email), [allBoards, user?.email, getVisibleBoards]);
  const isDark  = useThemeStore(s => s.isDark);
  const toggleTheme = useThemeStore(s => s.toggle);

  const activeBoard = useMemo(() => allBoards.find(b => b.id === activeBoardId), [allBoards, activeBoardId]);
  const teamMembers = activeBoard?.members ?? [];

  // ── Collapsed Sidebar ──
  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebar-header" style={{ justifyContent: 'center', height: 62, padding: '0 8px', flexDirection: 'column', gap: 4 }}>
          <img
            src={logoImg}
            alt="Worklane"
            style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', objectFit: 'contain' }}
            onClick={onGoToDashboard}
            title="Worklane"
          />
        </div>
        <div className="sidebar-scrollable" style={{ alignItems: 'center' }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            style={{ marginBottom: 4 }}
          >
            <ChevronRight size={15} />
          </motion.button>
          {page === 'dashboard' ? (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn active"
                title="All Boards"
                onClick={onGoToDashboard}
              >
                <LayoutDashboard size={16} />
              </motion.button>
              {boards.map(b => (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  key={b.id}
                  className="icon-btn"
                  title={b.name}
                  onClick={() => onSelectBoard(b.id)}
                >
                  <div className="sidebar-board-dot" style={{ backgroundColor: b.color }} />
                </motion.button>
              ))}
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Create Board"
                onClick={onCreateBoard}
              >
                <Plus size={16} />
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Back to Dashboard"
                onClick={onGoToDashboard}
              >
                <ArrowLeft size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${activeView === 'board' ? 'active' : ''}`}
                title="Board View"
                onClick={() => onSelectView('board')}
              >
                <KanbanSquare size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${activeView === 'list' ? 'active' : ''}`}
                title="List View"
                onClick={() => onSelectView('list')}
              >
                <List size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${activeView === 'calendar' ? 'active' : ''}`}
                title="Calendar View"
                onClick={() => onSelectView('calendar')}
              >
                <Calendar size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`icon-btn ${isInboxOpen ? 'active' : ''}`}
                title="Inbox & Concerns"
                onClick={onOpenInbox}
                style={{ position: 'relative' }}
              >
                <Inbox size={16} />
                {(activeBoard?.inboxCards?.length || 0) > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: 'hsl(var(--primary))',
                    }}
                  />
                )}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Team Members"
                onClick={onManageMembers}
              >
                <Users size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Notifications"
                onClick={onToggleNotif}
              >
                <BellRing size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                className="icon-btn"
                title="Settings"
                onClick={() => onOpenSettings()}
              >
                <Settings size={16} />
              </motion.button>
            </>
          )}
        </div>
      </aside>
    );
  }

  // ── Expanded Neumorphic Sidebar ──
  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 62, padding: '0 16px' }}>
        <div className="sidebar-logo" onClick={onGoToDashboard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img
            src={isDark ? sidebarDarkImg : sidebarImg}
            alt="Worklane"
            style={{
              height: 42,
              width: 'auto',
              maxHeight: 44,
              maxWidth: 165,
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className="sidebar-toggle-btn"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          style={{ position: 'absolute', right: 12 }}
        >
          <ChevronLeft size={15} />
        </motion.button>
      </div>

      <div className="sidebar-scrollable">
        {/* Dashboard Navigation */}
        {page === 'dashboard' ? (
          <>
            <div className="sidebar-section">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="sidebar-nav-item active"
                onClick={onGoToDashboard}
              >
                <LayoutDashboard size={15} />
                <span>Overview</span>
              </motion.button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Boards</span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  className="sidebar-action-icon-btn"
                  onClick={onCreateBoard}
                  title="Create Board"
                >
                  <Plus size={13} />
                </motion.button>
              </div>

              {boards.map(b => (
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  key={b.id}
                  className="sidebar-board-item"
                  onClick={() => onSelectBoard(b.id)}
                >
                  <div className="sidebar-board-dot" style={{ backgroundColor: b.color }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.name}
                  </span>
                  <div className="sidebar-board-actions">
                    {!b.createdBy || (user?.email && b.createdBy.toLowerCase().trim() === user.email.toLowerCase().trim()) ? (
                      <button
                        className="sidebar-action-icon-btn"
                        title="Delete Board"
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm({
                            title: `Delete "${b.name}"?`,
                            message: `Are you sure you want to permanently delete this board and all its tasks? This action cannot be undone.`,
                            confirmText: 'Delete Board',
                            variant: 'danger',
                            icon: 'trash',
                            onConfirm: () => {
                              deleteBoard(b.id);
                              showToast(`Deleted board "${b.name}"`, 'info');
                            }
                          });
                        }}
                      >
                        <X size={12} />
                      </button>
                    ) : (
                      <button
                        className="sidebar-action-icon-btn"
                        title="Leave Board"
                        style={{ color: 'hsl(var(--destructive))' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (user?.email) {
                            showConfirm({
                              title: `Leave "${b.name}"?`,
                              message: `Are you sure you want to leave this board? You will need an invite from the owner to rejoin.`,
                              confirmText: 'Leave Board',
                              variant: 'danger',
                              icon: 'logout',
                              onConfirm: () => {
                                if (user?.email) {
                                  leaveBoard(b.id, user.email);
                                  showToast(`You left "${b.name}"`, 'info');
                                }
                              }
                            });
                          }
                        }}
                      >
                        <LogOut size={12} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Active Board Header & Return */}
            <div className="sidebar-section">
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="sidebar-nav-item"
                onClick={onGoToDashboard}
              >
                <ArrowLeft size={14} />
                <span>All Boards</span>
              </motion.button>
              {activeBoard && (
                <div
                  className="sidebar-board-item active"
                  style={{ marginTop: 2, pointerEvents: 'none' }}
                >
                  <div className="sidebar-board-dot" style={{ backgroundColor: activeBoard.color }} />
                  <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeBoard.name}
                  </span>
                </div>
              )}
            </div>

            {/* Views */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Views</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${activeView === 'board' ? 'active' : ''}`}
                onClick={() => onSelectView('board')}
              >
                <KanbanSquare size={14} />
                <span style={{ flex: 1 }}>Board</span>
                {activeView === 'board' && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${activeView === 'list' ? 'active' : ''}`}
                onClick={() => onSelectView('list')}
              >
                <List size={14} />
                <span style={{ flex: 1 }}>List</span>
                {activeView === 'list' && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${activeView === 'calendar' ? 'active' : ''}`}
                onClick={() => onSelectView('calendar')}
              >
                <Calendar size={14} />
                <span style={{ flex: 1 }}>Calendar</span>
                {activeView === 'calendar' && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${isInboxOpen ? 'active' : ''}`}
                onClick={onOpenInbox}
              >
                <Inbox size={14} />
                <span style={{ flex: 1 }}>Inbox / Concerns</span>
                {(activeBoard?.inboxCards?.length || 0) > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 8,
                      backgroundColor: isInboxOpen ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                      color: isInboxOpen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {activeBoard?.inboxCards?.length}
                  </span>
                )}
                {isInboxOpen && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
            </div>

            {/* Team Filter */}
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span>Team</span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  className="sidebar-action-icon-btn"
                  onClick={onManageMembers}
                  title="Manage Team"
                >
                  <Plus size={13} />
                </motion.button>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`sidebar-nav-item ${filterMemberId === null ? 'active' : ''}`}
                onClick={() => onFilterMember(null)}
              >
                <Users size={14} />
                <span style={{ flex: 1 }}>All Members</span>
                {filterMemberId === null && <Check size={13} color="hsl(var(--primary))" />}
              </motion.button>
              {teamMembers.map(m => {
                const displayName = (user?.email && m.email?.toLowerCase().trim() === user.email.toLowerCase().trim() && user.name)
                  ? user.name
                  : m.name;

                return (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    key={m.id}
                    className={`sidebar-nav-item ${filterMemberId === m.id ? 'active' : ''}`}
                    onClick={() => onFilterMember(filterMemberId === m.id ? null : m.id)}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={displayName} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {avatarInitials(displayName)}
                      </div>
                    )}
                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </span>
                    {filterMemberId === m.id && <Check size={13} color="hsl(var(--primary))" />}
                  </motion.button>
                );
              })}
            </div>

          </>
        )}
      </div>

      {/* Fixed Bottom Footer: Settings, Theme & User Profile */}
      <div className="sidebar-footer">


        <motion.button
          whileTap={{ scale: 0.97 }}
          className="sidebar-nav-item"
          style={{ width: '100%' }}
          onClick={() => onOpenSettings()}
        >
          <Settings size={14} />
          {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>}
        </motion.button>

        {!collapsed ? (
          <div className="theme-segmented-control">
            <button
              className={`theme-seg-btn ${!isDark ? 'active' : ''}`}
              onClick={() => { if (isDark) toggleTheme(); }}
            >
              <Sun size={13} />
              <span>Light</span>
            </button>
            <button
              className={`theme-seg-btn ${isDark ? 'active' : ''}`}
              onClick={() => { if (!isDark) toggleTheme(); }}
            >
              <Moon size={13} />
              <span>Dark</span>
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.92 }}
            className="icon-btn"
            style={{ width: 32, height: 32, margin: '0 auto' }}
            onClick={() => toggleTheme()}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Moon size={14} /> : <Sun size={14} />}
          </motion.button>
        )}
      </div>
    </aside>
  );
}
