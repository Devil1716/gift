// ============================================================
//  Surprise Gift - Pseudo-3D Bangalore Car Race
//  OutRun-style perspective road with Bangalore checkpoints
// ============================================================

// -------- POLYFILL --------
(function () {
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (typeof r === 'undefined') r = 0;
            if (typeof r === 'number') r = [r, r, r, r];
            this.moveTo(x + r[0], y);
            this.lineTo(x + w - r[1], y); this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
            this.lineTo(x + w, y + h - r[2]); this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
            this.lineTo(x + r[3], y + h); this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
            this.lineTo(x, y + r[0]); this.quadraticCurveTo(x, y, x + r[0], y);
            this.closePath();
            return this;
        };
    }
})();

// -------- CHECKPOINTS --------
var CHECKPOINTS = [
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

// -------- AUDIO --------
var SFX = {
    ctx: null, muted: true,
    init: function () {
        if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    },
    toggle: function () {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.muted = !this.muted;
        return this.muted;
    },
    tone: function (freq, type, dur, vol) {
        if (this.muted || !this.ctx) return;
        try {
            var o = this.ctx.createOscillator(), g = this.ctx.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            o.connect(g); g.connect(this.ctx.destination);
            o.start(); o.stop(this.ctx.currentTime + dur);
        } catch (e) { }
    },
    checkpoint: function () { var s = this;[523, 659, 784].forEach(function (f, i) { setTimeout(function () { s.tone(f, 'sine', 0.5, 0.06); }, i * 80); }); },
    crash: function () { this.tone(150, 'sawtooth', 0.3, 0.1); },
    engine: function () { this.tone(90, 'triangle', 0.12, 0.015); },
    win: function () { var s = this;[523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { s.tone(f, 'sine', 0.7, 0.1); }, i * 200); }); }
};

// -------- DOM --------
function getEl(id) { return document.getElementById(id); }
var canvas, C, journeyFill, journeyLabel;

// -------- 3D ROAD CONFIG --------
var ROAD = {
    LENGTH: 6000,        // total road segments
    SEG_LENGTH: 200,     // segment length in world units
    LANES: 3,
    ROAD_W: 2200,        // half-width of road in world units
    RUMBLE_W: 200,       // rumble strip width
    DRAW_DIST: 150,      // how many segments to draw
    FOG_DIST: 100        // fog start segment
};

// -------- GAME STATE --------
var game = {
    running: false,
    W: 0, H: 0,
    segments: [],
    playerX: 0,           // -1 to 1 (left to right)
    position: 0,          // z-position along road
    speed: 0,
    maxSpeed: ROAD.SEG_LENGTH * 60, // we want ~60 seg/s at max
    accel: 0.008,
    decel: 0.05,
    braking: 0.04,
    offRoadDecel: 0.06,
    centrifugal: 0.25,
    cars: [],
    checkpointIndex: 0,
    checkpointBanner: null,
    animFrame: null,
    totalLength: 0
};

