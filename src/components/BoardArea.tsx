import React, { useState, useMemo } from 'react';
import {
  Plus, Edit3, Trash2, Layout, Check, X,
  Calendar, CheckSquare, Square, Filter, ChevronRight, ChevronLeft, User
} from 'lucide-react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import Column from './Column';
import { formatDueDate, avatarInitials } from '../utils';
import { LABELS, type Member } from '../types';
import { sortColumnsByWorkflow } from '../store/useWorkStore';

interface DragState {
  cardId: string;
  fromColId: string;
}

interface ContextMenu {
  colId: string;
  x: number;
  y: number;
}

interface Props {
  viewMode: 'board' | 'list' | 'calendar';
  filterMemberId: string | null;
  onClearFilter: () => void;
  onOpenCard: (cardId: string) => void;
  onAddColumn: () => void;
  onCreateBoard: () => void;
}

const view3DVariants: Variants = {
  initial: { opacity: 0, rotateY: -6, translateZ: -30 },
  animate: { opacity: 1, rotateY: 0, translateZ: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, rotateY: 6, translateZ: -30, transition: { duration: 0.15 } }
};

export default function BoardArea({
  viewMode,
  filterMemberId,
  onClearFilter,
  onOpenCard,
  onAddColumn,
  onCreateBoard
}: Props) {
  const boards             = useWorkStore(s => s.boards);
  const activeBoardId      = useWorkStore(s => s.activeBoardId);
  const board              = useMemo(() => boards.find(b => b.id === activeBoardId) || null, [boards, activeBoardId]);
  const deleteColumn       = useWorkStore(s => s.deleteColumn);
  const renameColumn       = useWorkStore(s => s.renameColumn);
  const toggleCardComplete = useWorkStore(s => s.toggleCardComplete);
  const showToast          = useToastStore(s => s.showToast);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [renameColId, setRenameColId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Calendar navigation: tracks year+month offset from today
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());

  const goPrevMonth = () => {
    if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
    else setCalendarMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
    else setCalendarMonth(m => m + 1);
  };
  const goToday = () => { setCalendarYear(today.getFullYear()); setCalendarMonth(today.getMonth()); };

  // Build the full month grid (leading + current + trailing days to fill 7-col rows)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay  = new Date(calendarYear, calendarMonth + 1, 0);
    const leadingDays  = firstDay.getDay(); // 0=Sun
    const trailingDays = 6 - lastDay.getDay();
    const days: Date[] = [];
    for (let i = leadingDays; i > 0; i--) {
      days.push(new Date(calendarYear, calendarMonth, 1 - i));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(calendarYear, calendarMonth, d));
    }
    for (let i = 1; i <= trailingDays; i++) {
      days.push(new Date(calendarYear, calendarMonth + 1, i));
    }
    return days;
  }, [calendarYear, calendarMonth]);

  const handleRenameConfirm = () => {
    if (!renameColId || !renameValue.trim()) return;
    renameColumn(renameColId, renameValue.trim());
    setShowRenameModal(false);
    setRenameColId(null);
  };

  if (!board) {
    return (
      <div className="board-area" style={{ alignItems: 'center', justifyContent: 'center', perspective: 1000 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotateX: 10 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          style={{ textAlign: 'center', maxWidth: 420, padding: 36, borderRadius: 'var(--radius)', boxShadow: 'var(--neu-shadow-raised)', backgroundColor: 'hsl(var(--card))', transformStyle: 'preserve-3d' }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: 'hsl(var(--card))',
              color: 'hsl(var(--primary))',
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}
          >
            <Layout size={26} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 6 }}>
            Welcome to Worklane
          </h2>
          <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', lineHeight: 1.5, marginBottom: 20 }}>
            Create your first board from the sidebar or click below to organize your workspace.
          </p>
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onCreateBoard}>
            <Plus size={15} /> Create First Board
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Sort columns by fixed workflow order (Urgent first)
  const sortedColumns = sortColumnsByWorkflow(board.columns);

  // Filter columns and cards if filterMemberId is active
  const filteredColumns = sortedColumns.map(col => ({
    ...col,
    cards: filterMemberId
      ? col.cards.filter(c => (c.assignees || []).includes(filterMemberId))
      : col.cards
  }));

  // Compute which column is the "next" for a dragged card
  const getNextColId = (fromColId: string | null): string | null => {
    if (!fromColId) return null;
    const idx = sortedColumns.findIndex(c => c.id === fromColId);
    if (idx === -1 || idx >= sortedColumns.length - 1) return null;
    return sortedColumns[idx + 1].id;
  };
  const nextColId = dragState ? getNextColId(dragState.fromColId) : null;

  const activeMember = board.members?.find((m: Member) => m.id === filterMemberId);

  return (
    <div className="board-view-container" style={{ perspective: 1200 }}>
      {activeMember && (
        <div className="board-filter-banner">
          <div className="board-filter-left">
            <Filter size={13} color="hsl(var(--primary))" />
            <span>Showing tasks for <strong>{activeMember.name}</strong></span>
          </div>
          <button onClick={onClearFilter} className="filter-clear-btn-pill">
            <X size={12} /> Clear Filter
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {viewMode === 'list' && (
          <motion.div
            key="list-view"
            variants={view3DVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="list-view-container"
          >
            <div className="view-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>List View</span>
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)', padding: '2px 8px', borderRadius: 9999 }}>
                  {filteredColumns.reduce((sum, c) => sum + c.cards.length, 0)} tasks
                </span>
                {activeMember && (
                  <span className="filter-clear-btn-pill">
                    <User size={12} />
                    <span>Filtered: {activeMember.name}</span>
                    <button onClick={onClearFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={11} /></button>
                  </span>
                )}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={onAddColumn} style={{ fontSize: 12, padding: '6px 12px' }}>
                <Plus size={13} /> Add Row
              </motion.button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredColumns.map(col => (
                <div key={col.id} className="glass-list-group">
                  <div className="glass-list-group-header">
                    <span>{col.name}</span>
                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginLeft: 'auto' }}>
                      {col.cards.length}
                    </span>
                  </div>
                  {col.cards.length === 0 ? (
                    <div style={{ padding: '16px 14px', fontSize: 12.5, color: 'hsl(var(--muted-foreground))' }}>
                      No tasks in this row
                    </div>
                  ) : (
                    col.cards.map(card => {
                      const assignees = (card.assignees || []).map(id => board.members?.find((m: Member) => m.id === id)).filter(Boolean);
                      const labels = (card.labels || []).map(lid => LABELS.find(l => l.id === lid)).filter(Boolean);

                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ x: 3 }}
                          className="glass-list-row"
                          onClick={() => onOpenCard(card.id)}
                        >
                          <button
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: card.completed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                              display: 'flex'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardComplete(card.id);
                            }}
                          >
                            {card.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>

                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, textDecoration: card.completed ? 'line-through' : 'none', color: card.completed ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))' }}>
                              {card.title}
                            </span>
                            {card.description && (
                              <span style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                                {card.description}
                              </span>
                            )}
                          </div>

                          {labels.length > 0 && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {labels.map(l => l && (
                                <span
                                  key={l.id}
                                  className="card-label-badge"
                                  style={{ backgroundColor: `${l.color}15`, color: l.color }}
                                >
                                  {l.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {card.dueDate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                              <Calendar size={12} />
                              <span>{formatDueDate(card.dueDate)}</span>
                            </div>
                          )}

                          <div className="card-assignees">
                            {assignees.map(m => m && (
                              m.avatarUrl ? (
                                <img key={m.id} src={m.avatarUrl} alt={m.name} className="card-avatar" title={m.name} />
                              ) : (
                                <div key={m.id} className="card-avatar" style={{ backgroundColor: m.color }} title={m.name}>
                                  {avatarInitials(m.name)}
                                </div>
                              )
                            ))}
                          </div>

                          <ChevronRight size={15} color="hsl(var(--muted-foreground))" />
                        </motion.div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {viewMode === 'calendar' && (
          <motion.div
            key="calendar-view"
            variants={view3DVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="calendar-view-container"
          >
            <div className="view-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Calendar View</span>
                {activeMember && (
                  <span className="filter-clear-btn-pill">
                    <User size={12} />
                    <span>Filtered: {activeMember.name}</span>
                    <button onClick={onClearFilter} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={11} /></button>
                  </span>
                )}
              </div>
              {/* Month navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={goToday}
                  title="Jump to current month"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: (calendarYear === today.getFullYear() && calendarMonth === today.getMonth())
                      ? 'hsl(var(--muted-foreground))'
                      : 'hsl(var(--primary))',
                    padding: '4px 10px',
                    borderRadius: 9999,
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    opacity: (calendarYear === today.getFullYear() && calendarMonth === today.getMonth()) ? 0.7 : 1,
                  }}
                >
                  Today
                </motion.button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={goPrevMonth}
                    title="Previous month"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, boxShadow: 'var(--neu-shadow-raised-sm)', color: 'hsl(var(--foreground))' }}
                  >
                    <ChevronLeft size={15} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={goNextMonth}
                    title="Next month"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, boxShadow: 'var(--neu-shadow-raised-sm)', color: 'hsl(var(--foreground))' }}
                  >
                    <ChevronRight size={15} />
                  </motion.button>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 125, color: 'hsl(var(--foreground))' }}>
                  {new Date(calendarYear, calendarMonth).toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Day-of-week header row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0 10px', paddingBottom: 4 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textAlign: 'center', paddingBottom: 4 }}>{d}</div>
              ))}
            </div>

            <div className="glass-calendar-grid">
              {calendarDays.map((d, i) => {
                const isCurrentMonth = d.getMonth() === calendarMonth;
                const isToday = d.toDateString() === today.toDateString();
                const dateStr = d.toISOString().slice(0, 10);
                const dayCards = filteredColumns.flatMap(c => c.cards).filter(c => c.dueDate && c.dueDate.slice(0, 10) === dateStr);

                return (
                  <div key={i} className={`glass-calendar-day ${isToday ? 'is-today' : ''}`} style={{ opacity: isCurrentMonth ? 1 : 0.38 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isToday ? 'hsl(var(--primary))' : 'transparent',
                          color: isToday ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                          boxShadow: isToday ? 'var(--neu-shadow-raised-sm)' : 'none'
                        }}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
                      {dayCards.map(card => (
                        <motion.div
                          key={card.id}
                          whileHover={{ scale: 1.02, y: -1 }}
                          style={{
                            padding: '4px 7px',
                            borderRadius: 6,
                            backgroundColor: 'hsl(var(--card))',
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            textDecoration: card.completed ? 'line-through' : 'none',
                            opacity: card.completed ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          onClick={() => onOpenCard(card.id)}
                        >
                          {card.title}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {viewMode === 'board' && (
          <motion.div
            key="board-view"
            variants={view3DVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="board-area"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {filteredColumns.map((col, idx) => (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, y: 15, rotateY: -8, translateZ: -20 }}
                animate={{ opacity: 1, y: 0, rotateY: 0, translateZ: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.25, 1, 0.5, 1] }}
                style={{ height: '100%', transformStyle: 'preserve-3d' }}
              >
                <Column
                  col={col}
                  colIndex={idx}
                  dragState={dragState}
                  setDragState={setDragState}
                  onOpenCard={onOpenCard}
                  onStartRename={(colId, name) => {
                    setRenameColId(colId);
                    setRenameValue(name);
                    setShowRenameModal(true);
                  }}
                  isNextColumn={dragState !== null && col.id === nextColId}
                />
              </motion.div>
            ))}
            <motion.button whileTap={{ scale: 0.96 }} className="add-column-btn" onClick={onAddColumn}>
              <Plus size={15} /> Add Column
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Column Modal */}
      <AnimatePresence>
        {showRenameModal && (
          <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
              exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
              transition={{ duration: 0.2 }}
              className="modal small-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">Rename Column</h2>
                <button className="icon-btn" onClick={() => setShowRenameModal(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="field-label">New Column Name</label>
                  <input
                    type="text"
                    className="text-input"
                    maxLength={40}
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={() => setShowRenameModal(false)}>Cancel</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary" onClick={handleRenameConfirm}>
                  <Check size={14} /> Rename
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
