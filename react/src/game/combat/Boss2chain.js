import Phaser from "phaser";

// ───────── Boss2 の鎖(氷の鎖 / 炎の鎖) ─────────
// 氷の鎖: 2人が ICE_DIST 以上離れるとダメージ
// 炎の鎖: 2人が FIRE_DIST 以内に近づくとダメージ
// 第三形態("cycle"): 一定周期で氷と炎を切り替え、切り替えの前後は鎖が薄くなり判定も止まる

export const CHAIN_ICE_DIST = 400;      // これ以上離れると氷の鎖がダメージ
export const CHAIN_FIRE_DIST = 150;     // これ以内に近づくと炎の鎖がダメージ
export const CHAIN_DAMAGE = 10;         // 1回のダメージ
export const CHAIN_INTERVAL = 30;       // ダメージの間隔(フレーム)
export const CHAIN_CYCLE = 300;         // 第三形態: 切り替え周期(フレーム)
export const CHAIN_FADE = 60;           // 第三形態: 切り替えの前後で薄くなる時間(フレーム)
export const CHAIN_THIN_ALPHA = 0.15;   // 薄いときの濃さ
export const CHAIN_FADE_IN_FIRST = 30;  // 第一・第二形態: 出現時のフェードイン(判定もこの間は止まる)

// BOSS2_ATTACKS に chainHit として登録すること(ゲストへのヒット通知が名前で伝わるため)
export const CHAIN_ATTACK = {
    projectile: true,
    parryable: false,
    range: 0,
    height: 0,
    damage: CHAIN_DAMAGE,
    stamina: 0,
    hitstun: 8,
    knockback: 0,
    hitStop: 0,
    shake: 0.004,
};

// HUD(画面下側)
const HUD_X = 560;
const HUD_Y = 556;
const HUD_W = 230;
const HUD_H = 40;

const COLORS = {
    ice: { main: 0x9fe8ff, hot: 0xffffff, back: 0x2a5a78, name: "氷の鎖", text: "#bfeeff" },
    fire: { main: 0xff8a2b, hot: 0xffe08a, back: 0x7a2a10, name: "炎の鎖", text: "#ffc48a" },
};

export default class Boss2Chain {
    constructor(scene, boss) {
        this.scene = scene;
        this.boss = boss;

        this.kind = null;        // null / "ice" / "fire" / "cycle"
        this.mode = null;        // 今の鎖: "ice" / "fire" / null
        this.timer = 0;
        this.alpha = 0;
        this.enabled = false;    // 判定が有効か
        this.damaging = false;   // 今ダメージ条件を満たしているか
        this.progress = 0;       // cycle: 周期の進み具合(0〜1)
        this.hitWait = 0;

        this.g = scene.add.graphics().setDepth(6);

        this.hudG = scene.add.graphics().setScrollFactor(0).setDepth(25);
        this.hudTitle = scene.add
            .text(HUD_X + 38, HUD_Y + 4, "", {
                fontSize: "12px",
                fontStyle: "bold",
                color: "#ffffff",
            })
            .setScrollFactor(0)
            .setDepth(26);
        this.hudDesc = scene.add
            .text(HUD_X + 38, HUD_Y + 21, "", {
                fontSize: "10px",
                color: "#dddddd",
            })
            .setScrollFactor(0)
            .setDepth(26);

        this.hudTitle.setVisible(false);
        this.hudDesc.setVisible(false);
    }

    // 鎖を始める。kind: "ice" | "fire" | "cycle"
    start(kind) {
        this.kind = kind;
        this.timer = 0;
        this.hitWait = 0;
        this.mode = kind === "cycle" ? "ice" : kind;
        this.alpha = 0;
        this.enabled = false;
        this.damaging = false;
        this.progress = 0;
    }

    stop() {
        this.kind = null;
        this.mode = null;
        this.alpha = 0;
        this.enabled = false;
        this.damaging = false;
        this.progress = 0;
    }

    isActive() {
        return this.kind !== null;
    }

    // ───────── ホスト側の毎フレーム処理 ─────────

    tick(players) {
        if (!this.kind) return;

        this.timer++;

        if (this.kind === "cycle") {
            const n = Math.floor(this.timer / CHAIN_CYCLE);
            const t = this.timer % CHAIN_CYCLE;

            this.mode = n % 2 === 0 ? "ice" : "fire";
            this.progress = t / CHAIN_CYCLE;
            this.enabled = t >= CHAIN_FADE && t <= CHAIN_CYCLE - CHAIN_FADE;

            // 切り替えの前: 濃い→薄い / 切り替えの後: 薄い→濃い
            if (t < CHAIN_FADE) {
                this.alpha = Phaser.Math.Linear(CHAIN_THIN_ALPHA, 1, t / CHAIN_FADE);
            } else if (t > CHAIN_CYCLE - CHAIN_FADE) {
                this.alpha = Phaser.Math.Linear(
                    1,
                    CHAIN_THIN_ALPHA,
                    (t - (CHAIN_CYCLE - CHAIN_FADE)) / CHAIN_FADE
                );
            } else {
                this.alpha = 1;
            }
        } else {
            this.mode = this.kind;
            this.alpha = Math.min(1, this.timer / CHAIN_FADE_IN_FIRST);
            this.enabled = this.timer >= CHAIN_FADE_IN_FIRST;
        }

        // 判定(生きている2人がそろっているときだけ)
        const alive = players.filter((p) => p.hp > 0);
        this.damaging = false;

        if (alive.length < 2) return;

        const a = alive[0].sprite;
        const b = alive[1].sprite;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);

        const inCondition =
            this.mode === "ice"
                ? dist >= CHAIN_ICE_DIST
                : dist <= CHAIN_FIRE_DIST;

