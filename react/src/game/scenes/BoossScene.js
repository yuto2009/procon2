import Phaser from "phaser";
import Fighter, { S } from "../combat/Fighter";
import BossEnemy from "../combat/BossEnemy";
import { FPS, STAMINA, FX } from "../combat/frameData";

const STEP = 1000 / FPS;

export default class BossScene extends Phaser.Scene {
    constructor() {
        super("BossScene");
    }

    // ボスのHPバーを更新
    updateBossHpBar() {
        const g = this.bossHpGraphics;
        const hp = this.boss.hp;
        const maxHp = this.boss.maxHp;

        g.clear();

        const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

        // バーの背景
        g.fillStyle(0x241522, 1);
        g.fillRoundedRect(
            this.bossHpBarX,
            this.bossHpBarY,
            this.bossHpBarWidth,
            this.bossHpBarHeight,
            6
        );

        // 残りHP（残量に応じて色を変更）
        const color =
            ratio > 0.5 ? 0xe83e65 :
                ratio > 0.25 ? 0xffa52f :
                    0xff3333;

        if (ratio > 0) {
            g.fillStyle(color, 1);
            g.fillRoundedRect(
                this.bossHpBarX + 2,
                this.bossHpBarY + 2,
                (this.bossHpBarWidth - 4) * ratio,
                this.bossHpBarHeight - 4,
                4
            );
        }

        // 外枠
        g.lineStyle(2, 0xc7a5ff, 1);
        g.strokeRoundedRect(
            this.bossHpBarX,
            this.bossHpBarY,
            this.bossHpBarWidth,
            this.bossHpBarHeight,
            6
        );

        this.bossHpText.setText(`${hp} / ${maxHp}`);
    }

    // プレイヤーのHPとスタミナを更新
    drawPlayerHud() {
        const g = this.playerHud;
        g.clear();

        const bar = (x, y, w, h, ratio, color) => {
            g.fillStyle(0x000000, 0.6).fillRect(x, y, w, h);
            g.fillStyle(color).fillRect(
                x + 2,
                y + 2,
                (w - 4) * Math.max(0, ratio),
                h - 4
            );
        };

        bar(20, 560, 220, 18, this.player.hp / this.player.maxHp, 0x44cc66);
        bar(20, 582, 220, 12, this.player.stamina / STAMINA.max, 0xffcc33);
    }

    popText(x, y, msg) {
        const t = this.add
            .text(x, y, msg, {
                fontSize: "24px",
                color: "#66ffff",
                fontStyle: "bold"
            })
            .setOrigin(0.5)
            .setDepth(40);

        this.tweens.add({
            targets: t,
            y: y - 40,
            alpha: 0,
            duration: 600,
            onComplete: () => t.destroy()
        });
    }

    preload() {
        this.load.spritesheet(
            "player",
            "/assets/player.png",
            { frameWidth: 96, frameHeight: 32 }
        );
        this.load.image("boss", "/assets/bossenemy1.png");
        this.load.image("boss_stance", "/assets/boss1attackwait.png");  // 構え
        this.load.image("boss_swing", "/assets/boss1attack.png");       // 振り終わり
        this.load.image("boss_dash", "/assets/boss1dash.png");
        this.load.image("boss_dashattack", "/assets/boss1dashattack.png");
        this.load.image("boss_footattack", "/assets/boss1footattack.png");
        this.load.image("boss_footwait", "/assets/boss1footwait.png");
        this.load.image("boss_stun", "/assets/boss1stun.png");
        this.load.image("boss_stun", "/assets/boss1stun.png");           // 疲労
        this.load.image("boss_parystun", "/assets/boss1parystun.png");   // パリィされた
        this.load.image("boss_dead", "/assets/boss1slaied.png");
    }

