// ============================================================
//  Surprise Gift Day - Bangalore Car Drive Game
// ============================================================

// -------- BANGALORE JOURNEY CHECKPOINTS --------
const CHECKPOINTS = [
    { name: 'MG Road', dist: 0, color: '#ff6b6b', emoji: '🏙️' },
    { name: 'Brigade Road', dist: 0.12, color: '#ee5a24', emoji: '🛍️' },
    { name: 'Cubbon Park', dist: 0.25, color: '#26de81', emoji: '🌳' },
    { name: 'Vidhana Soudha', dist: 0.37, color: '#fed330', emoji: '🏛️' },
    { name: 'Lalbagh Garden', dist: 0.50, color: '#2bcbba', emoji: '🌺' },
    { name: 'Koramangala', dist: 0.62, color: '#a55eea', emoji: '☕' },
    { name: 'Indiranagar', dist: 0.75, color: '#fd9644', emoji: '🎶' },
    { name: 'JP Nagar', dist: 0.87, color: '#4b7bec', emoji: '🌆' },
    { name: 'Home', dist: 1.0, color: '#ff4d88', emoji: '🏠' }
];

// -------- AUDIO SYSTEM --------
const Audio = {
    ctx: null, muted: true,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    toggle() { if (!this.ctx) this.init(); if (this.ctx.state === 'suspended') this.ctx.resume(); this.muted = !this.muted; return this.muted; },
    tone(freq, type, dur, vol = 0.08) {
        if (this.muted || !this.ctx) return;
        try {
            const o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.setValueAtTime(vol, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(); o.stop(this.ctx.currentTime + dur);
        } catch (e) { }
    },
    checkpoint() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.5, 0.06), i * 80)); },
    crash() { this.tone(150, 'sawtooth', 0.3, 0.1); },
    engine() { this.tone(80, 'triangle', 0.15, 0.01); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.7, 0.1), i * 200)); }
};

// -------- DOM --------
const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const journeyFill = $('journeyFill');
const journeyLabel = $('journeyLabel');

// -------- GAME CONFIG --------
const LANE_COUNT = 3;
const GAME_DURATION = 45; // seconds to reach home
const OBSTACLE_INTERVAL = 1200; // ms between obstacles

// -------- GAME STATE --------
let game = {
    running: false,
    width: 0, height: 0,
    laneWidth: 0,
    roadLeft: 0,
    roadWidth: 0,
    player: { lane: 1, x: 0, y: 0, w: 40, h: 60, targetX: 0 },
    obstacles: [],
    trees: [],
    roadMarks: [],
    distance: 0,
    maxDistance: 0,
    speed: 3,
    lastObstacle: 0,
    checkpointIndex: 0,
    checkpointBanner: null,
    keys: { left: false, right: false },
    animFrame: null,
    startTime: 0,
    lastTreeY: 0,
};

// -------- SIZING --------
function sizeCanvas() {
    const maxW = 360, maxH = 560;
    const parent = canvas.parentElement;
    const availH = window.innerHeight - 120;
    const h = Math.min(maxH, availH);
    const w = Math.min(maxW, parent.clientWidth - 20);

    canvas.width = w;
    canvas.height = h;
    game.width = w;
    game.height = h;
    game.roadWidth = w * 0.65;
    game.roadLeft = (w - game.roadWidth) / 2;
    game.laneWidth = game.roadWidth / LANE_COUNT;

    // Player dimensions
    game.player.w = game.laneWidth * 0.55;
    game.player.h = game.player.w * 1.6;
    game.player.y = h - game.player.h - 30;
    updatePlayerX();
}

function updatePlayerX() {
    const p = game.player;
    p.targetX = game.roadLeft + p.lane * game.laneWidth + (game.laneWidth - p.w) / 2;
}

// -------- CONTROLS --------
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); steerLeft(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); steerRight(); }
});

$('touchLeft').addEventListener('touchstart', e => { e.preventDefault(); steerLeft(); }, { passive: false });
$('touchRight').addEventListener('touchstart', e => { e.preventDefault(); steerRight(); }, { passive: false });
$('touchLeft').addEventListener('mousedown', e => { e.preventDefault(); steerLeft(); });
$('touchRight').addEventListener('mousedown', e => { e.preventDefault(); steerRight(); });

