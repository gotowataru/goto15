// Enemy.js
import * as THREE from 'three';
import {
    ENEMY_DEFAULT_HP, ENEMY_DEFAULT_SPEED, ENEMY_MASS,
    ENEMY_HEIGHT_FACTOR, ENEMY_RADIUS_FACTOR, ENEMY_DEFAULT_ANIMATION_NAME, ENEMY_ATTACK_RANGE
} from './constants.js';

export class Enemy {
    constructor(name, model, scene, physicsManager, initialPosition, initialScale, playerToFollow, animations = []) {
        this.name = name;
        this.model = model;
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.playerToFollow = playerToFollow; // これは Character インスタンスを期待

        // ★ スケール値受け取り確認ログ (1/2)
        console.log(`Enemy "${this.name}" constructor: Received initialScale = ${initialScale}`);

        this.model.scale.setScalar(initialScale);
        // ★ スケール適用後確認ログ (2/2)
        console.log(`Enemy "${this.name}" constructor: Model scale after setScalar: X=${this.model.scale.x.toFixed(3)}, Y=${this.model.scale.y.toFixed(3)}, Z=${this.model.scale.z.toFixed(3)}`);

        this.model.position.copy(initialPosition);
        this.scene.add(this.model);

        console.log(`Enemy "${this.name}" added to scene at X=${initialPosition.x.toFixed(2)}, Y=${initialPosition.y.toFixed(2)}, Z=${initialPosition.z.toFixed(2)} with scale ${initialScale.toFixed(3)}`);

        // --- アニメーション関連 ---
        this.mixer = new THREE.AnimationMixer(this.model);
        this.actions = {};
        this.currentActionName = null;
        if (animations && animations.length > 0) {
            this._setupAnimations(animations);
        } else {
            console.warn(`Enemy "${this.name}": No animations provided to constructor.`);
        }
        // --- アニメーション関連ここまで ---

        this.physicsBody = null;
        const enemyHeight = ENEMY_HEIGHT_FACTOR * initialScale; // スケールを適用した高さを計算
        const enemyRadius = ENEMY_RADIUS_FACTOR * initialScale; // スケールを適用した半径を計算
        console.log(`Enemy "${this.name}" constructor: Calculated physics body size: height=${enemyHeight.toFixed(3)}, radius=${enemyRadius.toFixed(3)} based on initialScale=${initialScale.toFixed(3)}`);
        this._createPhysicsBody(initialPosition, enemyHeight, enemyRadius, ENEMY_MASS);

        this.hp = ENEMY_DEFAULT_HP;
        this.isAlive = true;
        this.speed = ENEMY_DEFAULT_SPEED;

        console.log(`Enemy "${this.name}" created successfully. HP: ${this.hp}, Speed: ${this.speed}`);
    }

    _createPhysicsBody(position, height, radius, mass) {
        console.log(`Enemy "${this.name}" _createPhysicsBody: Attempting to create physics body at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) with height=${height.toFixed(3)}, radius=${radius.toFixed(3)}, mass=${mass}`);
        if (this.physicsManager && this.physicsManager.isInitialized()) {
            // PhysicsManager に敵専用のメソッド createEnemyPhysicsBody があればそちらを推奨
            // ここでは createCharacterPhysicsBody を流用
            this.physicsBody = this.physicsManager.createCharacterPhysicsBody(
                position, // 物理ボディの中心位置
                height,   // カプセルの高さ (両端の半球を含む全長)
                radius,   // カプセルの半径
                mass
            );
            if (this.physicsBody) {
                this.physicsBody.threeObject = this.model; // three.jsオブジェクトへの参照
                this.physicsBody.userData = { type: 'enemy', instance: this }; // userDataに情報を格納
                console.log(`Enemy "${this.name}" _createPhysicsBody: Physics body created successfully.`);
                // ボディがスリープしないようにする（常にアクティブ）
                // DISABLE_DEACTIVATION = 4 (Ammo.js)
                // this.physicsBody.setActivationState(4); // 必要に応じて
            } else {
                console.error(`Enemy "${this.name}" _createPhysicsBody: Failed to create physics body.`);
            }
        } else {
            console.error(`Enemy "${this.name}" _createPhysicsBody: PhysicsManager is not available or not initialized.`);
        }
    }

