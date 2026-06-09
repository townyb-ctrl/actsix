create or replace function public.update_my_training_assignment_progress(
  target_assignment_id uuid,
  next_progress integer,
  next_status text
)
returns public.training_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_assignment public.training_assignments;
  clean_progress integer;
  clean_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  clean_progress := greatest(0, least(100, coalesce(next_progress, 0)));
  clean_status := coalesce(next_status, 'Not Started');

  if clean_status not in ('Not Started', 'In Progress', 'Complete') then
    raise exception 'Invalid training status';
  end if;

  update public.training_assignments ta
  set
    progress = clean_progress,
    status = clean_status,
    completed_at = case
      when clean_status = 'Complete' then coalesce(ta.completed_at, now())
      else null
    end,
    updated_at = now()
  where ta.id = target_assignment_id
    and exists (
      select 1
      from public.people p
      where p.id = ta.person_id
        and p.workspace_id = ta.workspace_id
        and p.auth_user_id = auth.uid()
    )
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = ta.workspace_id
        and wm.auth_user_id = auth.uid()
        and wm.status = 'active'
    )
  returning * into updated_assignment;

  if updated_assignment.id is null then
    raise exception 'Training assignment not found';
  end if;

  return updated_assignment;
end;
$$;

grant execute on function public.update_my_training_assignment_progress(uuid, integer, text) to authenticated;