// -------- BUILD ROAD --------
function buildRoad() {
    game.segments = [];
    var n = ROAD.LENGTH;
    for (var i = 0; i < n; i++) {
        var seg = {
            index: i,
            p1: { world: { z: i * ROAD.SEG_LENGTH }, camera: {}, screen: {} },
            p2: { world: { z: (i + 1) * ROAD.SEG_LENGTH }, camera: {}, screen: {} },
            curve: 0,
            hill: 0,
            color: { road: '', grass: '', rumble: '', lane: '' },
            sprites: [],
            cars: []
        };

        // Add curves at different sections
        if (i > 50 && i < 150) seg.curve = 1.5;
        if (i > 250 && i < 400) seg.curve = -2.0;
        if (i > 500 && i < 600) seg.curve = 3.0;
        if (i > 700 && i < 850) seg.curve = -1.5;
        if (i > 1000 && i < 1200) seg.curve = 2.5;
        if (i > 1400 && i < 1550) seg.curve = -3.0;
        if (i > 1800 && i < 2000) seg.curve = 1.0;
        if (i > 2200 && i < 2400) seg.curve = -2.0;
        if (i > 2800 && i < 3000) seg.curve = 2.0;
        if (i > 3300 && i < 3500) seg.curve = -1.5;
        if (i > 3800 && i < 4000) seg.curve = 3.0;
        if (i > 4300 && i < 4500) seg.curve = -2.5;
        if (i > 5000 && i < 5200) seg.curve = 1.5;
        if (i > 5500 && i < 5700) seg.curve = -1.0;

        // Hills
        if (i > 100 && i < 200) seg.hill = Math.sin((i - 100) / 100 * Math.PI) * 40;
        if (i > 400 && i < 550) seg.hill = Math.sin((i - 400) / 150 * Math.PI) * 60;
        if (i > 800 && i < 950) seg.hill = Math.sin((i - 800) / 150 * Math.PI) * 30;
        if (i > 1200 && i < 1400) seg.hill = Math.sin((i - 1200) / 200 * Math.PI) * 50;
        if (i > 2000 && i < 2200) seg.hill = Math.sin((i - 2000) / 200 * Math.PI) * 45;
        if (i > 3000 && i < 3200) seg.hill = Math.sin((i - 3000) / 200 * Math.PI) * 55;
        if (i > 4000 && i < 4200) seg.hill = Math.sin((i - 4000) / 200 * Math.PI) * 35;
        if (i > 5200 && i < 5400) seg.hill = Math.sin((i - 5200) / 200 * Math.PI) * 40;

        // Colors (alternating)
        var dark = (Math.floor(i / 4) % 2 === 0);
        seg.color = {
            road: dark ? '#333333' : '#363636',
            grass: dark ? '#1a5c2a' : '#1e6b30',
            rumble: dark ? '#cc0000' : '#ffffff',
            lane: dark ? '#ffffff' : ''
        };

        // Trees on sides every 8 segments
        if (i % 8 === 0) {
            seg.sprites.push({ x: -1.3 - Math.random() * 0.5, type: 'tree' });
            seg.sprites.push({ x: 1.3 + Math.random() * 0.5, type: 'tree' });
        }

        // Buildings every 20 segments
        if (i % 20 === 0 && i > 0) {
            seg.sprites.push({ x: -1.6 - Math.random() * 0.3, type: 'building' });
        }
        if (i % 25 === 0 && i > 0) {
            seg.sprites.push({ x: 1.6 + Math.random() * 0.3, type: 'building' });
        }

        // Checkpoint signs
        for (var ci = 0; ci < CHECKPOINTS.length; ci++) {
            var cpSeg = Math.floor(CHECKPOINTS[ci].dist * (n - 1));
            if (i === cpSeg) {
                seg.sprites.push({ x: -1.5, type: 'sign', text: CHECKPOINTS[ci].emoji + ' ' + CHECKPOINTS[ci].name, color: CHECKPOINTS[ci].color });
                seg.sprites.push({ x: 1.5, type: 'sign', text: CHECKPOINTS[ci].emoji + ' ' + CHECKPOINTS[ci].name, color: CHECKPOINTS[ci].color });
            }
        }

        game.segments.push(seg);
    }
    game.totalLength = n * ROAD.SEG_LENGTH;

    // Add traffic cars
    game.cars = [];
    for (var tc = 0; tc < 40; tc++) {
        game.cars.push({
            z: Math.random() * game.totalLength,
            x: -0.7 + Math.random() * 1.4,  // -0.7 to 0.7
            speed: game.maxSpeed * (0.15 + Math.random() * 0.25),
            color: ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c'][Math.floor(Math.random() * 7)]
        });
    }
}

function findSegment(z) {
    return game.segments[Math.floor(z / ROAD.SEG_LENGTH) % game.segments.length];
}

// -------- PROJECTION --------
var cameraDepth = 1 / Math.tan(80 * Math.PI / 360); // 80 degree FOV
var cameraHeight = 1200;
var playerZ = cameraDepth * cameraHeight; // derived from camera

