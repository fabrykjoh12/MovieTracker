-- MovieTracker invite-only beta foundation for Neon Auth and the Data API.
-- All user-owned tables are protected by Row Level Security. Provider metadata
-- is readable by authenticated users and writable only through trusted server
-- credentials.
-- Prerequisite: enable Neon Auth and the Data API before applying this file.

create extension if not exists pgcrypto;

create type public.media_format as enum ('movie', 'series');
create type public.library_status as enum (
  'watching',
  'up-next',
  'planned',
  'paused',
  'completed',
  'dropped',
  'rewatching',
  'archived'
);
create type public.verdict_kind as enum (
  'all-timer',
  'loved',
  'liked',
  'mixed',
  'not-for-me',
  'dropped'
);
create type public.shelf_visibility as enum ('private', 'public', 'collaborative');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.spoiler_level as enum ('title', 'season', 'episode', 'checkpoint');
create type public.room_vote as enum ('yes', 'maybe', 'no');

create table public.profiles (
  id uuid primary key references neon_auth."user" (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  bio text check (char_length(bio) <= 320),
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_handle_lower_idx on public.profiles (lower(handle));

create table public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  claimed_by uuid unique references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((claimed_by is null) = (claimed_at is null))
);
create index beta_invites_created_by_idx on public.beta_invites (created_by);
create index beta_invites_unclaimed_idx on public.beta_invites (expires_at)
  where claimed_by is null;

create table public.media (
  id uuid primary key default gen_random_uuid(),
  format public.media_format not null,
  tmdb_id bigint,
  title text not null,
  original_title text,
  release_year smallint check (release_year between 1870 and 2200),
  runtime_minutes integer check (runtime_minutes > 0),
  poster_path text,
  backdrop_path text,
  metadata jsonb not null default '{}'::jsonb,
  metadata_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (format, tmdb_id)
);
create index media_title_search_idx on public.media using gin (to_tsvector('simple', title));

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media (id) on delete cascade,
  season_number integer not null check (season_number >= 0),
  title text,
  release_year smallint check (release_year between 1870 and 2200),
  episode_count integer check (episode_count >= 0),
  poster_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (media_id, season_number)
);
create index seasons_media_idx on public.seasons (media_id, season_number);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text not null,
  runtime_minutes integer check (runtime_minutes > 0),
  air_date date,
  synopsis text,
  still_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (season_id, episode_number)
);
create index episodes_season_idx on public.episodes (season_id, episode_number);

create table public.user_media_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  status public.library_status not null default 'planned',
  progress_season integer check (progress_season is null or progress_season >= 0),
  progress_episode integer check (progress_episode is null or progress_episode >= 0),
  intent jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, media_id),
  check ((progress_season is null) = (progress_episode is null))
);
create index user_media_states_user_status_idx
  on public.user_media_states (user_id, status, updated_at desc);
create index user_media_states_media_idx on public.user_media_states (media_id);

create table public.watch_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete set null,
  episode_id uuid references public.episodes (id) on delete set null,
  event_type text not null check (event_type in ('movie', 'episode', 'season', 'rewatch')),
  watched_at timestamptz not null default now(),
  rewatch_number integer check (rewatch_number is null or rewatch_number > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index watch_events_user_date_idx on public.watch_events (user_id, watched_at desc);
create index watch_events_user_media_idx on public.watch_events (user_id, media_id, watched_at desc);

create table public.verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete cascade,
  episode_id uuid references public.episodes (id) on delete cascade,
  kind public.verdict_kind not null,
  normalized numeric(4, 3) not null check (normalized between 0 and 1),
  qualities text[] not null default '{}',
  tags text[] not null default '{}',
  personal_rank integer check (personal_rank is null or personal_rank > 0),
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(qualities) <= 3),
  check (episode_id is null or season_id is not null)
);
create unique index verdicts_media_scope_idx
  on public.verdicts (user_id, media_id)
  where season_id is null and episode_id is null;
create unique index verdicts_season_scope_idx
  on public.verdicts (user_id, season_id)
  where season_id is not null and episode_id is null;
create unique index verdicts_episode_scope_idx
  on public.verdicts (user_id, episode_id)
  where episode_id is not null;
create index verdicts_user_kind_idx on public.verdicts (user_id, kind, personal_rank);

create table public.pairwise_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  left_media_id uuid not null references public.media (id) on delete cascade,
  right_media_id uuid not null references public.media (id) on delete cascade,
  preferred_media_id uuid not null references public.media (id) on delete cascade,
  ranking_scope text not null default 'overall',
  compared_at timestamptz not null default now(),
  check (left_media_id <> right_media_id),
  check (preferred_media_id in (left_media_id, right_media_id))
);
create index pairwise_comparisons_user_idx on public.pairwise_comparisons (user_id, compared_at desc);

