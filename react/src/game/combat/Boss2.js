import Phaser from "phaser";
import BaseBoss, { BS } from "./BaseBoss";

// ───────── Boss2 の調整用の数値 ─────────
const WALK_SPEED = 2;          // 歩く速さ(px/フレーム)
const CLOSE_RANGE = 170;       // この距離以内=近距離、それより遠い=遠距離

// 遠距離で選ぶ攻撃の割合(合計1にすること)
const FAR_BLOCK_CHANCE = 0.5;  // 氷塊系(選択後、さらに3種類から均等抽選)
const FAR_RAIN_CHANCE = 0.3;   // 相手の頭上に追尾する氷の剣
const FAR_SHOCK_CHANCE = 0.2; // 通常のiceShock

// 近距離では通常iceShockを優先し、残りをバックステップ攻撃にする
const CLOSE_SHOCK_CHANCE = 0.5;

// 頭上の剣が浮いている間に出せるのは「氷塊を落とす」と「通常iceShock」だけ。
// そのうち iceShock を選ぶ確率(残りは氷塊を落とす攻撃)
const HEAD_RAIN_SHOCK_CHANCE = 0.5;

// バックステップ攻撃(近距離)
const BACKSTEP_SPEED = 6;
const FIRST_VOLLEY_AT = 6;
const SWORD_HEIGHTS = [30, 85, 140];  // 剣を撃つ高さ(地面から)

// 氷塊
const BIG_BLOCK_COUNTS = [4, 5];      // 降らせる大きい氷塊の数(どちらかをランダム)
const BLOCK_STAGGER = 12;             // 氷塊が降り始める間隔(フレーム)
const BLOCK_FALL_GRAVITY = 0.5;
const BLOCK_FALL_MAX = 14;
const BLOCK_PREDICT_FRAMES = 55;      // 氷塊が地面に届くまでの予測フレーム
const SMALL_COUNT = 4;                // 着地で出る小さい氷塊の数
const SMALL_GRAVITY = 0.4;

// 通常iceShock: ボスの左右からステージ端へ走る氷柱
const ICICLE_MAX = 30;                 // 左右それぞれの最大本数
const ICICLE_SPACING = 70;             // 氷柱同士の間隔(px)
const ICICLE_STAGGER = 10;             // ボスから外へ向かって遅れて発生する間隔(フレーム)
const ICICLE_LIFE = 25;                // 発生後に消えるまでのフレーム
const ICICLE_RISE = 10;                // 地面から伸びるまでのフレーム

// 氷塊落としの追加攻撃②専用: 相手の足元に氷柱を連続発生させる
// 次の柱が出ると前の柱が沈み、さらに次が出ると古い柱を消す。
const BLOCK_TRACK_COUNT = 7;
// 氷柱は、最初はゆっくり出て、だんだん速くなる
const BLOCK_TRACK_INTERVAL_START = 40; // 1本目→2本目の間隔(フレーム)。最初はゆっくり
const BLOCK_TRACK_INTERVAL_RATIO = 0.8; // 1本ごとに、間隔にこの倍率をかけて短くする
const BLOCK_TRACK_INTERVAL_MIN = 23;   // 間隔の下限(フレーム)
const BLOCK_TRACK_RISE_MIN = 20;       // 速くなったときの、伸びきるまでの下限(フレーム)
const BLOCK_TRACK_RISE = 43;           // 伸びきって当たり判定が出るまでのフレーム
const BLOCK_TRACK_LOCK = 16;           // 当たり判定が出る何フレーム前に追尾をやめるか(大きいほど避けやすい)
const BLOCK_TRACK_SINK = 6;            // 沈み始めてから沈みきるまでのフレーム

