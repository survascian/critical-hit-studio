# Critical Hit Studio

A production hub for video-game creators, combining a **Trello-style Content Planner**, an **Android Mobile Companion** with real-time cloud sync, and the **Critical Hit List** OBS ranking overlay.

- **Planner (Desktop):** Nine-stage production board (`Backlogged`, `Planned`, `Recording`, `Writing`, `Editing`, `Reviewing`, `Published`, `Shelved`, `Cancelled`), Calendar with `.ics` export, Journal, Stats & Monthly/Year-End Recaps, YouTube channel & stats linking, IGDB metadata, SteamGridDB artwork, and 3 UI themes (**Vanilla**, **ISAC // SHD**, **Discord**).
- **Mobile Companion (Android `.apk` / `/mobile`):** Purpose-built touch UI with a bottom tab bar (`Board`, `Calendar`, `Journal`, `Stats`), focused Game Sheet, and a press-and-hold **8-icon + center `✕`** floating stage mover.
- **Cloud Sync (Optional):** Free real-time PC ↔ Phone sync via email & password (Firebase), while keeping local-first `planner.json` storage and daily backups on PC.
- **Critical Hit List (OBS Overlay):** Live-controlled ranking board with uniform 92px rows, subjective award laurels, and a spoiler-free **Head-to-Head (`VS`)** compare overlay.

---

## Run It (Windows)

1. Install **Node.js LTS** from https://nodejs.org
2. Open a terminal in this folder and run `npm install` (first time only).
3. Run `npm start` to open the desktop app.

To build the Windows installer & portable `.exe`: `npm run dist` (output appears in `dist/`). Windows SmartScreen may warn because the app is not code-signed — choose *More info → Run anyway*.

No Electron? `start-browser-mode.bat` runs the same app in your browser (needs only Node).

## Android Mobile App (`.apk`)

The Android companion app is built automatically via Capacitor in GitHub Actions (`.github/workflows/build-apk.yml`):

1. Open the repository's **Actions** tab and download the latest **`Critical-Hit-Studio-Mobile-APK`** artifact.
2. Unzip and install `Critical-Hit-Studio-Mobile.apk` on your Android phone.
3. Sign in with the same email & password you use in **Settings → Data & Backup → Cloud Sync** on PC.

## Connect IGDB (Free, Optional)

IGDB is run by Twitch and uses a free developer app:

1. Go to https://dev.twitch.tv/console and sign in (Twitch requires 2FA).
2. **Register Your Application**: any name, OAuth Redirect URL `http://localhost`, Category *Application Integration*, Client Type *Confidential*.
3. Open **Settings → IGDB & Art**, paste your **Client ID** and **Client Secret**, then click **Save** and **Test connection**.

## OBS Browser Source

While the app is running, add a **Browser Source** in OBS with URL:

`http://localhost:8787/hitlist?display=1`

Leave *Local file* unticked. Control it from the app's **Critical Hit List** tab. (Port **8787** is fixed on purpose so OBS and the Hit List's browser storage stay consistent.)

## Where Your Data Lives