create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 600),
  featured_media_id uuid references public.media (id) on delete set null,
  visibility public.shelf_visibility not null default 'private',
  atmosphere text,
  automatic_rules jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shelves_owner_idx on public.shelves (owner_id, updated_at desc);

create table public.shelf_collaborators (
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  can_edit boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (shelf_id, user_id)
);
create index shelf_collaborators_user_idx on public.shelf_collaborators (user_id);

create table public.shelf_items (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  added_by uuid not null references public.profiles (id) on delete cascade,
  position integer not null check (position >= 0),
  note text check (char_length(note) <= 600),
  added_at timestamptz not null default now(),
  unique (shelf_id, media_id),
  unique (shelf_id, position)
);
create index shelf_items_shelf_position_idx on public.shelf_items (shelf_id, position);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid references public.media (id) on delete cascade,
  kind text not null,
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_actor_date_idx on public.activities (actor_id, created_at desc);
create index activities_media_date_idx on public.activities (media_id, created_at desc);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  kind text not null check (kind in ('reaction', 'review', 'theory', 'recommendation')),
  body text not null check (char_length(body) between 1 and 20000),
  spoiler_level public.spoiler_level not null default 'title',
  spoiler_season integer check (spoiler_season is null or spoiler_season >= 0),
  spoiler_episode integer check (spoiler_episode is null or spoiler_episode >= 0),
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (spoiler_level = 'title' or spoiler_season is not null),
  check (spoiler_level <> 'episode' or spoiler_episode is not null)
);
create index reviews_media_date_idx on public.reviews (media_id, created_at desc);
create index reviews_author_date_idx on public.reviews (author_id, created_at desc);

