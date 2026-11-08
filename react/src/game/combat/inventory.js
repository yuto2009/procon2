// 持ち物・装備の処理(Phaserに依存しない普通のJavaScript)
import { ITEMS, EQUIP_SLOTS, MAX_DEFENSE } from "./itemData";
import { statsFor } from "./progress";

// 持ち物の形:
//   items:    { potion: 3, ... }              消耗品の個数
//   owned:    ["leatherCap", ...]             持っている装備
//   equipped: { head: id|null, body, accessory }
export function createInventory() {
    return {
        items: { potion: 3 },
        owned: ["leatherCap"],
        equipped: { head: null, body: null, accessory: null },
    };
}

// registry から取る。無ければ新しく作って保存する
export function getInventory(registry) {
    let inv = registry.get("inventory");
    if (!inv) {
        inv = createInventory();
        registry.set("inventory", inv);
    }
    return inv;
}

// アイテムを入手する。入手できたら true(装備の重複は入手しない)
export function addItem(inv, id, n = 1) {
    const it = ITEMS[id];
    if (!it) return false;
    if (it.type === "consumable") {
        inv.items[id] = (inv.items[id] ?? 0) + n;
        return true;
    }
    if (inv.owned.includes(id)) return false;
    inv.owned.push(id);
    return true;
}

// ドロップ表 [{ id, chance }] を抽選して、入手したアイテムidの配列を返す
export function rollDrops(inv, table = [], rng = Math.random) {
    const got = [];
    for (const d of table) {
        if (rng() < d.chance && addItem(inv, d.id)) got.push(d.id);
    }
    return got;
}

// その部位で持っている装備
export const ownedBySlot = (inv, slot) =>
    inv.owned.filter((id) => ITEMS[id]?.slot === slot);

export function equip(inv, id) {
    const it = ITEMS[id];
    if (!it || it.type !== "equip" || !inv.owned.includes(id)) return false;
    inv.equipped[it.slot] = id;
    return true;
}

export function unequip(inv, slot) {
    if (!EQUIP_SLOTS.includes(slot)) return false;
    inv.equipped[slot] = null;
    return true;
}

// 装備の効果を合計する
export function equipBonus(inv) {
    const sum = { maxHp: 0, maxStamina: 0, damageMul: 0, defense: 0 };
    for (const id of Object.values(inv.equipped)) {
        const b = ITEMS[id]?.bonus;
        if (!b) continue;
        for (const k of Object.keys(sum)) sum[k] += b[k] ?? 0;
    }
    return sum;
}

// レベル + 装備 → 最終的な能力値
export function computeStats(level, inv) {
    const base = statsFor(level);
    const b = equipBonus(inv);
    return {
        maxHp: Math.max(1, base.maxHp + b.maxHp),
        maxStamina: Math.max(20, base.maxStamina + b.maxStamina),
        damageMul: base.damageMul + b.damageMul,
        defense: Math.min(MAX_DEFENSE, Math.max(0, b.defense)),
    };
}

// 回復アイテムを使う。player は Fighter(hp / maxHp / stamina / maxStamina を持つもの)
export function useConsumable(inv, id, player) {
    const it = ITEMS[id];
    if (!it || it.type !== "consumable") return { ok: false, msg: "使えないアイテム" };
    if ((inv.items[id] ?? 0) <= 0) return { ok: false, msg: "持っていない" };
    if (player.hp <= 0 || player.state === "dead") return { ok: false, msg: "今は使えない" };

    const needHp = it.heal && player.hp < player.maxHp;
    const needSta = it.stamina && player.stamina < player.maxStamina;
    if (!needHp && !needSta) return { ok: false, msg: "使う必要がない" };

    if (it.heal) player.hp = Math.min(player.maxHp, player.hp + it.heal);
    if (it.stamina) player.stamina = Math.min(player.maxStamina, player.stamina + it.stamina);

    inv.items[id]--;
    if (inv.items[id] <= 0) delete inv.items[id];
    return { ok: true, msg: `${it.name}を使った` };
}

// Qキー用:小さい回復薬から順に使う
export function quickHeal(scene, player) {
    const inv = getInventory(scene.registry);
    const id = ["potion", "hiPotion"].find((i) => (inv.items[i] ?? 0) > 0);
    const x = player.sprite.x, y = player.sprite.y - 70;
    if (!id) return scene.popText(x, y, "回復薬がない", "#ff8888");
    const r = useConsumable(inv, id, player);
    scene.popText(x, y, r.msg, r.ok ? "#66ff99" : "#ff8888");
}