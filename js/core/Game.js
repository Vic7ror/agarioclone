import { Player } from '../entities/player.js';
import { Food } from '../entities/food.js';
import { EjectMass } from '../entities/ejectMass.js';
import { GridSystem } from '../utils/GridSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { Virus } from '../entities/virus.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        this.worldWidth = 10000;
        this.worldHeight = 10000;

        this.uiManager = new UIManager();
        this.gridSystem = new GridSystem(this.ctx);
        this.player = new Player(this.worldWidth / 2, this.worldHeight / 2);
        this.bots = [];
        this.botSpawnCounter = 1;
        this.botTargetCount = 60;
        this.foodTargetCount = 8000;
        this.foods = [];
        this.ejectMasses = [];
        this.viruses = [];
        this.virusTargetCount = 20;
        this.fpsValue = document.getElementById('fpsValue');
        this.massValue = document.getElementById('massValue');
        this.cellsValue = document.getElementById('cellsValue');
        this.gridValue = document.getElementById('gridValue');
        this.leaderboardList = document.getElementById('leaderboardList');
        this.mousePosition = {
            x: this.worldWidth / 2,
            y: this.worldHeight / 2
        };
        this.mouseScreen = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2
        };
        this.camera = {
            x: this.player.x,
            y: this.player.y,
            zoom: 1,
            targetZoom: 1,
            maxZoom: 2.2,
            followCellId: null,
            followTimer: 0
        };
        this.theme = 'light';
        this.cameraBeforePause = null;
        this.lastFrameTime = null;
        this.currentFps = 0;
        this.isEjecting = false;
        this.ejectCooldownTimer = 0;
        this.ejectInterval = 0.078;
        this.showBackgroundGrid = true;
        this.showSquareGrid = true;
        this.defaultGameZoom = 1.6;
        
        this.setupCanvas();
        this.initializeFoods();
        this.initializeViruses();
        this.initializeBots();
        this.setupEventListeners();

        this.centerCameraOnMap();
        this.renderScene();
        
        this.gameStarted = false;
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.camera) {
            this.camera.zoom = Math.max(this.getMinZoom(), this.camera.zoom);
            this.camera.targetZoom = Math.max(this.getMinZoom(), this.camera.targetZoom);
        }
    }

    getMinZoom() {
        return Math.max(
            this.canvas.width / this.worldWidth,
            this.canvas.height / this.worldHeight
        );
    }
    
    setupEventListeners() {
        this.uiManager.setupEventListeners(this);

        this.canvas.addEventListener('mousemove', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseScreen.x = event.clientX - rect.left;
            this.mouseScreen.y = event.clientY - rect.top;
        });

        this.canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            const zoomFactor = Math.exp(-event.deltaY * 0.0015);
            this.camera.targetZoom = Math.min(
                this.camera.maxZoom,
                Math.max(this.getMinZoom(), this.camera.targetZoom * zoomFactor)
            );
        }, { passive: false });
    
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() !== 'w') return;
            this.isEjecting = true;
            if (!event.repeat) {
                this.ejectMassFromPlayer();
                this.ejectCooldownTimer = this.ejectInterval;
            }
        });

        document.addEventListener('keyup', (event) => {
            if (event.key.toLowerCase() !== 'w') return;
            this.isEjecting = false;
        });
    }
    startGame() {
        if (this.gameStarted) return;

        if (this.player.cells.length === 0) {
            this.respawnPlayer();
        }

        if (this.cameraBeforePause) {
            this.camera.x = this.cameraBeforePause.x;
            this.camera.y = this.cameraBeforePause.y;
            this.camera.followCellId = this.cameraBeforePause.followCellId;
            this.camera.followTimer = this.cameraBeforePause.followTimer;
            this.cameraBeforePause = null;

            // Restaura zoom padrão ao voltar do pause
            this.camera.zoom = this.defaultGameZoom;
            this.camera.targetZoom = this.defaultGameZoom;

            // Evita salto ao voltar do pause: neutraliza o alvo do mouse no primeiro frame.
            this.mouseScreen.x = this.canvas.width / 2;
            this.mouseScreen.y = this.canvas.height / 2;
            this.mousePosition.x = this.player.x;
            this.mousePosition.y = this.player.y;
        } else {
            // Primeira entrada: aplica zoom padrão
            this.camera.zoom = this.defaultGameZoom;
            this.camera.targetZoom = this.defaultGameZoom;
        }

        this.player.name = this.uiManager.getPlayerName();
        this.player.showMassInCell = this.uiManager.shouldShowMassInCell();
        this.uiManager.hideMenu();
        this.uiManager.hideLoading();
        this.gameStarted = true;
        this.lastFrameTime = null;
        requestAnimationFrame((time) => this.animate(time));
    }
    
    pauseGame() {
        this.cameraBeforePause = {
            x: this.camera.x,
            y: this.camera.y,
            zoom: this.camera.zoom,
            targetZoom: this.camera.targetZoom,
            followCellId: this.camera.followCellId,
            followTimer: this.camera.followTimer
        };

        this.isEjecting = false;
        this.uiManager.showMenu();
        this.centerCameraOnMap();
        this.gameStarted = false;
        this.lastFrameTime = null;
        this.renderScene();
    }

    centerCameraOnMap() {
        this.camera.x = this.worldWidth / 2;
        this.camera.y = this.worldHeight / 2;
    }

    setTheme(theme) {
        this.theme = theme === 'dark' ? 'dark' : 'light';
        document.body.classList.toggle('dark-theme', this.theme === 'dark');
        this.gridSystem.setTheme(this.theme);
    }

    setBackgroundGridEnabled(enabled) {
        this.showBackgroundGrid = enabled !== false;
    }

    setSquareGridEnabled(enabled) {
        this.showSquareGrid = enabled !== false;
    }
    
    ejectMassFromPlayer() {
        if (!this.gameStarted || this.player.cells.length === 0) return;

        const minCellMassToEject = 600;
        const minCellMassAfterEject = 400;
        const ejectMassAmount = 200;

        for (const cell of this.player.cells) {
            // Só ejeta quando dá para retirar massa fixa e manter segurança.
            if (cell.mass < minCellMassToEject) {
                continue;
            }

            // Evita massa negativa/NaN em células menores quando a ejeção escala com massa total.
            const maxSafeEject = cell.mass - minCellMassAfterEject;
            if (maxSafeEject <= 0) {
                continue;
            }

            const actualEjectMass = ejectMassAmount;

            // Direção em relação ao mouse
            const dx = this.mousePosition.x - cell.x;
            const dy = this.mousePosition.y - cell.y;
            const distance = Math.hypot(dx, dy) || 1;
            const dirX = dx / distance;
            const dirY = dy / distance;

            // Reduzir massa da célula
            cell.mass -= actualEjectMass;
            cell.targetRadius = this.player.massToRadius(cell.mass);

            // Sem recuo da célula ao ejetar.

            // Tamanho visual padronizado pela mesma relação massa-raio do jogo.
            const ejectRadius = this.player.massToRadius(actualEjectMass);

            // Criar e lançar massa
            const ejectX = cell.x + dirX * (cell.radius + ejectRadius + 1.5);
            const ejectY = cell.y + dirY * (cell.radius + ejectRadius + 1.5);
            const ejectVx = dirX * 1200;
            const ejectVy = dirY * 1200;

            this.ejectMasses.push(
                new EjectMass(ejectX, ejectY, ejectVx, ejectVy, actualEjectMass, this.player.color, ejectRadius, {
                    drag: 0.915,
                    wallBounce: 0.85,
                    pickupDelay: 0.12
                })
            );
        }
    }

    splitPlayer() {
        if (!this.gameStarted) return;

        const launchedCell = this.player.split(this.mousePosition.x, this.mousePosition.y);
        if (!launchedCell) return;

        // Mantém câmera estável no centro do player, sem focar célula lançada.
        this.camera.followCellId = null;
        this.camera.followTimer = 0;
    }
    
    clearCanvas() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = this.theme === 'dark' ? '#03060d' : '#d1d5db';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawWorldBackground() {
        this.ctx.fillStyle = this.theme === 'dark' ? '#070d19' : '#ffffff';
        this.ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
    }

    initializeFoods() {
        this.foods = [];

        for (let i = 0; i < this.foodTargetCount; i++) {
            this.foods.push(this.createRandomFood());
        }
    }

    createRandomFood() {
        const type = Food.getRandomType();
        const x = this.randomInRange(type.radius, this.worldWidth - type.radius);
        const y = this.randomInRange(type.radius, this.worldHeight - type.radius);

        return new Food(x, y, type, Food.getRandomColor());
    }

    initializeBots() {
        this.bots = [];
        for (let i = 0; i < this.botTargetCount; i++) {
            this.bots.push(this.createBot());
        }
    }

    createBot() {
        const x = this.randomInRange(300, this.worldWidth - 300);
        const y = this.randomInRange(300, this.worldHeight - 300);
        const bot = new Player(x, y);
        const spawnMass = Math.round(this.randomInRange(400, 10000));
        const spawnRadius = bot.massToRadius(spawnMass);
        const mainCell = bot.cells[0];
        mainCell.mass = spawnMass;
        mainCell.radius = spawnRadius;
        mainCell.targetRadius = spawnRadius;
        bot.name = `Bot ${this.botSpawnCounter++}`;
        bot.color = this.getRandomBotColor();
        bot.speed = 260;
        bot.showMassInCell = false;
        bot.ai = {
            targetX: x,
            targetY: y,
            retargetTimer: 0
        };
        return bot;
    }

    getRandomBotColor() {
        const colors = ['#60a5fa', '#f59e0b', '#34d399', '#a78bfa', '#f472b6', '#22d3ee'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    randomInRange(min, max) {
        return min + Math.random() * (max - min);
    }

    drawFoods() {
        for (const food of this.foods) {
            food.draw(this.ctx);
        }
    }

    drawActorBlobConnections(actor) {
        if (!actor || !actor.cells || actor.cells.length <= 1) return;
        for (let i = 0; i < actor.cells.length; i++) {
            for (let j = i + 1; j < actor.cells.length; j++) {
                actor.drawBlobConnection(this.ctx, actor.cells[i], actor.cells[j]);
            }
        }
    }

    drawActorCell(actor, cell) {
        const isMergingSmaller = cell.merging && cell.mergeProgress > 0 &&
            cell.mergePartner && cell.radius <= cell.mergePartner.radius;

        if (isMergingSmaller) {
            const partner = cell.mergePartner;
            const dist = Math.hypot(partner.x - cell.x, partner.y - cell.y);
            if (dist + cell.radius <= partner.radius) return;
        }

        const drawRadius = cell.radius;
        const borderWidth = Math.max(2, drawRadius * 0.032);

        const grad = this.ctx.createRadialGradient(
            cell.x - drawRadius * 0.18, cell.y - drawRadius * 0.18, 0,
            cell.x, cell.y, drawRadius
        );
        grad.addColorStop(0, actor.lightenColor(actor.color, 0.12));
        grad.addColorStop(0.72, actor.color);
        grad.addColorStop(1, actor.darkenColor(actor.color, 0.18));
        this.ctx.beginPath();
        this.ctx.arc(cell.x, cell.y, drawRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(cell.x, cell.y, drawRadius - borderWidth * 0.5, 0, Math.PI * 2);
        this.ctx.strokeStyle = actor.darkenColor(actor.color, 0.22);
        this.ctx.lineWidth = borderWidth;
        this.ctx.stroke();

        if (actor.name && !isMergingSmaller) {
            const fontSize = Math.max(10, drawRadius * 0.4);
            const hasMassLabel = actor.showMassInCell;
            const nameY = hasMassLabel ? cell.y - fontSize * 0.3 : cell.y;
            this.ctx.font = `bold ${fontSize}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.lineWidth = Math.max(1.5, fontSize * 0.14);
            this.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
            this.ctx.strokeText(actor.name, cell.x, nameY);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(actor.name, cell.x, nameY);

            if (hasMassLabel) {
                const massFontSize = Math.max(8, fontSize * 0.52);
                const massText = Math.round(cell.mass).toString();
                const massY = cell.y + fontSize * 0.52;
                this.ctx.font = `bold ${massFontSize}px Arial`;
                this.ctx.lineWidth = Math.max(1, massFontSize * 0.14);
                this.ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                this.ctx.strokeText(massText, cell.x, massY);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText(massText, cell.x, massY);
            }
        }
    }

    drawPlayersAndBotsBySize() {
        const actors = [...this.bots, this.player].filter(actor => actor && actor.cells.length > 0);

        for (const actor of actors) {
            this.drawActorBlobConnections(actor);
        }

        const allCells = [];
        for (const actor of actors) {
            for (const cell of actor.cells) {
                allCells.push({ actor, cell });
            }
        }

        allCells.sort((a, b) => a.cell.radius - b.cell.radius);
        for (const entry of allCells) {
            this.drawActorCell(entry.actor, entry.cell);
        }
    }

    handleFoodCollisions() {
        for (let i = 0; i < this.foods.length; i++) {
            const food = this.foods[i];

            for (const cell of this.player.cells) {
                const dx = food.x - cell.x;
                const dy = food.y - cell.y;
                const distance = Math.hypot(dx, dy);
                const canEat = distance <= cell.radius + food.radius * 0.4;

                if (!canEat) continue;

                this.player.absorbMass(cell, food.mass, food.radius);
                this.foods[i] = this.createRandomFood();
                break;
            }
        }
    }

    handleEjectMassCollisions() {
        for (let i = this.ejectMasses.length - 1; i >= 0; i--) {
            const ejectMass = this.ejectMasses[i];
            if (!ejectMass.canBeAbsorbed()) continue;

            let bestCell = null;
            let bestOwner = null;
            let bestEdgeDistanceNow = Infinity;
            let bestEdgeDistanceSwept = Infinity;
            let bestT = Infinity;

            const x1 = typeof ejectMass.prevX === 'number' ? ejectMass.prevX : ejectMass.x;
            const y1 = typeof ejectMass.prevY === 'number' ? ejectMass.prevY : ejectMass.y;
            const x2 = ejectMass.x;
            const y2 = ejectMass.y;
            const segDx = x2 - x1;
            const segDy = y2 - y1;
            const segLenSq = segDx * segDx + segDy * segDy;
            const travelDist = Math.sqrt(segLenSq);
            const absorbRadius = ejectMass.radius * 0.4 + Math.min(16, travelDist * 0.45);
            const closeCatchRadius = absorbRadius + 10;
            const potentialOwners = [this.player, ...this.bots];

            for (const owner of potentialOwners) {
                for (const cell of owner.cells) {
                    let t = 1;
                    if (segLenSq > 0.000001) {
                        const proj = ((cell.x - x1) * segDx + (cell.y - y1) * segDy) / segLenSq;
                        t = Math.max(0, Math.min(1, proj));
                    }

                    const closestX = x1 + segDx * t;
                    const closestY = y1 + segDy * t;
                    const dx = closestX - cell.x;
                    const dy = closestY - cell.y;
                    const distance = Math.hypot(dx, dy);
                    const canEatSwept = distance <= cell.radius + absorbRadius;

                    const nowDx = x2 - cell.x;
                    const nowDy = y2 - cell.y;
                    const nowDistance = Math.hypot(nowDx, nowDy);
                    const canEatNowClose = nowDistance <= cell.radius + closeCatchRadius;

                    if (!canEatSwept && !canEatNowClose) continue;

                    // Prioriza a célula mais próxima no frame atual.
                    const edgeDistanceNow = nowDistance - cell.radius;
                    const edgeDistanceSwept = distance - cell.radius;
                    if (
                        edgeDistanceNow < bestEdgeDistanceNow - 0.001 ||
                        (Math.abs(edgeDistanceNow - bestEdgeDistanceNow) < 0.001 && edgeDistanceSwept < bestEdgeDistanceSwept - 0.001) ||
                        (Math.abs(edgeDistanceNow - bestEdgeDistanceNow) < 0.001 && Math.abs(edgeDistanceSwept - bestEdgeDistanceSwept) < 0.001 && t < bestT)
                    ) {
                        bestEdgeDistanceNow = edgeDistanceNow;
                        bestEdgeDistanceSwept = edgeDistanceSwept;
                        bestT = t;
                        bestCell = cell;
                        bestOwner = owner;
                    }
                }
            }

            if (!bestCell || !bestOwner) continue;

            bestOwner.absorbMass(bestCell, ejectMass.mass);
            this.ejectMasses.splice(i, 1);
        }
    }

    updateBots(deltaTime) {
        const playerCenter = this.player.getCenter();
        const chaseDistance = 2200;
        const playerLargestRadius = this.player.cells.reduce((max, c) => Math.max(max, c.radius), 0);
        const playerIsSplit = this.player.cells.length > 1;

        for (const bot of this.bots) {
            const botCenter = bot.getCenter();
            const toPlayerX = playerCenter.x - botCenter.x;
            const toPlayerY = playerCenter.y - botCenter.y;
            const distToPlayer = Math.hypot(toPlayerX, toPlayerY);
            const botLargestRadius = bot.cells.reduce((max, c) => Math.max(max, c.radius), 0);
            const botCanEatPlayer = botLargestRadius >= playerLargestRadius * 1.15;
            let targetCell = null;

            if (playerIsSplit) {
                let bestDist = Infinity;
                for (const pCell of this.player.cells) {
                    // Quando o jogador está dividido, prioriza células menores que o bot.
                    if (pCell.radius >= botLargestRadius) continue;
                    const d = Math.hypot(pCell.x - botCenter.x, pCell.y - botCenter.y);
                    if (d < bestDist) {
                        bestDist = d;
                        targetCell = pCell;
                    }
                }
            }

            if (targetCell && distToPlayer <= chaseDistance * 1.2) {
                bot.ai.targetX = targetCell.x;
                bot.ai.targetY = targetCell.y;
                bot.ai.retargetTimer = 0;
            } else if (botCanEatPlayer && distToPlayer <= chaseDistance) {
                bot.ai.targetX = playerCenter.x;
                bot.ai.targetY = playerCenter.y;
                bot.ai.retargetTimer = 0;
            } else {
                bot.ai.retargetTimer -= deltaTime;
                const distToTarget = Math.hypot(bot.ai.targetX - botCenter.x, bot.ai.targetY - botCenter.y);
                if (bot.ai.retargetTimer <= 0 || distToTarget < 160) {
                    bot.ai.targetX = this.randomInRange(250, this.worldWidth - 250);
                    bot.ai.targetY = this.randomInRange(250, this.worldHeight - 250);
                    bot.ai.retargetTimer = this.randomInRange(1.6, 3.8);
                }
            }

            bot.update(bot.ai.targetX, bot.ai.targetY, deltaTime, this.worldWidth, this.worldHeight);
        }
    }

    canCellEatCell(eaterCell, targetCell) {
        if (!eaterCell || !targetCell) return false;
        if (eaterCell.mass <= targetCell.mass * 1.10) return false;

        const dist = Math.hypot(eaterCell.x - targetCell.x, eaterCell.y - targetCell.y);
        // Come quando a maior sobrepõe mais de 40% da menor.
        return dist + targetCell.radius * 0.4 <= eaterCell.radius;
    }

    resolveActorVsActorEating(actorA, actorB) {
        const removeA = new Set();
        const removeB = new Set();

        for (let i = 0; i < actorA.cells.length; i++) {
            if (removeA.has(i)) continue;
            const cellA = actorA.cells[i];

            for (let j = 0; j < actorB.cells.length; j++) {
                if (removeB.has(j)) continue;
                const cellB = actorB.cells[j];

                const aEatsB = this.canCellEatCell(cellA, cellB);
                const bEatsA = this.canCellEatCell(cellB, cellA);

                if (!aEatsB && !bEatsA) continue;

                if (aEatsB && (!bEatsA || cellA.mass >= cellB.mass)) {
                    actorA.absorbMass(cellA, cellB.mass, 0, true); // eatMode
                    removeB.add(j);
                    continue;
                }

                actorB.absorbMass(cellB, cellA.mass, 0, true); // eatMode
                removeA.add(i);
                break;
            }
        }

        if (removeA.size > 0) {
            actorA.cells = actorA.cells.filter((_, idx) => !removeA.has(idx));
        }
        if (removeB.size > 0) {
            actorB.cells = actorB.cells.filter((_, idx) => !removeB.has(idx));
        }
    }

    handlePlayerBotEatingCollisions() {
        for (const bot of this.bots) {
            this.resolveActorVsActorEating(this.player, bot);
        }
    }

    handleBotVsBotEatingCollisions() {
        for (let i = 0; i < this.bots.length; i++) {
            for (let j = i + 1; j < this.bots.length; j++) {
                this.resolveActorVsActorEating(this.bots[i], this.bots[j]);
            }
        }
    }

    cleanupAndRespawnBots() {
        this.bots = this.bots.filter(bot => bot.cells.length > 0);
        while (this.bots.length < this.botTargetCount) {
            this.bots.push(this.createBot());
        }
    }

    getSafeRespawnPosition() {
        const margin = 500;
        const minDistanceFromBots = 900;
        const maxAttempts = 35;

        for (let i = 0; i < maxAttempts; i++) {
            const x = this.randomInRange(margin, this.worldWidth - margin);
            const y = this.randomInRange(margin, this.worldHeight - margin);

            let safe = true;
            for (const bot of this.bots) {
                for (const cell of bot.cells) {
                    const dist = Math.hypot(cell.x - x, cell.y - y);
                    if (dist < minDistanceFromBots + cell.radius) {
                        safe = false;
                        break;
                    }
                }
                if (!safe) break;
            }

            if (safe) {
                return { x, y };
            }
        }

        return {
            x: this.worldWidth / 2,
            y: this.worldHeight / 2
        };
    }

    respawnPlayer() {
        const previousName = this.player.name;
        const previousColor = this.player.color;
        const previousShowMass = this.player.showMassInCell;

        const respawnPos = this.getSafeRespawnPosition();
        this.player = new Player(respawnPos.x, respawnPos.y);
        this.player.name = previousName;
        this.player.color = previousColor;
        this.player.showMassInCell = previousShowMass;

        this.camera.followCellId = null;
        this.camera.followTimer = 0;
    }

    handlePlayerDeath() {
        if (this.player.cells.length > 0) return false;

        this.pauseGame();
        return true;
    }
    
    animate(currentTime = 0) {
        if (!this.gameStarted) return;

        if (this.lastFrameTime === null) {
            this.lastFrameTime = currentTime;
        }

        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;

        if (deltaTime > 0) {
            const instantFps = 1 / deltaTime;
            this.currentFps = this.currentFps === 0
                ? instantFps
                : this.currentFps * 0.9 + instantFps * 0.1;
        }

        const worldMouse = this.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
        this.mousePosition.x = worldMouse.x;
        this.mousePosition.y = worldMouse.y;

        this.player.update(
            this.mousePosition.x,
            this.mousePosition.y,
            deltaTime,
            this.worldWidth,
            this.worldHeight
        );
        this.updateBots(deltaTime);

        if (this.isEjecting) {
            this.ejectCooldownTimer = Math.max(0, this.ejectCooldownTimer - deltaTime);
            if (this.ejectCooldownTimer <= 0) {
                this.ejectMassFromPlayer();
                this.ejectCooldownTimer = this.ejectInterval;
            }
        } else {
            this.ejectCooldownTimer = 0;
        }

        // Atualizar massas ejetadas
        this.ejectMasses = this.ejectMasses.filter(m => !m.isExpired());
        for (const ejectMass of this.ejectMasses) {
            ejectMass.update(deltaTime, this.worldWidth, this.worldHeight);
        }

        for (const virus of this.viruses) {
            virus.update(deltaTime, this.worldWidth, this.worldHeight);
        }

        this.updateCamera(deltaTime);
        this.handleFoodCollisions();
        this.handleEjectMassVirusCollisions();
        this.handleEjectMassCollisions();
        this.handleVirusCollisions();
        this.handleBotVirusCollisions();
        this.handlePlayerBotEatingCollisions();
        this.handleBotVsBotEatingCollisions();
        this.cleanupAndRespawnBots();
        if (this.handlePlayerDeath()) {
            return;
        }
        this.renderScene();

        requestAnimationFrame((time) => this.animate(time));
    }

    renderScene() {
        this.clearCanvas();
        this.ctx.setTransform(
            this.camera.zoom,
            0,
            0,
            this.camera.zoom,
            this.canvas.width / 2 - this.camera.x * this.camera.zoom,
            this.canvas.height / 2 - this.camera.y * this.camera.zoom
        );

        this.drawWorldBackground();
        if (this.showSquareGrid) {
            this.gridSystem.drawBackgroundGrid(this.worldWidth, this.worldHeight);
        }
        if (this.showBackgroundGrid) {
            this.gridSystem.drawGrid(this.worldWidth, this.worldHeight);
        }
        this.drawFoods();

        const virusesBelowPlayer = [];
        const virusesAbovePlayer = [];
        for (const virus of this.viruses) {
            let shouldDrawAbove = false;
            let overlapsLargerCell = false;
            for (const cell of this.player.cells) {
                const dist = Math.hypot(cell.x - virus.x, cell.y - virus.y);
                const isOverlapping = dist < cell.radius + virus.radius;
                if (!isOverlapping) continue;

                // Se sobrepõe qualquer célula maior, nunca desenha por cima.
                if (cell.radius > virus.radius * 1.1) {
                    overlapsLargerCell = true;
                    shouldDrawAbove = false;
                    break;
                }

                // Só desenha por cima quando está sobrepondo apenas células menores.
                if (cell.radius <= virus.radius * 1.1) {
                    shouldDrawAbove = true;
                }
            }

            if (shouldDrawAbove && !overlapsLargerCell) {
                virusesAbovePlayer.push(virus);
            } else {
                virusesBelowPlayer.push(virus);
            }
        }

        for (const virus of virusesBelowPlayer) {
            virus.draw(this.ctx);
        }

        for (const ejectMass of this.ejectMasses) {
            ejectMass.draw(this.ctx, this.player.showMassInCell);
        }
        this.drawPlayersAndBotsBySize();

        // Só sobrepõe visualmente quando a célula do jogador for menor.
        for (const virus of virusesAbovePlayer) {
            virus.draw(this.ctx);
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        this.updateHud();
        this.updateLeaderboard();
        this.drawMinimap();

    }

    initializeViruses() {
        this.viruses = [];
        for (let i = 0; i < this.virusTargetCount; i++) {
            this.viruses.push(this.createRandomVirus());
        }
    }

    createRandomVirus() {
        const v = new Virus(
            this.randomInRange(200, this.worldWidth - 200),
            this.randomInRange(200, this.worldHeight - 200)
        );
        return v;
    }

    handleVirusCollisions() {
        const usedViruses = new Set();
        for (const cell of this.player.cells) {
            for (let j = 0; j < this.viruses.length; j++) {
                if (usedViruses.has(j)) continue;
                const virus = this.viruses[j];
                const minMassToExplode = virus.mass + 200;
                if (cell.mass < minMassToExplode) continue;
                // Se for menor (ou quase do mesmo tamanho), só sobrepõe e passa por dentro.
                if (cell.radius <= virus.radius * 1.1) continue;
                const dist = Math.hypot(cell.x - virus.x, cell.y - virus.y);
                // Explode quando pelo menos 60% do vírus estiver sobreposto.
                if (dist + virus.radius * 0.6 > cell.radius) continue;
                usedViruses.add(j);
                const didSplit = this.player.virusSplit(cell);
                if (!didSplit) {
                    // No limite de divisão, o vírus é comido e vira massa.
                    this.player.absorbMass(cell, virus.mass);
                }
                // Limita apenas o respawn aleatório: mantém população base, mas
                // acima disso os vírus consumidos não renascem aleatoriamente.
                if (this.viruses.length <= this.virusTargetCount) {
                    this.viruses[j] = this.createRandomVirus();
                } else {
                    this.viruses.splice(j, 1);
                }
                break;
            }
        }
    }

    handleBotVirusCollisions() {
        const usedViruses = new Set();

        for (const bot of this.bots) {
            for (const cell of bot.cells) {
                for (let j = 0; j < this.viruses.length; j++) {
                    if (usedViruses.has(j)) continue;

                    const virus = this.viruses[j];
                    const minMassToExplode = virus.mass + 200;
                    if (cell.mass < minMassToExplode) continue;
                    if (cell.radius <= virus.radius * 1.1) continue;

                    const dist = Math.hypot(cell.x - virus.x, cell.y - virus.y);
                    if (dist + virus.radius * 0.6 > cell.radius) continue;

                    usedViruses.add(j);
                    const didSplit = bot.virusSplit(cell);
                    if (!didSplit) {
                        bot.absorbMass(cell, virus.mass);
                    }

                    if (this.viruses.length <= this.virusTargetCount) {
                        this.viruses[j] = this.createRandomVirus();
                    } else {
                        this.viruses.splice(j, 1);
                    }
                    break;
                }
            }
        }
    }

    handleEjectMassVirusCollisions() {
        for (let i = this.ejectMasses.length - 1; i >= 0; i--) {
            const eject = this.ejectMasses[i];
            for (let j = 0; j < this.viruses.length; j++) {
                const virus = this.viruses[j];
                const dist = Math.hypot(eject.x - virus.x, eject.y - virus.y);
                if (dist > virus.radius + eject.radius) continue;

                // Direção do disparo: usa o vetor da massa ejetada para manter
                // o lançamento do novo vírus alinhado com o tiro do jogador.
                const shotLen = Math.hypot(eject.vx, eject.vy) || 1;
                const dirX = eject.vx / shotLen;
                const dirY = eject.vy / shotLen;
                this.ejectMasses.splice(i, 1);

                const offspring = new Virus(
                    virus.x + dirX * (virus.radius + 4),
                    virus.y + dirY * (virus.radius + 4)
                );
                offspring.vx = dirX * 900;
                offspring.vy = dirY * 900;
                this.viruses.push(offspring);
                break;
            }
        }
    }

    updateCamera(deltaTime) {
        const minZoom = this.getMinZoom();
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * Math.min(1, deltaTime * 10);
        this.camera.zoom = Math.max(minZoom, this.camera.zoom);

        if (this.camera.followTimer > 0) {
            this.camera.followTimer -= deltaTime;
        }

        let targetX = this.player.x;
        let targetY = this.player.y;

        if (this.camera.followCellId && this.camera.followTimer > 0) {
            const focusCell = this.player.getCellById(this.camera.followCellId);
            if (focusCell) {
                targetX = focusCell.x;
                targetY = focusCell.y;
            } else {
                this.camera.followCellId = null;
                this.camera.followTimer = 0;
            }
        } else {
            this.camera.followCellId = null;
        }

        this.camera.x = targetX;
        this.camera.y = targetY;
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x,
            y: (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y
        };
    }

    updateHud() {
        if (!this.fpsValue || !this.massValue || !this.cellsValue || !this.gridValue) return;

        this.fpsValue.textContent = Math.round(this.currentFps).toString();
        this.massValue.textContent = this.player.getMass().toString();
        this.cellsValue.textContent = this.player.cells.length.toString();
        this.gridValue.textContent = this.gridSystem.getCoordinateLabel(
            this.player.x,
            this.player.y,
            this.worldWidth,
            this.worldHeight
        );
    }

    updateLeaderboard() {
        if (!this.leaderboardList) return;

        const actors = [
            {
                name: this.player.name || 'Célula',
                mass: this.player.getMass(),
                isPlayer: true
            },
            ...this.bots.map(bot => ({
                name: bot.name || 'Bot',
                mass: bot.getMass(),
                isPlayer: false
            }))
        ];

        const topEntries = actors
            .filter(actor => actor.mass > 0)
            .sort((a, b) => b.mass - a.mass)
            .slice(0, 10);

        this.leaderboardList.innerHTML = topEntries.map((entry, index) => `
            <div class="leaderboard-entry${entry.isPlayer ? ' is-player' : ''}">
                <span class="leaderboard-rank">${index + 1}.</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-mass">${entry.mass}</span>
            </div>
        `).join('');
    }

    drawMinimap() {
        if (!this.minimapCtx || !this.minimapCanvas) return;

        const mapWidth = this.minimapCanvas.width;
        const mapHeight = this.minimapCanvas.height;
        const cols = this.gridSystem.cols;
        const rows = this.gridSystem.rows;
        const cellWidth = mapWidth / cols;
        const cellHeight = mapHeight / rows;
        const dark = this.theme === 'dark';

        this.minimapCtx.clearRect(0, 0, mapWidth, mapHeight);
        this.minimapCtx.fillStyle = dark ? '#070d19' : '#eef2f7';
        this.minimapCtx.fillRect(0, 0, mapWidth, mapHeight);

        this.minimapCtx.font = 'bold 15px Arial';
        this.minimapCtx.textAlign = 'center';
        this.minimapCtx.textBaseline = 'middle';

        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
                const x = col * cellWidth;
                const y = row * cellHeight;

                this.minimapCtx.fillStyle = dark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(30, 41, 59, 0.07)';
                this.minimapCtx.fillRect(x, y, cellWidth, cellHeight);

                this.minimapCtx.fillStyle = dark ? 'rgba(226, 232, 240, 0.52)' : 'rgba(30, 41, 59, 0.5)';
                this.minimapCtx.fillText(
                    this.gridSystem.getCellLabel(col, row),
                    x + cellWidth / 2,
                    y + cellHeight / 2
                );
            }
        }

        this.minimapCtx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(15, 23, 42, 0.24)';
        this.minimapCtx.lineWidth = 1;
        for (let col = 0; col <= cols; col++) {
            const x = col * cellWidth;
            this.minimapCtx.beginPath();
            this.minimapCtx.moveTo(x, 0);
            this.minimapCtx.lineTo(x, mapHeight);
            this.minimapCtx.stroke();
        }

        for (let row = 0; row <= rows; row++) {
            const y = row * cellHeight;
            this.minimapCtx.beginPath();
            this.minimapCtx.moveTo(0, y);
            this.minimapCtx.lineTo(mapWidth, y);
            this.minimapCtx.stroke();
        }

        // Mostra todas as células do jogador no minimapa quando estiver dividido.
        this.minimapCtx.fillStyle = '#ef4444';
        this.minimapCtx.strokeStyle = '#ffffff';
        this.minimapCtx.lineWidth = 1;
        for (const pCell of this.player.cells) {
            const px = (pCell.x / this.worldWidth) * mapWidth;
            const py = (pCell.y / this.worldHeight) * mapHeight;
            const pr = Math.max(4.5, Math.min(11, (pCell.radius / this.worldWidth) * mapWidth * 4.4));
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(px, py, pr, 0, Math.PI * 2);
            this.minimapCtx.fill();
            this.minimapCtx.stroke();
        }
    }
}