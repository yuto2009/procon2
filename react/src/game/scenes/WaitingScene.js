import Phaser from "phaser";
const socket = window.socket;

export default class WaitingScene extends Phaser.Scene {
    constructor() {
        super("WaitingScene");
    }

    create() {
        this.cameras.main.setBackgroundColor("#222222");

        const myName = this.registry.get("playerName");
        const roomId = this.registry.get("roomId");
        const opponentName = this.registry.get("opponentName");

        this.add.text(400, 100, "MULTIPLAYER", {
            fontSize: "48px", color: "#ffffff", fontStyle: "bold"
        }).setOrigin(0.5);

        // ルームID(ホストは後から届くので、まず "..." で作る)
        const roomText = this.add.text(400, 180, `ルームID: ${roomId ?? "..."}`, {
            fontSize: "28px", color: "#ffff66"
        }).setOrigin(0.5);

        this.add.text(400, 230, "プレイヤーを待っています...", {
            fontSize: "24px", color: "#ffffff"
        }).setOrigin(0.5);

        // 自分
        this.add.text(400, 300, `${myName} ✓`, {
            fontSize: "24px", color: "#66ff66"
        }).setOrigin(0.5);

        // 相手
        const player2Text = this.add.text(
            400, 350,
            opponentName ? `${opponentName} ✓` : "PLAYER 2  待機中...",
            { fontSize: "24px", color: opponentName ? "#66ff66" : "#aaaaaa" }
        ).setOrigin(0.5);

        // ホスト:ルームIDが届いたら書き換え
        const onWritingScene = (data) => {
            this.registry.set("roomId", data.roomId);
            roomText.setText(`ルームID: ${data.roomId}`);
        };

        // ホスト:参加者が来たら書き換え
        const onJoinRoom = (data) => {
            player2Text.setText(`${data.name} ✓`);
            player2Text.setColor("#66ff66");
        };

        // 相手が抜けたら待機表示に戻す
        const onPlayerLeft = () => {
            player2Text.setText("PLAYER 2  待機中...");
            player2Text.setColor("#aaaaaa");
        };

        socket.on("writingscene", onWritingScene);
        socket.on("joinroom", onJoinRoom);
        socket.on("playerLeft", onPlayerLeft);

        this.events.once("shutdown", () => {
            socket.off("writingscene", onWritingScene);
            socket.off("joinroom", onJoinRoom);
            socket.off("playerLeft", onPlayerLeft);
        });
    }
}