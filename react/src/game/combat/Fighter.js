import Phaser from "phaser";
import {
    ATTACKS,
    PARRY,
    DODGE,
    STAMINA,
    MOVE,
    BUFFER,
    FX,
} from "./frameData";

const socket = window.socket;
const ACTIONS = ["fist", "sword", "dodge", "parry"];

export const S = {
    IDLE: "idle",
    ATTACK: "attack",
    PARRY: "parry",
    DODGE: "dodge",
    STUN: "stun",
    DEAD: "dead",
};

const DEBUG = true;
const PARRY_DELAY = 4;
const PARRY_WIN = 6;
const DODGE_STAMINA_MUL = 0.5;

const FRAMES = {
    jump: 6,
    sword: [7, 8, 9],
    fist: [10, 11, 12],
    parry: [13, 14],
    dodge: 15,
    stun: 16,
    dead: 17,
};

function createFighterAnims(scene, key) {
    if (scene.anims.exists(`${key}-idle`)) return;

    scene.anims.create({
        key: `${key}-idle`,
        frames: scene.anims.generateFrameNumbers(key, {
            frames: [0, 1],
        }),
        frameRate: 3,
        repeat: -1,
    });

    scene.anims.create({
        key: `${key}-run`,
        frames: scene.anims.generateFrameNumbers(key, {
            frames: [2, 3, 4, 5],
        }),
        frameRate: 10,
        repeat: -1,
    });
}

export default class Fighter {
    constructor(
        scene,
        x,
        y,
        { color, texture, maxHp = 100, damageMul = 1 }
    ) {
        this.scene = scene;
        this.baseColor = color;
        this.texture = texture;

        this.sprite = scene.add
            .rectangle(x, y, 32, 56, color)
            .setVisible(DEBUG);

        scene.physics.add.existing(this.sprite);

        this.body = this.sprite.body;
        this.body.setCollideWorldBounds(true);
        this.body.setDragX(1200);

        createFighterAnims(scene, texture);

        this.view = scene.add
            .sprite(x, y, texture, 0)
            .setOrigin(0.5, 1)
            .setScale(2);

        this.hitDebug = scene.add
            .rectangle(0, 0, 10, 10, 0xffffff, 0.35)
            .setVisible(false);

        this.maxHp = maxHp;
        this.damageMul = damageMul;
        this.weapon = "sword";

        this.remote = false;
        this.remoteOnGround = true;
        this.remoteVx = 0;

        this.reset(x, y);
    }

    reset(x, y) {
        this.sprite.setPosition(x, y);
        this.body.setVelocity(0, 0);

        this.hp = this.maxHp;
        this.stamina = STAMINA.max;
        this.regenCooldown = 0;
        this.facing = 1;
        this.attack = null;
        this.stunFrames = 0;

        this.enter(S.IDLE);

        this.buffered = null;
        this.bufferLeft = 0;
        this.jumpLeft = 0;
        this.flashLeft = 0;
    }

    enter(state) {
        this.state = state;
        this.frame = 0;
    }

    tick(input, targets) {
        this.frame++;

        if (this.flashLeft > 0) {
            this.flashLeft--;
        }

        this.hitDebug.setVisible(false);
        this.bufferInput(input);

        switch (this.state) {
            case S.IDLE:
                this.tickFree(input);
                break;

            case S.ATTACK:
                this.tickAttack(targets);
                break;

            case S.PARRY:
                if (
                    this.frame >=
                    PARRY.delay + PARRY.window + PARRY.recovery
                ) {
                    this.enter(S.IDLE);
                }
                break;

            case S.DODGE:
                this.body.setVelocityX(this.dodgeDir * DODGE.speed);

                if (this.frame >= DODGE.frames) {
                    this.enter(S.IDLE);
                }
                break;

            case S.STUN:
                if (this.frame >= this.stunFrames) {
                    this.enter(S.IDLE);
                }
                break;
        }

        this.updateStamina();
    }

