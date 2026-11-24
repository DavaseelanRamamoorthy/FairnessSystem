-- v3 core schema. One person = one `members` row; every fixture is the hub
-- for availability, selection and scorecard; money and kit hang off seasons.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- people

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  year int not null,
  starts_on date not null,
  ends_on date not null,
  membership_fee numeric(10, 2) not null default 0,
  registration_open boolean not null default false,
  is_current boolean not null default false,
  closed_at timestamptz,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (team_id, year),
  check (ends_on >= starts_on)
);
create unique index seasons_one_current_per_team on public.seasons (team_id) where is_current;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null,
  primary_roles text[] not null default '{}'
    check (primary_roles <@ array['batter', 'bowler', 'all_rounder', 'wicket_keeper']),
  is_wicketkeeper boolean not null default false,
  bowls boolean not null default false,
  bat_hand text check (bat_hand in ('right', 'left')),
  bowl_hand text check (bowl_hand in ('right', 'left')),
  bowl_style text,
  bat_pref text not null default 'flexible' check (bat_pref in ('top', 'middle', 'lower', 'flexible')),
  bowl_pref text not null default 'flexible' check (bowl_pref in ('powerplay', 'middle', 'death', 'flexible')),
  claim_token uuid unique default gen_random_uuid(),
  merged_into uuid references public.members (id) on delete restrict,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index members_team_idx on public.members (team_id);
create index members_merged_into_idx on public.members (merged_into);

-- Contact data lives apart so row-level security can hide it from players.
create table public.member_private (
  member_id uuid primary key references public.members (id) on delete cascade,
  email text,
  phone text,
  whatsapp text,
  updated_at timestamptz not null default now()
);

-- Every outside name for a person: Spond, CricHeroes, sheet, PDF, app account.
create table public.member_identities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  source text not null check (source in ('app_account', 'spond', 'cricheroes', 'sheet', 'pdf', 'manual')),
  external_id text,
  display_name text not null,
  name_key text not null,
  created_at timestamptz not null default now()
);
create unique index member_identities_external_unique
  on public.member_identities (team_id, source, external_id) where external_id is not null;
create unique index member_identities_name_unique
  on public.member_identities (team_id, source, name_key);
create index member_identities_member_idx on public.member_identities (member_id);

create table public.season_members (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  role text not null default 'player' check (role in ('organiser', 'captain', 'vice_captain', 'player')),
  responsibilities text[] not null default '{}'
    check (responsibilities <@ array['treasurer', 'kit_manager', 'ground_booking', 'scouting']),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'left')),
  joined_on date not null default current_date,
  left_on date,
  created_at timestamptz not null default now(),
  unique (season_id, member_id),
  check (left_on is null or left_on >= joined_on)
);
create index season_members_member_idx on public.season_members (member_id);

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  existing_member_id uuid references public.members (id) on delete set null,
  kind text not null check (kind in ('new', 'renewal')),
  answers jsonb not null,
  consent_at timestamptz not null,
  status text not null default 'applied' check (status in ('applied', 'approved', 'rejected', 'withdrawn')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  unique (season_id, user_id)
);
create index membership_applications_user_idx on public.membership_applications (user_id);
create index membership_applications_existing_member_idx on public.membership_applications (existing_member_id);
create index membership_applications_decided_by_idx on public.membership_applications (decided_by);

create table public.unavailability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  from_date date not null,
  to_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index unavailability_member_idx on public.unavailability (member_id);

create table public.audit_log (
  id bigint generated always as identity primary key,
  team_id uuid references public.teams (id) on delete cascade,
  actor uuid,
  action text not null,
  target_table text not null,
  target_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_log_team_at_idx on public.audit_log (team_id, at desc);

-- ---------------------------------------------------------------- cricket

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('friendly_series', 'tournament', 'league')),
  fairness_weight numeric(4, 2) not null default 1 check (fairness_weight between 0 and 1),
  entry_fee_total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (season_id, name)
);

create table public.competition_squad (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  opted_in boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (competition_id, member_id)
);
create index competition_squad_member_idx on public.competition_squad (member_id);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  match_date date not null,
  slot int not null default 1 check (slot between 1 and 4),
  opponent text not null,
  ground text,
  overs int not null default 20 check (overs between 1 and 50),
  availability_deadline timestamptz,
  spond_event_ref text,
  cricheroes_match_ref text unique,
  status text not null default 'open' check (status in ('open', 'locked', 'selected', 'played', 'abandoned')),
  result text check (result in ('won', 'lost', 'tied', 'no_result')),
  result_summary text,
  created_at timestamptz not null default now(),
  unique (competition_id, match_date, slot)
);
create index fixtures_date_idx on public.fixtures (match_date);

create table public.availability (
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  answer text not null check (answer in ('yes', 'no', 'maybe')),
  on_time boolean not null,
  source text not null check (source in ('spond', 'manual', 'legacy')),
  captured_at timestamptz not null default now(),
  primary key (fixture_id, member_id)
);
create index availability_member_idx on public.availability (member_id);

create table public.selections (
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  slot text not null check (slot in ('xi', 'twelfth', 'reserve')),
  planned_bat_pos int check (planned_bat_pos between 1 and 11),
  planned_overs int check (planned_overs >= 0),
  reason text,
  overridden boolean not null default false,
  override_note text,
  published_at timestamptz,
  primary key (fixture_id, member_id)
);
create index selections_member_idx on public.selections (member_id);

