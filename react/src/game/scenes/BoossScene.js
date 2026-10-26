import Phaser from "phaser";
import Fighter from "../combat/Fighter";
import { FPS } from "../combat/frameData";

const STEP = 1000 / FPS;

export default class BossScene extends Phaser.Scene {
    constructor() {
        super("BossScene");
    }

    preload() {
        this.load.spritesheet(
            "player",
            "/assets/player.png",
            { frameWidth: 96, frameHeight: 32 }
        );

        this.load.spritesheet(
            "enemy",
            "/assets/enemy.png",
            { frameWidth: 96, frameHeight: 32 }
        );
    }

    create() {
        // ボス部屋のサイズ
        const ROOM_WIDTH = 2400;
        const ROOM_HEIGHT = 600;

        this.cameras.main.setBackgroundColor("#17101e");

        this.physics.world.setBounds(
            0, 0, ROOM_WIDTH, ROOM_HEIGHT
        );

        this.cameras.main.setBounds(
            0, 0, ROOM_WIDTH, ROOM_HEIGHT
        );

        this.physics.world.resume();

        // =============================
        // 背景：ダンジョンの石壁
        // =============================

        for (let x = 0; x < ROOM_WIDTH; x += 160) {
            const wall = this.add.rectangle(
                x + 80,
                280,
                156,
                520,
                0x302538
            );

            wall.setStrokeStyle(2, 0x17101e);
            wall.setDepth(-2);
        }

        // 壁の装飾ライン
        this.add.rectangle(
            ROOM_WIDTH / 2,
            105,
            ROOM_WIDTH,
            22,
            0x594365
        ).setDepth(-1);

        this.add.rectangle(
            ROOM_WIDTH / 2,
            130,
            ROOM_WIDTH,
            5,
            0xc7a5ff
        ).setDepth(-1);

        // =============================
        // 床
        // =============================

        const ground = this.add.rectangle(
            ROOM_WIDTH / 2,
            580,
            ROOM_WIDTH,
            40,
            0x51475f
        );

        ground.setStrokeStyle(3, 0x81749a);

        this.physics.add.existing(ground, true);

        // =============================
        // 浮遊足場
        // =============================

        const platforms = [];

        const platformData = [
            { x: 850, y: 455, width: 220 },
            { x: 1350, y: 410, width: 260 }
        ];

        for (const p of platformData) {
            const platform = this.add.rectangle(
                p.x,
                p.y,
                p.width,
                18,
                0x81749a
            );

            platform.setStrokeStyle(3, 0x25232d);

            this.physics.add.existing(platform, true);

            platforms.push(platform);
        }

        // =============================
        // ボスの封印：仮の見た目
        // =============================

        this.add.circle(
            1900, 420,
            95,
            0x702b59,
            0.28
        );

        const seal = this.add.circle(
            1900, 420,
            72,
            0x35182f,
            0.9
        );

        seal.setStrokeStyle(6, 0xd45e8a);

        // 仮のボスのシルエット
        this.add.circle(
            1900, 375,
            35,
            0x211522
        );

        this.add.rectangle(
            1900, 445,
            76, 100,
            0x211522
        );

        this.add.text(
            1900, 300,
            "BOSS",
            {
                fontSize: "36px",
                color: "#ff7799",
                fontStyle: "bold"
            }
        ).setOrigin(0.5);

        this.add.text(
            1900, 520,
            "SEALED",
            {
                fontSize: "18px",
                color: "#e8d4ff"
            }
        ).setOrigin(0.5);

        // =============================
        // 2人分の開始位置を用意
        // =============================

        const spawn1X = 420;
        const spawn2X = 620;

        // 位置の目印
        this.add.circle(
            spawn1X, 555, 14, 0x66aaff, 0.85
        );

        this.add.circle(
            spawn2X, 555, 14, 0xffcc66, 0.85
        );

        this.add.text(
            spawn1X, 485,
            "PLAYER 1",
            {
                fontSize: "16px",
                color: "#66aaff"
            }
        ).setOrigin(0.5);

        this.add.text(
            spawn2X, 485,
            "PLAYER 2",
            {
                fontSize: "16px",
                color: "#ffcc66"
            }
        ).setOrigin(0.5);

        // ルーム作成者と参加者で開始位置を分ける
        const role = this.registry.get("worldRole") ?? "host";

        const spawnX = role === "guest"
            ? spawn2X
            : spawn1X;

        // 自分のキャラクター
        this.player = new Fighter(
            this,
            spawnX,
            520,
            {
                color: role === "guest" ? 0xffcc66 : 0x66aaff,
                texture: "player"
            }
        );

        // 地面の当たり判定
        this.physics.add.collider(
            this.player.sprite,
            ground
        );

        // 足場は上からのみ着地できる
        for (const platform of platforms) {
            this.physics.add.collider(
                this.player.sprite,
                platform,
                undefined,
                (actor, platformObject) => {
                    const body = actor.body;
                    const platformBody = platformObject.body;

                    if (!body || !platformBody) {
                        return false;
                    }

                    const previousBottom =
                        body.prev.y + body.height;

                    return (
                        body.velocity.y >= 0 &&
                        previousBottom <= platformBody.top + 4
                    );
                }
            );
        }

        // カメラ
        this.cameras.main.startFollow(
            this.player.sprite,
            true,
            0.1,
            0.1
        );

        // 画面に固定するタイトル
        this.add.text(
            400, 12,
            "THE SEALED CHAMBER",
            {
                fontSize: "22px",
                color: "#ffffff",
                fontStyle: "bold"
            }
        )
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(20);

        this.add.text(
            400, 44,
            "協力ボス戦エリア",
            {
                fontSize: "16px",
                color: "#d4c4e5"
            }
        )
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(20);

        // ダンジョンへ戻るボタン
        const backButton = this.add.text(
            115, 35,
            "← ダンジョンへ戻る",
            {
                fontSize: "16px",
                color: "#ffffff",
                backgroundColor: "#44354f",
                padding: {
                    left: 10,
                    right: 10,
                    top: 8,
                    bottom: 8
                }
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(30)
            .setInteractive({ useHandCursor: true });

        backButton.on("pointerover", () => {
            backButton.setStyle({
                backgroundColor: "#665078"
            });
        });

        backButton.on("pointerout", () => {
            backButton.setStyle({
                backgroundColor: "#44354f"
            });
        });

        backButton.on("pointerdown", () => {
            this.scene.start("GameScene");
        });

        // 入力
        this.keys = this.input.keyboard.addKeys(
            "A,D,W,LEFT,RIGHT,UP,SPACE,J,K,L,SHIFT"
        );

        this.pending = {};
        this.acc = 0;
    }

    readKeys() {
        const k = this.keys;
        const J = Phaser.Input.Keyboard.JustDown;

        if (J(k.W) || J(k.UP) || J(k.SPACE)) {
            this.pending.jump = true;
        }

        if (J(k.J)) this.pending.sword = true;
        if (J(k.K)) this.pending.fist = true;
        if (J(k.L)) this.pending.parry = true;
        if (J(k.SHIFT)) this.pending.dodge = true;
    }

    update(_, delta) {
        this.readKeys();

        this.acc += Math.min(delta, 100);

        while (this.acc >= STEP) {
            this.acc -= STEP;
            this.tick();
        }

        this.player.render();
    }

    tick() {
        const k = this.keys;

        const input = {
            x:
                (k.D.isDown || k.RIGHT.isDown ? 1 : 0) -
                (k.A.isDown || k.LEFT.isDown ? 1 : 0),

            jump: false,
            sword: false,
            fist: false,
            parry: false,
            dodge: false,

            ...this.pending
        };

        this.pending = {};

        // 今はボスが未実装なので、プレイヤーだけを更新
        this.player.tick(input, []);
    }
}