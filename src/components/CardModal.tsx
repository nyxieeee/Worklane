import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlignLeft, Paperclip, MessageSquare, Calendar, Tag, Users,
  Trash2, CheckSquare, Square, Download, X, Send, Plus, Check,
  Eye, Image as ImageIcon, Maximize2, AtSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { LABELS, type Attachment } from '../types';
import { avatarInitials, formatBytes, formatTime, uid, truncateFileName } from '../utils';
import NeumorphicDatePicker from './ui/NeumorphicDatePicker';

interface Props {
  cardId: string | null;
  boardId: string | null;
  onClose: () => void;
}

export default function CardModal({ cardId, boardId, onClose }: Props) {
  const boards = useWorkStore(s => s.boards);
  const updateCard = useWorkStore(s => s.updateCard);
  const deleteCard = useWorkStore(s => s.deleteCard);
  const toggleCardComplete = useWorkStore(s => s.toggleCardComplete);
  const toggleCardLabel = useWorkStore(s => s.toggleCardLabel);
  const toggleCardAssignee = useWorkStore(s => s.toggleCardAssignee);
  const addAttachment = useWorkStore(s => s.addAttachment);
  const removeAttachment = useWorkStore(s => s.removeAttachment);
  const addComment = useWorkStore(s => s.addComment);
  const showToast = useToastStore(s => s.showToast);
  const customLabels = useSettingsStore(s => s.customLabels);
  const addCustomLabel = useSettingsStore(s => s.addLabel);

  const [commentText, setCommentText] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor] = useState('#3b82f6');
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    if (!cardId) return null;
    let targetBoard = boardId ? boards.find(b => b.id === boardId) : null;
    if (!targetBoard) {
      targetBoard = boards.find(b => b.columns?.some(c => c.cards?.some(card => card.id === cardId))) || null;
    }
    if (!targetBoard) return null;

    for (const column of targetBoard.columns || []) {
      const card = column.cards?.find(c => c.id === cardId);
      if (card) {
        return { card, column, board: targetBoard };
      }
    }
    return null;
  }, [boards, cardId, boardId]);

  if (!cardId || !result) return null;

  const { card, column, board } = result;
  const members = board.members || [];
  const allLabels = [...LABELS, ...customLabels];

  // ── Local title state ──
  const [localTitle, setLocalTitle] = useState(card.title);
  useEffect(() => { setLocalTitle(card.title); }, [card.title]);

  const handleTitleBlur = () => {
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== card.title) updateCard(cardId, { title: trimmed });
    else if (!trimmed) setLocalTitle(card.title);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateCard(cardId, { description: e.target.value });
  };

  const handleDeleteCard = () => {
    showToast(
      `Delete task "${card.title}" permanently?`,
      'warning',
      6000,
      {
        label: 'Delete Task',
        variant: 'danger',
        onClick: () => {
          deleteCard(cardId);
          showToast('Task deleted', 'info');
          onClose();
        }
      }
    );
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = [...(e.target.files ?? [])];
    if (!rawFiles.length) return;

    let addedCount = 0;
    rawFiles.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        showToast(`"${file.name}" exceeds the maximum allowed size of 5 MB`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = ev => {
        addAttachment(cardId, {
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: (ev.target?.result as string) ?? '',
          addedAt: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
      addedCount++;
    });

    if (addedCount > 0) {
      showToast(`Added ${addedCount} attachment(s)`, 'success');
    }
    e.target.value = '';
  };

  const handlePostComment = () => {
    const text = commentText.trim();
    if (!text) return;
    addComment(cardId, text);
    setCommentText('');
    setShowMentionMenu(false);
    showToast('Comment posted', 'success');
  };

  const filteredMentionMembers = useMemo(() => {
    if (!members.length) return [];
    if (!mentionQuery) return members;
    const q = mentionQuery.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q))
    );
  }, [members, mentionQuery]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!query.includes('\n') && query.length <= 20) {
        setMentionQuery(query);
        setShowMentionMenu(true);
        setSelectedMentionIdx(0);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectMention = (member: { name: string; email?: string }) => {
    const val = commentText;
    const cursorPos = commentInputRef.current?.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    const textAfterCursor = val.slice(cursorPos);
    const newTextBefore = lastAtIdx !== -1 ? textBeforeCursor.slice(0, lastAtIdx) : textBeforeCursor;
    const newComment = `${newTextBefore}@${member.name} ${textAfterCursor}`;
    setCommentText(newComment);
    setShowMentionMenu(false);

    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        const nextPos = (newTextBefore + `@${member.name} `).length;
        commentInputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionMenu && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(i => (i + 1) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(i => (i - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = filteredMentionMembers[selectedMentionIdx] || filteredMentionMembers[0];
        if (chosen) handleSelectMention(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      handlePostComment();
    }
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@[^\s@]+(?:\s[^\s@]+)?)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        const potentialName = part.slice(1).trim().toLowerCase();
        const matched = members.find(m =>
          m.name.toLowerCase().startsWith(potentialName) ||
          potentialName.startsWith(m.name.toLowerCase()) ||
          (m.email && m.email.toLowerCase().startsWith(potentialName))
        );
        if (matched) {
          return (
            <span
              key={idx}
              style={{
                color: 'hsl(var(--primary))',
                backgroundColor: 'hsl(var(--primary) / 0.14)',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                margin: '0 2px'
              }}
              title={matched.email || matched.name}
            >
              <AtSign size={10} />
              {matched.name}
            </span>
          );
        }
      }
      return part;
    });
  };

  const isImageAttachment = (att: { type?: string; dataUrl?: string; name?: string }) => {
    return (
      att.type?.startsWith('image/') ||
      att.dataUrl?.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(att.name || '')
    );
  };

  const coverAttachment = card.attachments?.find(a =>
    card.coverAttachmentId ? a.id === card.coverAttachmentId : isImageAttachment(a)
  );

  return (
    <>
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -60 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -60 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="modal large-modal"
        style={{ transformStyle: 'preserve-3d', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cover Image Banner (Trello style) */}
        {coverAttachment && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 180,
              backgroundColor: 'hsl(var(--secondary))',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            <img
              src={coverAttachment.dataUrl}
              alt={coverAttachment.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                cursor: 'pointer'
              }}
              onClick={() => setPreviewAttachment(coverAttachment)}
              title="Click to view full image"
            />
            {/* Top Close Button over cover */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              className="icon-btn"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                color: '#fff',
                backdropFilter: 'blur(6px)',
                border: 'none',
                width: 28,
                height: 28
              }}
              onClick={onClose}
            >
              <X size={15} />
            </motion.button>

            {/* Bottom Actions over cover */}
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 12,
                display: 'flex',
                gap: 6
              }}
            >
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="btn btn-secondary"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#fff',
                  backdropFilter: 'blur(6px)',
                  border: 'none'
                }}
                onClick={() => setPreviewAttachment(coverAttachment)}
              >
                <Eye size={13} /> Preview
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="btn btn-secondary"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#fff',
                  backdropFilter: 'blur(6px)',
                  border: 'none'
                }}
                onClick={() => updateCard(cardId, { coverAttachmentId: card.coverAttachmentId === coverAttachment.id ? null : coverAttachment.id })}
              >
                <ImageIcon size={13} /> {card.coverAttachmentId === coverAttachment.id ? 'Remove Cover' : 'Cover'}
              </motion.button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              in column: {column.name}
            </span>
          </div>
          {!coverAttachment && (
            <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}>
              <X size={15} />
            </motion.button>
          )}
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28, padding: '20px 28px 28px 28px' }}>
          {/* Main Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Title Field */}
            <div>
              <textarea
                className="textarea-input"
                style={{ fontSize: 16, fontWeight: 600, resize: 'none', border: 'none', background: 'transparent', padding: '4px 0', outline: 'none', boxShadow: 'none' }}
                value={localTitle}
                rows={1}
                onChange={e => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Card Title"
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlignLeft size={13} /> Description
              </label>
              <textarea
                className="textarea-input"
                rows={4}
                value={card.description || ''}
                onChange={handleDescriptionChange}
                placeholder="Add a detailed description..."
              />
            </div>

            {/* Attachments */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Paperclip size={13} /> Attachments ({card.attachments?.length || 0})
                </label>
                <label
                  className="btn btn-secondary"
                  style={{ fontSize: 11.5, padding: '3px 8px', cursor: 'pointer' }}
                >
                  <Plus size={12} /> Add File
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
              </div>

              {card.attachments?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {card.attachments.map(att => {
                    const isImg = isImageAttachment(att);
                    const isCover = card.coverAttachmentId === att.id || (!card.coverAttachmentId && isImg && coverAttachment?.id === att.id);

                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius)',
                          boxShadow: 'var(--neu-shadow-raised-sm)',
                          backgroundColor: 'hsl(var(--card))'
                        }}
                      >
                        {/* Thumbnail or File Badge */}
                        {isImg ? (
                          <div
                            style={{
                              width: 80,
                              height: 56,
                              borderRadius: 8,
                              overflow: 'hidden',
                              backgroundColor: 'hsl(var(--secondary))',
                              cursor: 'pointer',
                              flexShrink: 0,
                              boxShadow: 'var(--neu-shadow-raised-sm)'
                            }}
                            onClick={() => setPreviewAttachment(att)}
                            title="Click to preview full image"
                          >
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 8,
                              backgroundColor: 'hsl(var(--secondary))',
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              color: 'hsl(var(--muted-foreground))'
                            }}
                          >
                            <Paperclip size={16} />
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                              {att.name.split('.').pop()?.slice(0, 4) || 'FILE'}
                            </span>
                          </div>
                        )}

                        {/* File Details */}
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: isImg ? 'pointer' : 'default',
                              color: 'hsl(var(--foreground))'
                            }}
                            title={att.name}
                            onClick={() => isImg && setPreviewAttachment(att)}
                          >
                            {truncateFileName(att.name, 32)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                            <span>{formatBytes(att.size)}</span>
                            <span>•</span>
                            <span>{new Date(att.addedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            {isCover && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                                Cover
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isImg && (
                            <>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                className="icon-btn"
                                style={{ width: 26, height: 26 }}
                                onClick={() => setPreviewAttachment(att)}
                                title="Preview Image"
                              >
                                <Eye size={13} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                className="icon-btn"
                                style={{ width: 26, height: 26, color: isCover ? 'hsl(var(--primary))' : undefined }}
                                onClick={() => updateCard(cardId, { coverAttachmentId: isCover ? null : att.id })}
                                title={isCover ? 'Remove Cover' : 'Make Cover'}
                              >
                                <ImageIcon size={13} />
                              </motion.button>
                            </>
                          )}
                          <a
                            href={att.dataUrl}
                            download={att.name}
                            className="icon-btn"
                            style={{ width: 26, height: 26 }}
                            title="Download"
                          >
                            <Download size={13} />
                          </a>
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            className="icon-btn"
                            style={{ width: 26, height: 26, color: 'hsl(var(--destructive))' }}
                            onClick={() => removeAttachment(cardId, att.id)}
                            title="Delete Attachment"
                          >
                            <Trash2 size={13} />
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="form-group" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={13} /> Activity & Comments
                </label>
                {members.length > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '2px 8px', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => {
                      setCommentText(prev => prev + (prev && !prev.endsWith(' ') ? ' @' : '@'));
                      setShowMentionMenu(true);
                      setMentionQuery('');
                      commentInputRef.current?.focus();
                    }}
                  >
                    <AtSign size={12} /> Mention
                  </motion.button>
                )}
              </div>

              {/* Mention Autocomplete Dropdown */}
              <AnimatePresence>
                {showMentionMenu && filteredMentionMembers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      marginBottom: 8,
                      width: 280,
                      maxHeight: 200,
                      overflowY: 'auto',
                      backgroundColor: 'hsl(var(--popover))',
                      borderRadius: 12,
                      boxShadow: 'var(--neu-shadow-floating)',
                      border: '1px solid hsl(var(--border) / 0.6)',
                      padding: 6,
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    <div style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em' }}>
                      Mention a member
                    </div>
                    {filteredMentionMembers.map((m, idx) => {
                      const isSelected = idx === selectedMentionIdx;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
                          style={{
                            padding: '6px 8px',
                            fontSize: 12,
                            borderRadius: 8,
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            textAlign: 'left',
                            backgroundColor: isSelected ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                            color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          onMouseDown={e => {
                            e.preventDefault();
                            handleSelectMention(m);
                          }}
                        >
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%' }} />
                          ) : (
                            <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: m.color || '#6366f1', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {avatarInitials(m.name)}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.name}
                            </span>
                            {m.email && (
                              <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.email}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={commentInputRef}
                  type="text"
                  className="text-input"
                  placeholder="Write a comment or type @ to mention..."
                  value={commentText}
                  onChange={handleCommentChange}
                  onKeyDown={handleCommentKeyDown}
                  onBlur={() => setTimeout(() => setShowMentionMenu(false), 200)}
                />
                <motion.button
                  whileTap={commentText.trim() ? { scale: 0.92 } : undefined}
                  className="btn btn-primary"
                  onClick={handlePostComment}
                  title="Post Comment"
                  disabled={!commentText.trim()}
                  style={{
                    opacity: commentText.trim() ? 1 : 0.5,
                    cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Send size={13} />
                </motion.button>
              </div>

              {card.comments?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {card.comments.map(c => (
                    <div
                      key={c.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'hsl(var(--card))',
                        boxShadow: 'var(--neu-shadow-raised-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                          {c.author}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                          {formatTime(c.createdAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', lineHeight: 1.4, margin: 0 }}>
                        {renderCommentText(c.text)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 18, borderLeft: '1px solid hsl(var(--border) / 0.4)' }}>
            {/* Status Button */}
            <div className="form-group">
              <label className="field-label">Status</label>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className={`btn ${card.completed ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => toggleCardComplete(cardId)}
              >
                {card.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{card.completed ? 'Completed' : 'Mark as Done'}</span>
              </motion.button>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} /> Due Date & Time
              </label>
              <NeumorphicDatePicker
                value={card.dueDate}
                onChange={newDue => {
                  updateCard(cardId, { dueDate: newDue });
                }}
              />
            </div>

            {/* Labels */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={12} /> Labels
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allLabels.map(l => {
                  const isSelected = (card.labels || []).includes(l.id);
                  return (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.04 }}
                      key={l.id}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: isSelected
                          ? 'var(--neu-shadow-pressed)'
                          : 'var(--neu-shadow-raised-sm)',
                        backgroundColor: isSelected ? l.color : 'hsl(var(--card))',
                        color: isSelected ? '#ffffff' : 'hsl(var(--foreground))',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: isSelected ? `1px solid ${l.color}` : '1px solid transparent'
                      }}
                      onClick={() => toggleCardLabel(cardId, l.id)}
                    >
                      {isSelected ? (
                        <Check size={11} strokeWidth={3} />
                      ) : (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            backgroundColor: l.color,
                            flexShrink: 0
                          }}
                        />
                      )}
                      <span>{l.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {showNewLabel ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="New label name"
                    value={newLabelName}
                    onChange={e => setNewLabelName(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <motion.button
                      whileTap={newLabelName.trim() ? { scale: 0.95 } : undefined}
                      className="btn btn-primary"
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        opacity: newLabelName.trim() ? 1 : 0.5,
                        cursor: newLabelName.trim() ? 'pointer' : 'not-allowed',
                      }}
                      disabled={!newLabelName.trim()}
                      onClick={() => {
                        if (!newLabelName.trim()) return;
                        addCustomLabel(newLabelName.trim(), newLabelColor);
                        setNewLabelName('');
                        setShowNewLabel(false);
                      }}
                    >
                      Save
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => setShowNewLabel(false)}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, justifyContent: 'flex-start', padding: '2px 4px' }}
                  onClick={() => setShowNewLabel(true)}
                >
                  <Plus size={12} /> New Label
                </motion.button>
              )}
            </div>

            {/* Assignees */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={12} /> Assignees
              </label>
              {members.length === 0 ? (
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No members yet</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {members.map(m => {
                    const currentUser = useAuthStore.getState().user;
                    const isCurrent = currentUser?.email && m.email?.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
                    const displayName = (isCurrent && currentUser?.name) ? currentUser.name : m.name;
                    const isAssigned = card.assignees?.includes(m.id);

                    return (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        key={m.id}
                        className={`sidebar-nav-item ${isAssigned ? 'active' : ''}`}
                        style={{ padding: '6px 8px', fontSize: 12 }}
                        onClick={() => toggleCardAssignee(cardId, m.id)}
                      >
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt={displayName} style={{ width: 18, height: 18, borderRadius: '50%' }} />
                        ) : (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {avatarInitials(displayName)}
                          </div>
                        )}
                        <span style={{ flex: 1, textAlign: 'left' }}>{displayName}</span>
                        {isAssigned && <CheckSquare size={13} color="hsl(var(--primary))" />}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Delete Card */}
            <div style={{ marginTop: 'auto', paddingTop: 14 }}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="btn btn-secondary"
                style={{ width: '100%', color: 'hsl(var(--destructive))' }}
                onClick={handleDeleteCard}
              >
                <Trash2 size={13} /> Delete Card
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Fullscreen Lightbox Image Preview */}
    <AnimatePresence>
      {previewAttachment && (
        <div
          className="modal-overlay"
          style={{ zIndex: 200, backgroundColor: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(10px)', padding: 24 }}
          onClick={() => setPreviewAttachment(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#fff', padding: '0 4px' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 450 }}>
                {previewAttachment.name} ({formatBytes(previewAttachment.size)})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '5px 12px', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}
                >
                  <Download size={13} /> Download
                </a>
                <button
                  className="icon-btn"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none', width: 30, height: 30 }}
                  onClick={() => setPreviewAttachment(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.name}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 12,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
