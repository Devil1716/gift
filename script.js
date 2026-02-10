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

// -------- POLYFILL roundRect (must be before any drawing) --------
(function () {
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (typeof r === 'undefined') r = 0;
            if (typeof r === 'number') r = [r, r, r, r];
            var tl = r[0], tr = r[1], br = r[2], bl = r[3];
            this.moveTo(x + tl, y);
            this.lineTo(x + w - tr, y);
            this.quadraticCurveTo(x + w, y, x + w, y + tr);
            this.lineTo(x + w, y + h - br);
            this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
            this.lineTo(x + bl, y + h);
            this.quadraticCurveTo(x, y + h, x, y + h - bl);
            this.lineTo(x, y + tl);
            this.quadraticCurveTo(x, y, x + tl, y);
            this.closePath();
            return this;
        };
    }
})();

// -------- AUDIO SYSTEM (renamed to avoid shadowing window.Audio) --------
var SFX = {
    ctx: null,
    muted: true,

    init: function () {
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { console.warn('AudioContext not available'); }
        }
    },

    toggle: function () {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.muted = !this.muted;
        return this.muted;
    },

    tone: function (freq, type, dur, vol) {
        if (this.muted || !this.ctx) return;
        vol = vol || 0.08;
        try {
            var o = this.ctx.createOscillator();
            var g = this.ctx.createGain();
            o.type = type;
            o.frequency.value = freq;
            g.gain.setValueAtTime(vol, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            o.connect(g);
            g.connect(this.ctx.destination);
            o.start();
            o.stop(this.ctx.currentTime + dur);
        } catch (e) { }
    },

    checkpoint: function () {
        var self = this;
        [523, 659, 784].forEach(function (f, i) {
            setTimeout(function () { self.tone(f, 'sine', 0.5, 0.06); }, i * 80);
        });
    },

    crash: function () { this.tone(150, 'sawtooth', 0.3, 0.1); },
    engine: function () { this.tone(80, 'triangle', 0.15, 0.01); },

    win: function () {
        var self = this;
        [523, 659, 784, 1047].forEach(function (f, i) {
            setTimeout(function () { self.tone(f, 'sine', 0.7, 0.1); }, i * 200);
        });
    }
};

// -------- DOM HELPERS --------
function getEl(id) { return document.getElementById(id); }

var canvas = getEl('gameCanvas');
var canvasCtx = canvas.getContext('2d');
var journeyFill = getEl('journeyFill');
var journeyLabel = getEl('journeyLabel');

// -------- GAME CONFIG --------
var LANE_COUNT = 3;
var GAME_DURATION = 40; // seconds to reach home

// -------- GAME STATE --------
var game = {
    running: false,
    width: 0,
    height: 0,
    laneWidth: 0,
    roadLeft: 0,
    roadWidth: 0,
    player: { lane: 1, x: 0, y: 0, w: 40, h: 60, targetX: 0 },
    obstacles: [],
    trees: [],
    distance: 0,
    maxDistance: 0,
    speed: 3,
    lastObstacle: 0,
    checkpointIndex: 0,
    checkpointBanner: null,
    animFrame: null
};

// -------- SIZING --------
function sizeCanvas() {
    var maxW = 380;
    var maxH = 580;
    var availW = Math.min(window.innerWidth - 20, maxW);
    var availH = Math.min(window.innerHeight - 130, maxH);

    canvas.width = availW;
    canvas.height = availH;
    game.width = availW;
    game.height = availH;
    game.roadWidth = availW * 0.62;
    game.roadLeft = (availW - game.roadWidth) / 2;
    game.laneWidth = game.roadWidth / LANE_COUNT;

    game.player.w = game.laneWidth * 0.55;
    game.player.h = game.player.w * 1.6;
    game.player.y = availH - game.player.h - 30;
    updatePlayerX();
}

function updatePlayerX() {
    var p = game.player;
    p.targetX = game.roadLeft + p.lane * game.laneWidth + (game.laneWidth - p.w) / 2;
}

// -------- CONTROLS --------
document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); steerLeft(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); steerRight(); }
});

