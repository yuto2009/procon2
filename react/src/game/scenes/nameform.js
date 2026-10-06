import Phaser from "phaser";
const socket = window.socket;

export default class NameForm extends Phaser.Scene {
    constructor() {
        super("NameForm");
    }

    create() {
        this.cameras.main.setBackgroundColor("#222222");

        this.add.text(400, 60, "名前を入力", {
            fontSize: "28px", color: "#ffffff"
        }).setOrigin(0.5);

        const nameInput = this.add.dom(400, 110, "input", {
            width: "240px", height: "30px", fontSize: "24px", padding: "4px 10px"
        });
        nameInput.node.placeholder = "Enter your name";
        nameInput.node.maxLength = 12;

        const makeButton = (x, y, label, onClick) => {
            const btn = this.add.text(x, y, label, {
                fontSize: "28px", color: "#ffffff", backgroundColor: "#444444",
                padding: { left: 24, right: 24, top: 12, bottom: 12 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#666666" }));
            btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#444444" }));
            btn.on("pointerdown", onClick);
            return btn;
        };

        // 左:ルームを作る
        makeButton(200, 230, "ルームを作る", () => {
            const name = nameInput.node.value.trim();
            if (!name) return alert("名前を入力してください");

            this.registry.set("playerName", name);
            this.registry.set("roomId", null);
            this.registry.set("opponentName", null);
            socket.emit("setName", name);
            this.scene.start("WaitingScene");
        });

        // 右:ルームに入る
        this.add.text(600, 190, "ルームID", {
            fontSize: "20px", color: "#aaaaaa"
        }).setOrigin(0.5);

        const roomInput = this.add.dom(600, 230, "input", {
            width: "200px", height: "30px", fontSize: "24px", padding: "4px 10px"
        });
        roomInput.node.placeholder = "4桁のID";
        roomInput.node.maxLength = 4;
        roomInput.node.inputMode = "numeric";

        makeButton(600, 310, "ルームに入る", () => {
            const name = nameInput.node.value.trim();
            const roomId = roomInput.node.value.trim();
            if (!name) return alert("名前を入力してください");
            if (!roomId) return alert("ルームIDを入力してください");

            this.registry.set("playerName", name);
            socket.emit("joinroom", { name, roomId });
            // 遷移は、サーバーから "joined" が届いてから行う
        });

        // 入室成功 → 待機画面へ
        const onJoined = (data) => {
            this.registry.set("roomId", data.roomId);
            this.registry.set("opponentName", data.hostName);
            this.scene.start("WaitingScene");
        };
        const onError = (msg) => alert(msg);

        socket.on("joined", onJoined);
        socket.on("errorMessage", onError);

        this.events.once("shutdown", () => {
            socket.off("joined", onJoined);
            socket.off("errorMessage", onError);
        });
    }
}