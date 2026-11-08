import Phaser from "phaser";
import Fighter, { S } from "../combat/Fighter";
import { FPS, STAMINA, FX } from "../combat/frameData";
import { createTuningPanel } from "../debug/TuningPanel";
import { createProgress, statsFor, grantXp, xpToNext, MAX_LEVEL } from "../combat/progress";
import Monster from "../combat/Monster";
import { MONSTERS, SPAWN } from "../combat/monsterData";

import { generateCave, groundY, TILE } from "../map/mapgen";
import { getTheme } from "../map/mapThemes";
import { buildCave, buildTorches, buildAtmosphere } from "../map/MapRenderer";
import { computeStats, getInventory, quickHeal, rollDrops } from "../combat/inventory";
import { ITEMS } from "../combat/itemData";
const STEP = 1000 / FPS;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    preload() {
        this.socket = window.socket;
        this.load.spritesheet("player", "/assets/player.png", { frameWidth: 96, frameHeight: 32 });
        this.load.spritesheet("enemy", "/assets/enemy.png", { frameWidth: 96, frameHeight: 32 });
        this.load.image("dungeonTiles", "/assets/map/dungeon_tiles.png");
    }

    create() {
        // Q:回復薬 / ESC:メニュー
        this.menuLock = 0;
        this.input.keyboard.on("keydown-ESC", () => this.openMenu());

        const onResume = () => {
            this.menuLock = performance.now() + 250;   // 閉じたESCで、すぐ開き直さない
            this.pending = {};                          // 止まっている間の入力を捨てる
        };
        this.events.on("resume", onResume);
        this.events.once("shutdown", () => this.events.off("resume", onResume));

        this.itemText = this.add.text(250, 54, "", {
            fontSize: "14px", color: "#aaffcc",
        }).setScrollFactor(0).setDepth(10);
        // 進行状況(レベル・経験値)。無ければ新規作成
        let progress = this.registry.get("progress");
        if (!progress) {
            progress = createProgress();
            this.registry.set("progress", progress);
        }
        const stats = computeStats(progress.level, getInventory(this.registry));
        const myName = this.registry.get("playerName") ?? "PLAYER";
        const LastPosition = this.registry.get("LastPosition");
        const randomInt = (min, max) =>
            Math.floor(Math.random() * (max - min + 1)) + min;

        // 世界の雰囲気(stage.worldId で決まる)
        let stage = this.registry.get("stage");
        const worldId = stage?.worldId ?? this.registry.get("worldId") ?? "A";
        const theme = getTheme(worldId);

        // seed が無ければ新しく作る。復帰時はサーバーの seed から同じマップを作り直す
        let map;
        if (!stage || stage.seed == null) {
            const seed = randomInt(1, 2 ** 31 - 1);
            map = generateCave(seed, theme.gen);

            const pickType = () => {
                let r = Math.random();
                for (const [type, w] of Object.entries(SPAWN.weights)) {
                    if ((r -= w) < 0) return type;
                }
                return "slime";
            };
            stage = {
                worldId,
                seed,
                dummyX: worldId === "B" ? 700 : 600,
                monsters: map.spots.map((c) => ({ type: pickType(), x: c * TILE + TILE / 2 })),
                cleared: false,
            };
            this.registry.set("stage", stage);
            this.socket.emit("saveStage", stage);
        } else {
            map = generateCave(stage.seed, theme.gen);
        }
        this.stage = stage;
        this.map = map;
        this.worldWidth = map.width;

        this.bossEntranceX = map.gateCol * TILE + TILE / 2;
        this.bossTransitioning = false;
        this.deathY = map.height + 80;

        this.cameras.main.setBackgroundColor(theme.back);
        this.physics.world.setBounds(0, 0, map.width, map.height);
        this.cameras.main.setBounds(0, 0, map.width, map.height);

        // 洞窟を作る(terrain は当たり判定の group)
        const terrain = buildCave(this, map, theme);
        buildTorches(this, map, theme);

        // ボス部屋への門
        const gateY = groundY(map, this.bossEntranceX);
        const bossGate = this.add.rectangle(this.bossEntranceX, gateY - 68, 64, 136, theme.gate).setDepth(-4);
        bossGate.setStrokeStyle(5, theme.gateEdge);
        this.add.circle(this.bossEntranceX, gateY - 74, 25, theme.gateEdge, 0.5).setDepth(-4);
        this.add.text(this.bossEntranceX, gateY - 160, "BOSS ROOM", {
            fontSize: "20px", color: "#e8d4ff", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(-4);

        this.add.text(400, 8, theme.name, {
            fontSize: "18px", color: "#ffffff", fontStyle: "bold",
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10);

        buildAtmosphere(this, theme);

        // キャラ
        this.hitStop = 0;
        this.hitVictim = null;
        this.gameOver = false;

        // 出現位置(穴が無いので、x だけ決めれば床の高さが分かる)
        const spawnXpx = LastPosition != null ? LastPosition : map.startCol * TILE;
        const spawnX = Phaser.Math.Clamp(spawnXpx, 3 * TILE, map.width - 3 * TILE);
        const spawnY = groundY(map, spawnX) - 60;

        this.dummySpawnX = stage.dummyX;
        this.dummySpawnY = groundY(map, this.dummySpawnX) - 60;

        this.player = new Fighter(this, spawnX, spawnY, {
            color: 0x66aaff, texture: "player",
            maxHp: stats.maxHp,
            maxStamina: stats.maxStamina,
            damageMul: stats.damageMul,
            defence: stats.defence,
            weapon: this.registry.get("weapon") ?? "sword",
        });
        this.dummy = new Fighter(this, this.dummySpawnX, this.dummySpawnY, {
            color: 0xff6666, texture: "enemy",
        });

        this.monsters = [];
        for (const m of stage.monsters ?? []) {
            if (!MONSTERS[m.type]) continue;
            this.monsters.push(new Monster(this, m.x, groundY(map, m.x) - 60, m.type));
        }

        // 当たり判定は group に1回つなぐだけ(足場や石柱のループは不要)
        for (const f of [this.player, this.dummy, ...this.monsters]) {
            this.physics.add.collider(f.sprite, terrain);
        }
        this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

        // 入力
        this.keys = this.input.keyboard.addKeys("A,D,W,LEFT,RIGHT,UP,SPACE,J,K,L,SHIFT,Q");
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
        this.levelText = this.add.text(250, 30, "", {
            fontSize: "16px", color: "#ffee66", fontStyle: "bold",
        }).setScrollFactor(0).setDepth(10);

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
        const onKill = (victim, attacker) => {
            if (attacker !== this.player) return;

            if (victim === this.dummy) {
                grantXp(this, this.player, 20);   // テスト用の巨大な値は戻しておくのがおすすめ
            } else if (victim instanceof Monster) {
                grantXp(this, this.player, victim.def.xp);

                const got = rollDrops(getInventory(this.registry), victim.def.drops);
                got.forEach((id, i) => {
                    this.popText(victim.sprite.x, victim.sprite.y - 130 - i * 28,
                        `${ITEMS[id].name} 入手!`, "#aaffcc");
                });
            }
        };
        this.events.on("kill", onKill);
        this.events.on("parry", onParry);
        this.events.on("hit", onHit);
        this.events.once("shutdown", () => {
            this.events.off("parry", onParry);
            this.events.off("hit", onHit);
            this.events.off("kill", onKill);
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
        this.input.keyboard.on("keydown-X", () => grantXp(this, this.player, 100));
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
        if (J(k.Q)) quickHeal(this, this.player);
    }
    // メニューを開く(今のシーンは止まる)
    openMenu() {
        if (this.gameOver || performance.now() < this.menuLock) return;
        this.scene.launch("MenuScene", { owner: "GameScene" });
        this.scene.pause();
    }

    // レベル・装備が変わった時に、能力値を作り直す
    refreshStats() {
        const p = this.registry.get("progress");
        this.player.applyStats(computeStats(p.level, getInventory(this.registry)));
    }

    update(_, delta) {

        if (this.gameOver) {
            this.player.render();
            this.dummy.render();
            for (const m of this.monsters) m.render();
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
        for (const m of this.monsters) m.render();

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
        // 変更前: this.player.tick(input, [this.dummy]);
        const targets = [this.dummy, ...this.monsters.filter((m) => m.state !== S.DEAD)];
        this.player.tick(input, targets);
        this.tickDummy();
        this.tickMonsters();



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
            if (++this.deadTimer > 90) { d.reset(this.dummySpawnX, this.dummySpawnY); this.deadTimer = 0; }
            return;
        }
        if (d.state === S.IDLE) {
            d.facing = Math.sign(this.player.sprite.x - d.sprite.x) || d.facing;
            if (++this.dummyTimer > 100) { d.startAttack("enemySlash"); this.dummyTimer = 0; }
        }
        d.tick({ x: 0 }, [this.player]);
    }
    tickMonsters() {
        for (const m of this.monsters) {
            if (m.removed) continue;
            m.think(this.player);

            if (m.shouldRemove()) m.destroy();
        }
        this.monsters = this.monsters.filter((m) => !m.removed);
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
        for (const m of this.monsters) m.body.setVelocity(0, 0);

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
        bar(20, 54, 220, 12, this.player.stamina / this.player.maxStamina, 0xffcc33);
        bar(560, 30, 220, 18, this.dummy.hp / this.dummy.maxHp, 0xcc4444);
        const p = this.registry.get("progress");
        const need = xpToNext(p.level);
        bar(20, 70, 220, 8, p.level >= MAX_LEVEL ? 1 : p.xp / need, 0x66aaff);
        this.levelText.setText(
            p.level >= MAX_LEVEL ? `Lv ${p.level} MAX` : `Lv ${p.level}  ${p.xp}/${need}`
        );
        const inv = getInventory(this.registry);
        const potions = (inv.items.potion ?? 0) + (inv.items.hiPotion ?? 0);
    }

    popText(x, y, msg, color = "#66ffff") {
        const t = this.add.text(x, y, msg, {
            fontSize: "24px", color, fontStyle: "bold",
        }).setOrigin(0.5).setDepth(40);
        this.tweens.add({
            targets: t, y: y - 40, alpha: 0, duration: 600,
            onComplete: () => t.destroy(),
        });
    }
}