    bufferInput(input) {
        if (this.buffered && --this.bufferLeft <= 0) {
            this.buffered = null;
        }

        if (this.jumpLeft > 0) {
            this.jumpLeft--;
        }

        for (const a of ACTIONS) {
            if (input[a]) {
                this.buffered = a;
                this.bufferLeft = BUFFER.frames;
            }
        }

        if (input.jump) {
            this.jumpLeft = BUFFER.frames;
        }
    }

    tickFree(input) {
        if (this.stamina <= 0) {
            return this.stun(STAMINA.exhaustFrames);
        }

        this.body.setVelocityX(input.x * MOVE.speed);

        if (input.x !== 0) {
            this.facing = input.x;
        }

        const onGround =
            this.body.blocked.down || this.body.touching.down;

        if (this.jumpLeft > 0 && onGround) {
            this.body.setVelocityY(-MOVE.jump);
            this.jumpLeft = 0;
        }

        const action = this.buffered;
        if (!action) return;

        this.buffered = null;

        if (action === "parry") return this.startParry();
        if (action === "dodge") return this.startDodge(input.x || this.facing);
        if (action === "sword") return this.startAttack("sword");
        if (action === "fist") return this.startAttack("fist");
    }

    startAttack(key) {
        const a = ATTACKS[key];

        this.attackKey = key;
        this.spend(a.stamina);
        this.attack = a;
        this.hitDone = false;

        this.body.setVelocityX(0);
        this.enter(S.ATTACK);
    }

    startParry() {
        this.spend(PARRY.stamina);
        this.body.setVelocityX(0);
        this.enter(S.PARRY);
    }

    startDodge(dir) {
        this.spend(DODGE.stamina);
        this.dodgeDir = dir;
        this.enter(S.DODGE);
    }

    tickAttack(targets) {
        const a = this.attack;
        const f = this.frame;

        this.body.setVelocityX(0);

        if (f >= a.startup && f < a.startup + a.active) {
            const rect = this.hitRect(a);

            if (DEBUG) {
                this.hitDebug
                    .setVisible(true)
                    .setPosition(rect.centerX, rect.centerY)
                    .setSize(rect.width, rect.height);
            }

            if (!this.hitDone) {
                for (const t of targets) {
                    if (
                        Phaser.Geom.Intersects.RectangleToRectangle(
                            rect,
                            t.sprite.getBounds()
                        )
                    ) {
                        t.receiveHit(this, a);
                        this.hitDone = true;
                        break;
                    }
                }
            }
        }

        if (f >= a.startup + a.active + a.recovery) {
            this.enter(S.IDLE);
        }
    }

    hitRect(a) {
        const cx = this.sprite.x + this.facing * (16 + a.range / 2);

        return new Phaser.Geom.Rectangle(
            cx - a.range / 2,
            this.sprite.y - a.height / 2,
            a.range,
            a.height
        );
    }

    receiveHit(attacker, a) {
        // リモートキャラクターは表示専用
        if (this.remote) {
            this.onRemoteHit?.(attacker, a);
            return;
        }

        if (this.state === S.DEAD) return;

        const attackerIsFront =
            Math.sign(attacker.sprite.x - this.sprite.x) === this.facing;

        // parryable:false の攻撃はパリィ判定を通さない
        if (
            a.parryable !== false &&
            this.state === S.PARRY &&
            this.frame <= PARRY_DELAY &&
            this.frame <= PARRY_DELAY + PARRY_WIN &&
            attackerIsFront
        ) {
            this.stamina = Math.min(
                STAMINA.max,
                this.stamina + PARRY.staminaGain
            );

            attacker.stun(PARRY.enemyStun);
            this.scene.events.emit("parry", this, attacker);
            return;
        }

        // 回避の無敵フレーム
        if (
            this.state === S.DODGE &&
            this.frame <= DODGE.iframes
        ) {
            return;
        }

        this.hp -= a.damage;

        const dir =
            Math.sign(this.sprite.x - attacker.sprite.x) || 1;

        this.body.setVelocityX(dir * a.knockback);
        this.flashLeft = FX.flashFrames;

        this.scene.events.emit("hit", this, attacker, a);

        if (this.hp <= 0) {
            this.hp = 0;
            this.enter(S.DEAD);
        } else {
            this.stun(a.hitstun);
        }
    }

