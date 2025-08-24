// =============================
// Controls
// =============================
document.addEventListener("keydown", e => { keys[e.code] = true; });
document.addEventListener("keyup", e => { keys[e.code] = false; });

// =============================
// Game Loop
// =============================
function update() {
  if (!gameRunning) return;

  // Store previous Y position for collision
  let prevY = player.y;

  // Gravity
  player.vy += 0.5;
  if (player.vy > 8) player.vy = 8;

  // Movement
  if (keys["ArrowLeft"] || keys["KeyA"]) { player.vx = -player.speed; player.facing = -1; }
  else if (keys["ArrowRight"] || keys["KeyD"]) { player.vx = player.speed; player.facing = 1; }
  else { player.vx = 0; }

  // Jump
  if ((keys["ArrowUp"] || keys["KeyW"]) && !player.jumping) {
    player.vy = -10; player.jumping = true;
  }

  // Dash
  if (keys["ShiftLeft"] && player.canDash) {
    player.dashTime = 10; player.canDash = false;
  }
  if (player.dashTime > 0) {
    player.vx = player.facing * 12; player.vy = 0; player.dashTime--;
  }

  // Attack (Z key)
  if (keys["KeyZ"] && !player.attacking) { 
    player.attacking = true; 
    player.attackTime = 10;
  }

  // Apply velocity
  player.x += player.vx;
  player.y += player.vy;

  // Floor collision
  if (player.y + player.h > canvas.height) {
    player.y = canvas.height - player.h;
    player.vy = 0;
    player.jumping = false;
    player.canDash = true;
  }

  // Platforms collision (fixed)
  for (let p of platforms) {
    let playerBottom = player.y + player.h;
    let playerTop = player.y;
    let prevBottom = prevY + player.h;

    if (player.x < p.x + p.w && player.x + player.w > p.x) {

      // Landing on top
      if (prevBottom <= p.y && playerBottom > p.y && player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = p.type === "bouncy" ? -15 : 0;
        player.jumping = false;
        player.canDash = true;
      }

      // Hitting head from below
      else if (prevBottom >= p.y + p.h && playerTop < p.y + p.h && player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }

  // Decrease attack timer
  if (player.attacking) {
    player.attackTime--;
    if (player.attackTime <= 0) player.attacking = false;
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
      let swordX = player.x + (player.facing === 1 ? player.w : -20);
      let swordBox = { x: swordX, y: player.y, w: 20, h: player.h };
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
    generateEnemies(3 + Math.floor(rng() * 4) + wave);
  }
}
