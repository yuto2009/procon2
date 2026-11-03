import Phaser from "phaser";
import BaseBoss, { BS } from "./BaseBoss";
import { S } from "./Fighter";
import { DODGE } from "./frameData";

// ───────── 一回きりの演出のスイッチ ─────────
// true : 最初の確定攻撃(氷塊の雨)と、HP1/4以下の第二形態への変身を行う
// false: どちらも行わない(テスト用。最初から通常の行動を繰り返す)
const ONE_SHOT_EVENTS = true;
// true : 戦闘開始から第二形態にする(最初の氷塊の雨も飛ばす)
const START_IN_PHASE2 = false;
// true : HPが PHASE2_HP_RATIO 以下になったとき、変身攻撃(ビーム)をせずにすぐ第二形態にする
const SKIP_PHASE2_TRANSFORM_ATTACK = false;
// 炎エフェクトのON/OFF(OFFにすると、その絵も当たり判定も出ません)
const FLOOR_FIRE_ON = true;   // 足攻撃の床の炎(floorfire)
const IMPACT_FIRE_ON = true;  // パンチ・サイドキックの衝撃(fireimpact)
// ───────── Boss2 の調整用の数値 ─────────
const WALK_SPEED = 0.55;          // 歩く速さ(px/フレーム)
const CLOSE_RANGE = 90;       // この距離以内=近距離、それより遠い=遠距離

// 遠距離で選ぶ攻撃の割合(合計1にすること)
const FAR_BLOCK_CHANCE = 0.5;  // 氷塊系(選択後、さらに3種類から均等抽選)
const FAR_RAIN_CHANCE = 0.3;   // 相手の頭上に追尾する氷の剣
const FAR_SHOCK_CHANCE = 0.2; // 通常のiceShock

// 近距離では通常iceShockを優先し、残りをバックステップ攻撃にする
const CLOSE_SHOCK_CHANCE = 0.5;

// 頭上の剣が浮いている間に出せるのは「氷塊を落とす」と「通常iceShock」だけ。
// そのうち iceShock を選ぶ確率(残りは氷塊を落とす攻撃)
const HEAD_RAIN_SHOCK_CHANCE = 0.5;

// 最初の攻撃(戦闘開始後の1回だけ確定): 空中から小さい氷塊を大量に降らせる
const HAIL_AIR_HEIGHT = 300;       // 瞬間移動で浮かぶ高さ(足元が地面からこの高さ)
const HAIL_VANISH_FRAMES = 8;      // 消えている時間(フレーム)
const HAIL_SHOW_FRAMES = 50;       // 空中に現れてから降らせ始めるまで(ボスを見せる時間)
const HAIL_COLUMN_SPACING = 12;    // 氷塊の列の間隔(px。小さいほど密になる)
const HAIL_PIECE_SIZE = 28;        // 雨の氷塊の表示サイズ(px)
const HAIL_GAP_OFFSET = 100;       // 中央から、左右のすき間の中心までの距離(px)
const HAIL_GAP_WIDTH = 120;        // すき間1つの幅(px)。氷塊を降らせない範囲
const HAIL_PER_COLUMN = 5;         // 1列に降らせる氷塊の数
const HAIL_COLUMN_JITTER = 90;     // 列ごとの降り始めのランダムなずれ(フレーム)
const HAIL_SECOND_DELAY = 24;      // 同じ列の2個目以降が、順に遅れるフレーム数
const HAIL_START_Y = -450;         // 氷塊が降り始める高さ(画面の上端より上。小さいほど高い所から落ちる)

// バックステップ攻撃(近距離)
const BACKSTEP_SPEED = 6;
const BACKSTEP_STARTUP_FRAMES = 13; // 予備動作の長さ(フレーム)
const BACKSTEP_EDGE_MARGIN = 20;    // ステージ端の柱にめり込まないための余白(px)
const FIRST_VOLLEY_AT = 8; // 後退を始めてから1回目の剣を撃つまでのフレーム数
const SWORD_HEIGHTS = [30, 85, 140];  // 剣を撃つ高さ(地面から)
const BACKSTEP_CORNER_SPACE = 120; // 後ろの壁までこれ以下しかなければ「追い込まれた」とみなし、中央へ下がる(px)
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
const BLOCK_TRACK_INTERVAL_MIN = 18;   // 間隔の下限(フレーム)
const BLOCK_TRACK_RISE_MIN = 10;       // 速くなったときの、伸びきるまでの下限(フレーム)
const BLOCK_TRACK_RISE = 25;           // 伸びきって当たり判定が出るまでのフレーム
const BLOCK_TRACK_LOCK = 20;           // 当たり判定が出る何フレーム前に追尾をやめるか(大きいほど避けやすい)
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

const PROJ_POOL = 200;                // 同時に存在できる飛び道具の最大数(氷塊の雨で多く使う)

// ───────── 第二形態(HPがこの割合以下で発動) ─────────
const PHASE2_HP_RATIO = 0.75;

// ビーム: 最初は遅く、だんだん速く。間隔が THICK_AT 以下になったら極太ビームに切り替える
const BEAM_INTERVAL_START = 70;   // 1発目→2発目の間隔(フレーム)
const BEAM_INTERVAL_RATIO = 0.72; // 1発ごとに間隔へかける倍率
const BEAM_INTERVAL_MIN = 12;
const BEAM_THICK_AT = 18;         // この間隔以下になったら極太ビーム

// 細いビーム(ボス→プレイヤー)
const BEAM_WARN_RATIO = 0.6;      // 判定が出るまでの待ち = 間隔 × この値
const BEAM_WARN_MIN = 14;         // 待ちの最短フレーム
const BEAM_LOCK = 8;              // 当たり判定が出る何フレーム前に狙いを固定するか
const BEAM_SHOW_WARN = true;     // true: 予告線を表示 / false: 表示しない(判定が出るまでの待ち時間は残る)
const BEAM_WARN_W = 4;            // 予告線の太さ(px)
const BEAM_THIN_W = 80;           // 細いビームの太さ(px)
const BEAM_THIN_LIFE = 8;         // 細いビームの当たり判定が出ている時間(フレーム)
const BEAM_LENGTH = 1500;         // 細いビームの長さ(px)

