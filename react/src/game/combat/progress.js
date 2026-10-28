export const MAX_LEVEL = 30;

// 次のレベルまでに必要な経験値(Lv1→2: 40, Lv2→3: 70, Lv5→6: 280 ...)
export const xpToNext = (level) => 30 + level * level * 10;

// レベルから能力値を決める
export function statsFor(level) {
  return {
    maxHp: 100 + (level - 1) * 10,
    damageMul: 1 + (level - 1) * 0.08,
  };
}

export function createProgress() {
  return { level: 1, xp: 0 };
}

// 経験値を足して、上がったレベル数を返す
export function addXp(progress, amount) {
  let gained = 0;
  progress.xp += amount;
  while (progress.level < MAX_LEVEL && progress.xp >= xpToNext(progress.level)) {
    progress.xp -= xpToNext(progress.level);
    progress.level++;
    gained++;
  }
  if (progress.level >= MAX_LEVEL) progress.xp = 0;
  return gained;
}

// シーンから呼ぶ共通処理:経験値付与+演出+能力値の反映
export function grantXp(scene, player, amount) {
  const progress = scene.registry.get("progress");
  const levels = addXp(progress, amount);

  scene.popText(player.sprite.x, player.sprite.y - 90, `+${amount} XP`, "#ffee66");

  if (levels > 0) {
    player.applyStats(statsFor(progress.level));
    scene.popText(
      player.sprite.x, player.sprite.y - 120,
      `LEVEL UP! Lv${progress.level}`, "#ff99ff"
    );
  }
}