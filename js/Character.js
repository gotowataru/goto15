// Character.js
import * as THREE from 'three';
import {
    CHARACTER_HEIGHT, CHARACTER_RADIUS, CHARACTER_MASS,
//     // ジャンプ関連の定数をインポート
//     CHARACTER_JUMP_FORCE, // または CHARACTER_JUMP_INITIAL_VELOCITY
//     CHARACTER_MAX_JUMPS,
} from './constants.js';

export class Character {
    constructor(model, animations, scene, physicsManager, initialPosition, initialScale, localForwardVec, projectileManager) {
        console.log("%cCharacter constructor: CALLED. Model provided:", "color: blue; font-weight: bold;", model ? model.name : "No model");
        this.model = model;
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.projectileManager = projectileManager;
        this.localForwardDirection = localForwardVec.clone();

        this.model.scale.setScalar(initialScale);
        this.scene.add(this.model);

        this.mixer = new THREE.AnimationMixer(this.model);
        this.actions = {};
        this.currentActionName = null;
        this.onAnimationFinishedCallback = null;

        this.canPlayAction = true; // キックなどの単発アクション用
        this.moveDirection = new THREE.Vector3();
        this.cameraDirection = new THREE.Vector3();
        this.physicsBody = null;
        this.isMoving = false;
        this.kickActionStartTime = null;
        this.beamGeneratedDuringKick = false;

//         // --- ★ ジャンプ関連のプロパティ追加 ---
//         this.isJumping = false;         // 現在ジャンプアニメーション中か、または空中にいるか
           this.isGrounded = true;         // 地面に接しているか ジャンプしないので常に地上で固定
//         this.canJump = true;            // ジャンプ入力が可能か
//         this.jumpCount = 0;             // 現在のジャンプ回数
//         this.lastGroundNormal = new THREE.Vector3(0, 1, 0); //最後に接地していた地面の法線（坂道判定用）
//         // --- ★ ジャンプ関連ここまで ---

        this._setupAnimations(animations);
        this._createPhysicsBody(initialPosition, CHARACTER_HEIGHT, CHARACTER_RADIUS, CHARACTER_MASS);

        this.mixer.addEventListener('finished', this._onAnimationFinished.bind(this));
        console.log("%cCharacter constructor: FINISHED. Model name in scene:", "color: blue; font-weight: bold;", this.model ? this.model.name : "No model", "Position:", this.model.position);
    }

    _setupAnimations(animationClips) {
        console.log("Character._setupAnimations: Received animationClips:", animationClips); 
        for (const name in animationClips) {
            const clip = animationClips[name];
            if (clip instanceof THREE.AnimationClip) { // ★ 修正: 元のシンプルなバージョンに戻す (if (clip) だと配列の場合エラーになる可能性があった)
                this.actions[name] = this.mixer.clipAction(clip);
                console.log(`Character._setupAnimations: Action created for "${name}" with clip "${clip.name}".`);
                if (name === 'idle' || name === 'run') {
                    this.actions[name].setLoop(THREE.LoopRepeat);
                // --- JUMP: ジャンプアニメーションの設定を削除 ---
                // } else if (name === 'jump') {
                //     this.actions[name].setLoop(THREE.LoopOnce);
                //     this.actions[name].clampWhenFinished = true;
                // --- JUMP: ここまで ---
                } else { // kick など
                    this.actions[name].setLoop(THREE.LoopOnce);
                    this.actions[name].clampWhenFinished = true;
                }
            } else {
                console.warn(`Character._setupAnimations: Animation clip for "${name}" is not a valid THREE.AnimationClip or is missing. Received:`, clip);
            }
        }
        console.log("Character._setupAnimations: Final this.actions object:", this.actions);
        if (this.actions['idle']) {
            this.switchAnimation('idle');
            console.log("Character._setupAnimations: Initial animation set to 'idle'.");
        } else {
            console.error("Character._setupAnimations: 'idle' animation action not found. Cannot set initial animation.");
        }
    }