// Swipe detection on canvas
let touchStartX = 0;
canvas.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
canvas.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 30) { dx < 0 ? steerLeft() : steerRight(); }
}, { passive: true });

function steerLeft() {
    if (!game.running) return;
    if (game.player.lane > 0) { game.player.lane--; updatePlayerX(); Audio.tone(300, 'sine', 0.1, 0.03); }
}

function steerRight() {
    if (!game.running) return;
    if (game.player.lane < LANE_COUNT - 1) { game.player.lane++; updatePlayerX(); Audio.tone(350, 'sine', 0.1, 0.03); }
}

// -------- INIT GAME --------
function startGame() {
    sizeCanvas();
    game.running = true;
    game.distance = 0;
    game.maxDistance = GAME_DURATION * 60; // 60fps * seconds
    game.speed = 3;
    game.obstacles = [];
    game.trees = [];
    game.roadMarks = [];
    game.player.lane = 1;
    game.checkpointIndex = 0;
    game.checkpointBanner = null;
    game.lastObstacle = 0;
    game.startTime = Date.now();
    updatePlayerX();
    game.player.x = game.player.targetX;

    // Pre-fill road marks
    for (let y = -20; y < game.height; y += 40) {
        game.roadMarks.push({ y });
    }

    // Pre-fill trees
    for (let y = -30; y < game.height; y += 80) {
        game.trees.push({ x: game.roadLeft - 25 - Math.random() * 20, y, side: 'left' });
        game.trees.push({ x: game.roadLeft + game.roadWidth + 5 + Math.random() * 20, y, side: 'right' });
    }

    journeyFill.style.width = '0%';
    journeyLabel.textContent = `🚗 Starting from ${CHECKPOINTS[0].name}...`;

    if (game.animFrame) cancelAnimationFrame(game.animFrame);
    loop();
}

// -------- GAME LOOP --------
function loop() {
    if (!game.running) return;
    update();
    draw();
    game.animFrame = requestAnimationFrame(loop);
}

