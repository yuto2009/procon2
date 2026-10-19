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
        this.load.spritesheet("player", "/assets/player.png", { frameWidth: 96, frameHeight: 32 });
        this.load.spritesheet("enemy", "/assets/enemy.png", { frameWidth: 96, frameHeight: 32 });
    }

    create() {
        const myName = this.registry.get("playerName") ?? "PLAYER";

        // 世界ごとの色
        const worldId = this.registry.get("worldId") ?? "A";

        const world = worldId === "B"
            ? {
                name: "WORLD B - RUINS",
                background: "#211b31",
                groundColor: 0x51475f,
                platformColor: 0x81749a,
                dummyX: 1200
            }
            : {
                name: "WORLD A - DUNGEON",
                background: "#171e27",
                groundColor: 0x4d5862,
                platformColor: 0x8b9a99,
                dummyX: 700
            };

        // マップ全体のサイズ
        const TOTAL_CHUNKS = 103;
        const WORLD_WIDTH = CHUNK_WIDTH * TOTAL_CHUNKS;
        const WORLD_HEIGHT = 600;

        this.cameras.main.setBackgroundColor(world.background);
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // 生成した地形を保存する配列
        const terrain = [];
        const platforms = [];
        const obstacles = [];

        // ランダムな整数を返す
        const randomInt = (min, max) =>
            Math.floor(Math.random() * (max - min + 1)) + min;

        // チャンクを左から順番に配置
        for (let i = 0; i < TOTAL_CHUNKS; i++) {
            const chunkX = i * CHUNK_WIDTH;

            // 最初の2区間と最後の2区間は平坦にする
            // スタート位置とゴール付近を安定させるため
            const template =
                i < 2 || i >= TOTAL_CHUNKS - 2
                    ? MAP_TEMPLATES[0]
                    : MAP_TEMPLATES[
                    randomInt(1, MAP_TEMPLATES.length - 1)
                    ];

            const profile = template.profile;

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
            for (const p of template.platforms) {
                const platform = this.add.rectangle(
                    chunkX + (p.col + p.width / 2) * TILE_SIZE,
                    p.row * TILE_SIZE,
                    p.width * TILE_SIZE - 8,
                    18,
                    world.platformColor
                );

                platform.setStrokeStyle(2, 0x25232d);
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
        this.dummySpawnX = world.dummyX;

        // キャラ
        this.hitStop = 0;
        this.hitVictim = null;
        this.physics.world.resume();
        this.player = new Fighter(this, 200, 500, { color: 0x66aaff, texture: "player" });
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
            // すべての地面に衝突判定を設定
            for (const segment of terrain) {
                this.physics.add.collider(f.sprite, segment);
            }

            // すべての浮遊足場に衝突判定を設定
            for (const platform of platforms) {
                this.physics.add.collider(f.sprite, platform);
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
        this.readKeys();
        this.acc += Math.min(delta, 100);
        while (this.acc >= STEP) {
            this.acc -= STEP;
            this.tick();
        }

        // ヒットストップ中は物理も止める
        if (this.hitStop > 0) this.physics.world.pause();
        else this.physics.world.resume();

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

        this.player.tick(input, [this.dummy]);
        this.tickDummy();

        if (this.player.state === S.DEAD && !this.restarting) {
            this.restarting = true;
            this.time.delayedCall(1000, () => this.scene.restart());
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