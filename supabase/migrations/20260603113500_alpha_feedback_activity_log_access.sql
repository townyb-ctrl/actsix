alter table public.activity_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_logs'
      and policyname = 'Users can submit their own alpha feedback'
  ) then
    create policy "Users can submit their own alpha feedback"
      on public.activity_logs
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and entity_type = 'alpha_feedback'
        and action_type = 'feedback_submitted'
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_logs'
      and policyname = 'Developer can read alpha feedback'
  ) then
    create policy "Developer can read alpha feedback"
      on public.activity_logs
      for select
      to authenticated
      using (
        entity_type = 'alpha_feedback'
        and action_type = 'feedback_submitted'
        and exists (
          select 1
          from auth.users developer_user
          where developer_user.id = auth.uid()
            and lower(developer_user.email) = 'brandon@swbc.co.za'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'activity_logs'
      and policyname = 'Developer can update alpha feedback metadata'
  ) then
    create policy "Developer can update alpha feedback metadata"
      on public.activity_logs
      for update
      to authenticated
      using (
        entity_type = 'alpha_feedback'
        and action_type = 'feedback_submitted'
        and exists (
          select 1
          from auth.users developer_user
          where developer_user.id = auth.uid()
            and lower(developer_user.email) = 'brandon@swbc.co.za'
        )
      )
      with check (
        entity_type = 'alpha_feedback'
        and action_type = 'feedback_submitted'
        and exists (
          select 1
          from auth.users developer_user
          where developer_user.id = auth.uid()
            and lower(developer_user.email) = 'brandon@swbc.co.za'
        )
      );
  end if;
end $$;
