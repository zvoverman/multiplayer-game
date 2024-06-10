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
        this.character_number = 65 * Math.floor(Math.random() * 4)

        this.playerSides = {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height,
        };
    }

    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    // source image - destination canvas
    draw() {
        c.beginPath();
        // c.fillStyle = this.color;
        // c.fillRect(this.x, this.y, this.width, this.height);
        let drawing = new Image();
        drawing.src = "../../../assets/Luchadores.png"; // can also be a remote URL e.g. http://
        c.drawImage(drawing, this.character_number, 0, this.height, this.width, this.x, this.y, this.height, this.width);
        c.restore();
    }
}
