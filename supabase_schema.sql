-- ==============================================================================
-- WORKLANE - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Run this entire script in your Supabase SQL Editor:
-- https://app.supabase.com/project/_/sql/new
-- ==============================================================================

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 2. User Profiles Table (Linked to Supabase Auth)
-- ==============================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text unique not null,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger to automatically create or update profile upon auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    name = coalesce(excluded.name, public.profiles.name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- 3. Boards Table
-- ==============================================================================
create table if not exists public.boards (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  color text default '#6366f1' not null,
  created_by text not null, -- User Email or Auth User ID
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ==============================================================================
-- 4. Board Members Table
-- ==============================================================================
create table if not exists public.board_members (
  id text primary key default gen_random_uuid()::text,
  board_id text references public.boards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  color text default '#6366f1' not null,
  avatar_url text,
  role text default 'member' not null, -- 'owner', 'admin', 'member'
  added_at timestamptz default now() not null,
  unique (board_id, email)
);

-- ==============================================================================
-- 5. Columns Table
-- ==============================================================================
create table if not exists public.columns (
  id text primary key default gen_random_uuid()::text,
  board_id text references public.boards(id) on delete cascade not null,
  name text not null,
  position integer default 0 not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- 6. Cards Table
-- ==============================================================================
create table if not exists public.cards (
  id text primary key default gen_random_uuid()::text,
  board_id text references public.boards(id) on delete cascade not null,
  column_id text references public.columns(id) on delete cascade not null,
  title text not null,
  description text default '' not null,
  priority text default 'medium' not null, -- 'low', 'medium', 'high', 'urgent'
  completed boolean default false not null,
  completed_at timestamptz,
  due_date timestamptz,
  cover_attachment_id text,
  position integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ==============================================================================
-- 7. Card Assignees Table (Many-to-Many)
-- ==============================================================================
create table if not exists public.card_assignees (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  member_id text not null, -- References board_members.id or board_members.email
  assigned_at timestamptz default now() not null,
  unique (card_id, member_id)
);

-- ==============================================================================
-- 8. Card Labels Table
-- ==============================================================================
create table if not exists public.card_labels (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  label_id text not null,
  unique (card_id, label_id)
);

-- ==============================================================================
-- 9. Custom Labels Table
-- ==============================================================================
create table if not exists public.custom_labels (
  id text primary key default gen_random_uuid()::text,
  user_email text,
  name text not null,
  color text default '#3b82f6' not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- 10. Attachments Table
-- ==============================================================================
create table if not exists public.attachments (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  name text not null,
  size bigint default 0 not null,
  type text default 'application/octet-stream' not null,
  data_url text, -- Base64 data or Supabase storage public URL
  storage_path text,
  added_at timestamptz default now() not null
);

-- ==============================================================================
-- 11. Comments Table
-- ==============================================================================
create table if not exists public.comments (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  author text not null,
  author_initials text not null,
  avatar_color text default '#6366f1' not null,
  text text not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- 12. Notifications Table
-- ==============================================================================
create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  recipient_email text not null,
  recipient_id uuid references auth.users(id) on delete set null,
  title text not null,
  sub text not null,
  icon text default 'bell' not null,
  card_id text,
  board_id text,
  time timestamptz default now() not null,
  is_read boolean default false not null
);

-- ==============================================================================
-- 13. Email Notification Logs Table
-- ==============================================================================
create table if not exists public.email_logs (
  id text primary key default gen_random_uuid()::text,
  recipient_email text not null,
  recipient_name text not null,
  subject text not null,
  body text not null,
  event_type text not null,
  status text default 'sent' not null,
  sent_at timestamptz default now() not null
);

-- ==============================================================================
-- 14. Performance Indexes
-- ==============================================================================
create index if not exists idx_boards_created_by on public.boards(created_by);
create index if not exists idx_board_members_board_id on public.board_members(board_id);
create index if not exists idx_board_members_email on public.board_members(email);
create index if not exists idx_columns_board_id on public.columns(board_id);
create index if not exists idx_cards_board_id on public.cards(board_id);
create index if not exists idx_cards_column_id on public.cards(column_id);
create index if not exists idx_card_assignees_card_id on public.card_assignees(card_id);
create index if not exists idx_card_labels_card_id on public.card_labels(card_id);
create index if not exists idx_attachments_card_id on public.attachments(card_id);
create index if not exists idx_comments_card_id on public.comments(card_id);
create index if not exists idx_notifications_recipient on public.notifications(recipient_email);

-- ==============================================================================
-- 15. Row Level Security (RLS)
-- ==============================================================================
-- ==============================================================================
-- 15. Row Level Security (RLS) - Hardened Multi-Tenant Policies
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.card_assignees enable row level security;
alter table public.card_labels enable row level security;
alter table public.custom_labels enable row level security;
alter table public.attachments enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.email_logs enable row level security;

-- Helper function to check if current user is member or owner of a board
create or replace function public.is_board_member(board_id text)
returns boolean as $$
declare
  user_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if user_email = '' then
    return false;
  end if;

  return exists (
    select 1 from public.boards b
    where b.id = board_id and lower(b.created_by) = user_email
  ) or exists (
    select 1 from public.board_members bm
    where bm.board_id = board_id and lower(bm.email) = user_email
  );
end;
$$ language plpgsql security definer stable;

-- 1. Profiles: Users can view all member profiles, but only update their own
create policy "Profiles are viewable by authenticated users" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 2. Boards: Viewable & editable only by creator or board members
create policy "Users can view boards they belong to" on public.boards
  for select using (
    lower(created_by) = lower(coalesce(auth.jwt()->>'email', ''))
    or exists (
      select 1 from public.board_members bm 
      where bm.board_id = boards.id and lower(bm.email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );
create policy "Authenticated users can create boards" on public.boards
  for insert with check (auth.role() = 'authenticated');
create policy "Board members can update boards" on public.boards
  for update using (
    lower(created_by) = lower(coalesce(auth.jwt()->>'email', ''))
    or public.is_board_member(id)
  );
create policy "Only board owner can delete boards" on public.boards
  for delete using (lower(created_by) = lower(coalesce(auth.jwt()->>'email', '')));

-- 3. Board Members: Scoped to board membership or own email
create policy "View board members of member boards" on public.board_members
  for select using (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    or public.is_board_member(board_id)
  );
create policy "Board members can add members" on public.board_members
  for insert with check (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    or public.is_board_member(board_id)
  );
create policy "Board members can update members" on public.board_members
  for update using (public.is_board_member(board_id));
create policy "Board members can remove members" on public.board_members
  for delete using (public.is_board_member(board_id));

-- 4. Columns: Scoped to board membership
create policy "View columns of member boards" on public.columns
  for select using (public.is_board_member(board_id));
create policy "Manage columns of member boards" on public.columns
  for all using (public.is_board_member(board_id));

-- 5. Cards: Scoped to board membership
create policy "View cards of member boards" on public.cards
  for select using (public.is_board_member(board_id));
create policy "Manage cards of member boards" on public.cards
  for all using (public.is_board_member(board_id));

-- 6. Card Assignees & Labels
create policy "Manage card assignees of member boards" on public.card_assignees
  for all using (
    exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id))
  );
create policy "Manage card labels of member boards" on public.card_labels
  for all using (
    exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id))
  );

-- 7. Custom Labels: Scoped to creator user
create policy "Manage own custom labels" on public.custom_labels
  for all using (user_email is null or user_email = auth.jwt()->>'email');

-- 8. Attachments: Scoped to card's board membership
create policy "Manage attachments of member boards" on public.attachments
  for all using (
    exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id))
  );

-- 9. Comments: Scoped to card's board membership
create policy "Manage comments of member boards" on public.comments
  for all using (
    exists (select 1 from public.cards c where c.id = card_id and public.is_board_member(c.board_id))
  );

-- 10. Notifications: Scoped strictly to recipient email
create policy "Users can view and manage their own notifications" on public.notifications
  for all using (
    recipient_email = auth.jwt()->>'email'
    or recipient_id = auth.uid()
  );

-- 11. Email Logs: Scoped to recipient email or board members
create policy "Users can view their own email logs" on public.email_logs
  for select using (recipient_email = auth.jwt()->>'email');
create policy "Insert email logs" on public.email_logs
  for insert with check (auth.role() = 'authenticated');

-- ==============================================================================
-- 16. Supabase Storage Buckets & Policies (Private Attachments + Signed URLs)
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false, -- PRIVATE BUCKET (Requires Signed URLs / Authenticated Access)
  5242880, -- 5 MB limit
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'text/plain', 'application/json']
)
on conflict (id) do update 
set public = false, file_size_limit = 5242880;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true, -- Avatars remain public for fast rendering
  2097152, -- 2 MB limit
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set file_size_limit = 2097152;

-- Storage policies for Private Attachments
create policy "Authenticated Access to Attachments" on storage.objects 
  for select using (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "Authenticated Upload to Attachments" on storage.objects 
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "Authenticated Delete from Attachments" on storage.objects 
  for delete using (bucket_id = 'attachments' and auth.role() = 'authenticated');

-- Storage policies for Public Avatars
create policy "Public Access to Avatars" on storage.objects 
  for select using (bucket_id = 'avatars');
create policy "Authenticated Upload to Avatars" on storage.objects 
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- ==============================================================================
-- 17. Enable Realtime Publications
-- ==============================================================================
-- Add tables to realtime publication so clients receive instant live updates
do $$
begin
  alter publication supabase_realtime add table public.boards;
  alter publication supabase_realtime add table public.board_members;
  alter publication supabase_realtime add table public.columns;
  alter publication supabase_realtime add table public.cards;
  alter publication supabase_realtime add table public.comments;
  alter publication supabase_realtime add table public.notifications;
exception when others then
  null; -- Ignore if tables are already in the publication
end $$;
