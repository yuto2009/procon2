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

        if (def.image) {
            // 1枚絵のモンスター:Fighter が作った歩き用スプライトを、画像に差し替える
            this.view.destroy();
            this.baseScale = def.scale ?? 2;
            this.view = scene.add
                .image(x, y, def.image)
                .setOrigin(0.5, 1)
                .setScale(this.baseScale);

            // 当たり判定(四角)を、見た目の大きさに合わせる
            if (def.body) {
                this.sprite.setSize(def.body.w, def.body.h);
                this.body.setSize(def.body.w, def.body.h);
            }
        } else {
            // スプライトシートのモンスター:色で区別する
            this.view.setTint(def.tint);
        }
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

    // 見た目の更新。1枚絵のモンスターは、伸び縮みで動きを表す
    updateView() {
        if (!this.def.image) return super.updateView();

        const v = this.view;
        v.setPosition(this.body.center.x, this.body.bottom + (this.def.footOffset ?? 0));

        let sx = 1, sy = 1;
        if (this.state === S.DEAD) {
            sx = 1.25; sy = 0.45;                                  // つぶれて
            v.setAlpha(Math.max(0, 1 - this.deadFrames / 60));     // 消えていく
        } else if (this.state === S.ATTACK && this.attack) {
            if (this.frame < this.attack.startup) { sx = 1.15; sy = 0.75; }   // ため(縮む)
            else { sx = 0.9; sy = 1.25; }                                      // 飛びかかり(伸びる)
        } else if (this.state === S.STUN) {
            sx = 1.15; sy = 0.8;
        } else {
            // ふだん:ぷるぷる揺れる(同じ位置の敵がそろわないよう、homeX をずらしに使う)
            const k = Math.sin(this.scene.time.now / 160 + this.homeX) * 0.06;
            sx = 1 + k;
            sy = 1 - k;
        }
        v.setScale(this.baseScale * sx, this.baseScale * sy);

        // 被弾:白く光る
        if (this.flashLeft > 0) v.setTintFill(0xffffff);
        else v.clearTint();
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