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

        const waitingText = this.add.text(400, 230,opponentName ? "準備完了" : "プレイヤーを待っています...", {
            fontSize: "24px", color: opponentName ? "#66ff66" : "#ffffff"
        }).setOrigin(0.5);
        const setReady = () => {
            waitingText.setText("準備完了");
            waitingText.setColor("#66ff66");
        };
        const setWaiting = () =>{
            waitingText.setText("プレイヤーを待っています...");
            waitingText.setColor("#ffffff");
        };
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
            setReady();
        };

        // 相手が抜けたら待機表示に戻す
        const onPlayerLeft = () => {
            player2Text.setText("PLAYER 2  待機中...");
            player2Text.setColor("#aaaaaa");
            setWaiting();
        };
        const disroom = this.add.dom(400, 500, "button", {
            width: "200px", height: "40px", fontSize: "20px", backgroundColor: "#444444", color: "#ffffff"
        }, "ルームを抜ける");
        disroom.node.addEventListener("click", () => {
            console.log("ルームを抜ける");
            socket.emit("leaveRoom");
            this.registry.set("roomId", null);
            this.registry.set("opponentName", null);
            this.registry.set("playerName", null);
            this.scene.start("TitleScene");
        });
        socket.on("playerLeft", onPlayerLeft);
        socket.on("writingscene", onWritingScene);
        socket.on("joinroom", onJoinRoom);
        
        this.events.once("shutdown", () => {
            socket.off("writingscene", onWritingScene);
            socket.off("joinroom", onJoinRoom);
            socket.off("playerLeft", onPlayerLeft);
        });
    }
}