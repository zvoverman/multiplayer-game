#!/bin/bash

# update package list
sudo apt update

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# verify environment
node -v
npm -v

# pull latest changes
cd multiplayer-game/
git pull https://github.com/zvoverman/multiplayer-game.git
npm install

# start the node server
npm start