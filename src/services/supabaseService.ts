import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Board, Column, Card, Comment, Attachment, Member, MemberRole, Notification } from '../types';
import { uid } from '../utils';

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
   * Upsert current user profile (with avatar URL & name), and propagate to board_members
   */
  async upsertProfile(user: { id?: string; name?: string; email: string; avatarUrl?: string }): Promise<boolean> {
    if (!isSupabaseConfigured() || !user?.email) return false;
    try {
      const cleanEmail = user.email.toLowerCase().trim();
      const profileRow: any = {
        name: user.name || cleanEmail.split('@')[0],
        email: cleanEmail,
        avatar_url: user.avatarUrl || null,
        updated_at: new Date().toISOString(),
      };
      if (user.id) profileRow.id = user.id;

      const { error } = await supabase.from('profiles').upsert(profileRow, { onConflict: 'email' });
      if (error) {
        console.warn('[SupabaseService] Upsert profile warning:', error);
      }

      // Also propagate avatar_url across all board_members records for this user
      if (user.avatarUrl || user.name) {
        const updates: any = {};
        if (user.avatarUrl) updates.avatar_url = user.avatarUrl;
        if (user.name) updates.name = user.name;
        await supabase.from('board_members').update(updates).ilike('email', cleanEmail);
      }

      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error upserting profile:', err);
      return false;
    }
  },

  /**
   * Fetch all boards for authenticated user, enriched with real member profile pictures
   */
  async getBoardsForUser(email: string): Promise<Board[]> {
    if (!isSupabaseConfigured() || !email) return [];

    try {
      const cleanEmail = email.toLowerCase().trim();

      // 1. Find all board IDs where user is enrolled as a collaborator
      const { data: memberRows, error: memberErr } = await supabase
        .from('board_members')
        .select('board_id')
        .ilike('email', cleanEmail);

      if (memberErr) {
        console.warn('[SupabaseService] Error finding member boards:', memberErr);
      }

      const memberBoardIds = (memberRows || []).map(r => r.board_id).filter(Boolean);

      // 2. Fetch created boards and member boards reliably in parallel
      const boardQueries = [
        supabase.from('boards').select('*').ilike('created_by', cleanEmail),
      ];
      if (memberBoardIds.length > 0) {
        boardQueries.push(
          supabase.from('boards').select('*').in('id', memberBoardIds)
        );
      }

      const boardResults = await Promise.all(boardQueries);
      const boardsMap = new Map<string, any>();
      for (const res of boardResults) {
        if (res.data) {
          res.data.forEach(b => boardsMap.set(b.id, b));
        }
      }

      const boardsData = Array.from(boardsMap.values());
      if (boardsData.length === 0) return [];

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
              role: (m.role as MemberRole) || 'member',
            };
          });

        const mapDbCardToCard = (card: any): Card => {
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
              parentId: cm.parent_id || null,
              replyToAuthor: cm.reply_to_author || null,
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
            isInbox: !!card.is_inbox,
            assignees: cardAssigneeIds,
            labels: cardLabelIds,
            comments: cardComments,
            attachments: cardAtts,
          };
        };

        let bColumns: Column[] = allCols
          .filter(c => c.board_id === b.id)
          .map(col => {
            const colCards: Card[] = allCards
              .filter(card => card.column_id === col.id && !card.is_inbox)
              .map(mapDbCardToCard);

            return {
              id: col.id,
              name: col.name,
              cards: colCards,
            };
          });

        if (bColumns.length === 0) {
          bColumns = [
            { id: uid(), name: 'Urgent',      cards: [] },
            { id: uid(), name: 'To Do',       cards: [] },
            { id: uid(), name: 'In Progress', cards: [] },
            { id: uid(), name: 'Review',      cards: [] },
            { id: uid(), name: 'Done',        cards: [] },
          ];
        }

        const bInboxCards: Card[] = allCards
          .filter(card => card.board_id === b.id && card.is_inbox)
          .map(mapDbCardToCard);

        return {
          id: b.id,
          name: b.name,
          color: b.color,
          createdBy: b.created_by,
          members: bMembers,
          columns: bColumns,
          inboxCards: bInboxCards,
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
          role: m.role || 'member',
        }));
        const { error: mErr } = await supabase.from('board_members').upsert(memberRows, { onConflict: 'board_id,email' });
        if (mErr) console.warn('[SupabaseService] Member upsert warning:', mErr);
      }

      // Clean up removed members
      const currentMemberIds = (board.members || []).map(m => m.id).filter(Boolean);
      if (currentMemberIds.length > 0) {
        await supabase
          .from('board_members')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentMemberIds.join(',')})`);
      }

      // 3. Upsert Columns
      const currentColIds = (board.columns || []).map(c => c.id).filter(Boolean);
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
          .not('id', 'in', `(${currentColIds.join(',')})`);
      }

      // 4. Upsert Cards (both regular column cards and inbox cards)
      const currentCardIds: string[] = [];

      const syncSingleCard = async (card: Card, columnId: string | null, position: number, isInbox: boolean) => {
        currentCardIds.push(card.id);

        await supabase.from('cards').upsert({
          id: card.id,
          board_id: board.id,
          column_id: columnId,
          title: card.title,
          description: card.description || '',
          priority: card.priority || 'medium',
          completed: !!card.completed,
          completed_at: card.completedAt || null,
          due_date: card.dueDate || null,
          cover_attachment_id: card.coverAttachmentId || null,
          position,
          is_inbox: isInbox,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        // Card Assignees
        const validAssigneeIds = (card.assignees || []).filter(Boolean);
        if (validAssigneeIds.length > 0) {
          const assRows = validAssigneeIds.map(mId => ({
            card_id: card.id,
            member_id: mId,
          }));
          await supabase.from('card_assignees').upsert(assRows, { onConflict: 'card_id,member_id' });
          await supabase
            .from('card_assignees')
            .delete()
            .eq('card_id', card.id)
            .not('member_id', 'in', `(${validAssigneeIds.join(',')})`);
        } else {
          await supabase.from('card_assignees').delete().eq('card_id', card.id);
        }

        // Card Labels
        const validLabelIds = (card.labels || []).filter(Boolean);
        if (validLabelIds.length > 0) {
          const lblRows = validLabelIds.map(lId => ({
            card_id: card.id,
            label_id: lId,
          }));
          await supabase.from('card_labels').upsert(lblRows, { onConflict: 'card_id,label_id' });
          await supabase
            .from('card_labels')
            .delete()
            .eq('card_id', card.id)
            .not('label_id', 'in', `(${validLabelIds.join(',')})`);
        } else {
          await supabase.from('card_labels').delete().eq('card_id', card.id);
        }

        // Card Comments & Replies
        if (card.comments?.length) {
          // 1. First upsert parent / root comments
          const rootComments = card.comments
            .filter(cm => !cm.parentId)
            .map(cm => ({
              id: cm.id,
              card_id: card.id,
              parent_id: null,
              reply_to_author: null,
              author: cm.author,
              author_initials: cm.authorInitials || 'U',
              avatar_color: cm.avatarColor || '#6366f1',
              text: cm.text,
              created_at: cm.createdAt || new Date().toISOString(),
            }));
          if (rootComments.length > 0) {
            const { error: rErr } = await supabase.from('comments').upsert(rootComments, { onConflict: 'id' });
            if (rErr) console.warn('[SupabaseService] Root comments upsert warning:', rErr);
          }

          // 2. Second upsert replies with parent_id
          const replies = card.comments
            .filter(cm => cm.parentId)
            .map(cm => ({
              id: cm.id,
              card_id: card.id,
              parent_id: cm.parentId,
              reply_to_author: cm.replyToAuthor || null,
              author: cm.author,
              author_initials: cm.authorInitials || 'U',
              avatar_color: cm.avatarColor || '#6366f1',
              text: cm.text,
              created_at: cm.createdAt || new Date().toISOString(),
            }));
          if (replies.length > 0) {
            const { error: repErr } = await supabase.from('comments').upsert(replies, { onConflict: 'id' });
            if (repErr) console.warn('[SupabaseService] Replies upsert warning:', repErr);
          }

          const currentCmIds = card.comments.map(c => c.id).filter(Boolean);
          if (currentCmIds.length > 0) {
            await supabase.from('comments').delete().eq('card_id', card.id).not('id', 'in', `(${currentCmIds.join(',')})`);
          }
        } else {
          await supabase.from('comments').delete().eq('card_id', card.id);
        }

        // Card Attachments
        if (card.attachments?.length) {
          const attRows = card.attachments.map(att => ({
            id: att.id,
            card_id: card.id,
            name: att.name,
            size: att.size || 0,
            type: att.type || 'application/octet-stream',
            data_url: att.dataUrl || '',
            added_at: att.addedAt || new Date().toISOString(),
          }));
          const { error: attErr } = await supabase.from('attachments').upsert(attRows, { onConflict: 'id' });
          if (attErr) console.warn('[SupabaseService] Attachments upsert warning:', attErr);

          const currentAttIds = card.attachments.map(a => a.id).filter(Boolean);
          if (currentAttIds.length > 0) {
            await supabase.from('attachments').delete().eq('card_id', card.id).not('id', 'in', `(${currentAttIds.join(',')})`);
          }
        } else {
          await supabase.from('attachments').delete().eq('card_id', card.id);
        }
      };

      // Sync Column Cards
      for (const col of board.columns || []) {
        if (!col.cards?.length) continue;
        for (let cIdx = 0; cIdx < col.cards.length; cIdx++) {
          await syncSingleCard(col.cards[cIdx], col.id, cIdx, false);
        }
      }

      // Sync Inbox Cards
      if (board.inboxCards?.length) {
        for (let iIdx = 0; iIdx < board.inboxCards.length; iIdx++) {
          await syncSingleCard(board.inboxCards[iIdx], null, iIdx, true);
        }
      }

      // Delete removed cards
      if (currentCardIds.length > 0) {
        await supabase
          .from('cards')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentCardIds.join(',')})`);
      } else if (board.columns?.length > 0 || board.inboxCards?.length) {
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
        role: member.role || 'member',
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
   * Search registered Supabase profiles by name or email
   */
  async searchRegisteredProfiles(query: string): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string }>> {
    if (!isSupabaseConfigured() || !query.trim()) return [];
    try {
      const q = `%${query.trim().toLowerCase()}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .or(`name.ilike.${q},email.ilike.${q}`)
        .limit(10);

      if (error) {
        console.warn('[SupabaseService] Search profiles error:', error);
        return [];
      }

      return (data || []).map(p => ({
        id: p.id,
        name: p.name || p.email.split('@')[0],
        email: p.email,
        avatarUrl: p.avatar_url || undefined,
      }));
    } catch (err) {
      console.warn('[SupabaseService] Exception searching profiles:', err);
      return [];
    }
  },

  /**
   * Fetch board metadata for invite acceptance page
   */
  async getBoardMetadata(boardId: string): Promise<{ id: string; name: string; color: string; createdBy: string; memberCount: number } | null> {
    if (!isSupabaseConfigured() || !boardId) return null;
    try {
      const { data: boardData, error: boardErr } = await supabase
        .from('boards')
        .select('id, name, color, created_by')
        .eq('id', boardId)
        .maybeSingle();

      if (boardErr || !boardData) {
        console.warn('[SupabaseService] Error getting board metadata:', boardErr);
        return null;
      }

      const { count } = await supabase
        .from('board_members')
        .select('id', { count: 'exact', head: true })
        .eq('board_id', boardId);

      return {
        id: boardData.id,
        name: boardData.name,
        color: boardData.color,
        createdBy: boardData.created_by,
        memberCount: count || 1,
      };
    } catch (err) {
      console.warn('[SupabaseService] Exception getting board metadata:', err);
      return null;
    }
  },

  /**
   * Delete or deactivate user account, removing their profile, board memberships, and notifications
   */
  async deleteAccount(user: { id: string; email: string }): Promise<boolean> {
    if (!isSupabaseConfigured() || !user?.email) return true;
    try {
      const cleanEmail = user.email.toLowerCase().trim();

      // 1. Fetch user's board_members rows to get their IDs for card assignee cleanup
      try {
        const { data: userMembers } = await supabase
          .from('board_members')
          .select('id, board_id')
          .ilike('email', cleanEmail);

        if (userMembers && userMembers.length > 0) {
          const memberIds = userMembers.map(m => m.id);
          // Delete from card_assignees
          await supabase
            .from('card_assignees')
            .delete()
            .in('member_id', memberIds);

          // Delete from board_members
          await supabase
            .from('board_members')
            .delete()
            .in('id', memberIds);
        }
      } catch (mErr) {
        console.warn('[SupabaseService] Member purge warning:', mErr);
      }

      // Delete any remaining board_members with this email
      await supabase
        .from('board_members')
        .delete()
        .ilike('email', cleanEmail);

      // Delete from notifications
      await supabase
        .from('notifications')
        .delete()
        .ilike('recipient_email', cleanEmail);

      // Delete from profiles
      if (user.id && !user.id.startsWith('user_') && !user.id.startsWith('goog_')) {
        await supabase
          .from('profiles')
          .delete()
          .eq('id', user.id);
      } else {
        await supabase
          .from('profiles')
          .delete()
          .ilike('email', cleanEmail);
      }

      // Try RPC if defined
      try {
        await supabase.rpc('delete_user_account');
      } catch {}

      // Sign out auth session
      await supabase.auth.signOut();
      return true;
    } catch (err) {
      console.error('[SupabaseService] Error deleting account:', err);
      return false;
    }
  },

  /**
   * Fetch all registered profiles (useful for initial picker)
   */
  async getAllRegisteredProfiles(): Promise<Array<{ id: string; name: string; email: string; avatarUrl?: string }>> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .order('name', { ascending: true })
        .limit(50);

      if (error) {
        console.warn('[SupabaseService] Get all profiles error:', error);
        return [];
      }

      return (data || []).map(p => ({
        id: p.id,
        name: p.name || p.email.split('@')[0],
        email: p.email,
        avatarUrl: p.avatar_url || undefined,
      }));
    } catch (err) {
      console.warn('[SupabaseService] Exception getting profiles:', err);
      return [];
    }
  },

  /**
   * Update member role in Supabase
   */
  async updateMemberRole(boardId: string, memberId: string, role: MemberRole): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId || !memberId) return false;
    try {
      const { error } = await supabase
        .from('board_members')
        .update({ role })
        .eq('board_id', boardId)
        .eq('id', memberId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error updating member role:', err);
      return false;
    }
  },

  /**
   * Delete a member from a board in Supabase
   */
  async removeMemberFromBoard(boardId: string, email?: string, memberId?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId) return false;
    try {
      if (memberId) {
        // 1. Remove from card assignees on this board
        await supabase
          .from('card_assignees')
          .delete()
          .eq('board_id', boardId)
          .eq('member_id', memberId);

        // 2. Remove from board members
        await supabase
          .from('board_members')
          .delete()
          .eq('board_id', boardId)
          .eq('id', memberId);
      }

      if (email) {
        const cleanEmail = email.toLowerCase().trim();
        // Query any matching member IDs for assignee cleanup
        const { data: rows } = await supabase
          .from('board_members')
          .select('id')
          .eq('board_id', boardId)
          .ilike('email', cleanEmail);

        if (rows && rows.length > 0) {
          const ids = rows.map(r => r.id);
          await supabase
            .from('card_assignees')
            .delete()
            .eq('board_id', boardId)
            .in('member_id', ids);

          await supabase
            .from('board_members')
            .delete()
            .eq('board_id', boardId)
            .in('id', ids);
        }

        await supabase
          .from('board_members')
          .delete()
          .eq('board_id', boardId)
          .ilike('email', cleanEmail);
      }
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error removing board member:', err);
      return false;
    }
  },

  /**
   * Delete a board from Supabase (cascades cleanly through all child tables)
   */
  async deleteBoard(boardId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId) return false;
    try {
      // 1. Delete associated children explicitly first (failsafe for foreign keys)
      await supabase.from('card_assignees').delete().eq('board_id', boardId);
      await supabase.from('card_labels').delete().eq('board_id', boardId);
      await supabase.from('comments').delete().eq('board_id', boardId);
      await supabase.from('attachments').delete().eq('board_id', boardId);
      await supabase.from('cards').delete().eq('board_id', boardId);
      await supabase.from('columns').delete().eq('board_id', boardId);
      await supabase.from('board_members').delete().eq('board_id', boardId);
      await supabase.from('custom_labels').delete().eq('board_id', boardId);

      // 2. Delete the board itself
      const { error } = await supabase.from('boards').delete().eq('id', boardId);
      if (error) {
        console.error('[SupabaseService] Error deleting board:', error);
        throw error;
      }
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
