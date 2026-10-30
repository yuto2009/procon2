import Phaser from "phaser";
import Fighter, { S } from "../combat/Fighter";
import { FPS, STAMINA, FX, ATTACKS, PARRY } from "../combat/frameData";
import { createProgress, statsFor, grantXp, xpToNext, MAX_LEVEL } from "../combat/progress";
import { getBossClass } from "../combat/bossRegistry";

const socket = window.socket;
const STEP = 1000 / FPS;
const SYNC_EVERY = 1;

export default class BossScene extends Phaser.Scene {
    constructor() {
        super("BossScene");
    }

    // どのボスと戦うか (registry の "bossType"。未指定なら boss1)
    get bossType() {
        return this.registry.get("bossType") ?? "boss1";
    }

    updateBossHpBar() {
        const g = this.bossHpGraphics;
        const hp = this.boss.hp;
        const maxHp = this.boss.maxHp;

        g.clear();

        const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

        g.fillStyle(0x241522, 1);
        g.fillRoundedRect(
            this.bossHpBarX,
            this.bossHpBarY,
            this.bossHpBarWidth,
            this.bossHpBarHeight,
            6
        );

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
        const p = this.registry.get("progress");
        const need = xpToNext(p.level);
        bar(20, 600 - 4, 220, 4, p.level >= MAX_LEVEL ? 1 : p.xp / need, 0x66aaff);
        this.levelText.setText(
            p.level >= MAX_LEVEL ? `Lv ${p.level} MAX` : `Lv ${p.level}  ${p.xp}/${need}`
        );
    }

    popText(x, y, msg, color = "#66ffff") {
        const t = this.add
            .text(x, y, msg, { fontSize: "24px", color, fontStyle: "bold" })
            .setOrigin(0.5)
            .setDepth(40);

        this.tweens.add({
            targets: t,
            y: y - 40,
            alpha: 0,
            duration: 600,
            onComplete: () => t.destroy(),
        });
    }

    preload() {
        this.load.spritesheet(
            "player",
            "/assets/player.png",
            { frameWidth: 96, frameHeight: 32 }
        );

        // ボスの画像は各ボスクラスが読み込む
        getBossClass(this.bossType).preload(this);
    }

