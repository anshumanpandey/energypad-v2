#!/bin/bash

# Install node.js
sudo apt-get update
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
nvm install v14.17.5
source ~/.bashrc

npm install --global yarn
