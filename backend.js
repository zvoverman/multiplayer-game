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

const SPEED = 5
const WIDTH = 32;
const HEIGHT = 64;

io.on('connection', (socket) => {
	console.log('a user connected')

	io.emit('updatePlayers', backEndPlayers)
	
	backEndPlayers[socket.id] = {
		x: 1024 * Math.random(),
		y: 576 * Math.random(),
		width: WIDTH,
		height: HEIGHT,
		color: "#black",
		sequenceNumber: 0,
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

	socket.on('keydown', ({ keycode, sequenceNumber }) => {
		const backEndPlayer = backEndPlayers[socket.id]

		if (!backEndPlayers[socket.id]) return

		backEndPlayers[socket.id].sequenceNumber = sequenceNumber
		switch (keycode) {
			case 'KeyW':
				backEndPlayers[socket.id].y -= SPEED
				break

			case 'KeyA':
				backEndPlayers[socket.id].x -= SPEED
				break

			case 'KeyS':
				backEndPlayers[socket.id].y += SPEED
				break

			case 'KeyD':
				backEndPlayers[socket.id].x += SPEED
				break
		}

		const playerSides = {
			left: backEndPlayer.x - backEndPlayer.width/2,
			right: backEndPlayer.x + backEndPlayer.width/2,
			top: backEndPlayer.y - backEndPlayer.height/2,
			bottom: backEndPlayer.y + backEndPlayer.height/2
		}

		if (playerSides.left < 0) backEndPlayers[socket.id].x = backEndPlayer.width/2

		if (playerSides.right > 1024)
			backEndPlayers[socket.id].x = 1024 - backEndPlayer.width/2

		if (playerSides.top < 0) backEndPlayers[socket.id].y = backEndPlayer.height/2

		if (playerSides.bottom > 576) {
			backEndPlayers[socket.id].y = 576 - backEndPlayer.height/2
			gravity = 0
		}
	})
})

// backend ticker
setInterval(() => {
	io.emit('updatePlayers', backEndPlayers)
}, 15)

server.listen(port, () => {
	console.log(`Example app listening on port http://localhost:${port}`)
})