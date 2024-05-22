const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// socket.io server setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });
const port = 8080;

app.use(express.static('public'))

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html')
})

// player constants
const SPEED = 500
const JUMP_FORCE = 1.0
const WIDTH = 64;
const HEIGHT = 128;
const GRAVITY_CONSTANT = 2000;

let backEndPlayers = {};
let inputQueue = [];

// initialize backend player on socket connection
io.on('connection', (socket) => {
	console.log('a user connected: ' + socket.id);

	io.emit('updatePlayers', backEndPlayers);

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

	// initialize canvas
	backEndPlayers[socket.id].canvas = {
		width: 1024,
		height: 576
	}

	// cleanly remove player on socket disconnect
	socket.on('disconnect', (reason) => {
		console.log(reason);
		delete backEndPlayers[socket.id];
		io.emit('updatePlayers', backEndPlayers);
	})

	// TODO: make game work with variable network latency
	socket.on('sendInput', (input) => {
		// const delay = Math.floor(Math.random() * 200); // Maximum delay of 1 second
		const delay = 200;
    	// console.log(`Simulating latency of ${delay} milliseconds for input: ${input.sequenceNumber}`);
    	setTimeout(() => {
			inputQueue.push(input);
    	}, delay);
	})
})

// backend main game loop
setInterval(() => {
	// compute delta time since last update.
	var now_ts = performance.now();
	var last_ts = this.last_ts || now_ts;
	var delta_time = (now_ts - last_ts) / 1000.0;
	this.last_ts = now_ts;

	processInputs(now_ts); // process inputs that haven't been seen yet

	physics(now_ts, delta_time); // calculate backend state

	io.emit('updatePlayers', backEndPlayers); // send authoritative state to client

}, 15) // 60 fps

function processInputs(now_ts) {
	// process all inputs in queue
	while (inputQueue.length != 0) {
		let input = inputQueue.shift();
		const backEndPlayer = backEndPlayers[input.id];

		// filter input event type
		if (input.event === 'Run' || input.event === 'Stop') {
			backEndPlayer.dx = input.dx * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber;
			backEndPlayer.timestamp = input.timestamp;
		} else if (input.event === 'Jump' && backEndPlayer.canJump == true) {
			backEndPlayer.canJump = false;
			backEndPlayer.dy = input.dy * SPEED;
			backEndPlayer.sequenceNumber = input.sequenceNumber;
			backEndPlayer.timestamp = input.timestamp;
		}

		backEndPlayer.server_timestamp = now_ts;

		// deal with >2 inputs in a single loop iteration
		if (inputQueue.length >= 1) {
			let delta = (inputQueue[0].timestamp - backEndPlayer.timestamp) / 1000.0;
			move_player(backEndPlayer, delta);
		}
	}
}

// TODO: I really need to fix the physics and sync frontend and backend
function physics(now_ts, delta_time) {
	// process physics for every backend player
	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id];

		// Player movement
		// move_player(backEndPlayer, delta_time);
		backEndPlayer.x += backEndPlayer.dx * delta_time;
		// backEndPlayer.y += backEndPlayer.dy * delta_time * JUMP_FORCE

		if (backEndPlayer.y + backEndPlayer.height + (backEndPlayer.dy * delta_time) >= 576) {
			backEndPlayer.canJump = true;
			backEndPlayer.dy = 0;
			backEndPlayer.y = 576 - backEndPlayer.height;
			backEndPlayer.gravity = 0;
		} else {
			backEndPlayer.dy += backEndPlayer.gravity * JUMP_FORCE * delta_time;
			backEndPlayer.y += backEndPlayer.dy * delta_time;
			backEndPlayer.gravity += GRAVITY_CONSTANT * delta_time;
		}

		// TODO: find a better way to deal with this
		if (backEndPlayer.server_timestamp !== 0) // if player has just been initialized, don't update time_since_input
			backEndPlayer.time_since_input = now_ts - backEndPlayer.server_timestamp;
	}
}

function move_player(player, delta) {
	player.x += player.dx * delta;
	player.y += player.dy * delta;
}

function lerp(a, b, alpha) {
	if (a > b - 0.01 && a < b + 0.01) return b;
	return a + alpha * (b - a);
}

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`)
})