
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

class Player {
    constructor() {
        this.x = 100;
        this.y = 500;
        this.width = 40;
        this.height = 60;
        this.vx = 0;
        this.vy = 0;
        this.speed = 4;
        this.jumpStrength = 12;
        this.onGround = false;
    }

    update() {
        // Movement
        if (keys["KeyA"]) this.vx = -this.speed;
        else if (keys["KeyD"]) this.vx = this.speed;
        else this.vx = 0;

        // Jump
        if ((keys["KeyW"] || keys["Space"]) && this.onGround) {
            this.vy = -this.jumpStrength;
            this.onGround = false;
        }

        // Apply gravity
        this.vy += 0.6;

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Floor
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.vy = 0;
            this.onGround = true;
        }
    }

    draw() {
        ctx.fillStyle = "white";
        ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

class Platform {
    constructor(x, y, width, height, bouncy=false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.bouncy = bouncy;
    }

    draw() {
        ctx.fillStyle = this.bouncy ? "lime" : "brown";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

let player = new Player();
let platforms = [];

// Cave generator with 1 bouncy platform
function generateCave() {
    platforms = [];
    for (let i = 0; i < 8; i++) {
        let x = Math.random() * (canvas.width - 100);
        let y = 100 + i * 60;
        platforms.push(new Platform(x, y, 100, 20));
    }
    // Make one random platform bouncy
    let bouncyIndex = Math.floor(Math.random() * platforms.length);
    platforms[bouncyIndex].bouncy = true;
}

generateCave();

function handleCollisions() {
    player.onGround = false;
    platforms.forEach(plat => {
        if (player.x < plat.x + plat.width &&
            player.x + player.width > plat.x &&
            player.y + player.height > plat.y &&
            player.y + player.height < plat.y + plat.height + 10 &&
            player.vy >= 0) {
                
            player.y = plat.y - player.height;
            player.vy = 0;
            player.onGround = true;

            if (plat.bouncy) {
                player.vy = -15; // Bounce strength
                player.onGround = false;
            }
        }
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.update();
    handleCollisions();
    player.draw();

    platforms.forEach(p => p.draw());

    requestAnimationFrame(gameLoop);
    }

gameLoop();