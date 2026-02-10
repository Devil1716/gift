// ============================================================
//  Surprise Gift - Pseudo-3D Bangalore Car Race (Ultimate)
// ============================================================

// -------- CUSTOMIZATION --------
const CONFIG = {
    heroName: 'You',
    partnerName: 'My Love',
    billboardPhotos: [
        'photos/photo1.jpg', 'photos/photo2.jpg', 'photos/photo3.jpg',
        'photos/photo4.jpg', 'photos/photo5.jpg', 'photos/photo6.jpg'
    ]
};

// -------- POLYFILL --------
(function () {
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (typeof r === 'undefined') r = 0; if (typeof r === 'number') r = [r, r, r, r];
            this.moveTo(x + r[0], y);
            this.lineTo(x + w - r[1], y); this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
            this.lineTo(x + w, y + h - r[2]); this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
            this.lineTo(x + r[3], y + h); this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
            this.lineTo(x, y + r[0]); this.quadraticCurveTo(x, y, x + r[0], y);
            this.closePath(); return this;
        };
    }
})();

// -------- ASSETS --------
const IMAGES = {};
function loadImages() {
    CONFIG.billboardPhotos.forEach((src, i) => {
        const img = new Image();
        img.src = src;
        IMAGES[src] = img;
    });
}

// -------- CHECKPOINTS --------
var CHECKPOINTS = [
    { name: 'MG Road', dist: 0, color: '#ff6b6b', emoji: '🏙️' },
    { name: 'Brigade Road', dist: 0.12, color: '#f39c12', emoji: '🛍️' },
    { name: 'Cubbon Park', dist: 0.25, color: '#26de81', emoji: '🌳' },
    { name: 'Vidhana Soudha', dist: 0.37, color: '#f1c40f', emoji: '🏛️' },
    { name: 'Lalbagh', dist: 0.50, color: '#e74c3c', emoji: '🌺' },
    { name: 'Koramangala', dist: 0.62, color: '#9b59b6', emoji: '☕' },
    { name: 'Indiranagar', dist: 0.75, color: '#e67e22', emoji: '🎶' },
    { name: 'JP Nagar', dist: 0.87, color: '#3498db', emoji: '🌆' },
    { name: 'Home', dist: 1.0, color: '#ff4d88', emoji: '🏠' }
];

// -------- AUDIO --------
var SFX = {
    ctx: null, muted: true,
    init: function () { if (!this.ctx) try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } },
    toggle: function () { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); this.muted = !this.muted; return this.muted; },
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
    crash: function () { this.tone(100, 'sawtooth', 0.3, 0.15); },
    collect: function () { this.tone(880, 'sine', 0.1, 0.1); setTimeout(() => this.tone(1174, 'sine', 0.2, 0.1), 100); },
    engine: function (speedPct) { if (Math.random() < 0.1) this.tone(70 + speedPct * 40, 'triangle', 0.1, 0.01 + speedPct * 0.01); },
    win: function () { var s = this;[523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { s.tone(f, 'sine', 0.8, 0.1); }, i * 150); }); }
};

// -------- DOM --------
function getEl(id) { return document.getElementById(id); }
var canvas, C, journeyFill, journeyLabel, scoreDisplay;

// -------- GAME CONSTANTS --------
var ROAD = {
    LENGTH: 6000, SEG_LENGTH: 200, LANES: 3, ROAD_W: 2200, DRAW_DIST: 220, FOG_DIST: 160
};

