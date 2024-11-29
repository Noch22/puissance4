import { useState } from 'react'
import { io } from 'socket.io-client'

const socket = io("http://localhost:3000");
socket.emit('chat message', 'test');

function App() {

  return (
    <>
      <div>Hello</div>
    </>
  )
}

export default App
