import Phaser from "phaser";
import BaseBoss, { BS } from "./BaseBoss";

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
const DASH_CHANCE_PLATFORM = 0.7;
const PLATFORM_STAY = 30;

const RAGE_HP_RATIO = 0.5;
const RAGE_DASH_MIN = 0.6;
const RUSH_COUNT = 3;

const AGGRO = 260;

export const BOSS1_ATTACKS = {
    slash: {
        startup: 30, active: 6, recovery: 20,
        range: 150, height: 170, lunge: 40,
        damage: 60, stamina: 0, hitstun: 25, knockback: 320,
        hitStop: 6, shake: 0.01,
    },

    foot: {
        foot: true,
        startup: 19, active: 5, recovery: 15,
        range: 90, height: 15,
        damage: 50, stamina: 0, hitstun: 25, knockback: 300,
        hitStop: 6, shake: 0.01,
    },

    thrust: {
        thrust: true,
        startup: 24, active: 8, recovery: 22,
        range: 90, height: 25,
        damage: 55, stamina: 0, hitstun: 25, knockback: 320,
        hitStop: 6, shake: 0.01,
    },

    thrustShockwave: {
        shockwave: true,
        parryable: false,
        startup: 0, active: 1, recovery: 0,
        range: 100, height: 65, speed: 12,
        damage: 50, stamina: 0, hitstun: 20, knockback: 300,
        hitStop: 0, shake: 0.008,
    },

    dashSlash: {
        fast: true,
        startup: 8, active: 6, recovery: 20,
        range: 150, height: 170, lunge: 40,
        damage: 35, stamina: 0, hitstun: 25, knockback: 340,
        hitStop: 6, shake: 0.01,
    },

    dash: {
        dash: true,
        startup: 18, active: 22, recovery: 25,
        speed: 18, reach: 20, range: 0, height: 170,
        damage: 35, stamina: 0, hitstun: 25, knockback: 360,
        hitStop: 6, shake: 0.012,
    },
};

BOSS1_ATTACKS.dashRush = { ...BOSS1_ATTACKS.dash, startup: 8 };

export default class Boss1 extends BaseBoss {
    static attacks = BOSS1_ATTACKS;

    static preload(scene) {
        const L = (key, file) => scene.load.image(key, `/assets/${file}`);

        L("boss", "bossenemy1.png");
        L("boss_stance", "boss1attackwait.png");
        L("boss_swing", "boss1attack.png");
        L("boss_dash", "boss1dash.png");
        L("boss_dashattack", "boss1dashattack.png");
        L("boss_footattack", "boss1footattack.png");
        L("boss_footwait", "boss1footwait.png");
        L("boss_thrustwait", "boss1thrustwait.png");
        L("boss_thrustattack", "boss1thrustattack.png");
        L("boss_shockwave", "boss1slash.png");
        L("boss_stun", "boss1stun.png");
        L("boss_parystun", "boss1parystun.png");
        L("boss_dead", "boss1slaied.png");
    }

    constructor(scene, x, groundY, opts = {}) {
        super(scene, x, groundY, {
            texture: "boss",
            maxHp: 1000,
            ...opts,
        });

        this.chained = false;
        this.rushing = false;
        this.rushLeft = 0;

        this.shockwaveViews = [0, 1].map(() =>
            scene.add
                .image(0, 0, "boss_shockwave")
                .setDisplaySize(140, 75)
                .setDepth(7)
                .setVisible(false)
        );

        this.shockwaves = [-1, 1].map((direction) => ({
            active: false,
            x: 0,
            y: 0,
            direction,
            hitSet: new Set(),
        }));
    }

    // ───────── フック実装 ─────────

    onEnter(state) {
        if (
            state === BS.IDLE ||
            state === BS.STUN ||
            state === BS.TIRED
        ) {
            this.chained = false;
            this.rushing = false;
            this.rushLeft = 0;
        }
    }

    isFloating() {
        const dashing = this.state === BS.ACTIVE && this.attack?.dash;
        const hover =
            this.chained &&
            (this.state === BS.TELEGRAPH || this.state === BS.ACTIVE);
        return dashing || hover;
    }

    tick(players) {
        this.trackPlatformTime(players, RAISED_OFFSET);
        super.tick(players);
    }

    onTelegraphTick() {
        if (this.attack?.dash) this.updateAim(false);
    }

    tickExtra(players) {
        this.tickShockwaves(players);
    }

    onDeadTick() {
        for (const s of this.shockwaves) s.active = false;
    }

    onDead() {
        for (const s of this.shockwaves) s.active = false;
    }