    _createPhysicsBody(initialPosition, height, radius, mass) {
        this.physicsBody = this.physicsManager.createCharacterPhysicsBody(initialPosition, height, radius, mass);
        if (this.physicsBody) { // nullチェック追加
            this.physicsBody.setAngularFactor(new this.physicsManager.AmmoAPI.btVector3(0, 1, 0));
            this.syncPhysicsToModel(this.physicsManager.getTempTransform(), height);
        } else {
            console.error("Character._createPhysicsBody: Failed to create physics body.");
        }
    }

    _onAnimationFinished(event) {
        console.log(`Character._onAnimationFinished: Animation "${Object.keys(this.actions).find(name => this.actions[name] === event.action)}" finished.`);
        const finishedAction = event.action;
        const finishedActionName = Object.keys(this.actions).find(name => this.actions[name] === finishedAction);

        if (this.onAnimationFinishedCallback) {
            this.onAnimationFinishedCallback(finishedActionName);
        }
    }

    switchAnimation(name, crossFadeDuration = 0.2) { // crossFadeDuration を引数に追加
        console.log(`%cCharacter.switchAnimation: CALLED with "${name}". Current action: "${this.currentActionName}"`, "color: magenta;");

        if (!this.mixer || !this.actions[name]) { // ジャンプアクションがなくてもエラーにならないように
            console.warn(`Character.switchAnimation: Mixer or Action "${name}" not found.`);
            return;
        }
        // --- JUMP: ジャンプアニメーションの無視条件を削除 ---
        // if(this.currentActionName === name && (name === 'idle' || name === 'run' || name === 'jump')) return;
        if(this.currentActionName === name && (name === 'idle' || name === 'run')) return; // idle, run のみのチェックに戻す

        const previousAction = this.actions[this.currentActionName];
        const nextAction = this.actions[name];

        if (previousAction && previousAction !== nextAction) {
            console.log(`Character.switchAnimation: Fading out "${this.currentActionName}".`);
            previousAction.fadeOut(crossFadeDuration);
        }

        nextAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(crossFadeDuration)
            .play();
        console.log(`Character.switchAnimation: Action "${name}" play() and fadeIn() called.`);

        this.currentActionName = name;

        if (name === 'kick') {
            this.canPlayAction = false;
            this.kickActionStartTime = performance.now();
            this.beamGeneratedDuringKick = false; // Gameクラスでビーム生成を管理
            // リング生成
            if (this.projectileManager) {
                const worldForward = this.localForwardDirection.clone().applyQuaternion(this.model.quaternion);
                this.projectileManager.createRing(this.model, worldForward);
            }
            console.log("Character.switchAnimation: Kick action processing."); // ★ ログ追加
        } else {
            // キック以外のアニメーションに切り替わった場合
            this.kickActionStartTime = null;
        }
    }

