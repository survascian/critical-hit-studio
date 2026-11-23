# Critical Hit Studio

**A production hub built for gaming YouTubers and solo video creators** — combining a distraction-free **Content Planner**, a **Mobile Companion app** with real-time cloud sync, and an **OBS Ranking Overlay** in one lightweight desktop app.

> Built by a solo gaming creator to stay organized without drowning in busywork, bloated templates, or subscriptions.

---

## Download (No Coding Required)

Grab the latest installers directly from the **[Releases](https://github.com/survascian/critical-hit-studio/releases/latest)** page:

| Platform | File | Notes |
| --- | --- | --- |
| **Windows (Installer)** | `Critical-Hit-Studio-*-win-setup.exe` | Adds Desktop & Start Menu shortcuts. *(Windows SmartScreen may show a warning because the app isn't code-signed — click **More info → Run anyway**.)* |
| **Windows (Portable)** | `Critical-Hit-Studio-*-portable.exe` | Run from anywhere, no install needed. |
| **Android (Mobile Companion)** | `Critical-Hit-Studio-*-android.apk` | Sideload onto Android (allow *"Install unknown apps"* once). |

---

## What It Does

### 1. Content Planner (Windows Desktop)
* **9-Stage Production Board:** Track games from `Backlogged` → `Planned` → `Recording` → `Writing` → `Editing` → `Reviewing` → `Published` (plus `Shelved` & `Cancelled`) with drag-and-drop and stage checklists.
* **Fast Quick-Filters & Simple Mode:** Filter by custom Video Format (`Critical Hit List`, `Critical Bite`, `Supercut`, `Funny Moments` — all editable), Platform, or Series. Toggle **Simple Mode** to strip every card down to poster + title/logo + studio.
* **Focused Game Editor (Simple / Advanced):**
  * **Quick-Launch Essentials:** Launch the game (`.lnk`, `.exe`, `steam://`, etc.), open your script (Google Docs *or* local `.docx`/`.md`/`.pdf` file), and jump straight to your project/footage folder.
  * **Zero-Bloat Ideation:** Optional collapsible **Scratchpad** (+ *Your take* and *Cold open*), **Packaging** (3 title candidates with winner picker + thumbnail idea), and one-click **`JOURNAL IT`**.
  * **Game Details & Artwork:** Pull studio, release date, smart-ordered genres, platforms, and time-to-beat from **IGDB**, and pick custom posters, banners, and transparent logos from **SteamGridDB**.
* **Calendar, Journal & Stats:**
  * **Calendar:** Drag-and-drop target dates, upload-day slot highlights, and one-click `.ics` export for Google Calendar.
  * **Journal:** Standalone dated studio notes linked to your games.
  * **Stats & Recaps:** Monthly & Year-End Recap cards (published count, hours played, video views, awards, format breakdown, `Copy recap`), pipeline bottleneck charts (*Where the Time Goes*), and YouTube channel snapshot.
* **Customizable Themes:** Switch live between **Vanilla** (custom accent colour), **ISAC // SHD** (Division 2 frosted-glass HUD), and **Discord** (Dark + Blurple). Optional toggles for the Hit List tab and numeric `/10` scores (off by default).

### 2. Android Mobile Companion (`.apk`)
* **Built for phones, not a squished desktop page:** Bottom tab bar (`Board`, `Calendar`, `Journal`, `Stats`), floating `+` button, and a focused mobile Game Sheet (PC-only launchers and OBS controls stay out of the way).
* **Press-and-Hold 8-Icon Stage Mover:** Press and hold any game card (or tap `⇄`) to float it above a 3×3 grid of the other 8 stages around a center `✕` Cancel button — slide your thumb onto a stage and release to move (with haptic feedback and Undo).
* **Real-Time Cloud Sync (Optional):** Create a free account inside **Settings → Data & Backup → Cloud Sync** on PC and sign in on Android to sync your board, journal, and game posters live in both directions. *(Don't want an account? Skip login — the desktop app works 100% locally.)*

### 3. Critical Hit List (OBS Ranking Overlay)
* **Built-in OBS Overlay:** Control your ranked game list live or recorded straight from the app, synced to OBS in real time.
* **Subjective Awards & Polish:** Uniform 92px rows, custom logo/banner fitting, 3 award styles (*Laurel wreath*, *Medal*, *Neon hex*) with held pop-in animation (`A`), and arrow-key panning.
* **Head-to-Head (`VS`) Compare Overlay:** Spoiler-free banner + logo showdown with staged intros (`V`) and 3 live-switchable victor animations (`1` / `2`): *Knockout Smash*, *Golden Coronation*, and *Critical Hit Slash*.

---

## Optional Setup Guides

Everything works out of the box with manual entry. When you want extras:

### OBS Browser Source
While Critical Hit Studio is running on PC, add a **Browser Source** in OBS:
* **URL:** `http://localhost:8787/hitlist?display=1`
* Leave **Local file** unticked. Control it from the app's **Critical Hit List** tab.

### IGDB Game Metadata (Free)
1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console) (Twitch requires 2FA) and click **Register Your Application**.
2. Set OAuth Redirect URL to `http://localhost`, Category to *Application Integration*, Client Type to *Confidential*.
3. Copy your **Client ID** and generate a **New Secret**, then paste both into **Settings → IGDB & Art** and click **Test connection**.

### SteamGridDB Artwork & YouTube Stats (Free)
* **SteamGridDB:** Paste a free API key from `steamgriddb.com/profile/preferences/api` in **Settings → IGDB & Art** to browse custom posters, banners, and transparent logos.
* **YouTube:** Link your `@handle` in **Settings → YouTube** for a top-bar channel avatar and one-click YouTube Studio link. Add an optional free YouTube Data API v3 key to pull public upload lists and video/channel stats.

---

## Privacy & Where Your Data Lives

* **Local-first on PC:** All planner data, daily backups (last 30 kept), cached art, and API keys live in `%APPDATA%\Critical Hit Studio\`.
* **API keys never leave your PC:** Your Twitch/IGDB, SteamGridDB, and YouTube keys are stored only in local `settings.json` and are never uploaded to Cloud Sync.
* **Cloud Sync is opt-in:** Each user's synced planner is isolated to their own account via Firestore security rules.

---

## Running from Source (Developers)

```bash
npm install      # first time only
npm start        # run Electron desktop app
npm test         # run all 10 automated test suites (uses local fake APIs, no keys needed)
npm run dist     # build Windows NSIS installer & portable .exe into dist/
```

No Electron? Run `start-browser-mode.bat` (or `node server/server.js`) to open the app in your browser at `http://localhost:8787/`.

---

## Changelog

### v2.2.0 — Thumbnail Previews, Multi-Format / Parts & One-Click Updater
* **3 Thumbnail Versions + YouTube Preview:** Attach up to 3 thumbnail images right inside **Packaging**, pick a winner, and preview them large or at realistic YouTube feed card size with your chosen title.
* **Multi-Format Cards, Split & `+ Add Part`:** Toggle multiple video formats on a single card while recording (e.g. `HIT LIST` + `SUPERCUT`), then click **Split** if you end up making both—or click **`+ Add Part`** for multi-part Supercuts (`PT 1`, `PT 2`…) without double-counting Hours Played.
* **Built-In GitHub Updater:** Automatically checks GitHub Releases on launch with a top-bar update badge, one-click **Download & Install** on Windows, and an **Update APK** alert on Android.
* **Fire Hype Indicator:** Moved Public Hype under the Ownership label on the left of each board card as fire symbols (`🔥`).

### v2.1.0 — Mobile Companion App, Cloud Sync & In-App Changelog
* **Mobile Companion UI (`/mobile`) & Android `.apk`:** Purpose-built touch UI packaged via Capacitor + automated GitHub Releases.
* **8-Icon + Center `✕` Floating Stage Mover:** Press and hold any game card (or tap `⇄`) to slide-drop into any of the other 8 stages with haptics and Undo.
* **Real-Time Cloud Sync (Optional):** Free Email/Password sync between PC and Android, with per-item timestamp merging and automatic poster sync.
* **In-App Changelog:** Added a **Changelog** tab inside Settings.
* **Security Hardening:** Strict `http:`/`https:` validation for external links and exact origin/port checks on local API writes.

### v2.0.0 – v2.0.2 — Themes & Quick-Filter Polish
* Added **Vanilla**, **ISAC // SHD**, and **Discord** themes in **Settings → Appearance** (server-side applied with zero flash; Hit List board/OBS overlay stays untouched).
* Moved Filter, Hide Archived, and Simple Mode controls to the right side of the quick-filter bar and improved pill contrast across themes.

### v1.9.0 – v1.9.3 — Personalization, Recap, Simple Mode & VS Overlay
* Introduced the spoiler-free **Head-to-Head (`VS`)** overlay with staged reveals (`V`) and 3 victor animations (*Knockout Smash*, *Golden Coronation*, *Critical Hit Slash*).
* Added **Simple Board Mode**, collapsible Game Editor sections, 2-pane sidebar Settings, customizable Vanilla accent colour, optional Hit List & Numeric Scores toggles, editable Video Formats & Ownership labels, 2-step Quick Setup wizard, Quick-Filter bar, Series grouping, Project/Footage folder picker, Import Recent YouTube Uploads, and **Monthly & Year-End Recaps**.

### v1.8.0 – v1.8.5 — Streamlined Editor, Journal & YouTube Linking
* Streamlined the Game Editor to a balanced 50/50 Advanced layout, optional collapsible Scratchpad (+ *Your take* / *Cold open*), and one-click `JOURNAL IT`.
* Added YouTube channel linking (`@handle`), cached top-bar avatar, deep-linked YouTube Studio buttons, public uploads dropdown, local PC script file picker, standalone **Journal** tab, `.ics` Google Calendar export, and automatic logo trimming.

<details>
<summary>Earlier Releases (v1.3.0 – v1.7.0)</summary>

* **v1.7.0:** Days-in-stage alerts for Writing/Editing, Packaging (3 title candidates + thumbnail idea), Timely flag, upload schedule slots, and *Where the time goes* Stats.
* **v1.6.5:** Red `Cr` app icon, live version display, uniform 92px Hit List rows, and zero-flicker font loading.
* **v1.6.0:** Per-entry Hit List award layouts (Laurel, Medal, Neon Hex), held pop-in animation (`A`), arrow-key panning, and Ownership labels.
* **v1.5.0:** Subjective Hit List Special Awards and planned awards in the Planner.
* **v1.4.0 – v1.4.5:** Game launcher shortcuts, Calendar drag-and-drop, customizable board card chips, SteamGridDB art picker, and unified top bar.
* **v1.3.0:** IGDB theme-aware genre ordering, stage checklists, YouTube video stats, Stats view, and 10-second Delete Undo.

</details>
