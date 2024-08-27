const WebSocket = require('ws');

// Initialize the WebSocket server on port 8080
const wss = new WebSocket.Server({ port: 8081 }, () => {
    console.log('WebSocket server started on ws://localhost:8080');
});

let gameState = {
    grid: [
        ['A-P1', 'A-P2', 'A-H1', 'A-H2', 'A-P3'],
        ['', '', '', '', ''],
        ['', '', '', '', ''],
        ['', '', '', '', ''],
        ['B-P1', 'B-P2', 'B-H1', 'B-H2', 'B-P3']
    ],
    currentPlayer: 'A',
    moveHistory: [],
    winner: null,
};

// Broadcast game state to all connected clients
function broadcastGameState() {
    const message = JSON.stringify({
        type: 'update',
        grid: gameState.grid,
        currentPlayer: gameState.currentPlayer,
        moveHistory: gameState.moveHistory,
        winner: gameState.winner,
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Check for win condition
function checkWinCondition() {
    const playerAExists = gameState.grid.some(row => row.some(cell => cell && cell.startsWith('A-')));
    const playerBExists = gameState.grid.some(row => row.some(cell => cell && cell.startsWith('B-')));

    if (!playerAExists) {
        gameState.winner = 'B';
        return;
    }
    if (!playerBExists) {
        gameState.winner = 'A';
        return;
    }
    gameState.winner = null;
}

// Validate move based on character type and direction
function validateAndExecuteMove(move) {
    const [character, direction] = move.split(':');
    const [player, charType] = character.split('-');

    // Ensure the move is being made by the correct player
    if (player !== gameState.currentPlayer) {
        return 'wrongPlayer';
    }

    // Find character position
    let charRow, charCol;
    for (let row = 0; row < gameState.grid.length; row++) {
        for (let col = 0; col < gameState.grid[row].length; col++) {
            if (gameState.grid[row][col] === character) {
                charRow = row;
                charCol = col;
                break;
            }
        }
        if (charRow !== undefined) break;
    }

    if (charRow === undefined || charCol === undefined) {
        return false; // Character not found
    }

    // Determine new position
    let newRow = charRow, newCol = charCol;
    if (charType.startsWith('P')) {
        if (direction === 'L') newCol--;
        else if (direction === 'R') newCol++;
        else if (direction === 'F') newRow += (player === 'A' ? 1 : -1);
        else if (direction === 'B') newRow += (player === 'A' ? -1 : 1);
    } else if (charType === 'H1') {
        if (direction === 'L') newCol -= 2;
        else if (direction === 'R') newCol += 2;
        else if (direction === 'F') newRow += (player === 'A' ? 2 : -2);
        else if (direction === 'B') newRow += (player === 'A' ? -2 : 2);
    } else if (charType === 'H2') {
        if (direction === 'FL') { newRow += (player === 'A' ? 2 : -2); newCol -= 2; }
        else if (direction === 'FR') { newRow += (player === 'A' ? 2 : -2); newCol += 2; }
        else if (direction === 'BL') { newRow += (player === 'A' ? -2 : 2); newCol -= 2; }
        else if (direction === 'BR') { newRow += (player === 'A' ? -2 : 2); newCol += 2; }
    }

    // Ensure new position is within bounds
    if (newRow < 0 || newRow >= gameState.grid.length || newCol < 0 || newCol >= gameState.grid[0].length) {
        return false; // Invalid move
    }

    // Ensure new position is either empty or occupied by the opponent
    const targetCell = gameState.grid[newRow][newCol];
    if (targetCell && targetCell.startsWith(player)) {
        return false; // Invalid move
    }

    // Execute move
    gameState.grid[charRow][charCol] = '';
    gameState.grid[newRow][newCol] = character;
    gameState.moveHistory.push(`${character} moved ${direction}`);

    // Switch player turn
    gameState.currentPlayer = player === 'A' ? 'B' : 'A';

    // Check for win condition
    checkWinCondition();
    if (gameState.winner) {
        return 'win';
    }

    return true;
}

// Function to reset the game state
function resetGameState() {
    gameState = {
        grid: [
            ['A-P1', 'A-P2', 'A-H1', 'A-H2', 'A-P3'],
            ['', '', '', '', ''],
            ['', '', '', '', ''],
            ['', '', '', '', ''],
            ['B-P1', 'B-P2', 'B-H1', 'B-H2', 'B-P3']
        ],
        currentPlayer: 'A',
        moveHistory: [],
        winner: null,
    };
}

wss.on('connection', (ws) => {
    console.log('A new client connected');
    ws.send(JSON.stringify({ type: 'init', grid: gameState.grid, currentPlayer: gameState.currentPlayer, moveHistory: gameState.moveHistory }));

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'move') {
            const result = validateAndExecuteMove(data.move);

            if (result === true) {
                broadcastGameState();
            } else if (result === 'win') {
                broadcastGameState();
            } else if (result === 'wrongPlayer') {
                ws.send(JSON.stringify({ type: 'error', message: 'It\'s not your turn!' }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
            }
        } else if (data.type === 'newGame') {
            resetGameState();
            broadcastGameState();
        }
    });

    ws.on('close', () => {
        console.log('A client disconnected');
    });
});