// -------- GAME STATE --------
var game = {
    running: false, W: 0, H: 0,
    segments: [],
    playerX: 0, playerSpeedX: 0,
    position: 0, speed: 0, maxSpeed: ROAD.SEG_LENGTH * 60,
    accel: 0.005, decel: 0.06, offRoadDecel: 0.08, centrifugal: 0.18,
    cars: [],
    score: 0,
    checkpointIndex: 0, checkpointBanner: null,
    rain: [], thunderTimer: 0, thunderOpacity: 0,
    animFrame: null, totalLength: 0
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
            curve: 0, hill: 0,
            color: {
                road: (Math.floor(i / 4) % 2 === 0) ? '#333' : '#363636',
                grass: (Math.floor(i / 4) % 2 === 0) ? '#113311' : '#164416',
                rumble: (Math.floor(i / 4) % 2 === 0) ? '#cc0000' : '#eeeeee'
            },
            sprites: []
        };

        // Curves & Hills
        if (i > 100 && i < 300) seg.curve = 1.5;
        if (i > 400 && i < 600) seg.curve = -2.0;
        if (i > 700 && i < 900) seg.curve = 2.0; seg.hill = i > 700 && i < 900 ? 40 : 0;
        if (i > 1100 && i < 1300) seg.curve = -1.5;
        if (i > 1500 && i < 1800) seg.curve = 2.5; seg.hill = i > 1500 && i < 1800 ? -40 : 0;
        if (i > 2000 && i < 2300) seg.curve = -3.0;
        if (i > 2500 && i < 2800) seg.curve = 1.5;
        if (i > 3200 && i < 3500) seg.curve = -1.0;
        if (i > 3800 && i < 4100) seg.curve = 3.0;
        if (i > 4500 && i < 4700) seg.curve = -2.5;

        // Sprites: Trees/Buildings
        if (i % 10 === 0) {
            seg.sprites.push({ x: -1.3 - Math.random() * 0.8, type: 'tree' });
            seg.sprites.push({ x: 1.3 + Math.random() * 0.8, type: 'tree' });
        }

        // Billboards (every 100 segments)
        if (i % 150 === 0 && i > 50) {
            var photoIdx = Math.floor(i / 150) % CONFIG.billboardPhotos.length;
            var photoSrc = CONFIG.billboardPhotos[photoIdx];
            seg.sprites.push({ x: (i % 300 === 0 ? -1.8 : 1.8), type: 'billboard', img: photoSrc });
        }

        // Powerups (Hearts)
        if (i % 60 === 0 && i > 100) {
            seg.sprites.push({ x: Math.random() * 2 - 1, type: 'heart', collected: false });
        }

        // Checkpoints
        for (var ci = 0; ci < CHECKPOINTS.length; ci++) {
            if (i === Math.floor(CHECKPOINTS[ci].dist * (n - 1))) {
                seg.sprites.push({ x: -1.6, type: 'sign', text: CHECKPOINTS[ci].name, color: CHECKPOINTS[ci].color, emoji: CHECKPOINTS[ci].emoji });
                seg.sprites.push({ x: 1.6, type: 'sign', text: CHECKPOINTS[ci].name, color: CHECKPOINTS[ci].color, emoji: CHECKPOINTS[ci].emoji });
            }
        }
        game.segments.push(seg);
    }
    game.totalLength = n * ROAD.SEG_LENGTH;

    // Traffic (Types: car, auto, bus)
    game.cars = [];
    for (var j = 0; j < 500; j++) {
        var z = 2000 + Math.random() * (game.totalLength - 4000);
        var lane = Math.floor(Math.random() * 3); // 0, 1, 2
        var laneX = (lane === 0) ? -0.6 : (lane === 1) ? 0 : 0.6;
        var type = Math.random();
        var carType = 'car';
        if (type > 0.7) carType = 'auto'; // 30% autos
        else if (type > 0.9) carType = 'bus'; // 10% buses

        game.cars.push({
            z: z,
            x: laneX + (Math.random() * 0.1 - 0.05), // slight jitter
            speed: game.maxSpeed * (0.2 + Math.random() * 0.3),
            type: carType,
            color: j % 4 === 0 ? '#e74c3c' : j % 4 === 1 ? '#3498db' : j % 4 === 2 ? '#f1c40f' : '#fff'
        });
    }
}

function findSegment(z) { return game.segments[Math.floor(z / ROAD.SEG_LENGTH) % game.segments.length]; }

// -------- PROJECTION --------
var cameraHeight = 1100;
var cameraDepth = 0;

