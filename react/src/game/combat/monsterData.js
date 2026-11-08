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
        drops: [
            { id: "potion", chance: 0.25 },
            { id: "tonic", chance: 0.08 },
            { id: "lealtherCap", chance: 0.04 },
        ],
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
        drops: [
            { id: "potion", chance: 0.35 },
            { id: "hiPotion", chance: 0.08 },
            { id: "leatherArmor", chance: 0.06 },
            { id: "ironHelm", chance: 0.04 },
            { id: "staminaCharm", chance: 0.04 },
            { id: "powerRing", chance: 0.03 },
            { id: "chainMail", chance: 0.02 },
        ],
    },
};

// 出現の設定
export const SPAWN = {
    chancePerChunk: 0.7,     // 1チャンクにモンスターが出る確率
    safeChunks: 2,           // 最初と最後のこの数のチャンクは出さない
    weights: { slime: 0.65, goblin: 0.35 },  // 種類の出やすさ(合計1)
};