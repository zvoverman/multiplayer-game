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

socket.on('updatePlayers', (backEndPlayers) => {
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
				frontEndPlayers[id].x = backEndPlayer.x
				frontEndPlayers[id].y = backEndPlayer.y

				frontEndPlayers[id].dx = backEndPlayer.dx
				frontEndPlayers[id].dy = backEndPlayer.dy

				// Server Reconciliation. Re-apply all the inputs not yet processed by the server.

				frontEndPlayers[id].target = {
					x: backEndPlayer.x,
					y: backEndPlayer.y
				}

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
							console.log(input)
							applyInput(frontEndPlayers[id], input);
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

function applyInput (frontEndPlayer, input) {
	frontEndPlayer.x += frontEndPlayer.dx * input.delta_time
	frontEndPlayer.y += frontEndPlayer.dy * input.delta_time
}

// Animate Canvas and Entities
let animationId
function animate() {
	//animationId = requestAnimationFrame(animate)
	// c.fillStyle = 'rgba(0, 0, 0, 0.1)'
	c.clearRect(0, 0, canvas.width, canvas.height)

	for (const id in frontEndPlayers) {
		const frontEndPlayer = frontEndPlayers[id]

		frontEndPlayer.draw()
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
	}
}

const SPEED = 500
let playerInputs = []
let sequenceNumber = 0
setInterval(() => {
	if (!frontEndPlayers[socket.id]) return

	if (frontEndPlayers[socket.id].dy === 0) {
		keys.w.pressed = false;
	}

	//console.log(frontEndPlayers[socket.id])

	// process server messages -> updatePlayer() currently does this
	//processServerMessages()

	// process inputs -> Doing this HERE
	//processInputs()

	// Interpolate other entities -> updatePlayer() currenly does this
	//interpolateEntities()

	// Render the world -> animate() currently does this
	requestAnimationFrame(animate)

}, 15)

window.addEventListener('keydown', (event) => {
	if (!frontEndPlayers[socket.id]) return

	input = { timeStamp: +new Date(), sequenceNumber: sequenceNumber++, id: socket.id, dy: 0, dx: 0 }

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

	// Send input to server
	socket.emit('sendInput', input)
	playerInputs.push(input)
})

window.addEventListener('keyup', (event) => {
	if (!frontEndPlayers[socket.id]) return

	input = { timeStamp: +new Date(), sequenceNumber: sequenceNumber++, id: socket.id, dy: 0, dx: 0 }

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
	socket.emit('sendInput', input)
	playerInputs.push(input)
})