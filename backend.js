const express = require('express')
const app = express()

// socket.io setup
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })

const port = 8080

app.use(express.static('public'))

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

let backEndPlayers = {}
const inputQueue = []

const SPEED = 500
const JUMP_FORCE = 1.0
const WIDTH = 64;
const HEIGHT = 128;
const GRAVITY_CONSTANT = 2000;

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
		timestamp: 0,
		gravity: 0,
		canJump: false,
		server_timestamp: 0,
		time_since_input: 0
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
		const delay = 200 //Math.floor(Math.random() * 200); // Maximum delay of 1 second
    	// console.log(`Simulating latency of ${delay} milliseconds for input: ${input.sequenceNumber}`);
    	setTimeout(() => {
			inputQueue.push(input)
    	}, delay);
		//console.log(input);
	})
})

// backend ticker
setInterval(() => {
	// Compute delta time since last update.
	var now_ts = performance.now();
	var last_ts = this.last_ts || now_ts;
	var delta_time = (now_ts - last_ts) / 1000.0;
	this.last_ts = now_ts;

	processInputs(now_ts) 

	physics(now_ts, delta_time) 

	io.emit('updatePlayers', backEndPlayers);

}, 15)

function processInputs(now_ts) {
	// Process all inputs in queue
	while (inputQueue.length != 0) {
		// TODO: Implement q as linked list to make O(n) -> O(1)
		let input = inputQueue.shift()

		const backEndPlayer = backEndPlayers[input.id]
		// let last_time = backEndPlayer.timestamp

		if (input.event === 'Run' || input.event === 'Stop') {
			backEndPlayer.dx = input.dx * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber
			backEndPlayer.timestamp = input.timestamp
		} else if (input.event === 'Jump' && backEndPlayer.canJump == true) {
			backEndPlayer.canJump = false
			backEndPlayer.dy = input.dy * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber
			backEndPlayer.timestamp = input.timestamp
		}

		backEndPlayer.server_timestamp = now_ts;

		// Deal with >2 inputs in a single loop iteration
		if (inputQueue.length >= 1) {
			let delta = (inputQueue[0].timestamp - backEndPlayer.timestamp) / 1000.0;
			move_player(backEndPlayer, delta)
		}
	}
}

function move_player(player, delta) {
	player.x += player.dx * delta;
	player.y += player.dy * delta * JUMP_FORCE;
}

function physics(now_ts, delta_time) {

	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id]

		// Player movement
		backEndPlayer.x += backEndPlayer.dx * delta_time
		// backEndPlayer.y += backEndPlayer.dy * delta_time * JUMP_FORCE

		// Is player on floor?
		if (backEndPlayer.y + backEndPlayer.height + (backEndPlayer.dy * delta_time) >= 576) {
			backEndPlayer.canJump = true
			backEndPlayer.dy = 0;
			backEndPlayer.y = 576 - backEndPlayer.height
			backEndPlayer.gravity = 0;
		} else {
			// TODO: What the fuck? Fix your physics
			backEndPlayer.dy += backEndPlayer.gravity * delta_time
			backEndPlayer.y += backEndPlayer.dy * delta_time
			backEndPlayer.gravity += GRAVITY_CONSTANT * delta_time
			//console.log("id: " + backEndPlayer.y + "gravity: " + backEndPlayer.gravity);
		}

		// backEndPlayer.timestamp = now_ts;
		// console.log(backEndPlayer.timestamp)
		backEndPlayer.time_since_input = now_ts - backEndPlayer.server_timestamp;
	}
}

function lerp(a, b, alpha) {
	if (a > b - 0.01 && a < b + 0.01) return b;
	return a + alpha * (b - a);
}

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`)
})