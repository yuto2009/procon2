import Phaser from "phaser";
import { FX } from "./frameData";

export const BS = {
    IDLE: "idle",
    TELEGRAPH: "telegraph",
    ACTIVE: "active",
    RECOVER: "recover",
    STUN: "stun",
    DEAD: "dead",
    TIRED: "tired",
};

/**
 * すべてのボスの土台となるクラス。
 *
 * 共通でやること:
 *   - HP / ステートマシン (IDLE→TELEGRAPH→ACTIVE→RECOVER…)
 *   - 重力・移動・当たり判定・被弾・スタン・死亡
 *   - ホスト→ゲストへの同期 (getSyncData / applySyncData)
 *   - 描画 (テクスチャ切替・向き・点滅・ティント・死亡フェード)
 *
 * 派生クラスで必ず実装するもの:
 *   - static attacks      : 攻撃データ { name: {...} }
 *   - tickIdle(players)   : 次の行動を決める
 *   - textureKey()        : 今の状態に合う画像キー
 *
 * 必要に応じて上書きするフック:
 *   - static preload(scene)
 *   - onEnter(state) / onActiveFrame(players) / onActiveEnd(players)
 *   - onTelegraphTick() / tickExtra(players) / onDead()
 *   - isFloating() / hitRect(a) / poseRotation()
 *   - getExtraSyncData() / applyExtraSync(d) / renderExtra()
 */
export default class BaseBoss {
    // 派生クラスで上書き
    static attacks = {};
    static preload(scene) {}

    constructor(scene, x, groundY, opts = {}) {
        const {
            texture = "boss",
            maxHp = 1000,
            bodyW = 165,
            bodyH = 170,
            displayW = 200,
            displayH = 170,
            arenaLeft = 500,
            arenaRight = 1300,
            ceilingY = 150,
            gravity = 0.8,
            artFacing = 1,
            footOffset = 0,
            idleWait = 90,
            tiredFrames = 150,
            deadStay = 90,
            deadFade = 60,
            debug = true,
            stateTint = true,   // false なら予備動作・攻撃中に色を変えない
        } = opts;

        this.scene = scene;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.groundY = groundY;

        this.cfg = {
            displayW,
            displayH,
            arenaLeft,
            arenaRight,
            ceilingY,
            gravity,
            artFacing,
            footOffset,
            idleWait,
            tiredFrames,
            deadStay,
            deadFade,
            debug,
            stateTint,
        };

        // 攻撃データはクラスごとに違うので、インスタンスから参照できるようにする
        this.attacks = this.constructor.attacks;

        this.sprite = scene.add
            .rectangle(x, groundY - bodyH / 2, bodyW, bodyH, 0xff0000, 0.2)
            .setVisible(debug)
            .setDepth(5);

        this.view = scene.add
            .image(x, groundY, texture)
            .setOrigin(0.5, 1)
            .setDisplaySize(displayW, displayH)
            .setDepth(5);

        this.hitDebug = scene.add
            .rectangle(0, 0, 10, 10, 0xffffff, 0.35)
            .setVisible(false)
            .setDepth(6);

        this.facing = -1;
        this.attack = null;
        this.target = null;
        this.aim = 0;
        this.vy = 0;
        this.stayFrames = new Map();
        this.stunFrames = 0;
        this.flashLeft = 0;
        this.hitSet = new Set();
        this.hitInfo = null;
        this.mirror = false;

        this.enter(BS.IDLE);
    }

    // ───────── 状態管理 ─────────

    enter(state) {
        this.state = state;
        this.frame = 0;

        if (state === BS.ACTIVE || state === BS.RECOVER) {
            this.vy = 0;
        }

        this.onEnter(state);
    }

    // ───────── 毎フレーム ─────────

