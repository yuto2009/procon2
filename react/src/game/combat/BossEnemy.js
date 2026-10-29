import Phaser from "phaser";
import { FX } from "./frameData";

const DEBUG = true; // true: ボスの食らい判定と攻撃判定の枠を表示 / 完成時は false

// ボスの画像が右向きなら 1、左向きなら -1
const ART_FACING = 1;

// 画像の足元の位置の微調整(px)。
// まだ沈んでいるなら小さく(マイナス)、浮いているなら大きく(プラス)する。
const FOOT_OFFSET = 0;

// アリーナの左右の端(BossScene の ARENA_LEFT / ARENA_RIGHT と同じ値にする)
const ARENA_LEFT = 500;
const ARENA_RIGHT = 1300;
const CEILING_Y = 150;      // これより上には飛ばない(体の中心の高さ)

const GRAVITY = 0.8;        // 空中から床へ戻るときの落下の強さ(px/フレーム²)

// ---------- ダッシュ攻撃の調整用 ----------
const DASH_TURN = 0.06;         // ダッシュ中に向きを変えられる量(ラジアン/フレーム)。大きいほど追尾が強い
const DASH_POSE_SPLIT = 0.6;    // ダッシュ中、前半(この割合)は dash の絵、後半は dashattack の絵
const DASH_CHANCE_NEAR = 0.2;   // 近くにいるとき、ダッシュを選ぶ確率(外れたら斬り)
const DASH_CHANCE_FAR = 0.6;    // 遠くにいるとき
const DASH_CHANCE_HIGH = 0.9;  // 相手が上の足場にいるとき
const RETRY_WAIT = 1;          // 攻撃を選ばなかったとき、次に選び直すまでの待ち(フレーム)

// ---------- 急に別の人を狙う動きの調整用(2人とも生きているときだけ働く) ----------
const SWITCH_CHANCE = 0.3;      // 攻撃を選ぶとき、近い人ではなく別の人を狙う確率
const SWITCH_MID_CHANCE = 0.25; // ダッシュの途中で、急に別の人へ狙いを変える確率(0 で無効)
const SWITCH_AT = 0.4;          // ダッシュのどのあたりで変えるか(active の割合)

// ---------- ダッシュのあとの斬りの調整用 ----------
const FAST_SLASH_CHANCE = 0.5;  // 速いダッシュ斬りになる確率(外れたら遅い普通の斬り)

// ---------- 足攻撃(すぐ近くにいる相手用)の調整用 ----------
const CLOSE_RANGE = 140;        // 横の距離がこれ以内なら「すぐ近く」(px)
const FOOT_CHANCE = 0.7;        // すぐ近くにいるとき、足攻撃を選ぶ確率(外れたら他の攻撃)

// ---------- 下の足場など、床より高いところにいる相手用 ----------
const RAISED_OFFSET = 90;           // 床からこれ以上浮いていたら「足場の上」とみなす(px)
const DASH_CHANCE_PLATFORM = 1;   // 足場にある程度乗っている相手に、ダッシュを選ぶ確率
const PLATFORM_STAY = 30;           // 足場に乗って、この時間(フレーム)たったらダッシュで狩りに行く

// ---------- 体力が半分を切ったときの連続ダッシュ ----------
const RAGE_HP_RATIO = 0.5;      // 体力がこの割合以下になると、ダッシュが連続になる
const RAGE_DASH_MIN = 0.6;      // 怒り中、ダッシュを選ぶ確率の下限
const RUSH_COUNT = 3;           // 連続ダッシュの回数
const TIRED_FRAMES = 150;       // 連続ダッシュのあとの疲労の長さ(フレーム)。この間は動かず無防備

// ---------- 倒されたあと ----------
const DEAD_STAY = 90;           // 倒れた絵をそのまま見せておく時間(フレーム)
const DEAD_FADE = 60;           // そのあと、すっと消えるまでの時間(フレーム)。1 にすると一瞬で消える