    stun(frames) {
        this.stunFrames = frames;
        this.attack = null;
        this.buffered = null;
        this.jumpLeft = 0;
        this.enter(S.STUN);
    }

    getSyncData() {
        return {
            x: Math.round(this.sprite.x),
            y: Math.round(this.sprite.y),
            vx: Math.round(this.body.velocity.x),
            facing: this.facing,
            state: this.state,
            frame: this.frame,
            key: this.attackKey ?? null,
            onGround:
                this.body.blocked.down || this.body.touching.down,
            hp: this.hp,
            flash: this.flashLeft,
        };
    }

    applySyncData(d) {
        this.sprite.setPosition(d.x, d.y);
        this.body.setVelocity(0, 0);

        this.facing = d.facing;
        this.state = d.state;
        this.frame = d.frame;
        this.attackKey = d.key;
        this.attack = d.key ? ATTACKS[d.key] : null;
        this.hp = d.hp;
        this.flashLeft = d.flash;
        this.remoteOnGround = d.onGround;
        this.remoteVx = d.vx;
    }

    spend(cost) {
        this.stamina = Math.max(0, this.stamina - cost);
        this.regenCooldown = STAMINA.regenDelay;
    }

    updateStamina() {
        if (this.regenCooldown > 0) {
            this.regenCooldown--;
            return;
        }

        this.stamina = Math.min(
            STAMINA.max,
            this.stamina + STAMINA.regenPerFrame
        );
    }

    render() {
        this.updateView();

        if (!DEBUG) return;

        let color = this.baseColor;

        if (this.state === S.ATTACK && this.attack) {
            const a = this.attack;
            const f = this.frame;

            color =
                f < a.startup
                    ? 0xffee66
                    : f < a.startup + a.active
                        ? 0xff3333
                        : 0x888888;
        } else if (this.state === S.PARRY) {
            color =
                this.frame >= PARRY.delay &&
                this.frame <= PARRY.delay + PARRY.window
                    ? 0x33ffff
                    : 0x338888;
        } else if (this.state === S.STUN) {
            color = 0xaa66ff;
        }

        this.sprite.setFillStyle(color, 0.25);
    }

    updateView() {
        const v = this.view;

        if (this.remote) {
            v.setPosition(
                this.sprite.x,
                this.sprite.y + this.sprite.height / 2
            );
        } else {
            v.setPosition(this.body.center.x, this.body.bottom);
        }

        v.setFlipX(this.facing < 0);

        const still = (frame) => {
            v.anims.stop();
            v.setFrame(frame);
        };

        if (this.state === S.DEAD) {
            still(FRAMES.dead);
            return;
        }

        if (this.state === S.STUN) {
            still(FRAMES.stun);
            return;
        }

        if (this.state === S.PARRY) {
            still(FRAMES.parry[0]);
            return;
        }

        if (this.state === S.DODGE) {
            still(FRAMES.dodge);
            return;
        }

        if (this.state === S.ATTACK && this.attack) {
            const frames = FRAMES[this.attackKey];

            if (frames) {
                const index = Math.min(
                    frames.length - 1,
                    Math.floor(this.frame / 3)
                );

                still(frames[index]);
                return;
            }
        }

        if (Math.abs(this.body.velocity.x) > 5) {
            v.play(`${this.texture}-run`, true);
        } else {
            v.play(`${this.texture}-idle`, true);
        }
    }
}