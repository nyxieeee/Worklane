// ── Domain Types ──────────────────────────────────────────────────────

export interface Member {
  id: string;
  name: string;
  email: string;
  color: string;
  avatarUrl?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: string;
}

export interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  avatarColor: string;
  text: string;
  createdAt: string;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  comments: Comment[];
  attachments: Attachment[];
  labels: string[];
  assignees: string[];
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  coverAttachmentId?: string | null;
  // due-date alert flags
  [key: string]: unknown;
}

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  color: string;
  createdBy?: string; // email of the user who created this board
  members: Member[];
  columns: Column[];
}

export interface Notification {
  id: string;
  title: string;
  sub: string;
  icon: string;
  cardId: string | null;
  boardId: string | null;
  recipientEmail?: string | null;
  time: string;
}

export interface EmailNotificationLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'sent' | 'simulated' | 'failed';
  eventType: 'card_assigned' | 'status_changed' | 'due_reminder' | 'comment_added' | 'member_added' | 'mention';
}

export interface EmailSettings {
  enabled: boolean;
  notifyOnAssign: boolean;
  notifyOnDue: boolean;
  notifyOnStatusChange: boolean;
  notifyOnMention: boolean;
  senderEmail: string;
}

// ── Constants ──────────────────────────────────────────────────────────

export const BOARD_COLORS = [
  { name: 'Indigo',  value: '#6366f1' },
  { name: 'Purple',  value: '#a855f7' },
  { name: 'Pink',    value: '#ec4899' },
  { name: 'Rose',    value: '#f43f5e' },
  { name: 'Orange',  value: '#f97316' },
  { name: 'Amber',   value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal',    value: '#14b8a6' },
  { name: 'Sky',     value: '#0ea5e9' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Slate',   value: '#64748b' },
  { name: 'Zinc',    value: '#71717a' },
] as const;

export const AVATAR_COLORS = [
  '#6366f1','#a855f7','#ec4899','#f43f5e',
  '#f97316','#10b981','#14b8a6','#0ea5e9','#3b82f6',
] as const;

export const LABELS = [
  { id: 'bug',      name: 'Bug',      color: '#ef4444' },
  { id: 'feature',  name: 'Feature',  color: '#6366f1' },
  { id: 'design',   name: 'Design',   color: '#ec4899' },
  { id: 'backend',  name: 'Backend',  color: '#f97316' },
  { id: 'frontend', name: 'Frontend', color: '#0ea5e9' },
  { id: 'urgent',   name: 'Urgent',   color: '#f59e0b' },
  { id: 'done',     name: 'Done',     color: '#10b981' },
] as const;
