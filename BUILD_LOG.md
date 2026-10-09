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
**Commit:** `c981974`

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

## 9. Solo mode
**Commit:** `ee9ab0e`

- **Starting:** "Solo" is the first option under *How many players?*.
  - The game-mode picker is hidden, because solo is always Random. Typing your own item to find would be trivial.
  - The button reads **Start solo case**.
  - The lobby is skipped; the game goes straight into Case 1.
- **Checking the photo:** with nobody else to vote, the player checks their own photo: "Does it match: SPOON?" with **🔄 Retake** or **✅ It matches**.
  - The clue card is hidden during the check so the question and buttons fit on a phone screen.
- **Round result:** "You found it!", the time it took ("Found in 5.8s"), and progress ("Solved 2 of 3 so far") in place of the scoreboard.
  - If the player gives up or time runs out: "This one got away."
  - The "Host: end this round" link reads **Give up on this case**.
- **Final screen:** a stamp (Perfect! / Good hunt! / Unsolved), cases solved, total time and time per case, plus the case history. There's no podium.
- **Personal best:** saved on the phone for each combination of level, round count and timer. More cases solved wins, and equal counts go to the faster time.
  - A new best gets "New personal best!", a fanfare and big confetti.
  - Otherwise the screen shows "Your best: 2/3 in 8.8s".
- **Play again** restarts a solo game right away.
- **Server:**
  - A solo room has one seat and can't be joined ("That is a solo case").
  - The player votes on their own photo.
  - The "first upload" alert and toasts aimed at other players are switched off.
- Intro now says **1–6 players**, and How to Play has a "Playing alone?" line.
- **Tested** with an automated solo run: setup, straight into the hunt, a retake, a match, a give-up, the finale, a saved personal best, then a second run showing it.
  - The two-player test still passes.
  - No errors in either.

## 10. Full UI/UX redesign
**Commit:** `a7c8925`

Working from a detailed redesign brief (written for players from children to grandparents), I kept the detective case-file look but rebuilt how it's put together.

**Design system (`public/style.css`, fully rewritten in one consistent file):**
- **Colours:**
  - The brief's palette: espresso background, parchment and light-paper cards, ink text, action red, antique gold, success green and error red.
  - Every text-and-background pair was checked for contrast and is at least 4.5:1.
  - Red is kept for primary actions and big moments only.
- **Fonts:**
  - **Bowlby One SC** for titles and big moments.
  - **Nunito Sans** for everything people read or tap, from 15px up (17px for body text).
  - **Special Elite** only for short decorative labels like CASE FILE.
  - All three are saved locally so the game works offline. This replaces Black Ops One, Oswald, Permanent Marker and Courier Prime.
- **Spacing and sizing:**
  - Spacing on a 4px scale and three corner radii.
  - One card shadow and one button style used everywhere.
  - Every button, chip and field is at least 44px tall.
- **Background:** the desk stripes and grain are much quieter, and the paper texture is fainter, so text stays readable.
- **Selection is never shown by colour alone.**
  - Chips, mode cards, avatars and emoji votes show a ✓.
  - Status badges carry a symbol: ✓ approved, ✕ not a match, ↻ retake asked, … checking.

**Screens:**
- **Intro:**
  - A large title and the tagline.
  - An info row: 1–6 players, 2 game modes, 1 point per verified win.
  - Play Game as the main button, with Join a game and How to play below it.
  - The entrance animation is shortened to about 0.6s.
- **Setup:**
  - Numbered steps: name → avatar → players → game mode → level → rounds → time.
  - Every field has a visible label and helper text, and the chosen level gets a one-line explanation.
  - Player count is a 3×2 grid on phones so each option is easy to tap.
  - On desktop the screen splits into two columns.
  - **Inline validation:**
    - A missing name or a wrong game code shows an error right under the field, which clears as soon as it's fixed.
    - Server errors such as "name already taken" or "no game with that code" appear under the relevant field instead of as a toast.
