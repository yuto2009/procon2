
import Phaser from "phaser";
import { FX } from "./frameData";

const DEBUG = true;
const ART_FACING = 1;
const FOOT_OFFSET = 0;

const ARENA_LEFT = 500;
const ARENA_RIGHT = 1300;
const CEILING_Y = 150;
const GRAVITY = 0.8;

const DASH_TURN = 0.06;
const DASH_POSE_SPLIT = 0.6;
const DASH_CHANCE_NEAR = 0.2;
const DASH_CHANCE_FAR = 0.6;
const DASH_CHANCE_HIGH = 0.9;
const RETRY_WAIT = 1;

const SWITCH_CHANCE = 0.3;
const SWITCH_MID_CHANCE = 0.25;
const SWITCH_AT = 0.4;

const FAST_SLASH_CHANCE = 0.5;

const CLOSE_RANGE = 140;
const FOOT_CHANCE = 0.5;
const THRUST_CHANCE = 0.5;

const RAISED_OFFSET = 90;
const DASH_CHANCE_PLATFORM = 1;
const PLATFORM_STAY = 30;

const RAGE_HP_RATIO = 0.5;
const RAGE_DASH_MIN = 0.6;
const RUSH_COUNT = 3;
const TIRED_FRAMES = 150;

const DEAD_STAY = 90;
const DEAD_FADE = 60;

export const BOSS_ATTACKS = {
    slash: {
        startup: 30,
        active: 6,
        recovery: 20,
        range: 150,
        height: 170,
        lunge: 40,
        damage: 60,
        stamina: 0,
        hitstun: 25,
        knockback: 320,
        hitStop: 6,
        shake: 0.01,
    },

    foot: {
        foot: true,
        startup: 18,
        active: 5,
        recovery: 15,
        range: 90,
        height: 15,
        damage: 50,
        stamina: 0,
        hitstun: 25,
        knockback: 300,
        hitStop: 6,
        shake: 0.01,
    },

    thrust: {
        thrust: true,
        startup: 24,
        active: 8,
        recovery: 22,
        range: 90,
        height: 25,
        damage: 55,
        stamina: 0,
        hitstun: 25,
        knockback: 320,
        hitStop: 6,
        shake: 0.01,
    },

    // 突き刺し攻撃から飛んでいく衝撃波
    thrustShockwave: {
        shockwave: true,
        parryable: false,
        startup: 0,
        active: 1,
        recovery: 0,
        range: 100,
        height: 65,
        speed: 9,
        damage: 40,
        stamina: 0,
        hitstun: 20,
        knockback: 300,
        hitStop: 0,
        shake: 0.008,
    },

    dashSlash: {
        fast: true,
        startup: 8,
        active: 6,
        recovery: 20,
        range: 150,
        height: 170,
        lunge: 40,
        damage: 35,
        stamina: 0,
        hitstun: 25,
        knockback: 340,
        hitStop: 6,
        shake: 0.01,
    },

    dash: {
        dash: true,
        startup: 18,
        active: 22,
        recovery: 25,
        speed: 18,
        reach: 20,
        range: 0,
        height: 170,
        damage: 35,
        stamina: 0,
        hitstun: 25,
        knockback: 360,
        hitStop: 6,
        shake: 0.012,
    },
};

BOSS_ATTACKS.dashRush = {
    ...BOSS_ATTACKS.dash,
    startup: 8,
};

export const BS = {
    IDLE: "idle",
    TELEGRAPH: "telegraph",
    ACTIVE: "active",
    RECOVER: "recover",
    STUN: "stun",
    DEAD: "dead",
    TIRED: "tired",
};

const IDLE_WAIT = 90;
const AGGRO = 260;

