import Phaser from "phaser";
import BaseBoss, { BS } from "./BaseBoss";

// ───────── Boss2 の調整用の数値 ─────────
const WALK_SPEED = 2;          // 歩く速さ(px/フレーム)
const CLOSE_RANGE = 170;       // この距離以内=近距離、それより遠い=遠距離

// 遠距離で選ぶ攻撃の割合(合計1)
const FAR_BLOCK_CHANCE = 0.4;  // 氷塊
const FAR_SHOCK_CHANCE = 0.2;  // つらら
// 残り(0.4)は氷の剣

// バックステップ攻撃(近距離)
const BACKSTEP_SPEED = 6;
const FIRST_VOLLEY_AT = 6;
const SWORD_HEIGHTS = [30, 85, 140];  // 剣を撃つ高さ(地面から)

// 氷塊
const BIG_BLOCK_COUNTS = [4, 5];      // 降らせる大きい氷塊の数(どちらかをランダム)
const BLOCK_STAGGER = 12;             // 氷塊が降り始める間隔(フレーム)
const BLOCK_FALL_GRAVITY = 0.5;
const BLOCK_FALL_MAX = 14;
const BLOCK_TRACK_SPEED = 3;          // 落ちながら相手を追う横の速さ(px/フレーム)
const BLOCK_LOCK_HEIGHT = 100;        // 地面からこの高さまで来たら追尾をやめる
const SMALL_COUNT = 4;                // 着地で出る小さい氷塊の数
const SMALL_GRAVITY = 0.4;

// つらら(iceshock)
const ICICLE_MAX = 30;                // 生やす本数の上限(通常は闘技場の端まで出る)
const ICICLE_SPACING = 70;            // つらら同士の間隔(px)
const ICICLE_STAGGER = 5;             // 生えるタイミングの間隔(フレーム)
const ICICLE_LIFE = 40;               // 生えている時間(フレーム)
const ICICLE_RISE = 6;                // 伸びるまでの時間(フレーム)。この間は当たらない

// 氷の剣6本(頭上に浮かせる)
const HOVER_OFFSETS = [-100, -60, -20, 20, 60, 100]; // 頭上での横位置
const HOVER_HEIGHT = 150;             // 頭上からの高さ
const LAUNCH_FIRST = 120;             // 最初の2本を撃つまで(120フレーム=2秒)
const LAUNCH_SECOND = 240;            // 残り4本を撃つまで(さらに2秒後)
const FIRST_GROUP = [2, 3];           // 最初に撃つ2本(真ん中の2本)

const PROJ_POOL = 60;                 // 同時に存在できる飛び道具の最大数

// 剣の画像は縦向きの絵。先が上を向いた絵なら +π/2、下を向いた絵なら -π/2
const SWORD_ART_OFFSET = Math.PI / 2;

const NONE = {
    range: 0, height: 0,
    damage: 0, stamina: 0, hitstun: 0, knockback: 0,
    hitStop: 0, shake: 0,
};

export const BOSS2_ATTACKS = {
    // ── ボス本体の行動 ──

    // 仮の攻撃(まだ使っていない)
    swing: {
        startup: 24, active: 6, recovery: 22,
        range: 130, height: 150,
        damage: 50, stamina: 0, hitstun: 25, knockback: 320,
        hitStop: 6, shake: 0.01,
    },

    // 近距離: バックステップしながら剣3本 → 攻撃姿勢でもう3本
    backstepAttack: {
        noBody: true, backstep: true,
        // startup を長くして2回目を遅らせ、recovery を長くして後隙を増やした
        startup: 32, active: 10, recovery: 55,
        ...NONE,
    },

    // 遠距離: 氷塊(上から降らせる)
    iceBlock: {
        noBody: true, block: true,
        startup: 36, active: 20, recovery: 50,
        ...NONE,
    },

    // 遠距離: つらら(地面から相手へ向かって連続で生える)
    iceShock: {
        noBody: true, shock: true,
        startup: 30, active: 45, recovery: 30,
        ...NONE,
    },

    // 遠距離: 氷の剣6本(頭上に浮かせて、2秒後に2本、さらに2秒後に4本)
    iceSwordRain: {
        noBody: true, rain: true,
        // ボスは剣を浮かせたらすぐ動ける(剣はボスと関係なく飛ぶ)
        startup: 30, active: 10, recovery: 20,
        ...NONE,
    },

    // ── 飛び道具のダメージ設定(すべてパリィ不可) ──

    iceSword: {
        projectile: true, parryable: false,
        range: 80, height: 34, speed: 10, maxDist: 350,
        damage: 30, stamina: 0, hitstun: 20, knockback: 260,
        hitStop: 0, shake: 0.006,
    },

    rainSword: {
        projectile: true, parryable: false,
        range: 44, height: 44, speed: 14, maxDist: 1500,
        damage: 35, stamina: 0, hitstun: 20, knockback: 260,
        hitStop: 0, shake: 0.008,
    },

    iceBlockBig: {
        projectile: true, parryable: false,
        range: 90, height: 90,
        damage: 60, stamina: 0, hitstun: 25, knockback: 300,
        hitStop: 0, shake: 0.012,
    },

    iceBlockSmall: {
        projectile: true, parryable: false,
        range: 34, height: 34,
        damage: 25, stamina: 0, hitstun: 15, knockback: 200,
        hitStop: 0, shake: 0.005,
    },

    icicle: {
        projectile: true, parryable: false,
        range: 44, height: 100,
        damage: 45, stamina: 0, hitstun: 25, knockback: 280,
        hitStop: 0, shake: 0.01,
    },
};

