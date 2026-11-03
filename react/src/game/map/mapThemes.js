// 世界ごとの雰囲気。新しい世界はここに足すだけ
// gen: 地形の作り方(mapgen.js の設定を上書きする)
export const THEMES = {
    A: {
        name: "WORLD A - CAVE",
        back: 0x161f29,      // 洞窟の奥の壁(空洞の背景)
        rock: 0x4d5862,      // 岩の色
        edge: 0x9bb8b0,      // 岩の表面(上側)の明るい縁
        gate: 0x21152f,
        gateEdge: 0xc7a5ff,
        torch: 0xffa844,
        dark: 0.6,           // 画面のすみの暗さ(0〜1)
        dust: 0x9fd8ff,      // 漂う粒の色
        gen: { fill: 0.5, iterations: 4, tunnelH: 6 },
    },
    B: {
        name: "WORLD B - RUINS",
        back: 0x1d1530,
        rock: 0x5b4a6e,
        edge: 0xc4a8ff,
        gate: 0x2a1030,
        gateEdge: 0xff9de0,
        torch: 0xb884ff,
        dark: 0.75,
        dust: 0xd9a8ff,
        gen: { fill: 0.44, iterations: 5, tunnelH: 8 },   // より広く開けた空間
    },
};

export const getTheme = (worldId) => THEMES[worldId] ?? THEMES.A;
