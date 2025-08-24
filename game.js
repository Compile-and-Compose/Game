// =========================
// Knight vs Bugs Game Logic
// =========================

// --- constants ---
const W = 1000, H = 620;
const G = 0.8; // gravity
const JUMP = -16;

// --- util ---
function rand(n){ return Math.floor(Math.random()*n); }
function chance(p){ return Math.random()<p; }
function aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

// --- state ---
let state = {
  playing:false,
  score:0,
  player:null,
  enemies:[],
  platforms:[]
};

// --- player ---
class Player {
  constructor(){
    this.x=100; this.y=H-100;
    this.w=32; this.h=32;
    this.vx=0; this.vy=0;
    this.onGround=false;
  }
  rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  update(plats){
    this.vy+=G;
    this.x+=this.vx;
    this.y+=this.vy;
    this.onGround=false;
    for(const p of plats){
      if(aabb(this.rect(),p)){
        if(this.vy>0){ // falling
          this.y=p.y-this.h;
          if(p.bouncy){
            this.vy = JUMP*1.2; // bounce higher
            this.onGround=false;
          } else {
            this.vy=0;
            this.onGround=true;
          }
        }
      }
    }
  }
  jump(){
    if(this.onGround){
      this.vy=JUMP;
      this.onGround=false;
    }
  }
}

// --- enemies ---
class Enemy {
  constructor(x,y){
    this.x=x; this.y=y;
    this.w=28; this.h=28;
    this.vx=rand(2)?1:-1;
    this.vy=0;
  }
  rect(){ return {x:this.x,y:this.y,w:this.w,h:this.h}; }
  update(plats){
    this.vy+=G;
    this.x+=this.vx;
    this.y+=this.vy;
    for(const p of plats){
      if(aabb(this.rect(),p)){
        if(this.vy>0){
          this.y=p.y-this.h;
          this.vy=0;
        }
      }
    }
  }
}

// --- build platforms ---
function buildSurface(){
  state.platforms = [
    {x:0,y:H-20,w:W,h:20},  // ground
    {x:200,y:H-120,w:120,h:20}, // regular
    {x:400,y:H-140,w:80,h:18,bouncy:true}, // jump pad
  ];
}

function buildCave(){
  let roomPlats = [];
  for(let i=0;i<6;i++){
    let x=rand(W-100), y=H-100-rand(200);
    if(chance(0.2)){
      roomPlats.push({x,y,w:80,h:18,bouncy:true}); // 20% chance jump pad
    } else {
      roomPlats.push({x,y,w:80,h:18});
    }
  }
  state.platforms.push(...roomPlats);
}

// --- drawing ---
function drawPlatforms(ctx){
  for(const p of state.platforms){
    if(p.bouncy){
      ctx.fillStyle='#9b5de5';
      ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='rgba(255,255,255,0.4)';
      ctx.fillRect(p.x,p.y,p.w,3);
    } else {
      ctx.fillStyle='#3b2a55';
      ctx.fillRect(p.x,p.y,p.w,p.h);
      ctx.fillStyle='rgba(255,255,255,0.1)';
      ctx.fillRect(p.x,p.y,p.w,3);
    }
  }
}
