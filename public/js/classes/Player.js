class Player {
    constructor({ x, y, width, height, character_number }) {
        // constructor parameters
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.character_number = character_number;

        // initialize other variables
        this.dx = 0;
        this.dy = 0;
        this.gravity = 0;
        this.timestamp = 0;
        this.sequenceNumber = 0;
        this.canJump = false;
        this.flipX = 0;

        // Default last direction to right
        this.lastDirection = 1; // 1 for right, -1 for left

        this.playerSides = {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height,
        };

        this.image = new Image();
        this.image.src = "../../../assets/Luchadores.png";
    }

    // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    // source image - destination canvas
    draw() {
        c.save();

        // Determine direction based on movement or last direction
        if (this.dx > 0) {
            this.lastDirection = 1;
        } else if (this.dx < 0) {
            this.lastDirection = -1;
        }

        // Flip image calculation based on last direction
        if (this.lastDirection > 0) {
            c.scale(1, 1);
            this.flipX = this.x;
        } else {
            c.scale(-1, 1);
            this.flipX = -this.x - this.width;
        }

        // Draw the image
        c.drawImage(this.image, this.character_number, 0, this.width, this.height, this.flipX, this.y, this.width, this.height);
        c.restore();
    }
}
