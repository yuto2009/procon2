import { useEffect, useRef } from "react";
import Phaser from "phaser";
import TitleScene from "./scenes/TitleScene";
import NameForm from "./scenes/nameform";
import WaitingScene from "./scenes/WaitingScene";
import GameScene from "./scenes/game";
function PhaserGame() {
    const gameRef = useRef(null);

    useEffect(() => {
        const config = {
            type: Phaser.AUTO,
            width: 800,
            height: 600,
            parent: gameRef.current,
            backgroundColor: "#222222",
            audio: { noAudio: true },
            dom: { createContainer: true },
            scene: [TitleScene, NameForm, WaitingScene,GameScene],
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return <div ref={gameRef}></div>;
}

export default PhaserGame;