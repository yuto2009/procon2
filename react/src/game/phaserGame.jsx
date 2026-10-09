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
            physics: {
                default: "arcade",
                arcade: {gravity: { y: 1200}, debug: false},
            },
                        pixelArt: true,      // 拡大してもにじまない
            roundPixels: true,   // カメラ追従でドットがちらつかない
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