import { MASS_SCALE, massToRadius as sharedMassToRadius, radiusToMass as sharedRadiusToMass } from '../utils/MassUtils.js';

export class Player {
    constructor(x, y) {
        this.name = '';
        this.showMassInCell = false;
        this.color = '#ff6b6b';
        this.speed = 300;
        this.maxCells = 32;
        this.minCellMassAfterSplit = 400;
        this.minSplitRadius = 10;
        this.splitBoost = 1240;
        this.recombineDelay = 10;
        this.recombineDelayPer1000 = 0.2;
        this.velocityDamping = 0.94;
        this.wallBounce = 0.82;
        this.splitWallBounce = 0.94;
        this.stopSmoothing = 0.22;
        this.massDecayRate = 0.002;   // 0.2% da massa por segundo acima do limiar
        this.massDecayMin  = 400;     // massa mínima — abaixo disso, sem decay
        this.massScale = MASS_SCALE;
        this.nextCellId = 1;
        this.nextSplitOrder = 1;
        const initialMass = 400;
        const initialRadius = this.massToRadius(initialMass);
        const initialCell = this.createCell(x, y, initialRadius, 0, 0, 0);
        initialCell.isMain = true;
        initialCell.splitOrder = 0;
        this.cells = [initialCell];
    }

    createCell(x, y, radius, vx, vy, mergeCooldown) {
        return {
            id: this.nextCellId++,
            x,
            y,
            radius,
            vx,
            vy,
            mergeCooldown,
            merging: false,
            mergePartner: null,
            mergeProgress: 0,
            splitAnim: null,
            mass: this.radiusToMass(radius),
            isMain: false,
            targetRadius: radius,
            splitOrder: this.nextSplitOrder++
        };
    }

    massToRadius(mass) {
        return sharedMassToRadius(mass, this.massScale);
    }

    radiusToMass(radius) {
        return sharedRadiusToMass(radius, this.massScale);
    }

    get x() {
        return this.getCenter().x;
    }

    get y() {
        return this.getCenter().y;
    }

