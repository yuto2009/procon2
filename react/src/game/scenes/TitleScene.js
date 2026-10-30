import Phaser from "phaser";
const socket = window.socket;
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

            this.scene.start("NameForm");
        });
        // TitleScene の create() 内
        this.socket = window.socket;
        this.onSavedRoom = (data) => {
            if (!data) return;
            const { roomId, members } = data;
            this.add.text(400, 400, `前回のルーム: ${roomId}(${members.join(" / ")})`, {
                fontSize: "20px", color: "#ffffff",
            }).setOrigin(0.5);
            // クリックで復帰
            const btn = this.add.text(400, 440, "[ 戻る ]", { fontSize: "20px", color: "#66ffff" })
                .setOrigin(0.5).setInteractive();
            btn.on("pointerdown", () => this.socket.emit("rejoinSaved"));
        };

        this.onJoined = ({ roomId, hostName, name, LastPosition, stage }) => {
            if (!this.sys || !this.sys.isActive()) return;
            this.registry.set("playerName", name);
            this.registry.set("roomId", roomId);
            this.registry.set("opponentName", hostName ?? null);
            this.registry.set("LastPosition",LastPosition ?? null);
            this.registry.set("stage", stage ?? null);
            this.scene.start("WaitingScene");
        };
        const cleanup = () => {
            this.socket.off("joined", this.onJoined);
            this.socket.off("savedRoom", this.onSavedRoom);
        }
        this.events.once("shutdown", cleanup);
        this.events.once("destroy", cleanup);
        this.socket.once("joined", this.onJoined);
        this.socket.on("savedRoom", this.onSavedRoom);
        this.socket.emit("getSavedRoom");
        // 動作確認用(確認が終わったら消す)
        // 動作確認用(確認が終わったら消す)
this.input.keyboard.once("keydown-B", () => {
    this.registry.set("bossType", "boss1");
    this.scene.start("BossScene");
});
this.input.keyboard.once("keydown-N", () => {
    this.registry.set("bossType", "boss2");   // Boss2 を作って登録したあとで使える
    this.scene.start("BossScene");
});
        this.input.keyboard.once("keydown-G", () => this.scene.start("GameScene"));
    }
}