var touchLeftBtn = getEl('touchLeft');
var touchRightBtn = getEl('touchRight');

touchLeftBtn.addEventListener('touchstart', function (e) { e.preventDefault(); steerLeft(); }, { passive: false });
touchRightBtn.addEventListener('touchstart', function (e) { e.preventDefault(); steerRight(); }, { passive: false });
touchLeftBtn.addEventListener('mousedown', function (e) { e.preventDefault(); steerLeft(); });
touchRightBtn.addEventListener('mousedown', function (e) { e.preventDefault(); steerRight(); });

// Swipe on canvas
var touchStartX = 0;
canvas.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
canvas.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 30) { dx < 0 ? steerLeft() : steerRight(); }
}, { passive: true });

function steerLeft() {
    if (!game.running) return;
    if (game.player.lane > 0) {
        game.player.lane--;
        updatePlayerX();
        SFX.tone(300, 'sine', 0.1, 0.03);
    }
}

function steerRight() {
    if (!game.running) return;
    if (game.player.lane < LANE_COUNT - 1) {
        game.player.lane++;
        updatePlayerX();
        SFX.tone(350, 'sine', 0.1, 0.03);
    }
}

// -------- START GAME --------
function startGame() {
    sizeCanvas();

    game.running = true;
    game.distance = 0;
    game.maxDistance = GAME_DURATION * 60;
    game.speed = 3;
    game.obstacles = [];
    game.trees = [];
    game.player.lane = 1;
    game.checkpointIndex = 0;
    game.checkpointBanner = null;
    game.lastObstacle = 0;
    updatePlayerX();
    game.player.x = game.player.targetX;

    // Pre-fill trees
    for (var y = -30; y < game.height; y += 80) {
        game.trees.push({ x: game.roadLeft - 25 - Math.random() * 20, y: y });
        game.trees.push({ x: game.roadLeft + game.roadWidth + 5 + Math.random() * 20, y: y });
    }

    journeyFill.style.width = '0%';
    journeyLabel.textContent = '🚗 Starting from MG Road...';

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
    var progress = Math.min(game.distance / game.maxDistance, 1);

    // Speed ramp
    game.speed = 3 + progress * 3;

    // Journey UI
    journeyFill.style.width = (progress * 100) + '%';

    // Checkpoints
    for (var i = game.checkpointIndex; i < CHECKPOINTS.length; i++) {
        if (progress >= CHECKPOINTS[i].dist && i > game.checkpointIndex) {
            game.checkpointIndex = i;
            var cp = CHECKPOINTS[i];
            journeyLabel.textContent = cp.emoji + ' Passing through ' + cp.name + '...';
            game.checkpointBanner = { text: cp.name, emoji: cp.emoji, color: cp.color, alpha: 1 };
            SFX.checkpoint();
        }
    }

    // Fade banner
    if (game.checkpointBanner) {
        game.checkpointBanner.alpha -= 0.008;
        if (game.checkpointBanner.alpha <= 0) game.checkpointBanner = null;
    }

    // Trees scroll
    for (var t = 0; t < game.trees.length; t++) {
        game.trees[t].y += game.speed * 0.8;
    }
    game.trees = game.trees.filter(function (t) { return t.y < game.height + 50; });
    if (game.trees.length < 16) {
        var minY = game.trees.reduce(function (m, t) { return Math.min(m, t.y); }, 0);
        game.trees.push({ x: game.roadLeft - 25 - Math.random() * 20, y: minY - 60 - Math.random() * 40 });
        game.trees.push({ x: game.roadLeft + game.roadWidth + 5 + Math.random() * 20, y: minY - 60 - Math.random() * 40 });
    }

    // Spawn obstacles
    var spawnInterval = 60 + Math.max(20, 50 - progress * 30);
    if (game.distance - game.lastObstacle > spawnInterval) {
        game.lastObstacle = game.distance;
        var lane = Math.floor(Math.random() * LANE_COUNT);
        var colors = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6'];
        game.obstacles.push({
            lane: lane,
            x: game.roadLeft + lane * game.laneWidth + (game.laneWidth - game.player.w * 0.9) / 2,
            y: -70,
            w: game.player.w * 0.9,
            h: game.player.h * 0.85,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    // Move obstacles
    for (var o = 0; o < game.obstacles.length; o++) {
        game.obstacles[o].y += game.speed * 0.7;
    }
    game.obstacles = game.obstacles.filter(function (o) { return o.y < game.height + 80; });

    // Player smooth movement
    var p = game.player;
    p.x += (p.targetX - p.x) * 0.2;

    // Collision (forgiving)
    for (var j = 0; j < game.obstacles.length; j++) {
        var ob = game.obstacles[j];
        if (rectsOverlap(p.x, p.y, p.w, p.h, ob.x, ob.y, ob.w, ob.h)) {
            ob.y = p.y + p.h + 10;
            SFX.crash();
            game.speed = Math.max(2, game.speed - 1);
        }
    }

    // Engine sound
    if (game.distance % 30 === 0) SFX.engine();

    // Win
    if (progress >= 1) {
        game.running = false;
        if (game.animFrame) cancelAnimationFrame(game.animFrame);
        journeyLabel.textContent = '🏠 You made it Home! 💕';
        setTimeout(function () {
            switchScreen('finale');
            SFX.win();
            launchConfetti();
        }, 800);
    }
}

function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// -------- DRAW --------
function draw() {
    var c = canvasCtx;
    var W = game.width;
    var H = game.height;

    // Sky
    var sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a1a2e');
    sky.addColorStop(0.3, '#16213e');
    sky.addColorStop(1, '#0f3460');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // Stars
    c.fillStyle = 'rgba(255,255,255,0.5)';
    for (var i = 0; i < 30; i++) {
        var sx = (i * 137.5 + game.distance * 0.01) % W;
        var sy = (i * 73.1) % (H * 0.3);
        c.fillRect(sx, sy, 1.5, 1.5);
    }

    // Grass
    c.fillStyle = '#1a472a';
    c.fillRect(0, 0, game.roadLeft, H);
    c.fillRect(game.roadLeft + game.roadWidth, 0, W - game.roadLeft - game.roadWidth, H);

    // Road
    c.fillStyle = '#2c2c2c';
    c.fillRect(game.roadLeft, 0, game.roadWidth, H);

    // Road edges
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.beginPath(); c.moveTo(game.roadLeft, 0); c.lineTo(game.roadLeft, H); c.stroke();
    c.beginPath(); c.moveTo(game.roadLeft + game.roadWidth, 0); c.lineTo(game.roadLeft + game.roadWidth, H); c.stroke();

    // Lane dividers (animated dashes)
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 2;
    c.setLineDash([20, 15]);
    for (var li = 1; li < LANE_COUNT; li++) {
        var lx = game.roadLeft + li * game.laneWidth;
        c.beginPath();
        c.moveTo(lx, (game.distance * game.speed) % 35 - 35);
        c.lineTo(lx, H);
        c.stroke();
    }
    c.setLineDash([]);

    // Trees
    for (var ti = 0; ti < game.trees.length; ti++) {
        var tr = game.trees[ti];
        c.fillStyle = '#5d4037';
        c.fillRect(tr.x + 7, tr.y + 12, 6, 12);
        c.fillStyle = '#2e7d32';
        c.beginPath();
        c.arc(tr.x + 10, tr.y + 8, 12, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#43a047';
        c.beginPath();
        c.arc(tr.x + 8, tr.y + 5, 6, 0, Math.PI * 2);
        c.fill();
    }

    // Obstacle cars
    for (var oi = 0; oi < game.obstacles.length; oi++) {
        var ob = game.obstacles[oi];
        drawCar(c, ob.x, ob.y, ob.w, ob.h, ob.color, false);
    }

    // Player car
    drawCar(c, game.player.x, game.player.y, game.player.w, game.player.h, '#ff4d88', true);

    // Checkpoint banner
    if (game.checkpointBanner) {
        var b = game.checkpointBanner;
        c.save();
        c.globalAlpha = b.alpha;
        c.font = 'bold ' + Math.min(24, W * 0.07) + 'px Outfit, Poppins, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';

        var bannerY = H * 0.28;
        var bannerText = b.emoji + ' ' + b.text;
        var tw = c.measureText(bannerText).width + 40;

        // Background
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.beginPath();
        c.roundRect(W / 2 - tw / 2, bannerY - 22, tw, 44, 12);
        c.fill();

        // Border
        c.strokeStyle = b.color;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(W / 2 - tw / 2, bannerY - 22, tw, 44, 12);
        c.stroke();

        // Text
        c.fillStyle = '#ffffff';
        c.fillText(bannerText, W / 2, bannerY);
        c.restore();
    }
}

function drawCar(c, x, y, w, h, color, isPlayer) {
    // Body
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, 8);
    c.fill();

    // Windshield
    c.fillStyle = isPlayer ? 'rgba(200,230,255,0.6)' : 'rgba(200,230,255,0.4)';
    var wsY = isPlayer ? y + h * 0.15 : y + h * 0.55;
    c.beginPath();
    c.roundRect(x + w * 0.15, wsY, w * 0.7, h * 0.22, 4);
    c.fill();

    // Lights
    if (isPlayer) {
        c.fillStyle = '#fff';
        c.shadowColor = '#fff';
        c.shadowBlur = 8;
        c.fillRect(x + 3, y + 2, w * 0.2, 4);
        c.fillRect(x + w - 3 - w * 0.2, y + 2, w * 0.2, 4);
        c.shadowBlur = 0;
    } else {
        c.fillStyle = '#ff0000';
        c.shadowColor = '#ff0000';
        c.shadowBlur = 6;
        c.fillRect(x + 2, y + 2, w * 0.18, 3);
        c.fillRect(x + w - 2 - w * 0.18, y + 2, w * 0.18, 3);
        c.shadowBlur = 0;
    }

    // Stripe
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.fillRect(x + 2, y + h * 0.4, w - 4, 3);
}

// -------- SCREENS --------
function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    var id = name + 'Screen';
    getEl(id).classList.add('active');
}

// -------- CONFETTI --------
function launchConfetti() {
    var container = getEl('confettiContainer');
    container.innerHTML = '';
    var colors = ['#ff4d88', '#8e2de2', '#fccb90', '#fff', '#26de81', '#fed330'];
    for (var i = 0; i < 100; i++) {
        var p = document.createElement('div');
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
    var bg = getEl('heartsBg');
    var emojis = ['💖', '💕', '💗', '✨', '🌹'];
    setInterval(function () {
        var h = document.createElement('span');
        h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        h.style.cssText = 'position:fixed;left:' + (Math.random() * 100) + 'vw;bottom:-40px;font-size:' + (10 + Math.random() * 16) + 'px;opacity:' + (0.3 + Math.random() * 0.4) + ';transition:transform ' + (6 + Math.random() * 6) + 's linear,opacity 6s;pointer-events:none;';
        bg.appendChild(h);
        requestAnimationFrame(function () {
            h.style.transform = 'translateY(-110vh) rotate(' + (Math.random() * 360) + 'deg)';
            h.style.opacity = '0';
        });
        setTimeout(function () { h.remove(); }, 12000);
    }, 1000);
}

// -------- EVENT LISTENERS --------
getEl('soundToggle').addEventListener('click', function () {
    var m = SFX.toggle();
    getEl('soundToggle').textContent = m ? '🔇' : '🔊';
});

getEl('envelopeBtn').addEventListener('click', function () {
    SFX.tone(600, 'sine', 0.15, 0.05);
    getEl('envelope').classList.add('open');
    setTimeout(function () {
        switchScreen('game');
        // Delay startGame to ensure the screen is visible and laid out
        setTimeout(function () {
            startGame();
        }, 100);
    }, 1000);
});

getEl('replayBtn').addEventListener('click', function () {
    switchScreen('game');
    setTimeout(function () {
        startGame();
    }, 100);
});

window.addEventListener('resize', function () {
    if (game.running) sizeCanvas();
});

// Start background effects
initHearts();
