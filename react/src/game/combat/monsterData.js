// モンスターの種類表。新しい敵はここに足すだけ
export const MONSTERS = {
    slime: {
        name: "スライム",
        tint: 0x66ff88,
        image: "slime",              // ← 1枚絵を使う
        scale: 2,                    // 32px → 64px
        body: { w: 52, h: 44 },      // 当たり判定の大きさ(見た目に合わせる)
        footOffset: 2,               // 画像の下の透明な1px分を、地面に合わせる
        maxHp: 40,
        damageMul: 0.6,
        speed: 70,
        aggro: 260,
        attackRange: 60,
        attackCooldown: 90,
        xp: 12,
        drops: [
            { id: "potion", chance: 0.25 },
            { id: "tonic", chance: 0.08 },
            { id: "leatherCap", chance: 0.04 },
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