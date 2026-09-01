import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Board, Column, Card, Member, Attachment, Comment } from '../types';
import { AVATAR_COLORS, LABELS } from '../types';
import { uid, avatarInitials } from '../utils';
import { useEmailStore } from './useEmailStore';
import { useAuthStore } from './useAuthStore';
import { useNotifStore } from './useNotifStore';
import { supabaseService } from '../services/supabaseService';

interface WorkState {
  boards: Board[];
  activeBoardId: string | null;
  lastMoveSnapshot: Board | null;
  isLoadingCloud: boolean;

  // Cloud sync actions
  loadBoardsFromCloud: (userEmail: string) => Promise<void>;
  syncBoardToCloud: (boardId: string) => Promise<void>;

  // Board actions
  createBoard: (name: string, color: string, createdBy?: string, creatorName?: string) => void;
  deleteBoard: (boardId: string) => void;
  leaveBoard: (boardId: string, userEmail: string) => void;
  switchBoard: (boardId: string) => void;
  syncCurrentUserProfile: (user: { name?: string; email?: string; avatarUrl?: string }) => void;

  // Visibility selector
  getVisibleBoards: (userEmail?: string) => Board[];

  // Column actions
  addColumn: (name: string) => void;
  deleteColumn: (colId: string) => void;
  renameColumn: (colId: string, name: string) => void;

  // Card actions
  addCard: (colId: string, title: string) => Card;
  updateCard: (cardId: string, patch: Partial<Card>) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, fromColId: string, toColId: string, afterCardId?: string) => void;
  undoLastMove: () => void;
  toggleCardComplete: (cardId: string) => void;
  toggleCardLabel: (cardId: string, labelId: string) => void;
  toggleCardAssignee: (cardId: string, memberId: string) => void;

  // Attachment actions
  addAttachment: (cardId: string, att: Attachment) => void;
  removeAttachment: (cardId: string, attId: string) => void;

  // Comment actions
  addComment: (cardId: string, text: string) => void;
  deleteComment: (cardId: string, commentId: string) => void;

  // Member actions
  addMember: (name: string, email: string, avatarUrl?: string) => string | null;
  updateMember: (memberId: string, patch: Partial<Member>) => void;
  removeMember: (memberId: string) => void;

  // Helpers (read-only selectors)
  getActiveBoard: () => Board | undefined;
  getBoard: (boardId: string) => Board | undefined;
  findCard: (cardId: string, boardId?: string) => { card: Card; column: Column; board: Board } | null;
}

const DEMO_MEMBERS: Member[] = [
  { id: uid(), name: 'Alex Carter',  email: 'alex@worklane.io',   color: '#6366f1' },
  { id: uid(), name: 'Sam Rivera',   email: 'sam@worklane.io',    color: '#10b981' },
  { id: uid(), name: 'Jordan Lee',   email: 'jordan@worklane.io', color: '#f97316' },
];

// Fixed column order: Urgent always first
const COLUMN_ORDER_MAP: Record<string, number> = {
  urgent: 0, critical: 0,
  'to do': 1, todo: 1, backlog: 1,
  'in progress': 2, active: 2, doing: 2,
  review: 3, qa: 3, testing: 3,
  done: 4, complete: 4, completed: 4,
};

function getColOrder(name: string): number {
  const n = name.trim().toLowerCase();
  for (const [key, val] of Object.entries(COLUMN_ORDER_MAP)) {
    if (n.includes(key)) return val;
  }
  return 99;
}

export function sortColumnsByWorkflow(columns: Column[]): Column[] {
  return [...columns].sort((a, b) => getColOrder(a.name) - getColOrder(b.name));
}