    _setupAnimations(animationClips) {
        console.log(`Enemy "${this.name}" _setupAnimations: Received ${animationClips.length} animation clips.`, animationClips);
        if (!animationClips || animationClips.length === 0) {
            console.warn(`Enemy "${this.name}" _setupAnimations: No animation clips provided.`);
            return;
        }

        // 最初のクリップをデフォルトアニメーションとして登録
        // TODO: より柔軟なアニメーション管理 (複数のアニメーションクリップを名前で登録できるようにする)
        const defaultClip = animationClips[0];
        if (defaultClip instanceof THREE.AnimationClip) {
            this.actions[ENEMY_DEFAULT_ANIMATION_NAME] = this.mixer.clipAction(defaultClip);
            if (this.actions[ENEMY_DEFAULT_ANIMATION_NAME]) {
                this.actions[ENEMY_DEFAULT_ANIMATION_NAME].setLoop(THREE.LoopRepeat);
                this.switchAnimation(ENEMY_DEFAULT_ANIMATION_NAME);
                console.log(`Enemy "${this.name}" _setupAnimations: Action "${ENEMY_DEFAULT_ANIMATION_NAME}" created and playing from clip "${defaultClip.name}".`);
            } else {
                 console.error(`Enemy "${this.name}" _setupAnimations: Failed to create clip action for "${ENEMY_DEFAULT_ANIMATION_NAME}".`);
            }
        } else {
            console.warn(`Enemy "${this.name}" _setupAnimations: The first provided animation clip is not a THREE.AnimationClip. Clip:`, defaultClip);
        }

        // 将来的に複数のアニメーションを扱う場合の例 (コメントアウト)
        /*
        animationClips.forEach(clip => {
            if (clip instanceof THREE.AnimationClip) {
                // クリップ名または特定の命名規則に基づいてアクション名を決定
                const actionName = clip.name; // 例: GLB/FBXファイルで設定されたアニメーション名
                this.actions[actionName] = this.mixer.clipAction(clip);
                console.log(`Enemy "${this.name}" _setupAnimations: Action "${actionName}" created from clip "${clip.name}".`);
                if (actionName === ENEMY_DEFAULT_ANIMATION_NAME) { // もしデフォルトとして指定された名前なら
                    this.actions[actionName].setLoop(THREE.LoopRepeat);
                    this.switchAnimation(actionName);
                }
            } else {
                console.warn(`Enemy "${this.name}" _setupAnimations: An item in animationClips is not a THREE.AnimationClip. Item:`, clip);
            }
        });
        if (!this.currentActionName && this.actions[ENEMY_DEFAULT_ANIMATION_NAME]) {
            // デフォルトアニメーションが設定されていなければ、明示的に再生
            console.log(`Enemy "${this.name}" _setupAnimations: No current action, trying to play "${ENEMY_DEFAULT_ANIMATION_NAME}".`);
            this.switchAnimation(ENEMY_DEFAULT_ANIMATION_NAME);
        } else if (!this.actions[ENEMY_DEFAULT_ANIMATION_NAME]) {
            console.warn(`Enemy "${this.name}" _setupAnimations: Default animation "${ENEMY_DEFAULT_ANIMATION_NAME}" not found after setup.`);
        }
        */
    }

    switchAnimation(name) {
        if (this.currentActionName === name) {
            console.log(`Enemy "${this.name}" switchAnimation: Already playing "${name}".`);
            return;
        }
        if (!this.actions[name]) {
            console.warn(`Enemy "${this.name}" switchAnimation: Action "${name}" not found.`);
            return;
        }

        console.log(`Enemy "${this.name}" switchAnimation: Switching to "${name}" from "${this.currentActionName || 'none'}".`);

        const previousAction = this.currentActionName ? this.actions[this.currentActionName] : null;
        const nextAction = this.actions[name];

        if (previousAction) {
            previousAction.fadeOut(0.2);
        }

        nextAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(0.2)
            .play();

        this.currentActionName = name;
        console.log(`Enemy "${this.name}" switchAnimation: Now playing "${this.currentActionName}".`);
    }