// ボスの攻撃データ(Fighter の ATTACKS と同じ項目)
// startup: 予備動作 / active: 判定が出ている時間 / recovery: 硬直(すべて 1/60秒のフレーム数)
export const BOSS_ATTACKS = {
    slash: {
        startup: 30, active: 6, recovery: 20,
        range: 150, height: 170,
        lunge: 40,              // 振るあいだに前へ進む距離(px)
        damage: 60, stamina: 0,
        hitstun: 25, knockback: 320, hitStop: 6, shake: 0.01,
    },
    // すぐ近くにいる相手用の、速い足攻撃(予備動作も硬直も短い)
    foot: {
        foot: true,
        startup: 18, active: 5, recovery: 15,
        range: 90, height: 15,  // 体の前に出る長さと、足元からの高さ
        damage: 50, stamina: 0,
        hitstun: 25, knockback: 300, hitStop: 6, shake: 0.01,
    },
    // ダッシュのあとに出る、速い斬り(予備動作が短い。パリィしにくい)
    dashSlash: {
        fast: true,
        startup: 8, active: 6, recovery: 20,
        range: 150, height: 170,
        lunge: 40,
        damage: 35, stamina: 0,
        hitstun: 25, knockback: 340, hitStop: 6, shake: 0.01,
    },
    dash: {
        dash: true,
        startup: 18, active: 22, recovery: 25,
        speed: 18,              // 1フレームに進む距離(px)。active と掛けた分だけ飛ぶ
        reach: 20,              // 体の判定を左右に広げる量(px)
        range: 0, height: 170,
        damage: 35, stamina: 0,
        hitstun: 25, knockback: 360, hitStop: 6, shake: 0.012,
    },
};

// 連続ダッシュの2回目以降:予備動作を短くして、すぐ次の突進に入る
BOSS_ATTACKS.dashRush = { ...BOSS_ATTACKS.dash, startup: 8 };

export const BS = {
    IDLE: "idle",
    TELEGRAPH: "telegraph",
    ACTIVE: "active",
    RECOVER: "recover",
    STUN: "stun",
    DEAD: "dead",
    TIRED: "tired",     // 連続ダッシュのあとの疲労
};

const IDLE_WAIT = 90;   // 攻撃の間の待ち時間(フレーム)
const AGGRO = 260;      // この距離より遠いと「遠い」扱い。近いときだけ斬りを出す(px)

export default class BossEnemy {
    constructor(scene, x, groundY, { texture = "boss", maxHp = 1000 } = {}) {
        this.scene = scene;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.groundY = groundY;

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
        this.target = null;     // ダッシュで狙っている相手
        this.aim = 0;           // ダッシュの向き(ラジアン。0 が右、上は負の方向)
        this.vy = 0;            // 落下の速さ
        this.chained = false;   // ダッシュからの追撃・連続ダッシュ中かどうか(空中にとどまる)
        this.rushing = false;   // 連続ダッシュの最中かどうか
        this.rushLeft = 0;      // 連続ダッシュの残り回数
        this.stayFrames = new Map();  // 各プレイヤーが足場の上にいる時間(フレーム)
        this.stunFrames = 0;
        this.flashLeft = 0;
        this.hitSet = new Set();
        this.enter(BS.IDLE);
    }

    enter(state) {
        this.state = state;
        this.frame = 0;
        if (state === BS.ACTIVE || state === BS.RECOVER) this.vy = 0;
        // 追撃・連続ダッシュが終わったら(待機・スタン・疲労になったら)、その印を消す
        if (state === BS.IDLE || state === BS.STUN || state === BS.TIRED) {
            this.chained = false;
            this.rushing = false;
            this.rushLeft = 0;
        }
    }

    // 各プレイヤーが、床より浮いている(足場の上にいる)時間を数える
    trackPlatformTime(players) {
        for (const p of players) {
            const up = p.sprite.y < this.groundY - RAISED_OFFSET;
            this.stayFrames.set(p, up ? (this.stayFrames.get(p) ?? 0) + 1 : 0);
        }
    }
    // 追加
pickTarget(players) {
    const alive = players.filter((p) => p.hp > 0);
    return alive.length ? alive[Math.floor(Math.random() * alive.length)] : null;
}
    // ---------- 毎tick(1/60秒)呼ぶ。players は攻撃の対象(Fighter の配列) ----------
    tick(players) {
   
        this.trackPlatformTime(players);
        // ダッシュ中以外は、空中にいたら床まで落ちる
        const dashing = this.state === BS.ACTIVE && this.attack?.dash;
        // ダッシュからの追撃は、構えて振るあいだ空中にとどまる(硬直で落ちる)
        const hover = this.chained && (this.state === BS.TELEGRAPH || this.state === BS.ACTIVE);
        if (!dashing && !hover) this.applyGravity();
        // 倒されたあとは、経過時間だけ数える(消えるタイミングに使う)
        if (this.state === BS.DEAD) {
            this.frame++;
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
                // ダッシュの予備動作中は、相手のほうへ体を向け続ける
                if (this.attack.dash) this.updateAim(false);
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
            case BS.TIRED:
                // 疲労:床に落ちて動かない(落下は tick の先頭で処理される)
                if (this.frame >= TIRED_FRAMES) this.enter(BS.IDLE);
                break;
        }
    }

