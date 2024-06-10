class Player {
    constructor({ x, y, width, height, color }) {
        // constructor parameters
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;

        // initialize other variables
        this.dx = 0;
        this.dy = 0;
        this.gravity = 0;
        this.timestamp = 0;
        this.sequenceNumber = 0;
        this.canJump = false;

        this.playerSides = {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height,
        };
    }

    draw() {
        c.beginPath();
        c.fillStyle = this.color;
        c.fillRect(this.x, this.y, this.width, this.height);
        c.restore();
    }
}
