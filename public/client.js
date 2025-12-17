/* Client-side controller for Guess the Word.
 * Renders strictly from server-driven room state (phase: waiting | running | round-ended | finished).
 */
(() => {
  const socket = io();

  // --- DOM references ---
  const hero = document.getElementById('hero');
  const lobbySection = document.getElementById('lobby');
  const gameSection = document.getElementById('game');
  const inGameNav = document.getElementById('inGameNav');
  const leaveBtn = document.getElementById('leaveBtn');
  const roomInfoBtn = document.getElementById('roomInfoBtn');
  const roomInfoModal = document.getElementById('roomInfoModal');
  const closeInfoBtn = document.getElementById('closeInfoBtn');
  const infoRoomCode = document.getElementById('infoRoomCode');
  const infoHost = document.getElementById('infoHost');
  const infoDuration = document.getElementById('infoDuration');
  const infoPrivate = document.getElementById('infoPrivate');
  const infoPacket = document.getElementById('infoPacket');

  const nicknameInput = document.getElementById('nickname');
  const privateToggle = document.getElementById('privateToggle');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const openJoinBtn = document.getElementById('openJoinBtn');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const joinPanel = document.getElementById('joinPanel');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const roomsList = document.getElementById('rooms');
  const refreshRoomsBtn = document.getElementById('refreshRooms');

  const timerEl = document.getElementById('timer');
  const playArea = document.getElementById('playArea');
  const hintsList = document.getElementById('hintsList');
  const guessesList = document.getElementById('guessesList');
  const scoreList = document.getElementById('scoreList');
  const segmentedInput = document.getElementById('segmentedInput');
  const submitGuessBtn = document.getElementById('submitGuessBtn');
  const waitingMessage = document.getElementById('waitingMessage');
  const guessControls = document.getElementById('guessControls');
  const hostPanel = document.getElementById('hostPanel');
  const roundLabel = document.getElementById('roundLabel');
  const startRoundBtn = document.getElementById('startRoundBtn');
  const settingDuration = document.getElementById('settingDuration');
  const settingRounds = document.getElementById('settingRounds');
  const packetSelect = document.getElementById('packetSelect');
  const hostPrivateToggle = document.getElementById('hostPrivateToggle');

  const leaderboardOverlay = document.getElementById('leaderboardOverlay');
  const leaderboardList = document.getElementById('leaderboardList');
  const roundSolution = document.getElementById('roundSolution');
  const nextRoundBtn = document.getElementById('nextRoundBtn');
  const waitingNext = document.getElementById('waitingNext');
  const finalOverlay = document.getElementById('finalOverlay');
  const podiumFirst = document.getElementById('podiumFirst');
  const podiumSecond = document.getElementById('podiumSecond');
  const podiumThird = document.getElementById('podiumThird');
  const closeFinalBtn = document.getElementById('closeFinalBtn');

  // --- State driven by server ---
  const state = {
    roomCode: null,
    isHost: false,
    phase: 'waiting',
    currentRound: 0,
    totalRounds: 0,
    settings: { roundDuration: 60, totalRounds: 5 },
    packetName: '',
    wordLength: 0,
    wordParts: [],
    finalPending: false,
    finalPodium: [],
  };
  let guessChars = [];

  // --- UI helpers ---
  function showGame() {
    lobbySection.classList.add('hidden');
    hero.classList.add('hidden');
    gameSection.classList.remove('hidden');
    inGameNav.classList.remove('hidden');
  }

  function backToLobby() {
    Object.assign(state, {
      roomCode: null,
      isHost: false,
      phase: 'waiting',
      currentRound: 0,
      totalRounds: 0,
      packetName: '',
      wordLength: 0,
      wordParts: [],
    });
    lobbySection.classList.remove('hidden');
    hero.classList.remove('hidden');
    gameSection.classList.add('hidden');
    inGameNav.classList.add('hidden');
    guessesList.innerHTML = '';
    scoreList.innerHTML = '';
    hintsList.innerHTML = '';
    timerEl.textContent = '60';
    roundLabel.textContent = 'Round 0';
    joinPanel.classList.add('hidden');
    roomInfoModal.classList.add('hidden');
    roomInfoModal.classList.remove('show');
    leaderboardOverlay.classList.add('hidden');
    leaderboardOverlay.classList.remove('show');
    finalOverlay.classList.add('hidden');
    finalOverlay.classList.remove('show');
    playArea.classList.add('waiting');
    waitingMessage.classList.remove('hidden');
    guessControls.classList.add('hidden');
    hostPanel.classList.add('hidden');
  }

  function renderRooms(list) {
    roomsList.innerHTML = list.length === 0 ? '<p class="muted">No rooms yet.</p>' : '';
    list.forEach((room) => {
      const div = document.createElement('div');
      div.className = 'room-item';
      div.innerHTML = `
        <div>
          <strong>${room.code}</strong><br />
          <span class="muted">${room.playerCount} players · Host: ${room.hostName || '—'}</span><br />
          <span class="muted">Packet: ${room.packetName || 'Not chosen'}</span>
        </div>
        <button data-code="${room.code}" class="small">Join</button>
      `;
      div.querySelector('button').onclick = () => joinRoom(room.code);
      roomsList.appendChild(div);
    });
  }

  function ensureGuessesPlaceholder() {
    if (guessesList.children.length === 0) {
      const li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'No guesses yet';
      guessesList.appendChild(li);
    }
  }

  function showLeaderboard(lastRoundScores = {}, scores = []) {
    leaderboardList.innerHTML = '';
    const ordered = Object.entries(lastRoundScores)
      .map(([id, pts]) => {
        const player = scores.find((p) => p.id === id);
        return { name: player?.name || 'Player', points: pts };
      })
      .sort((a, b) => b.points - a.points);
    if (ordered.length === 0) ordered.push({ name: 'No correct guesses', points: 0 });
    ordered.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = 'leaderboard-item';
      if (idx === 0 && entry.points > 0) card.classList.add('winner');
      card.innerHTML = `<div class="name">${entry.name}</div><div class="points">+${entry.points} pts</div>`;
      leaderboardList.appendChild(card);
    });
    leaderboardOverlay.classList.remove('hidden');
    leaderboardOverlay.classList.add('show');
  }

  function showFinalPodium(podium = state.finalPodium || []) {
    const slots = [
      { el: podiumFirst, rank: '1st', data: podium[0] },
      { el: podiumSecond, rank: '2nd', data: podium[1] },
      { el: podiumThird, rank: '3rd', data: podium[2] },
    ];
    slots.forEach(({ el, rank, data }) => {
      el.innerHTML = data
        ? `<div class="rank">${rank}</div><div class="name">${data.name}</div><div class="points">${data.score} pts</div>`
        : `<div class="rank">${rank}</div><div class="name">—</div>`;
    });
    finalOverlay.classList.remove('hidden');
    finalOverlay.classList.add('show');
  }

  function updateHints(visibleHints) {
    hintsList.innerHTML = '';
    for (let i = 0; i < 4; i += 1) {
      const li = document.createElement('li');
      if (visibleHints && visibleHints[i]) {
        li.textContent = visibleHints[i];
      } else {
        li.textContent = 'Hidden';
        li.classList.add('hidden');
      }
      hintsList.appendChild(li);
    }
  }

  function updateGuesses({ playerName, guess, correct, pointsAwarded }) {
    if (guessesList.firstChild?.classList.contains('muted')) guessesList.innerHTML = '';
    const li = document.createElement('li');
    if (correct) {
      li.textContent = `${playerName} has guessed the word!`;
      li.style.borderColor = '#22c55e';
      if (pointsAwarded) {
        const badge = document.createElement('span');
        badge.className = 'muted';
        badge.textContent = ` (+${pointsAwarded} pts)`;
        li.appendChild(badge);
      }
    } else {
      li.innerHTML = `<strong>${playerName}</strong>: ${guess || ''}`;
    }
    guessesList.appendChild(li);
    // Auto-scroll to latest like a chat app.
    guessesList.scrollTop = guessesList.scrollHeight;
  }

  function updateScoreboard(scores, lastRoundScores = {}) {
    scoreList.innerHTML = '';
    if (!scores?.length) return;
    const maxScore = Math.max(...scores.map((s) => s.score));
    scores
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach((player) => {
        const li = document.createElement('li');
        const roundPoints = lastRoundScores[player.id];
        li.innerHTML = `<strong>${player.name}</strong> — ${player.score} pts ${
          roundPoints ? `( +${roundPoints} )` : ''
        }`;
        if (player.score === maxScore && maxScore > 0) {
          li.style.borderColor = '#22c55e';
        }
        scoreList.appendChild(li);
      });
  }

  function buildSegments(wordParts) {
    segmentedInput.innerHTML = '';
    const parts = wordParts && wordParts.length ? wordParts.map((n) => Number(n)) : [state.wordLength];
    const total = parts.reduce((sum, len) => sum + (Number(len) || 0), 0);
    guessChars = new Array(total).fill('');
    let cursor = 0;
    parts.forEach((len) => {
      const row = document.createElement('div');
      row.className = 'segments-row';
      for (let i = 0; i < len; i += 1) {
        const span = document.createElement('div');
        span.className = 'segment';
        span.dataset.index = cursor;
        row.appendChild(span);
        cursor += 1;
      }
      segmentedInput.appendChild(row);
    });
  }

  function renderSegments() {
    segmentedInput.querySelectorAll('.segment').forEach((el) => {
      const idx = Number(el.dataset.index);
      el.textContent = guessChars[idx] || '';
      el.classList.toggle('filled', !!guessChars[idx]);
    });
  }

  function currentGuess() {
    return guessChars.join('');
  }

  function handleKey(e) {
    if (state.phase !== 'running') return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      const nextIndex = guessChars.findIndex((c) => !c);
      const idx = nextIndex === -1 ? guessChars.length - 1 : nextIndex;
      guessChars[idx] = e.key.toUpperCase();
      renderSegments();
      e.preventDefault();
    } else if (e.key === 'Backspace') {
      let idx = guessChars.findIndex((c) => !c) - 1;
      if (idx < 0) idx = guessChars.length - 1;
      guessChars[idx] = '';
      renderSegments();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      submitGuess();
    } else if (e.key === ' ') {
      // Ignore spaces; input auto-advances across words.
      e.preventDefault();
    }
  }

  function submitGuess() {
    if (!state.roomCode || state.phase !== 'running') return;
    const guess = currentGuess().trim();
    if (guess.length !== state.wordLength) return;
    socket.emit('round:guess', { roomCode: state.roomCode, guess });
    guessChars = new Array(state.wordLength).fill('');
    renderSegments();
  }

  // --- Phase rendering ---
  function renderPhase() {
    const waiting = state.phase !== 'running';
    playArea.classList.toggle('waiting', waiting);
    waitingMessage.classList.toggle('hidden', !waiting);
    guessControls.classList.toggle('hidden', waiting);
    if (waiting) {
      hintsList.innerHTML = '';
      segmentedInput.innerHTML = '';
      state.wordLength = 0;
      ensureGuessesPlaceholder();
      const canConfigure =
        state.isHost &&
        ((state.phase === 'waiting' && state.currentRound === 0) || state.phase === 'finished');
      if (canConfigure) {
        hostPanel.classList.remove('hidden');
      }
    } else {
      hostPanel.classList.add('hidden');
    }
  }

  // --- Event bindings ---
  createRoomBtn.onclick = () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) return alert('Enter a nickname first.');
    socket.emit(
      'lobby:createRoom',
      { nickname, isPrivate: privateToggle.checked },
      (res) => {
        if (res?.error) return alert(res.error);
        state.roomCode = res.roomCode;
        state.isHost = res.host;
        state.settings = res.settings || state.settings;
        state.packetName = res.packetName || '';
        settingDuration.value = state.settings.roundDuration;
        settingRounds.value = state.settings.totalRounds;
        hostPrivateToggle.checked = !!res.isPrivate;
        hostPanel.classList.remove('hidden');
        showGame();
        renderPhase();
      }
    );
  };

  joinRoomBtn.onclick = () => joinRoom(roomCodeInput.value.trim().toUpperCase());
  openJoinBtn.onclick = () => joinPanel.classList.remove('hidden');
  refreshRoomsBtn.onclick = () => socket.emit('lobby:list');

  startRoundBtn.onclick = () => {
    if (!state.roomCode) return;
    const packetName = packetSelect.value;
    if (!packetName) return alert('Choose a packet to start.');
    socket.emit(
      'host:startGame',
      {
        roomCode: state.roomCode,
        packetName,
        roundDuration: Number(settingDuration.value),
        totalRounds: Number(settingRounds.value),
      },
      (res) => {
        if (res?.error) return alert(res.error);
        hostPanel.classList.add('hidden');
      }
    );
  };

  hostPrivateToggle.onchange = () => {
    if (state.isHost && state.roomCode) {
      socket.emit('host:setPrivate', { roomCode: state.roomCode, isPrivate: hostPrivateToggle.checked });
    }
  };

  leaveBtn.onclick = () => {
    if (state.roomCode) socket.emit('room:leave', { roomCode: state.roomCode });
    backToLobby();
  };

  roomInfoBtn.onclick = () => {
    roomInfoModal.classList.add('show');
    roomInfoModal.classList.remove('hidden');
  };

  closeInfoBtn.onclick = () => {
    roomInfoModal.classList.remove('show');
    roomInfoModal.classList.add('hidden');
  };

  closeFinalBtn.onclick = () => {
    finalOverlay.classList.remove('show');
    finalOverlay.classList.add('hidden');
  };

  nextRoundBtn.onclick = () => {
    if (!state.isHost || !state.roomCode) return;
    if (state.finalPending) {
      leaderboardOverlay.classList.add('hidden');
      leaderboardOverlay.classList.remove('show');
      showFinalPodium(); // no podium data needed here; final overlay just closes leaderboard
      state.finalPending = false;
    } else {
      socket.emit('host:nextRound', { roomCode: state.roomCode }, (res) => {
        if (res?.error) return alert(res.error);
        leaderboardOverlay.classList.add('hidden');
        leaderboardOverlay.classList.remove('show');
      });
    }
  };

  submitGuessBtn.onclick = submitGuess;
  window.addEventListener('keydown', handleKey);

  // --- Socket listeners ---
  socket.on('lobby:rooms', renderRooms);
  socket.on('lobby:packets', (packets) => {
    packetSelect.innerHTML = '<option value="">Choose a packet</option>';
    packets.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      packetSelect.appendChild(opt);
    });
  });

  socket.on('room:players', (scores) => updateScoreboard(scores));

  socket.on('room:host', ({ hostName }) => {
    infoHost.textContent = hostName || '—';
  });

  socket.on('room:promoted', () => {
    state.isHost = true;
    renderPhase();
  });

  socket.on('room:settings', (settings) => {
    state.settings = settings;
    infoDuration.textContent = settings.roundDuration;
    settingDuration.value = settings.roundDuration;
    settingRounds.value = settings.totalRounds;
  });

  socket.on('room:state', (info) => {
    state.phase = info.phase;
    state.currentRound = info.currentRound;
    state.totalRounds = info.totalRounds;
    state.packetName = info.packetName || '';
    state.wordParts = info.round?.wordParts ? info.round.wordParts.map((n) => Number(n)) : [];
    state.wordLength = info.round?.wordLength || 0;
    infoRoomCode.textContent = info.roomCode;
    infoHost.textContent = info.hostName;
    infoDuration.textContent = info.duration;
    infoPrivate.textContent = info.isPrivate ? 'Yes' : 'No';
    infoPacket.textContent = info.packetName || 'Not chosen';
    roundLabel.textContent = `Round ${info.currentRound || 0}/${info.totalRounds || state.settings.totalRounds}`;
    if (info.phase === 'running' && info.round) {
      buildSegments(state.wordParts);
      renderSegments();
      updateHints(info.round.visibleHints);
      timerEl.textContent = info.round.timeLeft ?? info.duration;
    }
    renderPhase();
  });

  socket.on('round:started', (payload) => {
    state.phase = payload.phase || 'running';
    state.currentRound = payload.roundNumber;
    state.totalRounds = payload.totalRounds;
    state.wordLength = Number(payload.wordLength || 0);
    state.wordParts = (payload.wordParts || []).map((n) => Number(n));
    roundSolution.textContent = '';
    timerEl.textContent = payload.duration;
    roundLabel.textContent = `Round ${payload.roundNumber}/${payload.totalRounds}`;
    updateHints(payload.hints);
    buildSegments(state.wordParts);
    renderSegments();
    guessesList.innerHTML = '';
    ensureGuessesPlaceholder();
    waitingNext.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden');
    leaderboardOverlay.classList.remove('show');
    finalOverlay.classList.add('hidden');
    renderPhase();
  });

  socket.on('round:tick', ({ timeLeft, visibleHints, revealCount }) => {
    if (state.phase !== 'running') return;
    timerEl.textContent = timeLeft > 0 ? timeLeft : 'Time is up!';
    state.revealCount = revealCount;
    updateHints(visibleHints);
  });

  socket.on('round:guessResult', (payload) => {
    updateGuesses(payload);
  });

  socket.on('round:ended', ({ scores, lastRoundScores, final, podium, reason, solution, phase }) => {
    state.phase = phase || (final ? 'finished' : 'round-ended');
    timerEl.textContent = reason === 'time' ? 'Time is up!' : 'Round complete';
    updateScoreboard(scores, lastRoundScores);
    state.wordLength = 0;
    state.wordParts = [];
    roundSolution.textContent = solution ? solution.toUpperCase() : '';
    leaderboardList.innerHTML = '';
    showLeaderboard(lastRoundScores, scores);
    if (!final) {
      nextRoundBtn.textContent = 'Next round';
      if (state.isHost) {
        nextRoundBtn.classList.remove('hidden');
        waitingNext.classList.add('hidden');
      } else {
        waitingNext.classList.remove('hidden');
        nextRoundBtn.classList.add('hidden');
      }
    } else {
      // Final flow: host triggers final standings via button; others wait.
      nextRoundBtn.textContent = 'Show final standings';
      state.finalPending = true;
      state.finalPodium = podium || [];
      if (state.isHost) {
        nextRoundBtn.classList.remove('hidden');
        waitingNext.classList.add('hidden');
      } else {
        waitingNext.classList.remove('hidden');
        nextRoundBtn.classList.add('hidden');
      }
    }
    guessesList.innerHTML = '';
    ensureGuessesPlaceholder();
    renderPhase();
  });

  function joinRoom(code) {
    const nickname = nicknameInput.value.trim();
    if (!nickname) return alert('Enter a nickname first.');
    socket.emit('lobby:joinRoom', { nickname, roomCode: code }, (res) => {
      if (res?.error) return alert(res.error);
      state.roomCode = res.roomCode;
      state.isHost = res.host;
      state.settings = res.settings || state.settings;
      state.packetName = res.packetName || '';
      settingDuration.value = state.settings.roundDuration;
      settingRounds.value = state.settings.totalRounds;
      hostPrivateToggle.checked = !!res.isPrivate;
      showGame();
      renderPhase();
    });
  }

  // Initialize placeholders
  ensureGuessesPlaceholder();
})();
