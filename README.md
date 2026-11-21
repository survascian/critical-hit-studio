# Critical Hit Studio

A desktop app for planning game content and running the **Critical Hit List** overlay.

- **Planner**: a Trello-style board with nine stages (Backlogged, Planned, Recording, Writing, Editing, Reviewing, Published, Shelved, Cancelled). Add games from IGDB; each card pulls in studio, genre, platforms, release date, time to beat and IGDB hype, plus your own "played on", hours played and public-hype rating.
- **Critical Hit List**: the OBS overlay, unchanged, now inside the app. Send any game from the Planner to its Pre-Launch list with one click.

## Run it (Windows)

1. Install **Node.js LTS** from https://nodejs.org
2. Open a terminal in this folder and run `npm install` (once, downloads Electron).
3. Run `npm start` to open the app.

To build a real installer / portable .exe: `npm run dist` (the result appears in `dist/`). Windows may show a "SmartScreen" warning because the app is not code-signed; choose *More info > Run anyway*.

No Electron? `start-browser-mode.bat` runs the same app in your browser (needs only Node, no `npm install`).

## Connect IGDB (free)

IGDB is run by Twitch and needs a free developer app:

1. Go to https://dev.twitch.tv/console and sign in (Twitch requires two-factor authentication on the account).
2. **Register Your Application**: any name, OAuth Redirect URL `http://localhost`, Category *Application Integration*, Client Type *Confidential*.
3. Open the app, click the gear icon, paste the **Client ID**, click **New Secret** on Twitch and paste the secret, then **Save** and **Test connection**.

The test lists each step (Twitch sign-in, search, game details, time to beat) so a failure shows exactly which part is wrong.

## OBS

While the app is running, add a **Browser Source** with URL `http://localhost:8787/hitlist?display=1` (leave "Local file" unticked). Control it from the app's Critical Hit List tab. Add `&debug=1` to the URL to show a small status badge while testing.

The app uses port **8787** and will tell you if it's taken (for example by the older chl-server). The port is fixed on purpose: the Hit List's saved data belongs to that address.

## Where your data lives

