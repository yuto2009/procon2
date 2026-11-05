import Phaser from "phaser";
import BaseBoss, { BS } from "./BaseBoss";
import { S } from "./Fighter";
import { DODGE } from "./frameData";

// ───────── 一回きりの演出のスイッチ ─────────
const ONE_SHOT_EVENTS = false; //trueで必殺技を打つ falseで打たない
const START_IN_PHASE2 = true; //trueで必殺技を全部うって最初から第二形態  
const SKIP_PHASE2_TRANSFORM_ATTACK = true; //true 必殺技を打たずに最初から第二形態

// 炎エフェクトのON/OFF
const FLOOR_FIRE_ON = true;
const IMPACT_FIRE_ON = true;

// ───────── Boss2 の調整用の数値 ─────────
const WALK_SPEED = 0.55;   // 第一形態の歩く速さ(第二形態は歩かない)
const CLOSE_RANGE = 90;    // 第一形態: これより近ければ近距離、遠ければ遠距離
const PHASE2_CLOSE_RANGE = 110;  // 第二形態: 近距離・遠距離の境目(第一形態より広い)
const MELEE_REACH_BONUS = 5;     // 近距離技の range に足すリーチ(境目を広げた分に合わせる)

// 遠距離攻撃の割合(第一形態)
const FAR_BLOCK_CHANCE = 0.5;
const FAR_RAIN_CHANCE = 0.3;
const FAR_SHOCK_CHANCE = 0.2;

const CLOSE_SHOCK_CHANCE = 0.5;
const HEAD_RAIN_SHOCK_CHANCE = 0.5;

// ───────── 最初の攻撃: 氷塊の雨 ─────────
const HAIL_AIR_HEIGHT = 300;      // 氷塊の雨・変身ビームのとき、ボスが浮く高さ
const HAIL_VANISH_FRAMES = 8;     // 消えてから現れるまでのフレーム数
const HAIL_SHOW_FRAMES = 50;
const HAIL_COLUMN_SPACING = 12;
const HAIL_PIECE_SIZE = 28;
const HAIL_GAP_OFFSET = 100;
const HAIL_GAP_WIDTH = 120;
const HAIL_PER_COLUMN = 5;
const HAIL_COLUMN_JITTER = 90;
const HAIL_SECOND_DELAY = 24;
const HAIL_START_Y = -450;

// ───────── バックステップ攻撃 ─────────
const BACKSTEP_SPEED = 6;
const BACKSTEP_STARTUP_FRAMES = 13;
const BACKSTEP_EDGE_MARGIN = 20;
const FIRST_VOLLEY_AT = 8;
const SWORD_HEIGHTS = [30, 85, 140];
const BACKSTEP_CORNER_SPACE = 120;

// ───────── 氷塊 ─────────
const BIG_BLOCK_COUNTS = [4, 5];
const BLOCK_STAGGER = 12;
const BLOCK_FALL_GRAVITY = 0.5;
const BLOCK_FALL_MAX = 14;
const BLOCK_PREDICT_FRAMES = 55;   // プレイヤーの移動を何フレーム先まで予測して落とすか
const SMALL_COUNT = 4;
const SMALL_GRAVITY = 0.4;

// ───────── 通常iceShock ─────────
const ICICLE_MAX = 30;
const ICICLE_SPACING = 70;
const ICICLE_STAGGER = 10;
const ICICLE_LIFE = 25;
const ICICLE_RISE = 10;

// ───────── 氷塊派生の追尾氷柱 ─────────
const BLOCK_TRACK_COUNT = 7;
const BLOCK_TRACK_INTERVAL_START = 40;
const BLOCK_TRACK_INTERVAL_RATIO = 0.8;
const BLOCK_TRACK_INTERVAL_MIN = 18;
const BLOCK_TRACK_RISE_MIN = 10;
const BLOCK_TRACK_RISE = 25;
const BLOCK_TRACK_LOCK = 20;
const BLOCK_TRACK_SINK = 6;

// ───────── ボス近くに浮かべる剣 ─────────
const BOSS_SWORD_COUNT = 5;
const BOSS_SWORD_INTERVAL_START = 50;
const BOSS_SWORD_INTERVAL_RATIO = 0.78;
const BOSS_SWORD_INTERVAL_MIN = 12;
const BOSS_SWORD_HOVER = 12;

const BOSS_SWORD_POSITIONS = [
    [-72, 105],
    [72, 145],
    [-48, 185],
    [48, 125],
    [0, 210],
];

// ───────── 頭上に浮かべる氷の剣 ─────────
const HOVER_OFFSETS = [-100, -60, -20, 20, 60, 100];
const HOVER_HEIGHT = 150;
const LAUNCH_FIRST = 120;
const LAUNCH_SECOND = 240;
const FIRST_GROUP = [2, 3];

const PROJ_POOL = 200;                  // 飛び道具の最大同時数
const SWORD_ART_OFFSET = Math.PI / 2;   // 剣の画像の向きの補正

// ───────── 第二形態 ─────────
const PHASE2_HP_RATIO = 0.75;   // HPがこの割合以下になると第二形態へ

// ───────── ビーム ─────────
const BEAM_INTERVAL_START = 70;
const BEAM_INTERVAL_RATIO = 0.72;
const BEAM_INTERVAL_MIN = 12;
const BEAM_THICK_AT = 18;       // 間隔がこれ以下になったら太いビームで締める

const BEAM_WARN_RATIO = 0.6;
const BEAM_WARN_MIN = 14;
const BEAM_LOCK = 8;
const BEAM_SHOW_WARN = true;
const BEAM_WARN_W = 4;
const BEAM_THIN_W = 80;
const BEAM_THIN_LIFE = 8;
const BEAM_LENGTH = 1500;

const BEAM_BIG_WARN = 40;
const BEAM_BIG_W = 240;
const BEAM_BIG_DOWN = 36;
const BEAM_BIG_SPREAD = 6;
const BEAM_BIG_HOLD = 4;

// ───────── 第二形態: 近距離炎コンボ ─────────
const FOLLOW_PUNCH_CHANCE = 0.5;   // 足攻撃ヒット後、パンチを選ぶ確率(残りはサイドキック)
const FOOT_FIRE_SIDE = 0;
const BODY_W = 145;                // ボス本体の横幅(当たり判定の位置計算にも使う)
const FIRE_IMPACT_HEIGHT = 80;
const MELEE_FACE_LOCK = 6;         // 近距離技の前隙の最後の何フレームで向きを固定するか

// 近距離の技の抽選(アッパー → 足攻撃 → 残りが蹴り)
const UPPER_OPEN_CHANCE = 0.4;     // アッパーを選ぶ確率
const FOOT_OPEN_CHANCE = 0.3;      // 足攻撃を選ぶ確率。残り(0.3)が新しい蹴り

// ───────── 第二形態: 遠距離の行動 ─────────
const FAR_WARP_CHANCE = 0.5;       // 遠距離で瞬間移動からの近距離技を選ぶ確率(残りは突進)
const WARP_DISTANCE = 100;         // 瞬間移動後の、相手とボス中心の横距離(近距離の境目より内側)

// ───────── 第二形態: 待機時間 ─────────
const PHASE2_FAR_WAIT = 10;        // 相手が遠いとき、次の行動に入るまでの待機フレーム
const PHASE2_NEAR_WAIT = 20;       // 相手が近いとき、次の行動に入るまでの待機フレーム

// ───────── 第二形態: ファイアドロップ ─────────
const DROP_JUMP_CHANCE = 0.5;       // 空中ルートを選ぶ確率(相手の高さは関係なく常にこの確率で抽選)
const DROP_JUMP_HEIGHT = 190;       // 空中ルートで瞬間移動する高度(固定)
const DROP_KICK_DASH_SPEED = 16;    // 突進速度(狙った方向に沿った1フレームあたりの移動量)
const DROP_AIR_STARTUP_EXTRA = 12;  // 空中ルートの追加前隙
const DROP_FACE_LOCK = 2;           // 前隙の最後の何フレームで狙いを固定するか
const DROP_STOP_FRAMES = 20;        // 壁・床に当たって止まった後、突進状態のまま動かず硬直するフレーム数

const NONE = {
    range: 0,
    height: 0,
    damage: 0,
    stamina: 0,
    hitstun: 0,
    knockback: 0,
    hitStop: 0,
    shake: 0,
};