function project(p, cameraX, cameraY, cameraZ, W, H) {
    p.camera.x = (p.world.x || 0) - cameraX;
    p.camera.y = (p.world.y || 0) - cameraY;
    p.camera.z = (p.world.z || 0) - cameraZ;
    if (p.camera.z <= 0) p.camera.z = 0.1;
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD.ROAD_W * W / 2);
}

// -------- SIZING --------
function sizeCanvas() {
    var maxW = 480, maxH = 640;
    var w = Math.min(maxW, window.innerWidth - 10);
    var h = Math.min(maxH, window.innerHeight - 100);
    canvas.width = w;
    canvas.height = h;
    game.W = w;
    game.H = h;
}

// -------- CONTROLS --------
var keys = { left: false, right: false, up: false };

document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') keys.up = true;
});
document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp') keys.up = false;
});

// Touch controls
var touchActive = { left: false, right: false };

function setupTouch() {
    var tl = getEl('touchLeft'), tr = getEl('touchRight');
    function onDown(dir) { return function (e) { e.preventDefault(); touchActive[dir] = true; }; }
    function onUp(dir) { return function (e) { touchActive[dir] = false; }; }

    tl.addEventListener('touchstart', onDown('left'), { passive: false });
    tl.addEventListener('touchend', onUp('left'));
    tl.addEventListener('mousedown', onDown('left'));
    tl.addEventListener('mouseup', onUp('left'));
    tl.addEventListener('mouseleave', onUp('left'));

    tr.addEventListener('touchstart', onDown('right'), { passive: false });
    tr.addEventListener('touchend', onUp('right'));
    tr.addEventListener('mousedown', onDown('right'));
    tr.addEventListener('mouseup', onUp('right'));
    tr.addEventListener('mouseleave', onUp('right'));
}

// Swipe
var swipeX = 0;
function setupSwipe() {
    canvas.addEventListener('touchstart', function (e) { swipeX = e.touches[0].clientX; }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
        var dx = e.touches[0].clientX - swipeX;
        game.playerX = Math.max(-1, Math.min(1, game.playerX + dx * 0.003));
        swipeX = e.touches[0].clientX;
    }, { passive: true });
}

// -------- START --------
function startGame() {
    sizeCanvas();
    buildRoad();

    game.playerX = 0;
    game.position = 0;
    game.speed = 0;
    game.checkpointIndex = 0;
    game.checkpointBanner = null;

    journeyFill.style.width = '0%';
    journeyLabel.textContent = '🚗 Starting from MG Road...';

    game.running = true;
    if (game.animFrame) cancelAnimationFrame(game.animFrame);
    loop();
}

// -------- LOOP --------
function loop() {
    if (!game.running) return;
    update();
    render();
    game.animFrame = requestAnimationFrame(loop);
}