// 極太ビーム(ボスの真下 → 画面全体)
const BEAM_BIG_WARN = 40;         // 判定が出るまでの待ち
const BEAM_BIG_W = 240;           // 真下ビームの太さ(px)
const BEAM_BIG_DOWN = 36;         // 真下に撃ち続ける時間(横に避けられる)
const BEAM_BIG_SPREAD = 6;        // 画面全体へ広がるフレーム数
const BEAM_BIG_HOLD = 4;          // 画面全体に残るフレーム数
// ※ SPREAD + HOLD = 10 フレーム。回避の無敵(DODGE.iframes = 10)で避けられる長さ

// ───────── 第二形態: 近距離の炎コンボ ─────────
// 足攻撃(fireFoot)が当たると、半々でパンチ(firePunch)かサイドキック(fireSideKick)へつながる
const FOLLOW_PUNCH_CHANCE = 0.5;  // 足攻撃がヒットしたあと、パンチを選ぶ確率(残りはサイドキック)
const FOOT_FIRE_SIDE = 0;        // 床の炎(floorfire)を出す側。-1=ボスの後ろ / 1=ボスの前 / 0=ボスと同じ位置
const BODY_W = 145;               // ボス本体の横幅(px)。足攻撃の本体の判定の横幅もこれに合わせる

