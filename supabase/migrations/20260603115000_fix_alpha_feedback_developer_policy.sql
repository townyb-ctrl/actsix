drop policy if exists "Developer can read alpha feedback"
  on public.activity_logs;

drop policy if exists "Developer can update alpha feedback metadata"
  on public.activity_logs;

create policy "Developer can read alpha feedback"
  on public.activity_logs
  for select
  to authenticated
  using (
    entity_type = 'alpha_feedback'
    and action_type = 'feedback_submitted'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'brandon@swbc.co.za'
  );

create policy "Developer can update alpha feedback metadata"
  on public.activity_logs
  for update
  to authenticated
  using (
    entity_type = 'alpha_feedback'
    and action_type = 'feedback_submitted'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'brandon@swbc.co.za'
  )
  with check (
    entity_type = 'alpha_feedback'
    and action_type = 'feedback_submitted'
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'brandon@swbc.co.za'
  );