create table public.innings (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  innings_no int not null check (innings_no between 1 and 4),
  ours boolean not null,
  team_name text not null,
  runs int not null default 0,
  wickets int not null default 0,
  balls int not null default 0,
  extras int not null default 0,
  unique (fixture_id, innings_no)
);

create table public.batting (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.innings (id) on delete cascade,
  member_id uuid references public.members (id) on delete restrict,
  name_raw text not null,
  position int not null check (position between 1 and 11),
  runs int not null default 0,
  balls int not null default 0,
  fours int not null default 0,
  sixes int not null default 0,
  how_out text,
  not_out boolean not null default false,
  did_bat boolean not null default true,
  unique (innings_id, position)
);
create index batting_innings_idx on public.batting (innings_id);
create index batting_member_idx on public.batting (member_id);

create table public.bowling (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.innings (id) on delete cascade,
  member_id uuid references public.members (id) on delete restrict,
  name_raw text not null,
  balls int not null default 0,
  maidens int not null default 0,
  runs int not null default 0,
  wickets int not null default 0,
  wides int not null default 0,
  no_balls int not null default 0
);
create index bowling_innings_idx on public.bowling (innings_id);
create index bowling_member_idx on public.bowling (member_id);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references public.fixtures (id) on delete cascade,
  kind text not null check (kind in ('scorecard', 'availability')),
  source text not null check (source in ('cricheroes', 'pdf', 'spond', 'manual', 'legacy')),
  payload jsonb not null,
  imported_by uuid references auth.users (id) on delete set null,
  imported_at timestamptz not null default now()
);
create index import_runs_fixture_idx on public.import_runs (fixture_id);
create index import_runs_imported_by_idx on public.import_runs (imported_by);

-- ---------------------------------------------------------------- money & kit

create table public.charges (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  kind text not null check (kind in ('membership', 'tournament_fee', 'jersey', 'other')),
  ref_id uuid,
  description text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  due_on date,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index charges_member_idx on public.charges (member_id);
create index charges_season_idx on public.charges (season_id);
create index charges_ref_idx on public.charges (ref_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  txn_date date not null default current_date,
  direction text not null check (direction in ('income', 'expense')),
  category text not null check (category in ('membership', 'tournament', 'equipment', 'ground', 'kit', 'opening_balance', 'other')),
  amount_eur numeric(10, 2) not null check (amount_eur >= 0),
  counterparty text,
  held_by_member_id uuid references public.members (id) on delete restrict,
  receipt_url text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index transactions_season_date_idx on public.transactions (season_id, txn_date);
create index transactions_held_by_idx on public.transactions (held_by_member_id);
create index transactions_created_by_idx on public.transactions (created_by);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid references public.charges (id) on delete restrict,
  member_id uuid not null references public.members (id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  amount_eur numeric(10, 2) not null check (amount_eur > 0),
  method text not null check (method in ('paypal', 'upi', 'cash', 'bank', 'other')),
  reference text,
  received_by_member_id uuid references public.members (id) on delete restrict,
  paid_on date not null default current_date,
  transaction_id uuid references public.transactions (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index payments_charge_idx on public.payments (charge_id);
create index payments_member_idx on public.payments (member_id);
create index payments_received_by_idx on public.payments (received_by_member_id);
create index payments_transaction_idx on public.payments (transaction_id);

create table public.kit_orders (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete restrict,
  jersey_name text not null,
  jersey_number int not null check (jersey_number between 0 and 999),
  shirt_size text not null,
  sleeve text not null check (sleeve in ('half', 'full')),
  pant_size text,
  cap boolean not null default false,
  notes text,
  status text not null default 'requested' check (status in ('requested', 'ordered', 'delivered', 'cancelled')),
  charge_id uuid references public.charges (id) on delete set null,
  created_at timestamptz not null default now()
);
-- A jersey number belongs to one person across seasons; the same person may
-- reorder their own number.
create table public.jersey_numbers (
  team_id uuid not null references public.teams (id) on delete cascade,
  jersey_number int not null check (jersey_number between 0 and 999),
  member_id uuid not null references public.members (id) on delete restrict,
  primary key (team_id, jersey_number),
  unique (team_id, jersey_number, member_id)
);
create index jersey_numbers_member_idx on public.jersey_numbers (member_id);
alter table public.kit_orders
  add constraint kit_orders_number_owner_fkey
  foreign key (team_id, jersey_number, member_id)
  references public.jersey_numbers (team_id, jersey_number, member_id);
create index kit_orders_team_number_idx on public.kit_orders (team_id, jersey_number, member_id);
create index kit_orders_member_idx on public.kit_orders (member_id);
create index kit_orders_charge_idx on public.kit_orders (charge_id);
create index kit_orders_season_idx on public.kit_orders (season_id);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  item text not null check (item in ('ball', 'bat', 'stumps', 'pads', 'gloves', 'helmet', 'other')),
  description text,
  qty int not null check (qty >= 0),
  bought_by_member_id uuid references public.members (id) on delete restrict,
  held_by_member_id uuid references public.members (id) on delete restrict,
  cost_transaction_id uuid references public.transactions (id) on delete set null,
  remarks text,
  updated_at timestamptz not null default now()
);
create index inventory_items_season_idx on public.inventory_items (season_id);
create index inventory_items_bought_by_idx on public.inventory_items (bought_by_member_id);
create index inventory_items_held_by_idx on public.inventory_items (held_by_member_id);
create index inventory_items_cost_txn_idx on public.inventory_items (cost_transaction_id);