    create() {
        const ROOM_WIDTH = 1800;
        const ROOM_HEIGHT = 600;

        const BOSS_X = 900;
        const ARENA_LEFT = BOSS_X - 400;
        const ARENA_RIGHT = BOSS_X + 400;
        const ARENA_WIDTH = ARENA_RIGHT - ARENA_LEFT;

        this.cameras.main.setBackgroundColor("#17101e");

        this.physics.world.setBounds(
            ARENA_LEFT,
            0,
            ARENA_WIDTH,
            ROOM_HEIGHT
        );

        this.cameras.main.setBounds(
            ARENA_LEFT,
            0,
            ARENA_WIDTH,
            ROOM_HEIGHT
        );

        this.physics.world.resume();

        // 背景
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

        // 床
        const ground = this.add.rectangle(
            ROOM_WIDTH / 2,
            580,
            ROOM_WIDTH,
            40,
            0x51475f
        );

        ground.setStrokeStyle(3, 0x81749a);
        this.physics.add.existing(ground, true);

        // 浮遊足場
        const platforms = [];
        const platformData = [];

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

        // ボス (種類は registry の bossType で決まる)
        const BossClass = getBossClass(this.bossType);
        this.boss = new BossClass(this, BOSS_X, 560);

        this.bossHpBarX = 200;
        this.bossHpBarY = 82;
        this.bossHpBarWidth = 400;
        this.bossHpBarHeight = 16;

        this.bossHpGraphics = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(25);

        this.bossHpText = this.add.text(
            400,
            103,
            "",
            {
                fontSize: "14px",
                color: "#ffffff",
                fontStyle: "bold",
            }
        )
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(25);

        // ボス名 (クラスに static label があればそれを使う)
        this.add.text(
            BOSS_X,
            220,
            BossClass.label ?? this.bossType.toUpperCase(),
            {
                fontSize: "28px",
                color: "#ff7799",
                fontStyle: "bold",
            }
        ).setOrigin(0.5).setDepth(6);

        this.guestHit = this.add
            .rectangle(0, 0, 10, 10, 0xffffff, 0.35)
            .setVisible(false)
            .setDepth(6);

        // プレイヤーの開始位置
        const spawn1X = BOSS_X - 345;
        const spawn2X = BOSS_X + 345;

        this.add.circle(spawn1X, 555, 14, 0x66aaff, 0.85);
        this.add.circle(spawn2X, 555, 14, 0xffcc66, 0.85);

        this.add.text(spawn1X, 530, "PLAYER 1", {
            fontSize: "16px",
            color: "#66aaff",
        }).setOrigin(0.5);

        this.add.text(spawn2X, 530, "PLAYER 2", {
            fontSize: "16px",
            color: "#ffcc66",
        }).setOrigin(0.5);

        const role = this.registry.get("worldRole") ?? "host";
        this.role = role;
        this.syncCount = 0;
        this.remoteSeen = false;
        this.spectating = false;

        const spawnX = role === "guest" ? spawn2X : spawn1X;

        // 進行状況(レベル・経験値)を読み込む。無ければ新規作成
        let progress = this.registry.get("progress");
        if (!progress) {
            progress = createProgress();
            this.registry.set("progress", progress);
        }
        const stats = statsFor(progress.level);

        this.player = new Fighter(this, spawnX, 520, {
            color: role === "guest" ? 0xffcc66 : 0x66aaff,
            texture: "player",
            maxHp: stats.maxHp,
            damageMul: stats.damageMul,
        });

        this.remote = new Fighter(
            this,
            role === "guest" ? spawn1X : spawn2X,
            520,
            {
                color: role === "guest" ? 0x66aaff : 0xffcc66,
                texture: "player",
            }
        );

        this.remote.remote = true;
        this.remote.body.setAllowGravity(false);
        this.remote.body.setImmovable(true);

        this.remote.view.setAlpha(0);
        this.remote.sprite.setAlpha(0);

        // Socket.IO 受信処理
        const on = (ev, fn) => {
            socket.on(ev, fn);
            this.events.once("shutdown", () => socket.off(ev, fn));
        };

        on("boss1player", (d) => {
            if (!this.remoteSeen) {
                this.remoteSeen = true;
                this.remote.view.setAlpha(1);
                this.remote.sprite.setAlpha(1);
            }

            this.remote.applySyncData(d);
        });

        on("playerLeft", () => {
            this.remoteSeen = false;
            this.remote.view.setAlpha(0);
            this.remote.sprite.setAlpha(0);
        });

        if (role === "guest") {
            // ホストのボス状態(衝撃波など独自データ込み)を受信
            on("boss1togest", (d) => {
                this.boss.applySyncData(d);

                if (d.hit) {
                    this.guestHit
                        .setVisible(true)
                        .setPosition(d.hit.x, d.hit.y)
                        .setSize(d.hit.w, d.hit.h);
                } else {
                    this.guestHit.setVisible(false);
                }
            });

            // ホストの攻撃が当たった知らせ
            on("boss1hit", ({ attack }) => {
                const a = this.boss.attacks[attack];

                if (a && this.player.state !== S.DEAD) {
                    this.player.receiveHit(this.boss, a);
                }
            });

            // ゲストの攻撃がボスに当たったらホストへ知らせる
            this.boss.mirror = true;
            this.boss.onMirrorHit = (attacker) => {
                socket.emit("boss1damage", {
                    key: attacker.attackKey,
                });
            };
        }

        if (role === "host") {
            // ボスの攻撃がゲストに当たったらゲストへ知らせる
            this.remote.onRemoteHit = (attacker, a) => {
                const attacks = this.boss.attacks;
                const name = Object.keys(attacks).find(
                    (k) => attacks[k] === a
                );

                if (name) {
                    socket.emit("boss1hit", { attack: name });
                }
            };

            // ゲストの攻撃がボスに当たった
            on("boss1damage", ({ key }) => {
                const a = ATTACKS[key];

                if (a) {
                    this.boss.receiveHit(this.remote, a);
                }
            });

            // ゲストがパリィした
            on("boss1parry", () => {
                this.boss.stun(PARRY.enemyStun);
                this.events.emit("parry", this.remote, this.boss);
            });
        }

        // 地面の当たり判定
        this.physics.add.collider(this.player.sprite, ground);

        // 足場は上からのみ着地可能
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

                    const previousBottom = body.prev.y + body.height;

                    return (
                        body.velocity.y >= 0 &&
                        previousBottom <= platformBody.top + 4
                    );
                }
            );
        }

        this.cameras.main.startFollow(
            this.player.sprite,
            true,
            0.1,
            0.1
        );

        this.cameras.main.centerOn(BOSS_X, 300);

        this.add.text(400, 12, "THE SEALED CHAMBER", {
            fontSize: "22px",
            color: "#ffffff",
            fontStyle: "bold",
        })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(20);

        this.add.text(400, 44, "協力ボス戦エリア", {
            fontSize: "16px",
            color: "#d4c4e5",
        })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(20);

        const backButton = this.add.text(
            115,
            35,
            "← ダンジョンへ戻る",
            {
                fontSize: "16px",
                color: "#ffffff",
                backgroundColor: "#44354f",
                padding: {
                    left: 10,
                    right: 10,
                    top: 8,
                    bottom: 8,
                },
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(30)
            .setInteractive({ useHandCursor: true });

        backButton.on("pointerover", () => {
            backButton.setStyle({ backgroundColor: "#665078" });
        });

        backButton.on("pointerout", () => {
            backButton.setStyle({ backgroundColor: "#44354f" });
        });

        backButton.on("pointerdown", () => {
            this.scene.start("GameScene");
        });

        this.playerHud = this.add.graphics()
            .setScrollFactor(0)
            .setDepth(25);
        this.levelText = this.add.text(20, 538, "", {
            fontSize: "16px", color: "#ffee66", fontStyle: "bold",
        }).setScrollFactor(0).setDepth(25);
        // パリィ・被弾の演出
        const onParry = (f) => {
            this.popText(f.sprite.x, f.sprite.y - 50, "PARRY!");
            this.cameras.main.shake(100, FX.parryShake);

            if (role === "guest" && f === this.player) {
                socket.emit("boss1parry");
            }
        };

        const onHit = (victim, attacker, atk) => {
            this.cameras.main.shake(100, atk.shake ?? 0);
        };

        const onBossDead = () => {
            console.log("ボスを撃破しました!");
            grantXp(this, this.player, 300);
        };

        this.events.on("parry", onParry);
        this.events.on("hit", onHit);
        this.events.on("bossdead", onBossDead);

        this.events.once("shutdown", () => {
            this.events.off("parry", onParry);
            this.events.off("hit", onHit);
            this.events.off("bossdead", onBossDead);
        });

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

        if (J(k.W) || J(k.UP)) this.pending.jump = true;
        if (J(k.J)) this.pending.sword = true;
        if (J(k.K)) this.pending.fist = true;
        if (J(k.L)) this.pending.parry = true;
        if (J(k.SHIFT) || J(k.SPACE)) this.pending.dodge = true;
    }

    update(_, delta) {
        this.readKeys();

        this.acc += Math.min(delta, 100);

        while (this.acc >= STEP) {
            this.acc -= STEP;
            this.tick();
        }

        this.player.render();
        this.remote.render();
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

            ...this.pending,
        };

        this.pending = {};

        this.player.tick(input, [this.boss]);

        this.syncCount++;
        const send = this.syncCount % SYNC_EVERY === 0;

        // ボスを動かすのはホストだけ
        if (this.role === "host") {
            const targets = this.remoteSeen
                ? [this.player, this.remote]
                : [this.player];

            this.boss.tick(targets);

            if (send) {
                // サーバー側で guest に転送する既存イベント名
                socket.emit("boss1host", this.boss.getSyncData());
            }
        }

        if (send) {
            socket.emit("boss1player", this.player.getSyncData());
        }

        const iDead = this.player.state === S.DEAD;
        const otherDead = !this.remoteSeen || this.remote.state === S.DEAD;

        if (iDead && !otherDead && !this.spectating) {
            this.spectating = true;

            this.cameras.main.startFollow(
                this.remote.sprite,
                true,
                0.1,
                0.1
            );
        }

        if (iDead && otherDead && !this.restarting) {
            this.restarting = true;
            this.time.delayedCall(1500, () => this.scene.restart());
        }
    }
}