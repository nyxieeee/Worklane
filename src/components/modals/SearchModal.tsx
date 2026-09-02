import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Calendar, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useAuthStore } from '../../store/useAuthStore';
import { formatDueDate } from '../../utils';
import { LABELS, type Card } from '../../types';

interface Props {
  onClose: () => void;
  onOpenCard: (cardId: string, boardId: string) => void;
}

export default function SearchModal({ onClose, onOpenCard }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const allBoards = useWorkStore(s => s.boards);
  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const user = useAuthStore(s => s.user);
  const boards = getVisibleBoards(user?.email);
  const activeBoardId = useWorkStore(s => s.activeBoardId);
  const switchBoard = useWorkStore(s => s.switchBoard);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = query.trim().toLowerCase();
  const results: Array<{ card: Card; colName: string; boardId: string; boardName: string }> = [];

  if (trimmed) {
    boards.forEach(b => {
      b.columns?.forEach(col => {
        col.cards?.forEach(card => {
          const matchTitle = card.title.toLowerCase().includes(trimmed);
          const matchDesc = card.description?.toLowerCase().includes(trimmed);
          const matchLabels = (card.labels || []).some(l => {
            const lbl = LABELS.find(x => x.id === l);
            return lbl?.name.toLowerCase().includes(trimmed);
          });
          const matchAssignees = (card.assignees || []).some(mId => {
            const m = b.members?.find(mem => mem.id === mId);
            return m?.name.toLowerCase().includes(trimmed) || m?.email.toLowerCase().includes(trimmed);
          });

          if (matchTitle || matchDesc || matchLabels || matchAssignees) {
            results.push({ card, colName: col.name, boardId: b.id, boardName: b.name });
          }
        });
      });
    });
  }

  const handleSelectCard = (cardId: string, boardId: string) => {
    if (boardId !== activeBoardId) {
      switchBoard(boardId);
    }
    onOpenCard(cardId, boardId);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{ maxWidth: 580, maxHeight: '80vh', transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 10 }}>
          <Search size={16} color="hsl(var(--muted-foreground))" />
          <input
            ref={inputRef}
            type="text"
            className="text-input"
            style={{
              flex: 1,
              fontSize: 14,
              color: 'hsl(var(--foreground))'
            }}
            placeholder="Search tasks, descriptions, labels..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && results.length > 0) {
                handleSelectCard(results[0].card.id, results[0].boardId);
              }
            }}
          />
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>

        <div className="modal-body" style={{ padding: 14 }}>
          {!trimmed ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Type to search across all boards...
              </div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ fontSize: 13 }}>No matches found for "{query}"</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.map(({ card, colName, boardId, boardName }) => (
                <motion.div
                  key={card.id}
                  whileTap={{ scale: 0.98 }}
                  className="sidebar-nav-item"
                  style={{ padding: '10px 14px', alignItems: 'flex-start', boxShadow: 'var(--neu-shadow-raised-sm)', backgroundColor: 'hsl(var(--card))' }}
                  onClick={() => handleSelectCard(card.id, boardId)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', color: 'hsl(var(--muted-foreground))' }}>
                        {boardName}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                        in {colName}
                      </span>
                      {card.dueDate && (
                        <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Calendar size={10} />
                          {formatDueDate(card.dueDate)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                      {card.title}
                    </div>
                    {card.description && (
                      <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {card.description}
                      </div>
                    )}
                  </div>
                  <ArrowRight size={13} style={{ marginTop: 4 }} color="hsl(var(--muted-foreground))" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
