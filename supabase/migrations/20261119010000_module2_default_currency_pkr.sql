-- Pakistan-first intake: default newly created projects to PKR.
alter table public.projects
  alter column budget_currency set default 'PKR';