function buildDemoBoard(): Board {
  const colIds = [uid(), uid(), uid(), uid(), uid()];
  const card1: Card = {
    id: uid(), title: 'Design new landing page',
    description: 'Redesign the marketing landing page with the new brand guidelines.',
    comments: [], attachments: [], labels: ['design', 'frontend'],
    assignees: [], dueDate: null, completed: false,
    completedAt: null, createdAt: new Date().toISOString(),
  };
  const card2: Card = {
    id: uid(), title: 'API integration for auth module',
    description: 'Integrate the new JWT-based authentication endpoints.',
    comments: [{ id: uid(), author: 'Me', authorInitials: 'ME', avatarColor: '#6366f1', text: 'Need to check the token refresh flow.', createdAt: new Date().toISOString() }],
    attachments: [], labels: ['backend', 'feature'],
    assignees: [], dueDate: new Date(Date.now() + 3600000 * 4).toISOString(),
    completed: false, completedAt: null, createdAt: new Date().toISOString(),
  };
  const card3: Card = {
    id: uid(), title: 'Fix critical login bug',
    description: 'Users are unable to login with SSO on Safari.',
    comments: [], attachments: [],
    labels: ['bug', 'urgent'], assignees: [], dueDate: new Date(Date.now() + 3600000 * 2).toISOString(),
    completed: false, completedAt: null, createdAt: new Date().toISOString(),
  };
  const card4: Card = {
    id: uid(), title: 'Fix responsive layout bugs',
    description: '', comments: [], attachments: [],
    labels: ['bug', 'frontend'], assignees: [], dueDate: null,
    completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
  };
  return {
    id: uid(),
    name: 'My First Board',
    color: '#6366f1',
    members: DEMO_MEMBERS,
    columns: [
      { id: colIds[2], name: 'Urgent',      cards: [card3] },
      { id: colIds[0], name: 'To Do',       cards: [card1] },
      { id: colIds[1], name: 'In Progress', cards: [card2] },
      { id: colIds[3], name: 'Review',      cards: [] },
      { id: colIds[4], name: 'Done',        cards: [card4] },
    ],
  };
}

function findCardInBoard(board: Board, cardId: string): { card: Card; column: Column } | null {
  for (const col of board.columns) {
    const card = col.cards.find(c => c.id === cardId);
    if (card) return { card, column: col };
  }
  return null;
}

function updateBoards(boards: Board[], targetBoardId: string, updater: (b: Board) => Board): Board[] {
  return boards.map(b => (b.id === targetBoardId ? updater(b) : b));
}

function updateColumns(board: Board, targetColId: string, updater: (col: Column) => Column): Board {
  return {
    ...board,
    columns: (board.columns || []).map(c => (c.id === targetColId ? updater(c) : c)),
  };
}

function updateCardInBoard(board: Board, cardId: string, updater: (c: Card) => Card): Board {
  return {
    ...board,
    columns: (board.columns || []).map(col => ({
      ...col,
      cards: (col.cards || []).map(c => c.id === cardId ? updater(c) : c),
    })),
  };
}

// ── Zustand Store ─────────────────────────────────────────────────────────