export const BOSS2_ATTACKS = {
    // ── ボス本体の行動 ──

    backstepAttack: {
        noBody: true,
        backstep: true,
        startup: 45,
        active: 10,
        recovery: 45,
        ...NONE,
    },

    iceBlock: {
        noBody: true,
        block: true,
        startup: 36,
        active: 20,
        recovery: 50,
        ...NONE,
    },

    iceBlockWave: {
        noBody: true,
        block: true,
        blockWave: true,
        startup: 45,
        active: 20,
        recovery: 60,
        ...NONE,
    },

    iceBlockSwords: {
        noBody: true,
        block: true,
        blockSwords: true,
        startup: 36,
        active: 20,
        recovery: 50,
        ...NONE,
    },

    iceBlockHail: {
        noBody: true,
        block: true,
        hail: true,
        air: true,
        startup: HAIL_VANISH_FRAMES + HAIL_SHOW_FRAMES,
        active: 20,
        recovery: 600,
        ...NONE,
    },

    fireBeam: {
        noBody: true,
        beam: true,
        air: true,
        startup: HAIL_VANISH_FRAMES + HAIL_SHOW_FRAMES,
        active: 20,
        recovery: 900,
        ...NONE,
    },

    iceShock: {
        noBody: true,
        shock: true,
        startup: 24,
        active: 45,
        recovery: 25,
        ...NONE,
    },

    icicleUnder: {
        projectile: true,
        parryable: false,
        range: 150,
        height: 90,
        damage: 45,
        stamina: 0,
        hitstun: 25,
        knockback: 280,
        hitStop: 0,
        shake: 0.01,
    },

    iceSwordRain: {
        noBody: true,
        rain: true,
        startup: 30,
        active: 10,
        recovery: 20,
        ...NONE,
    },

    // ───────── 第二形態: 炎コンボ ─────────

    fireFoot: {
        fireMelee: true,
        fireFoot: true,
        startup: 18,
        active: 8,
        recovery: 30,
        range: BODY_W + 40 + MELEE_REACH_BONUS,
        height: 150,
        pull: BODY_W + 20,
        damage: 35,
        stamina: 0,
        hitstun: 20,
        knockback: 340,
        hitStop: 0,
        shake: 0.008,
    },

    firePunch: {
        fireMelee: true,
        firePunch: true,
        startup: 20,
        active: 8,
        recovery: 34,
        pull: BODY_W / 2,
        range: 150 + MELEE_REACH_BONUS,
        height: 150,
        damage: 60,
        stamina: 0,
        hitstun: 22,
        knockback: 2000,
        hitStop: 0,
        shake: 0.01,
    },

    fireSideKick: {
        fireMelee: true,
        fireSideKick: true,
        startup: 15,
        active: 8,
        recovery: 34,
        range: 150 + MELEE_REACH_BONUS,
        height: 180,
        pull: BODY_W / 2,
        launch: 700,
        damage: 55,
        stamina: 0,
        hitstun: 40,
        knockback: 2000,
        hitStop: 0,
        shake: 0.01,
    },

    fireUpper: {
        fireMelee: true,
        fireUpper: true,
        startup: 17,
        active: 8,
        recovery: 40,
        range: 120 + MELEE_REACH_BONUS,
        height: 120,
        pull: 50,
        launch: 600,
        damage: 30,
        stamina: 0,
        hitstun: 60,
        knockback: 120,
        hitStop: 0,
        shake: 0.01,
    },

    // 新しい蹴り: アッパーより少し高く浮かせる。ヒット・回避どちらでも突進で追撃
    fireKick: {
        fireMelee: true,
        fireKick: true,
        startup: 16,
        active: 8,
        recovery: 36,
        range: 200 + MELEE_REACH_BONUS,   // 範囲を大きくした
        height: 160,
        pull: 90,                         // 判定をボス本体の近くへ寄せる
        launch: 680,        // アッパー(600)より少し高く浮かせる
        damage: 30,
        stamina: 0,
        hitstun: 65,
        knockback: 120,
        hitStop: 0,
        shake: 0.01,
    },

    // 遠距離用: 構えてから相手の前へ瞬間移動し、近距離技へつなぐ
    fireWarp: {
        noBody: true,
        warp: true,
        startup: 30,    // boss2_ready で構えるフレーム数(仮置き)
        active: 1,
        recovery: 0,
        ...NONE,
    },

    // ───────── ファイアドロップ ─────────
    // 地上または空中から、相手の方向に狙いを定めて一直線に突進キック
    // 壁か床に当たると、その場で止まって硬直する

    fireDrop: {
        fireMelee: true,
        fireDrop: true,
        startup: 24,
        active: 30,
        recovery: 30,
        range: BODY_W,
        height: 180,
        pull: BODY_W / 2,
        damage: 55,
        stamina: 0,
        hitstun: 30,
        knockback: 650,
        hitStop: 0,
        shake: 0.012,
    },

    // ───────── 炎エフェクト ─────────

    floorFireHit: {
        projectile: true,
        parryable: true,
        range: 275,
        height: 90,
        damage: 1,
        stamina: 0,
        hitstun: 20,
        knockback: 240,
        hitStop: 0,
        shake: 0.008,
    },

    fireImpactHit: {
        projectile: true,
        parryable: true,
        range: 180,
        height: 120,
        damage: 1,
        stamina: 0,
        hitstun: 20,
        knockback: 260,
        hitStop: 0,
        shake: 0.008,
    },

    // ───────── 飛び道具のダメージ設定 ─────────

    iceSword: {
        projectile: true,
        parryable: false,
        range: 80,
        height: 34,
        speed: 10,
        maxDist: 350,
        damage: 30,
        stamina: 0,
        hitstun: 20,
        knockback: 260,
        hitStop: 0,
        shake: 0.006,
    },

    rainSword: {
        projectile: true,
        parryable: false,
        range: 44,
        height: 44,
        speed: 14,
        maxDist: 1500,
        damage: 35,
        stamina: 0,
        hitstun: 20,
        knockback: 260,
        hitStop: 0,
        shake: 0.008,
    },

    iceBlockBig: {
        projectile: true,
        parryable: false,
        range: 90,
        height: 90,
        damage: 60,
        stamina: 0,
        hitstun: 25,
        knockback: 300,
        hitStop: 0,
        shake: 0.012,
    },

    iceBlockSmall: {
        projectile: true,
        parryable: false,
        range: 34,
        height: 34,
        damage: 25,
        stamina: 0,
        hitstun: 15,
        knockback: 200,
        hitStop: 0,
        shake: 0.005,
    },

    iceHailPiece: {
        projectile: true,
        parryable: false,
        range: 20,
        height: 20,
        damage: 12,
        stamina: 0,
        hitstun: 12,
        knockback: 150,
        hitStop: 0,
        shake: 0.003,
    },

    icicle: {
        projectile: true,
        parryable: false,
        range: 44,
        height: 100,
        damage: 45,
        stamina: 0,
        hitstun: 25,
        knockback: 280,
        hitStop: 0,
        shake: 0.01,
    },

    beamThin: {
        projectile: true,
        parryable: false,
        range: 0,
        height: 0,
        damage: 30,
        stamina: 0,
        hitstun: 20,
        knockback: 260,
        hitStop: 0,
        shake: 0.008,
    },

    beamBig: {
        projectile: true,
        parryable: false,
        range: 0,
        height: 0,
        damage: 55,
        stamina: 0,
        hitstun: 30,
        knockback: 320,
        hitStop: 0,
        shake: 0.014,
    },
};

// ───────── 飛び道具の見た目 ─────────
const VIEW = {
    sword: {
        key: "boss2_icesword",
        w: 48,
        h: 90,
        originY: 0.5,
    },
    big: {
        key: "boss2_iceblock",
        w: 110,
        h: 110,
        originY: 0.5,
    },
    small: {
        key: "boss2_smalliceblock",
        w: 44,
        h: 44,
        originY: 0.5,
    },
    icicle: {
        key: "boss2_icicle",
        w: 50,
        h: 110,
        originY: 1,
    },
    blockTrackIcicle: {
        key: "boss2_icicle",
        w: 50,
        h: 110,
        originY: 1,
    },
    beam: {
        key: "boss2_firebeam",
        w: 1,
        h: 1,
        originY: 0.5,
    },
    fireFx: {
        key: "boss2_floorfire",
        w: 270,
        h: 450,
        originY: 1,
    },
    fireImpact: {
        key: "boss2_fireimpact",
        w: 190,
        h: 140,
        originY: 0.5,
    },
};

function blankProj() {
    return {
        active: false,
        kind: "sword",
        a: null,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        age: 0,
        delay: 0,
        hovering: false,
        bossHover: false,
        launchIn: 0,
        sinking: false,
        sinkAge: 0,
        blockTrackId: 0,
        blockTrackIndex: 0,
        rise: BLOCK_TRACK_RISE,
        lock: BLOCK_TRACK_LOCK,
        target: null,
        offX: 0,
        offY: 0,
        traveled: 0,
        beamMode: "thin",
        beamStage: -1,
        fx: "",
        dir: 1,
        life: 0,
        hitSet: new Set(),
    };
}

export default class Boss2 extends BaseBoss {
    static attacks = BOSS2_ATTACKS;
    static label = "BOSS2";

    static preload(scene) {
        const L = (key, file) =>
            scene.load.image(key, `/assets/boss2/${file}`);

        L("boss2", "boss2.png");
        L("boss2_backstepstartup", "boss2backstepstartup.png");
        L("boss2_backstep", "boss2backstep.png");
        L("boss2_backstepattack", "boss2backstepattack.png");
        L("boss2_iceblock", "boss2iceblock.png");
        L("boss2_iceblockwait", "boss2iceblockwait.png");
        L("boss2_iceblockattack", "boss2iceblockattack.png");
        L("boss2_iceshockwait", "boss2iceshockwait.png");
        L("boss2_iceshockattack", "boss2iceshockattack.png");
        L("boss2_icesword", "boss2icesword.png");
        L("boss2_icicle", "boss2icicle.png");
        L("boss2_firstattack", "boss2firstattack.png");
        L("boss2_smalliceblock", "boss2smalliceblock.png");
        L("boss2_changedfire", "boss2changedfire.png");
        L("boss2_firebeam", "boss2firebeam.png");
        L("boss2_mood2", "boss2mood2.png");

        // 第二形態: 近距離の炎コンボ
        L("boss2_firefootwait", "boss2firefootwait.png");
        L("boss2_firefootattack", "boss2firefootattack.png");
        L("boss2_floorfire", "boss2floorfire.png");
        L("boss2_ready", "boss2ready.png");
        L("boss2_firepunch", "boss2firepunch.png");
        L("boss2_fireimpact", "boss2fireimpact.png");
        L("boss2_sidekickstartup", "boss2sidekickstartup.png");
        L("boss2_sidekickattack", "boss2sidekickattack.png");
        L("boss2_fireupper", "boss2fireupper.png");
        L("boss2_firedropwait", "boss2firedropstartup.png");
        L("boss2_firedropattack", "boss2firedropattack.png");

        // 第二形態: 新しい蹴り
        L("boss2_firekickstartup", "boss2firekickstartup.png");
        L("boss2_firekickattack", "boss2firekickattack.png");
        L("boss2_firekickrecovery", "boss2firekickrecovery.png");

        // スタン・パリィ・壁や床に当たって止まったときの画像
        L("boss2_stun", "boss2stun.png");
    }

