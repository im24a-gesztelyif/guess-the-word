// Simple Express + Socket.IO server for "Guess the Word"
// Game state is stored in-memory per room. This is intended for training/demo use only.

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const PACKS = require('./packs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Serve static assets from /public
app.use(express.static(path.join(__dirname, 'public')));

// rooms[code] = {
//   code,
//   hostId,
//   hostName,
//   settings: { roundDuration, totalRounds },
//   isPrivate: boolean,
//   packetName: string | null,
//   usedWordIndices: Set<number>,
//   players: Map<socketId, { id, name, score, guessedCorrect }>,
//   phase: 'waiting' | 'running' | 'round-ended' | 'finished',
//   currentRound: number,
//   round: {
//     word,
//     wordUpper,
//     hints: string[4],
//     startTime: number,
//     timer: NodeJS.Timer,
//     lastRevealCount: number,
//     lastRoundScores: Record<socketId, number>,
//     firstCorrectId: string | null,
//   }
//   lastSolution?: string
// }
const rooms = new Map();

// Utility: generate a simple 4-letter room code.
function generateRoomCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function pickWordFromPacket(room) {
  const packet = room.packetName ? PACKS[room.packetName] : null;
  if (!packet || packet.length === 0) return null;
  if (!room.usedWordIndices) room.usedWordIndices = new Set();
  const available = packet
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => !room.usedWordIndices.has(idx));

  // If packet is exhausted, clear used indices and allow repeats (documented graceful fallback).
  const pool = available.length > 0 ? available : packet.map((item, idx) => ({ item, idx }));
  const choice = pool[Math.floor(Math.random() * pool.length)];
  room.usedWordIndices.add(choice.idx);
  return choice.item;
}

function getRevealCount(timeLeft, duration) {
  const elapsed = duration - timeLeft;
  const quarter = duration / 4;
  if (elapsed < quarter) return 1; // 60-45s: 1 hint worth 4 points
  if (elapsed < quarter * 2) return 2; // 45-30s: 2 hints worth 3 points
  if (elapsed < quarter * 3) return 3; // 30-15s: 3 hints worth 2 points
  return 4; // 15-0s: 4 hints worth 1 point
}

function getPointsForTime(timeLeft, duration) {
  const revealCount = getRevealCount(timeLeft, duration);
  switch (revealCount) {
    case 1:
      return 4;
    case 2:
      return 3;
    case 3:
      return 2;
    default:
      return 1;
  }
}

function getRoomListPayload() {
  // Only public rooms are listed
  return Array.from(rooms.values())
    .filter((room) => !room.isPrivate)
    .map((room) => ({
      code: room.code,
      hostName: room.hostName,
      playerCount: room.players.size,
      phase: room.phase,
      packetName: room.packetName || 'Not chosen',
    }));
}

function broadcastRoomList() {
  io.emit('lobby:rooms', getRoomListPayload());
}

function emitRoomInfo(room) {
  io.to(room.code).emit('room:info', {
    roomCode: room.code,
    hostName: room.hostName,
    hostId: room.hostId,
    duration: room.settings.roundDuration,
    totalRounds: room.settings.totalRounds,
    isPrivate: room.isPrivate,
    currentRound: room.currentRound,
    packetName: room.packetName || 'Not chosen',
  });
}

function emitRoomState(room) {
  // Single authoritative state payload.
  const now = Date.now();
  const timeLeft = room.round
    ? Math.max(room.round.duration - Math.floor((now - room.round.startTime) / 1000), 0)
    : null;
  const payload = {
    roomCode: room.code,
    hostId: room.hostId,
    hostName: room.hostName,
    phase: room.phase,
    currentRound: room.currentRound,
    totalRounds: room.settings.totalRounds,
    duration: room.settings.roundDuration,
    packetName: room.packetName || 'Not chosen',
    isPrivate: room.isPrivate,
    round: room.round
      ? {
          wordLength: room.round.wordLength,
          wordParts: room.round.wordParts,
          timeLeft,
          revealCount: room.round.lastRevealCount,
          visibleHints: room.round.hints.slice(0, room.round.lastRevealCount),
        }
      : null,
  };
  io.to(room.code).emit('room:state', payload);
}

function clearRound(room) {
  if (room.round?.timer) clearInterval(room.round.timer);
  room.round = null;
}