    update(delta, inputManager, camera, speed, rotationSpeed) {
        if (!this.model || !this.mixer || !this.physicsBody) return;

        let disableMovementInput = false;
        if (this.currentActionName === 'kick' && this.actions['kick'] && this.actions['kick'].isRunning()) {
            disableMovementInput = true;
　　　　}

        const moveF = inputManager.isPhysicalKeyPressed('KeyW') || inputManager.isPhysicalKeyPressed('ArrowUp');
        const moveB = inputManager.isPhysicalKeyPressed('KeyS') || inputManager.isPhysicalKeyPressed('ArrowDown');
        const moveL = inputManager.isPhysicalKeyPressed('KeyA') || inputManager.isPhysicalKeyPressed('ArrowLeft');
        const moveR = inputManager.isPhysicalKeyPressed('KeyD') || inputManager.isPhysicalKeyPressed('ArrowRight');

        this.isMoving = false;
        this.moveDirection.set(0, 0, 0);
        let targetSpeed = 0;
        const effectiveSpeed = speed; // 空中制御係数を使うならここで調整

    if (!disableMovementInput) { // ★ 移動入力が無効でない場合のみ、移動と回転の処理を行う
        const isTryingToMove = moveF || moveB || moveL || moveR; // ★ isTryingToMove をここで定義
            if (isTryingToMove) { // isTryingToMove が true の場合の処理を開始
            this.isMoving = true;
            camera.getWorldDirection(this.cameraDirection);
            this.cameraDirection.y = 0;
            this.cameraDirection.normalize();
            const rightDirection = new THREE.Vector3().crossVectors(this.cameraDirection, camera.up).normalize();

            if (moveF) this.moveDirection.add(this.cameraDirection);
            if (moveB) this.moveDirection.sub(this.cameraDirection);
            if (moveL) this.moveDirection.sub(rightDirection);
            if (moveR) this.moveDirection.add(rightDirection);

            if (this.moveDirection.lengthSq() > 0) {
                this.moveDirection.normalize();
                targetSpeed = effectiveSpeed;

                const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(this.localForwardDirection, this.moveDirection);
                this.model.quaternion.slerp(targetQuaternion, rotationSpeed * delta * 5.0);
            }
        }
    }

        const currentVelocity = this.physicsBody.getLinearVelocity();
        const desiredVelocity = new this.physicsManager.AmmoAPI.btVector3(
            this.moveDirection.x * targetSpeed,
            currentVelocity.y(), // Y方向の速度はジャンプと重力に任せる
            this.moveDirection.z * targetSpeed
        );
        this.physicsBody.setLinearVelocity(desiredVelocity);

        if (targetSpeed > 0) { // ジャンプ中もアクティブに
            this.physicsBody.activate();
        }

        const actualHorizontalSpeed = Math.sqrt(desiredVelocity.x() * desiredVelocity.x() + desiredVelocity.z() * desiredVelocity.z());

        // --- アニメーションの更新 ---
        let targetAnimation;
         // ★ キックアニメーション再生中は、他のアニメーションに切り替えないようにする
         if (this.currentActionName === 'kick' && this.actions['kick'] && this.actions['kick'].isRunning()) {
             targetAnimation = 'kick'; // 現在のキックアニメーションを維持
         } else if (actualHorizontalSpeed > speed * 0.01) {
             targetAnimation = 'run';
         } else {
             targetAnimation = 'idle';
         }

         // アニメーション切り替えロジック
         if (this.currentActionName !== targetAnimation && this.actions[targetAnimation]) {
             this.switchAnimation(targetAnimation);
         } else if (!this.actions[targetAnimation] && targetAnimation !== 'kick') { // kick以外でアクションがない場合
              console.warn(`Character.update: Target animation "${targetAnimation}" does not exist.`);
         }

         this.mixer.update(delta);
     } // ★★★ update メソッドの閉じ括弧 ★★★

    syncPhysicsToModel(tempTransform, characterHeight) {
        if (this.model && this.physicsBody && tempTransform) {
            const motionState = this.physicsBody.getMotionState();
            if (motionState) {
                motionState.getWorldTransform(tempTransform);
                const p = tempTransform.getOrigin();
                this.model.position.set(p.x(), p.y() - characterHeight / 2, p.z());
            }
        }
    }

    startKickAction() {
        console.log("Character.startKickAction: CALLED. canPlayAction:", this.canPlayAction); // ★ ログ追加
        if (this.canPlayAction) { // isGrounded のチェックを外す (isGrounded自体はtrueにしてある)
            this.switchAnimation('kick');
            // this.canPlayAction = false; // アクション中は再実行不可  ★ ここで false にするのも良いが、switchAnimation側で一元管理する方が良い
            console.log("Character.startKickAction: Switched to kick. canPlayAction is now (or will be set by switchAnimation):", this.canPlayAction); // ★ ログ追加
            return true;
        }
        console.log("Character.startKickAction: Cannot play kick action (canPlayAction is false)."); // ★ ログ追加
        return false;
    }
}