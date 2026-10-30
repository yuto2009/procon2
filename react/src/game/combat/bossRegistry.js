import Boss1 from "./Boss1";
import Boss2 from "./Boss2";
// import Boss2 from "./Boss2";
 
// ボスの種類 → クラス。新しいボスはここに足すだけ
//ボス１
export const BOSSES = {
    boss1: Boss1,
    // boss2: Boss2,
    boss2 : Boss2,
}
 
export function getBossClass(type) {
    return BOSSES[type] ?? BOSSES.boss1;
}