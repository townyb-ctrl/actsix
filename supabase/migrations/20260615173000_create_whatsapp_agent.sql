create table if not exists public.whatsapp_agent_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid null references public.people(id) on delete set null,
  phone_number text not null,
  display_name text not null default '',
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (workspace_id, phone_number)
);

create table if not exists public.whatsapp_agent_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid null references public.workspaces(id) on delete set null,
  identity_id uuid null references public.whatsapp_agent_identities(id) on delete set null,
  phone_number text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null default '',
  intent text not null default 'unknown',
  response_body text not null default '',
  provider text not null default 'whatsapp',
  provider_message_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists whatsapp_agent_identities_user_idx
  on public.whatsapp_agent_identities(auth_user_id, status);

create index if not exists whatsapp_agent_identities_phone_idx
  on public.whatsapp_agent_identities(phone_number, status);

create index if not exists whatsapp_agent_messages_workspace_idx
  on public.whatsapp_agent_messages(workspace_id, created_at desc);

alter table public.whatsapp_agent_identities enable row level security;
alter table public.whatsapp_agent_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_agent_identities'
      and policyname = 'Users can read their WhatsApp agent identities'
  ) then
    create policy "Users can read their WhatsApp agent identities"
      on public.whatsapp_agent_identities
      for select
      to authenticated
      using (
        auth_user_id = auth.uid()
        or exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = whatsapp_agent_identities.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_agent_identities'
      and policyname = 'Workspace admins can manage WhatsApp agent identities'
  ) then
    create policy "Workspace admins can manage WhatsApp agent identities"
      on public.whatsapp_agent_identities
      for all
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = whatsapp_agent_identities.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor')
        )
      )
      with check (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = whatsapp_agent_identities.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
            and wm.role in ('admin', 'editor')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_agent_messages'
      and policyname = 'Workspace members can read WhatsApp agent messages'
  ) then
    create policy "Workspace members can read WhatsApp agent messages"
      on public.whatsapp_agent_messages
      for select
      to authenticated
      using (
        exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = whatsapp_agent_messages.workspace_id
            and wm.auth_user_id = auth.uid()
            and wm.status = 'active'
        )
      );
  end if;
end $$;
