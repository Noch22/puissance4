import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import useWindowSize from 'react-use/lib/useWindowSize'
import Confetti from 'react-confetti'


// Connexion au serveur WebSocket
const socket = io("http://localhost:8080");

function App() {
  const [roomCode, setRoomCode] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [gameState, setGameState] = useState(Array(6).fill().map(() => Array(7).fill(null)));
  const [messages, setMessages] = useState([]);
  const [playerTurn, setPlayerTurn] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const { width, height } = useWindowSize()
  const [tchat, setTchat] = useState([]);

  // particles options 
 

  // Gestion des événements socket.io
  useEffect(() => {
    const setupSocketListeners = () => {
      socket.on("ROOM_CREATED", handleRoomCreated);
      socket.on("PLAYER_JOINED", handlePlayerJoined);
      socket.on("READY_TO_START", handleReadyToStart);
      socket.on("GAME_STARTED", handleGameStarted);
      socket.on("UPDATE_GAME", handleUpdateGame);
      socket.on("TURN", handleTurn);
      socket.on("GAME_OVER", handleGameOver);
      socket.on("JOIN_ERROR", handleJoinError);
      socket.on("MOVE_ERROR", handleMoveError);
      socket.on("PLAYER_COLOR", handlePlayerColor);
      socket.on("NEW_MESSAGE", handleMessages);
  
      // Nettoyage du listener à la destruction du composant ou lors du changement de dépendances
      return () => {
        socket.off("ROOM_CREATED", handleRoomCreated);
        socket.off("PLAYER_JOINED", handlePlayerJoined);
        socket.off("READY_TO_START", handleReadyToStart);
        socket.off("GAME_STARTED", handleGameStarted);
        socket.off("UPDATE_GAME", handleUpdateGame);
        socket.off("TURN", handleTurn);
        socket.off("GAME_OVER", handleGameOver);
        socket.off("JOIN_ERROR", handleJoinError);
        socket.off("MOVE_ERROR", handleMoveError);
        socket.off("PLAYER_COLOR", handlePlayerColor);
        socket.off("NEW_MESSAGE", handleMessages);
      };
    };
  
    // Exécuter le nettoyage quand le composant est démonté ou les dépendances changent
    return setupSocketListeners();
  }, []);


  const handleMessages = ({ message }) => {
    setMessages((prev) => [...prev, message]);
  }
  // Gestion des événements socket.io
  const handleRoomCreated = ({ roomCode }) => {
    setRoomCode(roomCode);
    setMessages((prev) => [...prev, `Room créée : ${roomCode}`]);
    setIsCreator(true);
    console.log("Côté client : roomCodezROOM_CREATED" + roomCode);
  };

  const handlePlayerJoined = ({ message }) => {
    setMessages((prev) => [...prev, message]);
    if (!isCreator) setPlayerColor("red");
  };

  const handleReadyToStart = ({ message }) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleGameStarted = ({ message }) => {
    setMessages((prev) => [...prev, message]);
    setGameStarted(true);
    console.log("Côté client : currentRoom" + currentRoom);
    console.log("Côté client : roomCode" + roomCode);
  };

  const handleUpdateGame = ({ state }) => {
    if (Array.isArray(state) && state.length === 6 && state[0].length === 7) {
      setGameState(state);
    }
  };

  const handleTurn = ({ currentPlayer }) => {
    setPlayerTurn(currentPlayer);
  };

  const handleGameOver = ({ winner }) => {
    setMessages((prev) => [...prev, `Le joueur ${winner} a gagné !`]);
    setConfetti(true);
    // setGameStarted(false);
  };

  const handleJoinError = ({ message }) => {
    setMessages((prev) => [...prev, `Erreur : ${message}`]);
  };

  const handleMoveError = ({ message }) => {
    setMessages((prev) => [...prev, `Erreur : ${message}`]);
  };

  const handlePlayerColor = ({ color }) => {
    setMessages((prev) => [...prev, `Vous jouez avec la couleur : ${color}`]);
    setRoomCode(currentRoom);
  };

  // Fonctions liées aux actions
  const createRoom = () => socket.emit("CREATE_ROOM");

  const joinRoom = () => {
    if (!currentRoom) {
      setMessages((prev) => [...prev, "Veuillez entrer un code de room."]);
      return;
    }
    socket.emit("JOIN_ROOM", currentRoom);
  };

  const startGame = () => {
    if (isCreator) socket.emit("START_GAME", roomCode);
  };

  const playMove = (roomCode , col) => {
    if (!gameStarted) {
      setMessages((prev) => [...prev, "La partie n'a pas encore démarré."]);
      return;
    }

    if (playerTurn !== socket.id) {
      setMessages((prev) => [...prev, "Ce n'est pas votre tour."]);
      return;
    }
    console.log("Côté client : currentRoom", currentRoom);
    console.log("Côté client : PLAY_MOVE", roomCode, col);
    socket.emit("PLAY_MOVE", { roomCode, col });
  };

  const handleTchat = (e) => {
    setTchat(e.target.value)
  }

  const sendMessage = (e) => {
    e.preventDefault()
    socket.emit("SEND_MESSAGE", roomCode || currentRoom, tchat)
    setTchat('')
  }

  // Affichage de la grille
  const renderGameBoard = () => {
    if (!Array.isArray(gameState) || gameState.length !== 6 || gameState[0].length !== 7) {
      return <div>Chargement...</div>;
    }

    return (
      <>
        {
          confetti && <Confetti
            width={width}
            height={height}
          />
        }
      <div className="grid grid-cols-7 gap-1">
        {gameState.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="w-14 h-14 border-2 border-gray-300 rounded-full flex items-center justify-center cursor-pointer"
              onClick={() => playMove(roomCode ? roomCode : currentRoom, colIndex)}
            >
              {cell && (
                <div
                  className={`w-12 h-12 rounded-full ${
                    cell === "yellow" ? "bg-yellow-500" : "bg-red-500"
                  }`}
                />
              )}
            </div>
          ))
        )}
      </div>
    </>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">KingPuissance 4</h1>

      {!gameStarted ? (
        <div>
          {!roomCode ? (
            <button onClick={createRoom} className="bg-green-500 p-2 rounded-lg">
              Créer une room
            </button>
          ) : (
            <div>
              <p>Code de la room : {roomCode}</p>
              <button onClick={startGame} className="bg-blue-500 p-2 rounded-lg" disabled={!isCreator}>
                Démarrer la partie
              </button>
            </div>
          )}

          <div className="mt-6">
            <input
              className="px-4 py-2 text-black rounded-lg"
              placeholder="Code de la room"
              value={currentRoom}
              name="roomCode"
              onChange={(e) => setCurrentRoom(e.target.value)}
            />
            <button onClick={joinRoom} className="bg-yellow-500 p-2 rounded-lg ml-2">
              Rejoindre la room
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2>Tour de : {playerTurn}, vous êtes {socket.id}</h2>
          {renderGameBoard()}
        </div>
      )}

      <div className="absolute top-0 right-0 p-8 h-full w-1/4 bg-blue-900 overflow-scroll overflow-x-hidden">
      <h2 className="text-xl mb-4">Tchat</h2>
        <ul>
          {messages.map((msg, index) => (
            <li key={index} className="text-sm text-gray-300">
              {msg}
            </li>
          ))}
        </ul>

        <input type="text" onChange={handleTchat} value={tchat} className="absolute left-0 text-blue-950 bottom-6 w-full" placeholder="Entrez votre message..." />
        <button className="absolute left-0 text-white bg-blue-500 bottom-0 w-full" onClick={sendMessage}>Envoyer</button>
        </div>
    </div>
  );
}

export default App;
