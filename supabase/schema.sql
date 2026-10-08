-- Schéma minimal pour la synchronisation cloud de Kalyav (Supabase / PostgreSQL).
-- Chaque utilisateur possède un instantané JSON de ses données ; la
-- sécurité au niveau des lignes garantit que personne d'autre ne peut le lire.

create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_snapshots enable row level security;

create policy "lecture de ses propres données"
  on public.user_snapshots for select
  using (auth.uid() = user_id);

create policy "création de ses propres données"
  on public.user_snapshots for insert
  with check (auth.uid() = user_id);

create policy "mise à jour de ses propres données"
  on public.user_snapshots for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "suppression de ses propres données"
  on public.user_snapshots for delete
  using (auth.uid() = user_id);