export default class BossEnemy {
    constructor(scene, x, groundY, { texture = "boss", maxHp = 1000 } = {}) {
        this.scene = scene;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.groundY = groundY;

        const BODY_W = 165;
        const BODY_H = 170;

        this.sprite = scene.add
            .rectangle(x, groundY - BODY_H / 2, BODY_W, BODY_H, 0xff0000, 0.2)
            .setVisible(DEBUG)
            .setDepth(5);

        this.view = scene.add
            .image(x, groundY, texture)
            .setOrigin(0.5, 1)
            .setDisplaySize(200, 170)
            .setDepth(5);

        this.hitDebug = scene.add
            .rectangle(0, 0, 10, 10, 0xffffff, 0.35)
            .setVisible(false)
            .setDepth(6);

        // 左右それぞれの衝撃波画像
        this.shockwaveViews = [
            scene.add
                .image(0, 0, "boss_shockwave")
                .setDisplaySize(140, 75)
                .setDepth(7)
                .setVisible(false),
            scene.add
                .image(0, 0, "boss_shockwave")
                .setDisplaySize(140, 75)
                .setDepth(7)
                .setVisible(false),
        ];

        // 左右の衝撃波を独立して管理する
        this.shockwaves = [
            {
                active: false,
                x: 0,
                y: 0,
                direction: -1,
                hitSet: new Set(),
            },
            {
                active: false,
                x: 0,
                y: 0,
                direction: 1,
                hitSet: new Set(),
            },
        ];

        this.facing = -1;
        this.attack = null;
        this.target = null;
        this.aim = 0;
        this.vy = 0;
        this.chained = false;
        this.rushing = false;
        this.rushLeft = 0;
        this.stayFrames = new Map();
        this.stunFrames = 0;
        this.flashLeft = 0;
        this.hitSet = new Set();
        this.hitInfo = null;

        this.enter(BS.IDLE);
    }

    enter(state) {
        this.state = state;
        this.frame = 0;

        if (state === BS.ACTIVE || state === BS.RECOVER) {
            this.vy = 0;
        }

        if (state === BS.IDLE || state === BS.STUN || state === BS.TIRED) {
            this.chained = false;
            this.rushing = false;
            this.rushLeft = 0;
        }
    }

    trackPlatformTime(players) {
        for (const p of players) {
            const up = p.sprite.y < this.groundY - RAISED_OFFSET;
            this.stayFrames.set(
                p,
                up ? (this.stayFrames.get(p) ?? 0) + 1 : 0
            );
        }
    }

    pickTarget(players) {
        const alive = players.filter((p) => p.hp > 0);
        return alive.length
            ? alive[Math.floor(Math.random() * alive.length)]
            : null;
    }

    tick(players) {
        this.trackPlatformTime(players);

        const dashing = this.state === BS.ACTIVE && this.attack?.dash;
        const hover =
            this.chained &&
            (this.state === BS.TELEGRAPH || this.state === BS.ACTIVE);

        if (!dashing && !hover) {
            this.applyGravity();
        }

        if (this.state === BS.DEAD) {
            this.frame++;

            for (const s of this.shockwaves) {
                s.active = false;
            }

            return;
        }

        this.frame++;

        if (this.flashLeft > 0) {
            this.flashLeft--;
        }

        this.hitDebug.setVisible(false);
        this.hitInfo = null;

        switch (this.state) {
            case BS.IDLE:
                this.tickIdle(players);
                break;

            case BS.TELEGRAPH:
                if (this.attack?.dash) {
                    this.updateAim(false);
                }

                if (this.frame >= this.attack.startup) {
                    this.hitSet.clear();
                    this.enter(BS.ACTIVE);
                }
                break;

            case BS.ACTIVE:
                this.tickActive(players);
                break;

            case BS.RECOVER:
                if (this.frame >= this.attack.recovery) {
                    this.enter(BS.IDLE);
                }
                break;

            case BS.STUN:
                if (this.frame >= this.stunFrames) {
                    this.enter(BS.IDLE);
                }
                break;

            case BS.TIRED:
                if (this.frame >= TIRED_FRAMES) {
                    this.enter(BS.IDLE);
                }
                break;
        }

        // ボス本体とは独立して左右の衝撃波を動かす
        this.tickShockwaves(players);
    }

    tickIdle(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) return;

