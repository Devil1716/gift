// ============================================================
// 🎁 Surprise Gift Day — Premium Experience
// ============================================================

// -------- CUSTOMIZATION: EDIT THESE! --------
const CARD_DATA = [
    { id: 1, image: 'photos/1.jpg', emoji: '🥰', caption: 'The day we first met — my heart skipped a beat!' },
    { id: 2, image: 'photos/2.jpg', emoji: '💑', caption: 'Our first date — I was so nervous but so happy!' },
    { id: 3, image: 'photos/3.jpg', emoji: '🌅', caption: 'Watching sunsets together — pure magic!' },
    { id: 4, image: 'photos/4.jpg', emoji: '🎉', caption: 'Celebrating together — you make everything fun!' },
    { id: 5, image: 'photos/5.jpg', emoji: '🍕', caption: 'Our food adventures — we eat, we laugh, we love!' },
    { id: 6, image: 'photos/6.jpg', emoji: '🎵', caption: 'Dancing to our song — you + me = perfect rhythm!' },
    { id: 7, image: 'photos/7.jpg', emoji: '🌙', caption: 'Late night talks — my favorite kind of nights!' },
    { id: 8, image: 'photos/8.jpg', emoji: '💋', caption: 'Every kiss feels like the first one 💕' }
];

// -------- AUDIO SYSTEM (PROCEDURAL) --------
const AudioSys = {
    ctx: null,
    muted: true,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    toggle() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.muted = !this.muted;
        return this.muted;
    },

    playTone(freq, type, duration, vol = 0.1) {
        if (this.muted || !this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) { console.error(e); }
    },

    playHover() {
        this.playTone(400, 'sine', 0.1, 0.02);
    },

    playClick() {
        this.playTone(600, 'sine', 0.15, 0.05);
    },

    playFlip() {
        this.playTone(300, 'triangle', 0.2, 0.05);
    },

    playMatch() {
        // Play a major chord
        [523.25, 659.25, 783.99].forEach((freq, i) => { // C Major
            setTimeout(() => this.playTone(freq, 'sine', 0.6, 0.05), i * 50);
        });
    },

    playWin() {
        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.8, 0.1), i * 150);
        });
    }
};

// -------- DOM ELEMENTS --------
const els = {
    screens: {
        intro: document.getElementById('introScreen'),
        game: document.getElementById('gameScreen'),
        finale: document.getElementById('finaleScreen')
    },
    envelope: document.getElementById('envelopeBtn'),
    grid: document.getElementById('gameGrid'),
    popup: document.getElementById('matchPopup'),
    matchText: document.getElementById('matchText'),
    matchCount: document.getElementById('matchCount'),
    moveCount: document.getElementById('moveCount'),
    soundToggle: document.getElementById('soundToggle'),
    heartsBg: document.getElementById('heartsBg'),
    replayBtn: document.getElementById('replayBtn')
};

// -------- STATE --------
let state = {
    flipped: [],
    matches: 0,
    moves: 0,
    locked: false
};

// -------- INIT & LISTENERS --------
els.soundToggle.addEventListener('click', () => {
    const isMuted = AudioSys.toggle();
    els.soundToggle.textContent = isMuted ? '🔇' : '🔊';
    els.soundToggle.classList.toggle('muted', isMuted);
    if (!isMuted) AudioSys.playClick();
});

els.envelope.addEventListener('click', () => {
    AudioSys.playClick();
    const env = els.envelope.querySelector('.envelope');
    env.classList.add('open');

    setTimeout(() => {
        switchScreen('game');
        initGame();
    }, 1200);
});

els.replayBtn.addEventListener('click', () => {
    switchScreen('game');
    initGame();
});

function switchScreen(name) {
    Object.values(els.screens).forEach(s => s.classList.remove('active'));
    els.screens[name].classList.add('active');
}

