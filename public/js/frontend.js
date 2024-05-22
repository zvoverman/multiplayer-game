// init canvas
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');
const devicePixelRatio = window.devicePixelRatio || 1;

canvas.width = 1024 * devicePixelRatio;
canvas.height = 576 * devicePixelRatio;
c.scale(devicePixelRatio, devicePixelRatio);

const socket = io();

// player constants
const SPEED = 500
const JUMP_FORCE = 1.0;
const GRAVITY_CONSTANT = 2000;

// track state
let frontEndPlayers = {};
let backEndPlayerStates = {}

let inputsToProcess = [];
let playerInputs = [];
let previousPositions = [];

let sequenceNumber = 0;

// debug function toggles
let show_debug_draw = false;
let server_reconciliation = true;
let client_side_prediction = true;

function debug_draw(x, y, width, height, alpha) {
	c.beginPath();
	c.fillStyle = `rgba(0, 0, 0, ${alpha})`;
	c.fillRect(x, y, width, height);
	c.restore();
}

socket.on('updatePlayers', (backEndPlayers) => {
	backEndPlayerStates = backEndPlayers;
})

// frontend main game loop
function gameLoop(current_timestamp) {
	// calculate delta since last loop
	var last_timestamp = this.last_timestamp || current_timestamp;
	var delta_time = (current_timestamp - last_timestamp) / 1000.0;
	this.last_timestamp = current_timestamp;

	processInputs(delta_time, current_timestamp);

	physics(delta_time);

	updatePlayers(current_timestamp);

	render();

	requestAnimationFrame(gameLoop);
}

// https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
// improved performance
requestAnimationFrame(gameLoop);

function processInputs(delta_time, timestamp) {
	// process all new inputs
	for (const e in inputsToProcess) {
		let input = inputsToProcess[e];
		input.delta_time = delta_time;
		input.timestamp = timestamp;

		socket.emit('sendInput', input); // send processed input to server

		playerInputs.push(input); // save input for Server Reconciliation
	}
	inputsToProcess = [];
}

function physics(delta_time) {
	if (!frontEndPlayers[socket.id]) return

	// Move player
	frontEndPlayers[socket.id].x += frontEndPlayers[socket.id].dx * delta_time;
	// frontEndPlayers[socket.id].y += frontEndPlayers[socket.id].dy * delta_time * JUMP_FORCE

	// Is player on floor?
	if (frontEndPlayers[socket.id].y + frontEndPlayers[socket.id].height + (frontEndPlayers[socket.id].dy * delta_time) > 576) {
		frontEndPlayers[socket.id].canJump = true;
		frontEndPlayers[socket.id].dy = 0;
		frontEndPlayers[socket.id].y = 576 - frontEndPlayers[socket.id].height;
		frontEndPlayers[socket.id].gravity = 0;
	} else {
		frontEndPlayers[socket.id].dy += frontEndPlayers[socket.id].gravity * delta_time;
		frontEndPlayers[socket.id].y += frontEndPlayers[socket.id].dy * delta_time;
		frontEndPlayers[socket.id].gravity += GRAVITY_CONSTANT * delta_time;
	}
}

function updatePlayers(timestamp_now) {
	if (!backEndPlayerStates) return;

	for (const id in backEndPlayerStates) {
		const backEndPlayer = backEndPlayerStates[id];

		// If this is the first time we see this entity, create a local representation.
		if (!frontEndPlayers[id]) {
			frontEndPlayers[id] = new Player({
				x: backEndPlayer.x,
				y: backEndPlayer.y,
				dx: backEndPlayer.dx,
				dy: backEndPlayer.dy,
				width: backEndPlayer.width,
				height: backEndPlayer.height,
				color: backEndPlayer.color
			})

		} else {

			if (id === socket.id) {
				// Received the authoritative position of this client's entity.
				let target_x = backEndPlayer.x;
				let target_y = backEndPlayer.y;

				frontEndPlayers[id].x = target_x;
				frontEndPlayers[id].y = target_y;

				// Debug Draw Position Q
				pos = {
					x: frontEndPlayers[id].x,
					y: frontEndPlayers[id].y
				}
				previousPositions.push(pos);
				if (previousPositions.length > 10) {
					previousPositions.shift();
				}

				frontEndPlayers[id].dx = backEndPlayer.dx;
				frontEndPlayers[id].dy = backEndPlayer.dy;

				frontEndPlayers[id].canJump = backEndPlayer.canJump;
				frontEndPlayers[id].gravity = backEndPlayer.gravity;

				if (server_reconciliation) {
					// Server Reconciliation. Re-apply all the inputs not yet processed by the server.
					var j = 0;
					while (j < playerInputs.length) {
						let input = playerInputs[j];
						if (input.sequenceNumber < backEndPlayer.sequenceNumber) {
							// Already processed. Its effect is already taken into account into the world update we just got, so we can drop it.
							playerInputs.shift();
						} else if (input.sequenceNumber === backEndPlayer.sequenceNumber) {
							// Not processed by the server yet. Re-apply it.
							frontEndPlayers[id].dx = input.dx;
							frontEndPlayers[id].dy = input.dy;

							let time_since_last_input = 0;
							if (playerInputs[j + 1]) {
								// want to calculate duration FROM backend timestamp NOT start of input
								time_since_last_input = ((playerInputs[j + 1].timestamp - (input.timestamp + backEndPlayer.time_since_input)) / 1000);
							} else {
								time_since_last_input = ((timestamp_now - (input.timestamp + backEndPlayer.time_since_input)) / 1000);
							}

							frontEndPlayers[id].x += frontEndPlayers[id].dx * SPEED * time_since_last_input;
							frontEndPlayers[id].y += frontEndPlayers[id].dy * SPEED * time_since_last_input;

							j++;
						} else {
							// Not processed by the server yet. Re-apply it.
							frontEndPlayers[id].dx = input.dx;
							frontEndPlayers[id].dy = input.dy;

							let time_since_last_input = 0;
							if (playerInputs[j + 1]) {
								// want to calculate duration FROM backend timestamp NOT start of input
								time_since_last_input = ((playerInputs[j + 1].timestamp - input.timestamp) / 1000);
							} else {
								time_since_last_input = ((timestamp_now - input.timestamp) / 1000);
							}

							frontEndPlayers[id].x += frontEndPlayers[id].dx * SPEED * time_since_last_input;
							frontEndPlayers[id].y += frontEndPlayers[id].dy * SPEED * time_since_last_input;

							j++;
						}
					}
				} else {
					// Reconciliation is disabled, so drop all the saved inputs.
					playerInputs = [];
				}
			} else {
				// Received the position of an entity other than this client's.
				// Entity interpolation is disabled - just accept the server's position.
				frontEndPlayers[id].x = backEndPlayer.x;
				frontEndPlayers[id].y = backEndPlayer.y;

				frontEndPlayers[id].dx = backEndPlayer.dx;
				frontEndPlayers[id].dy = backEndPlayer.dy;
			}
		}
	}

	// if frontendplayer is not in backend, delete the player
	for (const id in frontEndPlayers) {
		if (!backEndPlayerStates[id]) {
			delete frontEndPlayers[id];
		}
	}
}

