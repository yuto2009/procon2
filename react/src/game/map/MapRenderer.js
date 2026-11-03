import Phaser from "phaser";
import { TILE, mergeRects } from "./mapgen";

// 色を明るく/暗くする(f=1で同じ、0.5で半分の明るさ)
function shade(color, f) {
    const r = Math.min(255, ((color >> 16) & 255) * f) | 0;
    const g = Math.min(255, ((color >> 8) & 255) * f) | 0;
    const b = Math.min(255, (color & 255) * f) | 0;
    return (r << 16) | (g << 8) | b;
}

// マスごとの決まった乱数(0〜1)。同じ場所は毎回同じ値になる
function hash(c, r, seed) {
    let x = Math.imul(c, 374761393) + Math.imul(r, 668265263) + seed;
    x = Math.imul(x ^ (x >>> 13), 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

// 洞窟の見た目と当たり判定を作る。戻り値の group をキャラと衝突させる
export function buildCave(scene, map, theme) {
    const { cols, rows, grid, seed } = map;
    const solid = (c, r) => c < 0 || r < 0 || c >= cols || r >= rows || grid[r * cols + c] === 1;

    // 1. 見た目:20列ずつ1枚の画像にする(軽くなり、画面外は描画されない)
    const CHUNK = 20;
    for (let c0 = 0; c0 < cols; c0 += CHUNK) {
        const c1 = Math.min(cols, c0 + CHUNK);
        const key = `cave_${c0}`;
        if (scene.textures.exists(key)) scene.textures.remove(key);

        const g = scene.make.graphics({ x: 0, y: 0, add: false });
        for (let r = 0; r < rows; r++) {
            for (let c = c0; c < c1; c++) {
                const x = (c - c0) * TILE, y = r * TILE;
                const h = hash(c, r, seed);

                if (!solid(c, r)) {
                    // 空洞:奥の壁を、少しムラをつけて塗る
                    g.fillStyle(shade(theme.back, 0.8 + h * 0.4), 1);
                    g.fillRect(x, y, TILE, TILE);
                    continue;
                }

                // 岩:空洞に近い(表面)ほど明るく、奥深いほど暗く
                let near = false;
                for (let dr = -2; dr <= 2 && !near; dr++)
                    for (let dc = -2; dc <= 2; dc++)
                        if (!solid(c + dc, r + dr)) { near = true; break; }

                g.fillStyle(shade(theme.rock, (near ? 0.85 : 0.5) + h * 0.3), 1);
                g.fillRect(x, y, TILE, TILE);

                if (!solid(c, r - 1)) {            // 上が空洞:明るい縁
                    g.fillStyle(theme.edge, 1);
                    g.fillRect(x, y, TILE, 4);
                }
                if (!solid(c, r + 1)) {            // 下が空洞:影
                    g.fillStyle(0x000000, 0.35);
                    g.fillRect(x, y + TILE - 4, TILE, 4);
                }
            }
        }
        g.generateTexture(key, (c1 - c0) * TILE, rows * TILE);
        g.destroy();
        scene.add.image(c0 * TILE, 0, key).setOrigin(0, 0).setDepth(-10);
    }

    // 2. 当たり判定:岩を大きな四角にまとめ、見えない四角を static group に入れる
    const group = scene.physics.add.staticGroup();
    for (const { c, r, w, h } of mergeRects(map)) {
        const rect = scene.add.rectangle(
            c * TILE + (w * TILE) / 2,
            r * TILE + (h * TILE) / 2,
            w * TILE,
            h * TILE
        );
        scene.physics.add.existing(rect, true);
        group.add(rect);
    }
    return group;
}

// たいまつ(炎がゆらぐ)
export function buildTorches(scene, map, theme) {
    for (const c of map.torches) {
        const x = c * TILE + TILE / 2;
        const y = (map.path[c] + 1) * TILE;       // 床の上
        scene.add.rectangle(x, y - 10, 8, 20, 0x8a7a68).setDepth(-5);
        const glow = scene.add.circle(x, y - 28, 46, theme.torch, 0.12).setDepth(-5);
        const flame = scene.add.circle(x, y - 26, 6, theme.torch, 1).setDepth(-5);
        scene.tweens.add({
            targets: [flame, glow],
            scale: { from: 0.85, to: 1.2 },
            duration: Phaser.Math.Between(300, 600),
            yoyo: true,
            repeat: -1,
        });
    }
}

// 画面のすみを暗くして、漂う粒を出す(雰囲気づくり)
export function buildAtmosphere(scene, theme) {
    const key = "vignette";
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, 800, 600);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(400, 300, 110, 400, 300, 520);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${theme.dark})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    tex.refresh();
    scene.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(9);

    for (let i = 0; i < 30; i++) {
        const d = scene.add
            .circle(Math.random() * 800, Math.random() * 600, 1.5, theme.dust, 0.4)
            .setScrollFactor(0)
            .setDepth(8);
        scene.tweens.add({
            targets: d,
            x: `+=${Phaser.Math.Between(-60, 60)}`,
            y: `-=${Phaser.Math.Between(20, 80)}`,
            alpha: { from: 0.1, to: 0.55 },
            duration: Phaser.Math.Between(3000, 7000),
            yoyo: true,
            repeat: -1,
        });
    }
}
