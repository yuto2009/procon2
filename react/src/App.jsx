import { useState, useEffect } from "react";
import PhaserGame from "./game/phaserGame";
function App() {
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
               <PhaserGame />

        </div>
        
      
    );
}

export default App;