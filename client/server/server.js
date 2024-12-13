const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

// Création du serveur Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // cors: {
  //   origin: "http://localhost:5173",
  // },
});

app.use(express.static(path.join(__dirname, "../dist")));

// Pour toute route non gérée, retourner l'index.html de Vite
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
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

  room.currentPlayer =
    room.currentPlayer.id === room.players[0].id
      ? room.players[1]
      : room.players[0];
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
  console.log(`[INFO] Un joueur est connecté : ${socket.id}`);

  socket.on("SEND_MESSAGE", (roomCode, message, username) => {
    io.to(roomCode).emit("NEW_MESSAGE", { message: message, username: username });
  });

  // Création d'une room
  socket.on("CREATE_ROOM", (username) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [
        {
          id: socket.id,
          username: username,
        },
      ],
      gameState: JSON.parse(JSON.stringify(initialGameState)),
      currentPlayer: { id: socket.id, username: username },
    };
    socket.join(roomCode);
    socket.emit("ROOM_CREATED", { roomCode });
  });

  // Rejoindre une room
  socket.on("JOIN_ROOM", (roomCode, username) => {
    const room = rooms[roomCode];
    if (room && room.players.length < 2) {
      room.players.push({
        id: socket.id,
        username: username,
      });
      socket.join(roomCode);

      const playerColor = room.players[0].id === socket.id ? "yellow" : "red";
      socket.emit("PLAYER_COLOR", { color: playerColor });

      io.to(roomCode).emit("PLAYER_JOINED", {
        message: `Un joueur a rejoint la room !`,
        color: playerColor,
      });

      if (room.players.length === 2) {
        io.to(roomCode).emit("READY_TO_START", {
          message: "Les deux joueurs sont prêts, la partie peut commencer !",
        });
      }
    } else {
      socket.emit("PLAYER_JOINED", {
        message: "La room est pleine ou inexistante.",
      });
    }
  });

  // Démarrer la partie
  socket.on("START_GAME", (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players[0].id === socket.id) {
      io.to(roomCode).emit("GAME_STARTED", { message: "La partie commence !" });
      io.to(roomCode).emit("TURN", { currentPlayer: room.currentPlayer });
    }
  });

// Fonction utilitaire : Vérifier si toutes les colonnes sont pleines
function checkDraw(gameState) {
  // Si toutes les cellules de la première ligne sont non nulles, le plateau est plein
  return gameState[0].every((cell) => cell !== null);
}

// Gestion des coups joués
socket.on("PLAY_MOVE", ({ roomCode, col }) => {
  const room = rooms[roomCode];
  if (!room || !room.players.some((player) => player.id === socket.id)) {
    socket.emit("MOVE_ERROR", { message: "Vous n'êtes pas dans cette room." });
    return;
  }

  if (room.currentPlayer.id !== socket.id) {
    socket.emit("MOVE_ERROR", { message: "Ce n'est pas votre tour." });
    return;
  }

  const playerColor = room.players[0].id === socket.id ? "yellow" : "red";

  let row = -1;
  for (let r = room.gameState.length - 1; r >= 0; r--) {
    if (room.gameState[r][col] === null) {
      row = r;
      break;
    }
  }

  if (row === -1) {
    socket.emit("MOVE_ERROR", { message: "Cette colonne est pleine." });
    return;
  }

  room.gameState[row][col] = playerColor;

  const winner = checkWinner(room.gameState);
  if (winner) {
    io.to(roomCode).emit("UPDATE_GAME", { state: room.gameState });
    io.to(roomCode).emit("GAME_OVER", { winner });
    return;
  }

  // Vérifier si le jeu est un nul (égalité)
  if (checkDraw(room.gameState)) {
    io.to(roomCode).emit("UPDATE_GAME", { state: room.gameState });
    io.to(roomCode).emit("NO_WINNER", { message: "Le jeu est terminé, pas de vainqueur." });
    return;
  }

  nextPlayer(roomCode);
  io.to(roomCode).emit("UPDATE_GAME", { state: room.gameState });
});
  socket.on("RESTART_GAME", (roomCode) => {
    const room = rooms[roomCode];
    if (!room || !room.players.some((player) => player.id === socket.id)) {
      socket.emit("RESTART_ERROR", { message: "Vous n'êtes pas dans cette room." });
      return;
    }

    if (room.players[0].id === socket.id) {
      room.gameState = JSON.parse(JSON.stringify(initialGameState));
      room.currentPlayer = room.players[0];
      io.to(roomCode).emit("GAME_RESTARTED", { message: "La partie a été redémarrée." });
      io.to(roomCode).emit("UPDATE_GAME", { state: room.gameState });
      io.to(roomCode).emit("TURN", { currentPlayer: room.currentPlayer });
    }
  });


  // Déconnexion d'un joueur
  socket.on("disconnect", () => {
    console.log(`[INFO] Un joueur a quitté : ${socket.id}`);
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.players.some((player) => player.id === socket.id)) {
        room.players = room.players.filter((player) => player.id !== socket.id);
        io.to(roomCode).emit("PLAYER_LEFT", { message: "Un joueur a quitté." });

        if (room.players.length === 0) {
          delete rooms[roomCode];
        }
        break;
      }
    }
  });
});
