# ACTSIX Conventions

## Build & Verify
After any change, verify with:
    npm run build && npm run dev

## Style
- Match existing formatting/naming conventions in the file being edited — don't reformat untouched code
- Keep edits scoped to what was asked; don't refactor adjacent code unless requested
- Prefer minimal diffs over rewriting whole files

## Workflow
- Propose the diff, don't auto-run build/dev commands
- Don't create new files unless explicitly asked
- If a change touches more than 2-3 files, pause and confirm the approach before proceeding