function project(p, cx, cy, cz, W, H) {
    p.camera.x = (p.world.x || 0) - cx;
    p.camera.y = (p.world.y || 0) - cy;
    p.camera.z = (p.world.z || 0) - cz;
    if (p.camera.z <= 0) p.camera.z = 0.1;
    p.screen.scale = cameraDepth / p.camera.z;
    p.screen.x = Math.round(W / 2 + p.screen.scale * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - p.screen.scale * p.camera.y * H / 2);
    p.screen.w = Math.round(p.screen.scale * ROAD.ROAD_W * W / 2);
}

// -------- SIZING --------
function sizeCanvas() {
    game.W = window.innerWidth; game.H = window.innerHeight;
    canvas.width = game.W; canvas.height = game.H;
    var ratio = game.W / game.H;
    var fov = ratio > 1 ? 80 : 90;
    cameraDepth = 1 / Math.tan(fov * Math.PI / 360);
    // Init rain
    game.rain = [];
    for (var i = 0; i < 100; i++) game.rain.push({ x: Math.random() * game.W, y: Math.random() * game.H, l: Math.random() * 20 + 10, v: Math.random() * 10 + 15 });
}

// -------- INPUT --------
var keys = { left: false, right: false };
var touch = { left: false, right: false };

document.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') keys.left = true; if (e.key === 'ArrowRight') keys.right = true; });
document.addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft') keys.left = false; if (e.key === 'ArrowRight') keys.right = false; });

var tl = getEl('touchLeft'), tr = getEl('touchRight');
function setTouch(dir, state) { return function (e) { e.preventDefault(); touch[dir] = state; }; }
if (tl && tr) {
    tl.addEventListener('touchstart', setTouch('left', true), { passive: false }); tl.addEventListener('touchend', setTouch('left', false));
    tr.addEventListener('touchstart', setTouch('right', true), { passive: false }); tr.addEventListener('touchend', setTouch('right', false));
    tl.addEventListener('mousedown', setTouch('left', true)); tl.addEventListener('mouseup', setTouch('left', false));
    tr.addEventListener('mousedown', setTouch('right', true)); tr.addEventListener('mouseup', setTouch('right', false));
}

// -------- START --------
function startGame() {
    sizeCanvas(); loadImages(); buildRoad();
    game.playerX = 0; game.playerSpeedX = 0;
    game.position = 0; game.speed = 0; game.score = 0;
    game.checkpointIndex = 0;
    game.checkpointBanner = { text: 'GO!', emoji: '🚗', color: '#fff', timer: 100 };
    updateScore();
    game.running = true;
    if (game.animFrame) cancelAnimationFrame(game.animFrame);
    loop();
}

function updateScore() {
    if (!scoreDisplay) scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'game-score';
    scoreDisplay.innerHTML = '💖 ' + game.score;
    if (!scoreDisplay.parentNode) getEl('game-ui').appendChild(scoreDisplay);
}

// -------- LOOP --------
function loop() {
    if (!game.running) return;
    update(); render();
    game.animFrame = requestAnimationFrame(loop);
}

