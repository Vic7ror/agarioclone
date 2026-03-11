export class UIManager {
    constructor() {
        this.menuContainer = document.querySelector('.menu-container');
        this.gameContainer = document.querySelector('.game-container');
        this.playBtn = document.getElementById('playBtn');
        this.nameInput = document.getElementById('nameInput');
        this.themeToggle = document.getElementById('themeToggle');
        this.showMassInCellToggle = document.getElementById('showMassInCellToggle');
        this.backgroundGridToggle = document.getElementById('backgroundGridToggle');
        this.squareGridToggle = document.getElementById('squareGridToggle');
        this.respawnOverlay = document.getElementById('respawnOverlay');
        this.respawnTimerValue = document.getElementById('respawnTimerValue');
    }

    getPlayerName() {
        return this.nameInput.value.trim() || 'Célula';
    }

    getSelectedTheme() {
        return this.themeToggle?.checked ? 'dark' : 'light';
    }

    shouldShowMassInCell() {
        return !!this.showMassInCellToggle?.checked;
    }

    shouldShowBackgroundGrid() {
        return this.backgroundGridToggle?.checked !== false;
    }

    shouldShowSquareGrid() {
        return this.squareGridToggle?.checked !== false;
    }
    
    setupEventListeners(game) {
        this.playBtn.addEventListener('click', () => game.startGame());
        this.nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') game.startGame();
        });
        this.themeToggle?.addEventListener('change', () => {
            game.setTheme(this.getSelectedTheme());
        });
        this.backgroundGridToggle?.addEventListener('change', () => {
            game.setBackgroundGridEnabled(this.shouldShowBackgroundGrid());
        });
        this.squareGridToggle?.addEventListener('change', () => {
            game.setSquareGridEnabled(this.shouldShowSquareGrid());
        });

        game.setTheme(this.getSelectedTheme());
        game.setBackgroundGridEnabled(this.shouldShowBackgroundGrid());
        game.setSquareGridEnabled(this.shouldShowSquareGrid());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e, game));
    }
    
    handleKeyPress(e, game) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (this.menuContainer.style.display === 'none') {
                game.pauseGame();
            } else {
                game.startGame();
            }
            e.preventDefault();
            return;
        }

        if (e.code === 'Space') {
            if (e.repeat) return;
            game.splitPlayer();
            e.preventDefault();
        }
    }
    
    hideMenu() {
        this.menuContainer.style.display = 'none';
        this.gameContainer.style.display = 'block';
    }
    
    showMenu() {
        this.menuContainer.style.display = 'flex';
    }

    showRespawnCountdown(secondsRemaining) {
        if (!this.respawnOverlay || !this.respawnTimerValue) return;

        this.respawnTimerValue.textContent = Math.max(0, Math.ceil(secondsRemaining)).toString();
        this.respawnOverlay.classList.remove('hidden');
    }

    hideRespawnCountdown() {
        if (!this.respawnOverlay) return;

        this.respawnOverlay.classList.add('hidden');
    }
    
    hideLoading() {
        const loading = document.querySelector('.loading');
        loading.style.display = 'none';
    }
}