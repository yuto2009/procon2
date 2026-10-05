import { useEffect, useRef } from "react";
import Phaser from "phaser";

function PhaserGame() {
    const gameRef = useRef(null);

    useEffect(() => {
        const config = {
            type: Phaser.AUTO,

            width: 800,
            height: 600,

            parent: gameRef.current,

            backgroundColor: "#222222",

            scene: {
                create() {
                    this.add.text(250, 280, "Hello Phaser 3!", {
                        fontSize: "32px",
                        color: "#ffffff",
                    });
                },
            },
        };

        const game = new Phaser.Game(config);

        return () => {
            game.destroy(true);
        };
    }, []);

    return <div ref={gameRef}></div>;
}

export default PhaserGame;