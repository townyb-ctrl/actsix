# Venue Hire — manual verification checklist

This checklist covers everything the Venue Hire module needs verified by hand
in a browser. It merges the deferred browser checks written by the
implementers of Tasks 4, 5, 6, and 7, plus the five edge cases from the Task 8
brief, into one run a human can do start to finish in a single sitting.
Automated checks (typecheck, lint, unit tests, build) were already run and
passed as part of Task 8 — this document is only the parts that need a real
browser and a real database.

## Prerequisite: apply the migration

The database does not yet have the `venue_spaces` / `venue_bookings` tables
or their RPCs. Before starting this checklist:

1. Open the Supabase dashboard for the target project → SQL Editor.
2. Paste in the full contents of
   `supabase/migrations/20260809120000_create_venue_hire.sql` and run it.
3. Confirm it completes without error and that `venue_spaces` and
   `venue_bookings` now appear in the Table Editor, along with the
   `get_venue_request_spaces` and `submit_venue_request` functions.

Do **not** run `npx supabase db push` for this — it currently fails on
unrelated, pre-existing migration-history drift in
`20260617120000_create_recurring_task_templates.sql` that has nothing to do
with this module. Applying the SQL directly through the dashboard is the only
supported path until that drift is separately resolved.

Before this migration was applied, the calendar's `42P01` guard (missing
`venue_bookings` table) was already exercised: `/calendar` loaded with no
visible error toast and no console error naming `venue_bookings`. That
pre-migration state is not re-tested below — every step from here on assumes
the migration is already applied.

## 1. Turn the module on and confirm the sidebar

1. Go to Settings and switch the "Venue Hire" module on (it ships off by
   default). You should see the "Venue Hire" section appear in the sidebar
   under the "Planning" group, between Service Planner and Calendar, with a
   building icon and two sub-items: Bookings and Spaces.
2. Switch "Venue Hire" back off in Settings. The sidebar section should
   disappear.
3. With the module still off, type `/venues` directly into the browser
   address bar. The page should still load normally — module toggles only
   control the sidebar, not routing, matching every other module in the app.
4. Switch "Venue Hire" back on before continuing, since the rest of this
   checklist needs the sidebar links.

## 2. Create a space

1. Visit `/venues/spaces`. With no spaces yet, you should see an empty state
   ("No spaces yet") with an "Add your first space" button.
2. Click it (or "Add space"), fill in Name "Main Hall", a capacity, an
   hourly rate, and a daily rate, then save. It should appear as a card
   showing the capacity and both rates formatted as currency (ZAR).
3. Click "Edit" on the card, change a field (e.g. the capacity), save, and
   confirm the change persists on the card.
4. Check the browser console — no errors should have appeared during any of
   the above.

## 3. Deactivate and reactivate a space

1. On the "Main Hall" card, click "Deactivate". The card should grey out
   (reduced opacity), gain an "Inactive" badge, and the button should flip to
   "Reactivate".
2. Click "Reactivate" and confirm it reverses cleanly.
3. Create a second space (e.g. "Small Room") so later steps have two spaces
   to work with — leave it active.

## 4. Deactivated space behavior in bookings

This step needs a booking to exist first, so create one now if you haven't:
go to `/venues`, click "New booking", and create any booking against "Main
Hall" (fill Title/Space/Starts/Ends, Type "Internal", save).

1. Deactivate "Small Room" (the space with no bookings on it).
2. Go to `/venues`, click "New booking", and open the space picker. "Small
   Room" should not appear in the list — only active spaces should be
   selectable for new bookings.
3. Open the existing booking you created against "Main Hall" above (via the
   bookings list). It should open normally and save normally, even though
   the modal was opened for an existing booking on a space that may have
   been deactivated at some point — deactivation should never block editing
   an existing booking on that space.

## 5. Bookings empty state and internal booking (no money fields)

1. If `/venues` shows no bookings yet for a fresh workspace, confirm the
   empty state reads something like "Add a space first" only when there are
   no active spaces — otherwise it should show its normal empty-bookings
   state, and the "New booking" button should be disabled only when there
   are zero active spaces.
2. Click "New booking". Leave Type as "Internal (no charge)". Fill in
   Title, Space, Starts, and Ends, then save.
3. Open the modal again for a new booking and confirm that with Type left
   on "Internal", none of the money fields (Hirer, Email, Phone, Fee,
   Deposit, Payment) ever render.

## 6. External booking, fee clears on type switch (edge case)

1. Create a new booking, set Type to "External", and fill in the money
   fields including a Fee greater than 0. Save it.
2. Reopen that same booking and switch Type from External back to Internal.
   Save again.
3. Reopen the booking a second time. Confirm all the money fields (Hirer,
   Email, Phone, Fee, Deposit, Payment) are gone from view (Type is
   Internal), and that the stored fee is 0 — not still the old amount.

## 7. Clash warning blocks save

1. Create an external booking on "Main Hall" from 14:00–16:00 on some date,
   with Status "Confirmed".
2. Create a second booking on the same space, same date, 15:00–17:00
   (overlapping the first).