function update() {
    var dt = 1 / 60;
    var speedPct = game.speed / game.maxSpeed;

    // Steering
    var steer = 0;
    if (keys.left || touch.left) steer = -1;
    if (keys.right || touch.right) steer = 1;
    game.playerSpeedX += steer * 0.1;
    game.playerSpeedX *= 0.92;
    game.playerX += game.playerSpeedX * speedPct * 0.08;

    // Auto accelerate + Physics
    game.speed += game.maxSpeed * game.accel;
    var seg = findSegment(game.position);
    if ((game.playerX < -1 || game.playerX > 1) && speedPct > 0.3) {
        game.speed -= game.speed * game.offRoadDecel;
        if (game.playerX < -1) game.playerX = -1.05;
        if (game.playerX > 1) game.playerX = 1.05;
    }
    game.playerX -= seg.curve * game.centrifugal * speedPct * speedPct * dt * 4;
    game.speed = Math.max(0, Math.min(game.speed, game.maxSpeed));
    game.position += game.speed * dt;

    // Collisions
    var playerZ = cameraHeight * cameraDepth;
    var playerSeg = findSegment(game.position + playerZ);

    // Heart Collection
    for (var k = 0; k < playerSeg.sprites.length; k++) {
        var s = playerSeg.sprites[k];
        if (s.type === 'heart' && !s.collected) {
            if (Math.abs(game.playerX - s.x) < 0.3) {
                s.collected = true;
                game.score += 10;
                updateScore();
                SFX.collect();
            }
        }
    }

    // Traffic Collision
    for (var i = 0; i < game.cars.length; i++) {
        var c = game.cars[i];
        if (c.z < game.position - ROAD.SEG_LENGTH * 10) c.z += game.totalLength;
        c.z += c.speed * dt;
        var carSeg = findSegment(c.z);
        if (carSeg.index === playerSeg.index) {
            if (Math.abs(game.playerX - c.x) < 0.6) {
                game.speed *= 0.6;
                SFX.crash();
                c.x += (game.playerX > c.x ? -0.5 : 0.5);
            }
        }
    }

    // Checkpoints
    var progress = game.position / game.totalLength;
    if (progress > 1) progress = 1;
    getEl('journeyFill').style.width = (progress * 100) + '%';

    for (var cpi = game.checkpointIndex; cpi < CHECKPOINTS.length; cpi++) {
        if (progress >= CHECKPOINTS[cpi].dist && cpi > game.checkpointIndex) {
            game.checkpointIndex = cpi;
            var cp = CHECKPOINTS[cpi];
            getEl('journeyLabel').innerHTML = cp.emoji + ' ' + cp.name;
            game.checkpointBanner = { text: cp.name, emoji: cp.emoji, color: cp.color, timer: 120 };
            SFX.checkpoint();
        }
    }
    if (game.checkpointBanner) {
        game.checkpointBanner.timer--;
        if (game.checkpointBanner.timer <= 0) game.checkpointBanner = null;
    }

    // Engine / Win
    SFX.engine(speedPct);
    if (progress >= 1) {
        game.running = false;
        getEl('journeyLabel').textContent = '🏠 Home Sweet Home!';
        setTimeout(function () { switchScreen('finale'); SFX.win(); launchConfetti(); }, 800);
    }

    // Thunder
    if (game.thunderOpacity > 0) game.thunderOpacity -= 0.05;
    if (Math.random() < 0.003) { game.thunderOpacity = 0.8; game.thunderTimer = 10; SFX.crash(); } // thunder sound reuse
}