// 飛び道具の見た目(画像キー・表示サイズ・基準点)
const VIEW = {
    sword:  { key: "boss2_icesword",      w: 48,  h: 90,  originY: 0.5 },
    big:    { key: "boss2_iceblock",      w: 110, h: 110, originY: 0.5 },
    small:  { key: "boss2_smalliceblock", w: 44,  h: 44,  originY: 0.5 },
    icicle: { key: "boss2_icicle",        w: 50,  h: 110, originY: 1 },
};

function blankProj() {
    return {
        active: false,
        kind: "sword",
        a: null,            // ダメージ設定(ホスト側のみ使う)
        x: 0, y: 0,
        vx: 0, vy: 0,
        rot: 0,
        age: 0,             // 出てからの経過フレーム
        delay: 0,           // 出現までの待ち(フレーム)
        hovering: false,    // 剣: 頭上に浮いている間 true
        launchIn: 0,        // 剣: 発射までの残りフレーム
        target: null,       // 剣: 追従する相手
        offX: 0, offY: 0,   // 剣: 頭上での位置
        traveled: 0,
        hitSet: new Set(),
    };
}

export default class Boss2 extends BaseBoss {
    static attacks = BOSS2_ATTACKS;
    static label = "BOSS2";

    static preload(scene) {
        // 画像は public/assets/boss2/ に置く
        const L = (key, file) => scene.load.image(key, `/assets/boss2/${file}`);

        L("boss2", "boss2.png");                               // 待機
        L("boss2_backstep", "boss2backstep.png");              // バックステップ
        L("boss2_backstepattack", "boss2backstepattack.png");
        L("boss2_iceblock", "boss2iceblock.png");              // 氷塊
        L("boss2_iceblockwait", "boss2iceblockwait.png");
        L("boss2_iceblockattack", "boss2iceblockattack.png");
        L("boss2_iceshockwait", "boss2iceshockwait.png");      // つらら
        L("boss2_iceshockattack", "boss2iceshockattack.png");
        L("boss2_icesword", "boss2icesword.png");              // 氷の剣
        L("boss2_icicle", "boss2icicle.png");                  // つらら(飛び道具)
        L("boss2_smalliceblock", "boss2smalliceblock.png");    // 小さい氷塊
    }

    constructor(scene, x, groundY, opts = {}) {
        super(scene, x, groundY, {
            texture: "boss2",
            maxHp: 800,
            bodyW: 140,
            bodyH: 160,
            displayW: 200,
            displayH: 180,
            artFacing: -1,   // 画像が左向きの絵なら -1(右向きなら 1)
            stateTint: false, // 予備動作や攻撃中に本体の色を変えない
            idleWait: 40,
            ...opts,
        });

        // 飛び道具のプール(使い回す)
        this.projs = Array.from({ length: PROJ_POOL }, blankProj);

        this.projViews = this.projs.map(() =>
            scene.add
                .image(0, 0, "boss2_icesword")
                .setDepth(7)
                .setVisible(false)
        );
    }

    // ───────── 行動選択 ─────────

    tickIdle(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) return;

        this.faceToward(nearest);

