# Find It at Home!

*Find it. Click it. Upload it. Win it!*: a family **wellness** game for **2–6 players**, half physical (walking around your home to find healthy everyday objects) and half social media (posting a photo, reacting with emojis, a feed and a leaderboard). Live at https://find-it-at-home.onrender.com.

The full Rule Book and game design document (players, goals, rules, space, time, resources, conflict) is kept as a shared doc; see `BUILD_LOG.md` for the link.

## Run it in VS Code

1. Install **Node.js 18+** (https://nodejs.org).
2. In VS Code: **File → Open Folder…** → pick this `find-it-at-home` folder.
3. Open the terminal (**Ctrl + `**) and run:
   ```bash
   npm install
   npm start
   ```
   Or run `npm run dev` to auto-restart the server whenever you edit `server.js`.
4. The terminal prints two addresses:
   - `http://localhost:3000` for this computer
   - `http://192.168.x.x:3000` for **phones on the same Wi-Fi**

> **Testing alone?** Open several browser tabs or windows. Each tab is its own player.
> **Windows firewall** may ask to allow Node.js. Allow it on *private networks* so phones can connect.

## How a game flows

| # | Screen | What happens |
|---|---|---|
| 01 | Intro | Tap **Play Game**, or **Join a game** with a 4-letter code |
| 02 | Setup | Name, one of 8 original animals, and the number of players (or **Practice** alone). Every game is 5 rounds of 2 minutes |
| 03 | Clue | Everyone sees the same clue. The level climbs each round: Word Hunt → Riddle Hunt → Learn & Find (a health fact) |
| 04 | Search | Walk (never run) and find it at home |
| 05 | Post | Take a photo, then **Retake** or **Save** to post it |
| 06 | React | Everyone else reacts with one of the 10 emojis: ✅👍💯🎯👏 say yes · ❌🔄🔍👎🤔 say no |
| 07 | Verdict | Once everyone has reacted, more than half yes = approved, **+1 point**. Otherwise everyone keeps searching |
| 08 | Wellness break | A short stretch, breath or sip of water, done together |
| 09 | Final | Most points after 5 rounds wins; a tie is a shared win. The game feed shows every round's winning post |

The 10 reactions are the only emojis in the game; everything else is original artwork. The host can close the reactions early or end a round with no winner.

## Project structure

```
find-it-at-home/
├── server.js        # HTTP + WebSocket game server (rooms, rounds, votes, scoring, timer)
├── challenges.js    # Wellness clue bank for levels 1–3. Add your own items here!
├── public/
│   ├── index.html   # page shell + original SVG art (8 animal avatars, icons)
│   ├── style.css    # "Case file" design system (paper, kraft folders, stamps, grid paper)
│   ├── app.js       # All screens + camera capture + live updates
│   ├── fx.js        # Synthesised sound effects, original music, confetti
│   └── fonts/       # Bowlby One SC, Nunito Sans, Special Elite (OFL), so it works offline
```

## Customising

- **Add challenges:** edit the lists in `challenges.js`.
- **Colours / look:** change the tokens at the top of `public/style.css` (`--paper`, `--kraft`, `--red`…).
- **Rounds / timer:** `SETTINGS` near the top of `server.js`.

## Notes

- Photos are resized on the phone (≈960px JPEG) and stored only in memory for the current round. Nothing is saved to disk.
- Phones keep their seat if they refresh or briefly lose Wi-Fi.
- To play across different networks (not the same Wi-Fi), deploy the folder to any Node host (Render, Railway, Glitch…). It's a single `npm start` app and serves HTTPS automatically there.
