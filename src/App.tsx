import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import BoardArea from './components/BoardArea';
import CardModal from './components/CardModal';
import MembersModal from './components/MembersModal';
import EmailNotifModal from './components/EmailNotifModal';
import LoginPage from './components/LoginPage';
import NotifPanel from './components/NotifPanel';
import Toast from './components/Toast';
import Dashboard from './components/Dashboard';
import CreateBoardModal from './components/modals/CreateBoardModal';
import AddColumnModal from './components/modals/AddColumnModal';
import SearchModal from './components/modals/SearchModal';
import PrivacyModal from './components/modals/PrivacyModal';
import SettingsModal from './components/modals/SettingsModal';
import { useWorkStore } from './store/useWorkStore';
import { useNotifStore } from './store/useNotifStore';
import { useEmailStore } from './store/useEmailStore';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import { supabaseService } from './services/supabaseService';
import { formatDueDate } from './utils';

const CHECK_INTERVAL_MS = 10_000;

const page3DVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, rotateY: -8, translateZ: -40 },
  animate: { opacity: 1, scale: 1, rotateY: 0, translateZ: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.96, rotateY: 8, translateZ: -40, transition: { duration: 0.18 } }
};

export default function App() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const initializeAuth = useAuthStore(s => s.initializeAuth);
  const activeBoardId = useWorkStore(s => s.activeBoardId);
  const switchBoard = useWorkStore(s => s.switchBoard);
  const updateCard = useWorkStore(s => s.updateCard);
  const syncCurrentUserProfile = useWorkStore(s => s.syncCurrentUserProfile);
  const loadBoardsFromCloud = useWorkStore(s => s.loadBoardsFromCloud);
  const loadNotificationsFromCloud = useNotifStore(s => s.loadNotificationsFromCloud);
  const addNotification = useNotifStore(s => s.addNotification);
  const isDark = useThemeStore(s => s.isDark);
  const currentUser = useAuthStore(s => s.user);

  // Initialize Supabase Auth session & listener on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Load cloud boards & notifications when user is logged in
  useEffect(() => {
    if (currentUser?.email) {
      loadBoardsFromCloud(currentUser.email);
      loadNotificationsFromCloud(currentUser.email);
    }
  }, [currentUser?.email, loadBoardsFromCloud, loadNotificationsFromCloud]);

  // Realtime subscription: auto-refresh boards & notifications when changes happen on Supabase
  useEffect(() => {
    if (!currentUser?.email) return;
    const email = currentUser.email;
    const unsub = supabaseService.subscribeToAll(
      email,
      () => {
        loadBoardsFromCloud(email);
      },
      () => {
        loadNotificationsFromCloud(email);
      }
    );
    return () => {
      unsub();
    };
  }, [currentUser?.email, loadBoardsFromCloud, loadNotificationsFromCloud]);

  // Sync user profile name with board memberships
  useEffect(() => {
    if (currentUser?.email && currentUser?.name) {
      syncCurrentUserProfile(currentUser);
    }
  }, [currentUser, syncCurrentUserProfile]);

  // Apply / remove dark class on <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Page routing: dashboard (home) or board (active board view)
  const [page, setPage] = useState<'dashboard' | 'board'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openCardBoardId, setOpenCardBoardId] = useState<string | null>(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'notifications' | 'email' | 'privacy' | 'labels'>('appearance');
  const [notifOpen, setNotifOpen] = useState(false);

  const handleOpenSettings = useCallback((tab: 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels' = 'appearance') => {
    setSettingsTab(tab);
    setShowSettings(true);
  }, []);

  // Active view layout & team member filter
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);

  // When user logs out, reset to dashboard
  useEffect(() => {
    if (!isAuthenticated) setPage('dashboard');
  }, [isAuthenticated]);

  const handleSelectBoard = useCallback((boardId: string) => {
    switchBoard(boardId);
    setPage('board');
  }, [switchBoard]);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Due-date checker
  const checkDueDates = useCallback(() => {
    const now = new Date();
    const storeBoards = useWorkStore.getState().boards;
    storeBoards.forEach(board => {
      board.columns?.forEach(col => {
        col.cards?.forEach(card => {
          if (!card.dueDate || card.completed) return;
          const due = new Date(card.dueDate);
          const diff = due.getTime() - now.getTime();
          const alerted24Key = `alerted24_${card.id}`;
          const alertedODKey  = `alertedOD_${card.id}`;

          // If due within 24h and not yet overdue
          if (diff > 0 && diff < 86400000 && !(card as any)[alerted24Key]) {
            updateCard(card.id, { [alerted24Key]: true });

            const targetRecipients = (card.assignees && card.assignees.length > 0)
              ? (card.assignees || []).map(mId => board.members?.find(m => m.id === mId)).filter(Boolean)
              : (board.members || []);

            targetRecipients.forEach(member => {
              if (member && member.email) {
                addNotification(
                  `Due soon: ${card.title}`,
                  `Due ${formatDueDate(card.dueDate)} on board "${board.name}"`,
                  'clock', card.id, board.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `Reminder: Task Due Soon - ${card.title}`,
                  body: `Hi ${member.name},\n\nThe task "${card.title}" is due soon (${formatDueDate(card.dueDate)}) on board "${board.name}".\n\nWorklane Team`,
                  eventType: 'due_reminder',
                });
              }
            });
          }

          // If overdue (diff <= 0)
          if (diff <= 0 && !(card as any)[alertedODKey]) {
            updateCard(card.id, { [alertedODKey]: true });

            const targetRecipients = (card.assignees && card.assignees.length > 0)
              ? (card.assignees || []).map(mId => board.members?.find(m => m.id === mId)).filter(Boolean)
              : (board.members || []);

            targetRecipients.forEach(member => {
              if (member && member.email) {
                addNotification(
                  `Overdue: ${card.title}`,
                  `Was due ${formatDueDate(card.dueDate)} on board "${board.name}"`,
                  'alert', card.id, board.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `Alert: Task is Overdue - ${card.title}`,
                  body: `Hi ${member.name},\n\nThe task "${card.title}" was due on ${formatDueDate(card.dueDate)} and is now overdue on board "${board.name}".\n\nWorklane Team`,
                  eventType: 'due_reminder',
                });
              }
            });
          }
        });
      });
    });
  }, [addNotification, updateCard]);

  useEffect(() => {
    checkDueDates();
    const interval = setInterval(checkDueDates, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkDueDates]);

  // Card modal opener
  const handleOpenCard = (cardId: string, boardId?: string) => {
    setOpenCardId(cardId);
    setOpenCardBoardId(boardId || activeBoardId);
  };

  // ── Authentication Check ──
  if (!isAuthenticated) {
    return (
      <div className="app-layout">
        <LoginPage />
        <Toast />
      </div>
    );
  }

  return (
    <div className="app-layout" style={{ perspective: 1400 }}>
      <div className={`app-window${sidebarCollapsed ? ' sidebar-collapsed-layout' : ''}`}>
        <Sidebar
          page={page}
          activeView={viewMode}
          onSelectView={setViewMode}
          filterMemberId={filterMemberId}
          onFilterMember={setFilterMemberId}
          onManageMembers={() => setShowMembers(true)}
          onOpenSettings={handleOpenSettings}
          onToggleNotif={() => setNotifOpen(o => !o)}
          onCreateBoard={() => setShowCreateBoard(true)}
          onGoToDashboard={() => setPage('dashboard')}
          onSelectBoard={handleSelectBoard}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />

        <div className="app-main-content" style={{ transformStyle: 'preserve-3d' }}>
          <AnimatePresence mode="wait">
            {page === 'dashboard' ? (
              <motion.div
                key="page-dashboard"
                variants={page3DVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <Topbar
                  page="dashboard"
                  onOpenSearch={() => setShowSearch(true)}
                  onManageMembers={() => setShowMembers(true)}
                  onManageEmail={() => handleOpenSettings('email')}
                  onOpenPrivacy={() => handleOpenSettings('privacy')}
                  onOpenSettings={handleOpenSettings}
                  onToggleNotif={() => setNotifOpen(o => !o)}
                  notifOpen={notifOpen}
                />
                <Dashboard
                  onSelectBoard={handleSelectBoard}
                  onCreateBoard={() => setShowCreateBoard(true)}
                  onOpenCard={handleOpenCard}
                />
              </motion.div>
            ) : (
              <motion.div
                key="page-board"
                variants={page3DVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <Topbar
                  onOpenSearch={() => setShowSearch(true)}
                  onManageMembers={() => setShowMembers(true)}
                  onManageEmail={() => handleOpenSettings('email')}
                  onOpenPrivacy={() => handleOpenSettings('privacy')}
                  onOpenSettings={handleOpenSettings}
                  onToggleNotif={() => setNotifOpen(o => !o)}
                  notifOpen={notifOpen}
                />

                <BoardArea
                  viewMode={viewMode}
                  filterMemberId={filterMemberId}
                  onClearFilter={() => setFilterMemberId(null)}
                  onOpenCard={cardId => handleOpenCard(cardId)}
                  onAddColumn={() => setShowAddColumn(true)}
                  onCreateBoard={() => setShowCreateBoard(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals with 3D Depth Entrance */}
      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onOpenCard={(cardId, boardId) => handleOpenCard(cardId, boardId)}
        />
      )}
      {showSettings && (
        <SettingsModal
          initialTab={settingsTab}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showCreateBoard && (
        <CreateBoardModal
          onClose={(createdBoardId?: string) => {
            setShowCreateBoard(false);
            if (createdBoardId) {
              switchBoard(createdBoardId);
              setPage('board');
            }
          }}
        />
      )}
      {showAddColumn && (
        <AddColumnModal
          onClose={() => setShowAddColumn(false)}
          mode={viewMode === 'list' ? 'row' : 'column'}
        />
      )}
      {showMembers && <MembersModal onClose={() => setShowMembers(false)} />}
      {showEmail && <EmailNotifModal onClose={() => setShowEmail(false)} />}

      {/* Card Detail */}
      {openCardId && (
        <CardModal
          cardId={openCardId}
          boardId={openCardBoardId}
          onClose={() => { setOpenCardId(null); setOpenCardBoardId(null); }}
        />
      )}

      {/* Notification Panel */}
      <NotifPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onOpenCard={(cardId, boardId) => {
          handleOpenCard(cardId, boardId);
          if (boardId && boardId !== activeBoardId) {
            useWorkStore.getState().switchBoard(boardId);
          }
        }}
      />

      {/* Toasts */}
      <Toast />
    </div>
  );
}
