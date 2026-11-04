
import Phaser from "phaser";
import { TILE, mergeRects } from "./mapgen";

// 画像の1タイルのサイズ

const TILE_SIZE = 16;
const SCALE = TILE / TILE_SIZE;

// 画像内のタイル番号
const ATLAS_COLS = 23;

const TILE_ID = {
    TOP_LEFT: 2 + 2 * ATLAS_COLS,       // 48
    TOP: 3 + 2 * ATLAS_COLS,            // 49
    TOP_RIGHT: 6 + 2 * ATLAS_COLS,      // 52

    LEFT: 2 + 3 * ATLAS_COLS,           // 71
    CENTER: 3 + 3 * ATLAS_COLS,         // 72
    RIGHT: 6 + 3 * ATLAS_COLS,          // 75

    BOTTOM_LEFT: 2 + 7 * ATLAS_COLS,    // 163
    BOTTOM: 3 + 7 * ATLAS_COLS,         // 164
    BOTTOM_RIGHT: 6 + 7 * ATLAS_COLS    // 167
};

function createDungeonTilemap(scene, map) {
    const { cols, rows, grid } = map;

    // 岩があるか調べる
    const isSolid = (c, r) => {
        if (c < 0 || r < 0 || c >= cols || r >= rows) {
            return false;
        }

        return grid[r * cols + c] === 1;
    };

    // 地形に合わせてタイルを選択
    const getTile = (c, r) => {

        const top = !isSolid(c, r - 1);
        const bottom = !isSolid(c, r + 1);
        const left = !isSolid(c - 1, r);
        const right = !isSolid(c + 1, r);

        // 四隅
        if (top && left) {
            return TILE_ID.TOP_LEFT;
        }

        if (top && right) {
            return TILE_ID.TOP_RIGHT;
        }

        if (bottom && left) {
            return TILE_ID.BOTTOM_LEFT;
        }

        if (bottom && right) {
            return TILE_ID.BOTTOM_RIGHT;
        }

        // 上下左右の端
        if (top) {
            return TILE_ID.TOP;
        }

        if (bottom) {
            return TILE_ID.BOTTOM;
        }

        if (left) {
            return TILE_ID.LEFT;
        }

        if (right) {
            return TILE_ID.RIGHT;
        }

        // 岩の内部
        return TILE_ID.CENTER;
    };

    // 1次元配列からTilemap用の2次元配列を作る
    const data = [];

    for (let r = 0; r < rows; r++) {
        const row = [];

        for (let c = 0; c < cols; c++) {

            if (!isSolid(c, r)) {
                row.push(-1);
            } else {
                row.push(getTile(c, r));
            }
        }

        data.push(row);
    }

    // Tilemap作成
    const tilemap = scene.make.tilemap({
        data,
        tileWidth: TILE_SIZE,
        tileHeight: TILE_SIZE
    });

    const tileset = tilemap.addTilesetImage(
        "dungeonTiles",
        "dungeonTiles",
        TILE_SIZE,
        TILE_SIZE,
        0,
        0
    );

    if (!tileset) {
        console.error("Tilesetの登録に失敗しました");
        return null;
    }

    const layer = tilemap.createLayer(
        0,
        tileset,
        0,
        0
    );

    layer.setScale(SCALE);
    layer.setDepth(-10);
    layer.setVisible(true);

    return layer;
}


// 洞窟の見た目と当たり判定を作る
export function buildCave(scene, map, theme) {

    // 1. 画像タイルで描画
    createDungeonTilemap(scene, map);

    // 2. 当たり判定
    // 従来のmergeRectsをそのまま使用
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

// たいまつ
export function buildTorches(scene, map, theme) {
    for (const c of map.torches) {
        const x = c * TILE + TILE / 2;
        const y = (map.path[c] + 1) * TILE;

        scene.add.rectangle(
            x,
            y - 10,
            8,
            20,
            0x8a7a68
        ).setDepth(-5);

        const glow = scene.add.circle(
            x, y - 28, 46, theme.torch, 0.12
        ).setDepth(-5);

        const flame = scene.add.circle(
            x, y - 26, 6, theme.torch, 1
        ).setDepth(-5);

        scene.tweens.add({
            targets: [flame, glow],
            scale: { from: 0.85, to: 1.2 },
            duration: Phaser.Math.Between(300, 600),
            yoyo: true,
            repeat: -1
        });
    }
}

// 画面のすみを暗くする
export function buildAtmosphere(scene, theme) {
    const key = "vignette";

    if (scene.textures.exists(key)) {
        scene.textures.remove(key);
    }

    const tex = scene.textures.createCanvas(
        key, 800, 600
    );

    const ctx = tex.getContext();

    const grad = ctx.createRadialGradient(
        400, 300, 110,
        400, 300, 520
    );

    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(
        1,
        `rgba(0,0,0,${theme.dark})`
    );

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    tex.refresh();

    scene.add.image(0, 0, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(9);

    // 漂う粒
    for (let i = 0; i < 30; i++) {
        const d = scene.add.circle(
            Math.random() * 800,
            Math.random() * 600,
            1.5,
            theme.dust,
            0.4
        )
            .setScrollFactor(0)
            .setDepth(8);

        scene.tweens.add({
            targets: d,
            x: `+=${Phaser.Math.Between(-60, 60)}`,
            y: `-=${Phaser.Math.Between(20, 80)}`,
            alpha: { from: 0.1, to: 0.55 },
            duration: Phaser.Math.Between(3000, 7000),
            yoyo: true,
            repeat: -1
        });
    }
}
