class Player {
	constructor({ x, y, width, height, color }) {
		this.x = x
		this.y = y
		this.width = width
		this.height = height

		this.color = color

		this.dx = 0
		this.dy = 0

		this.playerSides = {
			left: this.x,
			right: this.x + this.width,
			top: this.y,
			bottom: this.y + this.height
		}
	}

	draw() {
		c.beginPath()
		c.fillStyle = this.color
		c.fillRect(this.x, this.y, this.width, this.height)
		c.restore()
	}
}
