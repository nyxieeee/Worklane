import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlignLeft, Paperclip, MessageSquare, Calendar, Tag, Users,
  Trash2, CheckSquare, Square, Download, X, Send, Plus, Check,
  Eye, Image as ImageIcon, Maximize2, AtSign, Reply, Sparkles,
  FileSpreadsheet, FileText, FileCode, FileArchive, File, Lock,
  Edit3, Crown, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { LABELS, type Attachment, type Comment } from '../types';
import { avatarInitials, formatBytes, formatTime, uid, truncateFileName } from '../utils';
import NeumorphicDatePicker from './ui/NeumorphicDatePicker';

interface Props {
  cardId: string | null;
  boardId: string | null;
  onClose: () => void;
}

function getFileTypeInfo(fileName: string, type: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return { tag: 'XLSX', color: '#10b981', bg: '#10b9811c', icon: FileSpreadsheet };
  }
  if (['pdf'].includes(ext)) {
    return { tag: 'PDF', color: '#ef4444', bg: '#ef44441c', icon: FileText };
  }
  if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext)) {
    return { tag: 'DOC', color: '#3b82f6', bg: '#3b82f61c', icon: FileText };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { tag: 'ZIP', color: '#f59e0b', bg: '#f59e0b1c', icon: FileArchive };
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'sql'].includes(ext)) {
    return { tag: ext.toUpperCase(), color: '#06b6d4', bg: '#06b6d41c', icon: FileCode };
  }
  if (type.startsWith('image/')) {
    return { tag: 'IMG', color: '#ec4899', bg: '#ec48991c', icon: ImageIcon };
  }
  return { tag: ext.toUpperCase() || 'FILE', color: '#6366f1', bg: '#6366f11c', icon: File };
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
  const showConfirm = useConfirmStore(s => s.showConfirm);
  const customLabels = useSettingsStore(s => s.customLabels);
  const addCustomLabel = useSettingsStore(s => s.addLabel);
  const currentUser = useAuthStore(s => s.user);

  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
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
      targetBoard = boards.find(b =>
        b.columns?.some(c => c.cards?.some(card => card.id === cardId)) ||
        (b.inboxCards || []).some(card => card.id === cardId)
      ) || null;
    }
    if (!targetBoard) return null;

    for (const column of targetBoard.columns || []) {
      const card = column.cards?.find(c => c.id === cardId);
      if (card) {
        return { card, column, board: targetBoard, isInbox: false };
      }
    }

    const inboxCard = (targetBoard.inboxCards || []).find(c => c.id === cardId);
    if (inboxCard) {
      return { card: inboxCard, column: null, board: targetBoard, isInbox: true };
    }

    return null;
  }, [boards, cardId, boardId]);

  if (!cardId || !result) return null;

  const { card, column, board, isInbox } = result;
  const members = board.members || [];
  const allLabels = [...LABELS, ...customLabels];

  const currentEmail = currentUser?.email?.toLowerCase().trim();
  const isOwner = !!(board.createdBy && currentEmail && board.createdBy.toLowerCase().trim() === currentEmail);
  const currentMemberObj = members.find(m => m.email && currentEmail && m.email.toLowerCase().trim() === currentEmail);
  const isAdmin = !isOwner && currentMemberObj?.role === 'admin';
  const canAssign = isOwner || isAdmin || !board.createdBy;

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
    showConfirm({
      title: `Delete "${card.title}"?`,
      message: `Are you sure you want to permanently delete this task and all its attachments and comments? This action cannot be undone.`,
      confirmText: 'Delete Task',
      variant: 'danger',
      icon: 'trash',
      onConfirm: () => {
        deleteCard(cardId);
        showToast('Task deleted', 'info');
        onClose();
      }
    });
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
      showToast(`Added ${addedCount} guide / attachment(s)`, 'success');
    }
    e.target.value = '';
  };

  const handlePostComment = () => {
    const text = commentText.trim();
    if (!text) return;
    addComment(cardId, text, null, null);
    setCommentText('');
    setShowMentionMenu(false);
    showToast('Comment posted', 'success');
  };

  const handlePostReply = (parentId: string, replyToAuthor: string) => {
    const text = replyText.trim();
    if (!text) return;
    addComment(cardId, text, parentId, replyToAuthor);
    setReplyText('');
    setReplyingTo(null);
    showToast('Reply posted', 'success');
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
    if (!text) return null;

    // Sort member names by length descending to match full multi-word names first (e.g. "John Enrico Santiago")
    const memberNames = members
      .map(m => m.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => b.length - a.length);

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Matches @FullName, @Email, or single @Word
    const mentionPattern = memberNames.length > 0
      ? new RegExp(`(@(?:${memberNames.map(escapeRegex).join('|')}|[^\\s@]+))`, 'gi')
      : /(@[^\s@]+)/g;

    const parts = text.split(mentionPattern);

    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        const potentialName = part.slice(1).trim().toLowerCase();
        const matched = members.find(m => {
          const mName = m.name?.toLowerCase().trim();
          const mEmail = m.email?.toLowerCase().trim();
          return mName === potentialName || mEmail === potentialName || (mName && potentialName.startsWith(mName));
        });

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
              in column: {column?.name || 'Inbox'}
            </span>
          </div>
          {!coverAttachment && (
            <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}>
              <X size={15} />
            </motion.button>
          )}
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, padding: '20px 28px 28px 28px' }}>
          {/* Main Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Title Field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 0' }}>
                <Edit3 size={13} /> Card Title
              </label>
              <textarea
                className="textarea-input"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  resize: 'none',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'hsl(var(--card))',
                  boxShadow: 'var(--neu-shadow-input)',
                  border: '1px solid hsl(var(--border) / 0.6)',
                  color: 'hsl(var(--foreground))',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  lineHeight: 1.4,
                  minHeight: 44,
                }}
                value={localTitle}
                rows={1}
                onChange={e => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="Enter card title..."
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

            {/* Task Guides & Attachments (Prominently Highlighted) */}
            <div
              className="form-group"
              style={{
                background: (card.attachments?.length > 0) ? 'hsl(var(--primary) / 0.04)' : 'transparent',
                border: (card.attachments?.length > 0) ? '1.5px solid hsl(var(--primary) / 0.35)' : '1px solid hsl(var(--border) / 0.6)',
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: (card.attachments?.length > 0) ? '0 4px 16px -4px hsl(var(--primary) / 0.12)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (card.attachments?.length > 0) ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="field-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--foreground))', fontWeight: 700 }}>
                    <Paperclip size={14} color="hsl(var(--primary))" /> Task Guides & Attachments ({card.attachments?.length || 0})
                  </label>
                  {card.attachments?.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'hsl(var(--primary) / 0.15)',
                        color: 'hsl(var(--primary))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Sparkles size={10} /> Essential Guide
                    </span>
                  )}
                </div>

                <label
                  className="btn btn-primary"
                  style={{ fontSize: 11.5, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={13} /> Add Guide / File
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
              </div>

              {card.attachments?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {card.attachments.map(att => {
                    const isImg = isImageAttachment(att);
                    const isCover = card.coverAttachmentId === att.id || (!card.coverAttachmentId && isImg && coverAttachment?.id === att.id);
                    const fileInfo = getFileTypeInfo(att.name, att.type);
                    const FileIcon = fileInfo.icon;

                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 10,
                          boxShadow: 'var(--neu-shadow-raised-sm)',
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        {/* Thumbnail or File Type Badge */}
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
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                              border: '1px solid hsl(var(--border) / 0.8)',
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
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              backgroundColor: fileInfo.bg,
                              color: fileInfo.color,
                              border: `1px solid ${fileInfo.color}33`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              gap: 2,
                            }}
                          >
                            <FileIcon size={18} />
                            <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase' }}>
                              {fileInfo.tag}
                            </span>
                          </div>
                        )}

                        {/* File Details */}
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: isImg ? 'pointer' : 'default',
                              color: 'hsl(var(--foreground))'
                            }}
                            title={att.name}
                            onClick={() => isImg && setPreviewAttachment(att)}
                          >
                            {truncateFileName(att.name, 36)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                            <span style={{ fontWeight: 600 }}>{formatBytes(att.size)}</span>
                            <span>•</span>
                            <span>{new Date(att.addedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            {isCover && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                                Cover
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons with prominent Download */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isImg && (
                            <>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                className="icon-btn"
                                style={{ width: 30, height: 30 }}
                                onClick={() => setPreviewAttachment(att)}
                                title="Preview Image"
                              >
                                <Eye size={14} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                className="icon-btn"
                                style={{ width: 30, height: 30, color: isCover ? 'hsl(var(--primary))' : undefined }}
                                onClick={() => updateCard(cardId, { coverAttachmentId: isCover ? null : att.id })}
                                title={isCover ? 'Remove Cover' : 'Make Cover'}
                              >
                                <ImageIcon size={14} />
                              </motion.button>
                            </>
                          )}
                          <a
                            href={att.dataUrl}
                            download={att.name}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'hsl(var(--primary))',
                              borderColor: 'hsl(var(--primary) / 0.3)',
                              textDecoration: 'none',
                            }}
                            title="Download Guide"
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </a>
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            className="icon-btn"
                            style={{ width: 30, height: 30, color: 'hsl(var(--destructive))' }}
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
              ) : null}
            </div>

            {/* Comments & Activity (Threaded Discussions) */}
            <div className="form-group" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={13} /> Activity & Discussion ({card.comments?.length || 0})
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

              {/* Threaded Comments List */}
              {card.comments?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {(() => {
                    const allComments = card.comments || [];
                    const rootComments = allComments.filter(c => !c.parentId);

                    return rootComments.map(c => {
                      const childReplies = allComments.filter(r => r.parentId === c.id);

                      return (
                        <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Root Comment Card */}
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              backgroundColor: 'hsl(var(--card))',
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                              border: '1px solid hsl(var(--border) / 0.6)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    backgroundColor: c.avatarColor || '#6366f1',
                                    color: '#fff',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {c.authorInitials || avatarInitials(c.author)}
                                </div>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                                  {c.author}
                                </span>
                                {(() => {
                                  const cMem = members.find(m => m.name.toLowerCase().trim() === c.author.toLowerCase().trim() || (m.email && m.email.toLowerCase().trim() === c.author.toLowerCase().trim()));
                                  const isOwn = !!(cMem?.email && board.createdBy && cMem.email.toLowerCase().trim() === board.createdBy.toLowerCase().trim());
                                  if (isOwn) {
                                    return (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Crown size={9} /> Owner
                                      </span>
                                    );
                                  }
                                  if (cMem?.role === 'admin') {
                                    return (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Shield size={9} /> Admin
                                      </span>
                                    );
                                  }
                                  if (cMem?.role === 'observer') {
                                    return (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Eye size={9} /> Observer
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                                {formatTime(c.createdAt)}
                              </span>
                            </div>

                            <p style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', lineHeight: 1.4, margin: '4px 0 6px 0' }}>
                              {renderCommentText(c.text)}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                              <motion.button
                                whileTap={{ scale: 0.94 }}
                                onClick={() => {
                                  setReplyingTo({ id: c.id, author: c.author } as Comment);
                                  setReplyText('');
                                }}
                                style={{
                                  background: 'hsl(var(--secondary))',
                                  border: '1px solid hsl(var(--border) / 0.8)',
                                  color: 'hsl(var(--primary))',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 9px',
                                  borderRadius: 6,
                                  boxShadow: 'var(--neu-shadow-raised-sm)',
                                }}
                                title={`Reply to @${c.author}`}
                              >
                                <Reply size={12} /> Reply
                              </motion.button>
                            </div>
                          </div>

                          {/* Nested Replies */}
                          {childReplies.length > 0 && (
                            <div
                              style={{
                                marginLeft: 20,
                                paddingLeft: 12,
                                borderLeft: '2px solid hsl(var(--primary) / 0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              {childReplies.map(reply => (
                                <div
                                  key={reply.id}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius)',
                                    backgroundColor: 'hsl(var(--card) / 0.8)',
                                    boxShadow: 'var(--neu-shadow-raised-sm)',
                                    border: '1px solid hsl(var(--border) / 0.5)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div
                                        style={{
                                          width: 18,
                                          height: 18,
                                          borderRadius: '50%',
                                          backgroundColor: reply.avatarColor || '#6366f1',
                                          color: '#fff',
                                          fontSize: 8,
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        {reply.authorInitials || avatarInitials(reply.author)}
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                                        {reply.author}
                                      </span>
                                      {(() => {
                                        const rMem = members.find(m => m.name.toLowerCase().trim() === reply.author.toLowerCase().trim() || (m.email && m.email.toLowerCase().trim() === reply.author.toLowerCase().trim()));
                                        const isROwn = !!(rMem?.email && board.createdBy && rMem.email.toLowerCase().trim() === board.createdBy.toLowerCase().trim());
                                        if (isROwn) {
                                          return (
                                            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 4px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                              <Crown size={8} /> Owner
                                            </span>
                                          );
                                        }
                                        if (rMem?.role === 'admin') {
                                          return (
                                            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 4px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                              <Shield size={8} /> Admin
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                      {reply.replyToAuthor && (
                                        <span style={{ fontSize: 10.5, color: 'hsl(var(--primary))' }}>
                                          → @{reply.replyToAuthor}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                                      {formatTime(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: 12, color: 'hsl(var(--foreground))', lineHeight: 1.35, margin: '2px 0 4px 0' }}>
                                    {renderCommentText(reply.text)}
                                  </p>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => {
                                        setReplyingTo({ id: c.id, author: reply.author } as Comment);
                                        setReplyText('');
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'hsl(var(--primary))',
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        padding: '1px 4px',
                                        borderRadius: 4,
                                      }}
                                      title={`Reply to @${reply.author}`}
                                    >
                                      <Reply size={10} /> Reply
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Reply Composer directly at the bottom of this comment thread */}
                          {replyingTo?.id === c.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              style={{
                                marginLeft: 20,
                                padding: '8px 12px',
                                borderRadius: 'var(--radius)',
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--primary) / 0.5)',
                                boxShadow: 'var(--neu-shadow-raised-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                  <Reply size={11} />
                                  <span>Replying to <strong>@{replyingTo.author}</strong></span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2 }}
                                  title="Cancel reply"
                                >
                                  <X size={12} />
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                  autoFocus
                                  type="text"
                                  className="text-input"
                                  placeholder={`Reply to @${replyingTo.author}...`}
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handlePostReply(c.id, replyingTo.author);
                                    } else if (e.key === 'Escape') {
                                      setReplyingTo(null);
                                      setReplyText('');
                                    }
                                  }}
                                  style={{ fontSize: 12, padding: '6px 10px' }}
                                />
                                <motion.button
                                  whileTap={replyText.trim() ? { scale: 0.94 } : undefined}
                                  className="btn btn-primary"
                                  onClick={() => handlePostReply(c.id, replyingTo.author)}
                                  disabled={!replyText.trim()}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    opacity: replyText.trim() ? 1 : 0.5,
                                    cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                                  }}
                                >
                                  <Send size={12} />
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    });
                  })()}
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
                whileTap={{ scale: 0.96 }}
                type="button"
                className={`btn ${card.completed ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'flex-start', cursor: 'pointer' }}
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
                      type="button"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: isSelected
                          ? 'var(--neu-shadow-pressed)'
                          : 'var(--neu-shadow-raised-sm)',
                        backgroundColor: isSelected ? l.color : 'hsl(var(--card))',
                        color: isSelected ? '#ffffff' : 'hsl(var(--foreground))',
                        cursor: 'pointer',
                        border: `1px solid ${isSelected ? l.color : 'hsl(var(--border) / 0.5)'}`,
                        boxSizing: 'border-box'
                      }}
                      onClick={() => toggleCardLabel(cardId, l.id)}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
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
                      </span>
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

            {/* Assignees (Owner & Admin Control) */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <Users size={12} /> Assignees
                </label>
                {!canAssign && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                    Owner & Admin only
                  </span>
                )}
              </div>

              {members.length === 0 ? (
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No members yet</span>
              ) : canAssign ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {members.map(m => {
                    const isCurrent = currentUser?.email && m.email?.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
                    const displayName = (isCurrent && currentUser?.name) ? currentUser.name : m.name;
                    const isAssigned = card.assignees?.includes(m.id);
                    const isMemberOwner = !!(board.createdBy && m.email && board.createdBy.toLowerCase().trim() === m.email.toLowerCase().trim());

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
                        {isMemberOwner ? (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Crown size={10} /> Owner
                          </span>
                        ) : m.role === 'admin' ? (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Shield size={10} /> Admin
                          </span>
                        ) : m.role === 'observer' ? (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Eye size={10} /> Observer
                          </span>
                        ) : null}
                        {isAssigned && <CheckSquare size={13} color="hsl(var(--primary))" />}
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                // Read-only assignee display for non-admins
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {card.assignees?.length > 0 ? (
                    card.assignees.map(mId => {
                      const m = members.find(mem => mem.id === mId);
                      if (!m) return null;
                      const isMemOwner = !!(board.createdBy && m.email && board.createdBy.toLowerCase().trim() === m.email.toLowerCase().trim());
                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'hsl(var(--card))',
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            border: '1px solid hsl(var(--border) / 0.5)',
                          }}
                        >
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} style={{ width: 20, height: 20, borderRadius: '50%' }} />
                          ) : (
                            <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {avatarInitials(m.name)}
                            </div>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))', flex: 1 }}>{m.name}</span>
                          {isMemOwner ? (
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Crown size={10} /> Owner
                            </span>
                          ) : m.role === 'admin' ? (
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Shield size={10} /> Admin
                            </span>
                          ) : m.role === 'observer' ? (
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Eye size={10} /> Observer
                            </span>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Unassigned</span>
                  )}
                  <div style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} /> Only the board owner or admins can assign team members.
                  </div>
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
