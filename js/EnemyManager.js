// EnemyManager.js
import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import {
    ENEMY_DEFAULT_SCALE, ENEMY_HEIGHT_FACTOR, ENEMY_RADIUS_FACTOR,
    // CHARACTER_INITIAL_POSITION // 必要に応じてコメント解除
} from './constants.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'; // スケルトンアニメーション付きモデルのクローンに推奨

export class EnemyManager {
    constructor(scene, physicsManager, playerCharacter, loadedEnemyModels, loadedEnemyAnimations = {}) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.playerCharacter = playerCharacter;
        this.loadedEnemyModels = loadedEnemyModels;
        this.loadedEnemyAnimations = loadedEnemyAnimations;
        this.enemies = [];
        this.enemyTypes = Object.keys(this.loadedEnemyModels);

        console.log("EnemyManager initialized.");
        console.log("Loaded enemy model types:", this.enemyTypes);
        console.log("Loaded enemy animations:", this.loadedEnemyAnimations);
    }

    spawnEnemy(enemyType, position) {
        if (!this.loadedEnemyModels[enemyType]) {
            console.error(`EnemyManager.spawnEnemy: Enemy type "${enemyType}" not found in loaded models.`);
            return null;
        }

        // モデルのクローン (スケルタルアニメーションを考慮して SkeletonUtils.clone を使用)
        console.log(`EnemyManager.spawnEnemy: Attempting to clone model for type "${enemyType}".`);
        const originalModel = this.loadedEnemyModels[enemyType];
        if (!originalModel) {
            console.error(`EnemyManager.spawnEnemy: Original model for type "${enemyType}" is undefined or null.`);
            return null;
        }
        const enemyModel = SkeletonUtils.clone(originalModel);

        enemyModel.traverse(node => {
            if (node.isMesh) {
                if (node.material) {
                    node.material = node.material.clone();
                } else {
                    console.warn(`EnemyManager.spawnEnemy: Mesh in "${enemyType}" model has no material.`);
                }
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        const enemyAnimations = this.loadedEnemyAnimations[enemyType] || [];
        if (enemyAnimations.length === 0) {
            console.warn(`EnemyManager.spawnEnemy: No animations found for enemy type "${enemyType}".`);
        }

        const initialScale = ENEMY_DEFAULT_SCALE;
        // ★ スケール値のログ
        console.log(`EnemyManager.spawnEnemy: ENEMY_DEFAULT_SCALE from constants.js is ${ENEMY_DEFAULT_SCALE}. initialScale for Enemy "${enemyType}" will be ${initialScale}.`);

        const enemyName = `${enemyType}_${this.enemies.length + 1}`;
        console.log(`EnemyManager.spawnEnemy: Creating new Enemy instance: Name="${enemyName}", Type="${enemyType}", Position=(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), Scale=${initialScale}`);

        const enemy = new Enemy(
            enemyName,
            enemyModel,
            this.scene,
            this.physicsManager,
            position,
            initialScale,
            this.playerCharacter,
            enemyAnimations
        );

        this.enemies.push(enemy);
        console.log(`EnemyManager.spawnEnemy: Enemy "${enemy.name}" added to manager. Total enemies: ${this.enemies.length}`);
        return enemy;
    }


    spawnEnemies(
        count,
        spawnAreaCenter = new THREE.Vector3(0, 0, 0),
        spawnRadius = 200,
        fixedY = null
    ) {
        // ★ 呼び出し時の引数確認ログ
        console.log(`EnemyManager.spawnEnemies called with: count=${count}, center=(${spawnAreaCenter.x.toFixed(2)}, ${spawnAreaCenter.y.toFixed(2)}, ${spawnAreaCenter.z.toFixed(2)}), radius=${spawnRadius}, fixedY=${fixedY === null ? 'null' : fixedY.toFixed(2)}`);

        if (this.enemyTypes.length === 0) {
            console.warn("EnemyManager.spawnEnemies: No enemy types loaded, cannot spawn enemies.");
            return;
        }
        if (count <= 0) {
            console.warn(`EnemyManager.spawnEnemies: Count is ${count}, no enemies will be spawned.`);
            return;
        }

        console.log(`EnemyManager.spawnEnemies: Attempting to spawn ${count} enemies.`);

        for (let i = 0; i < count; i++) {
            const randomEnemyTypeIndex = Math.floor(Math.random() * this.enemyTypes.length);
            const randomEnemyType = this.enemyTypes[randomEnemyTypeIndex];

            const angle = Math.random() * Math.PI * 2;
            const radiusOffset = Math.random() * spawnRadius;
            const x = spawnAreaCenter.x + radiusOffset * Math.cos(angle);
            const z = spawnAreaCenter.z + radiusOffset * Math.sin(angle);

            let y;
            if (fixedY !== null) {
                y = fixedY;
                console.log(`EnemyManager.spawnEnemies: Using fixedY ${y.toFixed(2)} for enemy ${i + 1} (${randomEnemyType}).`);
            } else {
                const enemyHeight = ENEMY_HEIGHT_FACTOR * ENEMY_DEFAULT_SCALE; // スポーン時のY計算にはデフォルトスケールを使用
                y = (enemyHeight / 2) + 0.2; // 物理ボディの中心がこのYに来るように
                console.log(`EnemyManager.spawnEnemies: Calculated spawn Y for enemy ${i + 1} (${randomEnemyType}): ${y.toFixed(2)} (based on height ${enemyHeight.toFixed(2)})`);
            }

            const spawnPosition = new THREE.Vector3(x, y, z);

            // ★ スポーン位置のログ
            console.log(`EnemyManager.spawnEnemies: Spawning enemy ${i + 1}/${count} (Type: "${randomEnemyType}") at: X=${spawnPosition.x.toFixed(2)}, Y=${spawnPosition.y.toFixed(2)}, Z=${spawnPosition.z.toFixed(2)}`);

            this.spawnEnemy(randomEnemyType, spawnPosition);
        }
        console.log(`EnemyManager.spawnEnemies: Finished spawning. ${this.enemies.length} enemies are now active.`);
    }

    update(deltaTime, playerPosition) {
        if (!playerPosition) {
            // console.warn("EnemyManager.update: playerPosition is undefined. Enemies may not behave correctly.");
            // playerPosition が未定義の場合、敵の更新で問題が起きる可能性があるためログ追加も検討
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.isAlive) {
                enemy.update(deltaTime, playerPosition);
            } else {
                // 敵が isAlive === false の場合、リストから除去する
                // Enemy.js の die() メソッドで removeFromWorld() が呼ばれ、
                // シーンと物理ワールドからは既に除去されている想定。
                // ここでは EnemyManager の管理リストから参照を外す。
                const deadEnemyName = enemy.name; // spliceする前に名前を保持
                this.enemies.splice(i, 1);
                console.log(`EnemyManager.update: Enemy "${deadEnemyName}" was not alive and has been removed from manager's active list. Remaining enemies: ${this.enemies.length}`);
            }
        }
    }

    // 必要に応じて他のヘルパーメソッド
    // getEnemyByModel(model) { ... }
    // getEnemyByPhysicsBody(physicsBody) { ... }
}