Windows: `%APPDATA%\Critical Hit Studio\`

- `planner.json`: the board (saved automatically; a daily copy goes in `backups\`, last 30 kept)
- `backups\hitlist-latest.json`: automatic copy of the Hit List and its Pre-Launch list. Restore with *Import JSON* in the Hit List sidebar
- `settings.json`: IGDB Client ID and Secret, stored in plain text on your computer only
- `media\`: cover and banner images downloaded from IGDB, so the overlay works offline

Moving from the old standalone version: in the old page use **Export JSON**, then **Import JSON** in the new app's Hit List.

## Notes

- "Time to beat" comes from IGDB's own community data. It is not HowLongToBeat (HLTB has no official API).
- "IGDB hype" is the number of people following a game before release. "Public hype" on the card is your own 1 to 5 rating.
- IGDB's terms apply to the data and images. Keep the app for your own use.
- `npm test` runs the backend tests against a fake IGDB (no credentials needed).

## Updating

1. Close Critical Hit Studio (and OBS's browser source can stay as is).
2. Unzip the new `chl-studio.zip` over your existing `chl-studio` folder and choose **Replace files**. Keep your `node_modules` folder.
3. Run `npm start`. No `npm install` is needed unless a release says so.
   If you use the installed `.exe`, run `npm run dist` and reinstall instead.

Your games, settings and IGDB keys live in `%APPDATA%\Critical Hit Studio\`, outside the app folder, so updates never touch them.
Settings → Your data shows the running version (v1.6.5 for this update).

## Adding a platform or logo
Edit `public/platforms.js`: add a line to `LIST` (e.g. Xbox Series X|S or Switch 2). Set `icon` to a logo path later.

## Script links (Google Docs / Drive)
Open a game in the Planner and paste the script's Google Docs link into **Script**. **OPEN SCRIPT** opens it in your browser, and the card shows a **SCRIPT ↗** chip that opens it in one click.
**Find script in Drive** searches your Drive for the game's title. Only docs.google.com and drive.google.com links are accepted.

## Building the Windows installer
On Windows, in this folder: `npm install` (first time only), then `npm run dist`. The installer and a portable .exe appear in `dist/`.
The installer creates Desktop and Start-menu shortcuts. Uninstalling keeps your data in `%APPDATA%\Critical Hit Studio\`.

## New in 1.3
- **Genre order:** IGDB lists gameplay genres (Shooter, Adventure) apart from themes (Horror, Survival). The app now puts a defining theme first (Horror, or Survival Horror when both are listed) and sorts gameplay genres from specific to generic, so RPG and Fighting lead and Adventure and Indie come last. In a game's drawer, tap a chip under **Genre** to make it the headline, or type your own. Genres you set by hand are never overwritten. Old games need **Settings → Re-sync all games from IGDB** once to pick up themes. The rules live in `public/genres.js`.
- **Your score, target date and tags** on every game. Target dates show on the card and the **Calendar** view. Tags/series are searchable in the filter box.
- **Stage checklists:** each stage has a to-do list that games get when they enter it. Edit the defaults in Settings. The card shows `TASKS 2/4`.
- **Published video:** paste the YouTube link to show views on the card. Views, likes and comments need a free YouTube Data API key (Settings → YouTube stats).
- **Stats view:** pipeline, time in stages, average score by platform and genre, hours, video views.
- **Undo:** deleting a game shows an Undo button for 10 seconds.
- **Published prompt:** moving a game to Published offers to send it to the Critical Hit List.

## New in 1.8.0

- **Video format** replaces Tags / Series. Pick Critical Hit List, Critical Bite, Supercut or Funny Moments in a game's editor. The **video plan changes with the format**: Hit List gets Your take, Spoiler line and Where it lands; Bite gets a one-line take; Supercut gets Throughline, Target length and Hours of footage; Funny Moments gets Who was there and The setup. Each format loads its own starter outline when the outline is empty. Games whose old tags mentioned a format were converted automatically.
- **Supercut and Funny Moments clip sorting.** Each logged moment gets a length and a Keep / Maybe / Drop button. A budget bar shows your kept length against the target. Dropped clips stay out of the edit sheet.
- **Bigger editor with Simple and Advanced.** Simple shows the title, stage, format, date, script, video plan and checklist. Advanced widens the window to two columns and adds Moments, Packaging, After it's up, Game details, Publishing and awards, Journal links, Artwork and Launch, and the IGDB facts. Your choice is remembered.
- **Journal** tab: dated entries (the date fills in automatically), a title, a big text area, and linked games. A game's editor lists the entries that mention it.
- **Google Calendar:** the Calendar tab has a "Google Calendar" button that saves a .ics file of every dated video plus your weekly upload days; import it once in Google Calendar (Settings, Import & export). Importing again updates instead of duplicating. Each game also has an "Add date to Google Calendar" link. Live two-way sync would need a Google Cloud project and sign-in, so it is not included.
- **Planned means committed.** The Planned checklist no longer asks about platform or embargo dates, and Planned cards no longer show a countdown to release. Old Planned items were cleaned up.
- **Logos fit their card.** Transparent margins are trimmed and the logo is sized by shape (wide, square, tall), so Lies of P and Halo Wars 2 are no longer tiny.
- **Viewer requests removed.**

## New in 1.7.0 (built for the writing and editing stall)

Open any game and you get a **video plan** right under its details:

- **Angle, cold open, running gags, verdict.** Four short boxes. If you can fill in the angle and the cold open, you can start editing.
- **Outline of beats.** Start from a template (Story arc, Review, Funny/chaos run, Hit List ranking) or add your own. Reorder them, and tick each beat as you cut it.
- **Moments log.** While recording or scrubbing footage, jot a moment (Funny, Clutch, Rage, Bug, Story, Quote) with a time and a line. Assign it to a beat. **Copy edit sheet** turns the plan and moments into plain text to paste into your script doc.
- **Packaging.** Three title candidates (with a length warning past 60 characters), a pick-the-winner circle, and a thumbnail idea.
- **After it's up.** Best moment, what dragged, repeat the format? Two minutes, and the next video is easier.
- **Viewer requests** and a **Timely** flag per game.

On the board, cards in Writing and Editing show **days in stage** (yellow from 7 days, red from 14), plus request and timely chips. All can be switched off in Settings, Board cards.

**Upload schedule** (Settings): tick your upload days and the stage that counts as "ready". A strip under the top bar shows your **buffer** (videos banked, about how many days of uploads they cover) and the next upload day. The calendar marks upload days.

**Stats** gains "Where the time goes" (median days per stage, so you can see where videos stall) and "Most requested by viewers". Stuck cards also show a rough days-to-publish estimate in the tooltip once you have at least 3 finished videos per stage.

Nothing here needs new keys or accounts. Everything is saved with the game in planner.json.

## New in 1.6.5
- **Your icon** is now the app icon: the installer and program icon, the window and taskbar icon, the browser-tab icon, and a small logo at the left of the top bar.
- **Version number under the name.** The top left now reads CRITICAL HIT STUDIO with the version (for example v1.6.5) underneath, on every tab. It is read from `package.json` by the server, so it can't go out of date.
- **Every Hit List entry is exactly the same height** (92 px), with or without awards, so nothing resizes. Awards are scaled to fit inside that height. An entry whose awards are held back reserves the space invisibly, so when they pop in nothing moves and the title doesn't change size. Tag rows no longer wrap onto a second line; if there isn't room, the end of the row fades out.
- **No more font flicker when switching tabs.** Both pages now stay invisible for a split second until their fonts are loaded, instead of drawing the top bar in a stand-in font first.
- The window title now says "Critical Hit Studio" on the Hit List too (it used to say "Critical Hit List - Interactive Ranking Board").
- The top bar's compact layout now starts at 1500 px so the new logo can't crowd the buttons.

## New in 1.6.0
- **Award layouts, per entry.** In an entry's Edit (or New Entry) dialog, once it has an award, you get: Look, Arrangement (side by side or stacked), Size (small, medium, large), Position (right of the entry, or left before the title) and Labels (icon + text, or icon only), with a live preview. Every menu has a "Default" choice, and each entry keeps its own settings. Stacked awards shrink so two of them roughly fit a row; a stacked row is a little taller than a normal one.
- **Three looks.** Laurel wreath, Medal, and Neon hex. Pick the default in the Hit List sidebar under Awards; any entry can override it.
- **Pop the awards in.** With "Hold awards until I pop them" on (the default), a launched entry lands without its awards. Press **A**, or the gold POP AWARDS button that appears on the control page, and the awards spin in with a ring, sparks and a light sweep across the entry. The OBS page pops at the same moment. Turn the setting off to get the old automatic entrance.
- **The dark backing behind awards on the highlighted row is gone.** Gold text on the yellow highlight stays readable through a dark outline instead.
- **Pan the list with the arrow keys.** Left and right change the list's X offset by 10 px (Shift = 50 px), and holding the key keeps going. It does nothing while you are typing in a box or have a slider focused, and the OBS page follows along.
- **Planner: Owned / Shanks.** A new Ownership menu in the game drawer. The choice shows in small text under the poster on the board card (green Owned, orange Shanks). A switch in Settings, Board cards, hides it.

## New in 1.5.0
- **Special awards on the Hit List.** Mark an entry as GOTY, Best Action, Best Adventure, Best Horror, Best RPG, Best Indie, Best Story, or a custom award, either "of the year" (with a year) or "of all time". It shows as a laurel wreath with an icon on the right of the entry. Awards never change the rank. Gold is for GOTY and all-time awards (all-time ones glow); every other category has its own colour. Up to 2 per game (`MAX` in `public/awards.js`).
- **Where you set them.** In the Hit List's New Entry and Edit Entry forms ("Awards"). In the Planner, the game drawer has "Planned Hit List awards": a note that fills in the Send dialog, so the award is already on the entry when you prep it. The Planner itself doesn't show awards on cards.
- A newly inserted award entry pops its laurel in after the entry animation.

## New in 1.4.5
- **One steady top bar.** The bar is now the same height on Board, Calendar, Stats and the Hit List, with the same brand and tabs in the same place (shared file `public/topbar.css`). The filter box only fades out on tabs that don't use it, so nothing jumps. Tabs: BOARD, CALENDAR, STATS, HIT LIST.
- **Score tier colour strip fixed.** It now understands `9/10`, `8,5/10`, `9 out of 10`, `90/100`, `4.5/5`, `95%` and a lone number; it is wider and has a glow. A tag with no number (just "Critical Hit!") still gets no strip, and the Send dialog now says so as you type. Rules live in `public/tier.js`.

## New in 1.4
- **Launch button:** every card has a round play button at the bottom right. Click it once to choose the game's shortcut (a `.lnk`, `.url` or `.exe`); after that it launches the game. You can also paste a store link such as `steam://rungameid/APPID` in the drawer's **Launch shortcut** field. Only shortcuts, programs and store links (Steam, Epic, GOG, Battle.net, Ubisoft, EA, Xbox) are allowed. Browsing for a file works in the desktop app only.
- **Calendar drag and drop:** drag a game onto a day to set its target date, onto another day to move it, or onto "No target date yet" to clear it.
- **Board cards (Settings):** switch individual pieces on or off: studio, cover, platform, year, genre, hype, time to beat, hours, score, target date, tasks, video views, tags, script and launch buttons, "On Hit List". "Title only" hides everything at once.
- **SteamGridDB art:** add your key in Settings, then in a game's drawer pick a **poster**, a **banner** (used for the Critical Hit List) and a **logo**. Tick "Show the logo instead of the title on the board" to use the logo on the card. The send-to-Hit-List dialog also has **Change banner**. Art you pick is kept when you refresh from IGDB; **Reset art** goes back to IGDB's.