        this.facing =
            Math.sign(nearest.sprite.x - this.sprite.x) || this.facing;

        if (this.frame <= IDLE_WAIT) return;

        const target = this.pickTarget(players);
        if (!target) return;

        const dx = target.sprite.x - this.sprite.x;
        this.facing = Math.sign(dx) || this.facing;

        const far = Math.abs(dx) > AGGRO;
        const high =
            target.sprite.y < this.sprite.y - this.sprite.height / 2;
        const up = target.sprite.y < this.groundY - RAISED_OFFSET;
        const raised =
            up && (this.stayFrames.get(target) ?? 0) >= PLATFORM_STAY;
        const enraged = this.hp <= this.maxHp * RAGE_HP_RATIO;

        if (!high && !up && Math.abs(dx) <= CLOSE_RANGE) {
            const r = Math.random();

            if (r < FOOT_CHANCE) {
                this.attack = BOSS_ATTACKS.foot;
            } else if (r < FOOT_CHANCE + THRUST_CHANCE) {
                this.attack = BOSS_ATTACKS.thrust;
            }

            if (
                this.attack === BOSS_ATTACKS.foot ||
                this.attack === BOSS_ATTACKS.thrust
            ) {
                this.enter(BS.TELEGRAPH);
                return;
            }
        }

        let chance = high
            ? DASH_CHANCE_HIGH
            : raised
                ? DASH_CHANCE_PLATFORM
                : far
                    ? DASH_CHANCE_FAR
                    : DASH_CHANCE_NEAR;

        if (enraged) {
            chance = Math.max(chance, RAGE_DASH_MIN);
        }