    update(deltaTime, playerPosition) { // playerPosition は THREE.Vector3 を期待
        if (!this.isAlive) return;

        // ★ プレイヤー位置確認ログ (1/4)
        if (!playerPosition) {
            console.warn(`Enemy "${this.name}" update: playerPosition is null or undefined. Cannot perform AI logic.`);
            // playerPosition がなければ追跡できない
        } else {
            // 詳細ログが必要な場合:
            console.log(`Enemy "${this.name}" update called. My world pos: (${this.model.position.x.toFixed(2)}, ${this.model.position.y.toFixed(2)}, ${this.model.position.z.toFixed(2)}). Player world pos: (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)})`);
        }

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.physicsBody && this.playerToFollow && playerPosition) {
            const enemyWorldPos = new THREE.Vector3();
            this.model.getWorldPosition(enemyWorldPos); // モデルのワールド座標を取得

            // プレイヤーの座標もワールド座標であることを確認 (playerToFollow.model.position などもワールド座標のはず)
            const playerWorldPos = playerPosition;

            const directionToPlayer = new THREE.Vector3().subVectors(playerWorldPos, enemyWorldPos);
            const distanceToPlayer = directionToPlayer.length();

            // ★ 距離と攻撃範囲のログ (2/4)
            console.log(`Enemy "${this.name}": Distance to player = ${distanceToPlayer.toFixed(2)} (Player: ${playerWorldPos.x.toFixed(2)},${playerWorldPos.z.toFixed(2)} | Enemy: ${enemyWorldPos.x.toFixed(2)},${enemyWorldPos.z.toFixed(2)}). Attack range = ${ENEMY_ATTACK_RANGE}. Speed = ${this.speed}.`);


            // プレイヤーの方向を向く (Y軸はそのまま)
            // lookAt はワールド座標系で動作するので、enemyWorldPos を基準に playerWorldPos を見る
            const lookAtTarget = new THREE.Vector3(playerWorldPos.x, enemyWorldPos.y, playerWorldPos.z);
            this.model.lookAt(lookAtTarget);

            if (distanceToPlayer > ENEMY_ATTACK_RANGE) {
                directionToPlayer.normalize(); // 方向ベクトルに
                const currentVelocity = this.physicsBody.getLinearVelocity(); // btVector3
                const desiredVelocity = new this.physicsManager.AmmoAPI.btVector3(
                    directionToPlayer.x * this.speed,
                    currentVelocity.y(), // Y方向の現在の速度を維持（重力などによる落下を妨げない）
                    directionToPlayer.z * this.speed
                );

                // ★ 移動時の速度ログ (3/4)
                console.log(`Enemy "${this.name}": Moving towards player. Desired velocity = (${desiredVelocity.x().toFixed(2)}, ${desiredVelocity.y().toFixed(2)}, ${desiredVelocity.z().toFixed(2)})`);
                this.physicsBody.setLinearVelocity(desiredVelocity);
                this.physicsBody.activate(); // ボディがスリープ状態になるのを防ぐ
                // TODO: 'walk' or 'run' animation if available
                // if (this.currentActionName !== 'walk' && this.actions['walk']) this.switchAnimation('walk');
                // else if (this.currentActionName !== ENEMY_DEFAULT_ANIMATION_NAME && !this.actions['walk']) this.switchAnimation(ENEMY_DEFAULT_ANIMATION_NAME);

            } else { // 攻撃範囲内
                // ★ 攻撃範囲内ログ (4/4)
                console.log(`Enemy "${this.name}": Player in attack range (dist: ${distanceToPlayer.toFixed(2)}). Stopping movement.`);
                // 水平方向の速度をゼロにする（Y方向の速度は維持）
                const stopVelocity = new this.physicsManager.AmmoAPI.btVector3(0, this.physicsBody.getLinearVelocity().y(), 0);
                this.physicsBody.setLinearVelocity(stopVelocity);
                // TODO: 'attack' animation if available, otherwise idle/default
                // if (this.currentActionName !== 'attack' && this.actions['attack']) this.switchAnimation('attack');
                // else if (this.currentActionName !== ENEMY_DEFAULT_ANIMATION_NAME && !this.actions['attack']) this.switchAnimation(ENEMY_DEFAULT_ANIMATION_NAME);
                if (this.currentActionName !== ENEMY_DEFAULT_ANIMATION_NAME && this.actions[ENEMY_DEFAULT_ANIMATION_NAME]) {
                     this.switchAnimation(ENEMY_DEFAULT_ANIMATION_NAME);
                }
            }
        } else if (this.physicsBody) {
             console.log(`Enemy "${this.name}" update: No player to follow or playerPosition not provided, or physics body missing. Current Action: ${this.currentActionName}`);
             // プレイヤーがいない、または物理ボディがない場合、何もしないか待機アニメーション
             if (this.currentActionName !== ENEMY_DEFAULT_ANIMATION_NAME && this.actions[ENEMY_DEFAULT_ANIMATION_NAME]) {
                // this.switchAnimation(ENEMY_DEFAULT_ANIMATION_NAME);
             }
             // 速度をゼロにしておく（慣性で動き続けないように）
             const stopVelocity = new this.physicsManager.AmmoAPI.btVector3(0, this.physicsBody.getLinearVelocity().y(), 0);
             this.physicsBody.setLinearVelocity(stopVelocity);
        }