// -------- GAME LOGIC --------
function initGame() {
    state = { flipped: [], matches: 0, moves: 0, locked: false };
    els.grid.innerHTML = '';
    els.matchCount.textContent = '0/8';
    els.moveCount.textContent = '0';

    // Create Deck
    const deck = [...CARD_DATA, ...CARD_DATA]
        .sort(() => Math.random() - 0.5)
        .map((data, index) => ({ ...data, uid: index }));

    // Render Cards
    deck.forEach(card => {
        const el = document.createElement('div');
        el.className = 'memory-card';
        el.innerHTML = `
            <div class="card-face card-front">
                ${card.image ? `<img src="${card.image}" loading="lazy">` : `<span style="font-size:3rem">${card.emoji}</span>`}
            </div>
            <div class="card-face card-back"></div>
        `;

        el.addEventListener('click', () => handleFlip(el, card));
        el.addEventListener('mouseenter', () => AudioSys.playHover());
        els.grid.appendChild(el);
    });
}

function handleFlip(el, card) {
    if (state.locked || el.classList.contains('flipped') || el.classList.contains('matched')) return;

    AudioSys.playFlip();
    el.classList.add('flipped');
    state.flipped.push({ el, card });

    if (state.flipped.length === 2) {
        state.moves++;
        els.moveCount.textContent = state.moves;
        checkMatch();
    }
}

function checkMatch() {
    state.locked = true;
    const [c1, c2] = state.flipped;

    if (c1.card.id === c2.card.id) {
        // Match
        setTimeout(() => {
            AudioSys.playMatch();
            c1.el.classList.add('matched');
            c2.el.classList.add('matched');
            state.matches++;
            els.matchCount.textContent = `${state.matches}/8`;

            showPopup(c1.card.caption);
            state.flipped = [];
            state.locked = false;

            if (state.matches === 8) {
                setTimeout(() => {
                    switchScreen('finale');
                    AudioSys.playWin();
                    startConfetti();
                }, 2000);
            }
        }, 500);
    } else {
        // No match
        setTimeout(() => {
            c1.el.classList.remove('flipped');
            c2.el.classList.remove('flipped');
            state.flipped = [];
            state.locked = false;
        }, 1200);
    }
}

function showPopup(text) {
    els.matchText.textContent = text;
    els.popup.classList.add('visible');
    setTimeout(() => els.popup.classList.remove('visible'), 2000);
}

// -------- VISUAL EFFECTS --------
// 1. Mouse Trail
document.addEventListener('mousemove', (e) => {
    if (Math.random() > 0.8) { // Throttle particles
        const p = document.createElement('div');
        p.className = 'cursor-particle';
        p.style.left = e.clientX + 'px';
        p.style.top = e.clientY + 'px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
});

// 2. Confetti
function startConfetti() {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = ''; // Clear prev
    const colors = ['#ff4d88', '#8e2de2', '#fccb90', '#ffffff'];

    for (let i = 0; i < 100; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.animationDuration = (Math.random() * 2 + 2) + 's';
        c.style.width = (Math.random() * 8 + 4) + 'px'; // Random size
        c.style.height = c.style.width;
        container.appendChild(c);
    }
}

// 3. Floating Hearts (Background)
function initHearts() {
    const emojis = ['💖', '💕', '💗', '✨', '🌹'];
    setInterval(() => {
        const h = document.createElement('div');
        h.innerText = emojis[Math.floor(Math.random() * emojis.length)];
        h.style.position = 'fixed';
        h.style.left = Math.random() * 100 + 'vw';
        h.style.bottom = '-50px';
        h.style.fontSize = Math.random() * 20 + 10 + 'px';
        h.style.opacity = Math.random();
        h.style.transition = `transform ${Math.random() * 5 + 5}s linear, opacity 5s`;
        h.style.pointerEvents = 'none'; // Fix click blocking
        els.heartsBg.appendChild(h);

        // Trigger generic animation via JS to avoid complex CSS keyframes for random values
        requestAnimationFrame(() => {
            h.style.transform = `translateY(-110vh) rotate(${Math.random() * 360}deg)`;
            h.style.opacity = 0;
        });

        setTimeout(() => h.remove(), 10000);
    }, 800);
}

// Start visual effects
initHearts();