function update() {
    var dt = 1 / 60;
    var seg = findSegment(game.position);
    var speedPct = game.speed / game.maxSpeed;
    var progress = game.position / game.totalLength;

    // Auto-accelerate (she doesn't need to press up)
    game.speed += game.maxSpeed * game.accel * dt * 60;

    // Steer
    var steerDir = 0;
    if (keys.left || touchActive.left) steerDir = -1;
    if (keys.right || touchActive.right) steerDir = 1;
    game.playerX += steerDir * 0.04 * (game.speed / game.maxSpeed);

    // Centrifugal force from curves
    game.playerX -= seg.curve * game.centrifugal * speedPct * speedPct * dt * 3;

    // Off-road slowdown
    if (game.playerX < -1 || game.playerX > 1) {
        game.speed -= game.maxSpeed * game.offRoadDecel * dt * 60;
        game.playerX = Math.max(-1.5, Math.min(1.5, game.playerX));
    }

    // Clamp speed
    game.speed = Math.max(0, Math.min(game.speed, game.maxSpeed * (0.5 + progress * 0.5)));

    // Move
    game.position += game.speed * dt;

    // Traffic collision (forgiving)
    var playerSeg = findSegment(game.position + playerZ);
    for (var ci = 0; ci < game.cars.length; ci++) {
        var car = game.cars[ci];
        var carSeg = findSegment(car.z);
        if (carSeg.index === playerSeg.index) {
            if (Math.abs(game.playerX - car.x) < 0.5) {
                game.speed *= 0.6;
                SFX.crash();
            }
        }
    }

    // Move traffic
    for (var ti = 0; ti < game.cars.length; ti++) {
        var tc = game.cars[ti];
        tc.z += tc.speed * dt;
        if (tc.z > game.totalLength) tc.z -= game.totalLength;
    }

    // Journey
    if (progress > 1) progress = 1;
    journeyFill.style.width = (progress * 100) + '%';

    // Checkpoints
    for (var cpi = game.checkpointIndex; cpi < CHECKPOINTS.length; cpi++) {
        if (progress >= CHECKPOINTS[cpi].dist && cpi > game.checkpointIndex) {
            game.checkpointIndex = cpi;
            var cp = CHECKPOINTS[cpi];
            journeyLabel.textContent = cp.emoji + ' Passing through ' + cp.name + '...';
            game.checkpointBanner = { text: cp.name, emoji: cp.emoji, color: cp.color, timer: 120 };
            SFX.checkpoint();
        }
    }

    if (game.checkpointBanner) {
        game.checkpointBanner.timer--;
        if (game.checkpointBanner.timer <= 0) game.checkpointBanner = null;
    }

    // Engine sound
    if (Math.floor(game.position / 500) !== Math.floor((game.position - game.speed * dt) / 500)) {
        SFX.engine();
    }

    // Win
    if (progress >= 1) {
        game.running = false;
        cancelAnimationFrame(game.animFrame);
        journeyLabel.textContent = '🏠 You made it Home! 💕';
        setTimeout(function () {
            switchScreen('finale');
            SFX.win();
            launchConfetti();
        }, 1000);
    }
}

