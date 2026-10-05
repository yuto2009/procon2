import Phaser from "phaser";

export default class WaitingScene extends Phaser.Scene {
    constructor() {
        super("WaitingScene");
    }

    create() {
        this.cameras.main.setBackgroundColor("#222222");

        // タイトル
        this.add.text(400, 120, "MULTIPLAYER", {
            fontSize: "48px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        // 待機メッセージ
        this.add.text(400, 220, "プレイヤーを待っています...", {
            fontSize: "28px",
            color: "#ffffff"
        }).setOrigin(0.5);

        // プレイヤー1
        this.add.text(400, 300, "PLAYER 1  ✓", {
            fontSize: "24px",
            color: "#66ff66"
        }).setOrigin(0.5);

        // プレイヤー2
        this.add.text(400, 350, "PLAYER 2  待機中...", {
            fontSize: "24px",
            color: "#aaaaaa"
        }).setOrigin(0.5);
    }
}