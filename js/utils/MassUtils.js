export const MASS_SCALE = 0.4;

export function massToRadius(mass, scale = MASS_SCALE) {
    return Math.sqrt(Math.max(0, mass) / (Math.PI * scale));
}

export function radiusToMass(radius, scale = MASS_SCALE) {
    return Math.PI * radius * radius * scale;
}
