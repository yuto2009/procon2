import Phaser from "phaser";
import { ATTACKS } from "../combat/frameData";
import { WEAPONS, WEAPON_ORDER, DEFAULT_WEAPON } from "../combat/weaponData";

export default class WeaponSelectScene extends Phaser.Scene {
    constructor() {
        super("WeaponSelectScene");
    }

    create() {
        this.cameras.main.setBackgroundColor("#222222");

        this.add.text(400, 50, "武器を選んでください", {
            fontSize: "32px", color: "#ffffff", fontStyle: "bold",
        }).setOrigin(0.5);

        this.selected = Math.max(
            0,
            WEAPON_ORDER.indexOf(this.registry.get("weapon") ?? DEFAULT_WEAPON)
        );

        this.cards = WEAPON_ORDER.map((id, i) => {
            const x = 400 + (i - 1.5) * 190;
            const y = 290;
            const w = WEAPONS[id];
            const a = ATTACKS[id];

            const box = this.add.rectangle(x, y, 170, 280, 0x333333)
                .setInteractive({ useHandCursor: true });

            this.add.text(x, y - 110, w.name, {
                fontSize: "30px", color: "#ffffff", fontStyle: "bold",
            }).setOrigin(0.5);

            this.add.text(x, y - 55, w.desc, {
                fontSize: "16px", color: "#cccccc", align: "center",
            }).setOrigin(0.5);

            const stats =
                `攻撃力  ${a.damage}\n` +
                `射程    ${a.ranged ? "遠距離" : a.range}\n` +
                `発生    ${a.startup}F\n` +
                `スタミナ ${a.stamina}`;
            this.add.text(x, y + 60, stats, {
                fontSize: "15px", color: "#ffee99",
            }).setOrigin(0.5);

            box.on("pointerdown", () => this.select(i));
            return box;
        });

        const ok = this.add.text(400, 510, "決定", {
            fontSize: "28px", color: "#ffffff", backgroundColor: "#444444",
            padding: { left: 40, right: 40, top: 12, bottom: 12 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        ok.on("pointerover", () => ok.setStyle({ backgroundColor: "#666666" }));
        ok.on("pointerout", () => ok.setStyle({ backgroundColor: "#444444" }));
        ok.on("pointerdown", () => this.confirm());

        this.add.text(400, 570, "←→:選択  Enter:決定", {
            fontSize: "14px", color: "#aaaaaa",
        }).setOrigin(0.5);

        this.input.keyboard.on("keydown-LEFT", () => this.select(this.selected - 1));
        this.input.keyboard.on("keydown-RIGHT", () => this.select(this.selected + 1));
        this.input.keyboard.on("keydown-ENTER", () => this.confirm());

        this.refresh();
    }

    select(i) {
        const n = WEAPON_ORDER.length;
        this.selected = (i + n) % n;
        this.refresh();
    }

    refresh() {
        this.cards.forEach((box, i) => {
            if (i === this.selected) box.setStrokeStyle(4, 0xffee66);
            else box.setStrokeStyle(2, 0x666666);
        });
    }

    confirm() {
        this.registry.set("weapon", WEAPON_ORDER[this.selected]);
        this.scene.start("GameScene");
    }
}