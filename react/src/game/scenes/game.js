import Phaser from "phaser";
import Fighter, { S } from "../combat/Fighter";
import { FPS, STAMINA, FX } from "../combat/frameData";
import { createTuningPanel } from "../debug/TuningPanel";
const STEP = 1000 / FPS;
// マップ生成用の基本設定
const TILE_SIZE = 32;
const CHUNK_COLS = 20;
const CHUNK_WIDTH = TILE_SIZE * CHUNK_COLS;

// 1チャンク分の平坦な地形データ
const FLAT_PROFILE = Array(CHUNK_COLS).fill(17);

// 地形・遺跡のパターン集
// profile: 地面の高さ（数字が小さいほど高い）
// null: 地面がない場所
// platforms: 浮遊足場
// pillars: 石柱
// torches: たいまつ
const MAP_TEMPLATES = [
    {
        name: "flat",
        profile: FLAT_PROFILE,
        platforms: [],
        pillars: [],
        torches: [
            { col: 4, row: 12 },
            { col: 16, row: 12 }
        ]
    },
    {
        name: "hill",
        profile: [
            17, 17, 17, 17, 16, 16, 15, 15, 14, 14,
            14, 14, 14, 15, 15, 16, 16, 17, 17, 17
        ],
        platforms: [
            { col: 8, width: 3, row: 15 }
        ],
        pillars: [
            { col: 3, height: 2, width: 1 }
        ],
        torches: [
            { col: 2, row: 12 },
            { col: 17, row: 12 }
        ]
    },
    {
        name: "stairs",
        profile: [
            17, 17, 17, 16, 16, 16, 15, 15, 15, 14,
            14, 14, 15, 15, 15, 16, 16, 17, 17, 17
        ],
        platforms: [
            { col: 5, width: 3, row: 15 }
        ],
        pillars: [
            { col: 12, height: 2, width: 1 }
        ],
        torches: [
            { col: 3, row: 11 },
            { col: 16, row: 11 }
        ]
    },
    {
        name: "valley",
        profile: [
            17, 17, 17, 18, 18, 18, 18, 18, 17, 17,
            17, 17, 18, 18, 18, 17, 17, 17, 17, 17
        ],
        platforms: [
            { col: 7, width: 4, row: 15 }
        ],
        pillars: [],
        torches: [
            { col: 2, row: 12 },
            { col: 17, row: 12 }
        ]
    },
    {
        name: "pit",
        profile: [
            17, 17, 17, 17, 17, null, null, 17, 17, 17,
            17, 17, 17, null, null, 17, 17, 17, 17, 17
        ],
        platforms: [
            { col: 5, width: 3, row: 15 },
            { col: 13, width: 3, row: 15 }
        ],
        pillars: [],
        torches: [
            { col: 2, row: 12 },
            { col: 17, row: 12 }
        ]
    },
    {
        name: "ruins",
        profile: FLAT_PROFILE,
        platforms: [
            { col: 5, width: 4, row: 15 },
            { col: 13, width: 3, row: 15 }
        ],
        pillars: [
            { col: 2, height: 2, width: 1 },
            { col: 17, height: 2, width: 1 }
        ],
        torches: [
            { col: 4, row: 12 },
            { col: 15, row: 12 }
        ]
    }
];