    // 待機:いちばん近い生きているプレイヤーのほうを向き、確率で攻撃を選ぶ
    tickIdle(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) return;

        // 待っているあいだは、近い人のほうを向く
        this.facing = Math.sign(nearest.sprite.x - this.sprite.x) || this.facing;

        if (this.frame <= IDLE_WAIT) return;

        // ときどき、近い人ではなく別の人を急に狙う
        const target = this.pickTarget(players);
        const dx = target.sprite.x - this.sprite.x;
        this.facing = Math.sign(dx) || this.facing;

        const far = Math.abs(dx) > AGGRO;
        // 相手の中心が、ボスの頭より上にいる = 上の足場にいる
        const high = target.sprite.y < this.sprite.y - this.sprite.height / 2;
        // 床より浮いている(下の足場の上、ジャンプ中など)
        const up = target.sprite.y < this.groundY - RAISED_OFFSET;
        // 足場に、ある程度の時間乗り続けている
        const raised = up && (this.stayFrames.get(target) ?? 0) >= PLATFORM_STAY;
        // 体力が半分以下なら怒り状態
        const enraged = this.hp <= this.maxHp * RAGE_HP_RATIO;

        // すぐ近くの、床の上にいる相手には、速い足攻撃(足元の判定なので浮いている相手には出さない)
        if (!high && !up && Math.abs(dx) <= CLOSE_RANGE && Math.random() < FOOT_CHANCE) {
            this.attack = BOSS_ATTACKS.foot;
            this.enter(BS.TELEGRAPH);
            return;
        }

        let chance = high
            ? DASH_CHANCE_HIGH
            : raised
                ? DASH_CHANCE_PLATFORM
                : far
                    ? DASH_CHANCE_FAR
                    : DASH_CHANCE_NEAR;
        if (enraged) chance = Math.max(chance, RAGE_DASH_MIN);

