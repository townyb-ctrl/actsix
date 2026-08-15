-- Venue Hire slice 9: let a church event say which space it occupies.
--
-- Clash detection between a hire and the church's own diary was impossible
-- because calendar_events only records a free-text `location`. "Main Hall",
-- "main hall" and "Hall (upstairs)" are the same room to a person and three
-- different rooms to a string comparison, so matching on it would both miss
-- real clashes and invent fake ones.
--
-- One nullable column fixes that. An event that names a space is checked
-- exactly; an event that leaves it null is not checked at all, and the clash
-- panel says how many of those it had to skip rather than implying the
-- building is free.
--
-- Deliberately one-way: nothing is mirrored from venue_bookings into
-- calendar_events. Calendar already reads bookings live, and a mirrored copy
-- would drift the moment either side is edited.

alter table public.calendar_events
  add column if not exists space_id uuid null
  references public.venue_spaces(id) on delete set null;

-- Clash lookups are always "this workspace, this space, overlapping this
-- range", and only rows with a space matter.
create index if not exists calendar_events_space_idx
  on public.calendar_events(workspace_id, space_id, starts_at)
  where space_id is not null;
