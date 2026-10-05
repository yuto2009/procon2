import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import socketio from "socket.io-client";
import WaitingScene from "./scenes/WaitingScene";
const socket = socketio("http://localhost:3001", { withCredentials: true });
import TitleScene from "./scenes/TitleScene";
function PhaserGame() {
    const gameRef = useRef(null);
    useEffect(() => {
        socket.on("connect", () => {
            console.log("Connected to server");
        });
        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,

            parent: gameRef.current,

            backgroundColor: "#222222",

            scene: [
                TitleScene,
                WaitingScene
            ]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
            socket.off("connect");
        };
    }, []);

    return <div ref={gameRef}>
    </div>;
}

export default PhaserGame;