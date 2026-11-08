import Phaser from "phaser";
import { ITEMS, EQUIP_SLOTS, SLOT_NAMES, RARITY_COLOR, bonusText } from "../combat/itemData";
import {
    getInventory, useConsumable, equip, unequip, ownedBySlot, equipBonus,
} from "../combat/inventory";
import { xpToNext, MAX_LEVEL } from "../combat/progress";
import { WEAPONS } from "../combat/weaponData";

const TABS = ["アイテム", "装備", "ステータス"];
const wrap = (i, n) => (n <= 0 ? 0 : (i + n) % n);

// ゲームの上に重ねて表示するメニュー。呼び出し元のシーンは止まっている
export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
    }

    init(data) {
        this.owner = data.owner;   // 呼び出し元のシーン名
        this.tab = 0;              // 0:アイテム 1:装備 2:ステータス
        this.cursor = 0;           // リストの選択位置
        this.slot = 0;             // 装備タブ:選んでいる部位
        this.col = 0;              // 装備タブ:0=部位を選ぶ 1=持ち物を選ぶ
        this.msg = "";
    }

    create() {
        this.ownerScene = this.scene.get(this.owner);
        this.inv = getInventory(this.registry);
        this.openedAt = performance.now();

        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85);
        this.add.rectangle(400, 310, 760, 520, 0x15131c, 0.95).setStrokeStyle(2, 0x6a5a8a);
        this.ui = this.add.container(0, 0);

        const kb = this.input.keyboard;
        kb.on("keydown-UP", () => this.move(-1));
        kb.on("keydown-DOWN", () => this.move(1));
        kb.on("keydown-LEFT", () => this.side(-1));
        kb.on("keydown-RIGHT", () => this.side(1));
        kb.on("keydown-ENTER", () => this.decide());
        kb.on("keydown-Q", () => this.changeTab(-1));
        kb.on("keydown-E", () => this.changeTab(1));
        kb.on("keydown-ESC", () => this.back());

        this.render();
    }

    // ───────── 操作 ─────────

    currentList() {
        if (this.tab === 0) {
            return Object.keys(ITEMS).filter((id) => (this.inv.items[id] ?? 0) > 0);
        }
        if (this.tab === 1) {
            return [null, ...ownedBySlot(this.inv, EQUIP_SLOTS[this.slot])];   // null = はずす
        }
        return [];
    }

    move(d) {
        if (this.tab === 1 && this.col === 0) {
            this.slot = wrap(this.slot + d, EQUIP_SLOTS.length);
        } else {
            this.cursor = wrap(this.cursor + d, this.currentList().length);
        }
        this.render();
    }

    side(d) {
        if (this.tab !== 1) return;
        if (d > 0 && this.col === 0) {
            this.col = 1;
            const now = this.inv.equipped[EQUIP_SLOTS[this.slot]];
            this.cursor = Math.max(0, this.currentList().indexOf(now));   // 今の装備に合わせる
        } else if (d < 0 && this.col === 1) {
            this.col = 0;
        }
        this.render();
    }

    changeTab(d) {
        this.tab = wrap(this.tab + d, TABS.length);
        this.cursor = 0;
        this.col = 0;
        this.msg = "";
        this.render();
    }

    decide() {
        const player = this.ownerScene.player;

        if (this.tab === 0) {
            const id = this.currentList()[this.cursor];
            if (!id) return;
            const r = useConsumable(this.inv, id, player);
            this.msg = r.msg;
            this.cursor = Math.min(this.cursor, Math.max(0, this.currentList().length - 1));
        } else if (this.tab === 1) {
            if (this.col === 0) return this.side(1);
            const slot = EQUIP_SLOTS[this.slot];
            const id = this.currentList()[this.cursor];
            if (id === null) {
                unequip(this.inv, slot);
                this.msg = `${SLOT_NAMES[slot]}の装備をはずした`;
            } else {
                equip(this.inv, id);
                this.msg = `${ITEMS[id].name}を装備した`;
            }
            this.ownerScene.refreshStats();   // 能力値を作り直す
        }
        this.render();
    }

    back() {
        if (performance.now() - this.openedAt < 250) return;   // 開いた時のESCで閉じないように
        if (this.tab === 1 && this.col === 1) {
            this.col = 0;
            return this.render();
        }
        this.scene.resume(this.owner);
        this.scene.stop();
    }

    // ───────── 描画(変わるたびに作り直す) ─────────

    render() {
        this.ui.removeAll(true);

        const text = (x, y, s, color = "#ffffff", size = 20) => {
            const t = this.add.text(x, y, s, { fontSize: `${size}px`, color, lineSpacing: 6 });
            this.ui.add(t);
            return t;
        };
        // クリックできる行。同じ行をもう一度押すと決定
        const row = (x, y, s, color, onClick) => {
            const t = text(x, y, s, color);
            t.setInteractive({ useHandCursor: true });
            t.on("pointerdown", onClick);
            return t;
        };

        // タブ
        TABS.forEach((name, i) => {
            const t = text(60 + i * 180, 40, name, i === this.tab ? "#ffee66" : "#777777", 24);
            t.setInteractive({ useHandCursor: true });
            t.on("pointerdown", () => this.changeTab(i - this.tab));
        });

        if (this.tab === 0) this.renderItems(text, row);
        if (this.tab === 1) this.renderEquip(text, row);
        if (this.tab === 2) this.renderStatus(text);

        text(60, 515, this.msg, "#ffee66");
        const hint = [
            "↑↓:選択  Enter:使う  Q/E:タブ  ESC:閉じる",
            "↑↓:選択  →/Enter:決定  ←:戻る  Q/E:タブ  ESC:戻る",
            "Q/E:タブ  ESC:閉じる",
        ][this.tab];
        text(60, 548, hint, "#888888", 15);
    }

    renderItems(text, row) {
        const list = this.currentList();
        text(60, 95, "所持アイテム", "#aaaaaa", 16);
        if (!list.length) text(80, 135, "アイテムを持っていない", "#777777");

        list.forEach((id, i) => {
            const it = ITEMS[id];
            const sel = i === this.cursor;
            row(80, 130 + i * 34, `${sel ? "▶ " : "   "}${it.name}  x${this.inv.items[id]}`,
                sel ? "#ffee66" : RARITY_COLOR[it.rarity],
                () => (sel ? this.decide() : ((this.cursor = i), this.render())));
        });

        const cur = list[this.cursor];
        if (cur) {
            text(430, 130, ITEMS[cur].name, RARITY_COLOR[ITEMS[cur].rarity], 24);
            text(430, 175, ITEMS[cur].desc, "#ccccff");
        }
    }

    renderEquip(text, row) {
        text(60, 95, "装備", "#aaaaaa", 16);
        EQUIP_SLOTS.forEach((slot, i) => {
            const id = this.inv.equipped[slot];
            const sel = i === this.slot;
            const mark = sel ? (this.col === 0 ? "▶ " : "● ") : "   ";
            row(80, 130 + i * 40, `${mark}${SLOT_NAMES[slot]}:${id ? ITEMS[id].name : "なし"}`,
                sel ? "#ffee66" : "#ffffff",
                () => { this.slot = i; this.col = 0; this.render(); });
        });

        // 右側:その部位の持ち物
        const slot = EQUIP_SLOTS[this.slot];
        const list = this.currentList();
        text(430, 95, `${SLOT_NAMES[slot]}の持ち物`, "#aaaaaa", 16);
        list.forEach((id, i) => {
            const sel = this.col === 1 && i === this.cursor;
            const worn = id !== null && this.inv.equipped[slot] === id;
            const label = id === null ? "はずす" : `${ITEMS[id].name}${worn ? "  [装備中]" : ""}`;
            row(450, 130 + i * 34, `${sel ? "▶ " : "   "}${label}`,
                sel ? "#ffee66" : id ? RARITY_COLOR[ITEMS[id].rarity] : "#aaaaaa",
                () => {
                    if (this.col === 1 && i === this.cursor) return this.decide();
                    this.col = 1; this.cursor = i; this.render();
                });
        });

        // 下:効果の説明と合計
        const focus = this.col === 1 ? list[this.cursor] : this.inv.equipped[slot];
        text(60, 330, focus ? `${ITEMS[focus].name}:${bonusText(ITEMS[focus].bonus)}` : "", "#ccccff");
        text(60, 400, `装備の合計  ${bonusText(equipBonus(this.inv))}`, "#88ddaa", 18);
    }

    renderStatus(text) {
        const p = this.registry.get("progress");
        const pl = this.ownerScene.player;
        const xp = p.level >= MAX_LEVEL ? "MAX" : `${p.xp} / ${xpToNext(p.level)}`;
        const lines = [
            `レベル      ${p.level}      経験値 ${xp}`,
            `HP          ${Math.ceil(pl.hp)} / ${pl.maxHp}`,
            `スタミナ    ${Math.floor(pl.stamina)} / ${pl.maxStamina}`,
            `攻撃倍率    x${pl.damageMul.toFixed(2)}`,
            `防御        ${Math.round((pl.defense ?? 0) * 100)}%  (受けるダメージを軽減)`,
            `武器        ${WEAPONS[pl.weapon]?.name ?? pl.weapon}`,
        ];
        lines.forEach((s, i) => text(80, 110 + i * 44, s));
    }
}