function endRound(room, reason = 'time') {
  // Guard against double end or missing round data.
  if (!room || room.phase !== 'running' || !room.round) return;
  const { lastRoundScores = {}, hints, word } = room.round;
  room.lastSolution = word; // Preserve solution before clearing timers.
  const isFinal = room.currentRound >= room.settings.totalRounds;
  clearRound(room);
  room.phase = isFinal ? 'finished' : 'round-ended';
  io.to(room.code).emit('round:ended', {
    reason,
    hints,
    scores: buildScoreboard(room),
    lastRoundScores,
    final: isFinal,
    podium: isFinal ? buildPodium(room) : null,
    packetName: room.packetName || 'Not chosen',
    solution: room.lastSolution,
    phase: room.phase,
  });
  emitRoomState(room);
  broadcastRoomList();
  if (isFinal) {
    room.gameActive = false;
    room.usedWordIndices = new Set();
    room.lastSolution = null;
  }
}

function buildScoreboard(room) {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
  }));
}

function buildPodium(room) {
  const sorted = buildScoreboard(room).sort((a, b) => b.score - a.score);
  return sorted.slice(0, 3);
}

function startRound(room, roundConfig) {
  // Prevent extra rounds beyond configured total.
  if (room.currentRound >= room.settings.totalRounds) return { error: 'All rounds completed' };
  if (room.phase === 'running') return { error: 'Round already running' };
  if (!room.gameActive) return { error: 'Game not active' };
  if (!room.packetName || !PACKS[room.packetName]) return { error: 'No packet selected' };

  clearRound(room);

  const durationInput = Number(roundConfig.roundDuration);
  const duration = durationInput && durationInput >= 15 ? durationInput : room.settings.roundDuration;
  const chosenWord = pickWordFromPacket(room);
  if (!chosenWord) return { error: 'No packet selected or packet empty' };
  const wordParts = chosenWord.word.split(/\s+/).filter(Boolean);
  const partLengths = wordParts.map((w) => w.length); // lengths keep UI grouped per word without sending solution text
  const joined = wordParts.join('');
  room.phase = 'running';
  room.currentRound += 1;
  const startTime = Date.now();
  const round = {
    word: chosenWord.word,
    wordUpper: joined.toUpperCase(), // ignore spaces for comparison
    wordParts: partLengths,
    wordLength: joined.length,
    hints: chosenWord.hints,
    startTime,
    duration,
    timer: null,
    lastRevealCount: 1,
    lastRoundScores: {},
    firstCorrectId: null,
  };
  room.round = round;
  room.lastSolution = round.word; // store for safe round end

  // Reset per-round flags
  room.players.forEach((p) => {
    p.guessedCorrect = false;
  });

  // Broadcast round start with only the first hint visible.
  io.to(room.code).emit('round:started', {
    roomCode: room.code,
    hostName: room.hostName,
    roundNumber: room.currentRound,
    totalRounds: room.settings.totalRounds,
    duration,
    wordLength: round.wordLength,
    wordParts: partLengths,
    hints: [round.hints[0]],
    phase: room.phase,
  });
  emitRoomState(room);
  broadcastRoomList();

  // Start ticking: every second send time + revealed hints.
  round.timer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const timeLeft = Math.max(duration - elapsed, 0);
    const revealCount = getRevealCount(timeLeft, duration);
    round.lastRevealCount = revealCount;
    io.to(room.code).emit('round:tick', {
      timeLeft,
      revealCount,
      visibleHints: round.hints.slice(0, revealCount),
    });
    if (timeLeft <= 0) {
      endRound(room, 'time');
    }
  }, 1000);
}