        // 物理ボディの位置をモデルに同期
        if (this.physicsBody && this.model) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                const transform = this.physicsManager.getTempTransform(); // PhysicsManagerから一時的なbtTransformを取得
                motionState.getWorldTransform(transform);
                const p = transform.getOrigin();    // btVector3
                const q = transform.getRotation(); // btQuaternion

                // 物理ボディの中心 (p.y()) からモデルの足元へのオフセットを計算
                // ENEMY_HEIGHT_FACTOR * this.model.scale.y がカプセルの全長
                // カプセルの中心から底面までの距離は (ENEMY_HEIGHT_FACTOR * this.model.scale.y / 2)
                const modelYOffset = ENEMY_HEIGHT_FACTOR * this.model.scale.y / 2;
                this.model.position.set(p.x(), p.y() - modelYOffset, p.z());
                this.model.quaternion.set(q.x(), q.y(), q.z(), q.w());
                console.log(`Enemy "${this.name}" update: Synced model to physics. Phys Pos: (${p.x().toFixed(2)}, ${p.y().toFixed(2)}, ${p.z().toFixed(2)}). Model Pos: (${this.model.position.x.toFixed(2)}, ${this.model.position.y.toFixed(2)}, ${this.model.position.z.toFixed(2)})`);
            }
        }
    }


    takeDamage(amount) {
        if (!this.isAlive) return;

        this.hp -= amount;
        console.log(`Enemy "${this.name}" took ${amount} damage. HP remaining: ${this.hp}`);

        if (this.hp <= 0) {
            this.die();
        } else {
            // TODO: 被ダメージアニメーション
            // if (this.actions['hit']) this.switchAnimation('hit');
            console.log(`Enemy "${this.name}" is still alive. HP: ${this.hp}`);
        }
    }

    die() {
        if (!this.isAlive) {
            console.log(`Enemy "${this.name}" die() called, but already not alive.`);
            return;
        }

        this.isAlive = false;
        console.log(`Enemy "${this.name}" died. HP: ${this.hp}`);

        // TODO: 死亡アニメーションを再生し、完了後に removeFromWorld を呼び出す
        // 例:
        // if (this.actions['death']) {
        //     this.switchAnimation('death');
        //     const deathAction = this.actions['death'];
        //     deathAction.clampWhenFinished = true;
        //     deathAction.setLoop(THREE.LoopOnce);
        //     this.mixer.addEventListener('finished', (e) => {
        //         if (e.action === deathAction) {
        //             console.log(`Enemy "${this.name}" death animation finished. Removing from world.`);
        //             this.removeFromWorld();
        //         }
        //     });
        // } else {
        //     // 死亡アニメーションがない場合は即時除去
        //     this.removeFromWorld();
        // }

        // 現状は即時除去
        this.removeFromWorld();
    }

    removeFromWorld() {
        console.log(`Enemy "${this.name}": Attempting to remove from scene and physics world.`);
        if (this.scene && this.model && this.model.parent === this.scene) {
            this.scene.remove(this.model);
            console.log(`Enemy "${this.name}": Removed model from scene.`);
        } else if (this.scene && this.model) {
            console.warn(`Enemy "${this.name}": Model was not a direct child of the scene, or scene/model undefined. Scene:`, this.scene, `Model:`, this.model, `Model parent:`, this.model.parent);
        }


        if (this.physicsManager && this.physicsBody) {
            this.physicsManager.removeRigidBody(this.physicsBody);
            this.physicsBody = null; // 参照をクリア
            console.log(`Enemy "${this.name}": Removed physics body from physics world.`);
        }

        // アニメーションミキサーやアクションもクリーンアップ (必要に応じて)
        if (this.mixer) {
            // this.mixer.stopAllAction(); // すべてのアクションを停止
            // this.mixer = null; // 参照をクリア
        }
        this.actions = {}; // アクション参照をクリア

        console.log(`Enemy "${this.name}": Cleanup finished in removeFromWorld.`);
    }
}