// -------- RENDER --------
function render() {
    var c = C, W = game.W, H = game.H;

    // Sky with Thunder
    c.fillStyle = '#0f0c29'; c.fillRect(0, 0, W, H);
    var grad = c.createLinearGradient(0, 0, 0, H * 0.6);
    grad.addColorStop(0, '#0a0a25'); grad.addColorStop(1, '#251b4d');
    c.fillStyle = grad; c.fillRect(0, 0, W, H * 0.6);

    if (game.thunderOpacity > 0) {
        c.fillStyle = 'rgba(255,255,255,' + game.thunderOpacity + ')';
        c.fillRect(0, 0, W, H);
    }

    // 3D View
    var baseSeg = findSegment(game.position);
    var basePct = (game.position % ROAD.SEG_LENGTH) / ROAD.SEG_LENGTH;
    var playerZ = cameraHeight * cameraDepth;
    var maxY = H;
    var x = 0, dx = -baseSeg.curve * basePct;

    for (var n = 0; n < ROAD.DRAW_DIST; n++) {
        var seg = game.segments[(baseSeg.index + n) % game.segments.length];

        seg.p1.camera.z = (n - basePct) * ROAD.SEG_LENGTH;
        seg.p2.camera.z = (n + 1 - basePct) * ROAD.SEG_LENGTH;

        var scale1 = cameraDepth / Math.max(0.1, seg.p1.camera.z);
        var scale2 = cameraDepth / Math.max(0.1, seg.p2.camera.z);

        var xs1 = W / 2 + (x - game.playerX * ROAD.ROAD_W) * scale1 * W / 2;
        var xs2 = W / 2 + (x + dx - game.playerX * ROAD.ROAD_W) * scale2 * W / 2;
        var ys1 = H / 2 + (-cameraHeight - (seg.hill - baseSeg.hill * (1 - basePct))) * scale1 * H / 2;
        var ys2 = H / 2 + (-cameraHeight - seg.hill) * scale2 * H / 2; // Simplified hill calc

        seg.p1.screen = { x: xs1, y: ys1, w: ROAD.ROAD_W * scale1 * W / 2, scale: scale1 };

        x += dx; dx += seg.curve;
        if (ys1 >= maxY) continue; maxY = ys1;

        // Draw Road
        drawQuad(c, seg.color.grass, 0, ys2, W, ys2, W, ys1, 0, ys1);
        var w1 = seg.p1.screen.w, w2 = ROAD.ROAD_W * scale2 * W / 2;
        drawQuad(c, seg.color.rumble, xs1 - w1 * 1.2, ys1, xs1 + w1 * 1.2, ys1, xs2 + w2 * 1.2, ys2, xs2 - w2 * 1.2, ys2);
        drawQuad(c, seg.color.road, xs1 - w1, ys1, xs1 + w1, ys1, xs2 + w2, ys2, xs2 - w2, ys2);

        if (seg.color.rumble === '#eeeeee') { // Lane markers
            var l1 = w1 / 4, l2 = w2 / 4;
            drawQuad(c, '#fff', xs1 - l1, ys1, xs1 - l1 + w1 * 0.05, ys1, xs2 - l2 + w2 * 0.05, ys2, xs2 - l2, ys2);
            drawQuad(c, '#fff', xs1 + l1, ys1, xs1 + l1 + w1 * 0.05, ys1, xs2 + l2 + w2 * 0.05, ys2, xs2 + l2, ys2);
        }

        // Fog
        if (n > ROAD.FOG_DIST) {
            c.globalAlpha = (n - ROAD.FOG_DIST) / (ROAD.DRAW_DIST - ROAD.FOG_DIST);
            c.fillStyle = '#0f0c29'; c.fillRect(0, ys2, W, ys1 - ys2); c.globalAlpha = 1;
        }
    }

    // Objects
    for (var n = ROAD.DRAW_DIST - 1; n > 0; n--) {
        var seg = game.segments[(baseSeg.index + n) % game.segments.length];
        var sInfo = seg.p1.screen;
        if (!sInfo) continue;

        // Sprites
        for (var i = 0; i < seg.sprites.length; i++) {
            var s = seg.sprites[i];
            if (s.collected) continue; // Skip collected hearts
            var sx = sInfo.x + s.x * sInfo.w;
            var sScale = sInfo.w;
            if (s.type === 'tree') drawTree(c, sx, sInfo.y, sScale);
            else if (s.type === 'billboard') drawBillboard(c, sx, sInfo.y, sScale, s.img);
            else if (s.type === 'heart') drawHeart(c, sx, sInfo.y, sScale);
            else if (s.type === 'sign') drawSign(c, sx, sInfo.y, sScale, s.text, s.color, s.emoji);
        }

        // Cars
        for (var i = 0; i < game.cars.length; i++) {
            var car = game.cars[i];
            var carSeg = findSegment(car.z);
            if (carSeg.index === seg.index) {
                var cx = sInfo.x + car.x * sInfo.w;
                var carScale = sInfo.w;
                if (car.type === 'auto') drawAuto(c, cx, sInfo.y, carScale);
                else if (car.type === 'bus') drawBus(c, cx, sInfo.y, carScale);
                else drawCar(c, cx, sInfo.y, carScale, car.color);
            }
        }
    }

    drawPlayer(c, W, H);

    // Rain
    c.strokeStyle = 'rgba(200,200,255,0.4)';
    c.lineWidth = 1; c.beginPath();
    for (var i = 0; i < game.rain.length; i++) {
        var r = game.rain[i];
        c.moveTo(r.x, r.y); c.lineTo(r.x - r.l * 0.5, r.y + r.l);
        r.x -= 2; r.y += r.v;
        if (r.y > H) { r.y = -20; r.x = Math.random() * W; }
        if (r.x < 0) r.x = W;
    }
    c.stroke();

    if (game.checkpointBanner) drawBanner(c, W, H, game.checkpointBanner);
}

