// ============================================================
// 🎁 Surprise Gift Day — Memory Game
// ============================================================

// -------- CUSTOMIZATION: EDIT THESE! --------

// Replace the emoji placeholders with your actual photo paths
// Example: 'photos/1.jpg'
// For now, we use fun couple emojis as placeholders
const CARD_DATA = [
    {
        id: 1,
        // image: 'photos/1.jpg',   // ← Uncomment & set your photo path
        emoji: '🥰',
        caption: 'The day we first met — my heart skipped a beat!'
    },
    {
        id: 2,
        // image: 'photos/2.jpg',
        emoji: '💑',
        caption: 'Our first date — I was so nervous but so happy!'
    },
    {
        id: 3,
        // image: 'photos/3.jpg',
        emoji: '🌅',
        caption: 'Watching sunsets together — pure magic!'
    },
    {
        id: 4,
        // image: 'photos/4.jpg',
        emoji: '🎉',
        caption: 'Celebrating together — you make everything fun!'
    },
    {
        id: 5,
        // image: 'photos/5.jpg',
        emoji: '🍕',
        caption: 'Our food adventures — we eat, we laugh, we love!'
    },
    {
        id: 6,
        // image: 'photos/6.jpg',
        emoji: '🎵',
        caption: 'Dancing to our song — you + me = perfect rhythm!'
    },
    {
        id: 7,
        // image: 'photos/7.jpg',
        emoji: '🌙',
        caption: 'Late night talks — my favorite kind of nights!'
    },
    {
        id: 8,
        // image: 'photos/8.jpg',
        emoji: '💋',
        caption: 'Every kiss feels like the first one 💕'
    }
];

// -------- STATE --------
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let isLocked = false;

// -------- DOM REFERENCES --------
const introScreen = document.getElementById('introScreen');
const gameScreen = document.getElementById('gameScreen');
const finaleScreen = document.getElementById('finaleScreen');
const envelopeBtn = document.getElementById('envelopeBtn');
const gameGrid = document.getElementById('gameGrid');
const matchCount = document.getElementById('matchCount');
const moveCount = document.getElementById('moveCount');
const matchPopup = document.getElementById('matchPopup');
const matchText = document.getElementById('matchText');
const replayBtn = document.getElementById('replayBtn');
const heartsBg = document.getElementById('heartsBg');

// ============================================================
// FLOATING HEARTS BACKGROUND
// ============================================================
function createFloatingHearts() {
    const hearts = ['💖', '💕', '💗', '💓', '❤️', '💜', '🩷', '🤍'];
    
    for (let i = 0; i < 20; i++) {
        const heart = document.createElement('span');
        heart.classList.add('floating-heart');
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = Math.random() * 100 + '%';
        heart.style.animationDuration = (8 + Math.random() * 12) + 's';
        heart.style.animationDelay = (Math.random() * 10) + 's';
        heart.style.fontSize = (0.8 + Math.random() * 1.2) + 'rem';
        heartsBg.appendChild(heart);
    }
}

// ============================================================
// SCREEN TRANSITIONS
// ============================================================
function switchScreen(from, to) {
    // Create transition overlay
    const overlay = document.createElement('div');
    overlay.classList.add('transition-overlay');
    document.body.appendChild(overlay);

    // Trigger overlay
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    setTimeout(() => {
        from.classList.remove('active');
        to.classList.add('active');

        setTimeout(() => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 600);
        }, 300);
    }, 600);
}

// ============================================================
// INTRO SCREEN
// ============================================================
envelopeBtn.addEventListener('click', () => {
    // Animate envelope opening
    const flap = envelopeBtn.querySelector('.envelope-flap');
    flap.style.animation = 'none';
    flap.style.transition = 'transform 0.5s ease';
    flap.style.transformOrigin = 'top center';
    flap.style.transform = 'rotateX(180deg)';

    const letter = envelopeBtn.querySelector('.envelope-letter');
    letter.style.animation = 'none';
    letter.style.transition = 'all 0.5s ease 0.3s';
    letter.style.top = '-30px';
    letter.style.transform = 'translateX(-50%) scale(1.5)';
    letter.style.opacity = '0';

    setTimeout(() => {
        initGame();
        switchScreen(introScreen, gameScreen);
    }, 800);
});

// ============================================================
// MEMORY GAME LOGIC
// ============================================================
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initGame() {
    // Reset state
    cards = [];
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    isLocked = false;
    matchCount.textContent = '0/8';
    moveCount.textContent = '0';
    gameGrid.innerHTML = '';

    // Create pairs and shuffle
    const pairs = [];
    CARD_DATA.forEach(data => {
        pairs.push({ ...data, pairId: data.id });
        pairs.push({ ...data, pairId: data.id });
    });
    cards = shuffleArray(pairs);

    // Create card elements
    cards.forEach((cardData, index) => {
        const card = document.createElement('div');
        card.classList.add('memory-card');
        card.dataset.pairId = cardData.pairId;
        card.dataset.index = index;

        const front = document.createElement('div');
        front.classList.add('card-face', 'card-front');

        if (cardData.image) {
            const img = document.createElement('img');
            img.src = cardData.image;
            img.alt = 'Our memory';
            img.loading = 'lazy';
            front.appendChild(img);
        } else {
            const emojiSpan = document.createElement('span');
            emojiSpan.classList.add('card-emoji');
            emojiSpan.textContent = cardData.emoji;
            front.appendChild(emojiSpan);
        }

        const back = document.createElement('div');
        back.classList.add('card-face', 'card-back');

        card.appendChild(front);
        card.appendChild(back);

        card.addEventListener('click', () => flipCard(card, cardData));
        gameGrid.appendChild(card);

        // Entrance animation
        card.style.opacity = '0';
        card.style.transform = 'scale(0.5) rotateY(0deg)';
        card.style.transition = 'none';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'scale(1) rotateY(0deg)';
        }, 100 + index * 60);
    });
}

