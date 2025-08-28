// --- Helpers
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>Math.random()*(b-a)+a;
const irand=(a,b)=>Math.floor(rand(a,b));
const chance=p=>Math.random()<p;

// PRNG w/ seed
function makePRNG(seed){
  let s = seed>>>0 || (Math.random()*2**32)|0;
  return function(){ s ^= s<<13; s ^= s>>>17; s ^= s<<5; return (s>>>0)/4294967296; }
}

// --- Constants ---
const W=960,H=600,G=8,FRICT=0.82,MOVE=0.9,MAXRUN=6.2,JUMP=-16.8,DASH=14,DASH_T=10;
const ATTACK_T=10,ATTACK_CD=22,ATTACK_R=56;

const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
const statsEl=document.getElementById('stats');
const overlay=document.getElementById('overlay');
const startBtn=document.getElementById('startBtn');
const seedBtn=document.getElementById('seedBtn');

let keys=new Set();
addEventListener('keydown',e=>{keys.add(e.key.toLowerCase()); if(['w','a','s','d','j','k',' ','p'].includes(e.key.toLowerCase())) e.preventDefault();});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

// --- Utility ---
function aabb(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}

// --- Entities ---
class Entity{constructor(x,y,w,h){this.x=x;this.y=y;this.w=w;this.h=h;this.vx=0;this.vy=0;this.dead=false;} get rect(){return {x:this.x,y:this.y,w:this.w,h:this.h}}}
class Player extends Entity{
  constructor(){super(120,H-140,28,40); this.hp=3; this.onGround=false; this.face=1; this.attackT=0; this.attackCD=0; this.dashT=0; this.invT=0; this.kills=0;}
  update(plats){
    if(this.invT>0) this.invT--;
    const L=keys.has('a'), R=keys.has('d'), J=keys.has('w')||keys.has(' '), A=keys.has('j'), Dash=keys.has('k');
    if(L) this.vx-=MOVE; if(R) this.vx+=MOVE; if(L&&!R) this.face=-1; else if(R&&!L) this.face=1;
    if(Dash && this.dashT<=0 && this.onGround){this.dashT=DASH_T; this.vx=DASH*this.face; this.vy=-2;}
    if(this.dashT>0) this.dashT--;
    if(A && this.attackCD<=0){this.attackT=ATTACK_T; this.attackCD=ATTACK_CD;}
    if(this.attackT>0) this.attackT--; if(this.attackCD>0) this.attackCD--;
    this.vx*=FRICT; this.vx=clamp(this.vx,-MAXRUN,MAXRUN); this.vy+=G;
    if(J && this.onGround){this.vy=JUMP; this.onGround=false;}
    this.x+=this.vx; for(const p of plats){ if(aabb(this.rect,p)){ if(this.vx>0) this.x=p.x-this.w; else this.x=p.x+p.w; this.vx=0; } }
    this.y+=this.vy; this.onGround=false; for(const p of plats){ if(aabb(this.rect,p)){ 
      if(p instanceof BouncyPlatform){ p.checkBounce(this); } 
      else { if(this.vy>0){this.y=p.y-this.h; this.vy=0; this.onGround=true;} else {this.y=p.y+p.h; this.vy=0;} } 
    } }
    this.x=clamp(this.x,-40,W-this.w+40); this.y=clamp(this.y,-500,H-this.h);
  }
  hitbox(){ if(this.attackT<=0) return null; const cx=this.face>0? this.x+this.w-4: this.x-ATTACK_R+4; return {x:cx, y:this.y+this.h*0.5-18, w:ATTACK_R, h:36}; }
}

class Spider extends Entity{
  constructor(x,y,spd=1.4,hp=2){super(x,y,30,22); this.speed=spd; this.vy=0; this.onGround=false; this.hp=hp; this.t=0;}
  update(plats,player){
    const dir=(player.x+player.w/2)<(this.x+this.w/2)?-1:1; const dist=Math.abs((player.x+player.w/2)-(this.x+this.w/2)); const chase=dist<260;
    const sp=chase?this.speed*1.25:this.speed*0.8; this.vx = clamp((this.vx + sp*0.18*dir), -sp, sp);
    if(chase&&this.onGround&&chance(0.05)) this.vy=-10.5;
    this.vy+=G*0.9; this.x+=this.vx; for(const p of plats){ if(aabb(this.rect,p)){ if(this.vx>0) this.x=p.x-this.w; else this.x=p.x+p.w; this.vx=0; } }
    this.y+=this.vy; this.onGround=false; for(const p of plats){ if(aabb(this.rect,p)){ if(this.vy>0){this.y=p.y-this.h; this.vy=0; this.onGround=true;} else {this.y=p.y+p.h; this.vy=0;} } }
    this.t++;
  }
}

// --- Bouncy Platform ---
class BouncyPlatform extends Entity{
  constructor(x,y,w,h,bounce=-18){ super(x,y,w,h); this.bounceStrength=bounce; }
  checkBounce(player){
    if(player.vy>=0 && aabb(player.rect,this.rect) && player.y+player.h<=this.y+player.vy+2){
      player.y=this.y-player.h; player.vy=this.bounceStrength; player.onGround=false;
    }
  }
  draw(ctx){ ctx.fillStyle='var(--bouncy)'; ctx.fillRect(this.x,this.y,this.w,this.h); ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.strokeRect(this.x,this.y,this.w,this.h);}
}

// --- Game state ---
let state={player:null, platforms:[], enemies:[], seed:irand(0,999999), prng:null};
const player=new Player();

function buildPlatforms(){
  state.platforms=[];
  for(let i=0;i<12;i++){
    const w=irand(80,160), h=8, x=irand(0,W-w), y=H-60-i*50;
    state.platforms.push({x,y,w,h});
  }
  addBouncyPlatforms();
}

function addBouncyPlatforms(){
  const plats=state.platforms;
  let nBouncy=irand(2,4); 
  while(nBouncy>0){
    const i=irand(0,plats.length);
    const p=plats[i];
    if(!(p instanceof BouncyPlatform)){
      plats[i]=new BouncyPlatform(p.x,p.y,p.w,p.h,-18);
      nBouncy--;
    }
  }
}

function spawnEnemies(){
  state.enemies=[];
  state.platforms.forEach(p=>{
    if(!(p instanceof BouncyPlatform)&&chance(0.4)){
      const s=new Spider(p.x+irand(0,p.w-30),p.y-22);
      state.enemies.push(s);
    }
  });
}

function resetGame(){
  state.prng=makePRNG(state.seed);
  state.player=new Player();
  buildPlatforms();
  spawnEnemies();
}

function gameLoop(){
  const pl=state.player; const plats=state.platforms; const enemies=state.enemies;
  ctx.clearRect(0,0,W,H);
  pl.update(plats);
  enemies.forEach(e=>{ e.update(plats,pl); });
  // draw platforms
  plats.forEach(p=>{
    if(p instanceof BouncyPlatform) p.draw(ctx);
    else { ctx.fillStyle='var(--platform)'; ctx.fillRect(p.x,p.y,p.w,p.h);}
  });
  // draw player
  ctx.fillStyle='var(--ok)'; ctx.fillRect(pl.x,pl.y,pl.w,pl.h);
  // draw enemies
  enemies.forEach(e=>{
    ctx.fillStyle='var(--danger)';
    ctx.fillRect(e.x,e.y,e.w,e.h);
  });
  requestAnimationFrame(gameLoop);
}

startBtn.onclick=()=>{overlay.hidden=true; resetGame(); gameLoop();};
seedBtn.onclick=()=>{state.seed=irand(0,999999); overlay.hidden=false;};

