import Phaser from "phaser";

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super("TitleScene");
    }

    create() {
        this.cameras.main.setBackgroundColor("#222222");

        this.add.text(400, 180, "MY GAME", {
            fontSize: "64px",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        const startButton = this.add.text(400, 300, "GAME START", {
            fontSize: "32px",
            color: "#ffffff",
            backgroundColor: "#444444",
            padding: {
                left: 30,
                right: 30,
                top: 15,
                bottom: 15
            }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

        startButton.on("pointerover", () => {
            startButton.setStyle({
                backgroundColor: "#666666"
            });
        });

        startButton.on("pointerout", () => {
            startButton.setStyle({
                backgroundColor: "#444444"
            });
        });

        startButton.on("pointerdown", () => {
            this.scene.start("WaitingScene");
        });
    }
}