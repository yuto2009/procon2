import Phaser from "phaser";
import { FX } from "./frameData";

const DEBUG = true; // true: ボスの食らい判定と攻撃判定の枠を表示 / 完成時は false

// ボスの画像が右向きなら 1、左向きなら -1
const ART_FACING = 1;

// 画像の足元の位置の微調整(px)。
// まだ沈んでいるなら小さく(マイナス)、浮いているなら大きく(プラス)する。
// 画像の下に透明な余白があると浮いて見えるので、その分をここで補う
const FOOT_OFFSET = 0;

// ボスの攻撃データ(Fighter の ATTACKS と同じ項目)
// startup: 予備動作 / active: 判定が出ている時間 / recovery: 硬直(すべて 1/60秒のフレーム数)
export const BOSS_ATTACKS = {
    slash: {
        startup: 40, active: 6, recovery: 45,
        range: 180, height: 170,
        lunge: 120,
        damage: 80, stamina: 0,
        hitstun: 25, knockback: 320, hitStop: 6, shake: 0.01,
    },
    dashattack: {
        startup: 40, active: 6, recovery: 45,
        range: 180, height: 170,
        lunge: 120,
        damage: 80, stamina: 0,
        hitstun: 25, knockback: 320, hitStop: 6, shake: 0.01,
    }
};

export const BS = {
    IDLE: "idle",
    TELEGRAPH: "telegraph",
    ACTIVE: "active",
    RECOVER: "recover",
    STUN: "stun",
    DEAD: "dead",
};

const IDLE_WAIT = 90;   // 攻撃の間の待ち時間(フレーム)
const AGGRO = 260;      // この距離まで近づいたら攻撃を始める(px)

export default class BossEnemy {
    constructor(scene, x, groundY, { texture = "boss", maxHp = 1000 } = {}) {
        this.scene = scene;
        this.maxHp = maxHp;
        this.hp = maxHp;

        // 食らい判定(プレイヤーの攻撃はこの四角形に当たる。画像より細くしてある)
        const BODY_W = 165;
        const BODY_H = 170;
        this.sprite = scene.add
            .rectangle(x, groundY - BODY_H / 2, BODY_W, BODY_H, 0xff0000, 0.2)
            .setVisible(DEBUG)
            .setDepth(5);

        // 見た目(下端を足元に合わせる)
        this.view = scene.add
            .image(x, groundY, texture)
            .setOrigin(0.5, 1)
            .setDisplaySize(200, 170)
            .setDepth(5);

        // 攻撃判定のデバッグ表示
        this.hitDebug = scene.add
            .rectangle(0, 0, 10, 10, 0xffffff, 0.35)
            .setVisible(false)
            .setDepth(6);

        this.facing = -1;
        this.attack = null;
        this.stunFrames = 0;
        this.flashLeft = 0;
        this.hitSet = new Set();
        this.enter(BS.IDLE);
    }

    enter(state) {
        this.state = state;
        this.frame = 0;
    }

    // ---------- 毎tick(1/60秒)呼ぶ。players は攻撃の対象(Fighter の配列) ----------
    tick(players) {
        if (this.state === BS.DEAD) return;

        this.frame++;
        if (this.flashLeft > 0) this.flashLeft--;
        this.hitDebug.setVisible(false);

        switch (this.state) {
            case BS.IDLE:
                this.tickIdle(players);
                break;
            case BS.TELEGRAPH:
                if (this.frame >= this.attack.startup) {
                    this.hitSet.clear();
                    this.enter(BS.ACTIVE);
                }
                break;
            case BS.ACTIVE:
                this.tickActive(players);
                break;
            case BS.RECOVER:
                if (this.frame >= this.attack.recovery) this.enter(BS.IDLE);
                break;
            case BS.STUN:
                if (this.frame >= this.stunFrames) this.enter(BS.IDLE);
                break;
        }
    }

    // 待機:いちばん近い生きているプレイヤーのほうを向き、近ければ攻撃を選ぶ
    tickIdle(players) {
        const target = this.nearestAlive(players);
        if (!target) return;

        const dx = target.sprite.x - this.sprite.x;
        this.facing = Math.sign(dx) || this.facing;

        if (this.frame > IDLE_WAIT && Math.abs(dx) <= AGGRO) {
            this.attack = BOSS_ATTACKS[this.pickAttack(target)];
            this.enter(BS.TELEGRAPH);
        }
    }

    // 攻撃を選ぶ(いまは斬りだけ。ジャンプ攻撃や飛び道具はここに足す)
    pickAttack(_target) {
        return "slash";
    }

    // 攻撃中:判定が出ているあいだ毎フレーム、まだ当てていない相手だけ調べる
    tickActive(players) {
        const a = this.attack;
        this.sprite.x += this.facing * (a.lunge ?? 0) / a.active;
        const rect = this.hitRect(a);
        if (DEBUG) {
            this.hitDebug
                .setVisible(true)
                .setPosition(rect.centerX, rect.centerY)
                .setSize(rect.width, rect.height);
        }

        for (const p of players) {
            if (p.hp <= 0 || this.hitSet.has(p)) continue;
            if (Phaser.Geom.Intersects.RectangleToRectangle(rect, p.sprite.getBounds())) {
                this.hitSet.add(p);
                p.receiveHit(this, a);
            }
        }

        if (this.frame >= a.active) this.enter(BS.RECOVER);
    }

    // 攻撃判定の四角形(ボスの前、足元に合わせる)
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

    // ---------- プレイヤーの攻撃を受ける(Fighter から呼ばれる) ----------
    receiveHit(attacker, a) {
        if (this.state === BS.DEAD) return;

        this.hp = Math.max(0, this.hp - a.damage);
        this.flashLeft = FX.flashFrames;
        this.scene.events.emit("hit", this, attacker, a);

        if (this.hp <= 0) {
            this.attack = null;
            this.enter(BS.DEAD);
            this.scene.events.emit("bossdead", this);
        }
    }

    // パリィされたときに Fighter から呼ばれる
    stun(frames) {
        if (this.state === BS.DEAD) return;
        this.stunFrames = frames;
        this.attack = null;
        this.enter(BS.STUN);
    }

    // ---------- 表示(状態を色で見えるように) ----------
    render() {
        const v = this.view;
        // 食らい判定の下端(足元)に画像の下端を合わせる
        v.setPosition(
            this.sprite.x,
            this.sprite.y + this.sprite.height / 2 + FOOT_OFFSET
        );
        v.setFlipX(this.facing !== ART_FACING);
        const texkey = this.state === BS.TELEGRAPH ? "boss_stance" :
            (this.state === BS.ACTIVE || this.state === BS.RECOVER) ? "boss_swing" :
                "boss";
        if (v.texture.key !== texkey) {
            v.setTexture(texkey).setDisplaySize(200, 170).setOrigin(0.5, 1);
        }
        if (this.state === BS.DEAD) {
            v.setTint(0x555555);
            return;
        }
        if (this.flashLeft > 0) {
            v.setTintFill(0xffffff);
            return;
        }

        switch (this.state) {
            case BS.TELEGRAPH:
                v.setTint(0xffee66);   // 予備動作:黄色(パリィの合図)
                break;
            case BS.ACTIVE:
                v.setTint(0xff5555);   // 攻撃中:赤
                break;
            case BS.STUN:
                v.setTint(0xaa66ff);   // パリィされた:紫
                break;
            default:
                v.clearTint();
        }
    }
}