        if (Math.random() < chance) {
            // ダッシュ攻撃(怒り中は連続ダッシュ)
            this.target = target;
            this.attack = BOSS_ATTACKS.dash;
            if (enraged) {
                this.rushing = true;
                this.rushLeft = RUSH_COUNT - 1;
            }
            this.updateAim(false);
            this.enter(BS.TELEGRAPH);
        } else if (!far && !high && !up) {
            // 近くて床の上なら斬り
            this.attack = BOSS_ATTACKS.slash;
            this.enter(BS.TELEGRAPH);
        } else {
            // 遠い or 浮いている or 上にいるのにダッシュを選ばなかった:少し待って選び直す
            this.frame = IDLE_WAIT - RETRY_WAIT;
        }
    }

    // ダッシュの向きを、狙っている相手のほうへ合わせる
    // limited が true なら、1フレームに曲がれる量を DASH_TURN までに制限する(追尾しつつ避けられる)
    updateAim(limited) {
        const t = this.target;
        if (!t || t.hp <= 0) return;

        const desired = Math.atan2(
            t.sprite.y - this.sprite.y,
            t.sprite.x - this.sprite.x
        );

        if (!limited) {
            this.aim = desired;
        } else {
            const diff = Phaser.Math.Angle.Wrap(desired - this.aim);
            this.aim += Phaser.Math.Clamp(diff, -DASH_TURN, DASH_TURN);
        }
        this.facing = Math.sign(Math.cos(this.aim)) || this.facing;
    }

    // ダッシュの途中で、一度だけ確率で別の人へ狙いを変える
    // (向きは DASH_TURN の範囲で曲がるので、急に方向を変えて飛びかかる動きになる)
    maybeSwitchTarget(players) {
        if (this.frame !== Math.round(this.attack.active * SWITCH_AT)) return;
        const other = this.otherAlive(players, this.target);
        if (other && Math.random() < SWITCH_MID_CHANCE) this.target = other;
    }

    // アリーナの中と床の上に収めて動かす
    moveBody(dx, dy) {
        const half = this.sprite.width / 2;
        const floorY = this.groundY - this.sprite.height / 2;
        this.sprite.x = Phaser.Math.Clamp(this.sprite.x + dx, ARENA_LEFT + half, ARENA_RIGHT - half);
        this.sprite.y = Phaser.Math.Clamp(this.sprite.y + dy, CEILING_Y, floorY);
    }

    // 空中にいたら床まで落とす
    applyGravity() {
        const floorY = this.groundY - this.sprite.height / 2;
        if (this.sprite.y < floorY) {
            this.vy += GRAVITY;
            this.sprite.y = Math.min(floorY, this.sprite.y + this.vy);
        } else {
            this.sprite.y = floorY;
            this.vy = 0;
        }
    }

    // 攻撃中:判定が出ているあいだ毎フレーム、まだ当てていない相手だけ調べる
    tickActive(players) {
        const a = this.attack;

        // 動き
        if (a.dash) {
            this.maybeSwitchTarget(players);
            this.updateAim(true);
            this.moveBody(Math.cos(this.aim) * a.speed, Math.sin(this.aim) * a.speed);
        } else if (a.lunge) {
            this.moveBody(this.facing * a.lunge / a.active, 0);
        }

        const rect = this.hitRect(a);
        this.hitInfo = { x: rect.centerX, y: rect.centerY, w: rect.width, h: rect.height };
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

        if (this.frame >= a.active) {
            if (a.dash && this.rushing) {
                // 連続ダッシュ:残りがあれば空中のまま次の突進、なければ疲労
                if (this.rushLeft > 0) {
                    this.rushLeft--;
                    this.startRush(players);
                } else {
                    this.attack = null;
                    this.enter(BS.TIRED);
                }
            } else if (a.dash) {
                // ダッシュのあとは、そのまま斬りにつなげる
                this.startFollowUp(players);
            } else if (a.foot && this.hitSet.size > 0) {
                this.startAfterStomp(players);
            }else {
                this.enter(BS.RECOVER);
            }
        }
    }
    startAfterStomp(players) {
    const target = this.pickTarget(players);
    if (!target) { this.enter(BS.RECOVER); return; }
    this.target = target;
    this.facing = Math.sign(target.sprite.x - this.sprite.x) || this.facing;

    const r = Math.random();
    if (r < 0.45) this.attack = BOSS_ATTACKS.slash;
    else if (r < 0.80) { this.attack = BOSS_ATTACKS.dash; this.updateAim(false); }
    else this.attack = BOSS_ATTACKS.foot;

    this.hitSet.clear();
    this.enter(BS.TELEGRAPH);
}
    // ダッシュのあとの追撃:確率で、速いダッシュ斬りか、遅い普通の斬りを選ぶ
    startFollowUp(players) {
        const target =
            this.target && this.target.hp > 0 ? this.target : this.nearestAlive(players);
        if (!target) {
            this.enter(BS.RECOVER);
            return;
        }

        this.facing = Math.sign(target.sprite.x - this.sprite.x) || this.facing;
        this.attack =
            Math.random() < FAST_SLASH_CHANCE ? BOSS_ATTACKS.dashSlash : BOSS_ATTACKS.slash;
        this.hitSet.clear();
        this.enter(BS.TELEGRAPH);
        this.chained = true;
    }

    // 連続ダッシュの次の突進:相手を選び直して、短い予備動作でまた飛ぶ(落ちずに空中のまま)
    startRush(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) {
            this.enter(BS.RECOVER);
            return;
        }

        const other = this.otherAlive(players, nearest);
        this.target = other && Math.random() < SWITCH_CHANCE ? other : nearest;
        this.attack = BOSS_ATTACKS.dashRush;
        this.updateAim(false);
        this.hitSet.clear();
        this.enter(BS.TELEGRAPH);
        this.chained = true;
    }

    // 攻撃判定の四角形
    hitRect(a) {
        // ダッシュ:体そのものが当たり判定(左右に少し広げる)
        if (a.dash) {
            const b = this.sprite.getBounds();
            return new Phaser.Geom.Rectangle(
                b.x - a.reach,
                b.y,
                b.width + a.reach * 2,
                b.height
            );
        }

        // 足攻撃:体の足元から前にかけて。体と重なるほど近くにいる相手にも当たる
        if (a.foot) {
            const half = this.sprite.width / 2;
            const bottom = this.sprite.y + this.sprite.height / 2;
            const left = this.facing > 0
                ? this.sprite.x - half
                : this.sprite.x - half - a.range;
            return new Phaser.Geom.Rectangle(
                left,
                bottom - a.height,
                half * 2 + a.range,
                a.height
            );
        }

        // 斬り:ボスの前、足元に合わせる
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

    // exclude 以外で生きている人(いなければ null)
    otherAlive(players, exclude) {
        return players.find((p) => p !== exclude && p.hp > 0) ?? null;
    }

    // ---------- 相手に送るためのデータ(通信は自分で作る) ----------
    // 位置・向き・状態・攻撃の種類・HP をまとめて返す。そのまま JSON で送れる
    getSyncData() {
        // 今出している攻撃の名前("slash" や "dash" など)。出していなければ null
        let attackName = null;
        for (const [name, a] of Object.entries(BOSS_ATTACKS)) {
            if (a === this.attack) {
                attackName = name;
                break;
            }
        }

        return {
            x: Math.round(this.sprite.x),
            y: Math.round(this.sprite.y),
            facing: this.facing,                        // -1: 左 / 1: 右
            state: this.state,                          // idle / telegraph / active / recover / stun / dead / tired
            attack: attackName,
            frame: this.frame,                          // 今の状態に入ってからのフレーム数
            aim: Math.round(this.aim * 1000) / 1000,    // ダッシュの向き(ラジアン)
            flash: this.flashLeft,                      // 被弾で白く光る残りフレーム
            hp: this.hp,
            maxHp: this.maxHp,
            hit: this.hitInfo,
        };
    }

    // ---------- プレイヤーの攻撃を受ける(Fighter から呼ばれる) ----------
    receiveHit(attacker, a) {
        if (this.state === BS.DEAD) return;
        if(this.mirror){
            this.scene.events.emit("hit", this, attacker, a );
            this.onMirrorHit?.(attacker, a);
            return;
        }
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
        if(this.mirror) return;
        if (this.state === BS.DEAD) return;
        this.stunFrames = frames;
        this.attack = null;
        this.enter(BS.STUN);
    }

    // 今の状態に合う絵の名前
    textureKey() {
        // 倒されたときは、倒れた姿の絵
        if (this.state === BS.DEAD) return "boss_dead";

        // パリィされてスタンしているあいだ / 連続ダッシュのあとの疲労は、それぞれ専用の絵
        if (this.state === BS.STUN) return "boss_parystun";
        if (this.state === BS.TIRED) return "boss_stun";

        const a = this.attack;

        if (a && a.dash) {
            if (this.state === BS.TELEGRAPH) return "boss_dash";
            if (this.state === BS.ACTIVE) {
                return this.frame < a.active * DASH_POSE_SPLIT ? "boss_dash" : "boss_dashattack";
            }
            if (this.state === BS.RECOVER) return "boss_dashattack";
        } else if (a && a.fast) {
            // 速い斬りは構えを見せず、dashattack の絵のまま振る
            if (
                this.state === BS.TELEGRAPH ||
                this.state === BS.ACTIVE ||
                this.state === BS.RECOVER
            ) {
                return "boss_dashattack";
            }
        } else if (a && a.foot) {
            // 足攻撃:構え(footwait)→ 蹴り(footattack)
            if (this.state === BS.TELEGRAPH) return "boss_footwait";
            if (this.state === BS.ACTIVE || this.state === BS.RECOVER) return "boss_footattack";
        } else if (a) {
            if (this.state === BS.TELEGRAPH) return "boss_stance";
            if (this.state === BS.ACTIVE || this.state === BS.RECOVER) return "boss_swing";
        }
        return "boss";
    }

    // ---------- 表示(状態を色で見えるように) ----------
    render() {
        const v = this.view;
        const dashing = this.state === BS.ACTIVE && this.attack?.dash;

        if (dashing) {
            // ダッシュ中:体の中心を軸に、進む向きへ傾ける
            const angle = Math.atan2(Math.sin(this.aim), Math.abs(Math.cos(this.aim)));
            v.setOrigin(0.5, 0.5)
                .setPosition(this.sprite.x, this.sprite.y)
                .setRotation(angle * this.facing);
        } else {
            // 食らい判定の下端(足元)に画像の下端を合わせる
            v.setOrigin(0.5, 1)
                .setRotation(0)
                .setPosition(
                    this.sprite.x,
                    this.sprite.y + this.sprite.height / 2 + FOOT_OFFSET
                );
        }
        v.setFlipX(this.facing !== ART_FACING);

        const texKey = this.textureKey();
        if (v.texture.key !== texKey) {
            v.setTexture(texKey).setDisplaySize(200, 170);
        }

        if (this.state === BS.DEAD) {
            v.clearTint();   // 倒れた絵があるので、暗くはしない
            // 少し倒れたままにしてから、すっと消える
            const fade = Phaser.Math.Clamp((this.frame - DEAD_STAY) / DEAD_FADE, 0, 1);
            v.setAlpha(1 - fade);
            if (fade >= 1) {
                v.setVisible(false);
                this.sprite.setVisible(false);   // デバッグ用の枠も消す
            }
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
                v.clearTint();         // パリィされた:専用の絵があるので色は付けない
                break;
            case BS.TIRED:
                v.clearTint();         // 疲労:専用の絵があるので色は付けない(攻撃のチャンス)
                break;
            default:
                v.clearTint();
        }
    }
}