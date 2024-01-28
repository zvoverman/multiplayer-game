const express = require('express')
const app = express()

// socket.io setup
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })

const port = 7000

app.use(express.static('public'))

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

const backEndPlayers = {}
const inputQueue = []

const SPEED = 200
const JUMP_FORCE = 1.5
const WIDTH = 64;
const HEIGHT = 128;
const GRAVITY_CONSTANT = 150

io.on('connection', (socket) => {
	console.log('a user connected')

	io.emit('updatePlayers', backEndPlayers)

	backEndPlayers[socket.id] = {
		x: 1024 * Math.random(),
		y: 576 * Math.random(),
		dx: 0,
		dy: 0,
		target_dx: 0,
		target_dy: 0,
		width: WIDTH,
		height: HEIGHT,
		color: "rgba(0, 0, 255, 1)",
		sequenceNumber: 0,
		timeStamp: 0,
		gravity: 0,
		canJump: false
	}

	// where we init our canvas
	backEndPlayers[socket.id].canvas = {
		width: 1024,
		height: 576,
	}

	socket.on('disconnect', (reason) => {
		console.log(reason)
		delete backEndPlayers[socket.id]
		io.emit('updatePlayers', backEndPlayers)
	})

	socket.on('sendInput', (input) => {
		inputQueue.push(input)
	})
})

// backend ticker
setInterval(() => {

	processInputs() // delta_time is passed to 

	physics() // delta_time calculated within 

	io.emit('updatePlayers', backEndPlayers)

}, 15)

function processInputs() {
	// Process all inputs in queue
	while (inputQueue.length != 0) {
		// TODO: Implement q as linked list to make O(n) -> O(1)
		let input = inputQueue.shift()

		const backEndPlayer = backEndPlayers[input.id]
		if (input.event === 'Run' || input.event === 'Stop') {
			backEndPlayer.dx = input.dx * SPEED * input.delta_time
			backEndPlayer.sequenceNumber = input.sequenceNumber
		} else if (input.event === 'Jump' && backEndPlayer.canJump == true) {
			backEndPlayer.canJump = false
			backEndPlayer.dy = input.dy * SPEED * JUMP_FORCE * input.delta_time
			backEndPlayer.sequenceNumber = input.sequenceNumber
		}
	}
}

function physics() {
	// Compute delta time since last update.
	var now_ts = +new Date();
	var last_ts = this.last_ts || now_ts;
	var delta_time = (now_ts - last_ts) / 1000.0;
	this.last_ts = now_ts;

	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id]

		// Player movement
		backEndPlayer.x += backEndPlayer.dx * SPEED * delta_time
		backEndPlayer.y += backEndPlayer.dy * SPEED * delta_time

		// Is player on floor?
		if (backEndPlayer.y + backEndPlayer.height > backEndPlayer.canvas.height) {
			backEndPlayer.canJump = true
			backEndPlayer.dy = 0;
			backEndPlayer.y = backEndPlayer.canvas.height - backEndPlayer.height
			backEndPlayer.gravity = 0;
		} else {
			backEndPlayer.dy += backEndPlayer.gravity * delta_time
			backEndPlayer.y += backEndPlayer.dy * delta_time
			backEndPlayer.gravity += GRAVITY_CONSTANT * delta_time
		}
	}
}

function lerp(a, b, alpha) {
	if (a > b - 0.01 && a < b + 0.01) return b;
	return a + alpha * (b - a);
}

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`)
})