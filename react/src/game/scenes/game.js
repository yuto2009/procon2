import Phaser from "phaser";
import Fighter, { S } from "../combat/Fighter";
import { FPS, STAMINA } from "../combat/frameData";

const STEP = 1000 / FPS;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
    }

    preload() {
        this.load.spritesheet("player", "/assets/player.png", { frameWidth: 96, frameHeight: 32 });
        this.load.spritesheet("enemy", "/assets/enemy.png", { frameWidth: 96, frameHeight: 32 });
    }

    create() {
        this.cameras.main.setBackgroundColor("#222222");
        const myName = this.registry.get("playerName") ?? "PLAYER";

        // ステージ
        this.physics.world.setBounds(0, 0, 1600, 600);
        this.cameras.main.setBounds(0, 0, 1600, 600);
        const ground = this.add.rectangle(800, 580, 1600, 40, 0x555555);
        this.physics.add.existing(ground, true);
        const platform = this.add.rectangle(900, 440, 200, 20, 0x555555);
        this.physics.add.existing(platform, true);

        // キャラ
        this.player = new Fighter(this, 200, 500, { color: 0x66aaff, texture: "player" });
        this.dummy = new Fighter(this, 700, 500, { color: 0xff6666, texture: "enemy" });
        for (const f of [this.player, this.dummy]) {
            this.physics.add.collider(f.sprite, ground);
            this.physics.add.collider(f.sprite, platform);
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

        const onParry = (f) => this.popText(f.sprite.x, f.sprite.y - 50, "PARRY!");
        this.events.on("parry", onParry);
        this.events.once("shutdown", () => this.events.off("parry", onParry));
        // TitleScene.create() の末尾に追加(確認が終わったら消す)
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
        this.player.render();
        this.dummy.render();
        this.drawHud();
    }

    // 1/60秒ごとの更新(サーバー同期/ゴースト記録もここに集約できる)
    tick() {
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
            if (++this.deadTimer > 90) { d.reset(700, 500); this.deadTimer = 0; }
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