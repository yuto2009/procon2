import { useEffect, useRef } from "react";
import Phaser from "phaser";
import TitleScene from "./scenes/TitleScene";

function PhaserGame() {
    const gameRef = useRef(null);

    useEffect(() => {
        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,

            parent: gameRef.current,

            backgroundColor: "#222222",

            scene: [
                TitleScene
            ]
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return <div ref={gameRef}></div>;
}

export default PhaserGame;