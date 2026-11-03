// 洞窟マップの生成(Phaserに依存しない普通のJavaScript)
// 同じ seed + 同じ設定 なら、必ず同じマップになる

export const TILE = 32;
export const GENERATOR_VERSION = 1;

// 乱数(mulberry32)。Math.random の代わりに使うと、seed で再現できる
export function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DEFAULTS = {
    cols: 160,          // 横のタイル数(160 x 32px = 5120px)
    rows: 40,           // 縦のタイル数(40 x 32px = 1280px)
    fill: 0.46,         // 最初に岩で埋める割合(大きいほど狭い洞窟)
    iterations: 4,      // 洞窟をなめらかにする回数
    tunnelH: 6,         // メイン通路の高さ(タイル)
    stepChance: 0.35,   // 通路の高さが1段変わる確率
    minRun: 4,          // 段差と段差の間に空ける最小の幅(ジャンプで越えられる)
    roomGap: [28, 46],  // 大広間の間隔
    roomRx: [5, 9],    // 大広間の半径(横)
    roomRy: [3, 8],     // 大広間の天井の高さ(追加分)
    flatStart: 12,      // 最初の平坦区間
    flatEnd: 16,        // 最後の平坦区間(ボス門がある)
};

export function generateCave(seed, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const { cols, rows } = o;
    const rng = makeRng(seed);
    const rand = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const idx = (c, r) => r * cols + c;

    // 1. ランダムに岩を置く(外周2マスは必ず岩)
    let grid = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const border = c < 2 || r < 2 || c >= cols - 2 || r >= rows - 2;
            grid[idx(c, r)] = border || rng() < o.fill ? 1 : 0;
        }
    }

    // 2. セルオートマトン:周りが岩だらけなら岩、少なければ空洞 → 洞窟っぽい形になる
    for (let it = 0; it < o.iterations; it++) {
        const next = new Uint8Array(grid.length);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let n = 0;
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        const cc = c + dc, rr = r + dr;
                        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || grid[idx(cc, rr)]) n++;
                    }
                }
                next[idx(c, r)] = n >= 5 ? 1 : n <= 3 ? 0 : grid[idx(c, r)];
            }
        }
        grid = next;
    }

    // 3. メイン通路の高さを決める(path[c] = 足が乗る空洞の一番下の行)
    //    1段ずつ、minRun 列以上あけて上下する → ジャンプで必ず越えられる
    const H = o.tunnelH;
    const minRow = H + 4;
    const maxRow = rows - 6;
    const mid = Math.floor(rows * 0.55);
    const path = new Array(cols);
    let cur = mid, run = 0;
    for (let c = 0; c < cols; c++) {
        if (c >= o.flatStart && c < cols - o.flatEnd) {
            run++;
            if (run >= o.minRun && rng() < o.stepChance) {
                let dir = rng() < 0.5 ? -1 : 1;
                if (Math.abs(cur - mid) > 8 && rng() < 0.7) dir = cur > mid ? -1 : 1; // 中央へ戻す
                if (cur <= minRow) dir = 1;
                if (cur >= maxRow) dir = -1;
                cur += dir;
                run = 0;
            }
        }
        path[c] = cur;
    }

    // 4. 通路をくり抜く
    for (let c = 2; c < cols - 2; c++) {
        for (let r = path[c] - H + 1; r <= path[c]; r++) grid[idx(c, r)] = 0;
    }

    // 5. 大広間:通路の天井を楕円形に高くする(床は変えない)
    let cx = rand(24, 30);
    while (cx < cols - o.flatEnd - 8) {
        const rx = rand(...o.roomRx);
        const ry = rand(...o.roomRy);
        for (let c = cx - rx; c <= cx + rx; c++) {
            if (c < 3 || c >= cols - 3) continue;
            const k = 1 - ((c - cx) / rx) ** 2;
            if (k <= 0) continue;
            const extra = Math.round(ry * Math.sqrt(k));
            const top = Math.max(3, path[c] - H + 1 - extra);
            for (let r = top; r <= path[c]; r++) grid[idx(c, r)] = 0;
        }
        cx += rand(...o.roomGap);
    }

    // 6. 通路の床を2マスの厚みで必ず岩にする(穴・落とし穴を作らない)
    for (let c = 2; c < cols - 2; c++) {
        grid[idx(c, path[c] + 1)] = 1;
        grid[idx(c, path[c] + 2)] = 1;
    }

    // 7. 敵・たいまつの置き場所(通路の列番号)
    const gateCol = cols - 12;
    const spots = [];
    for (let c = rand(26, 34); c < gateCol - 10; c += rand(14, 26)) spots.push(c);
    const torches = [];
    for (let c = rand(8, 14); c < cols - 6; c += rand(12, 20)) torches.push(c);

    return {
        seed, cols, rows, grid, path, spots, torches, gateCol,
        startCol: 6,
        width: cols * TILE,
        height: rows * TILE,
    };
}

// 指定したx座標(ピクセル)の、通路の床の上端のy座標
export function groundY(map, x) {
    const c = Math.max(0, Math.min(map.cols - 1, Math.floor(x / TILE)));
    return (map.path[c] + 1) * TILE;
}

// 岩のタイルを大きな四角にまとめる(当たり判定の数を減らすため)
export function mergeRects(map) {
    const { cols, rows, grid } = map;
    const used = new Uint8Array(cols * rows);
    const ok = (c, r) => grid[r * cols + c] === 1 && !used[r * cols + c];
    const rects = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!ok(c, r)) continue;
            let w = 1;
            while (c + w < cols && ok(c + w, r)) w++;
            let h = 1;
            outer: while (r + h < rows) {
                for (let k = 0; k < w; k++) if (!ok(c + k, r + h)) break outer;
                h++;
            }
            for (let dr = 0; dr < h; dr++)
                for (let dc = 0; dc < w; dc++) used[(r + dr) * cols + c + dc] = 1;
            rects.push({ c, r, w, h });
        }
    }
    return rects;
}
