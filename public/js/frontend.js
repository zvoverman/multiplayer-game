const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

const devicePixelRatio = window.devicePixelRatio || 1

canvas.width = 1024 * devicePixelRatio
canvas.height = 576 * devicePixelRatio

c.scale(devicePixelRatio, devicePixelRatio)

const x = canvas.width / 2
const y = canvas.height / 2

const frontEndPlayers = {}

const GRAVITY_CONSTANT = 0.1;
var gravity = 0;
var canJump = false

let inputsToPredict = []

// for debug
let previousPositions = []


function debug_draw(x, y, width, height, alpha) {
	c.beginPath()
	c.fillStyle = `rgba(0, 0, 0, ${alpha})`;
	c.fillRect(x, y, width, height)
	c.restore()
}

socket.on('updatePlayers', (backEndPlayers) => {
	// Compute delta time since last update.
	var now_ts = +new Date()
	var last_ts = this.last_ts || now_ts;
	var dt_sec = (now_ts - last_ts) / 1000.0;
	this.last_ts = now_ts;

	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id]

		// If this is the first time we see this entity, create a local representation.
		if (!frontEndPlayers[id]) {
			frontEndPlayers[id] = new Player({
				x: backEndPlayer.x,
				y: backEndPlayer.y,
				dx: backEndPlayer.dx,
				dy: backEndPlayer.dy,
				width: backEndPlayer.width,
				height: backEndPlayer.height,
				color: backEndPlayer.color,
			})

		} else {

			if (id === socket.id) {
				// Received the authoritative position of this client's entity.
				let target_x = backEndPlayer.x
				let target_y = backEndPlayer.y

				frontEndPlayers[id].x = lerp(frontEndPlayers[id].x, target_x, 0.5)
				frontEndPlayers[id].y = lerp(frontEndPlayers[id].y, target_y, 0.5)

				pos = {
					x: frontEndPlayers[id].x,
					y: frontEndPlayers[id].y
				}
				previousPositions.push(pos)
				if (previousPositions.length > 20) {
					previousPositions.shift()
				}

				//console.log("x: %f | %f", frontEndPlayers[id].x, target_x)

				frontEndPlayers[id].dx = backEndPlayer.dx
				frontEndPlayers[id].dy = backEndPlayer.dy

				server_reconciliation = true
				if (server_reconciliation) {
					// Server Reconciliation. Re-apply all the inputs not yet processed by the server.
					var j = 0;
					while (j < playerInputs.length) {
						let input = playerInputs[j]
						if (input.sequenceNumber <= backEndPlayer.sequenceNumber) {
							// Already processed. Its effect is already taken into account into the world update
							// we just got, so we can drop it.
							playerInputs.shift()
						} else {
							// Not processed by the server yet. Re-apply it.
							//console.log(input)
							console.log(input.sequenceNumber - backEndPlayer.sequenceNumber)
							applyInput(frontEndPlayers[socket.id], dt_sec);
							j++;
						}
					}
				} else {
					// Reconciliation is disabled, so drop all the saved inputs.
					playerInputs = [];
				}

				//console.log("x: " + frontEndPlayers[id].x + ", y: " + frontEndPlayers[id].y + ", player: " + frontEndPlayers[id])

			} else {
				// Received the position of an entity other than this client's.
				// Entity interpolation is disabled - just accept the server's position.
				frontEndPlayers[id].x = backEndPlayer.x
				frontEndPlayers[id].y = backEndPlayer.y

				frontEndPlayers[id].dx = backEndPlayer.dx
				frontEndPlayers[id].dy = backEndPlayer.dy
			}

			//console.log("x: " + frontEndPlayers[id].x + ", y: " + frontEndPlayers[id].y)

		}
	}

	// this is where we delete frontend players
	for (const id in frontEndPlayers) {
		if (!backEndPlayers[id]) {
			delete frontEndPlayers[id]
		}
	}
})

function applyInput(frontEndPlayer, dt_sec) {
	frontEndPlayer.x += frontEndPlayer.dx * dt_sec
	frontEndPlayer.y += frontEndPlayer.dy * dt_sec
}

