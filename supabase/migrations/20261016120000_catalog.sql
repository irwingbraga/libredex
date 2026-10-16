-- Libredex catalog store, written by the nightly ingestion job over a direct
-- database connection. The site never reads it: it ships a static export.
-- The schema is not exposed through the Data API, and RLS without policies
-- keeps anon/authenticated out even if it ever is.

create schema if not exists catalog;
revoke all on schema catalog from public, anon, authenticated;

create table catalog.repos (
  id bigint generated always as identity primary key,
  node_id text not null unique,
  full_name text not null unique,
  owner text not null,
  owner_type text,
  owner_avatar text,
  name text not null,
  description text,
  homepage text,
  stars integer not null,
  forks integer not null,
  language text,
  license text,
  topics jsonb not null default '[]',
  created_at timestamptz not null,
  pushed_at timestamptz,
  archived boolean not null default false,
  default_branch text,
  social_image text,
  seen_at timestamptz not null,
  media_checked_at timestamptz,
  readme_logo text,
  readme_screenshot text
);

create index repos_stars_idx on catalog.repos (stars desc);
create index repos_created_idx on catalog.repos (created_at);

-- One star count per repo per day, the basis for weekly growth.
create table catalog.star_snapshots (
  repo_id bigint not null references catalog.repos (id) on delete cascade,
  day date not null,
  stars integer not null,
  primary key (repo_id, day)
);

create index star_snapshots_day_idx on catalog.star_snapshots (day);

-- Last successful run of each seed search, for resumable and rotating harvests.
create table catalog.seed_runs (
  seed text primary key,
  harvested_at timestamptz not null,
  total integer
);

alter table catalog.repos enable row level security;
alter table catalog.star_snapshots enable row level security;
alter table catalog.seed_runs enable row level security;

revoke all on all tables in schema catalog from public, anon, authenticated;
