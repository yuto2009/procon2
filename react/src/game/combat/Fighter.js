import Phaser from "phaser";
import { ATTACKS, PARRY, DODGE, STAMINA, MOVE, BUFFER, FX} from "./frameData";
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

const DEBUG = true; // true: 当たり判定の枠を表示 / 完成時は false

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
    frames: scene.anims.generateFrameNumbers(key, { frames: [0, 1] }),
    frameRate: 3,
    repeat: -1,
  });
  scene.anims.create({
    key: `${key}-run`,
    frames: scene.anims.generateFrameNumbers(key, { frames: [2, 3, 4, 5] }),
    frameRate: 10,
    repeat: -1,
  });
}

export default class Fighter {
  constructor(scene, x, y, { color, texture, maxHp = 100 }) {
    this.scene = scene;
    this.baseColor = color;
    this.texture = texture;

    // 当たり判定用の四角形(見た目は画像に任せる)
    this.sprite = scene.add.rectangle(x, y, 32, 56, color).setVisible(DEBUG);
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body;
    this.body.setCollideWorldBounds(true);
    this.body.setDragX(1200);

    // 見た目(足元を四角形の下端に合わせる)
    createFighterAnims(scene, texture);
    this.view = scene.add
      .sprite(x, y, texture, 0)
      .setOrigin(0.5, 1)
      .setScale(2);

    this.hitDebug = scene.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0.35)
      .setVisible(false);
    this.maxHp = maxHp;
    this.weapon = "sword";
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

  // ---------- 毎tick(1/60秒)呼ぶ ----------
  tick(input, targets) {
    this.frame++;
    if (this.flashLeft > 0) this.flashLeft--;
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
        if (this.frame >= PARRY.window + PARRY.recovery) this.enter(S.IDLE);
        break;
      case S.DODGE:
        this.body.setVelocityX(this.dodgeDir * DODGE.speed);
        if (this.frame >= DODGE.frames) this.enter(S.IDLE);
        break;
      case S.STUN:
        if (this.frame >= this.stunFrames) this.enter(S.IDLE);
        break;
    }
    this.updateStamina();
  }

  bufferInput(input) {
    if (this.buffered && --this.bufferLeft <= 0) this.buffered = null;
    if (this.jumpLeft > 0) this.jumpLeft--;

    for (const a of ACTIONS) {
      if (input[a]) {
        this.buffered = a;
        this.bufferLeft = BUFFER.frames;
      }
    }
    if (input.jump) this.jumpLeft = BUFFER.frames;
  }

  tickFree(input) {
    // スタミナ枯渇 → 行動不能
    if (this.stamina <= 0) return this.stun(STAMINA.exhaustFrames);

    this.body.setVelocityX(input.x * MOVE.speed);
    if (input.x !== 0) this.facing = input.x;

    const onGround = this.body.blocked.down || this.body.touching.down;
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

  // ---------- 行動の開始 ----------
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

  // ---------- 攻撃処理 ----------
    tickAttack(targets) {
    const a = this.attack;
    const f = this.frame;
    this.body.setVelocityX(0);

    if (f >= a.startup && f < a.startup + a.active) {
      const rect = this.hitRect(a);

      if (DEBUG)
        this.hitDebug
          .setVisible(true)
          .setPosition(rect.centerX, rect.centerY)
          .setSize(rect.width, rect.height);

      if (!this.hitDone) {
        for (const t of targets) {
          if (
            Phaser.Geom.Intersects.RectangleToRectangle(
              rect,
              t.sprite.getBounds(),
            )
          ) {
            t.receiveHit(this, a);
            this.hitDone = true;
            break;
          }
        }
      }
    }
    if (f >= a.startup + a.active + a.recovery) this.enter(S.IDLE);
  }

  hitRect(a) {
    const cx = this.sprite.x + this.facing * (16 + a.range / 2);
    return new Phaser.Geom.Rectangle(
      cx - a.range / 2,
      this.sprite.y - a.height / 2,
      a.range,
      a.height,
    );
  }

  // ---------- 被弾 / パリィ判定 ----------
  receiveHit(attacker, a) {
    if (this.state === S.DEAD) return;

    const attackerIsFront =
      Math.sign(attacker.sprite.x - this.sprite.x) === this.facing;

    // パリィ成功: ダメージ無効 + 相手スタン + スタミナ回復
        // パリィ成功
    if (
      this.state === S.PARRY &&
      this.frame <= PARRY.window &&
      attackerIsFront
    ) {
      this.stamina = Math.min(STAMINA.max, this.stamina + PARRY.staminaGain);
      attacker.stun(PARRY.enemyStun);
      this.scene.events.emit("parry", this, attacker);   // ← attacker を追加
      return;
    }
    // 回避の無敵フレーム
    if (this.state === S.DODGE && this.frame <= DODGE.iframes) return;

    this.hp -= a.damage;
    const dir = Math.sign(this.sprite.x - attacker.sprite.x) || 1;
    this.body.setVelocityX(dir * a.knockback);
    this.flashLeft = FX.flashFrames;                       // ← 追加
    this.scene.events.emit("hit", this, attacker, a);      // ← 追加
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

  // ---------- スタミナ ----------
  spend(cost) {
    this.stamina = Math.max(0, this.stamina - cost);
    this.regenCooldown = STAMINA.regenDelay;
  }

  updateStamina() {
    if (this.regenCooldown > 0) {
      this.regenCooldown--;
      return;
    }
    this.stamina = Math.min(STAMINA.max, this.stamina + STAMINA.regenPerFrame);
  }

  // ---------- 表示(状態を色で見えるように) ----------
  render() {
    this.updateView();

    // デバッグ時のみ、状態を四角形の色で表示
    if (!DEBUG) return;
    let color = this.baseColor;
    if (this.state === S.ATTACK) {
      const a = this.attack,
        f = this.frame;
      color =
        f < a.startup
          ? 0xffee66
          : f < a.startup + a.active
            ? 0xff3333
            : 0x888888;
    } else if (this.state === S.PARRY) {
      color = this.frame <= PARRY.window ? 0x33ffff : 0x338888;
    } else if (this.state === S.STUN) {
      color = 0xaa66ff;
    }
    this.sprite.setFillStyle(color, 0.25);
  }

  updateView() {
    const v = this.view;
    v.setPosition(this.body.center.x, this.body.bottom);
    v.setFlipX(this.facing < 0);

    const still = (frame) => {
      v.anims.stop();
      v.setFrame(frame);
    };

    switch (this.state) {
      case S.ATTACK: {
        const set = this.attackKey === "fist" ? FRAMES.fist : FRAMES.sword;
        const a = this.attack,
          f = this.frame;
        still(set[f < a.startup ? 0 : f < a.startup + a.active ? 1 : 2]);
        break;
      }
      case S.PARRY:
        still(this.frame <= PARRY.window ? FRAMES.parry[0] : FRAMES.parry[1]);
        break;
      case S.DODGE:
        still(FRAMES.dodge);
        break;
      case S.STUN:
        still(FRAMES.stun);
        break;
      case S.DEAD:
        still(FRAMES.dead);
        break;
      default: {
        const onGround = this.body.blocked.down || this.body.touching.down;
        if (!onGround) still(FRAMES.jump);
        else if (Math.abs(this.body.velocity.x) > 10)
          v.anims.play(`${this.texture}-run`, true);
        else v.anims.play(`${this.texture}-idle`, true);
        if(this.flashLeft > 0) v.setTintFill(0xffffff);
        else v.clearTint();
      }
    }
  }
}