    update(targetX, targetY, deltaTime, worldWidth, worldHeight) {
        const center = this.getCenter();
        const inputDx = targetX - center.x;
        const inputDy = targetY - center.y;
        const inputDistance = Math.hypot(inputDx, inputDy);
        const averageRadius = this.cells.length > 0
            ? this.cells.reduce((sum, c) => sum + c.radius, 0) / this.cells.length
            : 0;
        const inputDeadzone = Math.max(4, averageRadius * 0.1);
        const hasMoveInput = inputDistance > inputDeadzone;

        for (const cell of this.cells) {
            if (typeof cell.mergeCooldown !== 'number') {
                cell.mergeCooldown = 0;
            }
            if (typeof cell.splitOrder !== 'number') {
                cell.splitOrder = this.nextSplitOrder++;
            }

            const prevX = cell.x;
            const prevY = cell.y;

            if (cell.splitAnim) {
                const splitAnimStep = Math.min(deltaTime, 0.012);
                cell.splitAnim.elapsed = Math.min(cell.splitAnim.duration, cell.splitAnim.elapsed + splitAnimStep);
                const launchEaseDuration = cell.splitAnim.launchEaseDuration || 0.085;
                const launchT = Math.min(1, cell.splitAnim.elapsed / launchEaseDuration);
                const launchEase = launchT * launchT;
                const frameSpeed = cell.splitAnim.speed * (0.2 + 0.8 * launchEase);

                // Estilo Sigmally: impulso na direção do mouse com desaceleração progressiva.
                cell.x += cell.splitAnim.dirX * frameSpeed * splitAnimStep;
                cell.y += cell.splitAnim.dirY * frameSpeed * splitAnimStep;
                cell.splitAnim.speed = Math.max(
                    cell.splitAnim.minSpeed,
                    cell.splitAnim.speed * Math.pow(cell.splitAnim.decay, splitAnimStep * 60)
                );

                if (cell.splitAnim.elapsed >= cell.splitAnim.duration || cell.splitAnim.speed <= cell.splitAnim.minSpeed + 1) {
                    cell.vx = cell.splitAnim.dirX * cell.splitAnim.exitSpeed;
                    cell.vy = cell.splitAnim.dirY * cell.splitAnim.exitSpeed;
                    cell.splitAnim = null;
                }

                cell.mergeCooldown = Math.max(0, cell.mergeCooldown - deltaTime);

                // Crescimento gradual também durante o split
                if (cell.eatGrowthTimer > 0) {
                    cell.eatGrowthTimer = Math.max(0, cell.eatGrowthTimer - deltaTime);
                }
                if (cell.targetRadius !== cell.radius) {
                    const lerpFactor = (cell.eatGrowthTimer > 0) ? 6 : 12;
                    const diff = cell.targetRadius - cell.radius;
                    const step = diff * Math.min(1, lerpFactor * deltaTime);
                    cell.radius += step;
                    if (Math.abs(diff) < 0.1) cell.radius = cell.targetRadius;
                }

                this.applyWallBounce(cell, worldWidth, worldHeight, deltaTime, prevX, prevY);
                continue;
            }

            if (hasMoveInput) {
                const dx = targetX - cell.x;
                const dy = targetY - cell.y;
                const distance = Math.hypot(dx, dy) || 1;
                const speedFactor = Math.max(0.32, Math.pow(20 / cell.radius, 0.45));
                const step = this.speed * speedFactor * deltaTime;
                cell.x += (dx / distance) * step;
                cell.y += (dy / distance) * step;
            }

            cell.x += cell.vx * deltaTime;
            cell.y += cell.vy * deltaTime;

            cell.vx *= this.velocityDamping;
            cell.vy *= this.velocityDamping;
            cell.mergeCooldown = Math.max(0, cell.mergeCooldown - deltaTime);

            // Decay gradual de massa, igual ao Agar.io: só acima do piso mínimo
            if (cell.mass > this.massDecayMin) {
                const excess = cell.mass - this.massDecayMin;
                const loss = excess * this.massDecayRate * deltaTime;
                cell.mass = Math.max(this.massDecayMin, cell.mass - loss);
                cell.targetRadius = this.massToRadius(cell.mass);
            }

            // Crescimento gradual: lento quando acabou de comer, normal nos demais casos
            if (cell.eatGrowthTimer > 0) {
                cell.eatGrowthTimer = Math.max(0, cell.eatGrowthTimer - deltaTime);
            }
            if (cell.targetRadius !== cell.radius) {
                const lerpFactor = (cell.eatGrowthTimer > 0) ? 6 : 12;
                const diff = cell.targetRadius - cell.radius;
                const step = diff * Math.min(1, lerpFactor * deltaTime);
                cell.radius += step;
                if (Math.abs(diff) < 0.1) cell.radius = cell.targetRadius;
            }

            this.applyWallBounce(cell, worldWidth, worldHeight, deltaTime, prevX, prevY);
        }

        this.updateMergeAnimations(deltaTime);
        this.resolveCellSpacing();
    }

