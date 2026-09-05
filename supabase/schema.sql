-- Run this in Supabase SQL Editor to enable account deletion from the Dashboard.
create table if not exists public.account_deletion_email_claims (
  user_id uuid primary key,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

revoke all on table public.account_deletion_email_claims from public, anon, authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_user_id uuid := auth.uid();
  deleted_email text;
  deleted_full_name text;
begin
  if deleted_user_id is null then
    raise exception 'You must be signed in to delete your account';
  end if;

  select u.email, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
  into deleted_email, deleted_full_name
  from auth.users u
  where u.id = deleted_user_id;

  if deleted_email is null then
    raise exception 'Unable to find the account email';
  end if;

  insert into public.account_deletion_email_claims (user_id, email, full_name)
  values (deleted_user_id, deleted_email, deleted_full_name);

  delete from auth.users where id = deleted_user_id;

  if not found then
    raise exception 'Unable to delete the account';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- Admin platform schema. Run this section once in the Supabase SQL Editor.
create sequence if not exists public.support_ticket_sequence;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null default ('TER-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.support_ticket_sequence')::text, 6, '0')),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  category text not null check (category in ('Technical Issue', 'Account Problem', 'Website Problem', 'Rover Problem', 'Data Issue', 'Payment/Billing', 'Feedback', 'Other')),
  subject text not null,
  description text not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  admin_notes text,
  ai_summary text,
  ai_category text,
  ai_priority text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  message text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  type text not null default 'Announcement' check (type in ('Announcement', 'Update', 'Maintenance', 'Feature', 'Alert', 'News')),
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Scheduled', 'Archived')),
  priority text not null default 'Normal' check (priority in ('Normal', 'Important', 'Critical')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publish_at timestamptz,
  expires_at timestamptz
);

create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_priority_idx on public.support_tickets(priority);
create index if not exists support_tickets_created_at_idx on public.support_tickets(created_at desc);
create index if not exists announcements_published_idx on public.announcements(status, publish_at, expires_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.support_tickets enable row level security;
alter table public.feedback enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Customers create tickets" on public.support_tickets;
create policy "Customers create tickets" on public.support_tickets for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
drop policy if exists "Admins manage tickets" on public.support_tickets;
create policy "Admins manage tickets" on public.support_tickets for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.track_support_ticket(ticket_ref text, customer_email text)
returns table (ticket_number text, category text, subject text, status text, priority text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select t.ticket_number, t.category, t.subject, t.status, t.priority, t.created_at
  from public.support_tickets t
  where lower(t.ticket_number) = lower(track_support_ticket.ticket_ref)
    and lower(t.email) = lower(track_support_ticket.customer_email)
  limit 1;
$$;

revoke all on function public.track_support_ticket(text, text) from public;
grant execute on function public.track_support_ticket(text, text) to anon, authenticated;

create or replace function public.submit_support_ticket(ticket_name text, ticket_email text, ticket_phone text, ticket_category text, ticket_subject text, ticket_description text, ticket_priority text, ticket_user_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare created_ticket_number text;
begin
  insert into public.support_tickets (name, email, phone, category, subject, description, priority, user_id)
  values (ticket_name, ticket_email, nullif(ticket_phone, ''), ticket_category, ticket_subject, ticket_description, coalesce(nullif(ticket_priority, ''), 'Medium'), case when ticket_user_id = auth.uid() then ticket_user_id else null end)
  returning ticket_number into created_ticket_number;
  return created_ticket_number;
end;
$$;

revoke all on function public.submit_support_ticket(text, text, text, text, text, text, text, uuid) from public;
grant execute on function public.submit_support_ticket(text, text, text, text, text, text, text, uuid) to anon, authenticated;

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('customer', 'admin', 'ai')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;
alter table public.admin_activity enable row level security;
drop policy if exists "Admins manage ticket messages" on public.ticket_messages;
create policy "Admins manage ticket messages" on public.ticket_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins view activity" on public.admin_activity;
create policy "Admins view activity" on public.admin_activity for select to authenticated using (public.is_admin());

drop policy if exists "Admins view feedback" on public.feedback;
create policy "Admins view feedback" on public.feedback for select to authenticated using (public.is_admin());
drop policy if exists "Anyone submits feedback" on public.feedback;
create policy "Anyone submits feedback" on public.feedback for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());

drop policy if exists "Anyone views active announcements" on public.announcements;
create policy "Anyone views active announcements" on public.announcements for select to anon, authenticated using (status = 'Published' and (publish_at is null or publish_at <= now()) and (expires_at is null or expires_at > now()) or public.is_admin());
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements" on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Create a public Storage bucket named `avatars` in Storage before using profile uploads.
-- Then run these policies so authenticated users can manage files under their own user ID folder.
drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
