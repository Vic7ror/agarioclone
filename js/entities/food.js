import { radiusToMass } from '../utils/MassUtils.js';

const FOOD_TYPES = [
    { radius: 10 },
    { radius: 14 },
    { radius: 18 }
];

const FOOD_COLORS = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899'
];

export class Food {
    constructor(x, y, type, color) {
        this.x = x;
        this.y = y;
        this.radius = type.radius;
        this.mass = radiusToMass(this.radius);
        this.color = color;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    static getRandomType() {
        const roll = Math.random();

        if (roll < 0.84) return FOOD_TYPES[0];
        if (roll < 0.98) return FOOD_TYPES[1];
        return FOOD_TYPES[2];
    }

    static getRandomColor() {
        const index = Math.floor(Math.random() * FOOD_COLORS.length);
        return FOOD_COLORS[index];
    }
}
