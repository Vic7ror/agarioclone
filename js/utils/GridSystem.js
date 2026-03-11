export class GridSystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.cols = 5;
        this.rows = 5;
        this.theme = 'light';
    }

    setTheme(theme) {
        this.theme = theme === 'dark' ? 'dark' : 'light';
    }

    drawBackgroundGrid(width, height, cellSize = 48) {
        this.ctx.strokeStyle = this.theme === 'dark'
            ? 'rgba(148, 163, 184, 0.16)'
            : 'rgba(15, 23, 42, 0.12)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= width; x += cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= height; y += cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
    }
    
    drawGrid(width, height) {
        this.ctx.strokeStyle = this.theme === 'dark'
            ? 'rgba(148, 163, 184, 0.12)'
            : 'rgba(0, 0, 0, 0.2)';
        this.ctx.lineWidth = 1;
        
        const cols = this.cols;
        const rows = this.rows;
        const cellWidth = width / cols;
        const cellHeight = height / rows;
        
        for (let col = 0; col <= cols; col++) {
            const x = col * cellWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        
        for (let row = 0; row <= rows; row++) {
            const y = row * cellHeight;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        this.drawGridCoordinates(cols, rows, cellWidth, cellHeight);
    }

    getCoordinateLabel(x, y, width, height) {
        const cellWidth = width / this.cols;
        const cellHeight = height / this.rows;

        const col = Math.min(this.cols - 1, Math.max(0, Math.floor(x / cellWidth)));
        const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / cellHeight)));

        return this.getCellLabel(col, row);
    }

    getCellLabel(col, row) {
        const letterCode = 'A'.charCodeAt(0) + col;
        return `${String.fromCharCode(letterCode)}${row + 1}`;
    }
    
    drawGridCoordinates(cols, rows, cellWidth, cellHeight) {
        this.ctx.fillStyle = this.theme === 'dark'
            ? 'rgba(226, 232, 240, 0.42)'
            : 'rgba(0, 0, 0, 0.6)';
        const sectorFontSize = Math.max(28, Math.min(56, Math.min(cellWidth, cellHeight) * 0.34));
        this.ctx.font = `bold ${sectorFontSize}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
                const x = col * cellWidth + cellWidth / 2;
                const y = row * cellHeight + cellHeight / 2;
                const coord = this.getCellLabel(col, row);

                this.ctx.lineWidth = Math.max(2, sectorFontSize * 0.08);
                this.ctx.strokeStyle = this.theme === 'dark'
                    ? 'rgba(2, 6, 23, 0.55)'
                    : 'rgba(255, 255, 255, 0.72)';
                this.ctx.strokeText(coord, x, y);
                this.ctx.fillText(coord, x, y);
            }
        }
    }
}