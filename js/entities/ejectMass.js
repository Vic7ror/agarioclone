import { massToRadius } from '../utils/MassUtils.js';

export class EjectMass {
    constructor(x, y, vx, vy, mass = 10, color = '#fbbf24', radius = null, options = {}) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.vx = vx;
        this.vy = vy;
        this.mass = mass;
        this.radius = radius ?? massToRadius(mass);
        this.lifeTime = 0;
        this.maxLifeTime = 20; // segundos antes de desaparecer
        this.color = color;
        this.drag = options.drag ?? 0.9;
        this.wallBounce = options.wallBounce ?? 0.35;
        this.pickupDelay = options.pickupDelay ?? 0.2;
    }

    update(deltaTime, worldWidth, worldHeight) {
        this.lifeTime += deltaTime;

        this.prevX = this.x;
        this.prevY = this.y;

        // Movimento rápido com perda de energia curta (estilo gota.io)
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        const damping = Math.pow(this.drag, deltaTime * 60);
        this.vx *= damping;
        this.vy *= damping;

        // Mantém dentro do mundo com pequeno quique nas bordas.
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx) * this.wallBounce;
        } else if (this.x > worldWidth - this.radius) {
            this.x = worldWidth - this.radius;
            this.vx = -Math.abs(this.vx) * this.wallBounce;
        }

        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = Math.abs(this.vy) * this.wallBounce;
        } else if (this.y > worldHeight - this.radius) {
            this.y = worldHeight - this.radius;
            this.vy = -Math.abs(this.vy) * this.wallBounce;
        }
    }

    draw(ctx, showMass = false) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (!showMass) return;

        const massText = Math.round(this.mass).toString();
        const fontSize = Math.max(8, this.radius * 0.72);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillText(massText, this.x + 1, this.y + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(massText, this.x, this.y);
    }

    isExpired() {
        return this.lifeTime >= this.maxLifeTime;
    }

    canBeAbsorbed() {
        return this.lifeTime >= this.pickupDelay;
    }
}
