import { massToRadius } from '../utils/MassUtils.js';

export class Virus {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.mass = 1000;
        this.radius = massToRadius(this.mass);
        this.vx = 0;
        this.vy = 0;
        this.feedCount = 0;
        this.maxFeedCount = 7;
        this.shootDirX = 1;
        this.shootDirY = 0;
        this.spikeCount = 22;
        this.spikeLen = Math.max(6, this.radius * 0.2);
        this.wallBounce = 0.9;
        this.feedCharge = 0;
        this.feedPulse = 0;
    }

    // Alimenta o vírus com uma massa ejetada.
    // Retorna true quando deve disparar um novo vírus.
    feed(dirX, dirY) {
        this.feedCount++;
        this.shootDirX = dirX;
        this.shootDirY = dirY;
        this.feedPulse = Math.min(1, this.feedPulse + 0.55);
        return this.feedCount >= this.maxFeedCount;
    }

    reset() {
        this.feedCount = 0;
        this.feedCharge = 0;
        this.feedPulse = 0;
    }

    update(deltaTime, worldWidth, worldHeight) {
        if (this.vx !== 0 || this.vy !== 0) {
            this.x += this.vx * deltaTime;
            this.y += this.vy * deltaTime;

            const damping = Math.pow(0.94, deltaTime * 60);
            this.vx *= damping;
            this.vy *= damping;

            // Quique real nas bordas para manter trajetória diagonal após colisão.
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

            if (Math.hypot(this.vx, this.vy) < 4) {
                this.vx = 0;
                this.vy = 0;
            }
        }

        // Animação suave de alimentação: charge aproxima do progresso e pulse relaxa.
        const targetCharge = Math.min(1, this.feedCount / this.maxFeedCount);
        this.feedCharge += (targetCharge - this.feedCharge) * Math.min(1, deltaTime * 10);
        this.feedPulse = Math.max(0, this.feedPulse - deltaTime * 2.6);
    }

    draw(ctx) {
        const spikes = this.spikeCount;
        const pulseScale = 1 + this.feedPulse * 0.12;
        const chargeScale = 1 + this.feedCharge * 0.07;
        const visualRadius = this.radius * pulseScale * chargeScale;
        const innerR = visualRadius;
        const outerR = visualRadius + this.spikeLen * (1 + this.feedCharge * 0.55);

        // Corpo espinhoso (estrela)
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 === 0 ? outerR : innerR;
            const px = this.x + Math.cos(angle) * r;
            const py = this.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = '#33cc00';
        ctx.fill();
        ctx.strokeStyle = '#1a8800';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Núcleo levemente mais claro para dar profundidade
        const grad = ctx.createRadialGradient(
            this.x - visualRadius * 0.2, this.y - visualRadius * 0.2, 0,
            this.x, this.y, visualRadius * 0.9
        );
        grad.addColorStop(0,   `rgba(120,255,60,${0.28 + this.feedCharge * 0.2})`);
        grad.addColorStop(0.6, `rgba(60,180,0,${0.1 + this.feedCharge * 0.18})`);
        grad.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(this.x, this.y, visualRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Exibe massa do vírus por padrão.
        const massText = Math.round(this.mass).toString();
        const fontSize = Math.max(11, visualRadius * 0.48);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(1.2, fontSize * 0.14);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.strokeText(massText, this.x, this.y);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(massText, this.x, this.y);
    }
}
