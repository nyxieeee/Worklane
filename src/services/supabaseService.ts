import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Board, Column, Card, Comment, Attachment, Member } from '../types';

/**
 * Service to interact with Supabase database and storage
 */
export const supabaseService = {
  /**
   * Check if Supabase is active
   */
  isConfigured(): boolean {
    return isSupabaseConfigured();
  },

  /**
   * Fetch all boards for a given user email
   */
  async getBoardsForUser(email: string): Promise<Board[]> {
    if (!isSupabaseConfigured() || !email) return [];

    try {
      const cleanEmail = email.toLowerCase().trim();
      
      // 1. Fetch board IDs where user is explicitly listed as member
      const { data: memberRows } = await supabase
        .from('board_members')
        .select('board_id')
        .ilike('email', cleanEmail);

      const memberBoardIds = (memberRows || []).map(r => r.board_id);

      // 2. Fetch boards matching created_by OR memberBoardIds OR direct RLS query
      let query = supabase.from('boards').select('*');
      if (memberBoardIds.length > 0) {
        query = query.or(`created_by.ilike.${cleanEmail},id.in.(${memberBoardIds.map(id => `"${id}"`).join(',')})`);
      } else {
        query = query.ilike('created_by', cleanEmail);
      }

      let { data: boardsData, error: boardsErr } = await query;
      if (boardsErr) {
        // Fallback to select * (RLS filtered)
        const fallback = await supabase.from('boards').select('*');
        boardsData = fallback.data || [];
      }

      if (!boardsData || boardsData.length === 0) return [];

      const boardIds = boardsData.map(b => b.id);

      // 3. Fetch all related entities in parallel
      const [membersRes, colsRes, cardsRes] = await Promise.all([
        supabase.from('board_members').select('*').in('board_id', boardIds),
        supabase.from('columns').select('*').in('board_id', boardIds).order('position'),
        supabase.from('cards').select('*').in('board_id', boardIds).order('position')
      ]);

      const allMembers = membersRes.data || [];
      const allCols = colsRes.data || [];
      const allCards = cardsRes.data || [];
      const cardIds = allCards.map(c => c.id);

      // 4. Fetch card children
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

      // 5. Assemble full domain Board structure
      const assembledBoards: Board[] = boardsData.map(b => {
        const bMembers: Member[] = allMembers
          .filter(m => m.board_id === b.id)
          .map(m => ({
            id: m.id,
            name: m.name,
            email: m.email,
            color: m.color || '#6366f1',
            avatarUrl: m.avatar_url || undefined,
          }));

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
      });
      if (bErr) throw bErr;

      // 2. Upsert Members & remove deleted
      const currentMemberIds = (board.members || []).map(m => m.id);
      if (board.members?.length > 0) {
        const memberRows = board.members.map(m => ({
          id: m.id,
          board_id: board.id,
          name: m.name,
          email: m.email.toLowerCase().trim(),
          color: m.color,
          avatar_url: m.avatarUrl || null,
        }));
        await supabase.from('board_members').upsert(memberRows, { onConflict: 'id' });
      }
      if (currentMemberIds.length > 0) {
        await supabase
          .from('board_members')
          .delete()
          .eq('board_id', board.id)
          .not('id', 'in', `(${currentMemberIds.map(id => `"${id}"`).join(',')})`);
      }

      // 3. Upsert Columns & remove deleted
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
            // Clean up unassigned
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
   * Upload file to Supabase Storage bucket (Private with Signed URLs)
   */
  async uploadAttachment(file: File, path: string, expiresInSeconds: number = 60 * 60 * 24 * 7): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const { error } = await supabase.storage.from('attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;

      // Generate signed URL for private bucket access
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
   * Subscribe to realtime database changes for all boards
   */
  subscribeToAllBoards(onUpdate: () => void) {
    if (!isSupabaseConfigured()) return () => {};

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boards' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_members' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments' },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