3. While filling in the second booking, confirm a red "Clashes with another
   booking" alert appears, naming the first booking's title, its status
   (e.g. "confirmed"), and its time range.
4. Click "Save booking" without ticking "Book anyway". Confirm you get a
   toast saying it clashes and the booking is not saved.

## 8. Back-to-back bookings need no override

1. On the same space, create a third booking from 17:00–18:00 on the same
   date (starting exactly when the second one ends).
2. Confirm no clash alert appears, and it saves cleanly without ticking
   anything.

## 9. Conflict override does not carry across a changed clash

1. Start creating a new booking on "Main Hall" that overlaps the first
   14:00–16:00 booking (from step 7) — you should see the clash banner
   naming that booking again. Tick "Book anyway".
2. Without saving yet, change the Starts/Ends time so it now overlaps a
   different booking instead (for example the 17:00–18:00 one from step 8).
3. Confirm the clash banner updates to name the new conflicting booking, and
   that the "Book anyway" checkbox has reset to unticked.
4. Click "Save booking" — confirm it is refused (toast shown) since the tick
   does not carry over to the new conflict.
5. Re-tick "Book anyway" and save — confirm it now succeeds.

## 10. Save hirer to Service Contacts

1. Create or edit an external booking, fill in Hirer name, Email, and
   Phone, tick "Also save this hirer to Service Contacts", and save.
2. Navigate to `/people/contacts` and confirm a new contact exists with
   category "Hirer" and the name/email/phone you entered.
3. Note that this checkbox only appears when the booking has no hirer
   contact linked yet — reopening that same booking afterward should not
   show the checkbox again.

## 11. Pending count badge

1. Create or edit a booking with Status set to "Pending".
2. On `/venues`, confirm the "Pending" filter chip shows a badge with the
   correct count.
3. Resolve (change the status of) one Pending booking and confirm the badge
   count updates accordingly.

## 12. Public request link — create and copy

1. On `/venues/spaces`, click "Create link" in the request-link card, then
   "Copy link".
2. Open that copied URL in a private/incognito window (no logged-in
   session). The form should load and list only active spaces — no hourly
   or daily rates should be visible anywhere on this public page.

## 13. Public request form — garbage token (security)

1. In a private/incognito window, visit `/venue-request/` followed by a
   made-up, non-existent token (e.g. `/venue-request/not-a-real-token`).
2. Confirm the page shows only the dead-link message ("This request link is
   no longer active." or equivalent) — no workspace name, no space names,
   and no other page content are shown anywhere, in the page source or
   visibly.

## 14. Public request form — submit a request (security)

1. Using the valid link from step 12, fill in all required fields (space,
   title, name, email, phone if required, start/end where end is after
   start), and submit.
2. Confirm the "Request sent" thank-you screen appears, and that no fee or
   payment field was ever present anywhere on this public form for the
   submitter to set.
3. Back in the app on `/venues`, filter by Pending. Confirm the new request
   appears, badged as a "Request", with no fee set (fee should read as
   unset/zero, not something the anonymous submitter could have supplied).
4. Open it, set Status to Confirmed, add a fee, tick "Also save this hirer
   to Service Contacts", and save. Confirm it saves cleanly and the contact
   is created (per step 10's check).

## 15. Public request form — sanitized error on an unguarded failure (security)

1. Using the still-valid link from step 12, submit a request that trips a
   failure the RPC does not explicitly raise a friendly message for — for
   example a `title` long enough to hit a column length limit, if the table
   has one, or another value that would only fail at the database
   constraint level rather than the RPC's own validation.
2. Confirm the visitor sees only the generic message "We could not send
   your request. Please try again." — not raw Postgres error text (no
   column names, constraint names, or SQL fragments anywhere on the page).
   This exercises the error-message allowlist added in Task 6's review fix
   (commit `5612cfae`), which shows only a fixed set of known-safe RPC
   messages and falls back to the generic string for anything else.

## 16. Revoke the request link

1. Back on `/venues/spaces`, click "Revoke link".
2. Reload the same public URL from step 12 in the private window. Confirm
   only the dead-link message renders now — same no-leak requirement as
   step 13.

## 17. Calendar integration

1. Visit `/calendar`.
2. Confirm confirmed and pending venue bookings appear on their correct
   dates, alongside any calendar events and tasks.
3. Confirm venue items are styled with the amber "venue" color, visibly
   distinct from tasks and from ACTSIX calendar events.
4. Click a venue booking on the calendar. Confirm it navigates to `/venues`
   rather than opening the calendar event-edit form.
5. Confirm no delete (trash) icon appears next to a venue item in the list
   view — venue bookings can't be deleted from the calendar.
6. On `/venues`, set a booking's Status to Cancelled, then reload
   `/calendar`. Confirm the cancelled booking no longer appears.
7. Confirm no console errors appear during any calendar step above.

## 18. General pass

1. Skim back through the browser console for the whole session — no errors
   should have appeared at any point above.
2. Confirm every screen you touched (spaces list, booking modal, public
   request form, calendar) reflects a clean, un-broken UI state with no
   lingering "loading" spinners or stale data after the actions above.
