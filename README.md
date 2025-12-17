# Guess the Word (Realtime)

Small training project: realtime multiplayer word-guessing game built with Node.js, Express, Socket.IO, and vanilla JS.

## Run locally
1) Install dependencies: `npm install`  
2) Start the server: `npm start`  
3) Open `http://localhost:3000` in the browser. Create a room, share the 4-letter code, and start a round.

## How it works
- **Rooms and lobby:** server keeps in-memory rooms keyed by a 4-letter code. One host per room manages settings and rounds. `lobby:createRoom`, `lobby:joinRoom`, `lobby:rooms` keep the lobby list fresh.
- **Packets and rounds:** the host chooses a packet (movies, places, countries, animals, food, jobs, sports, objects, etc.). Each round pulls an unused word + four hints from that packet (reshuffles if exhausted). Rounds continue automatically until the configured total.
- **Scoring:** points per correct guess: 4/3/2/1 based on hint count (1–4). The first correct guess in each round gets a +1 bonus (so 5/4/3/2 for the first correct player).
- **Realtime updates:** Socket.IO events broadcast round start (`round:started`), ticking timers + hints (`round:tick`), guesses (`round:guessResult`), and round end + scores (`round:ended`). Scores live in memory per room and reset only when the server restarts.
- **Frontend:** pure HTML/CSS/JS in `public/`. A segmented input shows the word length and captures character-by-character guesses (Enter to submit). Scoreboard/guesses are scrollable, and host setup is packet-based with no manual word entry.

## Deploy
- The server listens on `PORT` env var or 3000. Suitable for Railway/fly.io/etc. by running `npm start`.
