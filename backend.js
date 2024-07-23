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
const SPEED = 600;
const JUMP_FORCE = 1000;
const GRAVITY_CONSTANT = 3000;
const MAX_HEALTH = 3;

// player dimensions
const WIDTH = 64;
const HEIGHT = 64;

// canvas dimensions
const CANVAS = {
	width: 1024,
	height: 576
}

// debug flags
let simulate_latency = false;

// world state
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
		canJump: false,
		current_health: MAX_HEALTH,
		character_number: 65 * Math.floor(Math.random() * 4),
		server_timestamp: 0,
		time_since_input: 0,
		just_damaged: false,
		damaged_time: 0,
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
		const delay = simulate_latency ? 200 : 0;
		setTimeout(() => {
			inputQueue.push(input);
		}, delay);
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

		if (backEndPlayer.just_damaged) {
			if (now_ts - backEndPlayer.damaged_time < 1500) {
				return;
			} else {
				backEndPlayer.just_damaged = false;
			}
		}

		// filter input event type
		if (input.event === 'Stop') {
			backEndPlayer.target_dx = 0.0;
		} else if (input.event === 'Run_Right') {
			backEndPlayer.target_dx = SPEED;
		} else if (input.event === 'Run_Left') {
			backEndPlayer.target_dx = -SPEED;
		} else if (input.event === 'Jump' && backEndPlayer.canJump == true) {
			backEndPlayer.canJump = false;
			backEndPlayer.target_dy = -JUMP_FORCE;
		} else if (input.event === 'Attack') {
			attack(input, now_ts);
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
		//backEndPlayer.dx = lerp(backEndPlayer.dx, backEndPlayer.target_dx, 0.5, delta_time);
		backEndPlayer.target_dy += GRAVITY_CONSTANT * delta_time;

		backEndPlayer.dy = backEndPlayer.target_dy;
		backEndPlayer.dx = backEndPlayer.just_damaged ? lerp(backEndPlayer.dx, 0, 0.1) : backEndPlayer.target_dx; //lerp(backEndPlayer.dx, backEndPlayer.target_dx, delta_time);

		backEndPlayer.x += backEndPlayer.dx * delta_time;
		backEndPlayer.y += backEndPlayer.dy * delta_time;

		// floor check
		if (backEndPlayer.y + backEndPlayer.height >= CANVAS.height) {
			backEndPlayer.canJump = true;
			backEndPlayer.dy = 0;
			backEndPlayer.y = CANVAS.height - backEndPlayer.height;
		} else {
			backEndPlayer.canJump = false;
		}

		// TODO: find a better way to deal with this
		if (backEndPlayer.server_timestamp !== 0)
			// if player has just been initialized, don't update time_since_input
			backEndPlayer.time_since_input = now_ts - backEndPlayer.server_timestamp;
	}
}

function attack(input, now_ts) {
	const player = backEndPlayers[input.id];

	for (const id in backEndPlayers) {
		if (id == input.id) continue; // don't want to hit ourselves
		const enemy_player = backEndPlayers[id];
		if (check_collision(player.x-player.width/2, player.y+player.height/2, player.width*2, player.height*2, enemy_player.x, enemy_player.y, enemy_player.width, enemy_player.height)) {
			console.log("HIT")
			enemy_player.current_health--;
			enemy_player.just_damaged = true;
			enemy_player.damaged_time = now_ts;
			//knockback(enemy_player, player);

			handleHit(player, enemy_player, 2000);

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
		canJump: false,
		just_damaged: false,
		current_health: MAX_HEALTH,
		character_number: 65 * Math.floor(Math.random() * 4),
		server_timestamp: 0,
		time_since_input: 0,
	};
}

// Function to calculate the direction vector
function calculateDirectionVector(player1, player2) {
    let directionX = player2.x - player1.x;
    let directionY = player2.y - player1.y;
    return { x: directionX, y: directionY };
}

// Function to normalize a vector
function normalizeVector(vector) {
    let magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return { x: vector.x / magnitude, y: vector.y / magnitude };
}

// Function to apply force to the player being hit
function applyForce(player, forceVector, forceMagnitude) {
    player.dx -= forceVector.x * forceMagnitude;
    player.dy -= forceVector.y * forceMagnitude*2;
}

// Main function to handle the hit
function handleHit(player1, player2, forceMagnitude) {
    // Calculate direction vector from player1 to player2
    let directionVector = calculateDirectionVector(player1, player2);
    
    // Normalize the direction vector
    let normalizedDirection = normalizeVector(directionVector);
    
    // Reverse the direction for applying force to player2 (the one being hit)
    let forceVector = { x: -normalizedDirection.x, y: -normalizedDirection.y };
    
    // Apply the force to player2
    applyForce(player2, forceVector, forceMagnitude);
}

function lerp(start, end, a) {
    return start + (end - start) * a;
}

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`);
});
