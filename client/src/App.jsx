import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import useWindowSize from "react-use/lib/useWindowSize";
import Confetti from "react-confetti";

// Connexion au serveur WebSocket
const socket = io(
  // "http://localhost:8080"
);

function App() {
  const [roomCode, setRoomCode] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [gameState, setGameState] = useState(Array(6).fill().map(() => Array(7).fill(null)));
  const [messages, setMessages] = useState([]);
  const [playerTurn, setPlayerTurn] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const { width, height } = useWindowSize();
  const [tchat, setTchat] = useState("");
  const [username, setUsername] = useState("");
  const [popup, setPopup] = useState(false);

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

    return setupSocketListeners();
  }, []);

  const handleMessages = ({ message }) => setMessages((prev) => [...prev, message]);

  const handleRoomCreated = ({ roomCode }) => {
    setRoomCode(roomCode);
    setIsCreator(true);
    setMessages((prev) => [...prev, `Room créée : ${roomCode}`]);
  };

  const handlePlayerJoined = ({ message }) => setMessages((prev) => [...prev, message]);

  const handleReadyToStart = ({ message }) => setMessages((prev) => [...prev, message]);

  const handleGameStarted = ({ message }) => {
    setMessages((prev) => [...prev, message]);
    setGameStarted(true);
  };

  const handleUpdateGame = ({ state }) => setGameState(state);

  const handleTurn = ({ currentPlayer }) => setPlayerTurn(currentPlayer);

  const handleGameOver = ({ winner }) => {
    setMessages((prev) => [...prev, `Le joueur ${winner} a gagné !`]);
    setConfetti(true);
    setPopup(true);
  };

  const handleJoinError = ({ message }) => setMessages((prev) => [...prev, `Erreur : ${message}`]);

  const handleMoveError = ({ message }) => setMessages((prev) => [...prev, `Erreur : ${message}`]);

  const handlePlayerColor = ({ color }) => setMessages((prev) => [...prev, `Vous jouez avec la couleur : ${color}`]);

  const createRoom = () => {
    if (!username.trim()) {
      setMessages((prev) => [...prev, "Veuillez entrer un pseudo."]);
      return;
    }
    socket.emit("CREATE_ROOM", username.trim());
  };

  const joinRoom = () => {
    if (!currentRoom.trim() || !username.trim()) {
      setMessages((prev) => [...prev, "Veuillez entrer un pseudo et un code de room."]);
      return;
    }
    socket.emit("JOIN_ROOM", currentRoom.trim(), username.trim());
  };

  const startGame = () => {
    if (isCreator) socket.emit("START_GAME", roomCode);
  };

  const playMove = (roomCode, col) => {
    if (!gameStarted || playerTurn?.id !== socket.id) {
      setMessages((prev) => [...prev, "Ce n'est pas votre tour ou la partie n'a pas commencé."]);
      return;
    }
    socket.emit("PLAY_MOVE", { roomCode, col });
  };

  const handleTchat = (e) => setTchat(e.target.value);

  const sendMessage = (e) => {
    e.preventDefault();
    console.log(tchat.trim());
    if (tchat.trim()) {
      socket.emit("SEND_MESSAGE", roomCode || currentRoom, tchat.trim());
      setTchat("");
    }
  };

  const popUp = (currentPlayer) => {
    if (popup) {
      return (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg w-6/12 flex flex-col gap-4">
            <h2 className="text-3xl font-bold">Partie terminée</h2>
            <p className="text-xl">Bravo {playerTurn?.username} !</p>
            <button onClick={() => window.location.reload()} className="bg-blue-500 p-2 rounded-lg" >Rejouer une partie</button>
          </div>
        </div>
      );
  };
};

  const renderGameBoard = () =>
    gameState.map((row, rowIndex) =>
      row.map((cell, colIndex) => (
        <div
          key={`${rowIndex}-${colIndex}`}
          className="w-14 h-14 border-2 border-gray-300 rounded-full flex items-center justify-center cursor-pointer"
          onClick={() => playMove(roomCode || currentRoom, colIndex)}
        >
          {cell && <div className={`w-12 h-12 rounded-full ${cell === "yellow" ? "bg-yellow-500" : "bg-red-500"}`} />}
        </div>
      ))
    );

  return (
    <>
    {popUp()}
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">

      <h1 className="text-3xl font-bold mb-4">KingPuissance 4</h1>
      {confetti && <Confetti width={width} height={height} />}
      {roomCode && <p>Code de la room : {roomCode}</p>}
      {!gameStarted ? (
        <div className="flex flex-col gap-2">
          <input
            className="px-4 py-2 rounded-lg text-black"
            placeholder="Entrez votre pseudo"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="px-4 py-2 rounded-lg text-black"
            placeholder="Code de la room"
            value={currentRoom}
            onChange={(e) => setCurrentRoom(e.target.value)}
          />
          <button className="bg-yellow-500 p-2 rounded-lg" onClick={joinRoom}>
            Rejoindre la room
          </button>
          {!roomCode && (
            <button className="bg-green-500 p-2 rounded-lg" onClick={createRoom}>
              Créer une room
            </button>
          )}
          {isCreator && roomCode && (
            <button className="bg-blue-500 p-2 rounded-lg" onClick={startGame}>
              Démarrer la partie
            </button>
          )}
        </div>
      ) : (
        <div>
          <h2>Tour de : {playerTurn?.username}</h2>
          <div className="grid grid-cols-7 gap-1">{renderGameBoard()}</div>
        </div>
      )}
      <div className="absolute top-0 right-0 p-8 h-full w-1/4 bg-blue-900 overflow-scroll overflow-x-hidden">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            className="flex-grow p-2 rounded-lg text-black"
            placeholder="Message..."
            value={tchat}
            onChange={handleTchat}
          />
          <button className="bg-blue-500 px-4 py-2 rounded-lg">Envoyer</button>
        </form>
        <ul className="mt-2 text-sm">
          {messages.map((msg, idx) => (
            <li key={idx}>{msg}</li>
          ))}
        </ul>
      </div>
    </div>
    </>
  );
}

export default App;