    applyWallBounce(cell, worldWidth, worldHeight, deltaTime, prevX, prevY) {
        const bounce = this.wallBounce;
        const stepTime = Math.max(deltaTime || 0, 1 / 240);
        const incomingVx = (cell.x - prevX) / stepTime;
        const incomingVy = (cell.y - prevY) / stepTime;

        // Split em borda estilo Vanis.io: ricochete vetorial com pouca perda.
        if (cell.splitAnim) {
            let hitX = false;
            let hitY = false;

            if (cell.x < cell.radius) {
                cell.x = cell.radius;
                hitX = true;
            } else if (cell.x > worldWidth - cell.radius) {
                cell.x = worldWidth - cell.radius;
                hitX = true;
            }

            if (cell.y < cell.radius) {
                cell.y = cell.radius;
                hitY = true;
            } else if (cell.y > worldHeight - cell.radius) {
                cell.y = worldHeight - cell.radius;
                hitY = true;
            }

            if (hitX || hitY) {
                const splitBounce = this.splitWallBounce;

                if (hitX) {
                    const sourceVx = Math.abs(incomingVx) > 1 ? incomingVx : cell.vx;
                    if (cell.x <= cell.radius) {
                        cell.vx = Math.abs(sourceVx) * splitBounce;
                        cell.splitAnim.dirX = Math.abs(cell.splitAnim.dirX);
                    } else {
                        cell.vx = -Math.abs(sourceVx) * splitBounce;
                        cell.splitAnim.dirX = -Math.abs(cell.splitAnim.dirX);
                    }

                    if (Math.abs(cell.splitAnim.dirX) < 0.03) {
                        cell.splitAnim.dirX = cell.vx >= 0 ? 1 : -1;
                    }
                }

                if (hitY) {
                    const sourceVy = Math.abs(incomingVy) > 1 ? incomingVy : cell.vy;
                    if (cell.y <= cell.radius) {
                        cell.vy = Math.abs(sourceVy) * splitBounce;
                        cell.splitAnim.dirY = Math.abs(cell.splitAnim.dirY);
                    } else {
                        cell.vy = -Math.abs(sourceVy) * splitBounce;
                        cell.splitAnim.dirY = -Math.abs(cell.splitAnim.dirY);
                    }

                    if (Math.abs(cell.splitAnim.dirY) < 0.03) {
                        cell.splitAnim.dirY = cell.vy >= 0 ? 1 : -1;
                    }
                }

                const mag = Math.hypot(cell.splitAnim.dirX, cell.splitAnim.dirY);
                if (mag > 0.0001) {
                    cell.splitAnim.dirX /= mag;
                    cell.splitAnim.dirY /= mag;
                }

                // Pequena perda de energia ao raspar na parede para suavizar.
                cell.splitAnim.speed = Math.max(
                    cell.splitAnim.minSpeed,
                    cell.splitAnim.speed * splitBounce
                );
            }
            return;
        }

        if (cell.x < cell.radius) {
            cell.x = cell.radius;
            const sourceVx = Math.abs(incomingVx) > 1 ? incomingVx : cell.vx;
            cell.vx = Math.abs(sourceVx) * bounce;
            if (Math.abs(cell.vy) < 1 && Math.abs(incomingVy) > 1) {
                cell.vy = incomingVy * bounce;
            }
        } else if (cell.x > worldWidth - cell.radius) {
            cell.x = worldWidth - cell.radius;
            const sourceVx = Math.abs(incomingVx) > 1 ? incomingVx : cell.vx;
            cell.vx = -Math.abs(sourceVx) * bounce;
            if (Math.abs(cell.vy) < 1 && Math.abs(incomingVy) > 1) {
                cell.vy = incomingVy * bounce;
            }
        }

        if (cell.y < cell.radius) {
            cell.y = cell.radius;
            const sourceVy = Math.abs(incomingVy) > 1 ? incomingVy : cell.vy;
            cell.vy = Math.abs(sourceVy) * bounce;
            if (Math.abs(cell.vx) < 1 && Math.abs(incomingVx) > 1) {
                cell.vx = incomingVx * bounce;
            }
        } else if (cell.y > worldHeight - cell.radius) {
            cell.y = worldHeight - cell.radius;
            const sourceVy = Math.abs(incomingVy) > 1 ? incomingVy : cell.vy;
            cell.vy = -Math.abs(sourceVy) * bounce;
            if (Math.abs(cell.vx) < 1 && Math.abs(incomingVx) > 1) {
                cell.vx = incomingVx * bounce;
            }
        }
    }
    