// -------- RENDER --------
function render() {
    var c = C;
    var W = game.W, H = game.H;

    // Sky gradient
    var sky = c.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, '#0a0a2e');
    sky.addColorStop(0.4, '#1a1a4e');
    sky.addColorStop(1, '#2d1b69');
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // Stars
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (var si = 0; si < 50; si++) {
        var stx = (si * 97.3 + 10) % W;
        var sty = (si * 43.7 + 5) % (H * 0.35);
        var stSize = (si % 3 === 0) ? 2 : 1;
        c.fillRect(stx, sty, stSize, stSize);
    }

    // Moon
    c.fillStyle = 'rgba(255,255,220,0.15)';
    c.beginPath();
    c.arc(W * 0.8, H * 0.12, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,220,0.3)';
    c.beginPath();
    c.arc(W * 0.8, H * 0.12, 20, 0, Math.PI * 2);
    c.fill();

    var baseSegIdx = Math.floor(game.position / ROAD.SEG_LENGTH);
    var basePercent = (game.position % ROAD.SEG_LENGTH) / ROAD.SEG_LENGTH;

    // Cumulative curve offset
    var x = 0;
    var dx = 0;
    var maxY = H;
    var cumY = 0;

    // Collect segments to draw
    for (var n = 0; n < ROAD.DRAW_DIST; n++) {
        var idx = (baseSegIdx + n) % game.segments.length;
        var seg = game.segments[idx];
        var loZ = (n === 0) ? (baseSegIdx * ROAD.SEG_LENGTH + basePercent * ROAD.SEG_LENGTH) : seg.p1.world.z;

        seg.p1.world.x = x;
        seg.p1.world.y = cumY;
        seg.p1.world.z = n * ROAD.SEG_LENGTH - basePercent * ROAD.SEG_LENGTH;

        cumY += seg.hill;

        seg.p2.world.x = x + dx;
        seg.p2.world.y = cumY;
        seg.p2.world.z = (n + 1) * ROAD.SEG_LENGTH - basePercent * ROAD.SEG_LENGTH;

        project(seg.p1, game.playerX * ROAD.ROAD_W, cameraHeight + cumY, 0, W, H);
        project(seg.p2, game.playerX * ROAD.ROAD_W, cameraHeight + cumY + seg.hill, 0, W, H);

        x += dx;
        dx += seg.curve;

        seg._drawN = n;
    }

    // Draw back to front
    for (var n2 = ROAD.DRAW_DIST - 1; n2 >= 0; n2--) {
        var idx2 = (baseSegIdx + n2) % game.segments.length;
        var seg2 = game.segments[idx2];
        var p1 = seg2.p1.screen;
        var p2 = seg2.p2.screen;

        if (p1.y >= maxY) continue;

        // Fog alpha
        var fogAlpha = Math.min(1, n2 / ROAD.FOG_DIST);
        fogAlpha = 1 - Math.pow(fogAlpha, 2); // quadratic fog

        // Grass
        c.fillStyle = seg2.color.grass;
        drawTrapezoid(c, 0, p1.y, W, 0, p2.y, W);

        // Rumble strips
        var rumbleW1 = p1.w * 1.15;
        var rumbleW2 = p2.w * 1.15;
        c.fillStyle = seg2.color.rumble;
        drawTrapezoid(c, p1.x - rumbleW1, p1.y, rumbleW1 * 2, p2.x - rumbleW2, p2.y, rumbleW2 * 2);

        // Road
        c.fillStyle = seg2.color.road;
        drawTrapezoid(c, p1.x - p1.w, p1.y, p1.w * 2, p2.x - p2.w, p2.y, p2.w * 2);

        // Lane markings
        if (seg2.color.lane) {
            var laneW1 = p1.w * 2 / ROAD.LANES;
            var laneW2 = p2.w * 2 / ROAD.LANES;
            c.fillStyle = 'rgba(255,255,255,0.5)';
            for (var li = 1; li < ROAD.LANES; li++) {
                var lx1 = p1.x - p1.w + laneW1 * li - 1;
                var lx2 = p2.x - p2.w + laneW2 * li - 1;
                drawTrapezoid(c, lx1, p1.y, 3, lx2, p2.y, 3);
            }
        }

        // Fog overlay
        if (fogAlpha < 1) {
            c.fillStyle = 'rgba(13,10,40,' + (1 - fogAlpha) * 0.8 + ')';
            drawTrapezoid(c, 0, p1.y, W, 0, p2.y, W);
        }

        if (p2.y < maxY) maxY = p2.y;
    }

    // Draw sprites (signs, trees, buildings) and cars - front to back for overlap
    for (var s = ROAD.DRAW_DIST - 1; s >= 1; s--) {
        var sIdx = (baseSegIdx + s) % game.segments.length;
        var sSeg = game.segments[sIdx];
        var sp1 = sSeg.p1.screen;

        // Sprites
        for (var spi = 0; spi < sSeg.sprites.length; spi++) {
            var sprite = sSeg.sprites[spi];
            var spriteScale = sp1.scale;
            var spriteX = sp1.x + spriteScale * sprite.x * ROAD.ROAD_W * W / 2;
            var spriteY = sp1.y;

            if (spriteScale <= 0 || spriteY > H || spriteY < 0) continue;

            if (sprite.type === 'tree') {
                drawTree(c, spriteX, spriteY, spriteScale * W * 0.4);
            } else if (sprite.type === 'building') {
                drawBuilding(c, spriteX, spriteY, spriteScale * W * 0.5);
            } else if (sprite.type === 'sign') {
                drawSign(c, spriteX, spriteY, spriteScale * W * 0.5, sprite.text, sprite.color);
            }
        }

        // Traffic cars on this segment
        for (var tci = 0; tci < game.cars.length; tci++) {
            var tc = game.cars[tci];
            var tcSeg = Math.floor(tc.z / ROAD.SEG_LENGTH) % game.segments.length;
            if (tcSeg === sIdx) {
                var tcScale = sp1.scale;
                var tcX = sp1.x + tcScale * tc.x * ROAD.ROAD_W * W / 2;
                var tcY = sp1.y;
                if (tcScale > 0 && tcY < H && tcY > 0) {
                    drawCar3D(c, tcX, tcY, tcScale * W * 0.15, tc.color);
                }
            }
        }
    }

    // Player car (always at bottom center)
    drawPlayerCar(c, W, H);

    // Speed display
    var speedKmh = Math.round(game.speed / game.maxSpeed * 200);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.beginPath();
    c.roundRect(W - 90, H - 45, 80, 35, 8);
    c.fill();
    c.fillStyle = '#00ff88';
    c.font = 'bold 16px Outfit, sans-serif';
    c.textAlign = 'center';
    c.fillText(speedKmh + ' km/h', W - 50, H - 22);

    // Checkpoint banner
    if (game.checkpointBanner) {
        var b = game.checkpointBanner;
        var bAlpha = Math.min(1, b.timer / 30);
        c.save();
        c.globalAlpha = bAlpha;
        c.font = 'bold ' + Math.min(28, W * 0.06) + 'px Outfit, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        var bText = b.emoji + ' ' + b.text;
        var bTw = c.measureText(bText).width + 50;
        var bY = H * 0.18;

        c.fillStyle = 'rgba(0,0,0,0.75)';
        c.beginPath();
        c.roundRect(W / 2 - bTw / 2, bY - 25, bTw, 50, 14);
        c.fill();

        c.strokeStyle = b.color;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(W / 2 - bTw / 2, bY - 25, bTw, 50, 14);
        c.stroke();

        c.fillStyle = '#fff';
        c.fillText(bText, W / 2, bY);
        c.restore();
    }
}

