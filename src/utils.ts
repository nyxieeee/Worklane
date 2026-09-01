// ── Utility helpers ──────────────────────────────────────────────────────

export const uid = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function avatarInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString();
}

export function formatDueDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getDueStatus(iso: string | null): 'overdue' | 'due-soon' | 'ok' | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'overdue';
  if (diff < 86400000) return 'due-soon';
  return 'ok';
}

export function truncateFileName(name: string, maxLength: number = 28): string {
  if (!name || name.length <= maxLength) return name;
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot < name.length - 8) {
    return name.slice(0, maxLength - 3) + '...';
  }
  const ext = name.slice(lastDot);
  const base = name.slice(0, lastDot);
  const availableBase = maxLength - ext.length - 3;
  if (availableBase <= 4) return name.slice(0, maxLength - 3) + '...';
  const frontChars = Math.ceil(availableBase * 0.6);
  const backChars = Math.floor(availableBase * 0.4);
  return `${base.slice(0, frontChars)}...${base.slice(-backChars)}${ext}`;
}

export function fileIcon(name: string): string {
  const ext = (name || '').split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📊', pptx: '📊', txt: '📃', zip: '🗜️', rar: '🗜️',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mp3: '🎵', wav: '🎵',
    js: '💻', ts: '💻', py: '💻', html: '💻', css: '💻', json: '📋',
  };
  return map[ext] || '📁';
}

export function isImageFile(name: string): boolean {
  const ext = (name || '').split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
}