function render() {
	c.clearRect(0, 0, canvas.width, canvas.height);

	if (show_debug_draw) {
		let alpha = 0;
		if (previousPositions.length != 0) {
			for (const i in previousPositions) {
				alpha = lerp(alpha, 0.2, 0.2);
				debug_draw(previousPositions[i].x, previousPositions[i].y, 64, 128, alpha);
			}
		}
	}

	for (const id in frontEndPlayers) {
		const frontEndPlayer = frontEndPlayers[id];
		frontEndPlayer.draw();
	}
}

const keys = {
	w: {
		pressed: false
	},
	a: {
		pressed: false
	},
	s: {
		pressed: false
	},
	d: {
		pressed: false
	},
	i: {
		pressed: false
	},
	p: {
		pressed: false
	}
}

window.addEventListener('keydown', (event) => {
	if (!frontEndPlayers[socket.id]) return

	input = { id: socket.id, dy: 0, dx: 0 }

	switch (event.code) {
		case 'KeyW':
			// TODO: Check floor collision on client side -> if keys.w.pressed when floor is hit JUMP
			if (keys.w.pressed && frontEndPlayers[socket.id].canJump) {
				return
			} else {
				input.event = 'Jump'
				input.dy = -1
				input.sequenceNumber = sequenceNumber++;
				keys.w.pressed = true
			}
			break

		case 'KeyA':
			if (keys.a.pressed) {
				return
			} else {
				input.event = 'Run'
				input.dx = -1
				input.sequenceNumber = sequenceNumber++;
				keys.a.pressed = true
			}
			break

		case 'KeyD':
			if (keys.d.pressed) {
				return
			} else {
				input.event = 'Run'
				input.dx = 1
				input.sequenceNumber = sequenceNumber++;
				keys.d.pressed = true
			}
			break

		case "KeyI":
			if (keys.i.pressed) {
				return
			} else {
				server_reconciliation = !server_reconciliation
				client_side_prediction = !client_side_prediction
				console.log("network magic toggled: " + server_reconciliation)
			}
			break

		case "KeyP":
			if (keys.p.pressed) {
				return
			} else {
				show_debug_draw = !show_debug_draw
				console.log("move history toggled: " + show_debug_draw)
			}
			break
	}
	if (!input.event) return
	inputsToProcess.push(input)
})

window.addEventListener('keyup', (event) => {
	if (!frontEndPlayers[socket.id]) return

	input = { id: socket.id, dy: 0, dx: 0 }

	switch (event.code) {
		case 'KeyW':
			keys.w.pressed = false
			break
		case 'KeyA':
			if (keys.d.pressed) {
				input.event = 'Run'
				input.dx = 1
				input.sequenceNumber = sequenceNumber++;
			} else {
				input.event = 'Stop'
				input.sequenceNumber = sequenceNumber++;
			}
			keys.a.pressed = false
			break

		case 'KeyD':
			if (keys.a.pressed) {
				input.event = 'Run'
				input.dx = -1
				input.sequenceNumber = sequenceNumber++;
			} else {
				input.event = 'Stop'
				input.sequenceNumber = sequenceNumber++;
			}
			keys.d.pressed = false
			break
		case 'KeyI':
			keys.i.pressed = false
			break
		case 'KeyP':
			keys.p.pressed = false
			break
	}
	if (!input.event) return
	inputsToProcess.push(input)
})

function lerp(a, b, alpha) {
	if (a > b - 0.01 && a < b + 0.01) return b;
	return a + alpha * (b - a);
}