    tick(players) {
        if (!this.isFloating()) {
            this.applyGravity();
        }

        if (this.state === BS.DEAD) {
            this.frame++;
            this.onDeadTick();
            return;
        }

        this.frame++;

        if (this.flashLeft > 0) this.flashLeft--;

        this.hitDebug.setVisible(false);
        this.hitInfo = null;

        switch (this.state) {
            case BS.IDLE:
                this.tickIdle(players);
                break;

            case BS.TELEGRAPH:
                this.onTelegraphTick();
                if (this.frame >= this.attack.startup) {
                    this.hitSet.clear();
                    this.enter(BS.ACTIVE);
                }
                break;

            case BS.ACTIVE:
                this.tickActive(players);
                break;

            case BS.RECOVER:
                if (this.frame >= this.attack.recovery) {
                    this.enter(BS.IDLE);
                }
                break;

            case BS.STUN:
                if (this.frame >= this.stunFrames) {
                    this.enter(BS.IDLE);
                }
                break;

            case BS.TIRED:
                if (this.frame >= this.cfg.tiredFrames) {
                    this.enter(BS.IDLE);
                }
                break;
        }

        this.tickExtra(players);
    }

    // 攻撃の実行(共通部分)
    tickActive(players) {
        const a = this.attack;

        this.onActiveFrame(players);

        const rect = this.hitRect(a);
        this.hitInfo = {
            x: rect.centerX,
            y: rect.centerY,
            w: rect.width,
            h: rect.height,
        };

        if (this.cfg.debug) {
            this.hitDebug
                .setVisible(true)
                .setPosition(rect.centerX, rect.centerY)
                .setSize(rect.width, rect.height);
        }

        for (const p of players) {
            if (p.hp <= 0 || this.hitSet.has(p)) continue;

            if (
                Phaser.Geom.Intersects.RectangleToRectangle(
                    rect,
                    p.sprite.getBounds()
                )
            ) {
                this.hitSet.add(p);
                p.receiveHit(this, a);
            }
        }

        if (this.frame >= a.active) {
            this.onActiveEnd(players);
        }
    }

    // ───────── 派生クラス用フック ─────────

    tickIdle(players) {
        throw new Error(`${this.constructor.name}: tickIdle を実装してください`);
    }
    textureKey() {
        return "boss";
    }
    onEnter(state) {}
    onTelegraphTick() {}
    onActiveFrame(players) {}
    onActiveEnd(players) {
        this.enter(BS.RECOVER);
    }
    tickExtra(players) {}
    onDeadTick() {}
    onDead() {}
    isFloating() {
        return false;
    }
    poseRotation() {
        return null; // ラジアンを返すと回転して描画
    }
    getExtraSyncData() {
        return {};
    }
    applyExtraSync(d) {}
    renderExtra() {}

    // 標準の攻撃判定(前方の矩形)
    hitRect(a) {
        const half = this.sprite.width / 2;
        const cx = this.sprite.x + this.facing * (half + a.range / 2);
        const bottom = this.sprite.y + this.sprite.height / 2;

        return new Phaser.Geom.Rectangle(
            cx - a.range / 2,
            bottom - a.height,
            a.range,
            a.height
        );
    }

    // ───────── 共通ユーティリティ ─────────

    trackPlatformTime(players, raisedOffset) {
        for (const p of players) {
            const up = p.sprite.y < this.groundY - raisedOffset;
            this.stayFrames.set(
                p,
                up ? (this.stayFrames.get(p) ?? 0) + 1 : 0
            );
        }
    }

    pickTarget(players) {
        const alive = players.filter((p) => p.hp > 0);
        return alive.length
            ? alive[Math.floor(Math.random() * alive.length)]
            : null;
    }

    nearestAlive(players) {
        let best = null;
        let bestDist = Infinity;

        for (const p of players) {
            if (p.hp <= 0) continue;
            const d = Math.abs(p.sprite.x - this.sprite.x);
            if (d < bestDist) {
                best = p;
                bestDist = d;
            }
        }
        return best;
    }

    otherAlive(players, exclude) {
        return players.find((p) => p !== exclude && p.hp > 0) ?? null;
    }

    faceToward(target) {
        this.facing =
            Math.sign(target.sprite.x - this.sprite.x) || this.facing;
    }

    moveBody(dx, dy) {
        const half = this.sprite.width / 2;
        const floorY = this.groundY - this.sprite.height / 2;

        this.sprite.x = Phaser.Math.Clamp(
            this.sprite.x + dx,
            this.cfg.arenaLeft + half,
            this.cfg.arenaRight - half
        );

        this.sprite.y = Phaser.Math.Clamp(
            this.sprite.y + dy,
            this.cfg.ceilingY,
            floorY
        );
    }