// -------- DRAW HELPERS --------
function drawQuad(c, col, x1, y1, x2, y2, x3, y3, x4, y4) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4); c.fill();
}
function drawTree(c, x, y, s) {
    c.fillStyle = '#0d2b0d'; c.fillRect(x - s * 0.1, y - s, s * 0.2, s);
    c.fillStyle = '#1e591e'; c.beginPath(); c.arc(x, y - s * 0.9, s * 0.4, 0, Math.PI * 2); c.fill();
}
function drawBillboard(c, x, y, s, src) {
    var w = s * 1.0, h = s * 0.7;
    // Pole
    c.fillStyle = '#777'; c.fillRect(x - s * 0.05, y - h * 1.5, s * 0.1, h * 1.5);
    // Frame
    c.fillStyle = '#eee'; c.fillRect(x - w / 2, y - h * 2, w, h);
    // Image (or placeholder)
    var img = IMAGES[src];
    if (img && img.complete) {
        try { c.drawImage(img, x - w / 2 + 2, y - h * 2 + 2, w - 4, h - 4); } catch (e) { }
    } else {
        c.fillStyle = '#ff4d88'; c.fillRect(x - w / 2 + 2, y - h * 2 + 2, w - 4, h - 4);
        c.fillStyle = '#fff'; c.font = 'bold ' + Math.floor(h / 3) + 'px Arial'; c.textAlign = 'center'; c.fillText('PHOTO', x, y - h * 1.5);
    }
}
function drawHeart(c, x, y, s) {
    var dy = Math.sin(Date.now() / 200) * s * 0.2; // Float
    var h = s * 0.5;
    c.fillStyle = '#ff0044'; c.textAlign = 'center'; c.font = Math.floor(s * 0.5) + 'px Arial';
    c.fillText('💖', x, y - h - dy);
}
function drawAuto(c, x, y, s) { // Rickshaw
    var w = s * 0.25, h = s * 0.20;
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x - w * 0.4, y - h * 0.05, w * 0.8, h * 0.10); // shadow
    c.fillStyle = '#f1c40f'; // yellow body
    c.beginPath(); c.roundRect(x - w / 2, y - h, w, h * 0.85, 4); c.fill();
    c.fillStyle = '#2ecc71'; // green top
    c.fillRect(x - w / 2, y - h, w, h * 0.4);
    c.fillStyle = '#000'; // wheels
    c.fillRect(x - w * 0.5, y - h * 0.3, w * 0.1, h * 0.3); c.fillRect(x + w * 0.4, y - h * 0.3, w * 0.1, h * 0.3);
}
function drawBus(c, x, y, s) { // BMTC
    var w = s * 0.45, h = s * 0.35;
    c.fillStyle = '#3498db'; // blue
    c.beginPath(); c.roundRect(x - w / 2, y - h, w, h * 0.9, 2); c.fill();
    c.fillStyle = '#fff'; // stripes/windows
    c.fillRect(x - w * 0.4, y - h * 0.8, w * 0.8, h * 0.3);
    c.fillStyle = '#f00'; c.fillRect(x - w * 0.4, y - h * 0.3, w * 0.1, h * 0.05); // taillights
    c.fillRect(x + w * 0.3, y - h * 0.3, w * 0.1, h * 0.05);
}
function drawCar(c, x, y, s, col) {
    var w = s * 0.28, h = s * 0.22;
    c.fillStyle = col; c.fillRect(x - w / 2, y - h, w, h * 0.8);
    c.fillStyle = '#333'; c.fillRect(x - w * 0.4, y - h * 0.9, w * 0.8, h * 0.3); // roof
    c.fillStyle = '#f00'; c.fillRect(x - w * 0.35, y - h * 0.3, w * 0.15, h * 0.1); c.fillRect(x + w * 0.2, y - h * 0.3, w * 0.15, h * 0.1); // lights
}
function drawSign(c, x, y, s, txt, col, emo) {
    var sw = s * 1.0, sh = s * 0.35;
    c.fillStyle = '#888'; c.fillRect(x - s * 0.05, y - sh * 2, s * 0.1, sh * 2);
    c.fillStyle = col; c.fillRect(x - sw / 2, y - sh * 2.5, sw, sh);
    c.fillStyle = '#fff'; c.font = 'bold ' + Math.floor(s * 0.15) + 'px Arial'; c.textAlign = 'center'; c.fillText(emo + ' ' + txt, x, y - sh * 2.0);
}
function drawPlayer(c, W, H) {
    var w = W * 0.22, h = W * 0.12; if (game.H > game.W) { w = game.W * 0.35; h = w * 0.5; }
    var x = W / 2, y = H - h / 2 - 20;
    c.shadowColor = '#ff4d88'; c.shadowBlur = 20;
    c.fillStyle = '#d63066'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h * 0.8, 10); c.fill(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(x - w / 2, y - h * 0.1, w, h * 0.1);
    c.fillStyle = '#333'; c.beginPath(); c.moveTo(x - w * 0.4, y - h * 0.4); c.lineTo(x + w * 0.4, y - h * 0.4); c.lineTo(x + w * 0.35, y - h * 0.6); c.lineTo(x - w * 0.35, y - h * 0.6); c.fill();
    c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 10;
    c.fillRect(x - w * 0.4, y - h * 0.3, w * 0.15, h * 0.15); c.fillRect(x + w * 0.25, y - h * 0.3, w * 0.15, h * 0.15); c.shadowBlur = 0;
}
function drawBanner(c, W, H, b) {
    var d = b.emoji + ' ' + b.text;
    c.font = (W < H ? 'bold 8vw' : 'bold 4vw') + ' Outfit';
    var tw = c.measureText(d).width + 60, th = 80, bx = W / 2 - tw / 2, by = H * 0.3;
    c.fillStyle = 'rgba(0,0,0,0.8)'; c.beginPath(); c.roundRect(bx, by, tw, th, 20); c.fill();
    c.strokeStyle = b.color; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d, W / 2, by + th / 2);
}