- **Lobby:**
  - The game code is shown large, with one plain sentence on how to join.
  - Long names are shortened with "…" instead of pushing the layout off-screen.
- **Clue:**
  - "Round 2 of 5" in the top bar.
  - "Find this object" and the object name as the biggest thing on screen.
  - The name's size is worked out from its longest word, so "SPOON" is huge and "EXTRAORDINARILY" still fits on a 360px phone without breaking.
  - Riddles are in readable Nunito Sans instead of marker lettering.
  - One short instruction, the camera button, and a one-line safety reminder.
- **Photo preview:**
  - Two-line buttons that explain themselves: Retake / "Take a new photo" and Save & Upload / "Send it to be checked".
  - A spinner while uploading, and a "still uploading…" note after 12 seconds.
  - If an upload fails, an error appears next to the photo and the player can retry.
  - A hint about allowing camera access if the camera won't open.
- **Uploaded first and checking:**
  - The overlay now reads "Bea uploaded first!" with "It only counts if approved".
  - The banner says "Uploaded first · not checked yet".
  - The clue card is hidden during the check so the photo comes first. The check panel repeats what to look for.
  - All 10 emojis have the brief's labels and are grouped: ✓ Yes, approve / ✕ No, or retake / ? Unsure.
  - After voting, a ✓ confirms your choice and explains you can change it.
  - A counter shows "Votes 1 of 3", with each voter marked waiting or voted.
  - On desktop the photo and the voting sit side by side.
- **Round result:** "Case solved!", then "Bea wins this round!", +1 point, "Bea now has 3 points.", and the clue and answer. The winning photo is shown smaller so the Next round button stays close.
- **Scoreboard:**
  - Columns for rank (1st, 2nd…), avatar, name, wins and points, with You and Leader tags.
  - On phones, wins move under the name so the table always fits.
  - Upload status only shows during a round.
- **Final:** "Bea wins the game!" with the points and number of rounds, the podium, "Final standings" and the case history.
- **How to Play:**
  - The 8 steps from the brief, each with an icon.
  - What the two game modes mean, the levels, and all 10 emojis with their meanings.
  - Scoring, including that uploading first isn't enough on its own.
  - The safety line: "Walk carefully. Do not run, climb, or touch dangerous objects."

**Navigation and feedback:**
- **Confirmation dialogs** before:
  - leaving a game
  - the host ending a round
  - closing a vote early
  - giving up a solo clue
- A "Leave game" link is now available during play.
- Dialogs move keyboard focus inside them, and Escape closes them.
- **Screen readers:**
  - The page is no longer read out on every update.
  - One announcer reads key moments: the new clue, a photo uploaded or uploaded first, your vote, the round result, and a failed upload.
- Icon buttons have names, and every avatar has a name ("Fox", "Panda"…).
- Option groups use fieldset and legend so screen readers hear what each choice is for.

**Server (`server.js`):** one message changed: a rejected photo now says "photo does not match. The next photo will be checked, so keep hunting!" Game rules, voting and scoring are unchanged.

**Tested** in headless Chrome, using test scripts that aren't part of the repo:
- The two-player game with animations and sound, and the solo run, both still pass.
- A new **responsive audit** plays a Type-a-Home-Item game with the longest possible names and a 38-character item.
  - It checks 14 screens at 360, 390, 430, 768, 1024 and 1440px for sideways scrolling, clipped text and tap targets under 44px.
  - It found and fixed: player chips too small on phones, long names pushing the lobby sideways, long words breaking mid-word, and the scoreboard overflowing at 360px.
  - Final run: no problems, no console errors.
- The project has no lint, test or build scripts. All JavaScript files pass `node --check`.

## 11. Simpler photo buttons and background music
**Photo preview (`1d5b1e3`):** the buttons are now just **🔄 Retake** and **✓ Save**, with **Saving…** and a spinner while the photo uploads.

