-- ============================================================
-- StreamDeal — Phase 1 SQL Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. PROFILES ─────────────────────────────────────────────
-- Extends Supabase auth.users with display name + role
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'user' check (role in ('user', 'admin', 'superadmin')),
  created_at timestamptz not null default now()
);

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. DEALS ────────────────────────────────────────────────
create table if not exists public.deals (
  id           uuid primary key default gen_random_uuid(),
  service      text not null,               -- 'Apple', 'Spotify', etc.
  logo         text not null default '🎵',  -- emoji or image url
  title        text not null,
  description  text,
  discount     text not null,               -- e.g. '3 months free'
  eligibility  text,                        -- e.g. 'New subscribers only'
  color        text not null default '#888',-- brand hex color
  link         text,                        -- claim URL
  expires_at   date,                        -- null = ongoing
  is_hot       boolean not null default false,
  is_published boolean not null default true,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deals_updated_at on public.deals;
create trigger deals_updated_at
  before update on public.deals
  for each row execute procedure public.set_updated_at();

-- ── 3. WATCHLIST ─────────────────────────────────────────────
-- Users can watch/bookmark deals to get notified before expiry
create table if not exists public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  deal_id    uuid not null references public.deals(id) on delete cascade,
  notified   boolean not null default false, -- true once expiry email sent
  created_at timestamptz not null default now(),
  unique(user_id, deal_id)
);

-- ── 4. ROW LEVEL SECURITY ────────────────────────────────────

-- profiles: users can read all, update only their own
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- deals: published deals are public; admins manage all
alter table public.deals enable row level security;

create policy "Published deals are public"
  on public.deals for select using (is_published = true);

create policy "Admins can manage deals"
  on public.deals for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superadmin')
    )
  );

-- watchlist: users manage their own entries
alter table public.watchlist enable row level security;

create policy "Users can view their own watchlist"
  on public.watchlist for select using (auth.uid() = user_id);

create policy "Users can insert into their own watchlist"
  on public.watchlist for insert with check (auth.uid() = user_id);

create policy "Users can delete from their own watchlist"
  on public.watchlist for delete using (auth.uid() = user_id);

-- ── 5. SEED DATA ─────────────────────────────────────────────
insert into public.deals
  (service, logo, title, description, discount, eligibility, color, link, expires_at, is_hot)
values
  ('Apple',   '🍎', '3 Months Apple Music Free',
   'New subscribers get 3 months of Apple Music at no cost when purchasing select Apple devices or AirPods.',
   '3 months free', 'New subscribers + Apple device purchase', '#fa586a',
   'https://music.apple.com', '2025-06-30', true),

  ('Apple',   '📺', 'Apple TV+ 3-Month Trial',
   'Get 3 months of Apple TV+ free with any new Apple device purchase.',
   '3 months free', 'New Apple device buyers', '#333333',
   'https://tv.apple.com', '2025-07-15', false),

  ('Spotify',  '🎵', 'Spotify Premium — 3 Months for $0.99',
   'New and returning eligible users get 3 months of Spotify Premium for just $0.99.',
   '$0.99 for 3 months', 'New / returning users', '#1DB954',
   'https://spotify.com/premium', '2025-05-31', true),

  ('Netflix',  '🎬', 'Netflix Free via T-Mobile',
   'T-Mobile customers on eligible plans get Netflix Standard included.',
   'Free with plan', 'T-Mobile Go5G / Magenta MAX', '#E50914',
   'https://netflix.com', null, false),

  ('Disney+',  '✨', 'Disney+ — 2 Months for $2',
   'New subscribers get first 2 months for $1/month through partner offers.',
   '$1/month for 2 months', 'New subscribers only', '#0063e5',
   'https://disneyplus.com', '2025-05-01', true),

  ('YouTube',  '▶️', 'YouTube Premium — 2 Months Free',
   'New YouTube Premium members get 2 months free before monthly billing starts.',
   '2 months free', 'New subscribers', '#FF0000',
   'https://youtube.com/premium', '2025-06-01', false),

  ('Amazon',   '📦', 'Prime Video — 30 Days Free',
   'Start an Amazon Prime trial and get 30 days of Prime Video and more for free.',
   '30 days free', 'New Amazon Prime members', '#FF9900',
   'https://amazon.com/prime', null, false),

  ('Apple',   '🎮', 'Apple Arcade — 3 Months Free',
   'Download any Apple Arcade game for the first time and unlock 3 months free.',
   '3 months free', 'New Apple Arcade subscribers', '#5e5ce6',
   'https://apple.com/apple-arcade', '2025-08-01', false);
