# Node.js Multiplayer Game Demo

A Node.js powered game demo utilizing the Javascript HTML5 Canvas for rendering.

**Fast and Responsive Client-Server Architecture**:

-   Server authoratative gameplay
-   Variable frame rate
-   Client-side prediction
-   Server reconciliation
-   Entity interpolation

Lots of research from **[Client-Server Game Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html)** by Gabirel Gambetta _(amazing article)_

## Getting Started

Steps on how to install and run the game locally.

### Prerequisites

1. Install [Node.js](https://nodejs.org/en/download/package-manager)

### Local Installation

1. Clone the Repo

    ```bash
    git clone https://github.com/zvoverman/multiplayer-game.git
    ```

2. Install Project Dependencies

    ```bash
    npm install
    ```

3. Run the Server Locally
    ```bash
    npm run start
    ```

## AWS Automation
### Development

1. Create a dotenv (.env) file
    ```bash
    INSTANCE_TYPE=""
    SECURITY_GROUP=""
    REGION=""
    OWNER_ID=""
    SSH_USER=""
    KEY_NAME=""
    ```

2. Run Express.js Server on an EC2 Instance
    ```bash
    npm run start-ec2
    ```

3. Update Server Packages and Pull New Game Code
    ```bash
    npm run update-ec2
    ```

4. Terminate Last Created EC2 Instance
    ```bash
    npm run stop-ec2
    ```

### Deployment

1. Create a dotenv (.env) file
    ```bash
    INSTANCE_TYPE=""
    SECURITY_GROUP=""
    REGION=""
    OWNER_ID=""
    SSH_USER=""
    KEY_NAME=""
    ```

2. Create Instance, Start Express.js Server, and Terminate Instance (Ctrl+C)
    ```bash
    npm run deploy
    ```