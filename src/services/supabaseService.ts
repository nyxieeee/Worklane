import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Board, Column, Card, Comment, Attachment, Member, MemberRole, Notification } from '../types';
import { uid, sortMembersWithOwnerFirst } from '../utils';

// Active WebSocket channel reference for instant peer broadcasting
let activeRealtimeChannel: any = null;

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
        const bMembers: Member[] = sortMembersWithOwnerFirst(
          allMembers
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
            }),
          b.created_by
        );

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

      // 4. Batch Upsert Cards (both regular column cards and inbox cards)
      const allCardsWithMeta: Array<{ card: Card; colId: string | null; pos: number; isInbox: boolean }> = [];
      for (const col of board.columns || []) {
        (col.cards || []).forEach((c, idx) => {
          allCardsWithMeta.push({ card: c, colId: col.id, pos: idx, isInbox: false });
        });
      }
      (board.inboxCards || []).forEach((c, idx) => {
        allCardsWithMeta.push({ card: c, colId: null, pos: idx, isInbox: true });
      });

      const currentCardIds = allCardsWithMeta.map(item => item.card.id).filter(Boolean);

      if (allCardsWithMeta.length > 0) {
        const cardRows = allCardsWithMeta.map(item => ({
          id: item.card.id,
          board_id: board.id,
          column_id: item.colId,
          title: item.card.title,
          description: item.card.description || '',
          priority: item.card.priority || 'medium',
          completed: !!item.card.completed,
          completed_at: item.card.completedAt || null,
          due_date: item.card.dueDate || null,
          cover_attachment_id: item.card.coverAttachmentId || null,
          position: item.pos,
          is_inbox: item.isInbox,
          updated_at: new Date().toISOString(),
        }));

        await supabase.from('cards').upsert(cardRows, { onConflict: 'id' });

        // Batch Assignees
        const assigneeRows: any[] = [];
        allCardsWithMeta.forEach(item => {
          (item.card.assignees || []).filter(Boolean).forEach(mId => {
            assigneeRows.push({ card_id: item.card.id, member_id: mId });
          });
        });
        if (currentCardIds.length > 0) {
          await supabase.from('card_assignees').delete().in('card_id', currentCardIds);
          if (assigneeRows.length > 0) {
            await supabase.from('card_assignees').upsert(assigneeRows, { onConflict: 'card_id,member_id' });
          }
        }

        // Batch Labels
        const labelRows: any[] = [];
        allCardsWithMeta.forEach(item => {
          (item.card.labels || []).filter(Boolean).forEach(lId => {
            labelRows.push({ card_id: item.card.id, label_id: lId });
          });
        });
        if (currentCardIds.length > 0) {
          await supabase.from('card_labels').delete().in('card_id', currentCardIds);
          if (labelRows.length > 0) {
            await supabase.from('card_labels').upsert(labelRows, { onConflict: 'card_id,label_id' });
          }
        }

        // Batch Comments
        const allComments: any[] = [];
        allCardsWithMeta.forEach(item => {
          (item.card.comments || []).forEach(cm => {
            allComments.push({
              id: cm.id,
              card_id: item.card.id,
              parent_id: cm.parentId || null,
              reply_to_author: cm.replyToAuthor || null,
              author: cm.author,
              author_initials: cm.authorInitials || 'U',
              avatar_color: cm.avatarColor || '#6366f1',
              text: cm.text,
              created_at: cm.createdAt || new Date().toISOString(),
            });
          });
        });
        if (allComments.length > 0) {
          const parents = allComments.filter(c => !c.parent_id);
          const replies = allComments.filter(c => c.parent_id);
          if (parents.length > 0) await supabase.from('comments').upsert(parents, { onConflict: 'id' });
          if (replies.length > 0) await supabase.from('comments').upsert(replies, { onConflict: 'id' });
        }

        // Batch Attachments
        const allAtts: any[] = [];
        allCardsWithMeta.forEach(item => {
          (item.card.attachments || []).forEach(att => {
            allAtts.push({
              id: att.id,
              card_id: item.card.id,
              name: att.name,
              size: att.size || 0,
              type: att.type || 'application/octet-stream',
              data_url: att.dataUrl || '',
              added_at: att.addedAt || new Date().toISOString(),
            });
          });
        });
        if (allAtts.length > 0) {
          await supabase.from('attachments').upsert(allAtts, { onConflict: 'id' });
        }

        // Clean up removed attachments for existing cards
        const allAttIds = allAtts.map(a => a.id).filter(Boolean);
        if (currentCardIds.length > 0) {
          if (allAttIds.length > 0) {
            await supabase
              .from('attachments')
              .delete()
              .in('card_id', currentCardIds)
              .not('id', 'in', `(${allAttIds.join(',')})`);
          } else {
            await supabase
              .from('attachments')
              .delete()
              .in('card_id', currentCardIds);
          }
        }
      }

      // Delete orphaned cards (cards that were removed from the board)
      if (currentCardIds.length > 0) {
        await supabase
          .from('cards')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentCardIds.join(',')})`);
      }

      // Broadcast instant update to all connected clients
      this.broadcastUpdate('boards', { boardId: board.id });

      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error syncing board:', err);
      return false;
    }
  },

  /**
   * Broadcast an instant realtime update to all connected clients (sub-50ms sync)
   */
  async broadcastUpdate(event: 'boards' | 'notifications' | 'labels', meta?: any) {
    if (!isSupabaseConfigured()) return;
    try {
      const payload = { ...meta, timestamp: Date.now() };
      // If our persistent WebSocket connection is active, send over WebSocket for instant delivery
      if (activeRealtimeChannel && activeRealtimeChannel.state === 'joined') {
        await activeRealtimeChannel.send({
          type: 'broadcast',
          event,
          payload,
        });
        return;
      }

      const channel = supabase.channel('worklane-realtime-channel');
      await channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    } catch (e) {
      // Non-blocking
    }
  },

  /**
   * Directly add a single member to a board in Supabase
   */
  async addMember(boardId: string, member: Member, userId?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId || !member?.email) return false;
    try {
      const cleanEmail = member.email.toLowerCase().trim();

      // Look up if user already has a real avatar or registered user_id in profiles
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, avatar_url, name')
        .ilike('email', cleanEmail)
        .maybeSingle();

      const finalAvatar = prof?.avatar_url || member.avatarUrl || null;
      const finalName = prof?.name || member.name;
      const finalUserId = userId || prof?.id || null;

      const memberPayload: any = {
        id: member.id,
        board_id: boardId,
        name: finalName,
        email: cleanEmail,
        color: member.color,
        avatar_url: finalAvatar,
        role: member.role || 'member',
      };
      if (finalUserId) {
        memberPayload.user_id = finalUserId;
      }

      const { error } = await supabase.from('board_members').upsert(memberPayload, { onConflict: 'board_id,email' });

      if (error) {
        console.error('[SupabaseService] Error adding member directly:', error);
        return false;
      }

      // Touch the boards table so Postgres WAL emits a boards UPDATE event across all listeners
      try {
        await supabase.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      } catch {}

      // Broadcast instant update across all devices
      await this.broadcastUpdate('boards', { boardId, memberEmail: cleanEmail });

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
        .or(`id.eq.${memberId},email.eq.${memberId}`);
      if (error) throw error;

      try {
        await supabase.from('boards').update({ updated_at: new Date().toISOString() }).eq('id', boardId);
      } catch {}

      await this.broadcastUpdate('boards', { boardId });
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
      this.broadcastUpdate('boards', { boardId });
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error removing board member:', err);
      return false;
    }
  },

  /**
   * Update board properties (e.g. rename board)
   */
  async updateBoard(boardId: string, patch: Partial<Board>): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId) return false;
    try {
      const dbPatch: any = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) dbPatch.name = patch.name.trim();
      if (patch.color !== undefined) dbPatch.color = patch.color;
      const { error } = await supabase.from('boards').update(dbPatch).eq('id', boardId);
      if (error) {
        console.error('[SupabaseService] Error updating board:', error);
        throw error;
      }
      this.broadcastUpdate('boards', { boardId, ...patch });
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error updating board:', err);
      return false;
    }
  },

  /**
   * Delete a board from Supabase (cascades cleanly through foreign keys)
   */
  async deleteBoard(boardId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !boardId) return false;
    try {
      const { error } = await supabase.from('boards').delete().eq('id', boardId);
      if (error) {
        console.error('[SupabaseService] Error deleting board:', error);
        throw error;
      }
      this.broadcastUpdate('boards', { boardId });
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error deleting board:', err);
      return false;
    }
  },

  /**
   * Delete a single card from Supabase (cascades cleanly through attachments, comments, labels, assignees)
   */
  async deleteCard(cardId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !cardId) return false;
    try {
      const { error } = await supabase.from('cards').delete().eq('id', cardId);
      if (error) {
        console.error('[SupabaseService] Error deleting card:', error);
        throw error;
      }
      this.broadcastUpdate('boards', { cardId });
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error deleting card:', err);
      return false;
    }
  },

  /**
   * Delete an attachment from Supabase database
   */
  async deleteAttachment(attId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !attId) return false;
    try {
      const { error } = await supabase.from('attachments').delete().eq('id', attId);
      if (error) {
        console.warn('[SupabaseService] Error deleting attachment:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error deleting attachment:', err);
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
      this.broadcastUpdate('notifications', { recipientEmail: notif.recipientEmail });
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
   * Cloud Notifications: Delete a single notification by id
   */
  async deleteNotification(id: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !id) return false;
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Error deleting notification:', err);
      return false;
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
   * Custom Labels: Fetch custom category labels from Supabase
   */
  async getCustomLabels(userEmail?: string): Promise<Array<{ id: string; name: string; color: string }>> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('custom_labels')
        .select('id, name, color')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[SupabaseService] Error fetching custom labels:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('[SupabaseService] Exception getting custom labels:', err);
      return [];
    }
  },

  /**
   * Custom Labels: Upsert a custom label in Supabase
   */
  async upsertCustomLabel(label: { id: string; name: string; color: string }, userEmail?: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !label.id) return false;
    try {
      const { error } = await supabase.from('custom_labels').upsert({
        id: label.id,
        user_email: userEmail ? userEmail.toLowerCase().trim() : null,
        name: label.name,
        color: label.color || '#3b82f6',
      }, { onConflict: 'id' });

      if (error) {
        console.warn('[SupabaseService] Error upserting custom label:', error);
        return false;
      }
      this.broadcastUpdate('labels');
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Exception upserting custom label:', err);
      return false;
    }
  },

  /**
   * Custom Labels: Delete a custom label in Supabase
   */
  async deleteCustomLabel(labelId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !labelId) return false;
    try {
      const { error } = await supabase.from('custom_labels').delete().eq('id', labelId);
      if (error) {
        console.warn('[SupabaseService] Error deleting custom label:', error);
        return false;
      }
      this.broadcastUpdate('labels');
      return true;
    } catch (err) {
      console.warn('[SupabaseService] Exception deleting custom label:', err);
      return false;
    }
  },

  /**
   * Subscribe to realtime database changes and instant broadcast events across all devices
   */
  subscribeToAll(userEmail: string, onBoardsChange: () => void, onNotifsChange: () => void, onLabelsChange?: () => void) {
    if (!isSupabaseConfigured()) return () => {};

    const cleanEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    const channelName = 'worklane-realtime-channel';

    // Clean up any stale channel with this name to avoid topic collisions
    const existing = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName);
    activeRealtimeChannel = channel;

    // 1. Instant Peer-to-Peer Broadcast (sub-50ms sync between open windows/devices)
    channel
      .on('broadcast', { event: 'boards' }, () => {
        onBoardsChange();
      })
      .on('broadcast', { event: 'notifications' }, (payload) => {
        const targetEmail = payload?.payload?.recipientEmail;
        if (!targetEmail || targetEmail.toLowerCase().trim() === cleanEmail) {
          onNotifsChange();
        }
      })
      .on('broadcast', { event: 'labels' }, () => {
        if (onLabelsChange) onLabelsChange();
        else onBoardsChange();
      });

    // 2. Full Postgres WAL changes across all database tables
    const dbTables = [
      'boards',
      'board_members',
      'columns',
      'cards',
      'card_assignees',
      'card_labels',
      'comments',
      'attachments',
      'custom_labels',
      'profiles',
    ];

    dbTables.forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          if (table === 'custom_labels' && onLabelsChange) {
            onLabelsChange();
          } else {
            onBoardsChange();
          }
        }
      );
    });

    // Notifications DB changes
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => {
        if (payload.new && (!cleanEmail || payload.new.recipient_email?.toLowerCase().trim() === cleanEmail)) {
          onNotifsChange();
        }
      }
    );

    // Subscribe with auto-reconnect handling
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => {
          channel.subscribe();
        }, 2000);
      }
    });

    return () => {
      if (activeRealtimeChannel === channel) {
        activeRealtimeChannel = null;
      }
      supabase.removeChannel(channel);
    };
  },
};