function flipCard(cardEl, cardData) {
    // Guard clauses
    if (isLocked) return;
    if (cardEl.classList.contains('flipped')) return;
    if (cardEl.classList.contains('matched')) return;
    if (flippedCards.length >= 2) return;

    // Flip the card
    cardEl.classList.add('flipped');
    flippedCards.push({ element: cardEl, data: cardData });

    if (flippedCards.length === 2) {
        moves++;
        moveCount.textContent = moves;
        checkMatch();
    }
}

function checkMatch() {
    const [card1, card2] = flippedCards;
    const isMatch = card1.data.pairId === card2.data.pairId &&
                    card1.element !== card2.element;

    if (isMatch) {
        handleMatch(card1, card2);
    } else {
        handleMismatch(card1, card2);
    }
}

function handleMatch(card1, card2) {
    isLocked = true;

    setTimeout(() => {
        card1.element.classList.add('matched');
        card2.element.classList.add('matched');

        matchedPairs++;
        matchCount.textContent = matchedPairs + '/8';

        // Show caption popup
        showMatchPopup(card1.data.caption);

        flippedCards = [];

        setTimeout(() => {
            hideMatchPopup();
            
            if (matchedPairs === 8) {
                setTimeout(() => {
                    switchScreen(gameScreen, finaleScreen);
                    startFinale();
                }, 600);
            } else {
                isLocked = false;
            }
        }, 1800);
    }, 500);
}

function handleMismatch(card1, card2) {
    isLocked = true;

    setTimeout(() => {
        // Shake animation
        card1.element.style.animation = 'shake 0.4s ease';
        card2.element.style.animation = 'shake 0.4s ease';

        setTimeout(() => {
            card1.element.classList.remove('flipped');
            card2.element.classList.remove('flipped');
            card1.element.style.animation = '';
            card2.element.style.animation = '';
            flippedCards = [];
            isLocked = false;
        }, 400);
    }, 900);
}

// Add shake keyframes dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: rotateY(180deg) translateX(0); }
        25% { transform: rotateY(180deg) translateX(-8px); }
        75% { transform: rotateY(180deg) translateX(8px); }
    }
`;
document.head.appendChild(shakeStyle);

function showMatchPopup(text) {
    matchText.textContent = text;
    matchPopup.classList.add('show');
}

function hideMatchPopup() {
    matchPopup.classList.remove('show');
}

// ============================================================
// FINALE — CONFETTI & HEARTS
// ============================================================
function startFinale() {
    launchConfetti();
    launchHeartBurst();
}

function launchConfetti() {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';
    const colors = ['#ff6b9d', '#a855f7', '#fbbf24', '#ec4899', '#8b5cf6', '#f472b6', '#c084fc', '#fb923c'];

    for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.classList.add('confetti-piece');
        piece.style.left = Math.random() * 100 + '%';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (6 + Math.random() * 8) + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.animationDuration = (2 + Math.random() * 3) + 's';
        piece.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(piece);
    }

    // Second wave
    setTimeout(() => {
        for (let i = 0; i < 40; i++) {
            const piece = document.createElement('div');
            piece.classList.add('confetti-piece');
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.animationDelay = (Math.random() * 1.5) + 's';
            container.appendChild(piece);
        }
    }, 2000);
}

function launchHeartBurst() {
    const burst = document.getElementById('heartBurst');
    burst.innerHTML = '';
    const emojis = ['💖', '💕', '💗', '💓', '❤️', '🩷', '✨', '💫'];

    for (let i = 0; i < 16; i++) {
        const heart = document.createElement('span');
        heart.classList.add('burst-heart');
        heart.textContent = emojis[i % emojis.length];

        const angle = (i / 16) * 360;
        const distance = 100 + Math.random() * 150;
        const x = Math.cos(angle * Math.PI / 180) * distance;
        const y = Math.sin(angle * Math.PI / 180) * distance;

        heart.style.setProperty('--x', x + 'px');
        heart.style.setProperty('--y', y + 'px');
        heart.style.animation = `burstOut 1.5s ease-out ${i * 0.08}s forwards`;
        heart.style.fontSize = (1.2 + Math.random() * 1) + 'rem';

        // Override the animation to use custom positions
        heart.animate([
            { transform: 'translate(0, 0) scale(0)', opacity: 1 },
            { transform: `translate(${x}px, ${y}px) scale(1.5)`, opacity: 0 }
        ], {
            duration: 1200,
            delay: i * 80,
            easing: 'ease-out',
            fill: 'forwards'
        });

        burst.appendChild(heart);
    }
}

// ============================================================
// REPLAY
// ============================================================
replayBtn.addEventListener('click', () => {
    matchedPairs = 0;
    moves = 0;
    switchScreen(finaleScreen, gameScreen);
    setTimeout(() => initGame(), 800);
});

// ============================================================
// INIT
// ============================================================
createFloatingHearts();