// Socket.IO events: names are prefixed by feature for clarity.
io.on('connection', (socket) => {
  // Send lobby room list and sample words immediately.
  socket.emit('lobby:rooms', getRoomListPayload());
  socket.emit('lobby:packets', Object.keys(PACKS));

  socket.on('lobby:list', () => {
    socket.emit('lobby:rooms', getRoomListPayload());
    socket.emit('lobby:packets', Object.keys(PACKS));
  });

  socket.on('lobby:createRoom', ({ nickname, settings, isPrivate }, cb) => {
    if (!nickname) return cb?.({ error: 'Nickname is required' });
    const code = generateRoomCode();
    const player = { id: socket.id, name: nickname, score: 0, guessedCorrect: false };
    const room = {
      code,
      hostId: socket.id,
      hostName: nickname,
      isPrivate: !!isPrivate,
      packetName: null,
      usedWordIndices: new Set(),
      gameActive: false,
      phase: 'waiting',
      settings: {
        roundDuration: settings?.roundDuration && settings.roundDuration >= 15 ? settings.roundDuration : 60,
        totalRounds: settings?.totalRounds && settings.totalRounds > 0 ? settings.totalRounds : 5,
      },
      players: new Map([[socket.id, player]]),
      currentRound: 0,
      round: null,
    };
    rooms.set(code, room);
    socket.join(code);
    cb?.({
      roomCode: code,
      host: true,
      settings: room.settings,
      hostName: room.hostName,
      isPrivate: room.isPrivate,
      packetName: room.packetName,
    });
    broadcastRoomList();
    io.to(code).emit('room:players', buildScoreboard(room));
    emitRoomInfo(room);
    emitRoomState(room);
  });

  socket.on('lobby:joinRoom', ({ nickname, roomCode }, cb) => {
    const code = roomCode?.toUpperCase();
    const room = rooms.get(code);
    if (!nickname || !code) return cb?.({ error: 'Nickname and room code required' });
    if (!room) return cb?.({ error: 'Room not found' });
    const player = { id: socket.id, name: nickname, score: 0, guessedCorrect: false };
    room.players.set(socket.id, player);
    socket.join(code);
    cb?.({
      roomCode: code,
      host: room.hostId === socket.id,
      settings: room.settings,
      currentRound: room.currentRound,
      phase: room.phase,
      hostName: room.hostName,
      isPrivate: room.isPrivate,
      packetName: room.packetName,
    });
    io.to(code).emit('room:players', buildScoreboard(room));
    emitRoomInfo(room);
    emitRoomState(room);
  });

  socket.on('host:updateSettings', ({ roomCode, roundDuration, totalRounds }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    const durationNum = Number(roundDuration);
    const roundsNum = Number(totalRounds);
    if (durationNum && durationNum >= 15) room.settings.roundDuration = durationNum;
    if (roundsNum && roundsNum > 0) room.settings.totalRounds = roundsNum;
    io.to(room.code).emit('room:settings', room.settings);
    emitRoomInfo(room);
    emitRoomState(room);
    broadcastRoomList();
  });

  socket.on('host:setPrivate', ({ roomCode, isPrivate }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    room.isPrivate = !!isPrivate;
    emitRoomInfo(room);
    emitRoomState(room);
    broadcastRoomList();
  });

  // Host starts the entire game with one chosen packet; words/hints are pulled per round.
  socket.on('host:startGame', ({ roomCode, packetName, roundDuration, totalRounds }, cb) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Only host can start' });
    if (room.gameActive && room.phase !== 'finished') return cb?.({ error: 'Game already active' });
    if (!PACKS[packetName]) return cb?.({ error: 'Choose a valid packet' });
    const durationNum = Number(roundDuration);
    const roundsNum = Number(totalRounds);
    if (durationNum && durationNum >= 15) room.settings.roundDuration = durationNum;
    if (roundsNum && roundsNum > 0) room.settings.totalRounds = roundsNum;
    room.packetName = packetName;
    room.usedWordIndices = new Set();
    room.currentRound = 0;
    room.gameActive = true;
    room.phase = 'waiting';
    room.players.forEach((p) => {
      p.score = 0;
      p.guessedCorrect = false;
    });
    io.to(room.code).emit('room:players', buildScoreboard(room));
    emitRoomInfo(room);
    emitRoomState(room);
    broadcastRoomList();
    const result = startRound(room, {});
    if (result?.error) {
      room.gameActive = false;
      room.phase = 'waiting';
      return cb?.(result);
    }
    cb?.({ ok: true });
  });

  // Host manually advances to the next round (no auto-start).
  socket.on('host:nextRound', ({ roomCode }, cb) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Only host can continue' });
    if (!room.gameActive) return cb?.({ error: 'Game is not active' });
    if (room.phase !== 'round-ended') return cb?.({ error: 'Round not ended yet' });
    const result = startRound(room, {});
    if (result?.error) return cb?.(result);
    cb?.({ ok: true });
  });

  // Host triggers final standings for everyone after the last round.
  socket.on('host:showFinal', ({ roomCode }, cb) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Only host can continue' });
    // Allow final display as long as the configured rounds are complete.
    if (room.currentRound < room.settings.totalRounds) return cb?.({ error: 'Game not finished yet' });
    const podium = buildPodium(room);
    io.to(room.code).emit('game:final', {
      podium,
      scores: buildScoreboard(room),
      packetName: room.packetName || 'Not chosen',
      phase: 'waiting',
    });
    // Reset to a clean waiting state for a new game.
    room.phase = 'waiting';
    room.gameActive = false;
    room.currentRound = 0;
    room.lastSolution = null;
    room.usedWordIndices = new Set();
    clearRound(room);
    emitRoomState(room);
    broadcastRoomList();
    cb?.({ ok: true });
  });

  socket.on('round:guess', ({ roomCode, guess }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'running' || !room.round || !guess) return;
    const player = room.players.get(socket.id);
    if (!player || player.guessedCorrect) return; // Each player can score once per round.

    const cleanedGuess = guess.replace(/\s+/g, '').trim();
    const isCorrect = cleanedGuess.toUpperCase() === room.round.wordUpper;
    let pointsAwarded = 0;
    if (isCorrect) {
      const elapsed = Math.floor((Date.now() - room.round.startTime) / 1000);
      const timeLeft = Math.max(room.round.duration - elapsed, 0);
      const basePoints = getPointsForTime(timeLeft, room.round.duration);
      const bonus = room.round.firstCorrectId ? 0 : 1; // Bonus applied exactly once to the first correct guess.
      pointsAwarded = basePoints + bonus;
      player.score += pointsAwarded;
      player.guessedCorrect = true;
      if (!room.round.firstCorrectId) room.round.firstCorrectId = player.id;
      room.round.lastRoundScores[player.id] = pointsAwarded;
    }

    // Broadcast the guess to the room (payload shows correctness + points). Correct guesses do not reveal the word.
    io.to(room.code).emit('round:guessResult', {
      playerId: player.id,
      playerName: player.name,
      guess: isCorrect ? null : cleanedGuess,
      correct: isCorrect,
      pointsAwarded,
      totalScore: player.score,
    });

    io.to(room.code).emit('room:players', buildScoreboard(room));

    // End round early if all connected players have guessed correctly.
    const allGuessed = Array.from(room.players.values()).every((p) => p.guessedCorrect);
    if (allGuessed) {
      endRound(room, 'all-guessed');
    }
  });

  socket.on('host:skipRound', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (!room.gameActive || room.phase !== 'running') return;
    endRound(room, 'skipped');
  });

  socket.on('room:leave', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players.delete(socket.id);
    socket.leave(roomCode);
    if (room.hostId === socket.id) {
      const next = room.players.values().next().value;
      room.hostId = next?.id;
      room.hostName = next?.name;
      if (next) {
        io.to(roomCode).emit('room:host', { hostName: room.hostName, hostId: room.hostId });
        io.to(next.id).emit('room:promoted', { roomCode });
      }
    }
    if (room.players.size === 0) {
      clearRound(room);
      rooms.delete(roomCode);
    } else {
      io.to(roomCode).emit('room:players', buildScoreboard(room));
    }
    broadcastRoomList();
  });

  socket.on('disconnecting', () => {
    const joinedRooms = Array.from(socket.rooms).filter((r) => rooms.has(r));
    joinedRooms.forEach((code) => {
      const room = rooms.get(code);
      if (!room) return;
      room.players.delete(socket.id);
      if (room.hostId === socket.id) {
        // If host leaves, promote the next player if possible.
        const next = room.players.values().next().value;
        room.hostId = next?.id;
        room.hostName = next?.name;
        if (next) {
          io.to(code).emit('room:host', { hostName: room.hostName, hostId: room.hostId });
          io.to(next.id).emit('room:promoted', { roomCode: code });
          emitRoomInfo(room);
          emitRoomState(room);
        }
      }
      if (room.players.size === 0) {
        clearRound(room);
        rooms.delete(code);
      } else {
        io.to(code).emit('room:players', buildScoreboard(room));
      }
    });
    broadcastRoomList();
  });
});

server.listen(PORT, () => {
  // Document chosen behaviour: the round continues until the timer reaches zero or the host skips it.
  console.log(`Guess the Word server running on http://localhost:${PORT}`);
});