// Animate Canvas and Entities
let animationId
function animate() {
	animationId = requestAnimationFrame(animate)
	// c.fillStyle = 'rgba(0, 0, 0, 0.1)'
	c.clearRect(0, 0, canvas.width, canvas.height)

	// let alpha = 0
	// if (previousPositions.length != 0) {
	// 	for (const i in previousPositions) {
	// 		alpha = lerp(alpha, 0.2, 0.2)
	// 		debug_draw(previousPositions[i].x, previousPositions[i].y, 64, 128, alpha)
	// 	}
	// }	

	for (const id in frontEndPlayers) {
		const frontEndPlayer = frontEndPlayers[id]

		frontEndPlayer.draw()

	}
}

requestAnimationFrame(animate)

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
	}
}

const SPEED = 500
let playerInputs = []
let sequenceNumber = 0
setInterval(() => {
	if (!frontEndPlayers[socket.id]) return

	// Compute delta time since last update.
	var now_ts = +new Date()
	var last_ts = this.last_ts || now_ts;
	var dt_sec = (now_ts - last_ts) / 1000.0;
	this.last_ts = now_ts;

	if (frontEndPlayers[socket.id].dy === 0) {
		keys.w.pressed = false;
	}

	//console.log(frontEndPlayers[socket.id])

	// client-side prediction
	predictClient(dt_sec)

	// IDEAL?

	// process server messages -> updatePlayer() currently does this
	//processServerMessages()

	// process inputs -> Doing this HERE
	//processInputs()

	// Interpolate other entities -> updatePlayer() currenly does this
	//interpolateEntities()

	// Render the world -> animate() currently does this

}, 15)

function predictClient(dt_sec) {
	// if (inputsToPredict.length === 0) return

	// for (const input in inputsToPredict) {

	// 	frontEndPlayers[socket.id].dx = input.dx
	// 	frontEndPlayers[socket.id].dy = input.dy

	// 	frontEndPlayers[socket.id].x += input.dx * SPEED * dt_sec
	// 	frontEndPlayers[socket.id].y += input.dy * SPEED * dt_sec
	// 	inputsToPredict.shift()
	// }
}

window.addEventListener('keydown', (event) => {
	if (!frontEndPlayers[socket.id]) return

	// FIX THE TIMESTAMP
	input = { sequenceNumber: sequenceNumber++, id: socket.id, dy: 0, dx: 0 }

	switch (event.code) {
		case 'KeyW':
			if (keys.w.pressed) {
				return
			} else {
				input.event = 'Jump'
				input.dy = -1
				keys.w.pressed = true
			}
			break

		case 'KeyA':
			if (keys.a.pressed) {
				return
			} else {
				input.event = 'Run'
				input.dx = -1
				keys.a.pressed = true
			}
			break

		case 'KeyD':
			if (keys.d.pressed) {
				return
			} else {
				input.event = 'Run'
				input.dx = 1
				keys.d.pressed = true
				break
			}
	}

	if (!input.event) return
	//applyInput(frontEndPlayers[socket.id], input) // Client-side Prediction
	inputsToPredict.push(input)
	socket.emit('sendInput', input) // Send input to server
	playerInputs.push(input) // Save input for Server Reconciliation
})

window.addEventListener('keyup', (event) => {
	if (!frontEndPlayers[socket.id]) return

	input = { sequenceNumber: sequenceNumber++, id: socket.id, dy: 0, dx: 0 }

	switch (event.code) {
		case 'KeyA':
			if (keys.d.pressed) {
				input.event = 'Run'
				input.dx = 1
			} else {
				input.event = 'Stop'
			}
			keys.a.pressed = false
			break

		case 'KeyD':
			if (keys.a.pressed) {
				input.event = 'Run'
				input.dx = -1
			} else {
				input.event = 'Stop'
			}
			keys.d.pressed = false
			break
	}

	// Send input to server
	if (!input.event) return
	//applyInput(frontEndPlayers[socket.id], input) // Client-side Prediction
	inputsToPredict.push(input)
	socket.emit('sendInput', input) // Send input to server
	playerInputs.push(input) // Save input for Server Reconciliation
})

function lerp(a, b, alpha) {
	if (a > b - 0.01 && a < b + 0.01) return b;
	return a + alpha * (b - a);
}