function update() {
    game.distance++;
    const progress = Math.min(game.distance / game.maxDistance, 1);

    // Speed ramp
    game.speed = 3 + progress * 3;

    // Update journey UI
    journeyFill.style.width = (progress * 100) + '%';

    // Check checkpoint
    for (let i = game.checkpointIndex; i < CHECKPOINTS.length; i++) {
        if (progress >= CHECKPOINTS[i].dist && i > game.checkpointIndex) {
            game.checkpointIndex = i;
            const cp = CHECKPOINTS[i];
            journeyLabel.textContent = `${cp.emoji} Passing through ${cp.name}...`;
            game.checkpointBanner = { text: cp.name, emoji: cp.emoji, color: cp.color, alpha: 1 };
            Audio.checkpoint();
        }
    }

    // Fade banner
    if (game.checkpointBanner) {
        game.checkpointBanner.alpha -= 0.008;
        if (game.checkpointBanner.alpha <= 0) game.checkpointBanner = null;
    }

    // Road marks scroll
    game.roadMarks.forEach(m => m.y += game.speed);
    if (game.roadMarks.length && game.roadMarks[0].y > game.height + 20) {
        game.roadMarks.shift();
        game.roadMarks.push({ y: game.roadMarks[game.roadMarks.length - 1].y - 40 });
    }

    // Trees scroll
    game.trees.forEach(t => t.y += game.speed * 0.8);
    game.trees = game.trees.filter(t => t.y < game.height + 50);
    if (game.trees.length < 20) {
        const lastY = game.trees.reduce((min, t) => Math.min(min, t.y), 0);
        game.trees.push({ x: game.roadLeft - 25 - Math.random() * 20, y: lastY - 60 - Math.random() * 40, side: 'left' });
        game.trees.push({ x: game.roadLeft + game.roadWidth + 5 + Math.random() * 20, y: lastY - 60 - Math.random() * 40, side: 'right' });
    }

    // Spawn obstacles
    if (game.distance - game.lastObstacle > (OBSTACLE_INTERVAL / 16) / (game.speed / 3)) {
        game.lastObstacle = game.distance;
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const colors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6'];
        game.obstacles.push({
            lane,
            x: game.roadLeft + lane * game.laneWidth + (game.laneWidth - game.player.w * 0.9) / 2,
            y: -60,
            w: game.player.w * 0.9,
            h: game.player.h * 0.85,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    // Move obstacles
    game.obstacles.forEach(o => o.y += game.speed * 0.7);
    game.obstacles = game.obstacles.filter(o => o.y < game.height + 80);

    // Player smooth movement
    const p = game.player;
    p.x += (p.targetX - p.x) * 0.2;

    // Collision check
    game.obstacles.forEach(o => {
        if (rectsOverlap(p.x, p.y, p.w, p.h, o.x, o.y, o.w, o.h)) {
            // Push obstacle aside instead of game over (forgiving)
            o.y = p.y + p.h + 10;
            Audio.crash();
            // Slow down briefly
            game.speed = Math.max(2, game.speed - 1);
        }
    });

    // Engine sound occasionally
    if (game.distance % 30 === 0) Audio.engine();

    // Win condition
    if (progress >= 1) {
        game.running = false;
        cancelAnimationFrame(game.animFrame);
        journeyLabel.textContent = '🏠 You made it Home! 💕';
        setTimeout(() => {
            switchScreen('finale');
            Audio.win();
            launchConfetti();
        }, 800);
    }
}

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// -------- DRAW --------
function draw() {
    const c = ctx;
    const W = game.width, H = game.height;

    // Sky gradient
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1a2e');
    sky.addColorStop(0.3, '#16213e');
    sky.addColorStop(1, '#0f3460');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // Stars
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 30; i++) {
        const sx = (i * 137.5 + game.distance * 0.01) % W;
        const sy = (i * 73.1) % (H * 0.3);
        c.fillRect(sx, sy, 1.5, 1.5);
    }

    // Grass
    c.fillStyle = '#1a472a';
    c.fillRect(0, 0, game.roadLeft, H);
    c.fillRect(game.roadLeft + game.roadWidth, 0, W, H);

    // Road
    c.fillStyle = '#2c2c2c';
    c.fillRect(game.roadLeft, 0, game.roadWidth, H);

    // Road edges (white lines)
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(game.roadLeft, 0); c.lineTo(game.roadLeft, H); c.stroke();
    c.beginPath(); c.moveTo(game.roadLeft + game.roadWidth, 0); c.lineTo(game.roadLeft + game.roadWidth, H); c.stroke();

    // Lane dividers (dashed)
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 2;
    c.setLineDash([20, 15]);
    for (let i = 1; i < LANE_COUNT; i++) {
        const lx = game.roadLeft + i * game.laneWidth;
        c.beginPath();
        c.moveTo(lx, (game.distance * game.speed) % 35 - 35);
        c.lineTo(lx, H);
        c.stroke();
    }
    c.setLineDash([]);

    // Trees
    game.trees.forEach(t => {
        // Trunk
        c.fillStyle = '#5d4037';
        c.fillRect(t.x + 7, t.y + 12, 6, 12);
        // Foliage
        c.fillStyle = '#2e7d32';
        c.beginPath();
        c.arc(t.x + 10, t.y + 8, 12, 0, Math.PI * 2);
        c.fill();
        // Highlight
        c.fillStyle = '#43a047';
        c.beginPath();
        c.arc(t.x + 8, t.y + 5, 6, 0, Math.PI * 2);
        c.fill();
    });

    // Obstacles (other cars)
    game.obstacles.forEach(o => {
        drawCar(c, o.x, o.y, o.w, o.h, o.color, false);
    });

    // Player car
    drawCar(c, game.player.x, game.player.y, game.player.w, game.player.h, '#ff4d88', true);

    // Checkpoint banner
    if (game.checkpointBanner) {
        const b = game.checkpointBanner;
        c.save();
        c.globalAlpha = b.alpha;
        c.fillStyle = b.color;
        c.font = `bold ${Math.min(28, W * 0.08)}px 'Outfit', sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';

        // Banner background
        const bannerY = H * 0.3;
        c.fillStyle = 'rgba(0,0,0,0.6)';
        const textW = c.measureText(`${b.emoji} ${b.text}`).width + 40;
        c.roundRect(W / 2 - textW / 2, bannerY - 22, textW, 44, 12);
        c.fill();

        // Banner border
        c.strokeStyle = b.color;
        c.lineWidth = 2;
        c.roundRect(W / 2 - textW / 2, bannerY - 22, textW, 44, 12);
        c.stroke();

        // Banner text
        c.fillStyle = '#fff';
        c.fillText(`${b.emoji} ${b.text}`, W / 2, bannerY);
        c.restore();
    }
}

function drawCar(c, x, y, w, h, color, isPlayer) {
    c.save();

    // Car body
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, 8);
    c.fill();

    // Windshield
    c.fillStyle = isPlayer ? 'rgba(200,230,255,0.6)' : 'rgba(200,230,255,0.4)';
    const wsY = isPlayer ? y + h * 0.15 : y + h * 0.55;
    c.beginPath();
    c.roundRect(x + w * 0.15, wsY, w * 0.7, h * 0.22, 4);
    c.fill();

    // Headlights / taillights
    if (isPlayer) {
        // Headlights (top of car, since we're driving up)
        c.fillStyle = '#fff';
        c.shadowColor = '#fff';
        c.shadowBlur = 8;
        c.fillRect(x + 3, y + 2, w * 0.2, 4);
        c.fillRect(x + w - 3 - w * 0.2, y + 2, w * 0.2, 4);
        c.shadowBlur = 0;
    } else {
        // Taillights (top since cars are coming down)
        c.fillStyle = '#ff0000';
        c.shadowColor = '#ff0000';
        c.shadowBlur = 6;
        c.fillRect(x + 2, y + 2, w * 0.18, 3);
        c.fillRect(x + w - 2 - w * 0.18, y + 2, w * 0.18, 3);
        c.shadowBlur = 0;
    }

    // Side stripe
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(x + 2, y + h * 0.4, w - 4, 3);

    c.restore();
}

// -------- SCREENS --------
function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`${name === 'intro' ? 'intro' : name === 'game' ? 'game' : 'finale'}Screen`).classList.add('active');
}

// -------- CONFETTI --------
function launchConfetti() {
    const container = $('confettiContainer');
    container.innerHTML = '';
    const colors = ['#ff4d88', '#8e2de2', '#fccb90', '#fff', '#26de81', '#fed330'];
    for (let i = 0; i < 100; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.style.left = Math.random() * 100 + '%';
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.width = (5 + Math.random() * 8) + 'px';
        p.style.height = (5 + Math.random() * 8) + 'px';
        p.style.animationDuration = (2 + Math.random() * 3) + 's';
        p.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(p);
    }
}

// -------- FLOATING HEARTS --------
function initHearts() {
    const bg = $('heartsBg');
    const emojis = ['💖', '💕', '💗', '✨', '🌹'];
    setInterval(() => {
        const h = document.createElement('span');
        h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        h.style.cssText = `position:fixed;left:${Math.random() * 100}vw;bottom:-40px;font-size:${10 + Math.random() * 16}px;opacity:${0.3 + Math.random() * 0.4};transition:transform ${6 + Math.random() * 6}s linear,opacity 6s;pointer-events:none;`;
        bg.appendChild(h);
        requestAnimationFrame(() => {
            h.style.transform = `translateY(-110vh) rotate(${Math.random() * 360}deg)`;
            h.style.opacity = '0';
        });
        setTimeout(() => h.remove(), 12000);
    }, 1000);
}

// -------- INIT --------
$('soundToggle').addEventListener('click', () => {
    const m = Audio.toggle();
    $('soundToggle').textContent = m ? '🔇' : '🔊';
});

$('envelopeBtn').addEventListener('click', () => {
    Audio.tone(600, 'sine', 0.15, 0.05);
    $('envelope').classList.add('open');
    setTimeout(() => {
        switchScreen('game');
        startGame();
    }, 1000);
});

$('replayBtn').addEventListener('click', () => {
    switchScreen('game');
    startGame();
});

window.addEventListener('resize', () => { if (game.running) sizeCanvas(); });

// Polyfill roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        const [tl, tr, br, bl] = r;
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y); this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br); this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h); this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl); this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

initHearts();