const FIRE_IMPACT_HEIGHT = 80;    // パンチ・サイドキックの衝撃(fireimpact)の中心の、地面からの高さ(px)
const UPPER_OPEN_CHANCE = 0.6;    // 第二形態の近距離で、足攻撃の代わりにアッパーから始める確率
const MELEE_FACE_LOCK = 6;        // 前隙の最後のこのフレーム数だけは向きを固定する(それより前は相手の向きに合わせ続ける)
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
        startup: 45, active: 10, recovery: 45,
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

    // 最初の攻撃(1回だけ確定): 一瞬消えて中央の空中に現れ、
    // 小さい氷塊を敷き詰めるように降らせる(中央の左右に2つのすき間)。
    // 降り終わったら、一瞬消えて地面の中央に戻る。
    iceBlockHail: {
        noBody: true, block: true, hail: true, air: true,
        startup: HAIL_VANISH_FRAMES + HAIL_SHOW_FRAMES,
        active: 20,
        recovery: 600,   // 実際は氷塊が降り終わった時点で戻って終わる(これは安全用)
        ...NONE,
    },

    // 第二形態の変身攻撃: 最初の攻撃と同じ位置に浮き上がり、ビームを撃って、降りてくる
    fireBeam: {
        noBody: true, beam: true, air: true,
        startup: HAIL_VANISH_FRAMES + HAIL_SHOW_FRAMES,
        active: 20,
        recovery: 900,   // 実際はビームが全部終わった時点で戻って終わる(これは安全用)
        ...NONE,
    },

    // 通常iceShock: ボスの左右からステージ端へ向かって氷柱を走らせる。
    iceShock: {
        noBody: true, shock: true,
        startup: 24, active: 45, recovery: 25,
        ...NONE,
    },

    // 通常iceShock用: ボスの真下(体の幅ぶん)の当たり判定
    icicleUnder: {
        projectile: true, parryable: false,
        range: 150, height: 90,
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

    // ── 第二形態: 近距離の炎コンボ(数値は仮。調整してください) ──

    // 足攻撃: 前隙 boss2firefootwait → 攻撃・後隙 boss2firefootattack。
    // 攻撃の間、ボスの後ろに床の炎(floorFireHit)も出る。
    // 本体の蹴りか床の炎のどちらかがヒットすると、後隙を飛ばしてパンチかサイドキックへつながる。
    fireFoot: {
        fireMelee: true, fireFoot: true,
        startup: 18, active: 8, recovery: 30,
        range: BODY_W + 40, height: 150,    // 横幅はボス本体と同じ
        pull: BODY_W + 20,
        damage: 35, stamina: 0, hitstun: 20, knockback: 340,
        hitStop: 0, shake: 0.008,
    },

    // パンチ: 前隙 boss2ready → 攻撃・後隙 boss2firepunch。衝撃(fireImpactHit)も出る。
    firePunch: {
        fireMelee: true, firePunch: true,
        startup: 15, active: 8, recovery: 34,
        pull: BODY_W / 2,   // 判定をボスの中心から出す(体の端ではなく中心から前へ伸びる)
        range: 150, height: 120,
        damage: 60, stamina: 0, hitstun: 22, knockback: 1200,
        hitStop: 0, shake: 0.01,
    },

    // サイドキック: 前隙 boss2sidekickstartup → 攻撃・後隙 boss2sidekickattack。衝撃も出る。
    fireSideKick: {
        fireMelee: true, fireSideKick: true,
        startup: 15, active: 8, recovery: 34,
        range: 150, height: 180,
        pull: BODY_W / 2,   // 判定をボスの中心から出す(体の端ではなく中心から前へ伸びる)
        launch: 700,   // 食らうと上へ浮く強さ(Fighter.js の receiveHit が使う)
        damage: 55, stamina: 0, hitstun: 40, knockback: 900,
        hitStop: 0, shake: 0.01,
    },

    // アッパー: 前隙 boss2ready → 攻撃・後隙 boss2fireupper。
    // 足攻撃を回避でかわされたとき、または近距離で一定の確率で使う。
    // 食らった相手をボスの頭の高さくらいまで打ち上げる。ヒットしたら追撃のサイドキックへつながる。
    fireUpper: {
        fireMelee: true, fireUpper: true,
        startup: 15, active: 8, recovery: 40,
        range: 120, height: 120,
        pull: 50,      // 判定をボスの体の方へ寄せる距離(px)。大きいほど体に近い
        launch: 600,   // 打ち上げの強さ(Fighter.js の receiveHit が使う)
        damage: 30, stamina: 0, hitstun: 60, knockback: 120,
        hitStop: 0, shake: 0.01,
    },

    // 足攻撃のエフェクト: 床の炎(上向き)の当たり判定
    floorFireHit: {
        projectile: true, parryable: true,
        range: 275, height: 90,   // 足攻撃の本体(140×60)の1.5倍
        damage: 30, stamina: 0, hitstun: 20, knockback: 240,
        hitStop: 0, shake: 0.008,
    },

    // パンチ・サイドキックのエフェクト: 衝撃(左向きの絵)の当たり判定
    fireImpactHit: {
        projectile: true, parryable: true,
        range: 180 , height: 120,   // 床の炎と同じ大きさ
        damage: 30, stamina: 0, hitstun: 20, knockback: 260,
        hitStop: 0, shake: 0.008,
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

    // 最初の攻撃の雨で降る、とても小さい氷塊(数が多いので1個のダメージは小さい)
    iceHailPiece: {
        projectile: true, parryable: false,
        range: 20, height: 20,
        damage: 12, stamina: 0, hitstun: 12, knockback: 150,
        hitStop: 0, shake: 0.003,
    },

    icicle: {
        projectile: true, parryable: false,
        range: 44, height: 100,
        damage: 45, stamina: 0, hitstun: 25, knockback: 280,
        hitStop: 0, shake: 0.01,
    },

    // 細いビームのダメージ設定(パリィ不可)
    beamThin: {
        projectile: true, parryable: false,
        range: 0, height: 0,
        damage: 30, stamina: 0, hitstun: 20, knockback: 260,
        hitStop: 0, shake: 0.008,
    },

    // 極太ビームのダメージ設定(パリィ不可)
    beamBig: {
        projectile: true, parryable: false,
        range: 0, height: 0,
        damage: 55, stamina: 0, hitstun: 30, knockback: 320,
        hitStop: 0, shake: 0.014,
    },
};

// 飛び道具の見た目(画像キー・表示サイズ・基準点)
const VIEW = {
    sword:  { key: "boss2_icesword",      w: 48,  h: 90,  originY: 0.5 },
    big:    { key: "boss2_iceblock",      w: 110, h: 110, originY: 0.5 },
    small:  { key: "boss2_smalliceblock", w: 44,  h: 44,  originY: 0.5 },
    icicle: { key: "boss2_icicle",        w: 50,  h: 110, originY: 1 },
    blockTrackIcicle: { key: "boss2_icicle", w: 50, h: 110, originY: 1 },
    beam:   { key: "boss2_firebeam",      w: 1,   h: 1,   originY: 0.5 },
    // 炎コンボのエフェクト。fireFx は床の炎(上向きの絵・根元を地面に置く)
    fireFx:     { key: "boss2_floorfire",  w: 270, h: 450, originY: 1 },
    // 衝撃(左向きの絵)。fireFx の fx が "impact" のときに使う
    fireImpact: { key: "boss2_fireimpact", w: 190, h: 140,  originY: 0.5
 },
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
        rise: BLOCK_TRACK_RISE,    // 氷塊派生氷柱: 伸びきるまでのフレーム(後の柱ほど短い)。ビームでは判定が出るまでの待ち
        lock: BLOCK_TRACK_LOCK,    // 氷塊派生氷柱: 当たり判定の何フレーム前に追尾をやめるか
        target: null,       // 剣・追尾氷柱・ビーム: 追従する相手
        offX: 0, offY: 0,   // 剣: 浮いている位置
        traveled: 0,
        beamMode: "thin",   // ビーム: "thin"(ボス→相手) か "big"(真下→全体)
        beamStage: -1,      // ビーム: 段階が変わったら hitSet を空にするための記録
        fx: "",             // 炎エフェクト: "floor"(床の炎) か "impact"(衝撃)
        dir: 1,             // 炎エフェクト: 出したときのボスの向き(1=右 / -1=左)
        life: 0,            // 炎エフェクト: 出てから消えるまでのフレーム
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
        L("boss2_backstepstartup", "boss2backstepstartup.png"); // バックステップ予備動作
        L("boss2_backstep", "boss2backstep.png");              // バックステップで後退中
        L("boss2_backstepattack", "boss2backstepattack.png");  // 着地後・攻撃姿勢
        L("boss2_iceblock", "boss2iceblock.png");              // 氷塊
        L("boss2_iceblockwait", "boss2iceblockwait.png");
        L("boss2_iceblockattack", "boss2iceblockattack.png");
        L("boss2_iceshockwait", "boss2iceshockwait.png");      // つらら
        L("boss2_iceshockattack", "boss2iceshockattack.png");
        L("boss2_icesword", "boss2icesword.png");              // 氷の剣
        L("boss2_icicle", "boss2icicle.png");                  // つらら(飛び道具)
        L("boss2_firstattack", "boss2firstattack.png");        // 最初の攻撃(空中)
        L("boss2_smalliceblock", "boss2smalliceblock.png");    // 小さい氷塊
        L("boss2_changedfire", "boss2changedfire.png");        // 第二形態への変身(空中)
        L("boss2_firebeam", "boss2firebeam.png");              // ビーム(縦長の絵)
        L("boss2_mood2", "boss2mood2.png");                    // 第二形態の待機

        // 第二形態: 近距離の炎コンボ
        L("boss2_firefootwait", "boss2firefootwait.png");          // 足攻撃の前隙
        L("boss2_firefootattack", "boss2firefootattack.png");      // 足攻撃の攻撃・後隙
        L("boss2_floorfire", "boss2floorfire.png");                // 足攻撃のエフェクト(上向き)
        L("boss2_ready", "boss2ready.png");                        // パンチの前隙
        L("boss2_firepunch", "boss2firepunch.png");                // パンチの攻撃・後隙
        L("boss2_fireimpact", "boss2fireimpact.png");              // パンチ・サイドキックのエフェクト(左向き)
        L("boss2_sidekickstartup", "boss2sidekickstartup.png");    // サイドキックの前隙
        L("boss2_sidekickattack", "boss2sidekickattack.png");      // サイドキックの攻撃・後隙
        L("boss2_fireupper", "boss2fireupper.png");                // アッパーの攻撃・後隙(前隙は boss2_ready)
    }

    constructor(scene, x, groundY, opts = {}) {
        super(scene, x, groundY, {
            texture: "boss2",
            maxHp: 800,
            bodyW: BODY_W,
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

        // 画面全体に広がる極太ビームの見た目(単色の帯)を描く
        this.beamGraphics = scene.add.graphics().setDepth(7);

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

        // 最初の攻撃: もう出したか / 空中にいるか / 消えているか / 戻る前に消えている時間
        this.openingDone = false;
        this.hailAir = false;
        this.hailHidden = false;
        this.hailReturn = 0;

        // 第二形態: 発動したか / ビーム攻撃の進行状況
        this.phase2 = false;
        this.beam = null;

        // コンボの記録: 今の攻撃がヒットしたか / 回避の無敵でかわされたか
        this.comboHit = false;
        this.comboDodged = false;

        // スイッチが false なら最初の確定攻撃も行わない(最初から歩いて通常行動する)
        if (!ONE_SHOT_EVENTS) this.openingDone = true;

        // 動作確認用: 最初から第二形態で始める
        if (START_IN_PHASE2) {
            this.phase2 = true;
            this.openingDone = true;
        }
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

    // 氷塊・氷柱の追尾・ボス近くの剣・ビームのどれかが、まだ続いているか
    isBlockAttackBusy() {
        if (this.blockTrackSequences.length || this.bossSwordSequence || this.beam) {
            return true;
        }

        return this.projs.some(
            (p) =>
                p.active &&
                (p.kind === "big" ||
                    p.kind === "small" ||
                    p.kind === "blockTrackIcicle" ||
                    p.kind === "beam" ||
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

        // HPが1/4を下回ったら、次の行動の切れ目で第二形態へ(1回だけ)
        if (ONE_SHOT_EVENTS && !this.phase2 && this.hp <= this.maxHp * PHASE2_HP_RATIO) {
            this.phase2 = true;

            // 頭上に浮いている剣は消しておく
            for (const p of this.projs) {
                if (p.active && p.kind === "sword" && p.hovering && !p.bossHover) {
                    p.active = false;
                }
            }

            // 動作確認用: 変身攻撃(ビーム)を飛ばして、すぐ第二形態の行動に入る
            if (!SKIP_PHASE2_TRANSFORM_ATTACK) {
                this.attack = BOSS2_ATTACKS.fireBeam;
                this.enter(BS.TELEGRAPH);
                return;
            }
        }

        // 第二形態になったあとの行動(いまは近距離の炎コンボだけ)
        if (this.phase2) {
            this.tickIdlePhase2(nearest);
            return;
        }

        const dx = nearest.sprite.x - this.sprite.x;
        const far = Math.abs(dx) > CLOSE_RANGE;

        // 遠ければ近づきながら待つ
        // (最初の攻撃で瞬間移動するまでは、その場から動かない)
        if (far && this.openingDone) {
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

        // 戦闘開始後の最初の攻撃は、確定で氷塊の雨(この1回だけ)
        if (!this.openingDone) {
            this.openingDone = true;
            this.attack = BOSS2_ATTACKS.iceBlockHail;
            this.enter(BS.TELEGRAPH);
            return;
        }

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
                // 氷塊系の中で、3種類から均等抽選
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

    // 第二形態の待機中の行動。遠ければ近づき、近距離なら足攻撃から始める。
    // (遠距離の行動は、まだ作っていない)
    tickIdlePhase2(nearest) {
        const dx = nearest.sprite.x - this.sprite.x;
        const far = Math.abs(dx) > CLOSE_RANGE;

        if (far) {
            this.moveBody(Math.sign(dx) * WALK_SPEED, 0);
            return;
        }

        if (this.frame <= this.cfg.idleWait) return;

        // 近距離では、一定の確率でアッパーから、そうでなければ足攻撃から始める
        this.attack =
            Math.random() < UPPER_OPEN_CHANCE
                ? BOSS2_ATTACKS.fireUpper
                : BOSS2_ATTACKS.fireFoot;
        this.enter(BS.TELEGRAPH);
    }

    // ───────── 攻撃の流れ ─────────

    // 予備動作の後に後退しながら1回目の剣を撃つ
    onTelegraphTick() {
        // 空中に上がる攻撃(最初の氷塊の雨 / 第二形態のビーム): 一瞬消えて中央の空中に現れる
        if (this.attack?.air) {
            if (this.frame < HAIL_VANISH_FRAMES) {
                this.hailHidden = true;
            } else if (this.frame === HAIL_VANISH_FRAMES) {
                const { arenaLeft, arenaRight } = this.cfg;
                this.teleportBoss((arenaLeft + arenaRight) / 2, HAIL_AIR_HEIGHT);
                this.hailAir = true;
                this.hailHidden = false;
            }
            return;
        }
        // 第二形態の近距離コンボ: 前隙の間は、相手のいる向きに合わせ続ける
if (this.attack?.fireMelee) {
    this.faceForMelee();
    return;
}
        if (!this.attack?.backstep) return;
         // 最初の数フレームは予備動作だけで、まだ後退しない
        if (this.frame <= BACKSTEP_STARTUP_FRAMES) return;
                // 予備動作が終わったら後ろへ下がる
        const { arenaLeft, arenaRight } = this.cfg;
        const half = this.sprite.width / 2 + BACKSTEP_EDGE_MARGIN;

        // 下がり始める最初の1フレームだけ、向きを決める(途中で向きが変わって震えないように)
               // 下がり始める最初の1フレームだけ、向きを決める(途中で向きが変わって震えないように)
        if (this.frame === BACKSTEP_STARTUP_FRAMES + 1) {
            // 剣を撃つ向きは、今の向き(相手のいる側)のまま覚えておく
            this.volleyDir = this.facing;

            let dir = -this.facing;   // 普通は相手と反対側へ

            // 後ろの壁までの空きが少ないとき(追い込まれたとき)は、中央へ向かって下がる
            const spaceBehind =
                dir < 0
                    ? this.sprite.x - (arenaLeft + half)
                    : (arenaRight - half) - this.sprite.x;

            if (spaceBehind <= BACKSTEP_CORNER_SPACE) {
                dir = Math.sign((arenaLeft + arenaRight) / 2 - this.sprite.x) || 1;

                // 中央へ下がるときは、進む向きと反対の「外側(壁側)」を向く
                this.facing = -dir;
            }

            this.backstepDir = dir;
        }

        this.moveBody(this.backstepDir * BACKSTEP_SPEED, 0);

        // ステージの外(柱の向こう)へ出ないように止める
        this.sprite.x = Phaser.Math.Clamp(
            this.sprite.x,
            arenaLeft + half,
            arenaRight - half
        );
        
        // 後退を始めてから指定フレーム後に1回目の剣を撃つ
        if (this.frame === BACKSTEP_STARTUP_FRAMES + FIRST_VOLLEY_AT) {
            this.fireVolley();
        }
    }
    tick(players) {
    this.playersRef = players;   // 前隙の向き合わせで使う
    super.tick(players);
}

faceForMelee() {
    const a = this.attack;
    if (this.frame >= a.startup - MELEE_FACE_LOCK) return;

    // コンボの途中なら、直前に当てた(かわされた)相手のほうを向く。いなければ一番近い相手
    const t = this.comboTarget && this.comboTarget.hp > 0
        ? this.comboTarget
        : this.nearestAlive(this.playersRef ?? []);

    if (t) this.faceToward(t);
}

    // 攻撃に入った最初のフレームで、それぞれの飛び道具を出す
    onActiveFrame(players) {
        const a = this.attack;
        if (this.frame !== 1) return;

        if (a.backstep) {
            this.fireVolley();
        } else if (a.fireFoot || a.firePunch || a.fireSideKick) {
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

    // 攻撃が終わるとき、後隙を飛ばして次の技へつなぐ:
    //   足攻撃がヒット → パンチかサイドキック / 回避でかわされた → アッパー
    //   アッパーがヒット → 追撃のサイドキック
    onActiveEnd(players) {
        const a = this.attack;

        if (a?.fireFoot) {
            if (this.comboHit) {
                this.attack =
                    Math.random() < FOLLOW_PUNCH_CHANCE
                        ? BOSS2_ATTACKS.firePunch
                        : BOSS2_ATTACKS.fireSideKick;
                this.enter(BS.TELEGRAPH);   // onEnter でヒットの記録を戻す
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

        this.enter(BS.RECOVER);
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

        // 第二形態の近距離コンボは、回避でかわされたかどうかを見分けるため専用の判定を使う
        if (a?.fireMelee) {
            this.tickMeleeActive(players);
            return;
        }

        super.tickActive(players);
    }

    // BaseBoss.tickActive と同じ流れの当たり判定に、「ヒットか、回避でかわされたか」の記録を足したもの
    tickMeleeActive(players) {
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

        const before = new Set(this.hitSet);

        for (const pl of players) {
            if (pl.hp <= 0 || this.hitSet.has(pl)) continue;

            if (
                Phaser.Geom.Intersects.RectangleToRectangle(
                    rect,
                    pl.sprite.getBounds()
                )
            ) {
                this.hitSet.add(pl);
                pl.receiveHit(this, a);

                // パリィされてボスが止まったら、この攻撃はここで終わり
                if (this.state !== BS.ACTIVE) return;
            }
        }

        this.noteContacts(this.hitSet, before);

        if (this.frame >= a.active) {
            this.onActiveEnd(players);
        }
    }

    // 攻撃データに pull があれば、判定をその分だけボスの体の方へ寄せる(大きさは変えない)
    hitRect(a) {
        const rect = super.hitRect(a);
        rect.x -= this.facing * (a.pull ?? 0);
        return rect;
    }

    // 新しく当たった(当たり判定に触れた)相手を、「回避の無敵でかわされた」か「ヒットした」かに分けて記録する
    noteContacts(hitSet, before) {
        for (const pl of hitSet) {
            if (before.has(pl)) continue;
            this.comboTarget = pl;
            if (pl.state === S.DODGE && pl.frame <= DODGE.iframes) {
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
        this.tickHailReturn();
        this.tickBeamSequence(players);

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
                case "beam":
                    this.tickBeam(p, players);
                    break;
                case "fireFx":
                    this.tickFireFx(p, players);
                    break;
            }
        }
    }

    // 空中に上がる攻撃の間は、重力で落ちない
    isFloating() {
        return this.hailAir && !!this.attack?.air;
    }

    // 待機に戻る・スタンしたときは、空中や消えている状態を戻す
    onEnter(state) {
        if (state === BS.IDLE || state === BS.STUN) {
            this.hailAir = false;
            this.hailHidden = false;
            this.hailReturn = 0;
            this.comboTarget = null;
        }
        if (state === BS.STUN) this.beam = null;   // スタンしたらビームの連続発射をやめる

        // 新しい攻撃の前隙に入るたびに、ヒットの記録を戻す
        if (state === BS.TELEGRAPH) {
            this.comboHit = false;
            this.comboDodged = false;
        }
    }

    onDeadTick() {
        this.clearProjs();
    }

    onDead() {
        this.clearProjs();
        this.hailAir = false;
        this.hailHidden = false;
    }

    // ───────── 第二形態: 近距離の炎コンボ ─────────

    // 攻撃に入った最初のフレームで、攻撃に合わせたエフェクト(当たり判定つき)を出す
    spawnFireFx(a) {
        const half = this.sprite.width / 2;
        const dir = this.facing;

        if (a.fireFoot) {
            if (!FLOOR_FIRE_ON) return;
            // 足攻撃: 床の炎(上向き)。FOOT_FIRE_SIDE で後ろ(-1)か前(1)かを選ぶ
            const fa = BOSS2_ATTACKS.floorFireHit;

            this.spawnProj("fireFx", {
                a: fa,
                fx: "floor",
                dir,
                life: a.active,
                x: this.sprite.x + dir * FOOT_FIRE_SIDE * (half + fa.range / 2),
                y: this.groundY,
            });
            return;
        }
        if (!IMPACT_FIRE_ON) return;
        // パンチ・サイドキック: 前方に衝撃(左向きの絵)
        const ia = BOSS2_ATTACKS.fireImpactHit;

        this.spawnProj("fireFx", {
            a: ia,
            fx: "impact",
            dir,
            life: a.active,
            x: this.sprite.x + dir * (half + ia.range / 2 - (a.pull ?? 0) - 60),
            y: this.groundY - FIRE_IMPACT_HEIGHT,
        });
    }

    tickFireFx(p, players) {
        const a = p.a;
        const before = new Set(p.hitSet);

        // 床の炎は根元が地面。衝撃は中心が p.y
        const cy = p.fx === "floor" ? this.groundY - a.height / 2 : p.y;
        this.hitPlayers(p, players, a.range, a.height, cy);

        // 床の炎に当たっても、足攻撃のヒット(回避なら「かわされた」)として数える
        this.noteContacts(p.hitSet, before);

        if (p.age >= p.life) {
            p.active = false;
        }
    }

    // ───────── 氷の剣(バックステップ) ─────────

    // 3本まとめて撃つ(高さ違い)
    fireVolley() {
        const a = BOSS2_ATTACKS.iceSword;
        const half = this.sprite.width / 2;
        const dir = this.volleyDir ?? this.facing;
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

    // ───────── 最初の攻撃: 空中から小さい氷塊の雨 ─────────

    // ボスを瞬間移動させる(heightAboveGround は足元の、地面からの高さ)
    teleportBoss(x, heightAboveGround) {
        this.sprite.x = x;
        this.sprite.y =
            this.groundY - this.sprite.height / 2 - heightAboveGround;
        this.vy = 0;
    }

    // 小さい氷塊を、すき間以外の全部の列に、列ごとに少しずらして降らせる
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
            // 中央の左右にある2つのすき間には、降らせない
            const inGap = [-1, 1].some(
                (s) =>
                    Math.abs(x - (center + s * HAIL_GAP_OFFSET)) <
                    HAIL_GAP_WIDTH / 2
            );
            if (inGap) continue;

            const jitter = Phaser.Math.Between(0, HAIL_COLUMN_JITTER);

            for (let j = 0; j < HAIL_PER_COLUMN; j++) {
                this.spawnProj("small", {
                    a,
                    x,
                    y: HAIL_START_Y,
                    vx: 0,
                    vy: 0,
                    delay: jitter + j * HAIL_SECOND_DELAY,
                });
            }
        }
    }

    // 空中の攻撃(氷塊の雨 / ビーム)が全部終わったら、一瞬消えて、地面の中央に戻る
    tickHailReturn() {
        const a = this.attack;

        if (!a?.air || this.state !== BS.RECOVER || !this.hailAir) return;
        if (this.isBlockAttackBusy()) return;

        this.hailHidden = true;
        this.hailReturn++;

        if (this.hailReturn >= HAIL_VANISH_FRAMES) {
            const { arenaLeft, arenaRight } = this.cfg;
            this.teleportBoss((arenaLeft + arenaRight) / 2, 0);
            this.attack = null;
            this.enter(BS.IDLE);   // onEnter で、空中・消えている状態も戻る
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

    // ───────── 第二形態: ファイアビーム ─────────

    // index 発目のビームを撃ってから、次を撃つまでの間隔(だんだん短くなる)
    beamInterval(index) {
        return Math.max(
            BEAM_INTERVAL_MIN,
            Math.round(BEAM_INTERVAL_START * BEAM_INTERVAL_RATIO ** index)
        );
    }

    startBeamSequence(players) {
        const targets = players.filter((p) => p.hp > 0);
        if (!targets.length) return;

        this.beam = { targets, index: 0, wait: 0 };
        this.fireBeamStep();
    }

    // 1ステップ分: 間隔が十分短くなっていれば極太ビーム、まだなら全員へ細いビーム
    fireBeamStep() {
        const st = this.beam;
        if (!st) return;

        const interval = this.beamInterval(st.index);

        if (interval <= BEAM_THICK_AT) {
            // 極太ビーム: ボスの真下へ撃ち、そのまま画面全体へ広がる。これでこの攻撃は終わり
            this.spawnProj("beam", {
                a: BOSS2_ATTACKS.beamBig,
                beamMode: "big",
                x: this.sprite.x,
                y: this.sprite.y,
                rot: Math.PI / 2,
            });
            this.beam = null;   // 残りの終了待ちは、飛び道具(kind: beam)が残っているかで判定
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
                rise: warn,   // 判定が出るまでの待ち(同期でも使う)
                x: this.sprite.x,
                y: this.sprite.y,
                rot: Math.atan2(t.sprite.y - this.sprite.y, t.sprite.x - this.sprite.x),
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
        if (st.wait <= 0) this.fireBeamStep();
    }

    // ビームの現在の状態(当たり判定の有無・太さ・濃さ)。ホストの判定とゲストの描画で共用
    beamInfo(p) {
        const a = p.age;

        if (p.beamMode === "big") {
            const { arenaLeft, arenaRight } = this.cfg;
            const full = arenaRight - arenaLeft + 400;
            const bottom = this.groundY + 20;
            const topAll = -100;   // 画面の上端より上(広がったときは天井まで全部覆う)
            const downAt = BEAM_BIG_WARN;
            const spreadAt = downAt + BEAM_BIG_DOWN;
            const holdAt = spreadAt + BEAM_BIG_SPREAD;

            // top = ビームの上端のy、len = そこから下の長さ。当たり判定も見た目もこの値を使う
            if (a < downAt) {
                // 待ち: 判定なし(BEAM_SHOW_WARN が true のときだけ、細い線がだんだん太くなる)
                return {
                    hit: false, stage: 0, alpha: 0.35, top: p.y, len: bottom - p.y,
                    w: 8 + (BEAM_BIG_W - 8) * (a / downAt),
                };
            }
            if (a < spreadAt) {
                // 真下に撃っている間(点滅はしない)
                return { hit: true, stage: 1, alpha: 1, top: p.y, len: bottom - p.y, w: BEAM_BIG_W };
            }

            // 広がる間: 横は画面全体へ、上は天井まで。広がりきったらそのまま保つ
            const t = Math.min(1, (a - spreadAt) / BEAM_BIG_SPREAD);
            const top = p.y + (topAll - p.y) * t;
            return {
                hit: true, stage: 2, alpha: 1, top, len: bottom - top,
                w: BEAM_BIG_W + (full - BEAM_BIG_W) * t,
            };
        }

        // 細いビーム
        if (a < p.rise) {
            return { hit: false, stage: 0, alpha: 0.4, top: p.y, len: BEAM_LENGTH, w: BEAM_WARN_W };
        }
        return { hit: true, stage: 1, alpha: 1, top: p.y, len: BEAM_LENGTH, w: BEAM_THIN_W };
    }

    tickBeam(p, players) {
        const big = p.beamMode === "big";

        // 細いビームは、当たり判定が出る少し前まで相手を狙い続け、そこで向きを固定する
        if (!big) {
            p.x = this.sprite.x;
            p.y = this.sprite.y;

            if (p.age <= p.rise - BEAM_LOCK && p.target && p.target.hp > 0) {
                p.rot = Math.atan2(
                    p.target.sprite.y - p.y,
                    p.target.sprite.x - p.x
                );
            }
        }

        const info = this.beamInfo(p);

        // 段階が変わったら当たり済みの記録を消す(回避で通り抜けた相手にも次の段階が当たる)
        if (info.stage !== p.beamStage) {
            p.beamStage = info.stage;
            p.hitSet.clear();
        }

        if (info.hit) {
            if (big) {
                this.hitPlayers(p, players, info.w, info.len, info.top + info.len / 2);
            } else {
                this.hitBeamLine(p, players, info.w, info.len);
            }
        }

        const end = big
            ? BEAM_BIG_WARN + BEAM_BIG_DOWN + BEAM_BIG_SPREAD + BEAM_BIG_HOLD
            : p.rise + BEAM_THIN_LIFE;

        if (p.age >= end) p.active = false;
    }

    // 斜めのビーム: 線と(太さぶん広げた)プレイヤーの矩形で判定する
    hitBeamLine(p, players, width, len) {
        const line = new Phaser.Geom.Line(
            p.x,
            p.y,
            p.x + Math.cos(p.rot) * len,
            p.y + Math.sin(p.rot) * len
        );

        for (const pl of players) {
            if (pl.hp <= 0 || p.hitSet.has(pl)) continue;

            const rect = pl.sprite.getBounds();
            Phaser.Geom.Rectangle.Inflate(rect, width / 2, width / 2);

            if (Phaser.Geom.Intersects.LineToRectangle(line, rect)) {
                p.hitSet.add(pl);
                pl.receiveHit(this, p.a);
            }
        }
    }

    renderBeam(p, v) {
        const info = this.beamInfo(p);

        // 予告線を表示しない設定なら、判定が出るまでは何も描かない
        if (!info.hit && !BEAM_SHOW_WARN) {
            v.setVisible(false);
            return;
        }

        // 画面全体に広がる段階は、縦長の画像を横に引き伸ばすと絵が崩れるので、
        // 当たり判定とまったく同じ範囲を単色の帯で塗って表示する(画像は隠す)
        // (真下に撃っている間も、広がる間も、同じ描き方にする)
        if (p.beamMode === "big") {
            v.setVisible(false);

            const g = this.beamGraphics;
            const x0 = p.x - info.w / 2;

            g.fillStyle(0xff8a2b, 0.9 * info.alpha);
            g.fillRect(x0, info.top, info.w, info.len);

            // 中心に明るい芯を入れて、ビームらしく見せる
            const coreW = info.w * 0.6;
            g.fillStyle(0xfff2c2, 0.95 * info.alpha);
            g.fillRect(p.x - coreW / 2, info.top, coreW, info.len);
            return;
        }

        // 画像は縦長で、上端が根元・下へ伸びる絵。回転0のとき真下を向く。
        // 細いビームは p.rot(0=右向き)に合わせて 90度ぶん引いて回す。極太ビームは真下なので回転0。
        const rot = p.beamMode === "big" ? 0 : p.rot - Math.PI / 2;

        v.setVisible(true)
            .setAlpha(info.alpha)
            .setOrigin(0.5, 0)               // ボスの位置が根元。そこから下方向(回転後は狙う方向)へ伸ばす
            .setDisplaySize(info.w, info.len)
            .setPosition(p.x, info.top)
            .setRotation(rot)
            .setFlipY(false);
    }

    // ───────── 同期 ─────────

    // ホストの飛び道具を、プール内の同じスロット番号でゲストへ送る。
    // 出現待ち(delay)も送るため、遅れて出る氷塊・氷柱も同じタイミングで表示できる。
    getExtraSyncData() {
        const projs = [];

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            // 出現待ち(delay)の間は、ゲスト側で表示しないので送らない(通信量を減らす)
            if (!p.active || p.delay > 0) continue;

            const attackKey =
                p.a === BOSS2_ATTACKS.iceSword ? "iceSword" :
                p.a === BOSS2_ATTACKS.rainSword ? "rainSword" :
                p.a === BOSS2_ATTACKS.iceBlockBig ? "iceBlockBig" :
                p.a === BOSS2_ATTACKS.iceBlockSmall ? "iceBlockSmall" :
                p.a === BOSS2_ATTACKS.iceHailPiece ? "iceHailPiece" :
                p.a === BOSS2_ATTACKS.icicleUnder ? "icicleUnder" :
                p.a === BOSS2_ATTACKS.icicle ? "icicle" :
                p.a === BOSS2_ATTACKS.beamThin ? "beamThin" :
                p.a === BOSS2_ATTACKS.beamBig ? "beamBig" :
                p.a === BOSS2_ATTACKS.floorFireHit ? "floorFireHit" :
                p.a === BOSS2_ATTACKS.fireImpactHit ? "fireImpactHit" : null;

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
                fx: p.fx === "floor" ? 1 : p.fx === "impact" ? 2 : 0,
                fd: p.dir,
            });
        }

        return { projs, hh: this.hailHidden ? 1 : 0, p2: this.phase2 ? 1 : 0 };
    }

    // ゲスト側は攻撃判定を行わず、ホストから届いた座標・状態を描画する。
    applyExtraSync(d) {
        // 瞬間移動で消えている間は、ゲスト側でもボスを隠す
        this.hailHidden = !!d?.hh;
        this.phase2 = !!d?.p2;

        const list = Array.isArray(d?.projs) ? d.projs : [];
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
            p.beamMode = src.bm ? "big" : "thin";
            p.fx = src.fx === 1 ? "floor" : src.fx === 2 ? "impact" : "";
            p.dir = Number(src.fd) || 1;
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
            case "beam": {
                // 極太ビームの当たり範囲だけ白く表示する(細いビームは斜めなので表示しない)
                if (p.beamMode !== "big") return null;
                const info = this.beamInfo(p);
                if (!info.hit) return null;
                return { x: p.x, y: info.top + info.len / 2, w: info.w, h: info.len };
            }
            case "fireFx": {
                // 炎コンボのエフェクト: 床の炎は根元が地面、衝撃は中心が p.y
                const a = p.a ?? (p.fx === "floor"
                    ? BOSS2_ATTACKS.floorFireHit
                    : BOSS2_ATTACKS.fireImpactHit);
                const cy = p.fx === "floor" ? this.groundY - a.height / 2 : p.y;
                return { x: p.x, y: cy, w: a.range, h: a.height };
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

    // 炎コンボのエフェクトの描画。
    // 床の炎は上向きの絵で、根元を地面に置く。衝撃は左向きの絵なので、右向きのときだけ反転する。
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

    renderExtra() {
        this.drawProjectileHitboxes();
        this.beamGraphics.clear();

        // 瞬間移動で消えている間は、ボスの画像を見えなくする
        this.view.setAlpha(this.hailHidden ? 0 : 1);

        for (let i = 0; i < this.projs.length; i++) {
            const p = this.projs[i];
            const v = this.projViews[i];

            if (!p.active || p.delay > 0) {
                v.setVisible(false);
                continue;
            }

            const cfg = p.kind === "fireFx"
                ? (p.fx === "floor" ? VIEW.fireFx : VIEW.fireImpact)
                : VIEW[p.kind];

            // 床の炎はボスの後ろ(ボスの画像より奥)に描く。ほかは手前
            v.setDepth(p.kind === "fireFx" && p.fx === "floor" ? 4 : 7);

            if (v.texture.key !== cfg.key) {
                v.setTexture(cfg.key);
            }

            // ビームは専用の描画(縦長の画像を、太さと長さに合わせて引き伸ばす)
            if (p.kind === "beam") {
                this.renderBeam(p, v);
                continue;
            }

            // 炎コンボのエフェクトも専用の描画
            if (p.kind === "fireFx") {
                this.renderFireFx(p, v, cfg);
                continue;
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

            // 雨の氷塊は、ほかの小さい氷塊よりさらに小さく表示する
            const isHail = p.a === BOSS2_ATTACKS.iceHailPiece;
            const dispW = isHail ? HAIL_PIECE_SIZE : cfg.w;
            const dispH = isHail ? HAIL_PIECE_SIZE : cfg.h;

            v.setVisible(grow > 0)
                .setAlpha(alpha)
                .setOrigin(0.5, cfg.originY)
                .setDisplaySize(dispW, dispH * grow)
                .setPosition(p.x, p.y + sinkOffset)
                .setFlipX(false);   // 炎エフェクトで使った反転を、使い回しのスロットに残さない

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

        // 最初の攻撃は、空中にいる間ずっとこの画像
        if (a?.hail) return "boss2_firstattack";

        // 第二形態への変身〜ビーム中は、空中にいる間ずっとこの画像
        if (a?.beam) return "boss2_changedfire";

        // 第二形態の近距離コンボ: 前隙と、攻撃・後隙で画像を切り替える
        if (a?.fireFoot) {
            if (st === BS.TELEGRAPH) return "boss2_firefootwait";
            if (inAction) return "boss2_firefootattack";
        } else if (a?.firePunch) {
            if (st === BS.TELEGRAPH) return "boss2_ready";
            if (inAction) return "boss2_firepunch";
        } else if (a?.fireSideKick) {
            if (st === BS.TELEGRAPH) return "boss2_sidekickstartup";
            if (inAction) return "boss2_sidekickattack";
        } else if (a?.fireUpper) {
            if (st === BS.TELEGRAPH) return "boss2_ready";
            if (inAction) return "boss2_fireupper";
        }

        if (a?.backstep) {
            if (st === BS.TELEGRAPH) {
                // 予備動作中
                if (this.frame <= BACKSTEP_STARTUP_FRAMES) {
                    return "boss2_backstepstartup";
                }

                // 後退中
                return "boss2_backstep";
            }

            // 着地後・攻撃中・後隙
            if (inAction) return "boss2_backstepattack";
        } else if (a?.block) {
            // 氷塊落とし・派生氷柱・ボス近くからの剣は同じモーション
            if (st === BS.TELEGRAPH) return "boss2_iceblockwait";
            if (inAction) return "boss2_iceblockattack";
        } else if (a?.shock) {
            if (st === BS.TELEGRAPH) return "boss2_iceshockwait";
            if (inAction) return "boss2_iceshockattack";
        } else if(a?.rain) { 
            //頭上に剣を浮かせる攻撃のモーション
            if(st === BS.TELEGRAPH || inAction) return "boss2_iceblockattack";
        }

        // 氷の剣6本や、死亡・スタンの画像はまだないので待機画像で代用
        // 待機: 第二形態では boss2mood2
        return this.phase2 ? "boss2_mood2" : "boss2";
    }
}