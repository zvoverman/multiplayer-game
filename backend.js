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
const MAX_HEALTH = 1;

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
		current_health: MAX_HEALTH,
		character_number: 65 * Math.floor(Math.random() * 4),
		server_timestamp: 0,
		time_since_input: 0,
		just_damaged: false,
		x_force: 0,
		y_force: 0
	};

	// cleanly remove player on socket disconnect
	socket.on('disconnect', (reason) => {
		console.log(reason);
		delete backEndPlayers[socket.id];
		io.emit('updatePlayers', backEndPlayers);
	});

	socket.on('sendInput', (input) => {
		inputQueue.push(input);
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
		if (input.event === 'Stop') {
			backEndPlayer.dx = 0;
		} else if (input.event === 'Run_Right') {
			backEndPlayer.dx = SPEED;
		} else if (input.event === 'Run_Left') {
			backEndPlayer.dx = -SPEED;
		} else if (input.event === 'Jump' && backEndPlayer.canJump == true) {
			backEndPlayer.canJump = false;
			backEndPlayer.dy = -JUMP_FORCE;
		} else if (input.event === 'Attack') {
			attack(input);
		}

		backEndPlayer.sequenceNumber = input.sequenceNumber;
		backEndPlayer.timestamp = input.timestamp; // client pressed input timestamp
		backEndPlayer.server_timestamp = now_ts;   // server received input timestamp
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

		if (backEndPlayer.just_damaged) {
			backEndPlayer.x_force = lerp(backEndPlayer.x_force, 0, 0.5)
		}

		// TODO: find a better way to deal with this
		if (backEndPlayer.server_timestamp !== 0)
			// if player has just been initialized, don't update time_since_input
			backEndPlayer.time_since_input = now_ts - backEndPlayer.server_timestamp;
	}
}

function attack(input) {
	const player = backEndPlayers[input.id];

	for (const id in backEndPlayers) {
		if (id == input.id) continue; // don't want to hit ourselves
		const enemy_player = backEndPlayers[id];
		if (check_collision(player.x, player.y, player.width, player.height, enemy_player.x, enemy_player.y, enemy_player.width, enemy_player.height)) {
			enemy_player.current_health--;
			enemy_player.just_damaged = true;

			if (enemy_player.current_health <= 0) {
				respawn(id);
				io.emit('respawnPlayer', id);
			}
		}
	}
}

// TODO: check for multiple collisions (currently returns true at first collision)
function check_collision(ax, ay, aw, ah, bx, by, bw, bh) {
	if (((ax >= bx && ax <= bx + bw) 
			|| (ax + aw >= bx && ax + aw <= bx + bw))
		&& ((ay >= by && ay <= by + bh)
			|| (ay + ah >= by && ay + ah <= by + bh))) {
		// objects are colliding
		return true;
	}
	else false;
}

function respawn(id) {
	backEndPlayers[id] = {
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
		current_health: MAX_HEALTH,
		character_number: 65 * Math.floor(Math.random() * 4),
		server_timestamp: 0,
		time_since_input: 0,
	};
}

function lerp(start, end, a) {
    return start + (end - start) * a;
}


server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`);
});
