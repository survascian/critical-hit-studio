'use strict';
// Critical Hit Studio release notes — displayed in Settings → Changelog.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CHL_CHANGELOG = api;
}(typeof self !== 'undefined' ? self : this, function () {
  return [
    {
      version: '2.2.1',
      title: 'Full YouTube Thumbnail Safe-Area & Multi-Device Checker',
      items: [
        'Upgraded the in-editor Thumbnail Preview into a full YouTube Thumbnail Checker with 5 live views: Safe Area, Desktop Home, Desktop Sidebar (168px), Mobile Feed, and TV Preview.',
        'Added toggleable YouTube overlays: 10% Text Safe Margins, Duration Badge (Standard / Long-form / LIVE / Custom), Desktop Hover Actions (Watch Later + Queue), and Watched Progress Bar.',
        'One-click title candidate switcher (T1 / T2 / T3) + live title testing alongside your real channel avatar and handle.'
      ]
    },
    {
      version: '2.2.0',
      title: 'Thumbnail Previews, Multi-Format / Parts & One-Click Updater',
      items: [
        'Attach up to 3 thumbnail versions (PNG/JPG/WebP) inside Packaging with winner picker and a built-in YouTube feed card preview.',
        'Multi-format toggle pills per card (tag a recording game as both Hit List & Supercut), plus one-click Split into separate cards and + Add Part (PT 1 / PT 2 badge, without double-counting Hours Played).',
        'Built-in GitHub Releases Updater: automatic update badge in the top bar, one-click Download & Install on Windows, and APK update alerts on Android.',
        'Moved the Public Hype indicator under Ownership on the left of board cards as fire symbols (🔥).'
      ]
    },
    {
      version: '2.1.0',
      title: 'Mobile Companion App & Cloud Sync',
      items: [
        'Mobile Companion UI (/mobile) & Android .apk build pipeline via Capacitor + GitHub Actions.',
        'Press-and-hold 8-icon + center ✕ floating stage mover (plus one-tap ⇄ move button) with haptic feedback and Undo.',
        'Bottom tab bar (Board, Calendar, Journal, Stats), floating + button, and focused mobile Game Sheet (no desktop/OBS clutter).',
        'Optional real-time Firebase Cloud Sync (Email/Password login) in Settings → Data & Backup and on Mobile, with automatic PC ↔ Phone poster sync.',
        'Added this in-app Changelog tab in Settings.'
      ]
    },
    {
      version: '2.0.0 – 2.0.2',
      title: 'Themes & Quick-Filter Polish',
      items: [
        'Added 3 distinct UI themes in Settings → Appearance: Vanilla, ISAC // SHD (The Division 2 frosted-glass HUD), and Discord (Dark + Blurple).',
        'Themes apply server-side with zero load flash and style only the Planner and Hit List top header—leaving the Hit List board and OBS overlay untouched.',
        'Moved Filter, Hide Archived, and Simple Mode controls to the right side of the quick-filter bar and improved pill contrast across ISAC and Discord themes.'
      ]
    },
    {
      version: '1.9.3',
      title: 'Spoiler-Free VS Cards & Simple Board Mode',
      items: [
        'Head-to-Head (VS) overlay now displays only the banner and centered logo for a clean, spoiler-free reveal.',
        'Added 3 live-switchable victor animations (mirrored to OBS): Knockout Smash, Golden Coronation, and Critical Hit Slash.',
        'Added Simple Mode toggle on the Planner board to strip every card down to poster + title/logo + studio only.'
      ]
    },
    {
      version: '1.9.2',
      title: 'Collapsible Editor & Staged VS Reveals',
      items: [
        'Made every section in the Game Editor collapsible.',
        'Removed 9:16 Vertical Reveal Mode from the Hit List.',
        'Added staged Head-to-Head (VS) intros (press V to fly in contenders one at a time) and victor crowning (hotkeys 1 / 2).'
      ]
    },
    {
      version: '1.9.1',
      title: '2-Pane Settings & Essentials Reorder',
      items: [
        'Redesigned Settings into a clean 2-pane sidebar modal (Appearance, Workflow, YouTube, IGDB & Art, Data & Backup).',
        'Reordered Essentials quick-launch rows: App Launch → Script → Project / Footage Folder.',
        'Locked app branding to Critical Hit Studio.'
      ]
    },
    {
      version: '1.9.0',
      title: 'Personalization, Quick-Filters, Recap & VS Compare',
      items: [
        'Customizable Vanilla accent colour, optional Hit List tab toggle, and optional Numeric Scores toggle (off by default).',
        'Editable Video Formats and Ownership labels, plus a 2-step Quick Setup wizard on empty boards.',
        'Added Quick-Filter bar (Video Format pills + Platform & Series dropdowns), Series grouping, Project/Footage folder picker, and Import Recent YouTube Uploads.',
        'Added Monthly & Year-End Recap card in Stats with Copy Recap.',
        'Introduced the Head-to-Head (VS) Compare overlay on the Critical Hit List.'
      ]
    },
    {
      version: '1.8.4 – 1.8.5',
      title: 'Channel Avatar, Local Scripts & Public Uploads Picker',
      items: [
        'Added local caching for your linked YouTube channel avatar in the top bar (Channel Avatar → YouTube Studio → Settings).',
        'Added toggle for the video buffer bar in Settings (off by default).',
        'Added local PC script file picker (Browse…) alongside Google Docs links, plus a public YouTube uploads dropdown in Publishing.',
        'Fixed a regex escape bug in planner.js (v1.8.5).'
      ]
    },
    {
      version: '1.8.3',
      title: 'YouTube Channel Linking & 50/50 Advanced Layout',
      items: [
        'Balanced the Advanced Game Editor into a clean 50/50 two-column layout.',
        'Added YouTube channel linking (@handle or URL) with top-bar handle, deep-linked YouTube Studio button, per-video Studio ↗ link, and Stats channel snapshot.'
      ]
    },
    {
      version: '1.8.1 – 1.8.2',
      title: 'De-bloating the Editor',
      items: [
        'Stripped out manual Moments timestamping, clip-budget trackers, Video Plan, Beat Outline, and After It\'s Up bloat.',
        'Replaced with an optional collapsible Scratchpad (auto-migrating any legacy moments) with Your Take and Cold Open inside.',
        'Streamlined Simple mode to Essentials + Game Details and replaced the inline editor Journal box with a one-click JOURNAL IT button.'
      ]
    },
    {
      version: '1.8.0',
      title: 'Video Formats, Journal & Google Calendar Export',
      items: [
        'Introduced Video Formats, Simple/Advanced editor modes, standalone Journal tab, .ics Google Calendar export, and automatic logo margin trimming.',
        'Removed Viewer Requests.'
      ]
    },
    {
      version: '1.6.0 – 1.7.0',
      title: 'Award Layouts, Held Pop Animation & Pipeline Insights',
      items: [
        'Added per-entry Hit List award layouts (3 looks: Laurel, Medal, Neon Hex), held pop-in animation (hotkey A), arrow-key panning, and uniform 92px entry rows.',
        'Added days-in-stage alerts for Writing/Editing, upload schedule slots, and "Where the time goes" Stats.',
        'Added the red Cr app icon, version display in the top bar, and zero-flicker font loading.'
      ]
    },
    {
      version: '1.3.0 – 1.5.0',
      title: 'Foundation: Awards, SteamGridDB, Launchers & IGDB',
      items: [
        'Added Hit List Special Awards, SteamGridDB poster/banner/logo picker, game launcher shortcuts, Calendar drag-and-drop, and customizable board card chips.',
        'Added IGDB theme-aware genre ordering, stage checklists, YouTube video stats, Stats view, and 10-second Delete Undo.'
      ]
    }
  ];
}));
