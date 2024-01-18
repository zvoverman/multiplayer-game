class Player {
	constructor({ x, y, width, height, color }) {
		this.x = x
		this.y = y
		this.color = color
		//this.username = username

		this.width = width,
		this.height = height
	}

	draw() {
		c.beginPath()
		c.fillStyle = this.color
		c.fillRect(this.x, this.y, this.width, this.height)
		c.restore()
	}
}
