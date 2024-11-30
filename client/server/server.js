const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Création du serveur Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, 'dist')));

// Pour toute route non gérée, retourner l'index.html de Vite
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Port d'écoute du serveur
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Stockage des rooms et état initial du jeu
const rooms = {};
const initialGameState = Array(6).fill(null).map(() => Array(7).fill(null));

// Fonction utilitaire : Passer au joueur suivant
function nextPlayer(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.currentPlayer = room.currentPlayer === room.players[0] ? room.players[1] : room.players[0];
  io.to(roomCode).emit("TURN", { currentPlayer: room.currentPlayer });
}

// Fonction utilitaire : Générer un code de room unique
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Fonction utilitaire : Vérifier si un joueur a gagné
function checkWinner(gameState) {
  const directions = [
    { dr: 0, dc: 1 }, // Horizontal
    { dr: 1, dc: 0 }, // Vertical
    { dr: 1, dc: 1 }, // Diagonal droite
    { dr: 1, dc: -1 }, // Diagonal gauche
  ];

  const inBounds = (r, c) => r >= 0 && r < 6 && c >= 0 && c < 7;

  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (!gameState[r][c]) continue;
      const player = gameState[r][c];

      for (const { dr, dc } of directions) {
        let count = 0;
        for (let k = 0; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (inBounds(nr, nc) && gameState[nr][nc] === player) {
            count++;
          } else {
            break;
          }
        }
        if (count === 4) return player;
      }
    }
  }
  return null;
}

// Gestion des connexions WebSocket
io.on("connection", (socket) => {
  console.log("Un joueur est connecté :", socket.id);

  socket.on("SEND_MESSAGE", (roomCode, message) => {
    io.to(roomCode).emit("NEW_MESSAGE", { message: message });
  });


  // Création d'une room
  socket.on("CREATE_ROOM", () => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [socket.id],
      gameState: initialGameState.map(row => [...row]), // Copie de l'état initial
      currentPlayer: socket.id, // Le créateur de la room commence
    };
    socket.join(roomCode);
    socket.emit("ROOM_CREATED", { roomCode });
  });

  // Rejoindre une room
  socket.on("JOIN_ROOM", (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players.length < 2) {
      room.players.push(socket.id);
      socket.join(roomCode);

      // Envoyer la couleur du joueur
      const playerColor = room.players[0] === socket.id ? "yellow" : "red";
      socket.emit("PLAYER_COLOR", { color: playerColor });
      console.log("Joueur", socket.id, "a rejoint la room", roomCode, "avec la couleur", playerColor);

      io.to(roomCode).emit("PLAYER_JOINED", {
        message: `Un joueur a rejoint la room !`,
      });

      if (room.players.length === 2) {
        io.to(roomCode).emit("READY_TO_START", {
          message: "Les deux joueurs sont prêts, la partie peut commencer !",
        });
      }
    } else {
      socket.emit("PLAYER_JOINED", { message: "La room est pleine ou inexistante." });
    }
  });

  // Démarrer la partie
  socket.on("START_GAME", (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players[0] === socket.id) {
      io.to(roomCode).emit("GAME_STARTED", { message: "La partie commence !" });
      io.to(roomCode).emit("TURN", { currentPlayer: room.currentPlayer });
      console.log("tour de :", room.currentPlayer);
    }
  });

  // Gestion des coups joués
  socket.on("PLAY_MOVE", ({ roomCode, col }) => {
    console.log("PLAY_MOVE", roomCode, col);
    const room = rooms[roomCode];
    console.log(socket.id, "a joué", col);
    if (!room || !room.players.includes(socket.id)) {
      socket.emit("MOVE_ERROR", { message: "Vous n'êtes pas dans cette room." });
      return;
    }

    // Vérifier que c'est bien le tour du joueur
    if (room.currentPlayer !== socket.id) {
      socket.emit("MOVE_ERROR", { message: "Ce n'est pas votre tour." });
      return;
    }

    // Identifier la couleur du joueur
    const playerColor = room.players[0] === socket.id ? "yellow" : "red";

    // Trouver la première ligne vide en partant du bas
    let row = -1;
    for (let r = room.gameState.length - 1; r >= 0; r--) {
      if (room.gameState[r][col] === null) {
        row = r;
        break;
      }
    }

    // Si la colonne est pleine
    if (row === -1) {
      socket.emit("MOVE_ERROR", { message: "Cette colonne est pleine." });
      return;
    }

    // Mettre à jour la grille
    room.gameState[row][col] = playerColor;

    // Vérifier si le joueur a gagné
    const winner = checkWinner(room.gameState);
    if (winner) {
      io.to(roomCode).emit("UPDATE_GAME", { state: room.gameState });
      io.to(roomCode).emit("GAME_OVER", { winner });

      return;
    }

    // Passer au joueur suivant
    nextPlayer(roomCode);

    // Envoyer les mises à jour aux joueurs
    io.to(roomCode).emit("UPDATE_GAME", { state: room.gameState });
  });

  // Déconnexion d'un joueur
  socket.on("disconnect", () => {
    console.log("Un joueur a quitté :", socket.id);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter(player => player !== socket.id);
        io.to(roomCode).emit("PLAYER_LEFT", { message: "Un joueur a quitté la room." });

        if (room.players.length === 0) {
          delete rooms[roomCode];
        }
        break;
      }
    }
  });
});