    applyGravity() {
        const floorY = this.groundY - this.sprite.height / 2;

        if (this.sprite.y < floorY) {
            this.vy += this.cfg.gravity;
            this.sprite.y = Math.min(floorY, this.sprite.y + this.vy);
        } else {
            this.sprite.y = floorY;
            this.vy = 0;
        }
    }

    attackName() {
        for (const [name, a] of Object.entries(this.attacks)) {
            if (a === this.attack) return name;
        }
        return null;
    }

    // ───────── 被弾・スタン ─────────

    receiveHit(attacker, a) {
        if (this.state === BS.DEAD) return;

        // ゲスト側のボスは表示専用。ホストへ通知するだけ
        if (this.mirror) {
            this.scene.events.emit("hit", this, attacker, a);
            this.onMirrorHit?.(attacker, a);
            return;
        }

        this.hp = Math.max(0, this.hp - a.damage);
        this.flashLeft = FX.flashFrames;
        this.scene.events.emit("hit", this, attacker, a);

        if (this.hp <= 0) {
            this.attack = null;
            this.enter(BS.DEAD);
            this.onDead();
            this.scene.events.emit("bossdead", this);
        }
    }

    stun(frames) {
        if (this.mirror) return;
        if (this.state === BS.DEAD) return;

        this.stunFrames = frames;
        this.attack = null;
        this.enter(BS.STUN);
    }

    // ───────── 同期 ─────────

    getSyncData() {
        return {
            x: Math.round(this.sprite.x),
            y: Math.round(this.sprite.y),
            facing: this.facing,
            state: this.state,
            attack: this.attackName(),
            frame: this.frame,
            aim: Math.round(this.aim * 1000) / 1000,
            flash: this.flashLeft,
            hp: this.hp,
            maxHp: this.maxHp,
            hit: this.hitInfo,
            ...this.getExtraSyncData(),
        };
    }

    // ゲスト側で受信したデータを反映
    applySyncData(d) {
        this.sprite.x = d.x;
        this.sprite.y = d.y;
        this.facing = d.facing;
        this.state = d.state;
        this.attack = this.attacks[d.attack] ?? null;
        this.frame = d.frame;
        this.aim = d.aim;
        this.flashLeft = d.flash;
        this.hp = d.hp;

        this.applyExtraSync(d);
    }

    // ───────── 描画 ─────────

    render() {
        this.renderExtra();

        const v = this.view;
        const { displayW, displayH, artFacing, footOffset } = this.cfg;
        const rot = this.poseRotation();

        if (rot !== null) {
            v.setOrigin(0.5, 0.5)
                .setPosition(this.sprite.x, this.sprite.y)
                .setRotation(rot);
        } else {
            v.setOrigin(0.5, 1)
                .setRotation(0)
                .setPosition(
                    this.sprite.x,
                    this.sprite.y + this.sprite.height / 2 + footOffset
                );
        }

        v.setFlipX(this.facing !== artFacing);

        const texKey = this.textureKey();
        if (v.texture.key !== texKey) {
            v.setTexture(texKey).setDisplaySize(displayW, displayH);
        }

        if (this.state === BS.DEAD) {
            v.clearTint();

            const fade = Phaser.Math.Clamp(
                (this.frame - this.cfg.deadStay) / this.cfg.deadFade,
                0,
                1
            );

            v.setAlpha(1 - fade);

            if (fade >= 1) {
                v.setVisible(false);
                this.sprite.setVisible(false);
            }
            return;
        }

        if (this.flashLeft > 0) {
            v.setTintFill(0xffffff);
            return;
        }

        if (!this.cfg.stateTint) {
            v.clearTint();
            return;
        }

        switch (this.state) {
            case BS.TELEGRAPH:
                v.setTint(0xffee66);
                break;
            case BS.ACTIVE:
                v.setTint(0xff5555);
                break;
            default:
                v.clearTint();
        }
    }
}