        const dx = nearest.sprite.x - this.sprite.x;
        const far = Math.abs(dx) > CLOSE_RANGE;

        // 遠ければ近づきながら待つ
        if (far) {
            this.moveBody(Math.sign(dx) * WALK_SPEED, 0);
        }

        if (this.frame <= this.cfg.idleWait) return;

        if (!far) {
            // 近距離: バックステップ攻撃
            this.attack = BOSS2_ATTACKS.backstepAttack;
        } else {
            // 遠距離: 氷塊40% / つらら20% / 氷の剣40%
            const r = Math.random();

            if (r < FAR_BLOCK_CHANCE) {
                this.attack = BOSS2_ATTACKS.iceBlock;
            } else if (r < FAR_BLOCK_CHANCE + FAR_SHOCK_CHANCE) {
                this.attack = BOSS2_ATTACKS.iceShock;
            } else {
                // 前の剣がまだ浮いているときは重ねず、氷塊にする
                const busy = this.projs.some(
                    (p) => p.active && p.kind === "sword" && p.hovering
                );

                this.attack = busy
                    ? BOSS2_ATTACKS.iceBlock
                    : BOSS2_ATTACKS.iceSwordRain;
            }
        }

        this.enter(BS.TELEGRAPH);
    }

    // ───────── 攻撃の流れ ─────────

    // 予備動作の間: バックステップ攻撃は後ろへ下がりながら1回目を撃つ
    onTelegraphTick() {
        if (!this.attack?.backstep) return;

        this.moveBody(-this.facing * BACKSTEP_SPEED, 0);

        if (this.frame === FIRST_VOLLEY_AT) {
            this.fireVolley();
        }
    }

    // 攻撃に入った最初のフレームで、それぞれの飛び道具を出す
    onActiveFrame(players) {
        const a = this.attack;
        if (this.frame !== 1) return;

        if (a.backstep) this.fireVolley();
        else if (a.block) this.spawnBlocks(players);
        else if (a.shock) this.spawnIcicles();
        else if (a.rain) this.spawnSwordRain(players);
    }

    // 体の当たり判定がない攻撃(飛び道具だけがダメージ源)
    tickActive(players) {
        const a = this.attack;

        if (a?.noBody) {
            this.onActiveFrame(players);

            if (this.frame >= a.active) {
                this.onActiveEnd(players);
            }
            return;
        }

        super.tickActive(players);
    }

    // ───────── 飛び道具の共通処理 ─────────

    spawnProj(kind, props) {
        const p = this.projs.find((q) => !q.active);
        if (!p) return null;

        Object.assign(p, blankProj(), props, {
            active: true,
            kind,
            hitSet: p.hitSet,   // Set は使い回す
        });
        p.hitSet.clear();

        return p;
    }

    clearProjs() {
        for (const p of this.projs) p.active = false;
    }

    hitPlayers(p, players, w, h, cy = p.y) {
        const rect = new Phaser.Geom.Rectangle(
            p.x - w / 2,
            cy - h / 2,
            w,
            h
        );

        for (const pl of players) {
            if (pl.hp <= 0 || p.hitSet.has(pl)) continue;

            if (
                Phaser.Geom.Intersects.RectangleToRectangle(
                    rect,
                    pl.sprite.getBounds()
                )
            ) {
                p.hitSet.add(pl);
                pl.receiveHit(this, p.a);
            }
        }
    }

    tickExtra(players) {
        for (const p of this.projs) {
            if (!p.active) continue;

            // 出現待ち
            if (p.delay > 0) {
                p.delay--;
                continue;
            }

            p.age++;

            switch (p.kind) {
                case "sword":
                    this.tickSword(p, players);
                    break;
                case "big":
                    this.tickBig(p, players);
                    break;
                case "small":
                    this.tickSmall(p, players);
                    break;
                case "icicle":
                    this.tickIcicle(p, players);
                    break;
            }
        }
    }

    onDeadTick() {
        this.clearProjs();
    }

    onDead() {
        this.clearProjs();
    }

    // ───────── 氷の剣(バックステップ) ─────────

    // 3本まとめて撃つ(高さ違い)
    fireVolley() {
        const a = BOSS2_ATTACKS.iceSword;
        const half = this.sprite.width / 2;

        for (const h of SWORD_HEIGHTS) {
            const p = this.spawnProj("sword", {
                a,
                x: this.sprite.x + this.facing * (half + a.range / 2),
                y: this.groundY - h,
                vx: this.facing * a.speed,
                vy: 0,
                rot: this.facing > 0 ? 0 : Math.PI,
            });

            if (!p) return;
        }
    }

    // ───────── 氷の剣6本(頭上に浮かせる) ─────────

    spawnSwordRain(players) {
        const target = this.pickTarget(players);
        if (!target) return;

        const a = BOSS2_ATTACKS.rainSword;

        HOVER_OFFSETS.forEach((offX, i) => {
            this.spawnProj("sword", {
                a,
                target,
                hovering: true,
                launchIn: FIRST_GROUP.includes(i)
                    ? LAUNCH_FIRST
                    : LAUNCH_SECOND,
                offX,
                offY: Math.abs(offX) * 0.25, // 端の剣ほど少し低く(弧の形)
                x: target.sprite.x + offX,
                y: target.sprite.y - HOVER_HEIGHT,
            });
        });
    }

    tickSword(p, players) {
        const a = p.a;

        // 浮いている間: 相手の頭上についていき、相手の方を向く
        if (p.hovering) {
            const t = p.target;

            if (!t || t.hp <= 0) {
                p.active = false;
                return;
            }

            p.x = t.sprite.x + p.offX;
            p.y = t.sprite.y - HOVER_HEIGHT + p.offY;
            p.rot = Math.atan2(t.sprite.y - p.y, t.sprite.x - p.x);

            p.launchIn--;

            if (p.launchIn <= 0) {
                // 発射の瞬間の向きで固定して飛ばす
                p.hovering = false;
                p.vx = Math.cos(p.rot) * a.speed;
                p.vy = Math.sin(p.rot) * a.speed;
                p.hitSet.clear();
            }
            return;
        }

        p.x += p.vx;
        p.y += p.vy;
        p.traveled += a.speed;

        // 回転した剣は、中心の周りの正方形で当たり判定する
        const size = p.a === BOSS2_ATTACKS.iceSword ? null : a.range;

        if (size === null) {
            this.hitPlayers(p, players, a.range, a.height);
        } else {
            this.hitPlayers(p, players, size, size);
        }

        const { arenaLeft, arenaRight } = this.cfg;

        if (
            p.traveled >= a.maxDist ||
            p.x < arenaLeft - 80 ||
            p.x > arenaRight + 80 ||
            p.y >= this.groundY ||
            p.y < -200
        ) {
            p.active = false;
        }
    }

    // ───────── 氷塊 ─────────

    spawnBlocks(players) {
        const alive = players.filter((p) => p.hp > 0);
        if (!alive.length) return;

        const count =
            BIG_BLOCK_COUNTS[
                Math.floor(Math.random() * BIG_BLOCK_COUNTS.length)
            ];
        const a = BOSS2_ATTACKS.iceBlockBig;
        const { arenaLeft, arenaRight } = this.cfg;

        for (let i = 0; i < count; i++) {
            const t = alive[i % alive.length];
            const x = Phaser.Math.Clamp(
                t.sprite.x + Phaser.Math.Between(-20, 20),
                arenaLeft + 60,
                arenaRight - 60
            );

            this.spawnProj("big", {
                a,
                target: t,
                x,
                y: -60,
                vy: 0,
                delay: i * BLOCK_STAGGER,
            });
        }
    }

    tickBig(p, players) {
        const a = p.a;

        // 落ちながら相手の方へ横に追いかける(地面の近くでは追わない)
        const t = p.target;

        if (t && t.hp > 0 && p.y < this.groundY - BLOCK_LOCK_HEIGHT) {
            const dx = t.sprite.x - p.x;
            p.x += Phaser.Math.Clamp(dx, -BLOCK_TRACK_SPEED, BLOCK_TRACK_SPEED);
        }

        p.vy = Math.min(BLOCK_FALL_MAX, p.vy + BLOCK_FALL_GRAVITY);
        p.y += p.vy;

        this.hitPlayers(p, players, a.range, a.height);

        // 地面に当たったら、小さい氷塊が飛び散る
        if (p.y + a.height / 2 >= this.groundY) {
            this.spawnSmalls(p.x);
            p.active = false;
        }
    }

    spawnSmalls(x) {
        const a = BOSS2_ATTACKS.iceBlockSmall;

        for (let k = 0; k < SMALL_COUNT; k++) {
            const dir = k % 2 === 0 ? -1 : 1;
            const speed = 3 + Math.floor(k / 2) * 3;

            this.spawnProj("small", {
                a,
                x,
                y: this.groundY - a.height / 2,
                vx: dir * speed,
                vy: -7,
            });
        }
    }

    tickSmall(p, players) {
        const a = p.a;
        const { arenaLeft, arenaRight } = this.cfg;

        p.vy += SMALL_GRAVITY;
        p.x += p.vx;
        p.y += p.vy;

        this.hitPlayers(p, players, a.range, a.height);

        if (
            (p.vy > 0 && p.y + a.height / 2 >= this.groundY) ||
            p.x < arenaLeft - 50 ||
            p.x > arenaRight + 50
        ) {
            p.active = false;
        }
    }

    // ───────── つらら(地面から相手へ向かって連続で生える) ─────────

    spawnIcicles() {
        const a = BOSS2_ATTACKS.icicle;
        const half = this.sprite.width / 2;
        const { arenaLeft, arenaRight } = this.cfg;

        // 左右の両方へ、闘技場の端まで生やす
        for (const dir of [-1, 1]) {
            for (let i = 0; i < ICICLE_MAX; i++) {
                const x =
                    this.sprite.x + dir * (half + 40 + i * ICICLE_SPACING);

                if (x < arenaLeft || x > arenaRight) break;

                this.spawnProj("icicle", {
                    a,
                    x,
                    y: this.groundY,
                    delay: i * ICICLE_STAGGER,
                });
            }
        }
    }

    tickIcicle(p, players) {
        const a = p.a;

        // 伸びきるまでは当たらない
        if (p.age >= ICICLE_RISE) {
            this.hitPlayers(p, players, a.range, a.height, p.y - a.height / 2);
        }

        if (p.age >= ICICLE_LIFE) {
            p.active = false;
        }
    }

    // ───────── 同期 ─────────

    // 見えている飛び道具だけをゲストへ送る
    getExtraSyncData() {
        return {
            projs: this.projs
                .filter((p) => p.active && p.delay <= 0)
                .map((p) => ({
                    k: p.kind,
                    x: Math.round(p.x),
                    y: Math.round(p.y),
                    r: Math.round(p.rot * 100) / 100,
                    g: p.age,
                })),
        };
    }

    applyExtraSync(d) {
        const list = Array.isArray(d.projs) ? d.projs : [];

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            const src = list[i];

            if (!src) {
                p.active = false;
                continue;
            }

            p.active = true;
            p.delay = 0;
            p.kind = src.k;
            p.x = src.x;
            p.y = src.y;
            p.rot = src.r;
            p.age = src.g;
        }
    }

    // ───────── 描画 ─────────

    renderExtra() {
        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            const v = this.projViews[i];

            if (!p.active || p.delay > 0) {
                v.setVisible(false);
                continue;
            }

            const cfg = VIEW[p.kind];

            if (v.texture.key !== cfg.key) {
                v.setTexture(cfg.key);
            }

            // つららは地面から伸びる
            const grow =
                p.kind === "icicle" ? Math.min(1, p.age / ICICLE_RISE) : 1;

            v.setVisible(true)
                .setOrigin(0.5, cfg.originY)
                .setDisplaySize(cfg.w, cfg.h * grow)
                .setPosition(p.x, p.y);

            if (p.kind === "sword") {
                // p.rot は飛ぶ向き。縦向きの絵なので、そのぶん回してそろえる
                v.setRotation(p.rot + SWORD_ART_OFFSET).setFlipY(false);
            } else {
                v.setRotation(0).setFlipY(false);
            }
        }
    }

    // 状態に合う画像を返す
    textureKey() {
        const a = this.attack;
        const st = this.state;
        const inAction = st === BS.ACTIVE || st === BS.RECOVER;

        if (a?.backstep) {
            if (st === BS.TELEGRAPH) return "boss2_backstep";
            if (inAction) return "boss2_backstepattack";
        } else if (a?.block) {
            if (st === BS.TELEGRAPH) return "boss2_iceblockwait";
            if (inAction) return "boss2_iceblockattack";
        } else if (a?.shock) {
            if (st === BS.TELEGRAPH) return "boss2_iceshockwait";
            if (inAction) return "boss2_iceshockattack";
        }

        // 氷の剣6本や、死亡・スタンの画像はまだないので待機画像で代用
        return "boss2";
    }
}