    constructor(scene, x, groundY, opts = {}) {
        super(scene, x, groundY, {
            texture: "boss2",
            maxHp: 800,
            bodyW: BODY_W,
            bodyH: 160,
            displayW: 200,
            displayH: 180,
            artFacing: -1,
            stateTint: false,
            idleWait: 40,
            ...opts,
        });

        // 飛び道具プール
        this.projs = Array.from(
            { length: PROJ_POOL },
            blankProj
        );

        this.projViews = this.projs.map(() =>
            scene.add
                .image(0, 0, "boss2_icesword")
                .setDepth(7)
                .setVisible(false)
        );

        this.hitboxGraphics = scene.add.graphics().setDepth(8);
        this.beamGraphics = scene.add.graphics().setDepth(7);

        this.lastPlayerX = new Map();
        this.playerVelocityX = new Map();

        this.blockTrackSequences = [];
        this.nextBlockTrackId = 1;
        this.bossSwordSequence = null;

        this.headRainFired = false;
        this.headRainReact = false;

        this.openingDone = false;
        this.hailAir = false;
        this.hailHidden = false;
        this.hailReturn = 0;

        this.phase2 = false;
        this.beam = null;

        this.comboHit = false;
        this.comboDodged = false;

        // ファイアドロップの状態
        this.dropJump = false;              // 空中ルートかどうか
        this.dropGroundY =                  // 地上ルートのボス中心Y
            this.groundY - this.sprite.height / 2;
        this.dropAngle = 0;                 // 相手に向けた突進の角度(ラジアン)
        this.dropVX = 0;                    // 突進開始時に固定する横速度
        this.dropVY = 0;                    // 突進開始時に固定する縦速度
        this.dropTarget = null;             // 追撃対象
        this.dropStopped = false;           // 壁か床に当たって止まっているか
        this.dropStopLeft = 0;              // 止まった後の残り硬直フレーム

        if (!ONE_SHOT_EVENTS) {
            this.openingDone = true;
        }

        if (START_IN_PHASE2) {
            this.phase2 = true;
            this.openingDone = true;
        }
    }

    // ───────── 行動選択 ─────────

    chooseIceBlockVariant() {
        const choices = [
            BOSS2_ATTACKS.iceBlock,
            BOSS2_ATTACKS.iceBlockWave,
            BOSS2_ATTACKS.iceBlockSwords,
        ];

        return choices[
            Math.floor(Math.random() * choices.length)
        ];
    }

    isBlockAttackBusy() {
        if (
            this.blockTrackSequences.length ||
            this.bossSwordSequence ||
            this.beam
        ) {
            return true;
        }

        return this.projs.some(
            (p) =>
                p.active &&
                (
                    p.kind === "big" ||
                    p.kind === "small" ||
                    p.kind === "blockTrackIcicle" ||
                    p.kind === "beam" ||
                    (p.kind === "sword" && p.bossHover)
                )
        );
    }

    tickIdle(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) return;

        this.faceToward(nearest);

        if (this.isBlockAttackBusy()) {
            this.frame = 0;
            return;
        }

        // 第二形態への移行
        if (
            ONE_SHOT_EVENTS &&
            !this.phase2 &&
            this.hp <= this.maxHp * PHASE2_HP_RATIO
        ) {
            this.phase2 = true;

            for (const p of this.projs) {
                if (
                    p.active &&
                    p.kind === "sword" &&
                    p.hovering &&
                    !p.bossHover
                ) {
                    p.active = false;
                }
            }

            if (!SKIP_PHASE2_TRANSFORM_ATTACK) {
                this.attack = BOSS2_ATTACKS.fireBeam;
                this.enter(BS.TELEGRAPH);
                return;
            }
        }

        if (this.phase2) {
            this.tickIdlePhase2(nearest);
            return;
        }

        const dx = nearest.sprite.x - this.sprite.x;
        const far = Math.abs(dx) > CLOSE_RANGE;

        if (far && this.openingDone) {
            this.moveBody(Math.sign(dx) * WALK_SPEED, 0);
        }

        const hoveringHeadSword = this.projs.some(
            (p) =>
                p.active &&
                p.kind === "sword" &&
                p.hovering &&
                !p.bossHover
        );

        if (hoveringHeadSword) {
            if (!this.headRainFired) return;

            if (
                !this.headRainReact &&
                this.frame <= this.cfg.idleWait
            ) {
                return;
            }

            this.headRainReact = false;

            this.attack =
                Math.random() < HEAD_RAIN_SHOCK_CHANCE
                    ? BOSS2_ATTACKS.iceShock
                    : BOSS2_ATTACKS.iceBlock;

            this.enter(BS.TELEGRAPH);
            return;
        }

        if (this.frame <= this.cfg.idleWait) return;

        if (!this.openingDone) {
            this.openingDone = true;
            this.attack = BOSS2_ATTACKS.iceBlockHail;
            this.enter(BS.TELEGRAPH);
            return;
        }

        if (!far) {
            this.attack =
                Math.random() < CLOSE_SHOCK_CHANCE
                    ? BOSS2_ATTACKS.iceShock
                    : BOSS2_ATTACKS.backstepAttack;
        } else {
            const r = Math.random();

            if (r < FAR_BLOCK_CHANCE) {
                this.attack = this.chooseIceBlockVariant();
            } else if (
                r < FAR_BLOCK_CHANCE + FAR_RAIN_CHANCE
            ) {
                this.attack = BOSS2_ATTACKS.iceSwordRain;
            } else {
                this.attack = BOSS2_ATTACKS.iceShock;
            }
        }