create table public.watch_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  constraints jsonb not null default '{}'::jsonb,
  status text not null default 'voting' check (status in ('setup', 'voting', 'revealed', 'completed', 'cancelled')),
  selected_media_id uuid references public.media (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index watch_rooms_host_idx on public.watch_rooms (host_id, updated_at desc);

create table public.room_participants (
  room_id uuid not null references public.watch_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'participant' check (role in ('host', 'participant')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index room_participants_user_idx on public.room_participants (user_id, joined_at desc);

create table public.room_candidates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  reason text not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (room_id, media_id),
  unique (room_id, position)
);
create index room_candidates_room_idx on public.room_candidates (room_id, position);

create table public.room_votes (
  candidate_id uuid not null references public.room_candidates (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  vote public.room_vote not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (candidate_id, voter_id)
);
create index room_votes_voter_idx on public.room_votes (voter_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke create on schema public from public, anonymous, authenticated;

create or replace function private.are_friends(first_user uuid, second_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (requester_id = first_user and addressee_id = second_user)
        or (requester_id = second_user and addressee_id = first_user)
      )
  );
$$;

create or replace function private.can_view_shelf(target_shelf uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shelves shelf
    where shelf.id = target_shelf
      and (
        shelf.owner_id = viewer
        or shelf.visibility = 'public'
        or exists (
          select 1 from public.shelf_collaborators collaborator
          where collaborator.shelf_id = shelf.id and collaborator.user_id = viewer
        )
      )
  );
$$;

create or replace function private.can_edit_shelf(target_shelf uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shelves shelf
    where shelf.id = target_shelf
      and (
        shelf.owner_id = viewer
        or exists (
          select 1 from public.shelf_collaborators collaborator
          where collaborator.shelf_id = shelf.id
            and collaborator.user_id = viewer
            and collaborator.can_edit
        )
      )
  );
$$;

create or replace function private.is_room_member(target_room uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_participants
    where room_id = target_room and user_id = viewer
  ) or exists (
    select 1 from public.watch_rooms
    where id = target_room and host_id = viewer
  );
$$;

create or replace function private.can_view_spoiler(
  target_media uuid,
  target_level public.spoiler_level,
  target_season integer,
  target_episode integer,
  viewer uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_media_states state
    where state.user_id = viewer
      and state.media_id = target_media
      and (
        state.status in ('completed', 'dropped')
        or (
          target_level <> 'title'
          and state.progress_season is not null
          and (
            state.progress_season > coalesce(target_season, 0)
            or (
              state.progress_season = coalesce(target_season, 0)
              and state.progress_episode >= coalesce(target_episode, 2147483647)
            )
          )
        )
      )
  );
$$;

grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.can_view_shelf(uuid, uuid) to authenticated;
grant execute on function private.can_edit_shelf(uuid, uuid) to authenticated;
grant execute on function private.is_room_member(uuid, uuid) to authenticated;
grant execute on function private.can_view_spoiler(uuid, public.spoiler_level, integer, integer, uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger user_media_states_set_updated_at before update on public.user_media_states
for each row execute function public.set_updated_at();
create trigger verdicts_set_updated_at before update on public.verdicts
for each row execute function public.set_updated_at();
create trigger shelves_set_updated_at before update on public.shelves
for each row execute function public.set_updated_at();
create trigger friendships_set_updated_at before update on public.friendships
for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
for each row execute function public.set_updated_at();
create trigger watch_rooms_set_updated_at before update on public.watch_rooms
for each row execute function public.set_updated_at();
create trigger room_votes_set_updated_at before update on public.room_votes
for each row execute function public.set_updated_at();

revoke execute on function public.set_updated_at() from public, anonymous, authenticated;

create or replace function public.protect_friendship_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'Friendship participants cannot be changed';
  end if;
  return new;
end;
$$;

create trigger friendships_protect_identity before update on public.friendships
for each row execute function public.protect_friendship_identity();

revoke execute on function public.protect_friendship_identity() from public, anonymous, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    'member_' || substr(regexp_replace(new.id::text, '[^a-zA-Z0-9]', '', 'g'), 1, 12),
    coalesce(nullif(new.name, ''), split_part(coalesce(new.email, 'Member'), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on neon_auth."user"
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anonymous, authenticated;

insert into public.profiles (id, handle, display_name)
select
  auth_user.id,
  'member_' || substr(regexp_replace(auth_user.id::text, '[^a-zA-Z0-9]', '', 'g'), 1, 12),
  coalesce(nullif(auth_user.name, ''), split_part(coalesce(auth_user.email, 'Member'), '@', 1))
from neon_auth."user" auth_user
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.beta_invites enable row level security;
alter table public.media enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;
alter table public.user_media_states enable row level security;
alter table public.watch_events enable row level security;
alter table public.verdicts enable row level security;
alter table public.pairwise_comparisons enable row level security;
alter table public.shelves enable row level security;
alter table public.shelf_collaborators enable row level security;
alter table public.shelf_items enable row level security;
alter table public.friendships enable row level security;
alter table public.activities enable row level security;
alter table public.reviews enable row level security;
alter table public.watch_rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.room_candidates enable row level security;
alter table public.room_votes enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (
  id = (select auth.user_id())::uuid
  or not is_private
  or private.are_friends(id, (select auth.user_id())::uuid)
);
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.user_id())::uuid)
with check (id = (select auth.user_id())::uuid);

create policy beta_invites_select on public.beta_invites for select to authenticated
using (created_by = (select auth.user_id())::uuid or claimed_by = (select auth.user_id())::uuid);
create policy beta_invites_insert on public.beta_invites for insert to authenticated
with check (created_by = (select auth.user_id())::uuid);
create policy beta_invites_delete on public.beta_invites for delete to authenticated
using (created_by = (select auth.user_id())::uuid and claimed_by is null);

create policy media_select on public.media for select to authenticated using (true);
create policy seasons_select on public.seasons for select to authenticated using (true);
create policy episodes_select on public.episodes for select to authenticated using (true);

create policy user_media_states_owner on public.user_media_states for all to authenticated
using (user_id = (select auth.user_id())::uuid)
with check (user_id = (select auth.user_id())::uuid);
create policy watch_events_owner on public.watch_events for all to authenticated
using (user_id = (select auth.user_id())::uuid)
with check (user_id = (select auth.user_id())::uuid);
create policy verdicts_owner on public.verdicts for all to authenticated
using (user_id = (select auth.user_id())::uuid)
with check (user_id = (select auth.user_id())::uuid);
create policy pairwise_comparisons_owner on public.pairwise_comparisons for all to authenticated
using (user_id = (select auth.user_id())::uuid)
with check (user_id = (select auth.user_id())::uuid);

create policy shelves_select on public.shelves for select to authenticated
using (private.can_view_shelf(id, (select auth.user_id())::uuid));
create policy shelves_insert on public.shelves for insert to authenticated
with check (owner_id = (select auth.user_id())::uuid);
create policy shelves_update on public.shelves for update to authenticated
using (private.can_edit_shelf(id, (select auth.user_id())::uuid))
with check (private.can_edit_shelf(id, (select auth.user_id())::uuid));
create policy shelves_delete on public.shelves for delete to authenticated
using (owner_id = (select auth.user_id())::uuid);

create policy shelf_collaborators_select on public.shelf_collaborators for select to authenticated
using (private.can_view_shelf(shelf_id, (select auth.user_id())::uuid));
create policy shelf_collaborators_manage on public.shelf_collaborators for all to authenticated
using (exists (select 1 from public.shelves where id = shelf_id and owner_id = (select auth.user_id())::uuid))
with check (exists (select 1 from public.shelves where id = shelf_id and owner_id = (select auth.user_id())::uuid));
create policy shelf_items_select on public.shelf_items for select to authenticated
using (private.can_view_shelf(shelf_id, (select auth.user_id())::uuid));
create policy shelf_items_insert on public.shelf_items for insert to authenticated
with check (private.can_edit_shelf(shelf_id, (select auth.user_id())::uuid) and added_by = (select auth.user_id())::uuid);
create policy shelf_items_update on public.shelf_items for update to authenticated
using (private.can_edit_shelf(shelf_id, (select auth.user_id())::uuid))
with check (private.can_edit_shelf(shelf_id, (select auth.user_id())::uuid));
create policy shelf_items_delete on public.shelf_items for delete to authenticated
using (private.can_edit_shelf(shelf_id, (select auth.user_id())::uuid));

create policy friendships_select on public.friendships for select to authenticated
using ((select auth.user_id())::uuid in (requester_id, addressee_id));
create policy friendships_insert on public.friendships for insert to authenticated
with check (requester_id = (select auth.user_id())::uuid and status = 'pending');
create policy friendships_update on public.friendships for update to authenticated
using ((select auth.user_id())::uuid in (requester_id, addressee_id))
with check (
  (select auth.user_id())::uuid in (requester_id, addressee_id)
  and (
    status = 'blocked'
    or (addressee_id = (select auth.user_id())::uuid and status = 'accepted')
  )
);
create policy friendships_delete on public.friendships for delete to authenticated
using ((select auth.user_id())::uuid in (requester_id, addressee_id));

create policy activities_select on public.activities for select to authenticated
using (
  actor_id = (select auth.user_id())::uuid
  or visibility = 'public'
  or (visibility = 'friends' and private.are_friends(actor_id, (select auth.user_id())::uuid))
);
create policy activities_insert on public.activities for insert to authenticated
with check (actor_id = (select auth.user_id())::uuid);
create policy activities_delete on public.activities for delete to authenticated
using (actor_id = (select auth.user_id())::uuid);

create policy reviews_select on public.reviews for select to authenticated
using (
  author_id = (select auth.user_id())::uuid
  or (
    (visibility = 'public' or (visibility = 'friends' and private.are_friends(author_id, (select auth.user_id())::uuid)))
    and private.can_view_spoiler(
      media_id,
      spoiler_level,
      spoiler_season,
      spoiler_episode,
      (select auth.user_id())::uuid
    )
  )
);
create policy reviews_owner_write on public.reviews for all to authenticated
using (author_id = (select auth.user_id())::uuid)
with check (author_id = (select auth.user_id())::uuid);

create policy watch_rooms_select on public.watch_rooms for select to authenticated
using (private.is_room_member(id, (select auth.user_id())::uuid));
create policy watch_rooms_insert on public.watch_rooms for insert to authenticated
with check (host_id = (select auth.user_id())::uuid);
create policy watch_rooms_update on public.watch_rooms for update to authenticated
using (host_id = (select auth.user_id())::uuid)
with check (host_id = (select auth.user_id())::uuid);
create policy watch_rooms_delete on public.watch_rooms for delete to authenticated
using (host_id = (select auth.user_id())::uuid);

create policy room_participants_select on public.room_participants for select to authenticated
using (private.is_room_member(room_id, (select auth.user_id())::uuid));
create policy room_participants_manage on public.room_participants for all to authenticated
using (exists (select 1 from public.watch_rooms where id = room_id and host_id = (select auth.user_id())::uuid))
with check (exists (select 1 from public.watch_rooms where id = room_id and host_id = (select auth.user_id())::uuid));
create policy room_candidates_select on public.room_candidates for select to authenticated
using (private.is_room_member(room_id, (select auth.user_id())::uuid));
create policy room_candidates_manage on public.room_candidates for all to authenticated
using (exists (select 1 from public.watch_rooms where id = room_id and host_id = (select auth.user_id())::uuid))
with check (exists (select 1 from public.watch_rooms where id = room_id and host_id = (select auth.user_id())::uuid));
create policy room_votes_select on public.room_votes for select to authenticated
using (
  voter_id = (select auth.user_id())::uuid
  or exists (
    select 1
    from public.room_candidates candidate
    join public.watch_rooms room on room.id = candidate.room_id
    where candidate.id = candidate_id
      and private.is_room_member(room.id, (select auth.user_id())::uuid)
      and room.status in ('revealed', 'completed')
  )
);
create policy room_votes_owner_write on public.room_votes for all to authenticated
using (voter_id = (select auth.user_id())::uuid)
with check (
  voter_id = (select auth.user_id())::uuid
  and exists (
    select 1 from public.room_candidates candidate
    where candidate.id = candidate_id
      and private.is_room_member(candidate.room_id, (select auth.user_id())::uuid)
  )
);

grant select on public.media, public.seasons, public.episodes to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