// -------- DRAW HELPERS --------
function drawTrapezoid(c, x1, y1, w1, x2, y2, w2) {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 + w1, y1);
    c.lineTo(x2 + w2, y2);
    c.lineTo(x2, y2);
    c.closePath();
    c.fill();
}

function drawTree(c, x, y, scale) {
    if (scale < 2) return;
    var h = scale * 1.2;
    var w = scale * 0.8;
    // Trunk
    c.fillStyle = '#5d4037';
    c.fillRect(x - w * 0.1, y - h * 0.5, w * 0.2, h * 0.5);
    // Foliage
    c.fillStyle = '#2e7d32';
    c.beginPath();
    c.arc(x, y - h * 0.6, w * 0.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#388e3c';
    c.beginPath();
    c.arc(x - w * 0.1, y - h * 0.75, w * 0.25, 0, Math.PI * 2);
    c.fill();
}

function drawBuilding(c, x, y, scale) {
    if (scale < 3) return;
    var h = scale * 2;
    var w = scale * 0.8;
    c.fillStyle = '#2a2a4a';
    c.fillRect(x - w / 2, y - h, w, h);
    // Windows
    c.fillStyle = '#ffd700';
    var winSize = Math.max(2, w * 0.15);
    for (var wy = y - h + winSize; wy < y - winSize; wy += winSize * 2.5) {
        for (var wx = x - w / 2 + winSize; wx < x + w / 2 - winSize; wx += winSize * 2) {
            if (Math.random() > 0.3) {
                c.fillRect(wx, wy, winSize, winSize);
            }
        }
    }
}

function drawSign(c, x, y, scale, text, color) {
    if (scale < 3) return;
    var w = scale * 2.5;
    var h = scale * 0.8;
    // Post
    c.fillStyle = '#888';
    c.fillRect(x - 2, y - h - scale * 0.3, 4, h + scale * 0.3);
    // Board
    c.fillStyle = color || '#333';
    c.fillRect(x - w / 2, y - h - scale * 0.3, w, h * 0.6);
    // Text
    if (w > 30) {
        c.fillStyle = '#fff';
        c.font = 'bold ' + Math.max(8, Math.min(14, w * 0.12)) + 'px Outfit, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(text, x, y - h);
    }
}

function drawCar3D(c, x, y, scale, color) {
    if (scale < 2) return;
    var w = scale * 1.5;
    var h = scale * 2.2;
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x - w / 2, y - h, w, h, 4);
    c.fill();
    // Windshield
    c.fillStyle = 'rgba(180,220,255,0.5)';
    c.fillRect(x - w * 0.3, y - h * 0.7, w * 0.6, h * 0.2);
    // Taillights
    c.fillStyle = '#ff3333';
    c.fillRect(x - w * 0.4, y - 3, w * 0.2, 3);
    c.fillRect(x + w * 0.2, y - 3, w * 0.2, 3);
}