    create() {
        // 背景や床を描く部屋全体の幅
        const ROOM_WIDTH = 1800;
        const ROOM_HEIGHT = 600;

        // ボスを中心にした遊べる範囲(アリーナ)。
        // 画面の幅(800)とほぼ同じ広さで、カメラはほとんど動かない
        const BOSS_X = 900;
        const ARENA_LEFT = BOSS_X - 400;    // 500
        const ARENA_RIGHT = BOSS_X + 400;   // 1300
        const ARENA_WIDTH = ARENA_RIGHT - ARENA_LEFT;

        this.cameras.main.setBackgroundColor("#17101e");

        // プレイヤーはアリーナの外へ出られない
        this.physics.world.setBounds(
            ARENA_LEFT, 0, ARENA_WIDTH, ROOM_HEIGHT
        );

        this.cameras.main.setBounds(
            ARENA_LEFT, 0, ARENA_WIDTH, ROOM_HEIGHT
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

        // アリーナの左右の端の柱
        for (const edgeX of [ARENA_LEFT, ARENA_RIGHT]) {
            const pillar = this.add.rectangle(
                edgeX,
                300,
                24,
                520,
                0x594365
            );

            pillar.setStrokeStyle(3, 0xc7a5ff);
            pillar.setDepth(-1);
        }

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
        // 浮遊足場(4つ。ボスを中心に左右対称。上段は下段の真上)
        // =============================

        const platforms = [];

        const platformData = [
            { x: BOSS_X - 240, y: 480, width: 180 },   // 左の下段
            { x: BOSS_X - 240, y: 380, width: 180 },   // 左の上段(下段の真上)
            { x: BOSS_X + 240, y: 480, width: 180 },   // 右の下段
            { x: BOSS_X + 240, y: 380, width: 180 }    // 右の上段(下段の真上)
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
        // ボス：アリーナ中央に配置(床の上端は y=560)
        // =============================
        
        this.boss = new BossEnemy(this, BOSS_X, 560, {
            texture: "boss",
            maxHp: 1000 // BossHp
        });

        // HPバーの表示位置（画面固定）
        this.bossHpBarX = 200;
        this.bossHpBarY = 82;
        this.bossHpBarWidth = 400;
        this.bossHpBarHeight = 16;

        // HPバーを描画するGraphics
        this.bossHpGraphics = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(25);

        // ボスHPのテキスト
        this.bossHpText = this.add.text(
            400,
            103,
            "",
            {
                fontSize: "14px",
                color: "#ffffff",
                fontStyle: "bold"
            }
        )
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(25);

        // ボス名
        this.add.text(
            BOSS_X,
            220,
            "BOSS1",
            {
                fontSize: "28px",
                color: "#ff7799",
                fontStyle: "bold"
            }
        ).setOrigin(0.5).setDepth(6);

        // =============================
        // 2人分の開始位置(ボスを挟んで左右)
        // =============================

        // 下段の足場の外側(足場の真下に出ないように)
        const spawn1X = BOSS_X - 345;
        const spawn2X = BOSS_X + 345;

        // 位置の目印
        this.add.circle(
            spawn1X, 555, 14, 0x66aaff, 0.85
        );

        this.add.circle(
            spawn2X, 555, 14, 0xffcc66, 0.85
        );

        this.add.text(
            spawn1X, 530,
            "PLAYER 1",
            {
                fontSize: "16px",
                color: "#66aaff"
            }
        ).setOrigin(0.5);

        this.add.text(
            spawn2X, 530,
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

        // カメラ:ボスを中心に始まり、そのあとは自分を追う
        // (範囲はアリーナの内側に制限されているので、ボスは常に近くに見える)
        this.cameras.main.startFollow(
            this.player.sprite,
            true,
            0.1,
            0.1
        );
        this.cameras.main.centerOn(BOSS_X, 300);

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

        // プレイヤーのHUD
        this.playerHud = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(25);

        // パリィ・被弾の演出
        const onParry = (f) => {
            this.popText(f.sprite.x, f.sprite.y - 50, "PARRY!");
            this.cameras.main.shake(100, FX.parryShake);
        };
        const onHit = (victim, attacker, atk) => {
            this.cameras.main.shake(100, atk.shake ?? 0);
        };
        const onBossDead = () => {
            console.log("ボスを撃破しました！");
        };
        this.events.on("parry", onParry);
        this.events.on("hit", onHit);
        this.events.on("bossdead", onBossDead);
        this.events.once("shutdown", () => {
            this.events.off("parry", onParry);
            this.events.off("hit", onHit);
            this.events.off("bossdead", onBossDead);
        });

        // 入力
        this.keys = this.input.keyboard.addKeys(
            "A,D,W,LEFT,RIGHT,UP,SPACE,J,K,L,SHIFT"
        );

        this.pending = {};
        this.acc = 0;
        this.restarting = false;
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
        this.boss.render();
        this.updateBossHpBar();
        this.drawPlayerHud();
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

        // プレイヤーの攻撃はボスに当たる
        this.player.tick(input, [this.boss]);

        // ボスの動き(2人対戦では、ここをホストだけが実行する形にする予定)
        this.boss.tick([this.player]);

        // プレイヤーが倒れたら、少し待ってからやり直す
        if (this.player.state === S.DEAD && !this.restarting) {
            this.restarting = true;
            this.time.delayedCall(1500, () => this.scene.restart());
        }
    }
}