export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    preload() {
        this.socket = window.socket;
        this.load.spritesheet("player", "/assets/player.png", { frameWidth: 96, frameHeight: 32 });
        this.load.spritesheet("enemy", "/assets/enemy.png", { frameWidth: 96, frameHeight: 32 });
    }

    create() {
        const myName = this.registry.get("playerName") ?? "PLAYER";
        const LastPosition = this.registry.get("LastPosition");

        // マップ全体のサイズ
        const TOTAL_CHUNKS = 103;
        const WORLD_WIDTH = CHUNK_WIDTH * TOTAL_CHUNKS;
        const WORLD_HEIGHT = 600;

        // ランダムな整数を返す(使う前に定義する)
        const randomInt = (min, max) =>
            Math.floor(Math.random() * (max - min + 1)) + min;

        // 復帰時はサーバーから受け取った stage が registry に入っている
        let stage = this.registry.get("stage");
        if (!stage) {
            const worldId = this.registry.get("worldId") ?? "A";
            stage = {
                worldId,
                chunks: Array.from({ length: TOTAL_CHUNKS }, (_, i) =>
                    i < 2 || i >= TOTAL_CHUNKS - 2 ? 0 : randomInt(1, MAP_TEMPLATES.length - 1)
                ),
                dummyX: worldId === "B" ? 1200 : 700,
                cleared: false,
            };
            this.registry.set("stage", stage);
            this.socket.emit("saveStage", stage);
        }
        this.stage = stage;
        this.worldWidth = WORLD_WIDTH;

        // 世界ごとの色(stage.worldId で決める)
        const world = stage.worldId === "B"
            ? {
                name: "WORLD B - RUINS",
                background: "#211b31",
                groundColor: 0x51475f,
                platformColor: 0x81749a,
            }
            : {
                name: "WORLD A - DUNGEON",
                background: "#171e27",
                groundColor: 0x4d5862,
                platformColor: 0x8b9a99,
            };

        // マップ全体のサイズ

        // ボスの門の位置
        this.bossEntranceX = WORLD_WIDTH - CHUNK_WIDTH * 1.5;

        // シーンの切り替えを一度だけ実行するためのフラグ
        this.bossTransitioning = false;

        // 物理演算用の高さは画面より大きくする
        const PHYSICS_HEIGHT = WORLD_HEIGHT + 1200;

        // 穴に落ちたと判定する高さ
        this.deathY = WORLD_HEIGHT + 80;

        this.cameras.main.setBackgroundColor(world.background);

        // 物理範囲は下へ広げる
        this.physics.world.setBounds(
            0,
            0,
            WORLD_WIDTH,
            PHYSICS_HEIGHT
        );

        // カメラの表示範囲は今までどおりf
        this.cameras.main.setBounds(
            0,
            0,
            WORLD_WIDTH,
            WORLD_HEIGHT
        );

        // 生成した地形を保存する配列
        const terrain = [];
        const platforms = [];
        const obstacles = [];
        // チャンクを左から順番に配置
        for (let i = 0; i < TOTAL_CHUNKS; i++) {
            const chunkX = i * CHUNK_WIDTH;
            const template = MAP_TEMPLATES[stage.chunks[i]];   // ← ここを置き換え
            const profile = template.profile;

            // 最初の2区間と最後の2区間は平坦にする
            // スタート位置とゴール付近を安定させるため


            // 地面を同じ高さごとにまとめて生成
            let col = 0;

            while (col < CHUNK_COLS) {
                const topRow = profile[col];

                // nullなら穴なので地面を作らない
                if (topRow === null) {
                    col++;
                    continue;
                }

                // 同じ高さのマスが何個続くかを調べる
                let endCol = col + 1;

                while (
                    endCol < CHUNK_COLS &&
                    profile[endCol] === topRow
                ) {
                    endCol++;
                }

                const left = chunkX + col * TILE_SIZE;
                const width = (endCol - col) * TILE_SIZE;
                const topY = topRow * TILE_SIZE;
                const height = WORLD_HEIGHT - topY;

                // 石造りの地面
                const segment = this.add.rectangle(
                    left + width / 2,
                    topY + height / 2,
                    width,
                    height,
                    world.groundColor
                );

                segment.setStrokeStyle(2, 0x25232d, 0.9);
                this.physics.add.existing(segment, true);
                terrain.push(segment);

                // 石ブロックの縦目地
                for (
                    let seamX = left + TILE_SIZE;
                    seamX < left + width;
                    seamX += TILE_SIZE
                ) {
                    this.add.rectangle(
                        seamX,
                        topY + height / 2,
                        2,
                        height,
                        0x25232d,
                        0.65
                    );
                }

                // 石ブロックの横目地
                for (
                    let seamY = topY + TILE_SIZE;
                    seamY < WORLD_HEIGHT;
                    seamY += TILE_SIZE
                ) {
                    this.add.rectangle(
                        left + width / 2,
                        seamY,
                        width,
                        2,
                        0x25232d,
                        0.55
                    );
                }

                // 地面上端の明るい石の縁
                this.add.rectangle(
                    left + width / 2,
                    topY + 3,
                    width,
                    6,
                    world.platformColor
                );

                col = endCol;
            }

            // 浮遊足場を生成
            // 浮遊足場を生成
            for (const p of template.platforms) {

                // 足場がまたぐ範囲の地面の高さを取得
                const rows = profile
                    .slice(p.col, p.col + p.width)
                    .filter((row) => row !== null);

                // 足場の下に地面がある場合、一番高い地面を求める
                const highestGroundY = rows.length > 0
                    ? Math.min(...rows) * TILE_SIZE
                    : null;

                // テンプレートで指定された足場の高さ
                let platformY = p.row * TILE_SIZE;

                // 地面と重なる場合は、足場を上へ移動
                if (highestGroundY !== null) {
                    platformY = Math.min(
                        platformY,
                        highestGroundY - 32
                    );
                }

                // 足場本体
                const platform = this.add.rectangle(
                    chunkX + (p.col + p.width / 2) * TILE_SIZE,
                    platformY,
                    p.width * TILE_SIZE - 8,
                    18,
                    world.platformColor
                );

                platform.setStrokeStyle(2, 0x25232d);

                // 足場の当たり判定
                this.physics.add.existing(platform, true);

                platforms.push(platform);
            }

            // 石柱を生成
            for (const p of template.pillars) {
                const baseRow = profile[p.col];

                // 穴の上には石柱を生成しない
                if (baseRow === null) continue;

                const width = (p.width ?? 1) * TILE_SIZE;
                const height = p.height * TILE_SIZE;
                const x = chunkX + (p.col + (p.width ?? 1) / 2) * TILE_SIZE;
                const groundY = baseRow * TILE_SIZE;

                const pillar = this.add.rectangle(
                    x,
                    groundY - height / 2,
                    width,
                    height,
                    world.platformColor
                );

                pillar.setStrokeStyle(2, 0x25232d);
                this.physics.add.existing(pillar, true);
                obstacles.push(pillar);
            }

            // たいまつを生成
            for (const t of template.torches) {
                const x = chunkX + (t.col + 0.5) * TILE_SIZE;
                const y = t.row * TILE_SIZE;

                // 光
                this.add.circle(x, y, 15, 0xff8c33, 0.18);

                // たいまつの台座
                const torchBase = this.add.rectangle(
                    x,
                    y + 8,
                    8,
                    16,
                    0xb9a18c
                );

                torchBase.setStrokeStyle(1, 0x25232d);

                // 炎
                this.add.circle(x, y - 3, 5, 0xffbb44, 1);
            }
        }


        // =============================
        // ボス部屋への門
        // =============================

        // 門の本体
        const bossGate = this.add.rectangle(
            this.bossEntranceX,
            476,
            64,
            136,
            0x21152f
        );

        bossGate.setStrokeStyle(5, 0xc7a5ff);

        // 門の中央の封印
        const bossSeal = this.add.circle(
            this.bossEntranceX,
            470,
            25,
            0x7138a8,
            0.9
        );

        bossSeal.setStrokeStyle(3, 0xe8d4ff);

        // 門の上に表示する文字
        this.add.text(
            this.bossEntranceX,
            385,
            "BOSS ROOM",
            {
                fontSize: "20px",
                color: "#e8d4ff",
                fontStyle: "bold"
            }
        ).setOrigin(0.5);
        // 世界名を表示
        this.add.text(400, 8, world.name, {
            fontSize: "18px",
            color: "#ffffff",
            fontStyle: "bold"
        })
            .setOrigin(0.5, 0)
            .setScrollFactor(0)
            .setDepth(10);

        // ダミーの出現位置
        this.dummySpawnX = stage.dummyX;

        // キャラ
        this.hitStop = 0;
        this.hitVictim = null;
        this.gameOver = false;
        // 指定したx座標の地面の上端(y)を返す。穴ならnull
        const groundYAt = (x) => {
            const chunk = Math.floor(x / CHUNK_WIDTH);
            const template = MAP_TEMPLATES[stage.chunks[chunk]];
            if (!template) return null;
            const col = Math.floor((x - chunk * CHUNK_WIDTH) / TILE_SIZE);
            const row = template.profile[col];
            return row == null ? null : row * TILE_SIZE;
        };

        // 穴の上なら、左へ進んで最初の地面に合わせる
        const findSafeX = (x) => {
            x = Phaser.Math.Clamp(x, 100, WORLD_WIDTH - 100);
            while (x > 100 && groundYAt(x) === null) x -= TILE_SIZE;
            return x;
        };

        let spawnX = 200;
        let spawnY = 500;
        if (LastPosition != null) {
            spawnX = findSafeX(LastPosition);
            spawnY = (groundYAt(spawnX) ?? 544) - 60;   // 地面の少し上から落とす
        }
        this.player = new Fighter(this, spawnX, spawnY, {
            color: 0x66aaff,
            texture: "player"
        });
        this.dummy = new Fighter(
            this,
            this.dummySpawnX,
            500,
            {
                color: 0xff6666,
                texture: "enemy"
            }
        );
        for (const f of [this.player, this.dummy]) {
            // 地面は通常の衝突判定
            for (const segment of terrain) {
                this.physics.add.collider(f.sprite, segment);
            }

            // 浮遊足場は上からのみ着地できる
            for (const platform of platforms) {
                this.physics.add.collider(
                    f.sprite,
                    platform,
                    undefined,
                    (actor, platformObject) => {
                        const body = actor.body;
                        const platformBody = platformObject.body;

                        if (!body || !platformBody) {
                            return false;
                        }

                        // 物理更新前のキャラクターの足元
                        const previousBottom =
                            body.prev.y + body.height;

                        // 足場の上端
                        const platformTop = platformBody.top;

                        // 下から上へ移動しているときは通過させる
                        const isFallingOrStanding =
                            body.velocity.y >= 0;

                        // 前のフレームで足場より上にいたか
                        const wasAbove =
                            previousBottom <= platformTop + 4;

                        return isFallingOrStanding && wasAbove;
                    }
                );
            }

            // 石柱は通常の衝突判定
            for (const obstacle of obstacles) {
                this.physics.add.collider(f.sprite, obstacle);
            }
        }
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

        // 入力
        this.keys = this.input.keyboard.addKeys("A,D,W,LEFT,RIGHT,UP,SPACE,J,K,L,SHIFT");
        this.pending = {};
        this.acc = 0;
        this.dummyTimer = 0;
        this.deadTimer = 0;
        this.restarting = false;
        // HUD(後でReact UIに置き換え予定)
        this.hud = this.add.graphics().setScrollFactor(0).setDepth(10);
        this.add.text(20, 8, myName, { fontSize: "16px", color: "#ffffff" }).setScrollFactor(0).setDepth(10);
        this.add.text(400, 580, "←→/AD:移動  W/Space:ジャンプ  J:剣  K:拳  L:パリィ  Shift:回避", {
            fontSize: "14px", color: "#aaaaaa",
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

        const onParry = (f) => {
            this.popText(f.sprite.x, f.sprite.y - 50, "PARRY!");
            this.hitStop = Math.max(this.hitStop, FX.parryStop);
            this.hitVictim = null;
            this.cameras.main.shake(100, FX.parryShake);
        };
        const onHit = (victim, attacker, atk) => {
            this.hitStop = Math.max(this.hitStop, atk.hitStop ?? 0);
            this.hitVictim = victim;
            this.cameras.main.shake(100, atk.shake ?? 0);
        };
        this.events.on("parry", onParry);
        this.events.on("hit", onHit);
        this.events.once("shutdown", () => {
            this.events.off("parry", onParry);
            this.events.off("hit", onHit);
        });
        this.tuning = createTuningPanel();
        this.input.keyboard.on("keydown-T", () => this.tuning.toggle());
        this.events.once("shutdown", () => this.tuning.destroy());
        this.onPlayerAction = (OtherPlayerAction) => {
            /*if (OtherPlayerAction.jump === true) {
                console.log("他プレイヤーからのアクション", OtherPlayerAction);
            }*/
        };
        this.socket.on("playeraction", this.onPlayerAction);

        this.events.once("shutdown", () => {
            this.socket.off("playeraction", this.onPlayerAction);
        });
    }

    // 押した瞬間を取りこぼさないよう、毎描画フレームで拾ってためておく
    readKeys() {
        const k = this.keys;
        const J = Phaser.Input.Keyboard.JustDown;
        if (J(k.W) || J(k.UP) || J(k.SPACE)) this.pending.jump = true;
        if (J(k.J)) this.pending.sword = true;
        if (J(k.K)) this.pending.fist = true;
        if (J(k.L)) this.pending.parry = true;
        if (J(k.SHIFT)) this.pending.dodge = true;
    }

    update(_, delta) {

        if (this.gameOver) {
            this.player.render();
            this.dummy.render();
            this.drawHud();
            return;
        }
        this.readKeys();
        this.acc += Math.min(delta, 100);
        while (this.acc >= STEP) {
            this.acc -= STEP;
            this.tick();
        }

        // ヒットストップ中は物理も止める
        if (this.hitStop > 0 || this.gameOver) {
            this.physics.world.pause();
        }
        else {
            this.physics.world.resume();
        }
        this.player.render();
        this.dummy.render();

        // 停止中は被弾側を小刻みに震わせる
        if (this.hitStop > 0 && this.hitVictim) {
            this.hitVictim.view.x += this.hitStop % 2 ? 3 : -3;
        }
        this.drawHud();
    }
    // 1/60秒ごとの更新(サーバー同期/ゴースト記録もここに集約できる)
    tick() {
        if (this.hitStop > 0) { this.hitStop--; return; }
        const k = this.keys;
        const input = {
            x: (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0),
            jump: false, sword: false, fist: false, parry: false, dodge: false,
            ...this.pending,
        };
        this.pending = {};
        this.socket.emit("gameaction", { input, position: this.player.sprite.x });
        this.player.tick(input, [this.dummy]);
        this.tickDummy();

        if (!this.stage.cleared && this.player.state !== S.DEAD
            && this.player.sprite.x >= this.worldWidth - 200) {
            this.stage.cleared = true;
            this.socket.emit("stageClear");
        }

        // ボス部屋への到達判定
        if (!this.bossTransitioning && this.player.sprite.x >= this.bossEntranceX) {
            this.bossTransitioning = true;
            this.registry.set("LastPosition", this.bossEntranceX - 200);
            this.player.sprite.body.setVelocity(0, 0);
            this.scene.start("BossScene");
            return;
        }

        if (this.player.state === S.DEAD) {
            this.triggerGameOver("力尽きてしまった");
            return;
        }
        if (this.player.sprite.y > this.deathY) {
            this.triggerGameOver("穴に落ちてしまった");
            return;
        }
    }

    // 練習用ダミー: 一定間隔で予備動作つきの攻撃をしてくる(パリィ練習用)
    tickDummy() {
        const d = this.dummy;
        if (d.state === S.DEAD) {
            if (++this.deadTimer > 90) { d.reset(this.dummySpawnX, 500); this.deadTimer = 0; }
            return;
        }
        if (d.state === S.IDLE) {
            d.facing = Math.sign(this.player.sprite.x - d.sprite.x) || d.facing;
            if (++this.dummyTimer > 100) { d.startAttack("enemySlash"); this.dummyTimer = 0; }
        }
        d.tick({ x: 0 }, [this.player]);
    }

    triggerGameOver(message) {
        // 二重に実行しない
        if (this.gameOver) return;

        this.gameOver = true;
        this.hitStop = 0;
        this.pending = {};

        // キャラクターの動きを止める
        this.player.body.setVelocity(0, 0);
        this.dummy.body.setVelocity(0, 0);

        // 物理演算を停止
        this.physics.world.pause();

        // 画面を暗くするオーバーレイ
        const overlay = this.add.rectangle(
            400, 300,
            800, 600,
            0x000000,
            0.78
        )
            .setScrollFactor(0)
            .setDepth(100)
            .setAlpha(0);

        // GAME OVER のタイトル
        const title = this.add.text(
            400, 210,
            "GAME OVER",
            {
                fontSize: "54px",
                color: "#ff5555",
                fontStyle: "bold"
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101)
            .setAlpha(0)
            .setScale(0.7);

        // ゲームオーバーの理由
        const detail = this.add.text(
            400, 275,
            message,
            {
                fontSize: "22px",
                color: "#ffffff"
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(101)
            .setAlpha(0);

        // ボタンを作る共通関数
        const createButton = (y, label, onClick) => {
            const button = this.add.text(
                400, y,
                label,
                {
                    fontSize: "22px",
                    color: "#ffffff",
                    backgroundColor: "#444444",
                    padding: {
                        left: 24,
                        right: 24,
                        top: 12,
                        bottom: 12
                    }
                }
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(102)
                .setAlpha(0)
                .setInteractive({ useHandCursor: true });

            button.on("pointerover", () => {
                button.setStyle({
                    backgroundColor: "#666666"
                });
            });

            button.on("pointerout", () => {
                button.setStyle({
                    backgroundColor: "#444444"
                });
            });

            button.on("pointerdown", onClick);

            return button;
        };

        // リトライボタン
        const retryButton = createButton(
            365,
            "もう一度プレイ",
            () => {
                // 保存されている位置をリセットして最初から開始
                this.registry.set("LastPosition", null);
                this.scene.restart();
            }
        );

        // タイトルへ戻るボタン
        const titleButton = createButton(
            435,
            "タイトルへ戻る",
            () => {
                this.registry.set("LastPosition", null);
                this.scene.start("TitleScene");
            }
        );

        // 背景を暗くし、タイトルとボタンを表示する
        this.tweens.add({
            targets: overlay,
            alpha: 1,
            duration: 450,
            ease: "Sine.Out"
        });

        this.tweens.add({
            targets: title,
            alpha: 1,
            scale: 1,
            duration: 550,
            ease: "Back.Out"
        });

        this.tweens.add({
            targets: [detail, retryButton, titleButton],
            alpha: 1,
            duration: 400,
            delay: 150
        });
    }

    drawHud() {
        const g = this.hud;
        g.clear();
        const bar = (x, y, w, h, ratio, color) => {
            g.fillStyle(0x000000, 0.6).fillRect(x, y, w, h);
            g.fillStyle(color).fillRect(x + 2, y + 2, (w - 4) * Math.max(0, ratio), h - 4);
        };
        bar(20, 30, 220, 18, this.player.hp / this.player.maxHp, 0x44cc66);
        bar(20, 54, 220, 12, this.player.stamina / STAMINA.max, 0xffcc33);
        bar(560, 30, 220, 18, this.dummy.hp / this.dummy.maxHp, 0xcc4444);
    }

    popText(x, y, msg) {
        const t = this.add.text(x, y, msg, { fontSize: "24px", color: "#66ffff", fontStyle: "bold" }).setOrigin(0.5);
        this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    }
}