**Background music (`public/fx.js`):**
- A quiet detective groove generated live in the browser, with no audio files, so it works offline.
  - A plucked bass walks down Am → G → F → E, with a gentle shuffle at 96 bpm.
  - A few soft vibraphone notes sit on top.
- **Two moods:**
  - **Hunt:** brushed hi-hats and a light snare add a sense of hurry.
  - **Calm:** menus, the lobby, photo checks and results get just bass and vibes.
- It plays well below the sound effects and dips under the round title card, round results and the final fanfare.
- Notes are timed on the browser's audio clock, so the beat never drifts, and the music fades in and out instead of clicking.
- It starts on the first tap, as browsers require, and pauses when the phone switches to another app or tab.
- **Sound button:** 🔊 now cycles **music + effects → 🔈 effects only → 🔇 all off**, with a toast saying which. The choice is remembered.
- **Tested** in headless Chrome:
  - no music before the first tap, music after it
  - the 3-way button cycle
  - the music stops when the tab is hidden and resumes when it's shown
  - the full two-player game still passes with no errors
  - The music itself hasn't been listened to; that needs a real device.


## 12. Energetic chase music
The background music was too gentle, so I replaced it with **"The Chase"**, an original spy-chase cue. It's composed fresh, not borrowed from any famous theme, and still generated live in the browser.

| Intensity | When | Tempo | Arrangement |
|---|---|---|---|
| Calm | Menus, lobby, photo checks, results | 112 bpm | Walking bass, light hi-hats, a kick on the downbeat, sparse vibraphone |
| Hunt | Searching | 132 bpm | Full drum kit, a driving chromatic spy bass riff (Am → Gm → F → E with a push note into every beat 3), muted surf-guitar stabs, a sly minor-key lead hook every other loop, and a snare fill at each phrase end |
| Urgent | Last 15 seconds of the timer | 144 bpm | Everything above plus 16th-note hi-hats, the hook on every loop and a longer fill |

- About 50% louder than before, but still below the stamps and fanfares, which the music dips under.
- Changes of intensity land on the next bar line so the groove never stumbles. Urgent kicks in immediately.
- **Tested:**
  - all three intensities play with no errors
  - switching back and forth always settles on the latest mood
  - the sound button and tab-hiding behaviour still work
  - the two-player and solo games still pass
  - The music itself still needs a listen on a real phone.


## 13. Fitting the assignment brief
**Commit:** `9cee9b6`

After a review against the Hybrid Game brief (wellness theme, 50% physical / 50% social media, at most 10 emojis, all game elements, rule book, keep it simple), I made these changes.