        if (Math.random() < chance) {
            this.target = target;
            this.attack = BOSS_ATTACKS.dash;

            if (enraged) {
                this.rushing = true;
                this.rushLeft = RUSH_COUNT - 1;
            }

            this.updateAim(false);
            this.enter(BS.TELEGRAPH);
        } else if (!far && !high && !up) {
            this.attack = BOSS_ATTACKS.slash;
            this.enter(BS.TELEGRAPH);
        } else {
            this.frame = IDLE_WAIT - RETRY_WAIT;
        }
    }

    updateAim(limited) {
        const t = this.target;
        if (!t || t.hp <= 0) return;

        const desired = Math.atan2(
            t.sprite.y - this.sprite.y,
            t.sprite.x - this.sprite.x
        );

        if (!limited) {
            this.aim = desired;
        } else {
            const diff = Phaser.Math.Angle.Wrap(desired - this.aim);
            this.aim += Phaser.Math.Clamp(diff, -DASH_TURN, DASH_TURN);
        }

        this.facing = Math.sign(Math.cos(this.aim)) || this.facing;
    }

    maybeSwitchTarget(players) {
        if (this.frame !== Math.round(this.attack.active * SWITCH_AT)) {
            return;
        }

        const other = this.otherAlive(players, this.target);

        if (other && Math.random() < SWITCH_MID_CHANCE) {
            this.target = other;
        }
    }

    moveBody(dx, dy) {
        const half = this.sprite.width / 2;
        const floorY = this.groundY - this.sprite.height / 2;

        this.sprite.x = Phaser.Math.Clamp(
            this.sprite.x + dx,
            ARENA_LEFT + half,
            ARENA_RIGHT - half
        );

        this.sprite.y = Phaser.Math.Clamp(
            this.sprite.y + dy,
            CEILING_Y,
            floorY
        );
    }

    applyGravity() {
        const floorY = this.groundY - this.sprite.height / 2;

        if (this.sprite.y < floorY) {
            this.vy += GRAVITY;
            this.sprite.y = Math.min(floorY, this.sprite.y + this.vy);
        } else {
            this.sprite.y = floorY;
            this.vy = 0;
        }
    }

    tickActive(players) {
        const a = this.attack;

        // 突き刺し攻撃中に左右の衝撃波を一度だけ発射
        if (a.thrust && this.frame === 3) {
            this.spawnShockwaves();
        }

        if (a.dash) {
            this.maybeSwitchTarget(players);
            this.updateAim(true);
            this.moveBody(
                Math.cos(this.aim) * a.speed,
                Math.sin(this.aim) * a.speed
            );
        } else if (a.lunge) {
            this.moveBody(this.facing * a.lunge / a.active, 0);
        }

        const rect = this.hitRect(a);
        this.hitInfo = {
            x: rect.centerX,
            y: rect.centerY,
            w: rect.width,
            h: rect.height,
        };

        if (DEBUG) {
            this.hitDebug
                .setVisible(true)
                .setPosition(rect.centerX, rect.centerY)
                .setSize(rect.width, rect.height);
        }

        for (const p of players) {
            if (p.hp <= 0 || this.hitSet.has(p)) continue;

            if (
                Phaser.Geom.Intersects.RectangleToRectangle(
                    rect,
                    p.sprite.getBounds()
                )
            ) {
                this.hitSet.add(p);
                p.receiveHit(this, a);
            }
        }

        if (this.frame >= a.active) {
            if (a.dash && this.rushing) {
                if (this.rushLeft > 0) {
                    this.rushLeft--;
                    this.startRush(players);
                } else {
                    this.attack = null;
                    this.enter(BS.TIRED);
                }
            } else if (a.dash) {
                this.startFollowUp(players);
            } else if (a.foot && this.hitSet.size > 0) {
                this.startAfterStomp(players);
            } else {
                this.enter(BS.RECOVER);
            }
        }
    }

    // 左右の衝撃波を同時に発射する
    spawnShockwaves() {
        const a = BOSS_ATTACKS.thrustShockwave;
        const startX = this.sprite.x;
        const startY = this.groundY - a.height / 2;
        const startOffset = this.sprite.width / 2 + a.range / 2;

        for (const s of this.shockwaves) {
            s.active = true;
            s.direction = s.direction < 0 ? -1 : 1;
            s.x = startX + s.direction * startOffset;
            s.y = startY;
            s.hitSet.clear();
        }
    }

    // 左右の衝撃波をそれぞれ移動させて当たり判定する
    tickShockwaves(players) {
        const a = BOSS_ATTACKS.thrustShockwave;

        for (const s of this.shockwaves) {
            if (!s.active) continue;

            s.x += s.direction * a.speed;

            const rect = new Phaser.Geom.Rectangle(
                s.x - a.range / 2,
                s.y - a.height / 2,
                a.range,
                a.height
            );

            for (const p of players) {
                if (p.hp <= 0 || s.hitSet.has(p)) continue;

                if (
                    Phaser.Geom.Intersects.RectangleToRectangle(
                        rect,
                        p.sprite.getBounds()
                    )
                ) {
                    s.hitSet.add(p);
                    p.receiveHit(this, a);
                }
            }

            if (
                s.x < ARENA_LEFT - a.range ||
                s.x > ARENA_RIGHT + a.range
            ) {
                s.active = false;
            }
        }
    }

    startAfterStomp(players) {
        const target = this.pickTarget(players);

        if (!target) {
            this.enter(BS.RECOVER);
            return;
        }

        this.target = target;
        this.facing =
            Math.sign(target.sprite.x - this.sprite.x) || this.facing;

        const r = Math.random();

        if (r < 0.45) {
            this.attack = BOSS_ATTACKS.slash;
        } else if (r < 0.80) {
            this.attack = BOSS_ATTACKS.dash;
            this.updateAim(false);
        } else {
            this.attack = BOSS_ATTACKS.foot;
        }

        this.hitSet.clear();
        this.enter(BS.TELEGRAPH);
    }

    startFollowUp(players) {
        const target =
            this.target && this.target.hp > 0
                ? this.target
                : this.nearestAlive(players);

        if (!target) {
            this.enter(BS.RECOVER);
            return;
        }

        this.facing =
            Math.sign(target.sprite.x - this.sprite.x) || this.facing;

        this.attack =
            Math.random() < FAST_SLASH_CHANCE
                ? BOSS_ATTACKS.dashSlash
                : BOSS_ATTACKS.slash;

        this.hitSet.clear();
        this.enter(BS.TELEGRAPH);
        this.chained = true;
    }

    startRush(players) {
        const nearest = this.nearestAlive(players);

        if (!nearest) {
            this.enter(BS.RECOVER);
            return;
        }

        const other = this.otherAlive(players, nearest);
        this.target =
            other && Math.random() < SWITCH_CHANCE ? other : nearest;

        this.attack = BOSS_ATTACKS.dashRush;
        this.updateAim(false);
        this.hitSet.clear();
        this.enter(BS.TELEGRAPH);
        this.chained = true;
    }

    hitRect(a) {
        if (a.dash) {
            const b = this.sprite.getBounds();

            return new Phaser.Geom.Rectangle(
                b.x - a.reach,
                b.y,
                b.width + a.reach * 2,
                b.height
            );
        }

        if (a.thrust) {
            const bottom = this.sprite.y + this.sprite.height / 2;
            const left =
                this.facing > 0
                    ? this.sprite.x
                    : this.sprite.x - a.range;

            return new Phaser.Geom.Rectangle(
                left,
                bottom - a.height,
                a.range,
                a.height
            );
        }

        if (a.foot) {
            const half = this.sprite.width / 2;
            const bottom = this.sprite.y + this.sprite.height / 2;

            const left =
                this.facing > 0
                    ? this.sprite.x - half
                    : this.sprite.x - half - a.range;

            return new Phaser.Geom.Rectangle(
                left,
                bottom - a.height,
                half * 2 + a.range,
                a.height
            );
        }

        const half = this.sprite.width / 2;
        const cx = this.sprite.x + this.facing * (half + a.range / 2);
        const bottom = this.sprite.y + this.sprite.height / 2;

        return new Phaser.Geom.Rectangle(
            cx - a.range / 2,
            bottom - a.height,
            a.range,
            a.height
        );
    }

    nearestAlive(players) {
        let best = null;
        let bestDist = Infinity;

        for (const p of players) {
            if (p.hp <= 0) continue;

            const d = Math.abs(p.sprite.x - this.sprite.x);

            if (d < bestDist) {
                best = p;
                bestDist = d;
            }
        }

        return best;
    }

    otherAlive(players, exclude) {
        return players.find((p) => p !== exclude && p.hp > 0) ?? null;
    }

    getSyncData() {
        let attackName = null;

        for (const [name, a] of Object.entries(BOSS_ATTACKS)) {
            if (a === this.attack) {
                attackName = name;
                break;
            }
        }

        return {
            x: Math.round(this.sprite.x),
            y: Math.round(this.sprite.y),
            facing: this.facing,
            state: this.state,
            attack: attackName,
            frame: this.frame,
            aim: Math.round(this.aim * 1000) / 1000,
            flash: this.flashLeft,
            hp: this.hp,
            maxHp: this.maxHp,
            hit: this.hitInfo,

            // 左右両方の衝撃波の状態をゲストへ送る
            shockwaves: this.shockwaves.map((s) => ({
                active: s.active,
                x: Math.round(s.x),
                y: Math.round(s.y),
                direction: s.direction,
            })),
        };
    }

    // ゲスト側で受信した衝撃波の状態を反映
    syncShockwaves(data) {
        if (!Array.isArray(data)) return;

        for (let i = 0; i < this.shockwaves.length; i++) {
            const source = data[i];
            const target = this.shockwaves[i];

            if (!source) {
                target.active = false;
                continue;
            }

            target.active = Boolean(source.active);
            target.x = source.x;
            target.y = source.y;
            target.direction = source.direction < 0 ? -1 : 1;
        }
    }

    receiveHit(attacker, a) {
        if (this.state === BS.DEAD) return;

        if (this.mirror) {
            this.scene.events.emit("hit", this, attacker, a);
            this.onMirrorHit?.(attacker, a);
            return;
        }

        this.hp = Math.max(0, this.hp - a.damage);
        this.flashLeft = FX.flashFrames;
        this.scene.events.emit("hit", this, attacker, a);

        if (this.hp <= 0) {
            this.attack = null;
            this.enter(BS.DEAD);

            for (const s of this.shockwaves) {
                s.active = false;
            }

            this.scene.events.emit("bossdead", this);
        }
    }

    stun(frames) {
        if (this.mirror) return;
        if (this.state === BS.DEAD) return;

        this.stunFrames = frames;
        this.attack = null;
        this.enter(BS.STUN);
    }

    textureKey() {
        if (this.state === BS.DEAD) return "boss_dead";
        if (this.state === BS.STUN) return "boss_parystun";
        if (this.state === BS.TIRED) return "boss_stun";

        const a = this.attack;

        if (a && a.dash) {
            if (this.state === BS.TELEGRAPH) return "boss_dash";

            if (this.state === BS.ACTIVE) {
                return this.frame < a.active * DASH_POSE_SPLIT
                    ? "boss_dash"
                    : "boss_dashattack";
            }

            if (this.state === BS.RECOVER) return "boss_dashattack";
        } else if (a && a.fast) {
            if (
                this.state === BS.TELEGRAPH ||
                this.state === BS.ACTIVE ||
                this.state === BS.RECOVER
            ) {
                return "boss_dashattack";
            }
        } else if (a && a.thrust) {
            if (this.state === BS.TELEGRAPH) return "boss_thrustwait";

            if (
                this.state === BS.ACTIVE ||
                this.state === BS.RECOVER
            ) {
                return "boss_thrustattack";
            }
        } else if (a && a.foot) {
            if (this.state === BS.TELEGRAPH) return "boss_footwait";

            if (
                this.state === BS.ACTIVE ||
                this.state === BS.RECOVER
            ) {
                return "boss_footattack";
            }
        } else if (a) {
            if (this.state === BS.TELEGRAPH) return "boss_stance";

            if (
                this.state === BS.ACTIVE ||
                this.state === BS.RECOVER
            ) {
                return "boss_swing";
            }
        }

        return "boss";
    }

    render() {
        // 衝撃波画像を左右それぞれの状態に合わせて表示する
        for (let i = 0; i < this.shockwaves.length; i++) {
            const wave = this.shockwaves[i];
            const view = this.shockwaveViews[i];

            view
                .setVisible(wave.active)
                .setPosition(wave.x, wave.y)
                .setFlipX(wave.direction < 0);
        }

        const v = this.view;
        const dashing = this.state === BS.ACTIVE && this.attack?.dash;

        if (dashing) {
            const angle = Math.atan2(
                Math.sin(this.aim),
                Math.abs(Math.cos(this.aim))
            );

            v.setOrigin(0.5, 0.5)
                .setPosition(this.sprite.x, this.sprite.y)
                .setRotation(angle * this.facing);
        } else {
            v.setOrigin(0.5, 1)
                .setRotation(0)
                .setPosition(
                    this.sprite.x,
                    this.sprite.y + this.sprite.height / 2 + FOOT_OFFSET
                );
        }

        v.setFlipX(this.facing !== ART_FACING);

        const texKey = this.textureKey();

        if (v.texture.key !== texKey) {
            v.setTexture(texKey).setDisplaySize(200, 170);
        }

        if (this.state === BS.DEAD) {
            v.clearTint();

            const fade = Phaser.Math.Clamp(
                (this.frame - DEAD_STAY) / DEAD_FADE,
                0,
                1
            );

            v.setAlpha(1 - fade);

            if (fade >= 1) {
                v.setVisible(false);
                this.sprite.setVisible(false);
            }

            return;
        }

        if (this.flashLeft > 0) {
            v.setTintFill(0xffffff);
            return;
        }

        switch (this.state) {
            case BS.TELEGRAPH:
                v.setTint(0xffee66);
                break;

            case BS.ACTIVE:
                v.setTint(0xff5555);
                break;

            case BS.STUN:
            case BS.TIRED:
                v.clearTint();
                break;

            default:
                v.clearTint();
        }
    }
}
