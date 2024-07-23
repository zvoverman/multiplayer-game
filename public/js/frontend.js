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
const GROUND_FRICTION = 1000;
const AIR_FRICTION = 500;

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
    //physics(delta_time);
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
                player.can_move = !backEndPlayer.just_damaged;

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
                player.can_move = !backEndPlayer.just_damaged;
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

        let timestep = 0;
        if (input.sequenceNumber < backEndPlayer.sequenceNumber) {
            // Already processed. Its effect is already taken into account into the world update we just got, so we can drop it.
            playerInputs.shift();
            continue;
        } else if (input.sequenceNumber === backEndPlayer.sequenceNumber) {
            // Server currently dealing with this input. Re-apply movement since last server update.
            if (playerInputs[j + 1]) {
                timestep = (playerInputs[j + 1].timestamp - (input.timestamp + backEndPlayer.time_since_input)) / 1000 - delta_time;
            } else {
                timestep = (timestamp_now - (input.timestamp + backEndPlayer.time_since_input)) / 1000 - delta_time;
            }

            player.target_dx = backEndPlayer.dx;
            player.target_dy = backEndPlayer.dy;
        } else {
            // Not processed by the server yet. Re-apply all of it.
            if (playerInputs[j + 1]) {
                timestep = (playerInputs[j + 1].timestamp - input.timestamp) / 1000;
            } else {
                timestep = (timestamp_now - input.timestamp) / 1000;
            }

            if (input.event === 'Stop') {
                player.target_dx = 0.0;
            } else if (input.event === 'Run_Right') {
                player.target_dx = SPEED;
            } else if (input.event === 'Run_Left') {
                player.target_dx = -SPEED;
            } else if (input.event === 'Jump') {
                player.dy = -JUMP_FORCE;
            }
        }
        move_player(player, timestep)
        j++;
    }
}

function move_player(player, timestep) {

    player.x += timestep * player.target_dx

    // Verlet integration
    player.y += timestep * (player.dy + timestep * GRAVITY_CONSTANT / 2)
    player.dy += timestep * GRAVITY_CONSTANT;
    checkGravity(player);
}

function checkGravity(player) {
    if (!player) return;

    // Is player on floor?
    if (player.y + player.height >= canvas.height) {
        //console.log(player.y)
        player.canJump = true;
        player.dy = 0;
        player.y = canvas.height - player.height;
    } else {
        player.canJump = false;
    }
}

function render() {
    c.clearRect(0, 0, canvas.width, canvas.height);

    // draw immediately consumed backend position
    if (show_debug_draw) {
        for (const id in backEndPlayerStates) {
            let player = backEndPlayerStates[id]
            debug_draw(player.x, player.y, player.width, player.height, 0.5)
            if (is_mouse_pressed && id === socket.id) {
                debug_draw(player.x-player.width/2, player.y-player.height/2, player.width*2, player.height*2, 0.5)
            } else {
                debug_draw(player.x-player.width/2, player.y-player.height/2, player.width*2, player.height*2, 0.3)
            }
            velocity_vector_draw(player.x + player.width/2, player.y + player.height/2, player.x + player.dx/2 + player.width/2, player.y + player.dy/4 + player.height/2, "#0000ffaf")
        }
    }

    // Render frontend players
    for (const id in frontEndPlayers) {
        const player = frontEndPlayers[id];
        player.draw();

        if (show_debug_draw) {
            velocity_vector_draw(player.x + player.width/2, player.y + player.height/2, player.x + player.dx/2 + player.width/2, player.y + player.dy/4 + player.height/2, "#ff0000af")
        }
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
let is_mouse_pressed = false;

window.addEventListener('mousedown', (event) => {
    if (!frontEndPlayers[socket.id]) return;

    let player = frontEndPlayers[socket.id];
    input = { id: socket.id, dy: 0, dx: 0 };

    switch (event.buttons) {
        case 1:
            is_mouse_pressed = true;
            input.event = 'Attack';
            player.sequenceNumber++;
            input.sequenceNumber = player.sequenceNumber;
            break;
    }
    if (!input.event) return;
    inputsToProcess.push(input);
});

window.addEventListener('mouseup', (event) => {
    if (!frontEndPlayers[socket.id]) return;

    is_mouse_pressed = false;
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
                player.sequenceNumber++;
                input.sequenceNumber = player.sequenceNumber;
                keys.w.pressed = true;
            }
            break;

        case 'KeyA':
            if (keys.a.pressed) {
                return;
            } else {
                input.event = 'Run_Left';
                player.sequenceNumber++;
                input.sequenceNumber = player.sequenceNumber;
                keys.a.pressed = true;
            }
            break;

        case 'KeyD':
            if (keys.d.pressed) {
                return;
            } else {
                input.event = 'Run_Right';
                player.sequenceNumber++;
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
                player.sequenceNumber++;
                input.sequenceNumber = player.sequenceNumber;
            } else {
                input.event = 'Stop';
                player.sequenceNumber++;
                input.sequenceNumber = player.sequenceNumber;
            }
            keys.a.pressed = false;
            break;

        case 'KeyD':
            if (keys.a.pressed) {
                input.event = 'Run';
                player.sequenceNumber++;
                input.sequenceNumber = player.sequenceNumber;
            } else {
                input.event = 'Stop';
                player.sequenceNumber++;
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

function debug_draw(x, y, width, height, alpha) {
    c.beginPath();
    c.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    c.fillRect(x, y, width, height);
    c.restore();
}

function velocity_vector_draw(x, y, target_x, target_y, color) {
    c.strokeStyle = color;
    c.lineWidth = 2; 
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(target_x, target_y);
    c.stroke()
    c.restore();
}

function lerp(start, end, a) {
    return start + (end - start) * a;
}