**Rule Book and game design document:** written as a shared doc, [Find It at Home! Rule Book & Game Design](https://claude.ai/code/artifact/6e2eb782-bf2c-427c-a661-0f5b24c270cb).
- Overview and target audience, and how the game meets each line of the brief.
- The role of Players, Goals, Rules, Space, Time, Resources and Conflict.
- The full Rule Book: setup, a round, scoring, the 10 emojis, safety and practice mode.
- Media and originality.
- A design-thinking record with marked spaces for the student's own playtests and faculty discussion.

**Wellness:**
- **Clue bank:** rewritten around healthy living: 30 Word Hunt objects, 20 Riddle Hunt riddles, and 20 Learn & Find health facts such as "Water helps your brain think clearly. Find something you drink water from."
- **Wellness break:** after every round, a short activity everyone does together: stretch, three deep breaths, a sip of water, march on the spot.
- **Calmer music:** the "last 15 seconds" rush is gone and the hunt tempo drops from 132 to 124 bpm. Nobody should feel rushed into running.
- The intro now says "A family wellness game", and the final screen counts the wellness breaks done.

**Social media:**
- **Posts:** each upload is a post, with the poster's avatar, "posted first · 4.9s", the photo and a "Find: TOOTHBRUSH" caption.
- **Reactions:** other players react with the emojis, and a tally (✅ 2 · 👍 1) shows under the post.
- **Round feed:** this round's posts as a list, replacing the evidence table.
- **Game feed:** the final screen shows a grid of every round's winning post.
- **Leaderboard:** the scoreboard is renamed Leaderboard.

**Only 10 emojis:**
- The 10 reactions are now the only emojis anywhere in the game.
- The 12 emoji avatars are replaced by **8 original SVG animals** (fox, cat, dog, bear, panda, owl, frog, rabbit).
- The trophy, speaker, magnifier, level icons (search, riddle bubble, light bulb) and wellness heart are original SVG icons.
- ▶ ⚠ 🚶 ⏱ and the clue icons are removed.

**Simplified:**
- **One mode:** Random only. Type a Home Item, its chooser screen and clue skips are removed from both client and server.
- **Fixed game:** levels climb automatically and every game is 5 rounds of 2 minutes. Setup is now just name, animal and number of players.
- **One voting rule:** once everyone has reacted, the post is approved if more than half reacted yes. 🤔 counts as no, and there's no separate retake or reject state.
- **Ties:** a tie shares the win instead of starting a tiebreaker round. On the podium, block height follows rank, so tied players stand equally tall.
- **Practice mode:** the single-player mode is now called Practice. It still saves a personal best.

**Tested** with a new brief-compliance test: three players, a full 5-round game, in headless Chrome.
- Setup offers only the player-count choice.
- 1 yes + 1 no is not approved; 2 yes is approved; 🤔 + yes is not approved.
- The wellness break shows after a round.
- A 2–2 finish shows "share the win".
- The game feed has 5 tiles.
- Every screen was scanned for emojis: only the 10 reactions appear.
- No layout problems at 360, 390, 430, 768, 1024 or 1440 px.
- The two-player and practice suites still pass.
- No console errors anywhere.
- Fixed along the way: pale hint text on the kraft folder, and podium heights for tied players.

**Still the student's to do:** real playtests with a child and a grandparent, and the faculty discussion, recorded in the design-thinking section of the doc.


## 14. No overlapping or overflowing text
**Problem:** "Practice" stuck out of its button on phones. The earlier layout audit only caught elements wider than the screen. It missed text spilling out of its own box and text overlapping other text.

**Fixes:**
- **Player count:** 2–6 share one row. On phones **Practice** gets its own full-width button above them, and it sits first in the row on wider screens. Chip labels never wrap.
- **Intro:** the title's second line no longer touches the tagline.
- **Clue card:** the big clue word no longer touches "Find this object". All clue words, up to a 38-character item, fit inside the card with no word split in half.
- **Emoji buttons:** emojis no longer overlap their labels.
- **Leaderboard:** fixed column widths, so long names wrap inside their own column instead of pushing "Points" out of the card. Headers are tidied on phones, and below 360px the small avatar is hidden to give names room.
- **Lobby:** long player names are shortened with "…" instead of overlapping their neighbours.
- **Dialogs:** dialog headings stay clear of the ✕ close button.
- **Game feed:** keeps two tiles per row on small phones.

**Tested** with a new whole-app text audit in headless Chrome (a test script, not part of the repo).
- It plays every screen and state: intro, setup in all 6 player counts, name and code errors, lobby, all three clue levels, photo preview, own post, reacting, voted, the "found it too" folder, not approved, round result, leaderboard and How to Play dialogs, confirmations, an unsolved round, the final screen, and practice mode.
- It uses long names like "Bartholomew-Jnr." and "Konstantinoupoli", at 320, 360, 390, 430, 768, 1024 and 1440 px.
- It checks that every line of text sits inside the box that draws it, that no two pieces of text overlap, that nothing is cut off by a container's edge (deliberate "…" excepted), and that the page never scrolls sideways.
- Result: 224 checks, no problems, no console errors. The brief, two-player and practice suites still pass.

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
