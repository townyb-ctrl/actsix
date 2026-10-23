# Stageplot for Mac and Windows

The same Stageplot as the web version (`../index.html`), packaged as an app you install. It opens in its own window, works with no internet connection, and saves your weeks on the computer.

## Getting the installers

GitHub builds them on real Mac and Windows machines (workflow `.github/workflows/stageplot-desktop.yml`):

- **Every push** that changes `stageplot/` builds both. On GitHub, open **Actions → Stageplot desktop → the latest run**. The installers are under **Artifacts**: `Stageplot-mac` and `Stageplot-win`. They download as zip files.
- **A release**: push a tag such as `stageplot-v1.0.0`. The same files then appear on the repository's **Releases** page, where anyone with access can download them.

| File | For |
|---|---|
| `Stageplot-1.0.0-mac.dmg` | Any Mac (Apple silicon and Intel) |
| `Stageplot-Setup-1.0.0-x64.exe` | Most Windows PCs |
| `Stageplot-Setup-1.0.0-arm64.exe` | Windows on Arm (Snapdragon, Copilot+ PCs) |

## Installing

**Mac**: open the `.dmg` and drag Stageplot to Applications.
The app isn't signed with an Apple Developer ID yet, so the first time you open it macOS says it can't check it. Click **Done**, open **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to Stageplot. After that it opens normally.

**Windows**: run `Stageplot-Setup-…-x64.exe`. It installs for your user only (no admin password needed) and adds Start menu and desktop shortcuts.
The installer isn't code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway**.

## Your data

- Weeks are saved in the app's own data folder on this computer: `~/Library/Application Support/Stageplot` on Mac, `%APPDATA%\Stageplot` on Windows. Uninstalling the app doesn't delete them.
- The desktop app and the browser version keep **separate** saves. To move weeks between them, use **Home → Data & backup**: download a backup in one and restore it in the other.

## What works differently

- **Planning Center import** only works inside Claude (it uses your Claude connector). In the desktop app, add the team by hand or paste a list.
- Everything else is the same, including printing, PDFs, file downloads (a normal Save dialog), show mode and offline use.
- Links to websites open in your normal browser.

## Building it yourself

You need Node.js 22.

```sh
cd stageplot/desktop
npm ci
npm start            # run it without installing
npm run dist:mac     # on a Mac: dist/Stageplot-…-mac.dmg
npm run dist:win     # on Windows: dist/Stageplot-Setup-….exe
```

`npm run prepare-app` copies `../index.html`, the manifest and the icons into `app/` before each run or build, so the desktop app always carries the current web app. Change `version` in `package.json` for each release.

## Before a wider rollout

- **Mac signing and notarisation** needs an Apple Developer account ($99/year). Add the certificate and notarisation secrets to the workflow, and the "Open Anyway" step goes away.
- **Windows signing** needs a code-signing certificate. Add it as a secret and the SmartScreen warning goes away once the certificate builds a reputation.
- **Automatic updates** aren't set up. For now people install the new version over the old one, and their weeks are kept.
