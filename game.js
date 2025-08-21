// --- Utility helpers
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const irand = (a, b) => Math.floor(rand(a, b));

  // --- Game constants
  const W = 960, H = 600;
  const GRAVITY = 0.9;
  const FRICTION = 0.82;
  const MOVE_ACCEL = 0.9;
  const MAX_RUN = 6.4;
  const JUMP_VEL = -16.8;
  const DASH_VEL = 14;
  const DASH_TIME = 10; // frames
  const ATTACK_CD = 22; // frames
  const ATTACK_TIME = 10; // frames
  const ATTACK_RANGE = 56; // px
  const ENEMY_SPAWN_COOLDOWN = 110; // frames between spawns (reduced per stage)

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const statsEl = document.getElementById('stats');

  let keys = new Set();
  window.addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (['w','a','s','d','j','k',' ','p'].includes(e.key.toLowerCase())) e.preventDefault(); });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  // --- World / level data
  function makePlatforms(stage) {
    // Basic layout changes per stage
    const p = [];
    // Ground
    p.push({x:0, y:H-60, w:W, h:60});
    // Floating platforms (vary by stage)
    const rows = [
      {y: H-200, count: 4, w: 160, gap: 30},
      {y: H-330, count: 3, w: 180, gap: 60},
    ];
    rows.forEach((r, i)=>{
      const totalW = r.count * r.w + (r.count-1) * r.gap;
      let startX = (W - totalW)/2 + irand(-40,40) + (stage%2?20:-20)*i;
      for (let j=0;j<r.count;j++) p.push({x: startX + j*(r.w + r.gap), y: r.y + irand(-8,8), w: r.w, h: 18});
    });
    // Small pillars
    for (let i=0;i<irand(2,5);i++) {
      const x = irand(40, W-80);
      p.push({x, y:H-60-irand(40,120), w: 28, h: irand(36,90)});
    }
    return p;
  }

  // Decorative stars and planets for background
  const stars = Array.from({length: 120}, () => ({x: rand(0, W), y: rand(0,H), r: rand(0.5,1.8), a: rand(.3,.9)}));

  // --- Entities
  class Entity {
    constructor(x,y,w,h){ this.x=x; this.y=y; this.w=w; this.h=h; this.vx=0; this.vy=0; this.dead=false; }
    get rect(){ return {x:this.x, y:this.y, w:this.w, h:this.h}; }
  }


  class Player extends Entity {
    constructor(){ super(80, H-160, 28, 40); this.hp=3; this.onGround=false; this.facing=1; this.attackT=0; this.attackCD=0; this.dashT=0; this.invT=0; this.kills=0; this.attacks=0; }
    update(plats){
      if (this.invT>0) this.invT--;
      // input
      const left = keys.has('a');
      const right = keys.has('d');
      const wantJump = keys.has('w') || keys.has(' ');
      const wantAttack = keys.has('j');
      const wantDash = keys.has('k');

      if (left) this.vx -= MOVE_ACCEL;
      if (right) this.vx += MOVE_ACCEL;
      if (left && !right) this.facing = -1; else if (right && !left) this.facing = 1;

      // dash
      if (wantDash && this.dashT<=0 && this.onGround){ this.dashT = DASH_TIME; this.vx = DASH_VEL * this.facing; this.vy = -2; }
      if (this.dashT>0){ this.dashT--; }

      // attack
      if (wantAttack && this.attackCD<=0){ this.attackT = ATTACK_TIME; this.attackCD = ATTACK_CD; this.attacks++; }
      if (this.attackT>0) this.attackT--;
      if (this.attackCD>0) this.attackCD--;

      // physics
      this.vx *= FRICTION;
      this.vx = clamp(this.vx, -MAX_RUN, MAX_RUN);
      this.vy += GRAVITY;

      // jump
      if (wantJump && this.onGround){ this.vy = JUMP_VEL; this.onGround=false; }

      // move + collide
      this.x += this.vx;
      for (const p of plats){
        if (aabb(this.rect,p)){
          if (this.vx>0) this.x = p.x - this.w; else if (this.vx<0) this.x = p.x + p.w;
          this.vx = 0;
        }
      }
      this.y += this.vy;
      this.onGround=false;
      for (const p of plats){
        if (aabb(this.rect,p)){
          if (this.vy>0){ this.y = p.y - this.h; this.vy=0; this.onGround = true; }
          else if (this.vy<0){ this.y = p.y + p.h; this.vy = 0; }
        }
      }
      this.x = clamp(this.x, -20, W-this.w+20);
      this.y = clamp(this.y, -400, H-this.h);
    }

    attackHitbox(){
      if (this.attackT<=0) return null;
      const reach = ATTACK_RANGE;
      const arcY = this.y + this.h*0.5 - 10;
      if (this.facing>0){
        return {x: this.x + this.w-4, y: arcY-18, w: reach, h: 36};
      } else {
        return {x: this.x - reach + 4, y: arcY-18, w: reach, h: 36};
      }
    }
  }

  class Spider extends Entity {
    constructor(x,y,stage=1){ super(x,y,30,22); this.baseY=y; this.dir = Math.random()<.5?-1:1; this.speed = rand(1.1, 1.9) + stage*0.15; this.vy = 0; this.onGround=false; this.hp = 2 + Math.min(2, Math.floor(stage/2)); this.spin = rand(0, Math.PI*2); this.timer=0; }
    update(plats, player){
      // simple AI: patrol & hop toward player if close
      const targetDir = (player.x + player.w/2) < (this.x + this.w/2) ? -1 : 1;
      const dist = Math.abs((player.x+player.w/2) - (this.x+this.w/2));
      const chase = dist < 260;
      const speed = chase ? this.speed*1.3 : this.speed*0.8;
      this.vx += speed * (chase ? targetDir : this.dir) * 0.2;
      this.vx = clamp(this.vx, -speed, speed);

      // random turn at edges
      if (Math.random()<0.005) this.dir*=-1;

      // hop when close
      if (chase && this.onGround && Math.random()<0.05) this.vy = -10.5;

      // physics
      this.vy += GRAVITY*0.9;
      this.x += this.vx;
      for (const p of plats){ if (aabb(this.rect,p)){ if (this.vx>0) this.x = p.x - this.w; else this.x = p.x + p.w; this.vx=0; } }
      this.y += this.vy;
      this.onGround=false;
      for (const p of plats){ if (aabb(this.rect,p)){ if (this.vy>0){ this.y = p.y - this.h; this.vy=0; this.onGround=true; } else { this.y = p.y + p.h; this.vy=0; } } }

      // tiny animation timer
      this.timer++;
    }
  }

  function aabb(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // --- Game state
  const state = {
    running: false,
    paused: false,
    stage: 1,
    timeFrames: 0,
    platforms: [],
    player: new Player(),
    enemies: [],
    spawnCD: ENEMY_SPAWN_COOLDOWN,
    killsToClear: 8,
    cleared: false,
  };

  function reset(stage=1){
    state.running = true; state.paused=false; overlay.hidden = true;
    state.stage = stage; state.timeFrames = 0; state.enemies = []; state.player = new Player();
    state.platforms = makePlatforms(stage);
    state.spawnCD = Math.max(40, ENEMY_SPAWN_COOLDOWN - stage*10);
    state.killsToClear = 6 + stage*2;
    state.cleared = false;
  }

  // --- Spawning
  function spawnSpider(){
    // choose a platform to spawn on (not too close to player)
    const options = state.platforms.filter(pl => pl.w>80);
    const pl = options[irand(0, options.length)];
    if (!pl) return;
    const x = clamp(pl.x + irand(0, pl.w-30), 10, W-40);
    const y = pl.y - 24;
    // avoid spawning right onto player
    if (Math.abs(x - state.player.x) < 80) return;
    state.enemies.push(new Spider(x,y, state.stage));
  }

  // --- Rendering helpers
  function drawBackground(){
    // stars
    for (const s of stars){ ctx.globalAlpha = s.a * (0.6 + 0.4*Math.sin((s.x+s.y+state.timeFrames*0.005))); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fillStyle = '#cdd6f4'; ctx.fill(); }
    ctx.globalAlpha = 1;

    // distant planets
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // main planet
    ctx.beginPath(); ctx.arc(140, 120, 60, 0, Math.PI*2); ctx.fillStyle = '#ffb703'; ctx.fill();
    // rings
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(140,120,90,24,0.6,0,Math.PI*2); ctx.stroke();
    // small moon
    ctx.beginPath(); ctx.arc(820, 100, 26, 0, Math.PI*2); ctx.fillStyle = '#78c6f0'; ctx.fill();
    ctx.restore();
    // parallax dunes
    function dunes(yBase, amp, color){
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x=0; x<=W; x+=12) {
        const y = yBase + Math.sin((x+state.timeFrames*0.02)/80)*amp + Math.cos((x+100)/50)*amp*0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0,H); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    dunes(H-130, 6, 'rgba(155,93,229,0.25)');
    dunes(H-95, 8, 'rgba(155,93,229,0.35)');

  }

  function drawPlatforms(){
    for (const p of state.platforms){
      // platform body
      ctx.fillStyle = '#3b2a55';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(p.x, p.y, p.w, 3);
    }
  }

  function drawPlayer(pl){
    const {x,y,w,h,facing} = pl;
    const t = state.timeFrames;
    // body
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.scale(facing, 1);
    ctx.translate(-w/2, -h/2);



    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w/2, h, 16, 6, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;

    // boots
    ctx.fillStyle = '#444b6e'; ctx.fillRect(4, h-8, 8, 8); ctx.fillRect(w-12, h-8, 8, 8);
    // legs
    ctx.fillStyle = '#596080'; ctx.fillRect(6, h-20, 6, 12); ctx.fillRect(w-12, h-20, 6, 12);
    // torso
    ctx.fillStyle = '#8aa0ff'; ctx.fillRect(4, 10, w-8, 18);
    // shoulder pad
    ctx.fillStyle = '#a0b4ff'; ctx.fillRect(w-12, 10, 10, 8);
    // head (helmet)
    ctx.fillStyle = '#c7d2fe'; ctx.fillRect(6, -2, 16, 12);
    ctx.fillStyle = '#0ea5e9'; ctx.fillRect(8, 2, 12, 4); // visor
    // arm
    ctx.fillStyle = '#9db4ff'; ctx.fillRect(w-10, 16, 8, 8);

    // sword attack arc
    if (pl.attackT>0){
      const prog = 1 - (pl.attackT/ATTACK_TIME);
      const cx = w - 4, cy = 16;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((-0.9 + prog*2.2));
      // blade
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(0, -2, 22, 4);
      // trail
      ctx.globalAlpha = 0.4; ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-4, 0, 28, -0.4, 1.5); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.restore();
    } else {
      // idle sword
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(w-2, 20, 16, 3);
    }

    ctx.restore();
  }

  function drawSpider(s){
    const {x,y,w,h} = s;
    const t = s.timer;
    // shadow
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + w/2, y + h, 14, 5, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;

    // body (dark chitin)
    ctx.fillStyle = '#2b2140';
    ctx.fillRect(x+4, y+6, w-8, h-8);
    // abdomen (purple)
    ctx.fillStyle = '#9b5de5';
    ctx.beginPath(); ctx.ellipse(x + w/2, y + h/2 + 2, 16, 10, 0, 0, Math.PI*2); ctx.fill();
    // head with fangs
    ctx.fillStyle = '#3d2a58'; ctx.fillRect(x+8, y+2, 14, 10);
    ctx.fillStyle = '#f87171'; ctx.fillRect(x+8, y+10, 2, 4); ctx.fillRect(x+20, y+10, 2, 4);
    // legs (animated)
    ctx.strokeStyle = '#4c3a6d'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i=0;i<4;i++){
      const lx = x + 6 + i*6;
      const phase = Math.sin(t*0.2 + i);
      ctx.moveTo(lx, y+12);
      ctx.lineTo(lx-6, y+16+phase*2);
      ctx.moveTo(lx+10, y+12);
      ctx.lineTo(lx+16, y+16-phase*2);
    }
    ctx.stroke();
  }

  // --- UI / HUD
  function updateHUD(){
    const t = Math.floor(state.timeFrames/60);
    const m = String(Math.floor(t/60)).padStart(1,'0');
    const s = String(t%60).padStart(2,'0');
    statsEl.textContent = `❤ ${state.player.hp} | ⚔ ${state.player.attacks} | 🕷 ${state.player.kills}/${state.killsToClear} | ⌚ ${m}:${s}`;
  }

  // --- Main loop
  function gameStep(){
    if (!state.running) return;
    if (!state.paused) state.timeFrames++;

    // logic
    if (!state.paused){
      state.player.update(state.platforms);

      // enemy spawn pacing
      if (!state.cleared){
        state.spawnCD--;
        if (state.spawnCD<=0 && state.enemies.length < 6 + Math.floor(state.stage/2)){
          spawnSpider();
          state.spawnCD = Math.max(30, ENEMY_SPAWN_COOLDOWN - state.stage*10 - irand(0,30));
        }
      }

      // update enemies
      for (const e of state.enemies) e.update(state.platforms, state.player);

      // combat: player attack vs enemies
      const hit = state.player.attackHitbox();
      if (hit){
        for (const e of state.enemies){ if (!e.dead && aabb(hit, e.rect)){ e.hp -= 1; e.vx += 3 * state.player.facing; e.vy -= 4; if (e.hp<=0){ e.dead=true; state.player.kills++; } } }
      }

      // enemy touch damage
      for (const e of state.enemies){
        if (!e.dead && aabb(state.player.rect, e.rect) && state.player.invT<=0){
          state.player.hp--; state.player.invT = 50; state.player.vx += (state.player.x < e.x ? -8 : 8); state.player.vy = -8;
        }
      }

      // remove dead / offscreen
      state.enemies = state.enemies.filter(e=>!e.dead && e.y < H + 100);
      // stage clear
      if (!state.cleared && state.player.kills >= state.killsToClear){ state.cleared = true; }

      // defeat
      if (state.player.hp<=0){
        state.running = false;
        showOverlay(`You were overwhelmed on Stage ${state.stage}.`, true);
      }

      // next stage prompt
      if (state.cleared && state.enemies.length===0){
        state.running = false;
        showOverlay(`Stage ${state.stage} cleared!`, false, true);
      }
    }

    // draw
    ctx.clearRect(0,0,W,H);
    drawBackground();

    drawPlatforms();

    // attack debug (optional) — faint rectangle
    const hb = state.player.attackHitbox();
    if (hb){ ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(hb.x, hb.y, hb.w, hb.h); }

    drawPlayer(state.player);
    for (const e of state.enemies) drawSpider(e);

    // vignette
    const grd = ctx.createRadialGradient(W/2,H/2,100, W/2,H/2, 520);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);

    // HUD
    updateHUD();

    requestAnimationFrame(gameStep);
  }

  function showOverlay(message, defeat=false, canNext=false){
    overlay.hidden = false;
    overlay.querySelector('.title').textContent = 'Knight vs. Spiders — Another Planet';
    const sub = overlay.querySelector('.subtitle');
    sub.innerHTML = message + (defeat ? '<br><span style="opacity:.8">Press <kbd>R</kbd> to retry</span>' : canNext ? '<br><span style="opacity:.8">Press <kbd>N</kbd> for next stage</span>' : '');
  }

  // Pause / resume / stage control
  window.addEventListener('keydown', (e)=>{
    const k = e.key.toLowerCase();
    if (k==='p') { state.paused = !state.paused; if (state.paused) showOverlay('Paused'); else overlay.hidden = true; }
    if (k==='r' && !state.running) { reset(state.stage); }
    if (k==='n' && !state.running && state.cleared) { reset(state.stage+1); }
  });
  startBtn?.addEventListener('click', ()=>{ reset(1); });

  // Show start screen initially
  overlay.hidden = false;
  requestAnimationFrame(gameStep);