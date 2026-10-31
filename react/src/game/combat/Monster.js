import Fighter, { S } from "./Fighter";
import { MONSTERS } from "./monsterData";

export default class Monster extends Fighter {
    constructor(scene, x, y, type) {
        const def = MONSTERS[type];
        super(scene, x, y, {
            color: def.tint,
            texture: "enemy",
            maxHp: def.maxHp,
            damageMul: def.damageMul,
        });

        this.type = type;
        this.def = def;
        this.homeX = x;          // 離れたら戻る基準位置
        this.cooldown = 0;       // 次の攻撃までの待ち
        this.deadFrames = 0;     // 死亡後の経過
        this.removed = false;    // 画面から消したか

        // 見た目の色を変える(敵の画像は共通)
        this.view.setTint(def.tint);
    }

    // 毎tick呼ぶ。target はプレイヤー
    think(target) {
        if (this.state === S.DEAD) {
            this.deadFrames++;
            return;
        }

        if (this.cooldown > 0) this.cooldown--;

        const dx = target.sprite.x - this.sprite.x;
        const dist = Math.abs(dx);
        const playerAlive = target.state !== S.DEAD;

        // 行動できる状態(IDLE)のときだけAIを動かす
        if (this.state !== S.IDLE) {
            this.tick({ x: 0 }, [target]);
            return;
        }

        let moveX = 0;

        if (playerAlive && dist <= this.def.aggro) {
            // 気づいた:プレイヤーの方を向いて近づく
            this.facing = Math.sign(dx) || this.facing;

            if (dist > this.def.attackRange) {
                moveX = this.facing;
            } else if (this.cooldown <= 0) {
                // 射程に入ったので攻撃
                this.startAttack("enemySlash");
                this.cooldown = this.def.attackCooldown;
            }
        } else if (Math.abs(this.sprite.x - this.homeX) > 20) {
            // 気づいていない:元の位置へ戻る
            moveX = Math.sign(this.homeX - this.sprite.x);
            this.facing = moveX || this.facing;
        }

        // 移動の速さを種類ごとに変える(Fighter は MOVE.speed 固定なので上書き)
        this.tick({ x: moveX }, [target]);
        if (this.state === S.IDLE) {
            this.body.setVelocityX(moveX * this.def.speed);
        }
    }

    // 倒されてしばらくしたら消す
    shouldRemove() {
        return this.state === S.DEAD && this.deadFrames > 60 && !this.removed;
    }

    destroy() {
        this.removed = true;
        this.sprite.destroy();
        this.view.destroy();
        this.hitDebug.destroy();
    }
}