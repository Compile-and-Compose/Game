const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// =============================
// RNG with Seeds
// =============================
let rngSeed = Date.now();
let rng = mulberry32(rngSeed);

function mulberry32(a) {
  return function () {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function reseed(newSeed = Date.now()) {
  rngSeed = newSeed;
  rng = mulberry32(rngSeed);
  console.log("New Seed:", rngSeed);
}

// =============================
// Game State
// =============================
let player, platforms, enemies, keys = {};
let gameRunning = false;
let wave = 1;

// =============================
// Entities
// =============================
function makePlayer() {
  return {
    x: 100, y: 100,
    w: 32, h: 32,
    vx: 0, vy: 0,
    speed: 3,
    jumping: false,
    dashTime: 0,
    canDash: true,
    facing: 1, // 1 = right, -1 = left
    attacking: false,
    attackTime: 0
  };
}

function generatePlatforms() {
  platforms = [];
  let numPlatforms = 6 + Math.floor(rng() * 5); // 6–10
  let numBouncy = 2 + Math.floor(rng() * 2);   // 2–3

  for (let i = 0; i < numPlatforms; i++) {
    let x = rng() * (canvas.width - 100);
    let y = rng() * (canvas.height - 60);
    platforms.push({ x, y, w: 120, h: 20, type: "normal" });
  }

  for (let i = 0; i < numBouncy; i++) {
    let x = rng() * (canvas.width - 100);
    let y = rng() * (canvas.height - 60);
    platforms.push({ x, y, w: 100, h: 20, type: "bouncy" });
  }
}

function generateEnemies(numEnemies) {
  enemies = [];
  for (let i = 0; i < numEnemies; i++) {
    let platform = platforms[Math.floor(rng() * platforms.length)];
    let x = platform.x + rng() * (platform.w - 30);
    let y = platform.y - 28;
    let type = rng() < 0.5 ? "patrol" : "stationary";

    enemies.push({
      x, y, w: 28, h: 28,
      vx: type === "patrol" ? (rng() < 0.5 ? -1 : 1) * 1.5 : 0,
      type,
      alive: true
    });
  }
}

// =============================
// Controls
// =============================
document.addEventListener("keydown", e => {
  keys[e.code] = true;
});
document.addEventListener("keyup", e => {
  keys[e.code] = false;
});

// =============================
// Game Loop
// =============================
function update() {
  if (!gameRunning) return;

  // Gravity
  player.vy += 0.5;
  if (player.vy > 8) player.vy = 8;

  // Movement
  if (keys["ArrowLeft"] || keys["KeyA"]) {
    player.vx = -player.speed;
    player.facing = -1;
  } else if (keys["ArrowRight"] || keys["KeyD"]) {
    player.vx = player.speed;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  // Jump
  if ((keys["ArrowUp"] || keys["KeyW"]) && !player.jumping) {
    player.vy = -10;
    player.jumping = true;
  }

  // Dash
  if (keys["ShiftLeft"] && player.canDash) {
    player.dashTime = 10;
    player.canDash = false;
  }
  if (player.dashTime > 0) {
    player.vx = player.facing * 12;
    player.vy = 0;
    player.dashTime--;
  }

  // Attack
  if (keys["Space"] && !player.attacking) {
    player.attacking = true;
    player.attackTime = 10;
  }
  if (player.attacking) {
    player.attackTime--;
    if (player.attackTime <= 0) {
      player.attacking = false;
    }
  }

  // Apply velocity
  player.x += player.vx;
  player.y += player.vy;

  // Floor
  if (player.y + player.h > canvas.height) {
    player.y = canvas.height - player.h;
    player.vy = 0;
    player.jumping = false;
    player.canDash = true;
  }

  // Platforms
  for (let p of platforms) {
    if (player.x < p.x + p.w &&
        player.x + player.w > p.x &&
        player.y + player.h > p.y &&
        player.y + player.h < p.y + 20 &&
        player.vy >= 0) {
      player.y = p.y - player.h;
      player.vy = p.type === "bouncy" ? -15 : 0;
      player.jumping = false;
      player.canDash = true;
    }
  }

  // Enemies
  let allDead = true;
  for (let e of enemies) {
    if (!e.alive) continue;
    allDead = false;

    if (e.type === "patrol") {
      e.x += e.vx;
      if (e.x < 0 || e.x + e.w > canvas.width) e.vx *= -1;
    }

    // Attack collision
    if (player.attacking) {
      let rangeX = player.x + (player.facing === 1 ? player.w : -20);
      let swordBox = { x: rangeX, y: player.y, w: 20, h: player.h };
      if (swordBox.x < e.x + e.w &&
          swordBox.x + swordBox.w > e.x &&
          swordBox.y < e.y + e.h &&
          swordBox.y + swordBox.h > e.y) {
        e.alive = false;
      }
    }
  }

  // Next wave if cleared
  if (allDead) {
    wave++;
    reseed(rngSeed + 1);
    generatePlatforms();
    generateEnemies(3 + Math.floor(rng() * 4) + wave); // scale difficulty
  }
}

// =============================
// Draw
// =============================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(player.x, player.y, player.w, player.h);

  // Sword swing
  if (player.attacking) {
    ctx.fillStyle = "#ff6b6b";
    let swordX = player.x + (player.facing === 1 ? player.w : -20);
    ctx.fillRect(swordX, player.y, 20, player.h);
  }

  // Platforms
  for (let p of platforms) {
    ctx.fillStyle = p.type === "bouncy" ? "#9b5de5" : "#3b2a55";
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  // Enemies
  for (let e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = e.type === "patrol" ? "#ffb703" : "#fb8500";
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }

  // Wave text
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.fillText("Wave: " + wave, 10, 25);
}

// =============================
// Main Loop
// =============================
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// =============================
// Buttons
// =============================
document.getElementById("startBtn").addEventListener("click", () => {
  reseed();
  player = makePlayer();
  generatePlatforms();
  generateEnemies(4);
  wave = 1;
  gameRunning = true;
  document.getElementById("overlay").style.display = "none";
});

document.getElementById("seedBtn").addEventListener("click", () => {
  reseed();
  generatePlatforms();
  generateEnemies(4);
  wave = 1;
});

// Start loop
loop();
