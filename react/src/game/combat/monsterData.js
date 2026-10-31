// モンスターの種類表。新しい敵はここに足すだけ
export const MONSTERS = {
    slime: {
        name: "スライム",
        tint: 0x66ff88,      // 色で区別する
        maxHp: 40,
        damageMul: 0.6,      // 攻撃力の倍率(enemySlash が基準)
        speed: 70,           // 追いかける速さ
        aggro: 260,          // この距離内でプレイヤーに気づく
        attackRange: 60,     // この距離内で攻撃を始める
        attackCooldown: 90,  // 攻撃後の待ち(フレーム)
        xp: 12,
    },
    goblin: {
        name: "ゴブリン",
        tint: 0xffaa44,
        maxHp: 80,
        damageMul: 1.0,
        speed: 110,
        aggro: 340,
        attackRange: 70,
        attackCooldown: 70,
        xp: 30,
    },
};

// 出現の設定
export const SPAWN = {
    chancePerChunk: 0.7,     // 1チャンクにモンスターが出る確率
    safeChunks: 2,           // 最初と最後のこの数のチャンクは出さない
    weights: { slime: 0.65, goblin: 0.35 },  // 種類の出やすさ(合計1)
};