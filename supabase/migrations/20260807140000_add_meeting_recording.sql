-- Meeting recording -> AI transcript/minutes pipeline. Transcript now lives on
-- the meeting row instead of localStorage (per-browser, never synced); the
-- audio itself lands in a private storage bucket that only the meeting-ai
-- edge function (service role) ever reads or writes, so no client-facing
-- storage RLS policy is needed here.

alter table public.meetings
  add column if not exists transcript text null,
  add column if not exists recording_path text null;

insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do nothing;
