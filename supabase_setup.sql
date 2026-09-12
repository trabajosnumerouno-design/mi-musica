-- CONFIGURACIÓN DE ALMACENAMIENTO PARA MI MÚSICA
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query.

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text default 'Mi biblioteca',
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.songs enable row level security;

drop policy if exists "songs_select_own" on public.songs;
create policy "songs_select_own" on public.songs
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "songs_insert_own" on public.songs;
create policy "songs_insert_own" on public.songs
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "songs_delete_own" on public.songs;
create policy "songs_delete_own" on public.songs
for delete to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('music', 'music', false)
on conflict (id) do update set public = false;

drop policy if exists "music_select_own" on storage.objects;
create policy "music_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "music_insert_own" on storage.objects;
create policy "music_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "music_delete_own" on storage.objects;
create policy "music_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