    draw(ctx) {
        // Desenha do menor para o maior para a maior ficar por cima.
        const orderedCells = [...this.cells].sort((a, b) => a.radius - b.radius);
        const mainCell = this.cells.find(c => c.isMain) ?? this.cells[0];

        // Blob connections entre células sobrepostas (efeito líquido de fusão)
        for (let i = 0; i < this.cells.length; i++) {
            for (let j = i + 1; j < this.cells.length; j++) {
                this.drawBlobConnection(ctx, this.cells[i], this.cells[j]);
            }
        }

        for (const cell of orderedCells) {
            // Durante a fusão, esconde a célula menor apenas quando está totalmente
            // dentro da maior — parece que foi incorporada, sem encolher.
            const isMergingSmaller = cell.merging && cell.mergeProgress > 0 &&
                cell.mergePartner && cell.radius <= cell.mergePartner.radius;

            if (isMergingSmaller) {
                const partner = cell.mergePartner;
                const dist = Math.hypot(partner.x - cell.x, partner.y - cell.y);
                if (dist + cell.radius <= partner.radius) continue;
            }

            const drawRadius = cell.radius;
            const borderWidth = Math.max(2, drawRadius * 0.032);

            // Gradiente radial suave: centro levemente clareado → borda levemente escurecida (estilo Sigmally)
            const grad = ctx.createRadialGradient(
                cell.x - drawRadius * 0.18, cell.y - drawRadius * 0.18, 0,
                cell.x, cell.y, drawRadius
            );
            grad.addColorStop(0,    this.lightenColor(this.color, 0.12));
            grad.addColorStop(0.72, this.color);
            grad.addColorStop(1,    this.darkenColor(this.color, 0.18));
            ctx.beginPath();
            ctx.arc(cell.x, cell.y, drawRadius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Borda fina levemente escurecida
            ctx.beginPath();
            ctx.arc(cell.x, cell.y, drawRadius - borderWidth * 0.5, 0, Math.PI * 2);
            ctx.strokeStyle = this.darkenColor(this.color, 0.22);
            ctx.lineWidth = borderWidth;
            ctx.stroke();

            // Nome do jogador — estilo Sigmally: texto branco com contorno
            if (this.name && !isMergingSmaller) {
                const fontSize = Math.max(10, drawRadius * 0.4);
                const hasMassLabel = this.showMassInCell;
                const nameY = hasMassLabel ? cell.y - fontSize * 0.3 : cell.y;
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineWidth = Math.max(1.5, fontSize * 0.14);
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.strokeText(this.name, cell.x, nameY);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(this.name, cell.x, nameY);

                if (hasMassLabel) {
                    const massFontSize = Math.max(8, fontSize * 0.52);
                    const massText = Math.round(cell.mass).toString();
                    const massY = cell.y + fontSize * 0.52;
                    ctx.font = `bold ${massFontSize}px Arial`;
                    ctx.lineWidth = Math.max(1, massFontSize * 0.14);
                    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                    ctx.strokeText(massText, cell.x, massY);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(massText, cell.x, massY);
                }
            }
        }
    }

    drawBlobConnection(ctx, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist >= a.radius + b.radius) return;

        const angle = Math.atan2(dy, dx);
        const perp = angle + Math.PI / 2;

        // u: fator de sobreposição (0 = apenas tocando, 1 = centros coincidentes)
        const u = 1 - dist / (a.radius + b.radius);
        // Largura do "pescoço" cresce suavemente com a sobreposição
        const neckPct = Math.min(0.92, Math.pow(u, 0.35) * 0.98);

        const w1 = a.radius * neckPct;
        const w2 = b.radius * neckPct;

        const a1x = a.x + Math.cos(perp) * w1;
        const a1y = a.y + Math.sin(perp) * w1;
        const a2x = a.x - Math.cos(perp) * w1;
        const a2y = a.y - Math.sin(perp) * w1;
        const b1x = b.x + Math.cos(perp) * w2;
        const b1y = b.y + Math.sin(perp) * w2;
        const b2x = b.x - Math.cos(perp) * w2;
        const b2y = b.y - Math.sin(perp) * w2;

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const hw = (w1 + w2) * 0.5;

        ctx.beginPath();
        ctx.moveTo(a1x, a1y);
        ctx.quadraticCurveTo(
            mx + Math.cos(perp) * hw, my + Math.sin(perp) * hw,
            b1x, b1y
        );
        ctx.lineTo(b2x, b2y);
        ctx.quadraticCurveTo(
            mx - Math.cos(perp) * hw, my - Math.sin(perp) * hw,
            a2x, a2y
        );
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    darkenColor(hex, amount) {
        const r = Math.round(Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - amount)));
        const g = Math.round(Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - amount)));
        const b = Math.round(Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - amount)));
        return `rgb(${r}, ${g}, ${b})`;
    }

    lightenColor(hex, amount) {
        const r = Math.round(Math.min(255, parseInt(hex.slice(1, 3), 16) + 255 * amount));
        const g = Math.round(Math.min(255, parseInt(hex.slice(3, 5), 16) + 255 * amount));
        const b = Math.round(Math.min(255, parseInt(hex.slice(5, 7), 16) + 255 * amount));
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    moveTo(x, y) {
        const center = this.getCenter();
        const dx = x - center.x;
        const dy = y - center.y;

        for (const cell of this.cells) {
            cell.x += dx;
            cell.y += dy;
        }
    }

    getMass() {
        let total = 0;
        for (const cell of this.cells) {
            total += cell.mass;
        }

        return Math.round(total);
    }

    getDynamicRecombineDelay() {
        const totalMass = Math.max(0, this.getMass());
        const extraSteps = Math.floor(totalMass / 1000);
        return this.recombineDelay + extraSteps * this.recombineDelayPer1000;
    }

    absorbMass(cell, mass, foodRadius = 0, eatMode = false) {
        if (foodRadius > 0) {
            // Soma de áreas: garante crescimento proporcional ao tamanho visual da food
            const newRadius = Math.sqrt(cell.targetRadius * cell.targetRadius + foodRadius * foodRadius);
            cell.targetRadius = newRadius;
            cell.mass = this.radiusToMass(newRadius);
        } else {
            cell.mass += mass;
            cell.targetRadius = this.massToRadius(cell.mass);
            if (eatMode) {
                // Crescimento gradual visível ao comer — célula cresce do tamanho atual ao novo
                cell.eatGrowthTimer = 0.35;
            }
        }
    }

    split(targetX, targetY) {
        if (this.cells.length >= this.maxCells) return null;

        const newCells = [];
        let availableSlots = this.maxCells - this.cells.length;
        let launchedFocusCell = null;
        for (const cell of this.cells) {
            const canSplitByMass = (cell.mass / 2) >= this.minCellMassAfterSplit;
            const canSplit = availableSlots > 0 && cell.radius > this.minSplitRadius && canSplitByMass;

            if (!canSplit) {
                newCells.push(cell);
                continue;
            }

            const dx = targetX - cell.x;
            const dy = targetY - cell.y;
            const distance = Math.hypot(dx, dy);
            const dirX = distance > 0 ? dx / distance : 1;
            const dirY = distance > 0 ? dy / distance : 0;
            const splitChildMass = cell.mass / 2;
            const childCooldown = Math.max(cell.mergeCooldown, this.getDynamicRecombineDelay(splitChildMass));

            const newRadius = cell.radius / Math.sqrt(2);
            // Offset mínimo para evitar "pulo" visual no início do split.
            const offset = newRadius * 0.04;
            const totalMassNow = this.getMass();
            // -5% a cada 5000 de massa, mínimo de 20% da distância base
            const massPenalty = Math.max(0.2, 1 - Math.floor(totalMassNow / 5000) * 0.05);
            const splitTravelDistance = newRadius * 7.5 * massPenalty;
            const splitTravelDuration = 0.42;
            const splitStartSpeed = this.splitBoost * 0.86;
            const splitEndSpeed = this.splitBoost * 0.16;
            const splitDecay = 0.975;

            const baseCell = this.createCell(
                cell.x - dirX * offset,
                cell.y - dirY * offset,
                newRadius,
                0,
                0,
                childCooldown
            );
            baseCell.mass = cell.mass / 2;
            baseCell.isMain = cell.isMain;
            baseCell.splitOrder = cell.splitOrder;
            baseCell.vx = cell.vx * 0.35;
            baseCell.vy = cell.vy * 0.35;

            const splitCell = this.createCell(
                cell.x + dirX * offset,
                cell.y + dirY * offset,
                newRadius,
                0,
                0,
                childCooldown
            );
            splitCell.mass = cell.mass / 2;
            splitCell.splitAnim = {
                dirX,
                dirY,
                speed: splitStartSpeed,
                minSpeed: splitEndSpeed,
                decay: splitDecay,
                duration: splitTravelDuration,
                launchEaseDuration: 0.085,
                elapsed: 0,
                exitSpeed: this.splitBoost * 0.1
            };

            if (!launchedFocusCell) {
                launchedFocusCell = splitCell;
            }

            newCells.push(baseCell, splitCell);
            availableSlots -= 1;
        }

        this.cells = newCells;
        if (launchedFocusCell) {
            // Sempre que houver nova divisão, reinicia o cooldown de recombinação.
            const recombineDelay = this.getDynamicRecombineDelay();
            for (const currentCell of this.cells) {
                currentCell.mergeCooldown = recombineDelay;
            }
        }
        return launchedFocusCell;
    }

    virusSplit(cell) {
        const cellIdx = this.cells.indexOf(cell);
        if (cellIdx === -1) return false;

        const availableSlots = this.maxCells - this.cells.length + 1;
        if (availableSlots < 2) return false;
        const pieces = Math.max(2, Math.min(16, availableSlots));
        const massPerPiece = cell.mass / pieces;
        const radiusPerPiece = this.massToRadius(massPerPiece);
        const cooldown = this.getDynamicRecombineDelay(massPerPiece);

        const newPieces = [];
        for (let i = 0; i < pieces; i++) {
            const angle = (i / pieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            const offset = radiusPerPiece * 0.12;
            const piece = this.createCell(
                cell.x + dirX * offset,
                cell.y + dirY * offset,
                radiusPerPiece,
                0, 0,
                cooldown
            );
            piece.mass = massPerPiece;
            piece.isMain = (i === 0) && cell.isMain;
            piece.splitOrder = this.nextSplitOrder++;
            piece.splitAnim = {
                dirX, dirY,
                speed: this.splitBoost * 0.9,
                minSpeed: this.splitBoost * 0.125,
                decay: 0.90,
                duration: 0.32,
                launchEaseDuration: 0.07,
                elapsed: 0,
                exitSpeed: this.splitBoost * 0.1
            };
            newPieces.push(piece);
        }
        this.cells.splice(cellIdx, 1, ...newPieces);
        return true;
    }

    updateMergeAnimations(deltaTime) {
        if (this.cells.length <= 1) return;

        const aliveIds = new Set(this.cells.map(cell => cell.id));

        // Reset merging state for cells that aren't actively merging
        for (const cell of this.cells) {
            const hasValidPartner = !!cell.mergePartner && aliveIds.has(cell.mergePartner.id);
            if (cell.mergeProgress === 0 || !hasValidPartner) {
                cell.merging = false;
                cell.mergePartner = null;
                cell.mergeProgress = 0;
            }
        }

        const toRemove = new Set();
        const mergeDuration = 28.0;
        const engagedCellIds = new Set();
        const pairCandidates = [];

        for (let i = 0; i < this.cells.length; i++) {
            for (let j = i + 1; j < this.cells.length; j++) {
                const a = this.cells[i];
                const b = this.cells[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy) || 0.0001;
                const combinedRadius = a.radius + b.radius;
                if (dist > combinedRadius) continue;

                pairCandidates.push({
                    i,
                    j,
                    dist,
                    overlap: combinedRadius - dist,
                    combinedRadius
                });
            }
        }

        // Prioridade estilo Agar: pares mais próximos/sobrepostos se juntam primeiro.
        pairCandidates.sort((p1, p2) => {
            if (p2.overlap !== p1.overlap) return p2.overlap - p1.overlap;
            return p1.dist - p2.dist;
        });

        for (const pair of pairCandidates) {
            const i = pair.i;
            const j = pair.j;
            if (toRemove.has(i) || toRemove.has(j)) continue;

            const a = this.cells[i];
            const b = this.cells[j];
            if (!a || !b) continue;
            if (engagedCellIds.has(a.id) || engagedCellIds.has(b.id)) continue;

            // Impede troca de parceiro enquanto a fusão está em andamento
            if (a.mergeProgress > 0 && a.mergePartner && a.mergePartner.id !== b.id) continue;
            if (b.mergeProgress > 0 && b.mergePartner && b.mergePartner.id !== a.id) continue;
            if (a.mergeCooldown > 0 || b.mergeCooldown > 0) continue;

            // Flag as merging so spacing resolver allows overlap
            a.merging = true;
            b.merging = true;

            if (!a.mergePartner || a.mergePartner.id !== b.id) {
                a.mergePartner = b;
                a.mergeProgress = 0;
            }
            if (!b.mergePartner || b.mergePartner.id !== a.id) {
                b.mergePartner = a;
                b.mergeProgress = 0;
            }

            const nextProgress = Math.min(1, a.mergeProgress + deltaTime / mergeDuration);
            a.mergeProgress = nextProgress;
            b.mergeProgress = nextProgress;
            const easedIn = nextProgress * nextProgress;

            const areaA = a.radius * a.radius;
            const areaB = b.radius * b.radius;
            const pullSmall = (deltaTime / mergeDuration) * (0.2 + 0.08 * easedIn);
            const pullLarge = pullSmall * 0.014;

            if (areaA > areaB) {
                b.x += (a.x - b.x) * pullSmall;
                b.y += (a.y - b.y) * pullSmall;
                a.x += (b.x - a.x) * pullLarge;
                a.y += (b.y - a.y) * pullLarge;
            } else {
                a.x += (b.x - a.x) * pullSmall;
                a.y += (b.y - a.y) * pullSmall;
                b.x += (a.x - b.x) * pullLarge;
                b.y += (a.y - b.y) * pullLarge;
            }

            engagedCellIds.add(a.id);
            engagedCellIds.add(b.id);

            const larger = areaA >= areaB ? a : b;
            const smaller = areaA >= areaB ? b : a;
            const distAfterMove = Math.hypot(larger.x - smaller.x, larger.y - smaller.y);
            const fullyContained = distAfterMove + smaller.radius <= larger.radius;
            const deepOverlap = distAfterMove <= (larger.radius + smaller.radius) * 0.18;
            const overlapRatio = Math.max(0, 1 - distAfterMove / (larger.radius + smaller.radius));
            const hardLockOverlap = overlapRatio >= 0.62;
            const smallerMostlyInside = distAfterMove + smaller.radius * 0.55 <= larger.radius;

            if (a.mergeProgress >= 1 || fullyContained || deepOverlap || hardLockOverlap || smallerMostlyInside) {
                const totalArea = areaA + areaB;
                const totalMass = a.mass + b.mass;
                const largerIdx = areaA >= areaB ? i : j;
                const smallerIdx = areaA >= areaB ? j : i;

                this.cells[largerIdx].x = (a.x * areaA + b.x * areaB) / totalArea;
                this.cells[largerIdx].y = (a.y * areaA + b.y * areaB) / totalArea;
                this.cells[largerIdx].mass = totalMass;
                this.cells[largerIdx].targetRadius = this.massToRadius(totalMass);
                this.cells[largerIdx].splitOrder = Math.min(a.splitOrder, b.splitOrder);
                this.cells[largerIdx].vx = (a.vx * areaA + b.vx * areaB) / totalArea;
                this.cells[largerIdx].vy = (a.vy * areaA + b.vy * areaB) / totalArea;
                this.cells[largerIdx].merging = false;
                this.cells[largerIdx].mergePartner = null;
                this.cells[largerIdx].mergeProgress = 0;
                if (this.cells[smallerIdx].isMain) {
                    this.cells[largerIdx].isMain = true;
                }
                toRemove.add(smallerIdx);
            }
        }

        if (toRemove.size > 0) {
            this.cells = this.cells.filter((_, idx) => !toRemove.has(idx));
        }
    }

    resolveCellSpacing() {
        if (this.cells.length <= 1) return;

        const iterations = 2;

        for (let pass = 0; pass < iterations; pass++) {
            for (let i = 0; i < this.cells.length; i++) {
                for (let j = i + 1; j < this.cells.length; j++) {
                    const a = this.cells[i];
                    const b = this.cells[j];

                    const blockedByCooldown = a.mergeCooldown > 0 || b.mergeCooldown > 0;
                    const canMergeNow = !blockedByCooldown;
                    const isActiveMergePair = !!a.mergePartner && !!b.mergePartner &&
                        a.mergePartner.id === b.id && b.mergePartner.id === a.id;

                    // Só permite overlap quando o par está efetivamente em fusão.
                    if (canMergeNow && isActiveMergePair && a.merging && b.merging && a.mergeProgress > 0 && b.mergeProgress > 0) {
                        continue;
                    }

                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const distance = Math.hypot(dx, dy) || 0.0001;
                    const minDistance = a.radius + b.radius;
                    const overlap = minDistance - distance;
                    if (overlap <= 0) continue;

                    const nx = dx / distance;
                    const ny = dy / distance;

                    const aLockedBySplit = !!a.splitAnim;
                    const bLockedBySplit = !!b.splitAnim;

                    // Célula em voo de split passa por dentro das demais sem desviar nenhuma.
                    if (aLockedBySplit !== bLockedBySplit) continue;

                    const invMassA = 1 / Math.max(1, a.mass);
                    const invMassB = 1 / Math.max(1, b.mass);
                    const invMassSum = invMassA + invMassB;

                    if (invMassSum <= 0) continue;

                    // Correção de posição em passos menores reduz "empurrão" e jitter.
                    const slop = blockedByCooldown ? 0.02 : 0.06;
                    const percent = blockedByCooldown ? 0.92 : 0.78;
                    const correction = Math.max(0, overlap - slop) * percent;

                    if (correction > 0) {
                        const moveA = correction * (invMassA / invMassSum);
                        const moveB = correction * (invMassB / invMassSum);

                        a.x -= nx * moveA;
                        a.y -= ny * moveA;
                        b.x += nx * moveB;
                        b.y += ny * moveB;
                    }

                    // Remove parte da velocidade relativa que fecha as células uma na outra.
                    const relativeSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                    if (relativeSpeed < 0) {
                        const restitution = blockedByCooldown ? 0.03 : 0.06;
                        const impulse = (-(1 + restitution) * relativeSpeed) / invMassSum;

                        a.vx -= nx * impulse * invMassA;
                        a.vy -= ny * impulse * invMassA;
                        b.vx += nx * impulse * invMassB;
                        b.vy += ny * impulse * invMassB;
                    }
                }
            }
        }
    }

    getCenter() {
        if (this.cells.length === 0) {
            return { x: 0, y: 0 };
        }

        let weightedX = 0;
        let weightedY = 0;
        let totalWeight = 0;

        for (const cell of this.cells) {
            const weight = cell.radius * cell.radius;
            weightedX += cell.x * weight;
            weightedY += cell.y * weight;
            totalWeight += weight;
        }

        return {
            x: weightedX / totalWeight,
            y: weightedY / totalWeight
        };
    }

    getCellById(id) {
        return this.cells.find((cell) => cell.id === id) || null;
    }
}