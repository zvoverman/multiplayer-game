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

socket.on('updatePlayers', (backEndPlayers) => {
	for (const id in backEndPlayers) {
		const backEndPlayer = backEndPlayers[id]

		// If player doesn't exist on frontend, create player from backend
		if (!frontEndPlayers[id]) {
			frontEndPlayers[id] = new Player({
				x: backEndPlayer.x,
				y: backEndPlayer.y,
				width: backEndPlayer.width,
				height: backEndPlayer.height,
				color: backEndPlayer.color,
			})

		} else {

			frontEndPlayers[id].target = {
				x: backEndPlayer.x,
				y: backEndPlayer.y
			}

			if (id === socket.id) {
				const lastBackendInputIndex = playerInputs.findIndex((input) => {
					return backEndPlayer.sequenceNumber === input.sequenceNumber
				})

				if (lastBackendInputIndex > -1)
					playerInputs.splice(0, lastBackendInputIndex + 1)

				playerInputs.forEach((input) => {
					frontEndPlayers[id].target.x += input.dx
					frontEndPlayers[id].target.y += input.dy
				})
			}
		}
	}

	// this is where we delete frontend players
	for (const id in frontEndPlayers) {
		if (!backEndPlayers[id]) {
			delete frontEndPlayers[id]
		}
	}
})

let animationId
function animate() {
	animationId = requestAnimationFrame(animate)
	// c.fillStyle = 'rgba(0, 0, 0, 0.1)'
	c.clearRect(0, 0, canvas.width, canvas.height)

	for (const id in frontEndPlayers) {
		const frontEndPlayer = frontEndPlayers[id]

		// linear interpolation
		if (frontEndPlayer.target) {
			frontEndPlayers[id].x +=
				(frontEndPlayers[id].target.x - frontEndPlayers[id].x) * 0.5
			frontEndPlayers[id].y +=
				(frontEndPlayers[id].target.y - frontEndPlayers[id].y) * 0.5
		}

		frontEndPlayer.draw()
	}
}

animate()

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

const SPEED = 5
const playerInputs = []
let sequenceNumber = 0
setInterval(() => {
	if (keys.w.pressed) {
		sequenceNumber++
		playerInputs.push({ sequenceNumber, dx: 0, dy: -SPEED })
		// frontEndPlayers[socket.id].y -= SPEED
		socket.emit('keydown', { keycode: 'KeyW', sequenceNumber })
	}

	if (keys.a.pressed) {
		sequenceNumber++
		playerInputs.push({ sequenceNumber, dx: -SPEED, dy: 0 })
		// frontEndPlayers[socket.id].x -= SPEED
		socket.emit('keydown', { keycode: 'KeyA', sequenceNumber })
	}

	if (keys.s.pressed) {
		sequenceNumber++
		playerInputs.push({ sequenceNumber, dx: 0, dy: SPEED })
		// frontEndPlayers[socket.id].y += SPEED
		socket.emit('keydown', { keycode: 'KeyS', sequenceNumber })
	}

	if (keys.d.pressed) {
		sequenceNumber++
		playerInputs.push({ sequenceNumber, dx: SPEED, dy: 0 })
		// frontEndPlayers[socket.id].x += SPEED
		socket.emit('keydown', { keycode: 'KeyD', sequenceNumber })
	}
}, 15)

window.addEventListener('keydown', (event) => {
	if (!frontEndPlayers[socket.id]) return

	switch (event.code) {
		case 'KeyW':
			keys.w.pressed = true
			break

		case 'KeyA':
			keys.a.pressed = true
			break

		case 'KeyS':
			keys.s.pressed = true
			break

		case 'KeyD':
			keys.d.pressed = true
			break
	}
})

window.addEventListener('keyup', (event) => {
	if (!frontEndPlayers[socket.id]) return

	switch (event.code) {
		case 'KeyW':
			keys.w.pressed = false
			break

		case 'KeyA':
			keys.a.pressed = false
			break

		case 'KeyS':
			keys.s.pressed = false
			break

		case 'KeyD':
			keys.d.pressed = false
			break
	}
})
