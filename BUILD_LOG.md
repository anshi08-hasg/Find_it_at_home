# Build Log: Find It at Home!

A multiplayer "find it in your house" game for 2–6 players, with a detective case-file look.
Node.js server (`server.js`) using WebSockets, with a plain HTML/CSS/JS frontend in `public/`.

**Live site:** https://find-it-at-home.onrender.com
**Repo:** https://github.com/anshi08-hasg/Find_it_at_home

All work below was done on **9 October 2026**.

---

## 1. Project committed to GitHub
**Commit:** `d486352`

- Committed the app files that were in the folder: `server.js`, `challenges.js`, `package.json`, `package-lock.json`, `.gitignore`, the `public/` folder and the updated `README.md`.
- `node_modules/` is excluded by `.gitignore`.
- Checked every file for passwords, API keys and tokens before pushing. None were found.

## 2. Ran the game locally
- Installed the one dependency (`ws`) with `npm install`.
- Started the server with `npm start`. It runs at http://localhost:3000, and phones on the same Wi-Fi can open the computer's local address.

## 3. Name placeholder and invite links
**Commit:** `e181ba8`

- **Name field:** changed the placeholder from "e.g. Sourajeet" to "Enter your name".
- **Invite link:** opening the game at `localhost` used to produce a `localhost` invite link, which doesn't work on other devices.
  - The server now sends its Wi-Fi address to each browser when it connects.
  - When the page is opened at `localhost`, the invite link and the "Everyone opens…" line use that Wi-Fi address instead.
  - On the public site, the link uses the site's own address.

## 4. Deployment
- **Railway:** tried first. The repo didn't appear because Railway's GitHub app only had access to some repos. This was not pursued further.
- **Vercel:** not suitable. The game needs a server that stays running, holding live WebSocket connections and keeping games in memory. Vercel only runs code in short bursts, so it can't do that without a large rewrite.
- **Render (chosen):** free, supports WebSockets, and needed no code changes.
  - Service type: Web Service. Runtime: Node. Branch: `main`.
  - Build command: `npm install`. Start command: `node server.js`.
  - Instance: Free ($0/month).
  - First deploy succeeded from `e181ba8`.
  - **Free-plan limits:**
    - The app sleeps after about 15 minutes with no visitors, and the next visit takes about 30–50 seconds to load.
    - A game that's in progress is lost if the app sleeps or restarts.

## 5. Shorter How to Play, levels and dashes
**Commit:** `9c6ebbc`

Rewrote the How to Play pop-up so it can be read quickly:

| Section | Before | After |
|---|---|---|
| Goal | 2-sentence paragraph | One line: "Find it. Snap it. Upload first. Win the round." |
| Game flow | 9 numbered steps | 4 short steps in a 2-column grid |
| Levels | One dense paragraph | Stacked list: 1. Word Hunt, 2. Riddle Hunt, 3. Learn & Find, each with a short example |
| Emoji check | 10 labelled emojis and a paragraph | 3 rows: Approve, Reject / retake, Not sure |
| Scoring | 5 sentences | One line |
| Safety | 5 sentences | One line with ⚠️ |

Also:
- Removed the "50% physical · 50% digital…" line from the first screen.
- Removed em dashes from every message players see, in both the frontend and the server. Most became a full stop or a colon. Code comments were left as they were.

## 6. Join a case on the first screen
**Commit:** `b93709a`

- The first screen now has three buttons: **Play Game**, **Join a case** and **How to play**.
- Removed the "Open a new case / Join a case" tab switcher from the second screen. The game now shows only the form for the button you tapped, with a small folder tab naming it.
- Invite links (`/join/ABCD`) still open the join form with the code filled in.

## 7. Typography and readability
**Commit:** `c573371`

- **Reading font:** the distressed typewriter font (Special Elite) was hard to read at small sizes.
  - All reading text now uses **Courier Prime**, a typewriter font designed for readability. Regular and bold are saved locally so the game works offline.
  - Special Elite is now used only for decoration: the "CASE FILE #001" label and the "Find it. Click it…" line.
