import { useState, useEffect } from "react";
import PhaserGame from "./game/PhaserGame";
import socketio from "socket.io-client";
const socket = socketio("http://localhost:3001", { withCredentials: true });
function App() {
  const [name,setName] = useState("");
      function startGame(value) {
          if(!value){
              alert("名前を入力してください");
              return;
          }
          setName(value);
          socket.emit("setName", value);
      }
      useEffect(() => {
          socket.on("connect", () => {
              console.log("Connected to server");
          });
          return () => {
              socket.off("connect");
          }
        },[]);
    return (
        <div>
           <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={() => startGame(name)}>Start Game</button>
        <div>
               <PhaserGame />

        </div>
        </div>
      
    );
}

export default App;