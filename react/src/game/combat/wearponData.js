// 武器の表示用データ。id は ATTACKS のキーと同じにする
export const WEAPONS = {
    sword: { name: "剣",   desc: "バランス型\n扱いやすい" },
    spear: { name: "槍",   desc: "リーチが長く\n素早い\n1発は軽い" },
    tachi: { name: "太刀", desc: "重い一撃\n隙が大きい" },
    bow:   { name: "弓",   desc: "遠くから射抜く\n威力は低め" },
};

export const WEAPON_ORDER = ["sword", "spear", "tachi", "bow"];
export const DEFAULT_WEAPON = "sword";