        this.enter(BS.TELEGRAPH);
    }

    // 第二形態の待機: 歩かず、距離に応じた待機時間で次の技を選ぶ
    tickIdlePhase2(nearest) {
        const dx = nearest.sprite.x - this.sprite.x;

        // 近距離か遠距離か(待機時間と技の抽選に使う。第二形態は歩かない)
        const far = Math.abs(dx) > PHASE2_CLOSE_RANGE;

        // 遠いときは短く、近いときはやや長めに待ってから次の行動へ
        const wait = far ? PHASE2_FAR_WAIT : PHASE2_NEAR_WAIT;
        if (this.frame <= wait) return;

        if (far) {
            if (Math.random() < FAR_WARP_CHANCE) {
                // 構えてから相手の前へ瞬間移動
                this.attack = BOSS2_ATTACKS.fireWarp;
                this.enter(BS.TELEGRAPH);
            } else {
                // 突進(地上か空中かは startDropFollowUp 内で抽選)
                this.startDropFollowUp(nearest);
            }
            return;
        }

        // 近距離: アッパー / 足攻撃 / 蹴り
        const r = Math.random();

        if (r < UPPER_OPEN_CHANCE) {
            this.attack = BOSS2_ATTACKS.fireUpper;
        } else if (r < UPPER_OPEN_CHANCE + FOOT_OPEN_CHANCE) {
            this.attack = BOSS2_ATTACKS.fireFoot;
        } else {
            this.attack = BOSS2_ATTACKS.fireKick;
        }

        this.enter(BS.TELEGRAPH);
    }

    // ───────── 攻撃の流れ ─────────

    onTelegraphTick() {
        // ファイアドロップの前隙
        if (this.attack?.fireDrop) {
            // 固定フレームより前だけ、相手を追って狙いを更新
            if (this.frame < this.attack.startup - DROP_FACE_LOCK) {
                this.updateDropAim();
            }

            // 高さは固定: 空中ルートは瞬間移動した高度、地上ルートは地面
            this.sprite.y = this.dropJump
                ? this.dropGroundY - DROP_JUMP_HEIGHT
                : this.dropGroundY;

            this.vy = 0; // 前隙中は重力を無効
            return;
        }

        // 氷塊の雨・変身ビーム
        if (this.attack?.air) {
            if (this.frame < HAIL_VANISH_FRAMES) {
                this.hailHidden = true;
            } else if (this.frame === HAIL_VANISH_FRAMES) {
                const { arenaLeft, arenaRight } = this.cfg;

                this.teleportBoss(
                    (arenaLeft + arenaRight) / 2,
                    HAIL_AIR_HEIGHT
                );

                this.hailAir = true;
                this.hailHidden = false;
            }

            return;
        }

        // 第二形態の近距離攻撃
        if (this.attack?.fireMelee) {
            this.faceForMelee();
            return;
        }

        if (!this.attack?.backstep) return;

        if (this.frame <= BACKSTEP_STARTUP_FRAMES) return;

        const { arenaLeft, arenaRight } = this.cfg;
        const half =
            this.sprite.width / 2 + BACKSTEP_EDGE_MARGIN;

        if (this.frame === BACKSTEP_STARTUP_FRAMES + 1) {
            this.volleyDir = this.facing;

            let dir = -this.facing;

            const spaceBehind =
                dir < 0
                    ? this.sprite.x - (arenaLeft + half)
                    : (arenaRight - half) - this.sprite.x;

            if (spaceBehind <= BACKSTEP_CORNER_SPACE) {
                dir =
                    Math.sign(
                        (arenaLeft + arenaRight) / 2 -
                        this.sprite.x
                    ) || 1;

                this.facing = -dir;
            }

            this.backstepDir = dir;
        }

        this.moveBody(
            this.backstepDir * BACKSTEP_SPEED,
            0
        );

        this.sprite.x = Phaser.Math.Clamp(
            this.sprite.x,
            arenaLeft + half,
            arenaRight - half
        );

        if (
            this.frame ===
            BACKSTEP_STARTUP_FRAMES + FIRST_VOLLEY_AT
        ) {
            this.fireVolley();
        }
    }

    tick(players) {
        this.playersRef = players;
        super.tick(players);
    }

    // ───────── 近距離攻撃の軸合わせ ─────────

    // 前隙の間は相手のほうを向き、最後の MELEE_FACE_LOCK フレームで向きを固定する
    faceForMelee() {
        const a = this.attack;
        if (!a) return;

        // 指定フレームより後は方向を固定
        if (this.frame >= a.startup - MELEE_FACE_LOCK) {
            return;
        }

        const t =
            this.comboTarget && this.comboTarget.hp > 0
                ? this.comboTarget
                : this.nearestAlive(this.playersRef ?? []);

        if (t) {
            this.faceToward(t);
        }
    }

    // ファイアドロップの狙いを更新する
    // ボス中心から相手の中心へ向かう角度を求め、向きも相手に合わせる
    updateDropAim() {
        const t =
            this.dropTarget?.hp > 0
                ? this.dropTarget
                : this.nearestAlive(this.playersRef ?? []);

        if (!t) return;

        this.faceToward(t);

        const dx = t.sprite.x - this.sprite.x;
        let dy = t.sprite.y - this.sprite.y;

        // 地上ルートは下向きに狙わない(相手が空中なら斜め上、地上なら水平)
        if (!this.dropJump) {
            dy = Math.min(dy, 0);
        }

        this.dropAngle = Math.atan2(dy, dx);
    }

    // ───────── 攻撃開始時の処理 ─────────

    onActiveFrame(players) {
        const a = this.attack;

        if (this.frame !== 1) return;

        if (a.warp) {
            // 相手の前へ瞬間移動
            this.warpToTarget(players);

        } else if (a.backstep) {
            this.fireVolley();

        } else if (a.fireDrop) {
            // 前隙で固定した角度から、突進の速度ベクトルを決める
            this.dropVX = Math.cos(this.dropAngle) * DROP_KICK_DASH_SPEED;
            this.dropVY = Math.sin(this.dropAngle) * DROP_KICK_DASH_SPEED;

            // 誤差で出る極小の縦速度は0にする(水平突進が床判定に引っかかるのを防ぐ)
            if (Math.abs(this.dropVY) < 0.001) this.dropVY = 0;

        } else if (
            a.fireFoot ||
            a.firePunch ||
            a.fireSideKick
        ) {
            this.spawnFireFx(a);

        } else if (a.blockWave) {
            this.startBlockTrackingSequence(players);

        } else if (a.blockSwords) {
            this.startBossSwordSequence(players);

        } else if (a.beam) {
            this.startBeamSequence(players);

        } else if (a.hail) {
            this.spawnHail();

        } else if (a.block) {
            this.spawnBlocks(players);

        } else if (a.shock) {
            this.spawnIcicles();

        } else if (a.rain) {
            this.spawnSwordRain(players);
        }
    }

    // 一番近い相手の前へ瞬間移動して、相手のほうを向く
    warpToTarget(players) {
        const t = this.nearestAlive(players);
        if (!t) return;

        const { arenaLeft, arenaRight } = this.cfg;
        const half = this.sprite.width / 2;
        const minX = arenaLeft + half;
        const maxX = arenaRight - half;

        // 今ボスがいる側に出る。壁にはみ出すなら反対側
        let side = Math.sign(this.sprite.x - t.sprite.x) || 1;
        let x = t.sprite.x + side * WARP_DISTANCE;

        if (x < minX || x > maxX) {
            side = -side;
            x = t.sprite.x + side * WARP_DISTANCE;
        }

        // 高さ 0 = 地面に着地して出る
        this.teleportBoss(Phaser.Math.Clamp(x, minX, maxX), 0);
        this.faceToward(t);
    }

    // ───────── コンボの接続 ─────────

    // ファイアドロップへ移行する
    // 追撃のときは直前に当てた相手、通常開始のときは指定した相手を狙う
    startDropFollowUp(target = this.comboTarget) {
        this.dropTarget = target;

        // 空中ルートか地上ルートかを抽選(相手の高さは関係なし)
        this.dropJump = Math.random() < DROP_JUMP_CHANCE;

        // 空中ルートは前隙を延長
        this.attack = {
            ...BOSS2_ATTACKS.fireDrop,
            startup:
                BOSS2_ATTACKS.fireDrop.startup +
                (this.dropJump ? DROP_AIR_STARTUP_EXTRA : 0),
        };

        this.enter(BS.TELEGRAPH);
    }

    onActiveEnd(players) {
        const a = this.attack;

        // 瞬間移動の後は、4つの近距離技を25%ずつで選んで前隙から始める
        if (a?.warp) {
            const picks = [
                BOSS2_ATTACKS.firePunch,
                BOSS2_ATTACKS.fireKick,
                BOSS2_ATTACKS.fireFoot,
                BOSS2_ATTACKS.fireUpper,
            ];

            this.attack =
                picks[Math.floor(Math.random() * picks.length)];
            this.enter(BS.TELEGRAPH);
            return;
        }

        if (a?.fireFoot) {
            if (this.comboHit) {
                this.attack =
                    Math.random() < FOLLOW_PUNCH_CHANCE
                        ? BOSS2_ATTACKS.firePunch
                        : BOSS2_ATTACKS.fireSideKick;

                this.enter(BS.TELEGRAPH);
                return;
            }

            if (this.comboDodged) {
                this.attack = BOSS2_ATTACKS.fireUpper;
                this.enter(BS.TELEGRAPH);
                return;
            }
        }

        if (a?.fireUpper && this.comboHit) {
            this.attack = BOSS2_ATTACKS.fireSideKick;
            this.enter(BS.TELEGRAPH);
            return;
        }

        // 蹴りはヒットでも回避でも突進で追撃(空振りのときだけ後隙)
        if (
            a?.fireKick &&
            (this.comboHit || this.comboDodged) &&
            this.comboTarget?.hp > 0
        ) {
            this.startDropFollowUp();
            return;
        }

        // パンチまたはサイドキックがヒットしたら突進で追撃
        if (
            (a?.firePunch || a?.fireSideKick) &&
            this.comboHit &&
            this.comboTarget?.hp > 0
        ) {
            this.startDropFollowUp();
            return;
        }

        this.enter(BS.RECOVER);
    }

    // ───────── Active処理 ─────────

    tickActive(players) {
        const a = this.attack;

        if (a?.noBody) {
            this.onActiveFrame(players);

            if (this.frame >= a.active) {
                this.onActiveEnd(players);
            }

            return;
        }

        if (a?.fireMelee) {
            this.tickMeleeActive(players);
            return;
        }

        super.tickActive(players);
    }

    // ───────── ファイアドロップの突進 ─────────

    // 突進を1フレーム進める。床か壁に着いて突進を止めるべきなら true を返す
    tickDropKickMotion() {
        const a = this.attack;
        if (!a?.fireDrop) return false;

        const { arenaLeft, arenaRight, ceilingY } = this.cfg;
        const half = this.sprite.width / 2;

        // ボスの中心が動ける左右の限界(壁)
        const minX = arenaLeft + half;
        const maxX = arenaRight - half;

        // 固定した方向へ一直線に進む(途中で方向は変えない)
        const nextX = this.sprite.x + this.dropVX;
        const nextY = this.sprite.y + this.dropVY;

        // アリーナ内・床・天井に収める
        this.sprite.x = Phaser.Math.Clamp(nextX, minX, maxX);
        this.sprite.y = Phaser.Math.Clamp(
            nextY,
            ceilingY,
            this.dropGroundY
        );

        this.vy = 0; // 突進中は重力を無効

        // 空中ルートで下向きに進んで床に着いた(地上ルートは床の上を進むだけなので対象外)
        const hitFloor =
            this.dropJump && this.dropVY > 0 && nextY >= this.dropGroundY;

        // 進行方向の壁に着いた(壁から離れる向きなら対象外)
        const hitWall =
            (this.dropVX < 0 && nextX <= minX) ||
            (this.dropVX > 0 && nextX >= maxX);

        return hitFloor || hitWall;
    }

    // ───────── 近距離攻撃の当たり判定 ─────────

    tickMeleeActive(players) {
        const a = this.attack;

        // 壁・床で止まっている間は動かず、当たり判定も出さない。時間が来たら後隙へ
        if (a?.fireDrop && this.dropStopped) {
            this.vy = 0;
            this.dropStopLeft--;

            if (this.dropStopLeft <= 0) {
                this.enter(BS.RECOVER);
            }

            return;
        }

        this.onActiveFrame(players);

        // 先に移動し、その後に当たり判定を計算
        let stopped = false;

        if (a?.fireDrop) {
            stopped = this.tickDropKickMotion();
        }

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

        const before = new Set(this.hitSet);

        for (const pl of players) {
            if (pl.hp <= 0 || this.hitSet.has(pl)) {
                continue;
            }

            if (
                Phaser.Geom.Intersects.RectangleToRectangle(
                    rect,
                    pl.sprite.getBounds()
                )
            ) {
                this.hitSet.add(pl);
                pl.receiveHit(this, a);

                // パリィされてボスが止まった場合
                if (this.state !== BS.ACTIVE) {
                    return;
                }
            }
        }

        this.noteContacts(this.hitSet, before);

        // 床か壁に着いたら、その場で止まって硬直に入る(active の残りは待たない)
        if (stopped) {
            this.dropStopped = true;
            this.dropStopLeft = DROP_STOP_FRAMES;
            return;
        }

        // 突進がプレイヤーに当たったら、突進を終わらせて通常の後隙へ(スタン画像にはしない)
        if (a?.fireDrop && this.hitSet.size > before.size) {
            this.enter(BS.RECOVER);
            return;
        }

        if (this.frame >= a.active) {
            this.onActiveEnd(players);
        }
    }

    // 当たり判定をボスの中心側へ寄せる
    hitRect(a) {
        const rect = super.hitRect(a);
        rect.x -= this.facing * (a.pull ?? 0);
        return rect;
    }

    // ───────── ヒット・回避の記録 ─────────

    // 今回新しく触れた相手を調べ、ヒットか回避かを記録する(コンボの分岐に使う)
    noteContacts(hitSet, before) {
        for (const pl of hitSet) {
            if (before.has(pl)) continue;

            this.comboTarget = pl;

            if (
                pl.state === S.DODGE &&
                pl.frame <= DODGE.iframes
            ) {
                this.comboDodged = true;
            } else {
                this.comboHit = true;
            }
        }
    }

    // ───────── 飛び道具の共通処理 ─────────

    spawnProj(kind, props) {
        const p = this.projs.find((q) => !q.active);
        if (!p) return null;

        Object.assign(
            p,
            blankProj(),
            props,
            {
                active: true,
                kind,
                hitSet: p.hitSet,
            }
        );

        p.hitSet.clear();
        return p;
    }

    clearProjs() {
        for (const p of this.projs) {
            p.active = false;
        }

        this.blockTrackSequences = [];
        this.bossSwordSequence = null;
        this.beam = null;
    }

    hitPlayers(p, players, w, h, cy = p.y) {
        const rect = new Phaser.Geom.Rectangle(
            p.x - w / 2,
            cy - h / 2,
            w,
            h
        );

        for (const pl of players) {
            if (pl.hp <= 0 || p.hitSet.has(pl)) {
                continue;
            }

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

    // ───────── 毎フレームの追加処理 ─────────

    tickExtra(players) {
        // プレイヤーの移動量を記録(氷塊の落下位置の予測に使う)
        for (const pl of players) {
            const previousX = this.lastPlayerX.get(pl);

            if (previousX !== undefined) {
                this.playerVelocityX.set(
                    pl,
                    pl.sprite.x - previousX
                );
            }

            this.lastPlayerX.set(pl, pl.sprite.x);
        }

        this.tickBlockTrackingSequences();
        this.tickBossSwordSequence();
        this.tickHailReturn();
        this.tickBeamSequence(players);

        for (const p of this.projs) {
            if (!p.active) continue;

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

                case "beam":
                    this.tickBeam(p, players);
                    break;

                case "fireFx":
                    this.tickFireFx(p, players);
                    break;
            }
        }
    }

    // ───────── 重力制御 ─────────

    isFloating() {
        // 氷塊の雨・変身ビーム
        if (this.hailAir && this.attack?.air) {
            return true;
        }

        // ファイアドロップは前隙と突進中(止まっている硬直中も含む)だけ重力無効
        // 後隙 BS.RECOVER では重力を有効にする
        return (
            !!this.attack?.fireDrop &&
            (
                this.state === BS.TELEGRAPH ||
                this.state === BS.ACTIVE
            )
        );
    }

    // ───────── 状態遷移 ─────────

    onEnter(state) {
        if (state === BS.IDLE || state === BS.STUN) {
            this.hailAir = false;
            this.hailHidden = false;
            this.hailReturn = 0;
            this.comboTarget = null;

            // スタンで中断された場合は地上へ戻す
            if (state === BS.STUN && this.dropJump) {
                this.sprite.y = this.dropGroundY;
                this.vy = 0;
            }

            // ファイアドロップの状態をリセット
            this.dropJump = false;
            this.dropAngle = 0;
            this.dropVX = 0;
            this.dropVY = 0;
            this.dropTarget = null;
            this.dropStopped = false;
            this.dropStopLeft = 0;
        }

        if (state === BS.STUN) {
            this.beam = null;
        }

        if (state === BS.TELEGRAPH) {
            this.comboHit = false;
            this.comboDodged = false;

            if (this.attack?.fireDrop) {
                this.dropGroundY =
                    this.groundY - this.sprite.height / 2;

                this.dropVX = 0;
                this.dropVY = 0;
                this.dropStopped = false;
                this.dropStopLeft = 0;

                if (this.dropJump) {
                    // 空中ルート: 固定の高度へ瞬間移動
                    this.teleportBoss(
                        this.sprite.x,
                        DROP_JUMP_HEIGHT
                    );
                } else {
                    // 地上ルート
                    this.sprite.y = this.dropGroundY;
                    this.vy = 0;
                }

                // 開始時点で相手の方向に角度を合わせておく
                // (前の角度が一瞬見えるのを防ぐ。移動後の位置から計算する)
                this.updateDropAim();
            }
        }
    }

    onDeadTick() {
        this.clearProjs();
    }

    onDead() {
        this.clearProjs();
        this.hailAir = false;
        this.hailHidden = false;
        this.dropJump = false;
        this.dropAngle = 0;
        this.dropVX = 0;
        this.dropVY = 0;
        this.dropTarget = null;
        this.dropStopped = false;
        this.dropStopLeft = 0;
    }

    // ───────── 第二形態: 炎エフェクト ─────────

    spawnFireFx(a) {
        const half = this.sprite.width / 2;
        const dir = this.facing;

        if (a.fireFoot) {
            if (!FLOOR_FIRE_ON) return;

            const fa = BOSS2_ATTACKS.floorFireHit;

            this.spawnProj("fireFx", {
                a: fa,
                fx: "floor",
                dir,
                life: a.active,
                x:
                    this.sprite.x +
                    dir * FOOT_FIRE_SIDE *
                    (half + fa.range / 2),
                y: this.groundY,
            });

            return;
        }

        if (!IMPACT_FIRE_ON) return;

        const ia = BOSS2_ATTACKS.fireImpactHit;

        this.spawnProj("fireFx", {
            a: ia,
            fx: "impact",
            dir,
            life: a.active,
            x:
                this.sprite.x +
                dir * (
                    half +
                    ia.range / 2 -
                    (a.pull ?? 0) -
                    60
                ),
            y: this.groundY - FIRE_IMPACT_HEIGHT,
        });
    }

    tickFireFx(p, players) {
        const a = p.a;
        const before = new Set(p.hitSet);

        const cy =
            p.fx === "floor"
                ? this.groundY - a.height / 2
                : p.y;

        this.hitPlayers(
            p,
            players,
            a.range,
            a.height,
            cy
        );

        this.noteContacts(p.hitSet, before);

        if (p.age >= p.life) {
            p.active = false;
        }
    }

    // ───────── 氷の剣(バックステップ) ─────────

    fireVolley() {
        const a = BOSS2_ATTACKS.iceSword;
        const half = this.sprite.width / 2;

        for (const h of SWORD_HEIGHTS) {
            const p = this.spawnProj("sword", {
                a,
                x:
                    this.sprite.x +
                    this.facing * (half + a.range / 2),
                y: this.groundY - h,
                vx: this.facing * a.speed,
                vy: 0,
                rot: this.facing > 0 ? 0 : Math.PI,
            });

            if (!p) return;
        }
    }

    // ───────── 氷の剣6本 ─────────

    spawnSwordRain(players) {
        const target = this.pickTarget(players);
        if (!target) return;

        this.headRainFired = false;
        this.headRainReact = false;

        const a = BOSS2_ATTACKS.rainSword;

        HOVER_OFFSETS.forEach((offX, i) => {
            this.spawnProj("sword", {
                a,
                target,
                hovering: true,
                launchIn:
                    FIRST_GROUP.includes(i)
                        ? LAUNCH_FIRST
                        : LAUNCH_SECOND,
                offX,
                offY: Math.abs(offX) * 0.25,
                x: target.sprite.x + offX,
                y: target.sprite.y - HOVER_HEIGHT,
            });
        });
    }

    // ───────── ボス近くの剣 ─────────

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

        if (!state || state.spawned >= BOSS_SWORD_COUNT) {
            return;
        }

        const [baseX, offY] =
            BOSS_SWORD_POSITIONS[state.spawned];

        const a = BOSS2_ATTACKS.rainSword;

        state.targets.forEach((target, k) => {
            if (target.hp <= 0) return;

            const offX =
                k % 2 === 0 ? baseX : -baseX;

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

        state.wait =
            this.bossSwordInterval(state.spawned - 1);

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

        if (state.wait <= 0) {
            this.spawnBossSword();
        }
    }

    tickSword(p, players) {
        const a = p.a;

        if (p.hovering) {
            const t = p.target;

            if (!t || t.hp <= 0) {
                p.active = false;
                return;
            }

            if (p.bossHover) {
                p.x = this.sprite.x + p.offX;
                p.y = this.groundY - p.offY;

                const aimY =
                    t.sprite.y - t.sprite.height * 0.15;

                p.rot = Math.atan2(
                    aimY - p.y,
                    t.sprite.x - p.x
                );
            } else {
                p.x = t.sprite.x + p.offX;
                p.y =
                    t.sprite.y -
                    HOVER_HEIGHT +
                    p.offY;

                p.rot = Math.atan2(
                    t.sprite.y - p.y,
                    t.sprite.x - p.x
                );
            }

            p.launchIn--;

            if (p.launchIn <= 0) {
                p.hovering = false;

                if (
                    !p.bossHover &&
                    !this.headRainFired
                ) {
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

        const size =
            p.a === BOSS2_ATTACKS.iceSword
                ? null
                : a.range;

        if (size === null) {
            this.hitPlayers(
                p,
                players,
                a.range,
                a.height
            );
        } else {
            this.hitPlayers(
                p,
                players,
                size,
                size
            );
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

    // ───────── 最初の攻撃: 氷塊の雨 ─────────

    // ボスを指定位置へ瞬間移動する(heightAboveGround は地面からの高さ)
    teleportBoss(x, heightAboveGround) {
        this.sprite.x = x;

        this.sprite.y =
            this.groundY -
            this.sprite.height / 2 -
            heightAboveGround;

        this.vy = 0;
    }

    spawnHail() {
        const { arenaLeft, arenaRight } = this.cfg;
        const center = (arenaLeft + arenaRight) / 2;
        const a = BOSS2_ATTACKS.iceHailPiece;

        this.hailReturn = 0;

        for (
            let x = arenaLeft + HAIL_COLUMN_SPACING / 2;
            x < arenaRight;
            x += HAIL_COLUMN_SPACING
        ) {
            const inGap = [-1, 1].some(
                (s) =>
                    Math.abs(
                        x - (center + s * HAIL_GAP_OFFSET)
                    ) <
                    HAIL_GAP_WIDTH / 2
            );

            if (inGap) continue;

            const jitter =
                Phaser.Math.Between(0, HAIL_COLUMN_JITTER);

            for (let j = 0; j < HAIL_PER_COLUMN; j++) {
                this.spawnProj("small", {
                    a,
                    x,
                    y: HAIL_START_Y,
                    vx: 0,
                    vy: 0,
                    delay:
                        jitter +
                        j * HAIL_SECOND_DELAY,
                });
            }
        }
    }

    tickHailReturn() {
        const a = this.attack;

        if (
            !a?.air ||
            this.state !== BS.RECOVER ||
            !this.hailAir
        ) {
            return;
        }

        if (this.isBlockAttackBusy()) return;

        this.hailHidden = true;
        this.hailReturn++;

        if (this.hailReturn >= HAIL_VANISH_FRAMES) {
            const { arenaLeft, arenaRight } = this.cfg;

            this.teleportBoss(
                (arenaLeft + arenaRight) / 2,
                0
            );

            this.attack = null;
            this.enter(BS.IDLE);
        }
    }

    // ───────── 氷塊 ─────────

    spawnBlocks(players) {
        const alive = players.filter((p) => p.hp > 0);
        if (!alive.length) return;

        const count =
            BIG_BLOCK_COUNTS[
                Math.floor(
                    Math.random() * BIG_BLOCK_COUNTS.length
                )
            ];

        const a = BOSS2_ATTACKS.iceBlockBig;
        const { arenaLeft, arenaRight } = this.cfg;

        for (let i = 0; i < count; i++) {
            const t = alive[i % alive.length];

            const vx = this.playerVelocityX.get(t) ?? 0;

            const predictFrames =
                BLOCK_PREDICT_FRAMES +
                i * BLOCK_STAGGER;

            const predictedX =
                t.sprite.x +
                vx * predictFrames;

            const x = Phaser.Math.Clamp(
                predictedX +
                    Phaser.Math.Between(-12, 12),
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

        p.vy = Math.min(
            BLOCK_FALL_MAX,
            p.vy + BLOCK_FALL_GRAVITY
        );

        p.y += p.vy;

        this.hitPlayers(
            p,
            players,
            a.range,
            a.height
        );

        if (p.y + a.height / 2 >= this.groundY) {
            this.spawnSmalls(p.x);
            p.active = false;
        }
    }

    spawnSmalls(x) {
        const a = BOSS2_ATTACKS.iceBlockSmall;

        for (let k = 0; k < SMALL_COUNT; k++) {
            const dir = k % 2 === 0 ? -1 : 1;
            const speed =
                3 + Math.floor(k / 2) * 3;

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

        this.hitPlayers(
            p,
            players,
            a.range,
            a.height
        );

        if (
            (p.vy > 0 &&
                p.y + a.height / 2 >= this.groundY) ||
            p.x < arenaLeft - 50 ||
            p.x > arenaRight + 50
        ) {
            p.active = false;
        }
    }

    // ───────── 通常iceShock ─────────

    spawnIcicles() {
        const a = BOSS2_ATTACKS.icicle;
        const half = this.sprite.width / 2;
        const { arenaLeft, arenaRight } = this.cfg;

        const startOffset =
            half + a.range / 2 - 12;

        this.spawnProj("icicle", {
            a: BOSS2_ATTACKS.icicleUnder,
            x: this.sprite.x,
            y: this.groundY,
        });

        for (const dir of [-1, 1]) {
            for (let i = 0; i < ICICLE_MAX; i++) {
                const x =
                    this.sprite.x +
                    dir * (startOffset + i * ICICLE_SPACING);

                if (x < arenaLeft || x > arenaRight) {
                    break;
                }

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

        if (p.age >= ICICLE_RISE) {
            this.hitPlayers(
                p,
                players,
                a.range,
                a.height,
                p.y - a.height / 2
            );
        }

        if (p.age >= ICICLE_LIFE) {
            p.active = false;
        }
    }

    // ───────── 氷塊派生の追尾氷柱 ─────────

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

        this.blockTrackSequences = alive.map(
            (target) => ({
                id: this.nextBlockTrackId++,
                target,
                spawned: 0,
                wait: 0,
            })
        );

        for (const seq of this.blockTrackSequences) {
            this.spawnNextBlockTrackingIcicle(seq);
        }
    }

    spawnNextBlockTrackingIcicle(state) {
        if (state.spawned >= BLOCK_TRACK_COUNT) return;

        if (!state.target || state.target.hp <= 0) {
            return;
        }

        for (const p of this.projs) {
            if (
                !p.active ||
                p.kind !== "blockTrackIcicle" ||
                p.blockTrackId !== state.id
            ) {
                continue;
            }

            if (
                p.blockTrackIndex === state.spawned - 2
            ) {
                p.active = false;
            } else if (
                p.blockTrackIndex === state.spawned - 1
            ) {
                p.sinking = true;
                p.sinkAge = 0;
            }
        }

        const { arenaLeft, arenaRight } = this.cfg;

        const x = Phaser.Math.Clamp(
            state.target.sprite.x,
            arenaLeft + 25,
            arenaRight - 25
        );

        const interval =
            this.blockTrackInterval(state.spawned);

        const speed =
            interval / BLOCK_TRACK_INTERVAL_START;

        const rise = Math.max(
            BLOCK_TRACK_RISE_MIN,
            Math.round(BLOCK_TRACK_RISE * speed)
        );

        const lock = Math.max(
            4,
            Math.round(
                BLOCK_TRACK_LOCK *
                (rise / BLOCK_TRACK_RISE)
            )
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
            if (!state.target || state.target.hp <= 0) {
                this.sinkBlockTrackSequence(state);
                continue;
            }

            state.wait--;

            if (state.wait <= 0) {
                if (state.spawned < BLOCK_TRACK_COUNT) {
                    this.spawnNextBlockTrackingIcicle(state);
                } else {
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

        if (
            !p.sinking &&
            p.age <= p.rise - p.lock &&
            p.target &&
            p.target.hp > 0
        ) {
            const { arenaLeft, arenaRight } = this.cfg;

            p.x = Phaser.Math.Clamp(
                p.target.sprite.x,
                arenaLeft + 25,
                arenaRight - 25
            );
        }

        if (p.sinking) {
            p.sinkAge++;
        }

        const riseScale =
            Math.min(1, p.age / p.rise);

        const sinkScale = p.sinking
            ? Math.max(
                0,
                1 - p.sinkAge / BLOCK_TRACK_SINK
            )
            : 1;

        const currentHeight =
            a.height * riseScale * sinkScale;

        if (
            p.age >= p.rise &&
            currentHeight > 1
        ) {
            this.hitPlayers(
                p,
                players,
                a.range,
                currentHeight,
                this.groundY - currentHeight / 2
            );
        }

        if (
            p.sinking &&
            p.sinkAge >= BLOCK_TRACK_SINK
        ) {
            p.active = false;
        }
    }

    // ───────── 第二形態: ファイアビーム ─────────

    beamInterval(index) {
        return Math.max(
            BEAM_INTERVAL_MIN,
            Math.round(
                BEAM_INTERVAL_START *
                BEAM_INTERVAL_RATIO ** index
            )
        );
    }

    startBeamSequence(players) {
        const targets = players.filter((p) => p.hp > 0);
        if (!targets.length) return;

        this.beam = {
            targets,
            index: 0,
            wait: 0,
        };

        this.fireBeamStep();
    }

    fireBeamStep() {
        const st = this.beam;
        if (!st) return;

        const interval =
            this.beamInterval(st.index);

        if (interval <= BEAM_THICK_AT) {
            this.spawnProj("beam", {
                a: BOSS2_ATTACKS.beamBig,
                beamMode: "big",
                x: this.sprite.x,
                y: this.sprite.y + 25,
                rot: Math.PI / 2,
            });

            this.beam = null;
            return;
        }

        const warn = Math.max(
            BEAM_WARN_MIN,
            Math.round(interval * BEAM_WARN_RATIO)
        );

        for (const t of st.targets) {
            if (t.hp <= 0) continue;

            this.spawnProj("beam", {
                a: BOSS2_ATTACKS.beamThin,
                beamMode: "thin",
                target: t,
                rise: warn,
                x: this.sprite.x,
                y: this.sprite.y + 25,
                rot: Math.atan2(
                    t.sprite.y - this.sprite.y,
                    t.sprite.x - this.sprite.x
                ),
            });
        }

        st.index++;
        st.wait = interval;
    }

    tickBeamSequence() {
        const st = this.beam;
        if (!st) return;

        if (!st.targets.some((t) => t.hp > 0)) {
            this.beam = null;
            return;
        }

        st.wait--;

        if (st.wait <= 0) {
            this.fireBeamStep();
        }
    }

    beamInfo(p) {
        const a = p.age;

        if (p.beamMode === "big") {
            const { arenaLeft, arenaRight } = this.cfg;

            const full =
                arenaRight - arenaLeft + 400;

            const bottom = this.groundY + 20;
            const topAll = -100;

            const downAt = BEAM_BIG_WARN;
            const spreadAt =
                downAt + BEAM_BIG_DOWN;

            if (a < downAt) {
                return {
                    hit: false,
                    stage: 0,
                    alpha: 0.35,
                    top: p.y,
                    len: bottom - p.y,
                    w:
                        8 +
                        (BEAM_BIG_W - 8) *
                        (a / downAt),
                };
            }

            if (a < spreadAt) {
                return {
                    hit: true,
                    stage: 1,
                    alpha: 1,
                    top: p.y,
                    len: bottom - p.y,
                    w: BEAM_BIG_W,
                };
            }

            const t = Math.min(
                1,
                (a - spreadAt) / BEAM_BIG_SPREAD
            );

            const top =
                p.y + (topAll - p.y) * t;

            return {
                hit: true,
                stage: 2,
                alpha: 1,
                top,
                len: bottom - top,
                w:
                    BEAM_BIG_W +
                    (full - BEAM_BIG_W) * t,
            };
        }

        if (a < p.rise) {
            return {
                hit: false,
                stage: 0,
                alpha: 0.4,
                top: p.y,
                len: BEAM_LENGTH,
                w: BEAM_WARN_W,
            };
        }

        return {
            hit: true,
            stage: 1,
            alpha: 1,
            top: p.y,
            len: BEAM_LENGTH,
            w: BEAM_THIN_W,
        };
    }

    tickBeam(p, players) {
        const big = p.beamMode === "big";

        if (!big) {
            p.x = this.sprite.x;
            p.y = this.sprite.y + 20;

            if (
                p.age <= p.rise - BEAM_LOCK &&
                p.target &&
                p.target.hp > 0
            ) {
                p.rot = Math.atan2(
                    p.target.sprite.y - p.y,
                    p.target.sprite.x - p.x
                );
            }
        }

        const info = this.beamInfo(p);

        if (info.stage !== p.beamStage) {
            p.beamStage = info.stage;
            p.hitSet.clear();
        }

        if (info.hit) {
            if (big) {
                this.hitPlayers(
                    p,
                    players,
                    info.w,
                    info.len,
                    info.top + info.len / 2
                );
            } else {
                this.hitBeamLine(
                    p,
                    players,
                    info.w,
                    info.len
                );
            }
        }

        const end = big
            ? (
                BEAM_BIG_WARN +
                BEAM_BIG_DOWN +
                BEAM_BIG_SPREAD +
                BEAM_BIG_HOLD
            )
            : p.rise + BEAM_THIN_LIFE;

        if (p.age >= end) {
            p.active = false;
        }
    }

    hitBeamLine(p, players, width, len) {
        const line = new Phaser.Geom.Line(
            p.x,
            p.y,
            p.x + Math.cos(p.rot) * len,
            p.y + Math.sin(p.rot) * len
        );

        for (const pl of players) {
            if (pl.hp <= 0 || p.hitSet.has(pl)) {
                continue;
            }

            const rect = pl.sprite.getBounds();

            Phaser.Geom.Rectangle.Inflate(
                rect,
                width / 2,
                width / 2
            );

            if (
                Phaser.Geom.Intersects.LineToRectangle(
                    line,
                    rect
                )
            ) {
                p.hitSet.add(pl);
                pl.receiveHit(this, p.a);
            }
        }
    }

    renderBeam(p, v) {
        const info = this.beamInfo(p);

        if (!info.hit && !BEAM_SHOW_WARN) {
            v.setVisible(false);
            return;
        }

        if (p.beamMode === "big") {
            v.setVisible(false);

            const g = this.beamGraphics;
            const x0 = p.x - info.w / 2;

            g.fillStyle(
                0xff8a2b,
                0.9 * info.alpha
            );

            g.fillRect(
                x0,
                info.top,
                info.w,
                info.len
            );

            const coreW = info.w * 0.6;

            g.fillStyle(
                0xfff2c2,
                0.95 * info.alpha
            );

            g.fillRect(
                p.x - coreW / 2,
                info.top,
                coreW,
                info.len
            );

            return;
        }

        const rot = p.rot - Math.PI / 2;

        v.setVisible(true)
            .setAlpha(info.alpha)
            .setOrigin(0.5, 0)
            .setDisplaySize(info.w, info.len)
            .setPosition(p.x, info.top)
            .setRotation(rot)
            .setFlipY(false);
    }

    // ───────── 同期 ─────────

    // コピーした攻撃(延長前隙のファイアドロップ)でも名前を返し、ゲストに伝わるようにする
    attackName() {
        if (this.attack?.fireDrop) return "fireDrop";
        return super.attackName();
    }

    getExtraSyncData() {
        const projs = [];

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];

            if (!p.active || p.delay > 0) continue;

            const attackKey =
                p.a === BOSS2_ATTACKS.iceSword
                    ? "iceSword"
                : p.a === BOSS2_ATTACKS.rainSword
                    ? "rainSword"
                : p.a === BOSS2_ATTACKS.iceBlockBig
                    ? "iceBlockBig"
                : p.a === BOSS2_ATTACKS.iceBlockSmall
                    ? "iceBlockSmall"
                : p.a === BOSS2_ATTACKS.iceHailPiece
                    ? "iceHailPiece"
                : p.a === BOSS2_ATTACKS.icicleUnder
                    ? "icicleUnder"
                : p.a === BOSS2_ATTACKS.icicle
                    ? "icicle"
                : p.a === BOSS2_ATTACKS.beamThin
                    ? "beamThin"
                : p.a === BOSS2_ATTACKS.beamBig
                    ? "beamBig"
                : p.a === BOSS2_ATTACKS.floorFireHit
                    ? "floorFireHit"
                : p.a === BOSS2_ATTACKS.fireImpactHit
                    ? "fireImpactHit"
                : null;

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
                bm: p.beamMode === "big" ? 1 : 0,
                fx:
                    p.fx === "floor"
                        ? 1
                        : p.fx === "impact"
                            ? 2
                            : 0,
                fd: p.dir,
            });
        }

        return {
            projs,
            hh: this.hailHidden ? 1 : 0,
            p2: this.phase2 ? 1 : 0,
            // ファイアドロップの回転と、止まった画像のために同期する
            da: Math.round(this.dropAngle * 1000) / 1000,
            ds: this.dropStopped ? 1 : 0,
        };
    }

    applyExtraSync(d) {
        this.hailHidden = !!d?.hh;
        this.phase2 = !!d?.p2;
        this.dropAngle = Number(d?.da) || 0;
        this.dropStopped = !!d?.ds;

        const list =
            Array.isArray(d?.projs)
                ? d.projs
                : [];

        const received = new Map();

        const attackByKey = {
            iceHailPiece: BOSS2_ATTACKS.iceHailPiece,
            icicleUnder: BOSS2_ATTACKS.icicleUnder,
            iceSword: BOSS2_ATTACKS.iceSword,
            rainSword: BOSS2_ATTACKS.rainSword,
            iceBlockBig: BOSS2_ATTACKS.iceBlockBig,
            iceBlockSmall: BOSS2_ATTACKS.iceBlockSmall,
            icicle: BOSS2_ATTACKS.icicle,
            beamThin: BOSS2_ATTACKS.beamThin,
            beamBig: BOSS2_ATTACKS.beamBig,
            floorFireHit: BOSS2_ATTACKS.floorFireHit,
            fireImpactHit: BOSS2_ATTACKS.fireImpactHit,
        };

        for (const src of list) {
            if (
                !Number.isInteger(src?.i) ||
                src.i < 0 ||
                src.i >= this.projs.length ||
                !Object.prototype.hasOwnProperty.call(
                    VIEW,
                    src.k
                )
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

            p.a =
                attackByKey[src.ak] ??
                (
                    src.k === "big"
                        ? BOSS2_ATTACKS.iceBlockBig
                    : src.k === "small"
                        ? BOSS2_ATTACKS.iceBlockSmall
                    : src.k === "icicle" ||
                      src.k === "blockTrackIcicle"
                        ? BOSS2_ATTACKS.icicle
                    : src.k === "sword"
                        ? BOSS2_ATTACKS.rainSword
                    : null
                );

            p.x = Number(src.x) || 0;
            p.y = Number(src.y) || 0;
            p.rot = Number(src.r) || 0;
            p.age = Number(src.g) || 0;
            p.delay = Math.max(
                0,
                Number(src.d) || 0
            );

            p.sinking = !!src.s;
            p.sinkAge = Number(src.sa) || 0;

            p.blockTrackId = Number(src.bi) || 0;
            p.blockTrackIndex = Number(src.bn) || 0;
            p.rise = Number(src.rs) || BLOCK_TRACK_RISE;

            p.hovering = !!src.h;
            p.bossHover = !!src.b;

            p.beamMode =
                src.bm ? "big" : "thin";

            p.fx =
                src.fx === 1
                    ? "floor"
                    : src.fx === 2
                        ? "impact"
                        : "";

            p.dir = Number(src.fd) || 1;
        }
    }

    // ───────── 描画 ─────────

    projectileHitbox(p) {
        if (!p.active || p.delay > 0) {
            return null;
        }

        switch (p.kind) {
            case "sword": {
                if (p.hovering) return null;

                const a =
                    p.a ?? BOSS2_ATTACKS.rainSword;

                const isSmallSword =
                    a === BOSS2_ATTACKS.iceSword;

                const w = a.range;
                const h =
                    isSmallSword
                        ? a.height
                        : a.range;

                return {
                    x: p.x,
                    y: p.y,
                    w,
                    h,
                };
            }

            case "big":
            case "small": {
                const a =
                    p.a ??
                    (
                        p.kind === "big"
                            ? BOSS2_ATTACKS.iceBlockBig
                            : BOSS2_ATTACKS.iceBlockSmall
                    );

                return {
                    x: p.x,
                    y: p.y,
                    w: a.range,
                    h: a.height,
                };
            }

            case "icicle": {
                const a =
                    p.a ?? BOSS2_ATTACKS.icicle;

                const h =
                    a.height *
                    Math.min(1, p.age / ICICLE_RISE);

                if (h <= 1) return null;

                return {
                    x: p.x,
                    y: this.groundY - h / 2,
                    w: a.range,
                    h,
                };
            }

            case "blockTrackIcicle": {
                const a =
                    p.a ?? BOSS2_ATTACKS.icicle;

                const rise =
                    Math.min(1, p.age / p.rise);

                const sink = p.sinking
                    ? Math.max(
                        0,
                        1 - p.sinkAge / BLOCK_TRACK_SINK
                    )
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

            case "beam": {
                if (p.beamMode !== "big") {
                    return null;
                }

                const info = this.beamInfo(p);
                if (!info.hit) return null;

                return {
                    x: p.x,
                    y: info.top + info.len / 2,
                    w: info.w,
                    h: info.len,
                };
            }

            case "fireFx": {
                const a =
                    p.a ??
                    (
                        p.fx === "floor"
                            ? BOSS2_ATTACKS.floorFireHit
                            : BOSS2_ATTACKS.fireImpactHit
                    );

                const cy =
                    p.fx === "floor"
                        ? this.groundY - a.height / 2
                        : p.y;

                return {
                    x: p.x,
                    y: cy,
                    w: a.range,
                    h: a.height,
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

    // 炎エフェクトの描画
    renderFireFx(p, v, cfg) {
        const floor = p.fx === "floor";

        v.setVisible(true)
            .setAlpha(1)
            .setOrigin(0.5, cfg.originY)
            .setDisplaySize(cfg.w, cfg.h)
            .setPosition(p.x, p.y)
            .setRotation(0)
            .setFlipX(!floor && p.dir > 0)
            .setFlipY(false);
    }

    // ファイアドロップの前隙・突進中は、狙った方向に画像を回転する
    // (壁・床で止まった後は回転を戻す)
    poseRotation() {
        if (
            this.attack?.fireDrop &&
            !this.dropStopped &&
            (this.state === BS.TELEGRAPH || this.state === BS.ACTIVE)
        ) {
            // 元絵は左向き。右向きは反転されるので角度そのまま、
            // 左向きは元絵が180度ずれているのでその分を引く
            return this.facing > 0
                ? this.dropAngle
                : this.dropAngle - Math.PI;
        }

        return null;
    }

    // 回転中の画像が地面にめり込まないように、見た目の高さだけ補正する
    // (当たり判定や本体の位置は動かさない)
    render() {
        super.render();

        const rot = this.poseRotation();
        if (rot === null) return; // 回転していないときは補正なし

        // 回転後の画像が収まる範囲の半分の高さ(縦横の寸法と角度から計算)
        const w = this.view.displayWidth;
        const h = this.view.displayHeight;
        const halfH =
            (Math.abs(w * Math.sin(rot)) + Math.abs(h * Math.cos(rot))) / 2;

        // 画像の下端が地面を超えないように、中心のY座標を上限で押さえる
        const maxY = this.groundY - halfH;
        if (this.view.y > maxY) {
            this.view.y = maxY;
        }
    }

    renderExtra() {
        this.drawProjectileHitboxes();
        this.beamGraphics.clear();

        this.view.setAlpha(
            this.hailHidden ? 0 : 1
        );

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            const v = this.projViews[i];

            if (!p.active || p.delay > 0) {
                v.setVisible(false);
                continue;
            }

            const cfg =
                p.kind === "fireFx"
                    ? (
                        p.fx === "floor"
                            ? VIEW.fireFx
                            : VIEW.fireImpact
                    )
                    : VIEW[p.kind];

            v.setDepth(
                p.kind === "fireFx" && p.fx === "floor"
                    ? 4
                    : 7
            );

            if (v.texture.key !== cfg.key) {
                v.setTexture(cfg.key);
            }

            if (p.kind === "beam") {
                this.renderBeam(p, v);
                continue;
            }

            if (p.kind === "fireFx") {
                this.renderFireFx(p, v, cfg);
                continue;
            }

            let grow = 1;
            let alpha = 1;
            let sinkOffset = 0;

            if (p.kind === "icicle") {
                grow = Math.min(
                    1,
                    p.age / ICICLE_RISE
                );
            } else if (p.kind === "blockTrackIcicle") {
                const riseScale =
                    Math.min(1, p.age / p.rise);

                const sinkProgress = p.sinking
                    ? Math.min(
                        1,
                        p.sinkAge / BLOCK_TRACK_SINK
                    )
                    : 0;

                const sinkScale = 1 - sinkProgress;

                grow = riseScale * sinkScale;
                alpha = sinkScale;
                sinkOffset = 28 * sinkProgress;
            }

            const isHail =
                p.a === BOSS2_ATTACKS.iceHailPiece;

            const dispW =
                isHail ? HAIL_PIECE_SIZE : cfg.w;

            const dispH =
                isHail ? HAIL_PIECE_SIZE : cfg.h;

            v.setVisible(grow > 0)
                .setAlpha(alpha)
                .setOrigin(0.5, cfg.originY)
                .setDisplaySize(
                    dispW,
                    dispH * grow
                )
                .setPosition(
                    p.x,
                    p.y + sinkOffset
                )
                .setFlipX(false);

            if (p.kind === "sword") {
                v.setRotation(
                    p.rot + SWORD_ART_OFFSET
                ).setFlipY(false);
            } else {
                v.setRotation(0).setFlipY(false);
            }
        }
    }

    // ───────── 状態に合う画像 ─────────

    textureKey() {
        const a = this.attack;
        const st = this.state;

        const inAction =
            st === BS.ACTIVE ||
            st === BS.RECOVER;

        // スタン中は常に boss2_stun(パリィなど原因を問わない)
        if (st === BS.STUN) {
            return "boss2_stun";
        }

        // ファイアドロップで壁・床に当たって止まっている間(硬直中と後隙)
        // プレイヤーにヒットしただけでは切り替えない
        if (a?.fireDrop && this.dropStopped) {
            return "boss2_stun";
        }

        if (a?.hail) {
            return "boss2_firstattack";
        }

        if (a?.beam) {
            return "boss2_changedfire";
        }

        // 瞬間移動の構え
        if (a?.warp) {
            return "boss2_ready";
        }

        if (a?.fireFoot) {
            if (st === BS.TELEGRAPH) {
                return "boss2_firefootwait";
            }

            if (inAction) {
                return "boss2_firefootattack";
            }
        } else if (a?.firePunch) {
            if (st === BS.TELEGRAPH) {
                return "boss2_ready";
            }

            if (inAction) {
                return "boss2_firepunch";
            }
        } else if (a?.fireSideKick) {
            if (st === BS.TELEGRAPH) {
                return "boss2_sidekickstartup";
            }

            if (inAction) {
                return "boss2_sidekickattack";
            }
        } else if (a?.fireUpper) {
            if (st === BS.TELEGRAPH) {
                return "boss2_ready";
            }

            if (inAction) {
                return "boss2_fireupper";
            }
        } else if (a?.fireKick) {
            // 前隙・攻撃・後隙でそれぞれ別の画像
            if (st === BS.TELEGRAPH) {
                return "boss2_firekickstartup";
            }

            if (st === BS.ACTIVE) {
                return "boss2_firekickattack";
            }

            if (st === BS.RECOVER) {
                return "boss2_firekickrecovery";
            }
        } else if (a?.fireDrop) {
            if (st === BS.TELEGRAPH) {
                return "boss2_firedropwait";
            }

            if (inAction) {
                return "boss2_firedropattack";
            }
        }

        if (a?.backstep) {
            if (st === BS.TELEGRAPH) {
                return this.frame <= BACKSTEP_STARTUP_FRAMES
                    ? "boss2_backstepstartup"
                    : "boss2_backstep";
            }

            if (inAction) {
                return "boss2_backstepattack";
            }
        } else if (a?.block) {
            if (st === BS.TELEGRAPH) {
                return "boss2_iceblockwait";
            }

            if (inAction) {
                return "boss2_iceblockattack";
            }
        } else if (a?.shock) {
            if (st === BS.TELEGRAPH) {
                return "boss2_iceshockwait";
            }

            if (inAction) {
                return "boss2_iceshockattack";
            }
        } else if (a?.rain) {
            if (
                st === BS.TELEGRAPH ||
                inAction
            ) {
                return "boss2_iceblockattack";
            }
        }

        return this.phase2
            ? "boss2_mood2"
            : "boss2";
    }
}