// ボスの近くに浮かべて1本ずつ撃つ剣
const BOSS_SWORD_COUNT = 5;            // 1人あたりの本数
// 剣は、最初はゆっくり撃ち、だんだん速くなる
const BOSS_SWORD_INTERVAL_START = 50;  // 1本目→2本目の間隔(フレーム)。最初はゆっくり
const BOSS_SWORD_INTERVAL_RATIO = 0.78; // 1本ごとに、間隔にこの倍率をかけて短くする
const BOSS_SWORD_INTERVAL_MIN = 12;    // 間隔の下限(フレーム)
const BOSS_SWORD_HOVER = 12;
const BOSS_SWORD_POSITIONS = [
    [-72, 105], [72, 145], [-48, 185], [48, 125], [0, 210],
];

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

    // 近距離: バックステップしながら剣3本 → 攻撃姿勢でもう3本
    backstepAttack: {
        noBody: true, backstep: true,
        // startup を長くして2回目を遅らせ、recovery を長くして後隙を増やした
        startup: 32, active: 10, recovery: 55,
        ...NONE,
    },

    // 氷塊系1: 氷塊を上から降らせる(生きている全員を交互に狙う)
    iceBlock: {
        noBody: true, block: true,
        startup: 36, active: 20, recovery: 50,
        ...NONE,
    },

    // 氷塊系2: 相手の足元を追尾しながら氷柱を連続発生(全員に同時)。
    // 次の柱が出ると前の柱は沈み、さらに次の柱が出ると古い柱は消える。
    iceBlockWave: {
        noBody: true, block: true, blockWave: true,
        startup: 45, active: 20, recovery: 60,
        ...NONE,
    },

    // 氷塊系3: ボスの近くに剣を浮かせ、1本ずつ発射(全員に同時)
    iceBlockSwords: {
        noBody: true, block: true, blockSwords: true,
        startup: 36, active: 20, recovery: 50,
        ...NONE,
    },

    // 通常iceShock: ボスの左右からステージ端へ向かって氷柱を走らせる。
    iceShock: {
        noBody: true, shock: true,
        startup: 25, active: 45, recovery: 30,
        ...NONE,
    },

    // 通常iceShock用: ボスの真下(体の幅ぶん)の当たり判定
    icicleUnder: {
        projectile: true, parryable: false,
        range: 150, height: 50,
        damage: 45, stamina: 0, hitstun: 25, knockback: 280,
        hitStop: 0, shake: 0.01,
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
    blockTrackIcicle: { key: "boss2_icicle", w: 50, h: 110, originY: 1 },
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
        hovering: false,    // 剣: 浮いている間 true
        bossHover: false,   // 剣: ボスの近くに浮いている場合 true
        launchIn: 0,        // 剣: 発射までの残りフレーム
        sinking: false,     // 波状氷柱: 地面に沈んでいる間 true
        sinkAge: 0,         // 波状氷柱: 沈み始めてからのフレーム
        blockTrackId: 0,           // 氷塊派生氷柱: 同じ連続攻撃を識別
        blockTrackIndex: 0,        // 氷塊派生氷柱: 何本目か
        rise: BLOCK_TRACK_RISE,    // 氷塊派生氷柱: 伸びきるまでのフレーム(後の柱ほど短い)
        lock: BLOCK_TRACK_LOCK,    // 氷塊派生氷柱: 当たり判定の何フレーム前に追尾をやめるか
        target: null,       // 剣・追尾氷柱: 追従する相手
        offX: 0, offY: 0,   // 剣: 浮いている位置
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

        // 攻撃判定を白く薄く表示する(プレイヤーが危険範囲を見て回避できるようにする)
        this.hitboxGraphics = scene.add.graphics().setDepth(8);

        // プレイヤーの直近の移動量から、氷塊の落下先を予測する
        this.lastPlayerX = new Map();
        this.playerVelocityX = new Map();

        // 氷柱の追尾: 生きているプレイヤーごとに1つずつ持つ
        this.blockTrackSequences = [];
        this.nextBlockTrackId = 1;

        // ボス近くの剣: 全員ぶんをまとめて1つで管理する
        this.bossSwordSequence = null;

        // 頭上の剣: 1本目が撃たれたか / 撃たれた直後の反応攻撃がまだ未使用か
        this.headRainFired = false;
        this.headRainReact = false;
    }

    // ───────── 行動選択 ─────────

    // 氷塊系の3種類を均等に選ぶ。
    chooseIceBlockVariant() {
        const choices = [
            BOSS2_ATTACKS.iceBlock,
            BOSS2_ATTACKS.iceBlockWave,
            BOSS2_ATTACKS.iceBlockSwords,
        ];
        return choices[Math.floor(Math.random() * choices.length)];
    }

    // 氷塊・氷柱の追尾・ボス近くの剣のどれかが、まだ続いているか
    isBlockAttackBusy() {
        if (this.blockTrackSequences.length || this.bossSwordSequence) {
            return true;
        }

        return this.projs.some(
            (p) =>
                p.active &&
                (p.kind === "big" ||
                    p.kind === "small" ||
                    p.kind === "blockTrackIcicle" ||
                    (p.kind === "sword" && p.bossHover))
        );
    }

    tickIdle(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) return;

        this.faceToward(nearest);

        // 氷塊系の攻撃が続いている間は、歩きも攻撃もしない
        if (this.isBlockAttackBusy()) {
            this.frame = 0;   // 終わってから idleWait ぶん待つ
            return;
        }

        const dx = nearest.sprite.x - this.sprite.x;
        const far = Math.abs(dx) > CLOSE_RANGE;

        // 遠ければ近づきながら待つ
        if (far) {
            this.moveBody(Math.sign(dx) * WALK_SPEED, 0);
        }

        // 頭上に追尾中の剣が浮いているか
        const hoveringHeadSword = this.projs.some(
            (p) => p.active && p.kind === "sword" && p.hovering && !p.bossHover
        );

        if (hoveringHeadSword) {
            // 1本目が撃たれるまでは、何も攻撃しない
            if (!this.headRainFired) return;

            // 1本目が撃たれた直後は待たずに、すぐ反応して攻撃する
            // (2回目以降は、通常どおり idleWait だけ待つ)
            if (!this.headRainReact && this.frame <= this.cfg.idleWait) return;
            this.headRainReact = false;

            // 浮いている間に出せるのは「氷塊を落とす」と「通常iceShock」だけ
            this.attack =
                Math.random() < HEAD_RAIN_SHOCK_CHANCE
                    ? BOSS2_ATTACKS.iceShock
                    : BOSS2_ATTACKS.iceBlock;

            this.enter(BS.TELEGRAPH);
            return;
        }

        if (this.frame <= this.cfg.idleWait) return;

        if (!far) {
            if (Math.random() < CLOSE_SHOCK_CHANCE) {
                // 近距離対策として通常iceShockも使用する
                this.attack = BOSS2_ATTACKS.iceShock;
            } else {
                this.attack = BOSS2_ATTACKS.backstepAttack;
            }
        } else {
            const r = Math.random();

            if (r < FAR_BLOCK_CHANCE) {
                // 氷塊系の中で、3種類を均等に選ぶ
                this.attack = this.chooseIceBlockVariant();
            } else if (r < FAR_BLOCK_CHANCE + FAR_RAIN_CHANCE) {
                // 頭上追尾剣(浮いている間は上の分岐で処理済みなので、重ならない)
                this.attack = BOSS2_ATTACKS.iceSwordRain;
            } else {
                this.attack = BOSS2_ATTACKS.iceShock;
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

        if (a.backstep) {
            this.fireVolley();
        } else if (a.blockWave) {
            this.startBlockTrackingSequence(players);
        } else if (a.blockSwords) {
            this.startBossSwordSequence(players);
        } else if (a.block) {
            this.spawnBlocks(players);
        } else if (a.shock) {
            this.spawnIcicles();
        } else if (a.rain) {
            this.spawnSwordRain(players);
        }
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
        this.blockTrackSequences = [];
        this.bossSwordSequence = null;
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
        // 1フレームごとの移動量を記録し、氷塊の未来位置予測に使う
        for (const pl of players) {
            const previousX = this.lastPlayerX.get(pl);
            if (previousX !== undefined) {
                this.playerVelocityX.set(pl, pl.sprite.x - previousX);
            }
            this.lastPlayerX.set(pl, pl.sprite.x);
        }

        this.tickBlockTrackingSequences();
        this.tickBossSwordSequence();

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
                case "blockTrackIcicle":
                    this.tickBlockTrackIcicle(p, players);
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

        // 新しい6本が浮いたので、「1本目が撃たれたか」を最初からにする
        this.headRainFired = false;
        this.headRainReact = false;

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

    // ───────── ボスの近くに浮かせて1本ずつ撃つ剣(全員に同時) ─────────

    startBossSwordSequence(players) {
        const targets = players.filter((p) => p.hp > 0);
        if (!targets.length) return;

        this.bossSwordSequence = {
            targets,
            spawned: 0,
            wait: 0,
        };
        this.spawnBossSword();
    }

    // index 本目の剣を出してから、次の剣を出すまでの間隔(だんだん短くなる)
    bossSwordInterval(index) {
        return Math.max(
            BOSS_SWORD_INTERVAL_MIN,
            Math.round(
                BOSS_SWORD_INTERVAL_START *
                    BOSS_SWORD_INTERVAL_RATIO ** index
            )
        );
    }

    spawnBossSword() {
        const state = this.bossSwordSequence;
        if (!state || state.spawned >= BOSS_SWORD_COUNT) return;

        const [baseX, offY] = BOSS_SWORD_POSITIONS[state.spawned];
        const a = BOSS2_ATTACKS.rainSword;

        // 1ステップごとに、生きている全員へ1本ずつ出す
        // (2人目は左右を反転して、剣が重ならないようにする)
        state.targets.forEach((target, k) => {
            if (target.hp <= 0) return;

            const offX = k % 2 === 0 ? baseX : -baseX;

            this.spawnProj("sword", {
                a,
                target,
                hovering: true,
                bossHover: true,
                launchIn: BOSS_SWORD_HOVER,
                offX,
                offY,
                x: this.sprite.x + offX,
                y: this.groundY - offY,
                rot: 0,
            });
        });

        state.spawned++;
        state.wait = this.bossSwordInterval(state.spawned - 1);

        if (state.spawned >= BOSS_SWORD_COUNT) {
            this.bossSwordSequence = null;
        }
    }

    tickBossSwordSequence() {
        const state = this.bossSwordSequence;
        if (!state) return;

        if (!state.targets.some((t) => t.hp > 0)) {
            this.bossSwordSequence = null;
            return;
        }

        state.wait--;
        if (state.wait <= 0) this.spawnBossSword();
    }

    tickSword(p, players) {
        const a = p.a;

        // 浮いている間: 頭上追尾か、ボスの近くで発射待ち
        if (p.hovering) {
            const t = p.target;

            if (!t || t.hp <= 0) {
                p.active = false;
                return;
            }

            if (p.bossHover) {
                // ボスの周囲に浮かせ、相手の方向へ向ける
                p.x = this.sprite.x + p.offX;
                p.y = this.groundY - p.offY;
                const aimY = t.sprite.y - t.sprite.height * 0.15;
                p.rot = Math.atan2(aimY - p.y, t.sprite.x - p.x);
            } else {
                // 相手の頭上についていき、相手の方を向く
                p.x = t.sprite.x + p.offX;
                p.y = t.sprite.y - HOVER_HEIGHT + p.offY;
                p.rot = Math.atan2(t.sprite.y - p.y, t.sprite.x - p.x);
            }

            p.launchIn--;

            if (p.launchIn <= 0) {
                // 発射の瞬間の向きで固定して飛ばす
                p.hovering = false;

                // 頭上の剣の1本目が撃たれたら、ボスが反応して攻撃できるようにする
                if (!p.bossHover && !this.headRainFired) {
                    this.headRainFired = true;
                    this.headRainReact = true;
                }
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
            const vx = this.playerVelocityX.get(t) ?? 0;
            const predictFrames = BLOCK_PREDICT_FRAMES + i * BLOCK_STAGGER;
            const predictedX = t.sprite.x + vx * predictFrames;
            const x = Phaser.Math.Clamp(
                predictedX + Phaser.Math.Between(-12, 12),
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

        // 発生時に予測した位置へ落とす。落下中は追尾しない。
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

    // ───────── 通常iceShock: ボスからステージ端へ走る氷柱 ─────────

    // 通常版はボスの近くから左右へ向かって順番に氷柱が生える。
    // 相手の足元を追尾する攻撃ではなく、ボスを起点にステージ両端まで走る。
    spawnIcicles() {
        const a = BOSS2_ATTACKS.icicle;
        const half = this.sprite.width / 2;
        const { arenaLeft, arenaRight } = this.cfg;

        // 左右の両方へ、ボスのすぐ足元から闘技場の端まで生やす。
        // 最初の氷柱の当たり判定をボスの外側だけでなく少し内側にも重ね、
        // 近距離にいる相手にも当たるようにする。
        const startOffset = half + a.range / 2 - 12;

        // ボスの真下にも判定を出す(1本の広い判定なので、二重ヒットしない)
        this.spawnProj("icicle", {
            a: BOSS2_ATTACKS.icicleUnder,
            x: this.sprite.x,
            y: this.groundY,
        });

        for (const dir of [-1, 1]) {
            for (let i = 0; i < ICICLE_MAX; i++) {
                const x = this.sprite.x + dir * (startOffset + i * ICICLE_SPACING);
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

        // 地面から伸びきるまでは当たらない。
        if (p.age >= ICICLE_RISE) {
            this.hitPlayers(p, players, a.range, a.height, p.y - a.height / 2);
        }

        if (p.age >= ICICLE_LIFE) {
            p.active = false;
        }
    }

    // ───────── 氷塊落としの追加攻撃②: 相手の足元を追尾する氷柱(全員に同時) ─────────
    // 氷塊派生のアイスショック。通常iceShockとは別攻撃。
    // 次の柱が出たら前の柱が沈み、さらに次の柱が出た時点で古い柱を消す。
    // 通常版のようにボスから走らない。

    // index 本目の氷柱を出してから、次の氷柱を出すまでの間隔(だんだん短くなる)
    blockTrackInterval(index) {
        return Math.max(
            BLOCK_TRACK_INTERVAL_MIN,
            Math.round(
                BLOCK_TRACK_INTERVAL_START *
                    BLOCK_TRACK_INTERVAL_RATIO ** index
            )
        );
    }

    startBlockTrackingSequence(players) {
        const alive = players.filter((p) => p.hp > 0);
        if (!alive.length) return;

        // 生きている全員に、それぞれ専用の氷柱の列を同時に出す
        this.blockTrackSequences = alive.map((target) => ({
            id: this.nextBlockTrackId++,
            target,
            spawned: 0,
            wait: 0,
        }));

        for (const seq of this.blockTrackSequences) {
            this.spawnNextBlockTrackingIcicle(seq);
        }
    }

    spawnNextBlockTrackingIcicle(state) {
        if (state.spawned >= BLOCK_TRACK_COUNT) return;
        if (!state.target || state.target.hp <= 0) return;

        // 次の柱が出るタイミングで、2つ前の柱を消し、直前の柱を沈ませる
        for (const p of this.projs) {
            if (!p.active || p.kind !== "blockTrackIcicle" || p.blockTrackId !== state.id) continue;

            if (p.blockTrackIndex === state.spawned - 2) {
                p.active = false;
            } else if (p.blockTrackIndex === state.spawned - 1) {
                p.sinking = true;
                p.sinkAge = 0;
            }
        }

        const { arenaLeft, arenaRight } = this.cfg;
        const x = Phaser.Math.Clamp(state.target.sprite.x, arenaLeft + 25, arenaRight - 25);

        // 間隔が短い柱ほど、伸びきるまでも、追尾をやめるまでも速くなる
        const interval = this.blockTrackInterval(state.spawned);
        const speed = interval / BLOCK_TRACK_INTERVAL_START;
        const rise = Math.max(
            BLOCK_TRACK_RISE_MIN,
            Math.round(BLOCK_TRACK_RISE * speed)
        );
        const lock = Math.max(
            4,
            Math.round(BLOCK_TRACK_LOCK * (rise / BLOCK_TRACK_RISE))
        );

        this.spawnProj("blockTrackIcicle", {
            a: BOSS2_ATTACKS.icicle,
            target: state.target,
            x,
            y: this.groundY,
            blockTrackId: state.id,
            blockTrackIndex: state.spawned,
            sinking: false,
            sinkAge: 0,
            rise,
            lock,
        });

        state.spawned++;
        state.wait = interval;
    }

    // 残っている柱をすべて沈ませる(列の終わりや、狙っていた相手が倒れたとき)
    sinkBlockTrackSequence(state) {
        for (const p of this.projs) {
            if (
                p.active &&
                p.kind === "blockTrackIcicle" &&
                p.blockTrackId === state.id &&
                !p.sinking
            ) {
                p.sinking = true;
                p.sinkAge = 0;
            }
        }
    }

    tickBlockTrackingSequences() {
        const remaining = [];

        for (const state of this.blockTrackSequences) {
            // 狙っていた相手が倒れたら、その列は終わり
            if (!state.target || state.target.hp <= 0) {
                this.sinkBlockTrackSequence(state);
                continue;
            }

            state.wait--;

            if (state.wait <= 0) {
                if (state.spawned < BLOCK_TRACK_COUNT) {
                    this.spawnNextBlockTrackingIcicle(state);
                } else {
                    // 最後の柱も沈ませて、この列を終える
                    this.sinkBlockTrackSequence(state);
                    continue;
                }
            }

            remaining.push(state);
        }

        this.blockTrackSequences = remaining;
    }

    tickBlockTrackIcicle(p, players) {
        const a = p.a;

        // 当たり判定が出る少し前(BLOCK_TRACK_LOCK フレーム前)まで相手の足元を追尾し、
        // そこで位置を固定する。次の柱が出て沈み始めたら、その場で下へ沈む。
        if (
            !p.sinking &&
            p.age <= p.rise - p.lock &&
            p.target &&
            p.target.hp > 0
        ) {
            const { arenaLeft, arenaRight } = this.cfg;
            p.x = Phaser.Math.Clamp(p.target.sprite.x, arenaLeft + 25, arenaRight - 25);
        }

        if (p.sinking) p.sinkAge++;

        const riseScale = Math.min(1, p.age / p.rise);
        const sinkScale = p.sinking
            ? Math.max(0, 1 - p.sinkAge / BLOCK_TRACK_SINK)
            : 1;
        const currentHeight = a.height * riseScale * sinkScale;

        if (p.age >= p.rise && currentHeight > 1) {
            this.hitPlayers(
                p,
                players,
                a.range,
                currentHeight,
                this.groundY - currentHeight / 2
            );
        }

        if (p.sinking && p.sinkAge >= BLOCK_TRACK_SINK) {
            p.active = false;
        }
    }

    // ───────── 同期 ─────────

    // ホストの飛び道具を、プール内の同じスロット番号でゲストへ送る。
    // 出現待ち(delay)も送るため、遅れて出る氷塊・氷柱も同じタイミングで表示できる。
    getExtraSyncData() {
        const projs = [];

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            if (!p.active) continue;

            const attackKey =
                p.a === BOSS2_ATTACKS.iceSword ? "iceSword" :
                p.a === BOSS2_ATTACKS.rainSword ? "rainSword" :
                p.a === BOSS2_ATTACKS.iceBlockBig ? "iceBlockBig" :
                p.a === BOSS2_ATTACKS.iceBlockSmall ? "iceBlockSmall" :
                p.a === BOSS2_ATTACKS.icicleUnder ? "icicleUnder" :
                p.a === BOSS2_ATTACKS.icicle ? "icicle" : null;

            projs.push({
                i,
                k: p.kind,
                ak: attackKey,
                x: Math.round(p.x * 100) / 100,
                y: Math.round(p.y * 100) / 100,
                r: Math.round(p.rot * 1000) / 1000,
                g: p.age,
                d: p.delay,
                s: p.sinking ? 1 : 0,
                sa: p.sinkAge,
                bi: p.blockTrackId,
                bn: p.blockTrackIndex,
                rs: p.rise,
                h: p.hovering ? 1 : 0,
                b: p.bossHover ? 1 : 0,
            });
        }

        return { projs };
    }

    // ゲスト側は攻撃判定を行わず、ホストから届いた座標・状態を描画する。
    applyExtraSync(d) {
        const list = Array.isArray(d?.projs) ? d.projs : [];
        const received = new Map();
        const attackByKey = {
            icicleUnder: BOSS2_ATTACKS.icicleUnder,
            iceSword: BOSS2_ATTACKS.iceSword,
            rainSword: BOSS2_ATTACKS.rainSword,
            iceBlockBig: BOSS2_ATTACKS.iceBlockBig,
            iceBlockSmall: BOSS2_ATTACKS.iceBlockSmall,
            icicle: BOSS2_ATTACKS.icicle,
        };

        for (const src of list) {
            if (
                !Number.isInteger(src?.i) ||
                src.i < 0 ||
                src.i >= this.projs.length ||
                !Object.prototype.hasOwnProperty.call(VIEW, src.k)
            ) {
                continue;
            }
            received.set(src.i, src);
        }

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            const src = received.get(i);

            if (!src) {
                p.active = false;
                continue;
            }

            p.active = true;
            p.kind = src.k;
            p.a = attackByKey[src.ak] ?? (
                src.k === "big" ? BOSS2_ATTACKS.iceBlockBig :
                src.k === "small" ? BOSS2_ATTACKS.iceBlockSmall :
                src.k === "icicle" || src.k === "blockTrackIcicle" ? BOSS2_ATTACKS.icicle :
                src.k === "sword" ? BOSS2_ATTACKS.rainSword : null
            );
            p.x = Number(src.x) || 0;
            p.y = Number(src.y) || 0;
            p.rot = Number(src.r) || 0;
            p.age = Number(src.g) || 0;
            p.delay = Math.max(0, Number(src.d) || 0);
            p.sinking = !!src.s;
            p.sinkAge = Number(src.sa) || 0;
            p.blockTrackId = Number(src.bi) || 0;
            p.blockTrackIndex = Number(src.bn) || 0;
            p.rise = Number(src.rs) || BLOCK_TRACK_RISE;
            p.hovering = !!src.h;
            p.bossHover = !!src.b;
        }
    }

    // ───────── 描画 ─────────

    // 飛び道具ごとの実際の当たり判定範囲を返す。
    // 氷柱は伸びている途中も白い予告範囲を表示し、沈むと表示も小さくする。
    projectileHitbox(p) {
        if (!p.active || p.delay > 0) return null;

        switch (p.kind) {
            case "sword": {
                if (p.hovering) return null;
                const a = p.a ?? BOSS2_ATTACKS.rainSword;
                const isSmallSword = a === BOSS2_ATTACKS.iceSword;
                const w = a.range;
                const h = isSmallSword ? a.height : a.range;
                return { x: p.x, y: p.y, w, h };
            }
            case "big":
            case "small": {
                const a = p.a ?? (p.kind === "big"
                    ? BOSS2_ATTACKS.iceBlockBig
                    : BOSS2_ATTACKS.iceBlockSmall);
                return { x: p.x, y: p.y, w: a.range, h: a.height };
            }
            case "icicle": {
                const a = p.a ?? BOSS2_ATTACKS.icicle;
                const h = a.height * Math.min(1, p.age / ICICLE_RISE);
                if (h <= 1) return null;
                return {
                    x: p.x,
                    y: this.groundY - h / 2,
                    w: a.range,
                    h,
                };
            }
            case "blockTrackIcicle": {
                const a = p.a ?? BOSS2_ATTACKS.icicle;
                const rise = Math.min(1, p.age / p.rise);
                const sink = p.sinking
                    ? Math.max(0, 1 - p.sinkAge / BLOCK_TRACK_SINK)
                    : 1;
                const h = a.height * rise * sink;
                if (h <= 1) return null;
                return {
                    x: p.x,
                    y: this.groundY - h / 2,
                    w: a.range,
                    h,
                };
            }
            default:
                return null;
        }
    }

    drawProjectileHitboxes() {
        const g = this.hitboxGraphics;
        if (!g) return;
        g.clear();

        for (const p of this.projs) {
            const box = this.projectileHitbox(p);
            if (!box) continue;

            // 白い半透明の塗り + 薄い輪郭で攻撃範囲を見せる
            g.fillStyle(0xffffff, 0.20);
            g.fillRect(
                box.x - box.w / 2,
                box.y - box.h / 2,
                box.w,
                box.h
            );
            g.lineStyle(1, 0xffffff, 0.55);
            g.strokeRect(
                box.x - box.w / 2,
                box.y - box.h / 2,
                box.w,
                box.h
            );
        }
    }

    renderExtra() {
        this.drawProjectileHitboxes();

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

            // つららは根元を地面に固定して伸びる。
            // 氷塊派生の追尾氷柱だけが沈み、通常iceShockは沈まない。
            let grow = 1;
            let alpha = 1;
            let sinkOffset = 0;

            if (p.kind === "icicle") {
                // 通常iceShock: ボスからステージ端へ走る。沈み処理はない。
                grow = Math.min(1, p.age / ICICLE_RISE);
            } else if (p.kind === "blockTrackIcicle") {
                // 氷塊派生: 相手の足元を追尾し、次の柱が出ると沈む。
                const riseScale = Math.min(1, p.age / p.rise);
                const sinkProgress = p.sinking
                    ? Math.min(1, p.sinkAge / BLOCK_TRACK_SINK)
                    : 0;
                const sinkScale = 1 - sinkProgress;
                grow = riseScale * sinkScale;
                alpha = sinkScale;
                sinkOffset = 28 * sinkProgress;
            }

            v.setVisible(grow > 0)
                .setAlpha(alpha)
                .setOrigin(0.5, cfg.originY)
                .setDisplaySize(cfg.w, cfg.h * grow)
                .setPosition(p.x, p.y + sinkOffset);

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
            // 氷塊落とし・派生氷柱・ボス近くからの剣は同じモーション
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