    onActiveFrame(players) {
        const a = this.attack;

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
            this.moveBody((this.facing * a.lunge) / a.active, 0);
        }
    }

    onActiveEnd(players) {
        const a = this.attack;

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

    poseRotation() {
        if (this.state === BS.ACTIVE && this.attack?.dash) {
            const angle = Math.atan2(
                Math.sin(this.aim),
                Math.abs(Math.cos(this.aim))
            );
            return angle * this.facing;
        }
        return null;
    }

    // ───────── 行動選択 ─────────

    tickIdle(players) {
        const nearest = this.nearestAlive(players);
        if (!nearest) return;

        this.faceToward(nearest);

        if (this.frame <= this.cfg.idleWait) return;

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

        // 近距離: 足払い or 突き
        if (!high && !up && Math.abs(dx) <= CLOSE_RANGE) {
            const r = Math.random();

            if (r < FOOT_CHANCE) {
                this.attack = BOSS1_ATTACKS.foot;
            } else if (r < FOOT_CHANCE + THRUST_CHANCE) {
                this.attack = BOSS1_ATTACKS.thrust;
            }

            if (
                this.attack === BOSS1_ATTACKS.foot ||
                this.attack === BOSS1_ATTACKS.thrust
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

        if (enraged) chance = Math.max(chance, RAGE_DASH_MIN);

        if (Math.random() < chance) {
            this.target = target;
            this.attack = BOSS1_ATTACKS.dash;

            if (enraged) {
                this.rushing = true;
                this.rushLeft = RUSH_COUNT - 1;
            }

            this.updateAim(false);
            this.enter(BS.TELEGRAPH);
        } else if (!far && !high && !up) {
            const r = Math.random();

            if (r < 0.4) {
                this.attack = BOSS1_ATTACKS.slash;
            } else if (r < 0.7) {
                this.target = target;
                this.attack = BOSS1_ATTACKS.dash;
                this.updateAim(false);
            } else {
                this.attack = BOSS1_ATTACKS.thrust;
            }

            this.enter(BS.TELEGRAPH);
        } else {
            this.frame = this.cfg.idleWait - RETRY_WAIT;
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
        if (this.frame !== Math.round(this.attack.active * SWITCH_AT)) return;

        const other = this.otherAlive(players, this.target);
        if (other && Math.random() < SWITCH_MID_CHANCE) {
            this.target = other;
        }
    }

    startAfterStomp(players) {
        const target = this.pickTarget(players);

        if (!target) {
            this.enter(BS.RECOVER);
            return;
        }

        this.target = target;
        this.faceToward(target);

        const r = Math.random();

        if (r < 0.45) {
            this.attack = BOSS1_ATTACKS.slash;
        } else if (r < 0.8) {
            this.attack = BOSS1_ATTACKS.dash;
            this.updateAim(false);
        } else {
            this.attack = BOSS1_ATTACKS.foot;
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

        this.faceToward(target);

        this.attack =
            Math.random() < FAST_SLASH_CHANCE
                ? BOSS1_ATTACKS.dashSlash
                : BOSS1_ATTACKS.slash;

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

        this.attack = BOSS1_ATTACKS.dashRush;
        this.updateAim(false);
        this.hitSet.clear();
        this.enter(BS.TELEGRAPH);
        this.chained = true;
    }

    // ───────── 衝撃波 ─────────

    spawnShockwaves() {
        const a = BOSS1_ATTACKS.thrustShockwave;
        const startY = this.groundY - a.height / 2;
        const startOffset = this.sprite.width / 2 + a.range / 2;

        for (const s of this.shockwaves) {
            s.active = true;
            s.x = this.sprite.x + s.direction * startOffset;
            s.y = startY;
            s.hitSet.clear();
        }
    }

    tickShockwaves(players) {
        const a = BOSS1_ATTACKS.thrustShockwave;
        const { arenaLeft, arenaRight } = this.cfg;

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

            if (s.x < arenaLeft - a.range || s.x > arenaRight + a.range) {
                s.active = false;
            }
        }
    }

    // ───────── 当たり判定 ─────────

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
                this.facing > 0 ? this.sprite.x : this.sprite.x - a.range;

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

        return super.hitRect(a);
    }

    // ───────── 同期 ─────────

    getExtraSyncData() {
        return {
            shockwaves: this.shockwaves.map((s) => ({
                active: s.active,
                x: Math.round(s.x),
                y: Math.round(s.y),
                direction: s.direction,
            })),
        };
    }

    applyExtraSync(d) {
        const data = d.shockwaves;
        if (!Array.isArray(data)) return;

        for (let i = 0; i < this.shockwaves.length; i++) {
            const src = data[i];
            const s = this.shockwaves[i];

            if (!src) {
                s.active = false;
                continue;
            }

            s.active = Boolean(src.active);
            s.x = src.x;
            s.y = src.y;
            s.direction = src.direction < 0 ? -1 : 1;
        }
    }

    // ───────── 描画 ─────────

    textureKey() {
        if (this.state === BS.DEAD) return "boss_dead";
        if (this.state === BS.STUN) return "boss_parystun";
        if (this.state === BS.TIRED) return "boss_stun";

        const a = this.attack;
        const st = this.state;
        const inAction = st === BS.ACTIVE || st === BS.RECOVER;

        if (a?.dash) {
            if (st === BS.TELEGRAPH) return "boss_dash";
            if (st === BS.ACTIVE) {
                return this.frame < a.active * DASH_POSE_SPLIT
                    ? "boss_dash"
                    : "boss_dashattack";
            }
            if (st === BS.RECOVER) return "boss_dashattack";
        } else if (a?.fast) {
            if (st === BS.TELEGRAPH || inAction) return "boss_dashattack";
        } else if (a?.thrust) {
            if (st === BS.TELEGRAPH) return "boss_thrustwait";
            if (inAction) return "boss_thrustattack";
        } else if (a?.foot) {
            if (st === BS.TELEGRAPH) return "boss_footwait";
            if (inAction) return "boss_footattack";
        } else if (a) {
            if (st === BS.TELEGRAPH) return "boss_stance";
            if (inAction) return "boss_swing";
        }

        return "boss";
    }

    renderExtra() {
        for (let i = 0; i < this.shockwaves.length; i++) {
            const wave = this.shockwaves[i];
            this.shockwaveViews[i]
                .setVisible(wave.active)
                .setPosition(wave.x, wave.y)
                .setFlipX(wave.direction < 0);
        }
    }
}