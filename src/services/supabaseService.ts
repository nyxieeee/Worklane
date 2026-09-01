import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Board, Column, Card, Comment, Attachment, Member, Notification } from '../types';

/**
 * Service to interact with Supabase database, storage, and notifications
 */
export const supabaseService = {
  /**
   * Check if Supabase is active
   */
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  /**
   * Upsert current user profile (with Google avatar URL & name)
   */
  async upsertProfile(user: { id: string; name?: string; email: string; avatarUrl?: string }): Promise<void> {
    if (!isSupabaseConfigured() || !user?.email) return;
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: user.name || user.email.split('@')[0],
        email: user.email.toLowerCase().trim(),
        avatar_url: user.avatarUrl || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('[SupabaseService] Error upserting profile:', err);
    }
  },

  /**
   * Fetch all boards for authenticated user, enriched with real member profile pictures
   */
  async getBoardsForUser(email: string): Promise<Board[]> {
    if (!isSupabaseConfigured() || !email) return [];

    try {
      const cleanEmail = email.toLowerCase().trim();

      // 1. Query boards table directly
      let { data: boardsData, error: boardsErr } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: true });

      // Fallback query if needed
      if ((!boardsData || boardsData.length === 0) && !boardsErr) {
        const { data: memberRows } = await supabase
          .from('board_members')
          .select('board_id')
          .ilike('email', cleanEmail);

        const memberBoardIds = (memberRows || []).map(r => r.board_id);
        if (memberBoardIds.length > 0) {
          const { data: explicitBoards } = await supabase
            .from('boards')
            .select('*')
            .or(`created_by.ilike.${cleanEmail},id.in.(${memberBoardIds.map(id => `"${id}"`).join(',')})`);
          boardsData = explicitBoards || [];
        } else {
          const { data: createdBoards } = await supabase
            .from('boards')
            .select('*')
            .ilike('created_by', cleanEmail);
          boardsData = createdBoards || [];
        }
      }

      if (boardsErr) {
        console.warn('[SupabaseService] getBoards error:', boardsErr);
        return [];
      }

      if (!boardsData || boardsData.length === 0) return [];

      const boardIds = boardsData.map(b => b.id);

      // 2. Fetch all members, columns, cards, and registered user profiles
      const [membersRes, colsRes, cardsRes, profilesRes] = await Promise.all([
        supabase.from('board_members').select('*').in('board_id', boardIds),
        supabase.from('columns').select('*').in('board_id', boardIds).order('position'),
        supabase.from('cards').select('*').in('board_id', boardIds).order('position'),
        supabase.from('profiles').select('email, name, avatar_url')
      ]);

      const allMembers = membersRes.data || [];
      const allCols = colsRes.data || [];
      const allCards = cardsRes.data || [];
      const allProfiles = profilesRes.data || [];
      const cardIds = allCards.map(c => c.id);

      // Map registered profiles by lowercase email for fast avatar lookup
      const profileMap = new Map<string, { name?: string; avatar_url?: string }>();
      allProfiles.forEach(p => {
        if (p.email) {
          profileMap.set(p.email.toLowerCase().trim(), p);
        }
      });

      // 3. Fetch card children
      let allAssignees: any[] = [];
      let allLabels: any[] = [];
      let allComments: any[] = [];
      let allAttachments: any[] = [];

      if (cardIds.length > 0) {
        const [assigneesRes, labelsRes, commentsRes, attachmentsRes] = await Promise.all([
          supabase.from('card_assignees').select('*').in('card_id', cardIds),
          supabase.from('card_labels').select('*').in('card_id', cardIds),
          supabase.from('comments').select('*').in('card_id', cardIds).order('created_at'),
          supabase.from('attachments').select('*').in('card_id', cardIds)
        ]);

        allAssignees = assigneesRes.data || [];
        allLabels = labelsRes.data || [];
        allComments = commentsRes.data || [];
        allAttachments = attachmentsRes.data || [];
      }

      // 4. Assemble domain Board structure
      const assembledBoards: Board[] = boardsData.map(b => {
        const bMembers: Member[] = allMembers
          .filter(m => m.board_id === b.id)
          .map(m => {
            const mCleanEmail = m.email ? m.email.toLowerCase().trim() : '';
            const realProfile = profileMap.get(mCleanEmail);

            return {
              id: m.id,
              name: realProfile?.name || m.name,
              email: m.email,
              color: m.color || '#6366f1',
              avatarUrl: realProfile?.avatar_url || m.avatar_url || undefined,
            };
          });

        const bColumns: Column[] = allCols
          .filter(c => c.board_id === b.id)
          .map(col => {
            const colCards: Card[] = allCards
              .filter(card => card.column_id === col.id)
              .map(card => {
                const cardAssigneeIds = allAssignees
                  .filter(a => a.card_id === card.id)
                  .map(a => a.member_id);

                const cardLabelIds = allLabels
                  .filter(l => l.card_id === card.id)
                  .map(l => l.label_id);

                const cardComments: Comment[] = allComments
                  .filter(cm => cm.card_id === card.id)
                  .map(cm => ({
                    id: cm.id,
                    author: cm.author,
                    authorInitials: cm.author_initials,
                    avatarColor: cm.avatar_color,
                    text: cm.text,
                    createdAt: cm.created_at,
                  }));

                const cardAtts: Attachment[] = allAttachments
                  .filter(att => att.card_id === card.id)
                  .map(att => ({
                    id: att.id,
                    name: att.name,
                    size: att.size,
                    type: att.type,
                    dataUrl: att.data_url || '',
                    addedAt: att.added_at,
                  }));

                return {
                  id: card.id,
                  title: card.title,
                  description: card.description || '',
                  priority: card.priority,
                  completed: card.completed,
                  completedAt: card.completed_at,
                  dueDate: card.due_date,
                  coverAttachmentId: card.cover_attachment_id,
                  createdAt: card.created_at,
                  assignees: cardAssigneeIds,
                  labels: cardLabelIds,
                  comments: cardComments,
                  attachments: cardAtts,
                };
              });

            return {
              id: col.id,
              name: col.name,
              cards: colCards,
            };
          });

        return {
          id: b.id,
          name: b.name,
          color: b.color,
          createdBy: b.created_by,
          members: bMembers,
          columns: bColumns,
        };
      });

      return assembledBoards;
    } catch (err) {
      console.warn('[SupabaseService] Error loading boards:', err);
      return [];
    }
  },

  /**
   * Save or update an entire board to Supabase
   */
  async syncBoard(board: Board): Promise<boolean> {
    if (!isSupabaseConfigured() || !board?.id) return false;

    try {
      // 1. Upsert Board
      const { error: bErr } = await supabase.from('boards').upsert({
        id: board.id,
        name: board.name,
        color: board.color,
        created_by: board.createdBy || 'unknown',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (bErr) {
        console.error('[SupabaseService] Error syncing board table:', bErr);
        return false;
      }

      // 2. Upsert Members
      if (board.members && board.members.length > 0) {
        const memberRows = board.members.map(m => ({
          id: m.id,
          board_id: board.id,
          name: m.name,
          email: m.email.toLowerCase().trim(),
          color: m.color,
          avatar_url: m.avatarUrl || null,
        }));
        const { error: mErr } = await supabase.from('board_members').upsert(memberRows, { onConflict: 'board_id,email' });
        if (mErr) console.warn('[SupabaseService] Member upsert warning:', mErr);
      }

      // Clean up removed members
      const currentMemberIds = (board.members || []).map(m => m.id);
      if (currentMemberIds.length > 0) {
        await supabase
          .from('board_members')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentMemberIds.map(id => `"${id}"`).join(',')})`);
      }

      // 3. Upsert Columns
      const currentColIds = (board.columns || []).map(c => c.id);
      if (board.columns?.length > 0) {
        const colRows = board.columns.map((c, idx) => ({
          id: c.id,
          board_id: board.id,
          name: c.name,
          position: idx,
        }));
        await supabase.from('columns').upsert(colRows, { onConflict: 'id' });
      }
      if (currentColIds.length > 0) {
        await supabase
          .from('columns')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentColIds.map(id => `"${id}"`).join(',')})`);
      }

      // 4. Upsert Cards
      const currentCardIds: string[] = [];
      for (const col of board.columns || []) {
        if (!col.cards?.length) continue;

        for (let cIdx = 0; cIdx < col.cards.length; cIdx++) {
          const card = col.cards[cIdx];
          currentCardIds.push(card.id);

          await supabase.from('cards').upsert({
            id: card.id,
            board_id: board.id,
            column_id: col.id,
            title: card.title,
            description: card.description || '',
            priority: card.priority || 'medium',
            completed: !!card.completed,
            completed_at: card.completedAt || null,
            due_date: card.dueDate || null,
            cover_attachment_id: card.coverAttachmentId || null,
            position: cIdx,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

          // Card Assignees
          if (card.assignees && card.assignees.length > 0) {
            const assRows = card.assignees.map(mId => ({
              card_id: card.id,
              member_id: mId,
            }));
            await supabase.from('card_assignees').upsert(assRows, { onConflict: 'card_id,member_id' });
            await supabase
              .from('card_assignees')
              .delete()
              .eq('card_id', card.id)
              .not('member_id', 'in', `(${card.assignees.map(id => `"${id}"`).join(',')})`);
          } else {
            await supabase.from('card_assignees').delete().eq('card_id', card.id);
          }

          // Card Labels
          if (card.labels && card.labels.length > 0) {
            const lblRows = card.labels.map(lId => ({
              card_id: card.id,
              label_id: lId,
            }));
            await supabase.from('card_labels').upsert(lblRows, { onConflict: 'card_id,label_id' });
            await supabase
              .from('card_labels')
              .delete()
              .eq('card_id', card.id)
              .not('label_id', 'in', `(${card.labels.map(id => `"${id}"`).join(',')})`);
          } else {
            await supabase.from('card_labels').delete().eq('card_id', card.id);
          }

          // Card Comments
          if (card.comments?.length) {
            const cmRows = card.comments.map(cm => ({
              id: cm.id,
              card_id: card.id,
              author: cm.author,
              author_initials: cm.authorInitials,
              avatar_color: cm.avatarColor,
              text: cm.text,
              created_at: cm.createdAt,
            }));
            await supabase.from('comments').upsert(cmRows, { onConflict: 'id' });
          }

          // Card Attachments
          if (card.attachments?.length) {
            const attRows = card.attachments.map(att => ({
              id: att.id,
              card_id: card.id,
              name: att.name,
              size: att.size,
              type: att.type,
              data_url: att.dataUrl,
              added_at: att.addedAt,
            }));
            await supabase.from('attachments').upsert(attRows, { onConflict: 'id' });
          }
        }
      }

      // Delete removed cards
      if (currentCardIds.length > 0) {
        await supabase
          .from('cards')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentCardIds.map(id => `"${id}"`).join(',')})`);
      } else if (board.columns?.length > 0) {
        await supabase.from('cards').delete().eq('board_id', board.id);
      }

      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error syncing board:', err);
      return false;
    }
  },

  /**
   * Directly add a single member to a board in Supabase
   */
  async addMember(boardId: string, member: Member): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId || !member?.email) return false;
    try {
      const cleanEmail = member.email.toLowerCase().trim();

      // Look up if user already has a real avatar registered in profiles
      const { data: prof } = await supabase
        .from('profiles')
        .select('avatar_url, name')
        .ilike('email', cleanEmail)
        .maybeSingle();

      const finalAvatar = prof?.avatar_url || member.avatarUrl || null;
      const finalName = prof?.name || member.name;

      const { error } = await supabase.from('board_members').upsert({
        id: member.id,
        board_id: boardId,
        name: finalName,
        email: cleanEmail,
        color: member.color,
        avatar_url: finalAvatar,
      }, { onConflict: 'board_id,email' });

      if (error) {
        console.error('[SupabaseService] Error adding member directly:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseService] Exception adding member directly:', err);
      return false;
    }
  },

  /**
   * Delete a board from Supabase
   */
  async deleteBoard(boardId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId) return false;
    try {
      const { error } = await supabase.from('boards').delete().eq('id', boardId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error deleting board:', err);
      return false;
    }
  },

  /**
   * Cloud Notifications: Push a notification to Supabase for the recipient
   */
  async createNotification(notif: Notification): Promise<boolean> {
    if (!isSupabaseConfigured() || !notif.recipientEmail) return false;
    try {
      const { error } = await supabase.from('notifications').insert({
        id: notif.id,
        recipient_email: notif.recipientEmail.toLowerCase().trim(),
        title: notif.title,
        sub: notif.sub,
        icon: notif.icon || 'bell',
        card_id: notif.cardId || null,
        board_id: notif.boardId || null,
        time: notif.time || new Date().toISOString(),
        is_read: false,
      });
      if (error) {
        console.warn('[SupabaseService] Notification insert error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Notification insert exception:', err);
      return false;
    }
  },

  /**
   * Cloud Notifications: Fetch notifications for this user from Supabase
   */
  async getNotificationsForUser(email: string): Promise<Notification[]> {
    if (!isSupabaseConfigured() || !email) return [];
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .ilike('recipient_email', email.toLowerCase().trim())
        .order('time', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        title: r.title,
        sub: r.sub,
        icon: r.icon,
        cardId: r.card_id,
        boardId: r.board_id,
        recipientEmail: r.recipient_email,
        time: r.time,
      }));
    } catch (err) {
      console.warn('[SupabaseService] Error fetching notifications:', err);
      return [];
    }
  },

  /**
   * Cloud Notifications: Clear all notifications for user
   */
  async clearNotifications(email: string): Promise<void> {
    if (!isSupabaseConfigured() || !email) return;
    try {
      await supabase.from('notifications').delete().ilike('recipient_email', email.toLowerCase().trim());
    } catch (err) {
      console.warn('[SupabaseService] Error clearing notifications:', err);
    }
  },

  /**
   * Upload file to Supabase Storage bucket
   */
  async uploadAttachment(file: File, path: string, expiresInSeconds: number = 60 * 60 * 24 * 7): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const { error } = await supabase.storage.from('attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;

      const { data, error: signErr } = await supabase.storage
        .from('attachments')
        .createSignedUrl(path, expiresInSeconds);

      if (signErr) throw signErr;
      return data?.signedUrl || null;
    } catch (err) {
      console.warn('[SupabaseService] Error uploading attachment:', err);
      return null;
    }
  },

  /**
   * Generate a signed URL for an existing private attachment path
   */
  async getSignedAttachmentUrl(path: string, expiresInSeconds: number = 3600): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(path, expiresInSeconds);

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (err) {
      console.warn('[SupabaseService] Error creating signed URL:', err);
      return null;
    }
  },

  /**
   * Subscribe to realtime database changes (boards, cards, columns, notifications)
   */
  subscribeToAll(userEmail: string, onBoardsChange: () => void, onNotifsChange: () => void) {
    if (!isSupabaseConfigured()) return () => {};

    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';

    const channel = supabase
      .channel(`realtime-sync-${cleanEmail || 'anon'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boards' },
        () => onBoardsChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_members' },
        () => onBoardsChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns' },
        () => onBoardsChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        () => onBoardsChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => onBoardsChange()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new && (!cleanEmail || payload.new.recipient_email?.toLowerCase().trim() === cleanEmail)) {
            onNotifsChange();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