- **No faux bold:** the stencil heading font has only one weight, and the browser was faking bold, which made headings smudged. Turned this off globally.
- **Type scale:** labels went from 12px to 13px bold in darker ink; game-mode descriptions from 12px to 14px; option buttons from 15px to 16px; the smallest text from 10–11px to at least 12px; and section spacing from 18px to 24px.
- **Contrast:** darkened the secondary brown text.
- **Layout:** the two game-mode cards now line up at the top, and their example lines line up too.
- Checked with headless Chrome screenshots of the setup screen.

## 8. Animation and sound
**Status:** not yet committed

**Motion rule:** things move only when something happens.
- The page redraws on every server update. Before this change, the screen slide-in and the "SOLVED!" stamp replayed on every vote or player update.
- Now each screen gets one entrance, and each new item animates only the first time it appears.
- Every animation is timed from the moment its element appeared, so a redraw mid-move continues it instead of restarting it.

| Moment | Motion | Sound |
|---|---|---|
| Intro | Case file drops onto the desk, magnifier spins in, title is pressed in, TOP SECRET is stamped, buttons rise one by one | Stamp |
| Picking options | Chips and game-mode cards pop; the chosen avatar hops and wiggles | Soft click |
| Lobby | Each detective's card is pinned to the board with a pin pop; the case tag swings in | Paper and pin |
| Round start | "Case 2 of 5" title card slides across, then the case file unfolds and the clue is pressed onto it | Two knocks and a rising motif |
| Taking a photo | Camera flash; the photo develops like an instant photo | Shutter |
| Upload | Polaroid dips, then flies off the table | Whoosh, then a bell when it arrives |
| Emoji check | Photo is tossed onto the table and the tape goes on; your vote squashes and stretches with a burst ring; other votes pop in | Pop; soft blip for other players' votes |
| Your photo rejected or retake | The message shakes "no" or wobbles | Stamp |
| Last 10 seconds | Timer ticks; the bar flashes | Tick, higher-pitched for the last 5 |
| Round result | SOLVED / UNSOLVED stamp slams and the card takes the hit; the winner hops in; "+1 point" pops; points on the board bump; paper confetti | Stamp, then a bell chime or a muted "wah-wah" |
| Final | 3rd and 2nd podium blocks build, drumroll, 1st block rises, VICTORY stamp, champion lands with a glow, big confetti | Thuds, drumroll, cymbal, fanfare |
| How to Play pop-up | Sheet slides up; closing slides it away | Paper |

**Sound engine (`public/fx.js`):**
- Every sound is generated live in the browser with WebAudio. There are no audio files, so it works offline.
- A soft compressor keeps the loudest moments (stamp, cymbal) from clipping.
- 🔊 / 🔇 toggle in the top bar and on the intro screen. Your choice is remembered.
- No sound plays before the first tap, as browsers require.

**Accessibility:** with the system's "reduce motion" setting on, animations are skipped and everything appears in place. There is no confetti or shake, and the round title card simply fades.

**Tested** with an automated two-player game in headless Chrome: intro, lobby, 3 full rounds, finale and the How to Play pop-up.
- No JavaScript errors.
- No element left invisible after its animation.
- All 19 sound cues run.
- Frames captured mid-animation, which caught and fixed three bugs:
  - the case file showed behind the round title card
  - the clue reveal broke on words that wrap onto two lines
  - the winner's avatar sat beside the stamp instead of below it

---

## Known issues and to-dos
- **Render auto-deploy:** pushes after the first deploy didn't trigger a redeploy. Until this is fixed, use **Manual Deploy → Deploy latest commit** in Render.
  - Check **Settings → Build & Deploy → Auto-Deploy = On Commit**.
  - Check that Render's GitHub app can access this repo.
- **Git author name:** commits show the placeholder name "Your Name". Set it with `git config --global user.name "<your name>"`.
- **Phone-width check:** the new typography wasn't tested at true phone width, because headless Chrome won't render narrower than about 500px. Check it on a real phone.

## How to run locally
```
npm install
npm start
```
Then open http://localhost:3000. Phones on the same Wi-Fi use the address the server prints when it starts.
