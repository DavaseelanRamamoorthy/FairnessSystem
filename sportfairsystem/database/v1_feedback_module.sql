create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('Bug', 'Suggestion', 'Improvement', 'Question')),
  module text not null check (char_length(trim(module)) between 1 and 60),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null check (char_length(trim(description)) >= 10),
  priority text not null check (priority in ('Low', 'Medium', 'High')),
  status text not null default 'New' check (status in ('New', 'Reviewed', 'In Progress', 'Closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists feedback_team_created_at_idx
  on public.feedback (team_id, created_at desc);

create index if not exists feedback_user_created_at_idx
  on public.feedback (user_id, created_at desc);

create or replace function public.handle_feedback_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_feedback_updated_at on public.feedback;

create trigger on_feedback_updated_at
before update on public.feedback
for each row execute procedure public.handle_feedback_updated_at();

alter table public.feedback enable row level security;

drop policy if exists "feedback_select_own_scope" on public.feedback;
create policy "feedback_select_own_scope"
on public.feedback
for select
using (
  auth.uid() = user_id
  and team_id = public.current_team_id()
);

drop policy if exists "feedback_insert_own_scope" on public.feedback;
create policy "feedback_insert_own_scope"
on public.feedback
for insert
with check (
  auth.uid() = user_id
  and team_id = public.current_team_id()
);

drop policy if exists "feedback_select_admin_team_scope" on public.feedback;
create policy "feedback_select_admin_team_scope"
on public.feedback
for select
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

drop policy if exists "feedback_update_admin_team_scope" on public.feedback;
create policy "feedback_update_admin_team_scope"
on public.feedback
for update
using (
  public.is_admin_user()
  and team_id = public.current_team_id()
)
with check (
  public.is_admin_user()
  and team_id = public.current_team_id()
);

comment on table public.feedback is 'Structured product feedback submitted by authenticated team users.';
comment on column public.feedback.category is 'Feedback type such as bug, suggestion, improvement, or question.';
comment on column public.feedback.module is 'Product area the feedback relates to.';
comment on column public.feedback.priority is 'Reporter-selected urgency for the feedback item.';
comment on column public.feedback.status is 'Admin-managed review workflow state for the feedback item.';
