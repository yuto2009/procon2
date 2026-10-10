export const FPS = 60;

export const MOVE = {speed: 220, jump: 520};

export const BUFFER = {frames: 8};

export const STAMINA = {max: 100, regenPerFrame: 0.6, regenDelay: 40, exhaustFrames:60};

export const ATTACKS = {
    sword: {startup: 9, active: 4, recovery: 20, range: 64, height: 44, damage: 20, stamina: 22, hitstun: 18, knockback: 260},
    fist : {startup: 3, active: 2, recovery: 7, range: 28, height: 36, damage: 6, stamina: 8, hitstun: 10, knockback: 120},
    enemySlash: {startup: 24, active: 4, recovery: 30, range: 64, height: 44, damage: 15, stamina: 0, hitstun: 20, knockback: 240},
};

export const PARRY = {window: 12, recovery: 24, stamina: 15, staminaGain: 30, enemyStun: 60};

export const DODGE = {frames: 18, iframes: 10, speed: 380, stamina: 18};