        if (!this.enabled || !inCondition) {
            this.hitWait = 0;
            return;
        }

        this.damaging = true;

        if (this.hitWait > 0) {
            this.hitWait--;
            return;
        }

        this.hitWait = CHAIN_INTERVAL;

        for (const pl of alive) {
            pl.receiveHit(this.boss, CHAIN_ATTACK);
        }
    }

    // ───────── 同期 ─────────

    getSync() {
        return {
            m: this.mode === "ice" ? 1 : this.mode === "fire" ? 2 : 0,
            a: Math.round(this.alpha * 100),
            e: this.enabled ? 1 : 0,
            d: this.damaging ? 1 : 0,
            c: this.kind === "cycle" ? 1 : 0,
            p: Math.round(this.progress * 100),
        };
    }

    applySync(d) {
        if (!d || !d.m) {
            this.stop();
            return;
        }

        this.kind = d.c ? "cycle" : d.m === 1 ? "ice" : "fire";
        this.mode = d.m === 1 ? "ice" : "fire";
        this.alpha = (Number(d.a) || 0) / 100;
        this.enabled = !!d.e;
        this.damaging = !!d.d;
        this.progress = (Number(d.p) || 0) / 100;
    }

    // ───────── 描画 ─────────

    // 鎖でつながれている2人(生きていて、相手が見えているときだけ)
    linkedFighters() {
        const s = this.scene;
        if (!s.player || !s.remote || !s.remoteSeen) return null;
        if (s.player.hp <= 0 || s.remote.hp <= 0) return null;
        return [s.player, s.remote];
    }

    render() {
        this.g.clear();
        this.hudG.clear();

        if (!this.mode) {
            this.hudTitle.setVisible(false);
            this.hudDesc.setVisible(false);
            return;
        }

        const col = COLORS[this.mode];
        const pair = this.linkedFighters();

        // 鎖の本体
        if (pair) this.drawChain(pair, col);

        // 画面下の説明(いま有効なほうだけ表示)
        this.drawHud(col, !!pair);
    }

    drawChain(pair, col) {
        const g = this.g;
        const a = pair[0].sprite;
        const b = pair[1].sprite;

        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const count = Math.max(2, Math.floor(dist / 16));
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const sag = Math.min(30, dist * 0.08);

        const color = this.damaging ? col.hot : col.main;
        const thick = this.damaging ? 3 : 2;

        for (let i = 0; i <= count; i++) {
            const t = i / count;

            let x = Phaser.Math.Linear(a.x, b.x, t);
            let y = Phaser.Math.Linear(a.y, b.y, t) + Math.sin(Math.PI * t) * sag;

            // ダメージ中は細かく震える
            if (this.damaging) {
                x += (Math.random() * 2 - 1) * 1.5;
                y += (Math.random() * 2 - 1) * 1.5;
            }

            g.lineStyle(thick, color, this.alpha);
            g.save();
            g.translateCanvas(x, y);
            g.rotateCanvas(angle);

            // 輪が交互に正面と横向きになる(鎖っぽく見せる仮の図形)
            if (i % 2 === 0) {
                g.strokeEllipse(0, 0, 16, 9);
            } else {
                g.strokeEllipse(0, 0, 7, 9);
            }

            g.restore();
        }
    }

    drawHud(col, linked) {
        const g = this.hudG;
        const alpha = Math.max(0.35, this.alpha);
        const cycle = this.kind === "cycle";

        // 枠
        g.fillStyle(0x000000, 0.55 * alpha);
        g.fillRoundedRect(HUD_X, HUD_Y, HUD_W, HUD_H, 5);
        g.lineStyle(1, col.main, alpha);
        g.strokeRoundedRect(HUD_X, HUD_Y, HUD_W, HUD_H, 5);

        // 仮アイコン: 鎖の輪2つ + 氷=ひし形 / 炎=三角
        const ix = HUD_X + 19;
        const iy = HUD_Y + HUD_H / 2;

        g.fillStyle(col.back, alpha);

        if (this.mode === "ice") {
            g.fillPoints(
                [
                    { x: ix, y: iy - 12 },
                    { x: ix + 9, y: iy },
                    { x: ix, y: iy + 12 },
                    { x: ix - 9, y: iy },
                ],
                true
            );
        } else {
            g.fillPoints(
                [
                    { x: ix, y: iy - 13 },
                    { x: ix + 11, y: iy + 11 },
                    { x: ix - 11, y: iy + 11 },
                ],
                true
            );
        }

        g.lineStyle(2, col.main, alpha);
        g.strokeEllipse(ix - 4, iy, 11, 7);
        g.strokeEllipse(ix + 4, iy, 11, 7);

        // 第三形態: 次の切り替えまでの残り時間バー
        if (cycle) {
            const bx = HUD_X + 38;
            const by = HUD_Y + HUD_H - 6;
            const bw = HUD_W - 46;

            g.fillStyle(0x000000, 0.6 * alpha);
            g.fillRect(bx, by, bw, 3);
            g.fillStyle(col.main, alpha);
            g.fillRect(bx, by, bw * (1 - this.progress), 3);
        }

        const desc =
            this.mode === "ice"
                ? `離れるとダメージ(${CHAIN_ICE_DIST}px以上)`
                : `近づくとダメージ(${CHAIN_FIRE_DIST}px以内)`;

        const title =
            col.name +
            (cycle && !this.enabled ? "  (切り替え中)" : "") +
            (!linked ? "  (相手待ち)" : "");

        this.hudTitle
            .setText(title)
            .setColor(col.text)
            .setAlpha(alpha)
            .setVisible(true);

        this.hudDesc
            .setText(desc)
            .setAlpha(alpha)
            .setVisible(true);
    }
}