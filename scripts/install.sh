#!/bin/bash

# update package list and install prerequisites
sudo apt update
sudo apt install -y curl

# installs nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# download and install Node.js (you may need to restart the terminal)
nvm install 20

# verify environment
node -v
npm -v

# clone the repository
git clone https://github.com/zvoverman/multiplayer-game.git

# start the node server
cd multiplayer-game/
npm install
npm start
