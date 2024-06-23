// init canvas
const canvas = document.querySelector('canvas');
const c = canvas.getContext('2d');

canvas.width = 1024
canvas.height = 576

const socket = io();

// player constants
const SPEED = 600;
const JUMP_FORCE = 1000;
const GRAVITY_CONSTANT = 3000;

// track state
let frontEndPlayers = {};
let backEndPlayerStates = {};
let inputsToProcess = [];
let playerInputs = [];

// debug function toggles
let show_debug_draw = false;
let server_reconciliation = true;
let client_side_prediction = true;

socket.on('updatePlayers', (backEndPlayers) => {
    backEndPlayerStates = backEndPlayers;
});

socket.on('respawnPlayer', (id) => {
    let player = frontEndPlayers[id];
    player.sequenceNumber = 0;
    playerInputs = [];
});

// frontend main game loop
function gameLoop(current_timestamp) {
    // calculate delta since last loop
    var last_timestamp = this.last_timestamp || current_timestamp;
    var delta_time = (current_timestamp - last_timestamp) / 1000.0;
    this.last_timestamp = current_timestamp;
    // process queued client inputs
    processInputs(delta_time, current_timestamp);
    // perform client-side prediction, server reconciliation, (entity interpolation TODO)
    updatePlayers(delta_time, current_timestamp);
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

function updatePlayers(delta_time, timestamp_now) {
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
                character_number: backEndPlayer.character_number,
            });
        } else {
            if (id === socket.id) {
                let player = frontEndPlayers[id]
                // Received the authoritative state of this client's entity.
                player.x = backEndPlayer.x;
                player.y = backEndPlayer.y;
                player.dx = backEndPlayer.dx;
                player.dy = backEndPlayer.dy;
                player.canJump = backEndPlayer.canJump;
                player.current_health = backEndPlayer.current_health;

                if (server_reconciliation) {
                    reconciliate(player, backEndPlayer, timestamp_now, delta_time)
                } else {
                    // Reconciliation is disabled, so drop all the saved inputs.
                    playerInputs = [];
                }
            } else {
                let player = frontEndPlayers[id]
                // Received the position of an entity other than this client's.
                // Entity interpolation is disabled - just accept the server's position.
                player.x = backEndPlayer.x;
                player.y = backEndPlayer.y;
                player.dx = backEndPlayer.dx;
                player.dy = backEndPlayer.dy;
                player.canJump = backEndPlayer.canJump;
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

// Server Reconciliation. Re-apply all the inputs not yet processed by the server.
function reconciliate(player, backEndPlayer, timestamp_now, delta_time) {
    var j = 0;
    while (j < playerInputs.length) {
        let input = playerInputs[j];

        if (input.sequenceNumber < backEndPlayer.sequenceNumber) {
            // Already processed. Its effect is already taken into account into the world update we just got, so we can drop it.
            playerInputs.shift();

        } else if (input.sequenceNumber === backEndPlayer.sequenceNumber) {
            // Server currently dealing with this input. Re-apply movement since last server update.
            player.dx = backEndPlayer.dx;
            player.dy = backEndPlayer.dy;

            let time_since_last_input = 0;
            if (playerInputs[j + 1]) {
                time_since_last_input =
                    (playerInputs[j + 1].timestamp - (input.timestamp + backEndPlayer.time_since_input)) / 1000; // - delta_time
            } else {
                time_since_last_input = (timestamp_now - (input.timestamp + backEndPlayer.time_since_input)) / 1000; // - delta_time
            }

            move_player(player, time_since_last_input)
            j++;

        } else {
            // Not processed by the server yet. Re-apply all of it.
            if (input.event === 'Stop') {
                player.dx = 0;
            } else if (input.event === 'Run_Right') {
                player.dx = SPEED;
            } else if (input.event === 'Run_Left') {
                player.dx = -SPEED;
            } else if (input.event === 'Jump') {
                player.dy = input.dy * JUMP_FORCE;
            }

            let time_since_last_input = 0;
            if (playerInputs[j + 1]) {
                time_since_last_input = (playerInputs[j + 1].timestamp - input.timestamp) / 1000;
            } else {
                time_since_last_input = (timestamp_now - input.timestamp) / 1000;
            }

            move_player(player, time_since_last_input)
            j++;
        }
    }
}

function move_player(player, timestep) {
    // Calculate x pos
    player.x += player.dx * timestep;

    // Calculate y pos
    player.dy += GRAVITY_CONSTANT * timestep;
    player.y += player.dy * timestep;

    checkGravity(player);
}

function physics(delta_time) {
    if (!frontEndPlayers[socket.id]) return;

    // Is player on floor?
    checkGravity(frontEndPlayers[socket.id]);
}

function render() {
    c.clearRect(0, 0, canvas.width, canvas.height);

    if (show_debug_draw) {
        for (const id in backEndPlayerStates) {
            let backEndPlayer = backEndPlayerStates[id]
            debug_draw(backEndPlayer.x, backEndPlayer.y, backEndPlayer.width, backEndPlayer.height)
        }
    }

    for (const id in frontEndPlayers) {
        const frontEndPlayer = frontEndPlayers[id];
        frontEndPlayer.draw();
    }
}

function checkGravity(player) {
    if (!player) return;

    // Is player on floor?
    if (player.y + player.height >= canvas.height) {
        player.canJump = true;
        player.dy = 0;
        player.y = canvas.height - player.height;
    } else {
        player.canJump = false;
    }
}

const keys = {
    w: {
        pressed: false,
    },
    a: {
        pressed: false,
    },
    s: {
        pressed: false,
    },
    d: {
        pressed: false,
    },
    i: {
        pressed: false,
    },
    p: {
        pressed: false,
    },
};

window.addEventListener('mousedown', (event) => {
    if (!frontEndPlayers[socket.id]) return;

    let player = frontEndPlayers[socket.id];
    input = { id: socket.id, dy: 0, dx: 0 };

    switch (event.buttons) {
        case 1:
            input.event = 'Attack';
            player.sequenceNumber++;
            input.sequenceNumber = player.sequenceNumber;
            break;
    }
    if (!input.event) return;
    inputsToProcess.push(input);
});

window.addEventListener('keydown', (event) => {
    if (!frontEndPlayers[socket.id]) return;

    let player = frontEndPlayers[socket.id];
    input = { id: socket.id, dy: 0, dx: 0 };

    switch (event.code) {
        case 'KeyW':
            if (keys.w.pressed || !frontEndPlayers[socket.id].canJump) {
                return;
            } else {
                input.event = 'Jump';
                input.dy = -1;
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
                keys.w.pressed = true;

                frontEndPlayers[socket.id].canJump = false;
            }
            break;

        case 'KeyA':
            if (keys.a.pressed) {
                return;
            } else {
                input.event = 'Run_Left';
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
                keys.a.pressed = true;
            }
            break;

        case 'KeyD':
            if (keys.d.pressed) {
                return;
            } else {
                input.event = 'Run_Right';
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
                keys.d.pressed = true;
            }
            break;

        case 'KeyI':
            if (keys.i.pressed) {
                return;
            } else {
                server_reconciliation = !server_reconciliation;
                client_side_prediction = !client_side_prediction;
                console.log('network magic toggled: ' + server_reconciliation);
            }
            break;

        case 'KeyP':
            if (keys.p.pressed) {
                return;
            } else {
                show_debug_draw = !show_debug_draw;
                console.log('move history toggled: ' + show_debug_draw);
            }
            break;
    }
    if (!input.event) return;
    inputsToProcess.push(input);
});

window.addEventListener('keyup', (event) => {
    if (!frontEndPlayers[socket.id]) return;

    let player = frontEndPlayers[socket.id]
    let input = { id: socket.id, dy: 0, dx: 0 };

    switch (event.code) {
        case 'KeyW':
            keys.w.pressed = false;
            break;
        case 'KeyA':
            if (keys.d.pressed) {
                input.event = 'Run';
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
            } else {
                input.event = 'Stop';
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
            }
            keys.a.pressed = false;
            break;

        case 'KeyD':
            if (keys.a.pressed) {
                input.event = 'Run';
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
            } else {
                input.event = 'Stop';
                player.sequenceNumber++
                input.sequenceNumber = player.sequenceNumber;
            }
            keys.d.pressed = false;
            break;
        case 'KeyI':
            keys.i.pressed = false;
            break;
        case 'KeyP':
            keys.p.pressed = false;
            break;
    }
    if (!input.event) return;
    inputsToProcess.push(input);
});

function debug_draw(x, y, width, height) {
    c.beginPath();
    c.fillStyle = `rgba(0, 0, 0, 0.5)`;
    c.fillRect(x, y, width, height);
    c.restore();
}
