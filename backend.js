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

const SPEED = 500
const JUMP_FORCE = 20
const WIDTH = 64;
const HEIGHT = 128;
const GRAVITY_CONSTANT = 5

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
		color: "#black",
		sequenceNumber: 0,
		timeStamp: 0,
		gravity: 0
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

function applyInput(backEndPlayer, delta_time) {
	backEndPlayer.dx = lerp(backEndPlayer.dx, backEndPlayer.target_dx, 0.5)

	backEndPlayer.x += delta_time * backEndPlayer.dx
	backEndPlayer.y += delta_time * backEndPlayer.dy

	//console.log(backEndPlayer.x + ' ' + backEndPlayer.y)
}

// backend ticker
setInterval(() => {
	// Compute delta time since last update.
	var now_ts = +new Date()
	var last_ts = this.last_ts || now_ts;
	var dt_sec = (now_ts - last_ts) / 1000.0;
	this.last_ts = now_ts;

	// process inputs
	processInputs(dt_sec)

	// send world state
	io.emit('updatePlayers', backEndPlayers)
}, 15)

function processInputs(delta_time) {
	// Process all inputs in queue
	while (inputQueue.length != 0) {
		// TODO: Implement q as linked list to make O(n) -> O(1)
		let input = inputQueue.shift()

		const backEndPlayer = backEndPlayers[input.id]
		if (input.event === 'Run') {
			backEndPlayer.target_dx = input.dx * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber
			backEndPlayer.timeStamp = delta_time
		} else if (input.event === 'Jump') {
			backEndPlayer.dy = input.dy * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber
			backEndPlayer.timeStamp = delta_time
		} else if (input.event === 'Stop') {
			backEndPlayer.target_dx = input.dx * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber
			backEndPlayer.timeStamp = delta_time
		} 
	}

	// physics and collisions
	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id]

		// Move players according to velocitya
		applyInput(backEndPlayer, delta_time)

		if (backEndPlayer.y + backEndPlayer.height + (backEndPlayer.gravity * delta_time) > backEndPlayer.canvas.height) {
			backEndPlayer.dy = 0;
			backEndPlayer.y = backEndPlayer.canvas.height - backEndPlayer.height
			backEndPlayer.gravity = 0;
		} else {
			backEndPlayer.dy += backEndPlayer.gravity
			backEndPlayer.y += backEndPlayer.dy * delta_time
			backEndPlayer.y -= delta_time
			backEndPlayer.gravity += GRAVITY_CONSTANT
		}

		// console.log(backEndPlayer)
	}
}

function lerp(a, b, alpha) {
	if (a > b - 0.01 && a < b + 0.01) return b;
	return a + alpha * (b - a);
}

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`)
})