// -------- HANDLERS --------
function switchScreen(n) { document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active') }); getEl(n + 'Screen').classList.add('active'); }
function launchConfetti() {
    var c = getEl('confettiContainer'); c.innerHTML = '';
    for (var i = 0; i < 80; i++) { var d = document.createElement('div'); d.className = 'confetti-piece'; d.style.left = Math.random() * 100 + '%'; d.style.backgroundColor = ['#f0f', '#0ff', '#ff0'][Math.floor(Math.random() * 3)]; d.style.animationDuration = (1 + Math.random() * 2) + 's'; c.appendChild(d); }
}
function init() {
    canvas = getEl('gameCanvas'); C = canvas.getContext('2d');
    journeyFill = getEl('journeyFill'); journeyLabel = getEl('journeyLabel');
    window.addEventListener('resize', function () { if (game.running) sizeCanvas(); });
    getEl('soundToggle').onclick = function () { var m = SFX.toggle(); this.innerHTML = m ? '🔇' : '🔊'; };
    getEl('envelopeBtn').onclick = function () { this.classList.add('open'); SFX.tone(400, 'sine', 0.3, 0.1); setTimeout(function () { switchScreen('game'); setTimeout(startGame, 500); }, 1200); };
    getEl('replayBtn').onclick = function () { switchScreen('game'); setTimeout(startGame, 500); };
}
init();
