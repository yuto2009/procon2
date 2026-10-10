import { FPS, MOVE, STAMINA, ATTACKS, PARRY, DODGE, BUFFER } from "../combat/frameData";

const ATTACK_KEYS = [
  "startup",
  "active",
  "recovery",
  "range",
  "damage",
  "stamina",
  "hitstun",
  "knockback",
];

const GROUPS = [
  ["剣 sword", ATTACKS.sword, ATTACK_KEYS],
  ["拳 fist", ATTACKS.fist, ATTACK_KEYS],
  [
    "敵の斬撃 enemySlash",
    ATTACKS.enemySlash,
    ["startup", "active", "recovery", "range", "damage"],
  ],
  [
    "パリィ PARRY",
    PARRY,
    ["window", "recovery", "stamina", "staminaGain", "enemyStun"],
  ],
  ["回避 DODGE", DODGE, ["frames", "iframes", "speed", "stamina"]],
  [
    "スタミナ STAMINA",
    STAMINA,
    ["regenPerFrame", "regenDelay", "exhaustFrames"],
  ],
  ["移動 MOVE", MOVE, ["speed", "jump"]],
  ["入力バッファ BUFFER", BUFFER, ["frames"]],
];

const fmt = (o) =>
  "{ " +
  Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") +
  " }";

function exportText() {
  return [
    `export const FPS = ${FPS};`,
    ``,
    `export const MOVE = ${fmt(MOVE)};`,
    ``,
    `export const STAMINA = ${fmt(STAMINA)};`,
    ``,
    `export const BUFFER = ${fmt(BUFFER)};`,
    ``,
    `export const ATTACKS = {`,
    ...Object.entries(ATTACKS).map(([k, v]) => `    ${k}: ${fmt(v)},`),
    `};`,
    ``,
    `export const PARRY = ${fmt(PARRY)};`,
    ``,
    `export const DODGE = ${fmt(DODGE)};`,
    ``,
  ].join("\n");
}

export function createTuningPanel() {
  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "fixed",
    top: "8px",
    right: "8px",
    width: "250px",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "rgba(0,0,0,0.88)",
    color: "#ddd",
    font: "12px monospace",
    padding: "8px",
    zIndex: 1000,
    display: "none",
  });

  const title = document.createElement("div");
  title.textContent = "チューニング (Tで開始)";
  title.style.cssText = "font-weight:bold;margin-bottom:6px";
  root.appendChild(title);

    for (const [label, obj, keys] of GROUPS) {
    // グループの見出し
    const h = document.createElement("div");
    h.textContent = label;
    h.style.cssText =
      "margin:8px 0 3px;color:#7cf;border-bottom:1px solid #444;";
    root.appendChild(h);

    // 各項目(ここが抜けていた内側のループ)
    for (const key of keys) {
      const row = document.createElement("label");
      row.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;margin:2px 0;";
      row.appendChild(document.createTextNode(key));

      const input = document.createElement("input");
      input.type = "number";
      input.value = obj[key];
      input.step = Number.isInteger(obj[key]) ? 1 : 0.1;
      input.style.cssText =
        "width:80px;background:#222;color:#fff;border:1px solid #555;";
      input.addEventListener("input", () => {
        const n = parseFloat(input.value);
        if (!Number.isNaN(n)) obj[key] = n; // 共有オブジェクトを直接書き換えるので即反映
      });
      row.appendChild(input);
      root.appendChild(row);
    }
  }

  const copy = document.createElement("button");
  copy.textContent = "frameData.js用にコピー";
  copy.style.cssText = "margin-top:10px;width:100%;padding:6px;cursor:pointer;";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(exportText());
      copy.textContent = "コピーしました";
    } catch {
      console.log(exportText());
      copy.textContent = "consoleに出力しました";
    }
    setTimeout(() => (copy.textContent = "frameData.js用にコピー"), 1500);
  });
  root.appendChild(copy);
  document.body.appendChild(root);

  return {
    toggle() {
      root.style.display = root.style.display === "none" ? "block" : "none";
    },
    destroy() {
      root.remove();
    },
  };
}