Windows: `%APPDATA%\Critical Hit Studio\`

- `planner.json` — your board, checklists, formats, and journal (auto-saved; daily backups in `backups\`, last 30 kept)
- `backups\hitlist-latest.json` — automatic safety copy of the Hit List & Pre-Launch list
- `settings.json` — local API keys, theme, and channel settings (stored on your PC only)
- `media\` — locally cached IGDB/SteamGridDB art and channel avatar

Run `npm test` to execute the automated test suite against fake local IGDB/YouTube/SteamGridDB servers (no credentials required).

---

## Changelog

### v2.1.0 — Mobile Companion App & Cloud Sync
- **Mobile Companion UI (`/mobile`) & Android `.apk`:** Purpose-built mobile layout packaged with Capacitor via GitHub Actions (no Android Studio required).
- **8-Icon + Center `✕` Floating Stage Mover:** Press and hold any game card (or tap `⇄`) to float the card and slide onto any of the 8 other stages around a center Cancel button, with haptic feedback and 6-second Undo.
- **Mobile Navigation & Focused Editor:** Bottom tab bar (`Board`, `Calendar`, `Journal`, `Stats`), floating `+` button, and a streamlined mobile Game Sheet (PC-only launchers and OBS Hit List cleanly omitted).
- **Real-Time Cloud Sync (Optional):** Email/Password account sync (Firebase) in **Settings → Data & Backup** and on Mobile, with per-game/per-note timestamp merging and automatic poster sync (`coverRemote` + compact thumbnails).
- **In-App Changelog:** Added a **Changelog** tab inside Settings so users can see release notes right in the app.

### v2.0.0 – v2.0.2 — Themes & Quick-Filter Polish
- Added 3 UI themes in **Settings → Appearance**: **Vanilla**, **ISAC // SHD** (The Division 2 frosted-glass HUD), and **Discord** (Dark + Blurple), applied server-side with zero load flash.
- Scoped themes strictly to the Planner and the Hit List top bar (`.sbar`) so the Hit List board and OBS overlay stay completely untouched.
- Moved Filter, Hide Archived, and Simple Mode controls to the right side of the quick-filter bar and improved pill contrast across ISAC and Discord themes.

### v1.9.3 — Spoiler-Free VS Cards & Simple Board Mode
- **Spoiler-free Head-to-Head (`VS`) cards:** Shows only the banner and centered logo (auto-loading Planner logos).
- **3 Victor Animation Styles** (hotkeys `1` / `2`, switchable live, mirrored to OBS): *Knockout Smash*, *Golden Coronation*, and *Critical Hit Slash*.
- **Simple Board Mode toggle:** Strips every Planner card down to poster + title/logo + studio only.

### v1.9.2 — Collapsible Editor & Staged VS Reveals
- Made every section in the Game Editor collapsible (`<details>`).
- Removed 9:16 Vertical Reveal Mode from the Hit List.
- Added staged VS intros (press `V` to fly in contenders one at a time) and victor crowning (`1` / `2`).

### v1.9.1 — 2-Pane Settings & Essentials Reorder
- Redesigned Settings into a 2-pane sidebar modal (*Appearance*, *Workflow*, *YouTube*, *IGDB & Art*, *Data & Backup*).
- Reordered Essentials quick-launch rows: **App Launch → Script → Project / Footage Folder**.
- Locked app branding to **Critical Hit Studio**.

### v1.9.0 — Personalization, Quick-Filters, Recap & VS Compare
- Added customizable Vanilla accent colour, optional Hit List tab toggle, and optional Numeric Scores toggle (off by default).
- Added editable Video Formats, editable Ownership labels, and a 2-step Quick Setup wizard on empty boards.
- Added the Quick-Filter bar (Format pills + Platform & Series dropdowns), Series grouping, Project/Footage folder picker, and **Import recent YouTube uploads**.
- Added **Monthly & Year-End Recap** card in Stats with `Copy recap`.
- Introduced the **Head-to-Head (`VS`)** Compare overlay on the Critical Hit List.

### v1.8.4 – v1.8.5 — Channel Avatar, Local Scripts & Public Uploads
- Ordered top-right controls as Channel Avatar → YouTube Studio → Settings, with local avatar caching.
- Added toggle for the video buffer bar in Settings (off by default).
- Added local PC script file picker (`Browse…`) alongside Google Docs links, plus a public YouTube uploads dropdown in Publishing.
- Fixed a regex escape bug in `planner.js` (v1.8.5).

### v1.8.3 — YouTube Channel Linking & 50/50 Advanced Layout
- Balanced the Advanced Game Editor into a 50/50 two-column layout.
- Added YouTube channel linking (`@handle` or URL), top-bar handle & deep-linked YouTube Studio button, per-video `Studio ↗`, and Stats channel snapshot.

### v1.8.1 – v1.8.2 — Editor Streamlining
- Removed manual moment-to-moment timestamping, clip-budget trackers, Video Plan, Beat Outline, and *After It's Up* sections.
- Replaced with an optional collapsible **Scratchpad** (auto-migrating legacy moments) with *Your take* and *Cold open* underneath.
- Simplified Simple mode to Essentials + Game Details and replaced the inline editor Journal box with a one-click **`JOURNAL IT`** button.

### v1.8.0 — Video Formats, Journal & Google Calendar Export
- Introduced Video Formats (`Critical Hit List`, `Critical Bite`, `Supercut`, `Funny Moments`), Simple/Advanced editor modes, standalone **Journal** tab, `.ics` Google Calendar export, and automatic logo margin trimming.
- Removed Viewer Requests.

### v1.7.0 — Pipeline Insights & Upload Cadence
- Added days-in-stage alerts for Writing and Editing (yellow at 7 days, red at 14), **Packaging** (3 title candidates + thumbnail idea), **Timely** flag, upload schedule slots on Calendar, and *Where the time goes* in Stats.

### v1.6.5 — Uniform Hit List Rows & Branding
- Added the red `Cr` app icon and live version display in the top bar.
- Standardized every Hit List entry to a uniform 92px height with zero-flicker font loading.

### v1.6.0 — Award Layouts & Arrow-Key Panning
- Added per-entry award layouts with 3 looks (*Laurel wreath*, *Medal*, *Neon hex*), held pop-in animation (hotkey `A`), arrow-key panning, and Ownership labels (`Owned` / `Shanks`).

### v1.5.0 — Hit List Special Awards
- Added subjective Special Awards (GOTY, Best Action/Horror/RPG/Indie/Story, custom, yearly or all-time) and planned awards in the Planner.

### v1.4.0 – v1.4.5 — Launchers, SteamGridDB & Shared Top Bar
- Added game launch shortcuts (`.lnk`, `.url`, `.exe`, `steam://`, etc.), Calendar drag-and-drop, customizable board card chips, SteamGridDB poster/banner/logo picker, and a unified top bar across all views.

### v1.3.0 — Genres, Checklists, Stats & Undo
- Added IGDB theme-aware genre ordering, stage checklists, YouTube video stats, Stats view, 10-second Delete Undo, and Published → Send to Hit List prompts.
