import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import useWindowSize from "react-use/lib/useWindowSize";
import Confetti from "react-confetti";
import { CircleX } from "lucide-react";

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
  const [username, setUsername] = useState(() => {
    // getting stored value
    const saved = localStorage.getItem("username");
    const initialValue = JSON.parse(saved);
    return initialValue || "";
  });
  const [popup, setPopup] = useState(false);
  const [playerJoined, setPlayerJoined] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

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
      socket.on("CANT_START", handleCantStart);
      socket.on("PLAYER_LEFT", handleLeft);
      socket.on("GAME_RESTARTED", handleGameRestarted);
      socket.on("NO_WINNER", handleNoWinner);

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
        socket.off("CANT_START", handleCantStart);
        socket.off("PLAYER_LEFT", handleLeft);
        socket.off("GAME_RESTARTED", handleGameRestarted);
        socket.off("NO_WINNER", handleNoWinner);
      };
    };
    return setupSocketListeners();
  }, []);

  useEffect(() => {
    localStorage.setItem("username", JSON.stringify(username));
  }, [username]);

  const handleMessages = ({ message, username = "Anonyme" }) =>
    setMessages((prev) => [...prev, `${username} : ${message}`]);


  const handleRoomCreated = ({ roomCode }) => {
    setRoomCode(roomCode);
    setIsCreator(true);
    setMessages((prev) => [...prev, `Room créée : ${roomCode}`]);
  };

  const handlePlayerJoined = ({ message }) => setMessages((prev) => [...prev, message]);

  const handleReadyToStart = ({ message }) => {
    setPlayerJoined(true);
    setMessages((prev) => [...prev, message]);
  };

  const handleCantStart = ({ message }) => setMessages((prev) => [...prev, message]);

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
    setGameEnded(true);
  };

  const handleJoinError = ({ message }) => setMessages((prev) => [...prev, `Erreur : ${message}`]);

  const handleMoveError = ({ message }) => setMessages((prev) => [...prev, `Erreur : ${message}`]);

  const handlePlayerColor = ({ color }) => setMessages((prev) => [...prev, `Vous jouez avec la couleur : ${color}`]);

  const handleLeft = ({ message }) => setMessage((prev) => [...prev, message])

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
      socket.emit("SEND_MESSAGE", roomCode || currentRoom, tchat.trim(), username);
      setTchat("");
    }
  };

  const handleReplay = () => {
    socket.emit("RESTART_GAME", roomCode);
  };

  const handleGameRestarted = ({ message }) => {
    setPopup(false);
    setConfetti(false);
    setMessages((prev) => [...prev, message]);
    setGameEnded(false);
    setGameStarted(true);
  }

  const handleNoWinner = ({ message }) => {
    setMessages((prev) => [...prev, message]);
    setPopup(true);
    setGameEnded(true);
  }


  const popUp = () => {
    if (popup) {
      return (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg w-6/12 flex flex-col gap-4 relative">
            <CircleX className="absolute top-2 right-2 hover:cursor-pointer" onClick={() => setPopup(!popup)} />
            <h2 className="text-3xl font-bold">Partie terminée</h2>
            <p className="text-xl">Bravo {playerTurn?.username} !</p>
            <div className="gap-2 flex">
              <button onClick={() => window.location.reload()} className="bg-blue-500 p-2 rounded-lg" >Revenir au menu</button>
              <button className="bg-yellow-500 p-2 rounded-lg" onClick={handleReplay}>Rejouer une partie</button>
            </div>
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
            {!roomCode && (
              <>
                <input
                  className="px-4 py-2 rounded-lg text-black"
                  placeholder="Code de la room"
                  value={currentRoom}
                  onChange={(e) => setCurrentRoom(e.target.value)}
                />

                <button className="bg-yellow-500 p-2 rounded-lg" onClick={joinRoom}>
                  Rejoindre la room
                </button>
              </>
            )}

            {!roomCode && (
              <button className="bg-green-500 p-2 rounded-lg" onClick={createRoom}>
                Créer une room
              </button>
            )}
            {isCreator && roomCode && !playerJoined && (
              <button className="bg-slate-400 p-2 rounded-lg flex gap-2 items-center" disabled>
                <svg aria-hidden="true" class="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-white" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                  <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                </svg>
                En attente d'un joueur...
              </button>
            )}
            {isCreator && roomCode && playerJoined && (
              <button className="bg-blue-500 p-2 rounded-lg" onClick={startGame}>
                Démarrer la partie
              </button>
            )}
          </div>
        ) : (
          <div>
            <h2>Tour de : {playerTurn?.username}</h2>
            <div className="grid grid-cols-7 gap-1">{renderGameBoard()}</div>

            {gameEnded && !popup && (
              <div className="top-2 left-2 absolute gap-2 flex">
                <button className="bg-yellow-500 p-2 rounded-lg" onClick={() => setPopup(!popup)}>Ouvrir la popup de fin</button>
                <button className="bg-red-400 p-2 rounded-lg" onClick={() => setConfetti(!confetti)}>{confetti ? 'Arrêter' : 'Allumer'} les confettis</button>
              </div>
            )}
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
      </div >
    </>
  );
}

export default App;