function drawPlayerCar(c, W, H) {
    var carW = W * 0.12;
    var carH = carW * 1.8;
    var cx = W / 2;
    var cy = H - carH / 2 - 20;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(cx, cy + carH / 2 + 5, carW * 0.6, 8, 0, 0, Math.PI * 2);
    c.fill();

    // Body
    var grad = c.createLinearGradient(cx - carW / 2, 0, cx + carW / 2, 0);
    grad.addColorStop(0, '#cc2266');
    grad.addColorStop(0.5, '#ff4d88');
    grad.addColorStop(1, '#cc2266');
    c.fillStyle = grad;
    c.beginPath();
    c.roundRect(cx - carW / 2, cy - carH / 2, carW, carH, 10);
    c.fill();

    // Roof / windshield
    c.fillStyle = 'rgba(150,200,255,0.5)';
    c.beginPath();
    c.roundRect(cx - carW * 0.33, cy - carH * 0.28, carW * 0.66, carH * 0.25, 5);
    c.fill();

    // Headlights
    c.fillStyle = '#ffffcc';
    c.shadowColor = '#ffffcc';
    c.shadowBlur = 15;
    c.fillRect(cx - carW / 2 + 4, cy - carH / 2 + 3, carW * 0.18, 5);
    c.fillRect(cx + carW / 2 - 4 - carW * 0.18, cy - carH / 2 + 3, carW * 0.18, 5);
    c.shadowBlur = 0;

    // Taillights
    c.fillStyle = '#ff3333';
    c.shadowColor = '#ff0000';
    c.shadowBlur = 10;
    c.fillRect(cx - carW / 2 + 4, cy + carH / 2 - 8, carW * 0.18, 5);
    c.fillRect(cx + carW / 2 - 4 - carW * 0.18, cy + carH / 2 - 8, carW * 0.18, 5);
    c.shadowBlur = 0;

    // Side stripe
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.fillRect(cx - carW / 2 + 3, cy, carW - 6, 3);
}

// -------- SCREENS --------
function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    getEl(name + 'Screen').classList.add('active');
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

// -------- HEARTS --------
function initHearts() {
    var bg = getEl('heartsBg');
    var emojis = ['💖', '💕', '💗', '✨', '🌹'];
    setInterval(function () {
        var h = document.createElement('span');
        h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        h.style.cssText = 'position:fixed;left:' + (Math.random() * 100) + 'vw;bottom:-40px;font-size:' + (10 + Math.random() * 16) + 'px;opacity:' + (0.3 + Math.random() * 0.4) + ';transition:transform ' + (6 + Math.random() * 6) + 's linear,opacity 6s;pointer-events:none;z-index:0;';
        bg.appendChild(h);
        requestAnimationFrame(function () { h.style.transform = 'translateY(-110vh) rotate(' + (Math.random() * 360) + 'deg)'; h.style.opacity = '0'; });
        setTimeout(function () { h.remove(); }, 12000);
    }, 1200);
}

// -------- INIT --------
function initApp() {
    canvas = getEl('gameCanvas');
    C = canvas.getContext('2d');
    journeyFill = getEl('journeyFill');
    journeyLabel = getEl('journeyLabel');

    setupTouch();
    setupSwipe();

    getEl('soundToggle').addEventListener('click', function () {
        var m = SFX.toggle();
        getEl('soundToggle').textContent = m ? '🔇' : '🔊';
    });

    getEl('envelopeBtn').addEventListener('click', function () {
        SFX.tone(600, 'sine', 0.15, 0.05);
        getEl('envelope').classList.add('open');
        setTimeout(function () {
            switchScreen('game');
            setTimeout(startGame, 150);
        }, 1000);
    });

    getEl('replayBtn').addEventListener('click', function () {
        switchScreen('game');
        setTimeout(startGame, 150);
    });

    window.addEventListener('resize', function () {
        if (game.running) sizeCanvas();
    });

    initHearts();
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
