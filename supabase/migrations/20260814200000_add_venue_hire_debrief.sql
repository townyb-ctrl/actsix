-- Venue Hire slice 11: what happened afterwards.
--
-- Until now a hire ended and nothing was written down. Whether the hirer left
-- the place clean, whether anything broke, whether we would have them back -
-- all of it lived in somebody's memory until they left the staff team.
--
-- These sit on venue_hires rather than in a debrief table of their own: there
-- is exactly one debrief per hire, and a repeat hire cloned from this one wants
-- to carry the lessons across, which a joined table only makes harder.
--
-- lessons_learned already exists (slice 5) and is deliberately not duplicated.

alter table public.venue_hires
  add column if not exists debrief_notes text not null default '',
  add column if not exists debrief_completed_on date null,
  -- 1-5, null until somebody actually judges it. Not defaulted to 3, because
  -- "nobody has said" and "they were unremarkable" are different facts.
  add column if not exists hirer_rating integer null,
  -- The one question that decides a repeat booking. Null = not answered yet.
  add column if not exists would_host_again boolean null,
  add column if not exists damage_found text not null default '',
  -- What the damage cost to put right. Charged against the bond first; anything
  -- over the bond is the church's loss and is shown as such.
  add column if not exists damage_cost numeric(10,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_hirer_rating_range'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_hirer_rating_range
      check (hirer_rating is null or hirer_rating between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'venue_hires_damage_cost_positive'
  ) then
    alter table public.venue_hires
      add constraint venue_hires_damage_cost_positive
      check (damage_cost >= 0);
  end if;
end $$;
