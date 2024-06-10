const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// socket.io server setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 });
const port = 8080;

app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/index.html');
});

// player constants
const SPEED = 500;
const JUMP_FORCE = 400;
const WIDTH = 64;
const HEIGHT = 64;
const GRAVITY_CONSTANT = 2000;

const CANVAS = {
	width: 1024,
	height: 576
}

let backEndPlayers = {};
let inputQueue = [];

// initialize backend player on socket connection
io.on('connection', (socket) => {
	console.log('a user connected: ' + socket.id);

	io.emit('updatePlayers', backEndPlayers);

	backEndPlayers[socket.id] = {
		x: CANVAS.width * Math.random(),
		y: CANVAS.height * Math.random(),
		dx: 0,
		dy: 0,
		target_dx: 0,
		target_dy: 0,
		width: WIDTH,
		height: HEIGHT,
		color: 'rgba(0, 0, 255, 1)',
		sequenceNumber: 0,
		timestamp: 0,
		gravity: 0,
		canJump: false,
		server_timestamp: 0,
		time_since_input: 0,
	};

	// cleanly remove player on socket disconnect
	socket.on('disconnect', (reason) => {
		console.log(reason);
		delete backEndPlayers[socket.id];
		io.emit('updatePlayers', backEndPlayers);
	});

	const FAKE_LAG = true;
	socket.on('sendInput', (input) => {
		// Simulate network latency for testing
		if (FAKE_LAG) {
			const delay = 200;
			setTimeout(() => {
				inputQueue.push(input);
			}, delay);
		} else {
			inputQueue.push(input);
		}
	});
});

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
}, 15); // 60 fps

function processInputs(now_ts) {
	// process all inputs in queue
	while (inputQueue.length != 0) {
		let input = inputQueue.shift();

		if (!input.event) return; // drop inputs that don't have an event

		const backEndPlayer = backEndPlayers[input.id];

		// filter input event type
		if (input.event === 'Run' || input.event === 'Stop') {
			backEndPlayer.dx = input.dx * SPEED;
		} else if (input.event === 'Jump' && backEndPlayer.canJump == true) {
			backEndPlayer.canJump = false;
			backEndPlayer.dy = input.dy * JUMP_FORCE;
		}

		backEndPlayer.sequenceNumber = input.sequenceNumber;
		backEndPlayer.timestamp = input.timestamp; // client pressed input timestamp
		backEndPlayer.server_timestamp = now_ts;   // server received input timestamp

		// deal with >2 inputs in a single loop iteration
		if (inputQueue.length >= 1) {
			let delta = (inputQueue[0].timestamp - backEndPlayer.timestamp) / 1000.0;
			move_player(backEndPlayer, delta);
		}
	}
}

function physics(now_ts, delta_time) {
	// process physics for every backend player
	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id];

		// Player movement
		backEndPlayer.x += backEndPlayer.dx * delta_time;

		// floor check
		if (backEndPlayer.y + backEndPlayer.height + backEndPlayer.dy * delta_time >= CANVAS.height) {
			backEndPlayer.canJump = true;
			backEndPlayer.dy = 0;
			backEndPlayer.y = CANVAS.height - backEndPlayer.height;
			backEndPlayer.gravity = 0;
		} else {
			backEndPlayer.dy += backEndPlayer.gravity * delta_time;
			backEndPlayer.y += backEndPlayer.dy * delta_time;
			backEndPlayer.gravity += GRAVITY_CONSTANT * delta_time;
		}

		// TODO: find a better way to deal with this
		if (backEndPlayer.server_timestamp !== 0)
			// if player has just been initialized, don't update time_since_input
			backEndPlayer.time_since_input = now_ts - backEndPlayer.server_timestamp;
	}
}

function move_player(player, timestep) {
	player.x += player.dx * timestep;
	player.y += player.dy * timestep;
}

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`);
});
