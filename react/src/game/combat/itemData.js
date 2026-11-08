// アイテムの一覧。新しいアイテムはここに足すだけ
//   consumable: 使うと消える(回復薬など)
//   equip     : 装備品(slot の部位に1つだけ付けられる)
//   bonus     : 装備の効果  maxHp / maxStamina / damageMul は足し算、defense は被ダメージ軽減の割合(0.1 = 10%)

export const EQUIP_SLOTS = ["head", "body", "accessory"];
export const SLOT_NAMES = { head: "頭", body: "胴", accessory: "装飾" };
export const RARITY_COLOR = { 1: "#ffffff", 2: "#66bbff", 3: "#ffcc44" };
export const MAX_DEFENSE = 0.75;   // 軽減の上限(これ以上は盛れない)

export const ITEMS = {
    // ── 回復アイテム ──
    potion:   { type: "consumable", name: "回復薬",     desc: "HPを50回復する",       heal: 50,  rarity: 1 },
    hiPotion: { type: "consumable", name: "上回復薬",   desc: "HPを150回復する",      heal: 150, rarity: 2 },
    tonic:    { type: "consumable", name: "スタミナ薬", desc: "スタミナを全回復する", stamina: 9999, rarity: 1 },

    // ── 頭 ──
    leatherCap: { type: "equip", slot: "head", name: "革の帽子", rarity: 1, bonus: { defense: 0.05 } },
    ironHelm:   { type: "equip", slot: "head", name: "鉄の兜",   rarity: 2, bonus: { defense: 0.10, maxHp: 10 } },

    // ── 胴 ──
    leatherArmor: { type: "equip", slot: "body", name: "革の鎧",     rarity: 1, bonus: { defense: 0.08, maxHp: 20 } },
    chainMail:    { type: "equip", slot: "body", name: "鎖かたびら", rarity: 2, bonus: { defense: 0.15, maxHp: 30, maxStamina: -10 } },

    // ── 装飾 ──
    powerRing:    { type: "equip", slot: "accessory", name: "力の指輪",     rarity: 2, bonus: { damageMul: 0.15 } },
    staminaCharm: { type: "equip", slot: "accessory", name: "活力のお守り", rarity: 2, bonus: { maxStamina: 30 } },
};

// 装備の効果を、読みやすい文字にする
export function bonusText(b = {}) {
    const parts = [];
    if (b.defense)    parts.push(`防御 ${b.defense > 0 ? "+" : ""}${Math.round(b.defense * 100)}%`);
    if (b.maxHp)      parts.push(`HP ${b.maxHp > 0 ? "+" : ""}${b.maxHp}`);
    if (b.maxStamina) parts.push(`スタミナ ${b.maxStamina > 0 ? "+" : ""}${b.maxStamina}`);
    if (b.damageMul)  parts.push(`攻撃 ${b.damageMul > 0 ? "+" : ""}${Math.round(b.damageMul * 100)}%`);
    return parts.length ? parts.join("   ") : "効果なし";
}