export const useWorkStore = create<WorkState>()(
  persist(
    (set, get) => ({
      boards: [],
      activeBoardId: null,
      lastMoveSnapshot: null,
      isLoadingCloud: false,

      getActiveBoard: () => {
        const { boards, activeBoardId } = get();
        return boards.find(b => b.id === activeBoardId);
      },
      getBoard: (boardId) => get().boards.find(b => b.id === boardId),
      findCard: (cardId, boardId) => {
        const { boards, activeBoardId } = get();
        const targetId = boardId ?? activeBoardId;
        const board = boards.find(b => b.id === targetId);
        if (!board) return null;
        const result = findCardInBoard(board, cardId);
        if (!result) return null;
        return { ...result, board };
      },

      // ── Cloud Sync Actions ─────────────────────────────
      loadBoardsFromCloud: async (userEmail: string) => {
        if (!userEmail || !supabaseService.isConfigured()) return;
        const cleanEmail = userEmail.toLowerCase().trim();
        set({ isLoadingCloud: true });

        try {
          const cloudBoards = await supabaseService.getBoardsForUser(cleanEmail);
          
          set(s => {
            // Check if there are local boards created by this user that need initial cloud push
            const localBoardsToUpload = s.boards.filter(b => 
              b.createdBy && 
              b.createdBy.toLowerCase().trim() === cleanEmail && 
              !cloudBoards.some(cb => cb.id === b.id)
            );

            // Upload any local-only boards in the background
            localBoardsToUpload.forEach(b => {
              supabaseService.syncBoard(b);
            });

            // Combine cloud boards and uploaded local boards
            const merged = [...cloudBoards, ...localBoardsToUpload];
            const finalBoards = merged.length > 0 ? merged : s.boards;
            const activeBoardId = s.activeBoardId && finalBoards.some(b => b.id === s.activeBoardId)
              ? s.activeBoardId
              : (finalBoards[0]?.id ?? null);

            return { boards: finalBoards, activeBoardId, isLoadingCloud: false };
          });
        } catch (err) {
          console.warn('[useWorkStore] Cloud load error:', err);
          set({ isLoadingCloud: false });
        }
      },

      syncBoardToCloud: async (boardId: string) => {
        const board = get().boards.find(b => b.id === boardId);
        if (board) {
          await supabaseService.syncBoard(board);
        }
      },

      // ── Board actions ──────────────────────────────────
      createBoard: (name, color, createdBy, creatorName) => {
        const creatorMember: Member | null = createdBy
          ? {
              id: uid(),
              name: creatorName && creatorName.trim() ? creatorName.trim() : createdBy.split('@')[0],
              email: createdBy,
              color: AVATAR_COLORS[0]
            }
          : null;
        const board: Board = {
          id: uid(),
          name,
          color,
          createdBy,
          members: creatorMember ? [creatorMember] : [],
          columns: [
            { id: uid(), name: 'Urgent',      cards: [] },
            { id: uid(), name: 'To Do',       cards: [] },
            { id: uid(), name: 'In Progress', cards: [] },
            { id: uid(), name: 'Review',      cards: [] },
            { id: uid(), name: 'Done',        cards: [] },
          ],
        };
        set(s => ({ boards: [...s.boards, board], activeBoardId: board.id }));
        supabaseService.syncBoard(board);
      },

      syncCurrentUserProfile: (user) => {
        if (!user || !user.email) return;
        const email = user.email.toLowerCase().trim();
        const fullName = user.name?.trim();
        if (!fullName) return;

        set(s => {
          const updatedBoards = s.boards.map(b => ({
            ...b,
            members: b.members.map(m => {
              if (m.email && m.email.toLowerCase().trim() === email) {
                return {
                  ...m,
                  name: fullName,
                  avatarUrl: user.avatarUrl || m.avatarUrl,
                };
              }
              return m;
            })
          }));
          return { boards: updatedBoards };
        });
      },

      getVisibleBoards: (userEmail) => {
        const { boards } = get();
        if (!userEmail) return boards;
        const email = userEmail.toLowerCase().trim();
        return boards.filter(b => {
          if (b.createdBy && b.createdBy.toLowerCase().trim() === email) return true;
          if (b.members && b.members.some(m => m.email && m.email.toLowerCase().trim() === email)) return true;
          if (!b.createdBy && (!b.members || b.members.length === 0)) return true;
          return false;
        });
      },

      deleteBoard: (boardId) => {
        set(s => {
          const boards = s.boards.filter(b => b.id !== boardId);
          const activeBoardId = s.activeBoardId === boardId
            ? (boards[0]?.id ?? null)
            : s.activeBoardId;
          return { boards, activeBoardId };
        });
        supabaseService.deleteBoard(boardId);
      },

      leaveBoard: (boardId, userEmail) => {
        const email = userEmail.toLowerCase().trim();
        let targetBoard: Board | undefined;

        set(s => {
          const board = s.boards.find(b => b.id === boardId);
          if (!board) return s;
          const memberToRemove = board.members.find(m => m.email?.toLowerCase().trim() === email);
          const memberId = memberToRemove?.id;

          const updatedBoards = s.boards.map(b => {
            if (b.id !== boardId) return b;
            return {
              ...b,
              members: b.members.filter(m => m.email?.toLowerCase().trim() !== email),
              columns: b.columns.map(col => ({
                ...col,
                cards: col.cards.map(c => ({
                  ...c,
                  assignees: memberId ? c.assignees.filter(a => a !== memberId) : c.assignees
                }))
              }))
            };
          });

          targetBoard = updatedBoards.find(b => b.id === boardId);

          const visibleRemaining = updatedBoards.filter(b => 
            (b.createdBy && b.createdBy.toLowerCase().trim() === email) ||
            b.members.some(m => m.email && m.email.toLowerCase().trim() === email)
          );

          const activeBoardId = s.activeBoardId === boardId
            ? (visibleRemaining[0]?.id ?? null)
            : s.activeBoardId;

          return { boards: updatedBoards, activeBoardId };
        });

        if (targetBoard) {
          supabaseService.syncBoard(targetBoard);
        }
      },

      switchBoard: (boardId) => set({ activeBoardId: boardId }),

      // ── Column actions ─────────────────────────────────
      addColumn: (name) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const col: Column = { id: uid(), name, cards: [] };
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b, columns: [...b.columns, col],
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      deleteColumn: (colId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b, columns: b.columns.filter(c => c.id !== colId),
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      renameColumn: (colId, name) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b =>
            updateColumns(b, colId, c => ({ ...c, name }))
          );
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      addCard: (colId, title) => {
        const card: Card = {
          id: uid(), title,
          description: '', comments: [],
          attachments: [], labels: [],
          assignees: [], dueDate: null,
          completed: false, completedAt: null,
          createdAt: new Date().toISOString(),
        };
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b => b.columns?.some(c => c.id === colId)) || s.boards.find(b => b.id === s.activeBoardId);
          if (!tb) return s;
          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateColumns(b, colId, c => ({ ...c, cards: [...(c.cards || []), card] }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
        return card;
      },

      updateCard: (cardId, patch) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const extraPatch = 'dueDate' in patch ? {
            [`alerted24_${cardId}`]: false,
            [`alertedOD_${cardId}`]: false,
          } : {};

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({ ...c, ...patch, ...extraPatch }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      deleteCard: (cardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b => ({
            ...b,
            columns: b.columns.map(col => ({
              ...col, cards: (col.cards || []).filter(c => c.id !== cardId),
            })),
          }));
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      undoLastMove: () => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.lastMoveSnapshot || !s.activeBoardId) return s;
          const snapshot = s.lastMoveSnapshot;
          const updatedBoards = s.boards.map(b => b.id === s.activeBoardId ? snapshot : b);
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return {
            boards: updatedBoards,
            lastMoveSnapshot: null,
          };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      moveCard: (cardId, fromColId, toColId, afterCardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const currentBoard = s.boards.find(b => b.id === s.activeBoardId);
          const snapshot = currentBoard ? JSON.parse(JSON.stringify(currentBoard)) as Board : null;

          const updatedBoards = updateBoards(s.boards, s.activeBoardId, board => {
            const fromCol = board.columns.find(c => c.id === fromColId);
            if (!fromCol) return board;
            const cardIdx = fromCol.cards.findIndex(c => c.id === cardId);
            if (cardIdx === -1) return board;
            const sourceCard = fromCol.cards[cardIdx];
            const toCol = board.columns.find(c => c.id === toColId);

            const isDoneTarget = toCol?.name.trim().toLowerCase() === 'done';
            const isDoneSource = fromCol.name.trim().toLowerCase() === 'done';
            const isMovingColumns = fromColId !== toColId;
            let updatedCard = sourceCard;
            if (isMovingColumns) {
              if (isDoneTarget && !sourceCard.completed) {
                updatedCard = { ...sourceCard, completed: true, completedAt: new Date().toISOString() };
              } else if (!isDoneTarget && isDoneSource && sourceCard.completed) {
                updatedCard = { ...sourceCard, completed: false, completedAt: null };
              }
            }

            const newColumns = board.columns.map(col => {
              if (col.id === fromColId && col.id === toColId) {
                const cards = [...col.cards];
                cards.splice(cardIdx, 1);
                const afterIdx = afterCardId ? cards.findIndex(c => c.id === afterCardId) : -1;
                if (afterIdx === -1) cards.push(updatedCard);
                else cards.splice(afterIdx, 0, updatedCard);
                return { ...col, cards };
              }
              if (col.id === fromColId) {
                return { ...col, cards: col.cards.filter(c => c.id !== cardId) };
              }
              if (col.id === toColId) {
                const cards = [...col.cards];
                const afterIdx = afterCardId ? cards.findIndex(c => c.id === afterCardId) : -1;
                if (afterIdx === -1) cards.push(updatedCard);
                else cards.splice(afterIdx, 0, updatedCard);
                return { ...col, cards };
              }
              return col;
            });

            return { ...board, columns: newColumns };
          });

          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards, lastMoveSnapshot: snapshot };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      toggleCardComplete: (cardId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          let isNowComplete = false;
          let updatedTitle = '';
          let cardAssignees: string[] = [];

          const resultBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              isNowComplete = !c.completed;
              updatedTitle = c.title;
              cardAssignees = c.assignees || [];
              return {
                ...c,
                completed: isNowComplete,
                completedAt: isNowComplete ? new Date().toISOString() : null,
              };
            })
          );

          targetBoard = resultBoards.find(b => b.id === tb.id);

          const currentUser = useAuthStore.getState().user;
          cardAssignees.forEach(mId => {
            const member = tb.members?.find(m => m.id === mId);
            if (member && member.email) {
              if (member.email.toLowerCase().trim() !== currentUser?.email?.toLowerCase().trim()) {
                useNotifStore.getState().addNotification(
                  `Task ${isNowComplete ? 'Completed' : 'Reopened'}: ${updatedTitle}`,
                  `"${updatedTitle}" was marked as ${isNowComplete ? 'done' : 'incomplete'} on board "${tb.name}"`,
                  isNowComplete ? 'check' : 'clock',
                  cardId, tb.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `Status Update: ${updatedTitle} is ${isNowComplete ? 'Completed' : 'Reopened'}`,
                  body: `Hi ${member.name},\n\nThe task "${updatedTitle}" was marked as ${isNowComplete ? 'completed' : 'incomplete'} on board "${tb.name}".\n\nBest regards,\nWorklane Team`,
                  eventType: 'status_changed',
                });
              }
            }
          });

          return { boards: resultBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      toggleCardLabel: (cardId, labelId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              const current = c.labels || [];
              const labels = current.includes(labelId)
                ? current.filter(l => l !== labelId)
                : [...current, labelId];
              return { ...c, labels };
            })
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      toggleCardAssignee: (cardId, memberId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const member = tb.members?.find(m => m.id === memberId);
          let assignedCardTitle = '';
          let isAssigning = false;

          const result = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              assignedCardTitle = c.title;
              const currentAssignees = c.assignees || [];
              isAssigning = !currentAssignees.includes(memberId);
              const assignees = isAssigning
                ? [...currentAssignees, memberId]
                : currentAssignees.filter(a => a !== memberId);
              
              return { ...c, assignees };
            })
          );

          targetBoard = result.find(b => b.id === tb.id);

          if (isAssigning && member && member.email) {
            useNotifStore.getState().addNotification(
              `Assigned: ${assignedCardTitle}`,
              `You were assigned to "${assignedCardTitle}" on board "${tb.name}"`,
              'users', cardId, tb.id, member.email
            );
            useEmailStore.getState().sendEmailNotification({
              recipient: member,
              subject: `New Task Assigned: ${assignedCardTitle}`,
              body: `Hi ${member.name},\n\nYou have been assigned to the card "${assignedCardTitle}" on board "${tb.name}".\n\nBest regards,\nWorklane Team`,
              eventType: 'card_assigned',
            });
          }

          return { boards: result };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      // ── Attachment actions ────────────────────────────
      addAttachment: (cardId, att) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({
              ...c, attachments: [...(c.attachments || []), att],
            }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      removeAttachment: (cardId, attId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({
              ...c, attachments: (c.attachments || []).filter(a => a.id !== attId),
            }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      // ── Comment actions ───────────────────────────────
      addComment: (cardId, text) => {
        const currentUser = useAuthStore.getState().user;
        const authorName = (currentUser?.name && currentUser.name.trim()) ? currentUser.name : 'Me';
        const authorInitialsStr = avatarInitials(authorName);

        const comment: Comment = {
          id: uid(),
          author: authorName,
          authorInitials: authorInitialsStr,
          avatarColor: '#6366f1',
          text,
          createdAt: new Date().toISOString(),
        };

        let targetBoard: Board | undefined;

        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          let cardTitle = '';
          let cardAssignees: string[] = [];

          const resultBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => {
              cardTitle = c.title;
              cardAssignees = c.assignees || [];
              return { ...c, comments: [...(c.comments || []), comment] };
            })
          );

          targetBoard = resultBoards.find(b => b.id === tb.id);

          const lowerText = text.toLowerCase();
          const mentionedMembers = (tb.members || []).filter(m => {
            const nameMatch = m.name && lowerText.includes(`@${m.name.toLowerCase()}`);
            const emailMatch = m.email && lowerText.includes(`@${m.email.toLowerCase()}`);
            const firstWordMatch = m.name && lowerText.includes(`@${m.name.split(' ')[0].toLowerCase()}`);
            return nameMatch || emailMatch || firstWordMatch;
          });

          const notifiedEmails = new Set<string>();
          mentionedMembers.forEach(m => {
            if (m.email) {
              notifiedEmails.add(m.email.toLowerCase().trim());
              useNotifStore.getState().addNotification(
                `Mentioned: ${cardTitle}`,
                `${authorName} mentioned you in a comment on "${cardTitle}"`,
                'message', cardId, tb.id, m.email
              );
              useEmailStore.getState().sendEmailNotification({
                recipient: m,
                subject: `[Mention] ${authorName} mentioned you on "${cardTitle}"`,
                body: `Hi ${m.name},\n\n${authorName} mentioned you in a comment on card "${cardTitle}" in board "${tb.name}":\n\n"${text}"\n\nBest regards,\nWorklane Team`,
                eventType: 'mention',
              });
            }
          });

          cardAssignees.forEach(mId => {
            const member = tb.members?.find(m => m.id === mId);
            if (member && member.email) {
              const memEmail = member.email.toLowerCase().trim();
              const isAuthor = currentUser?.email && memEmail === currentUser.email.toLowerCase().trim();
              if (!isAuthor && !notifiedEmails.has(memEmail)) {
                notifiedEmails.add(memEmail);
                useNotifStore.getState().addNotification(
                  `New Comment: ${cardTitle}`,
                  `${authorName} commented on "${cardTitle}"`,
                  'message', cardId, tb.id, member.email
                );
                useEmailStore.getState().sendEmailNotification({
                  recipient: member,
                  subject: `New Comment on "${cardTitle}"`,
                  body: `Hi ${member.name},\n\n${authorName} commented on task "${cardTitle}" in board "${tb.name}":\n\n"${text}"\n\nBest regards,\nWorklane Team`,
                  eventType: 'comment_added',
                });
              }
            }
          });

          return { boards: resultBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      deleteComment: (cardId, commentId) => {
        let targetBoard: Board | undefined;
        set(s => {
          const tb = s.boards.find(b =>
            b.columns?.some(col => col.cards?.some(c => c.id === cardId))
          ) || s.boards.find(b => b.id === s.activeBoardId);

          if (!tb) return s;

          const updatedBoards = updateBoards(s.boards, tb.id, b =>
            updateCardInBoard(b, cardId, c => ({
              ...c, comments: (c.comments || []).filter(cm => cm.id !== commentId),
            }))
          );
          targetBoard = updatedBoards.find(b => b.id === tb.id);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      // ── Member actions ────────────────────────────────
      addMember: (name, email, avatarUrl) => {
        let newId: string | null = null;
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const cleanEmail = email ? email.toLowerCase().trim() : '';
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => {
            if (cleanEmail && b.members.some(m => m.email && m.email.toLowerCase().trim() === cleanEmail)) return b;
            const color = AVATAR_COLORS[b.members.length % AVATAR_COLORS.length];
            newId = uid();
            const newMember: Member = { id: newId!, name, email: cleanEmail, color, avatarUrl };
            return { ...b, members: [...b.members, newMember] };
          });
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) {
          supabaseService.syncBoard(targetBoard);
        }
        return newId;
      },

      updateMember: (memberId, patch) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b,
            members: b.members.map(m => m.id === memberId ? { ...m, ...patch } : m),
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },

      removeMember: (memberId) => {
        let targetBoard: Board | undefined;
        set(s => {
          if (!s.activeBoardId) return s;
          const updatedBoards = updateBoards(s.boards, s.activeBoardId, b => ({
            ...b,
            members: b.members.filter(m => m.id !== memberId),
            columns: b.columns.map(col => ({
              ...col,
              cards: col.cards.map(c => ({
                ...c, assignees: c.assignees.filter(a => a !== memberId),
              })),
            })),
          }));
          targetBoard = updatedBoards.find(b => b.id === s.activeBoardId);
          return { boards: updatedBoards };
        });
        if (targetBoard) supabaseService.syncBoard(targetBoard);
      },
    }),
    {
      name: 'worklane_data_v3',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.boards.length === 0) {
          const demo = buildDemoBoard();
          state.boards = [demo];
          state.activeBoardId = demo.id;
        }
      },
    }
  )
);
