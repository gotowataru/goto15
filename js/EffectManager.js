// EffectManager.js
import * as THREE from 'three';
import { MAZE_SCALE } from './constants.js';

// --- (壁衝突パーティクル用) ---
const IMPACT_PARTICLE_COUNT = 150;
const IMPACT_PARTICLE_LIFETIME = 0.4;
const IMPACT_PARTICLE_BASE_SPEED = 80 * (MAZE_SCALE || 1);
const IMPACT_PARTICLE_SPREAD = 3.5;
const IMPACT_PARTICLE_SIZE = 0.3 * (MAZE_SCALE || 1);
const IMPACT_PARTICLE_COLOR = 0xffcc66;
const IMPACT_GRAVITY_EFFECT = 9.8 * (MAZE_SCALE || 1) * 5;

// --- (火花用) ---
const SPARK_PARTICLE_COUNT = 40;
const SPARK_LIFETIME = 0.5; // 時間
const SPARK_BASE_SPEED = 150 * (MAZE_SCALE || 1);
const SPARK_SPREAD = 2.0;
const SPARK_SIZE = 1.0 * (MAZE_SCALE || 1); // 大きさ
// SPARK_COLOR は引数で受け取る

// --- (デブリ用) ---
const DEBRIS_COUNT = 32;
const DEBRIS_LIFETIME = 1.0; // 時間
const DEBRIS_BASE_SPEED = 70 * (MAZE_SCALE || 1);
const DEBRIS_SPREAD_XY = 1.8; // XY方向の広がり
const DEBRIS_SPREAD_Y_MIN = 0.4; // Y方向の最低初速係数
const DEBRIS_SPREAD_Y_MAX = 0.8; // Y方向の最高初速係数
const DEBRIS_BOX_SIZE = 1.0 * (MAZE_SCALE || 1); // 立方体の一辺の長さ(大きさ)
const DEBRIS_GRAVITY = 9.8 * (MAZE_SCALE || 1) * 10;
const DEBRIS_MAX_BOUNCES = 3;
const DEBRIS_RESTITUTION = 0.4; // 反発係数

export class EffectManager {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];

        // 壁衝突パーティクル用マテリアル
        this.impactParticleMaterial = new THREE.PointsMaterial({
            color: IMPACT_PARTICLE_COLOR,
            size: IMPACT_PARTICLE_SIZE,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        // 火花用マテリアル (ベース) - 色やサイズは生成時に調整
        this.sparkParticleBaseMaterial = new THREE.PointsMaterial({
            size: SPARK_SIZE, // 基本サイズ
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        });

        // デブリ用のジオメトリとマテリアル (ベース)
        this.debrisGeometry = new THREE.BoxGeometry(DEBRIS_BOX_SIZE, DEBRIS_BOX_SIZE, DEBRIS_BOX_SIZE);
        this.debrisBaseMaterial = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.2 });
    }

    // 壁衝突時のエフェクト (パーティクル)
    createImpactEffect(position, normal) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const velocities = [];
        const startTimes = [];

        for (let i = 0; i < IMPACT_PARTICLE_COUNT; i++) {
            vertices.push(position.x, position.y, position.z);
            const velocity = normal.clone().negate();
            velocity.x += (Math.random() - 0.5) * IMPACT_PARTICLE_SPREAD;
            velocity.y += (Math.random() - 0.5) * IMPACT_PARTICLE_SPREAD;
            velocity.z += (Math.random() - 0.5) * IMPACT_PARTICLE_SPREAD;
            velocity.normalize().multiplyScalar(IMPACT_PARTICLE_BASE_SPEED * (0.7 + Math.random() * 0.6));
            velocities.push(velocity);
            startTimes.push(performance.now());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const particles = new THREE.Points(geometry, this.impactParticleMaterial);
        particles.userData = {
            type: 'impact_particle', // タイプを明確に
            velocities: velocities,
            startTimes: startTimes,
            creationTime: performance.now(),
            lifetime: IMPACT_PARTICLE_LIFETIME // 個別の寿命をuserDataに持たせる
        };
        this.scene.add(particles);
        this.activeEffects.push(particles);
    }

    // 球体破壊時の火花エフェクト
    createSparkExplosion(position, color = 0xffdd88) {

     console.log("EffectManager: createSparkExplosion called at", position); // ★ログ追加
     console.log("EffectManager: createDebrisExplosion called at", position); // ★ログ追加

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const velocities = [];
        const startTimes = [];

        for (let i = 0; i < SPARK_PARTICLE_COUNT; i++) {
            vertices.push(position.x, position.y, position.z);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(SPARK_BASE_SPEED * (0.8 + Math.random() * 0.4));
            velocities.push(velocity);
            startTimes.push(performance.now());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const sparkMaterialInstance = this.sparkParticleBaseMaterial.clone();
        sparkMaterialInstance.color.set(color);
        // sparkMaterialInstance.size = SPARK_SIZE; // ベースマテリアルで設定済みなら不要

        const sparks = new THREE.Points(geometry, sparkMaterialInstance);
        sparks.userData = {
            type: 'spark_particle',
            velocities: velocities,
            startTimes: startTimes,
            creationTime: performance.now(),
            lifetime: SPARK_LIFETIME
        };
        this.scene.add(sparks);
        this.activeEffects.push(sparks);
    }

    // 球体破壊時のデブリ (破片) エフェクト
    createDebrisExplosion(position, color = 0x888888) {
        const debrisGroup = new THREE.Group();
        debrisGroup.userData = {
            type: 'debris_container',
            creationTime: performance.now(),
            // グループ全体の寿命目安 (個々のデブリが消えたら自動的に消えるようにする)
        };

        for (let i = 0; i < DEBRIS_COUNT; i++) {
            const debrisMaterialInstance = this.debrisBaseMaterial.clone();
            debrisMaterialInstance.color.set(color);
            const debrisMesh = new THREE.Mesh(this.debrisGeometry, debrisMaterialInstance);
            debrisMesh.position.copy(position);

            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * DEBRIS_SPREAD_XY,
                (Math.random() * (DEBRIS_SPREAD_Y_MAX - DEBRIS_SPREAD_Y_MIN) + DEBRIS_SPREAD_Y_MIN) * DEBRIS_BASE_SPEED, // Y方向の初速を調整
                (Math.random() - 0.5) * DEBRIS_SPREAD_XY
            );
            // Y以外の速度成分を正規化してからスケール
            const horizontalSpeed = DEBRIS_BASE_SPEED * (0.6 + Math.random() * 0.4);
            const horizontalDir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
            velocity.x = horizontalDir.x * horizontalSpeed;
            velocity.z = horizontalDir.z * horizontalSpeed;


            debrisMesh.userData = {
                velocity: velocity,
                startTime: performance.now(), // 個々のデブリの生成（アニメーション開始）時間
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5
                ),
                bounces: 0,
                maxBounces: DEBRIS_MAX_BOUNCES,
                restitution: DEBRIS_RESTITUTION,
                lifetime: DEBRIS_LIFETIME // 個々のデブリの寿命
            };
            debrisGroup.add(debrisMesh);
        }
        this.scene.add(debrisGroup);
        this.activeEffects.push(debrisGroup);
    }


    // 唯一の update メソッド
    update(delta) {
        const now = performance.now();
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];

            if (effect.userData.type === 'impact_particle' || effect.userData.type === 'spark_particle') {
                // --- ポイントベースのパーティクル処理 (壁衝突、火花) ---
                const positionsAttribute = effect.geometry.attributes.position;
                if (!positionsAttribute) { // 安全策: ジオメトリが破棄済みなど
                    this.activeEffects.splice(i, 1);
                    continue;
                }
                const velocities = effect.userData.velocities;
                const startTimes = effect.userData.startTimes; // 各パーティクルの開始時間
                const effectLifetime = effect.userData.lifetime; // エフェクトごとの寿命
                let allParticlesInEffectExpired = true;

                for (let j = 0; j < positionsAttribute.count; j++) {
                    const particleElapsedTime = (now - startTimes[j]) / 1000;

                    if (particleElapsedTime < effectLifetime) {
                        allParticlesInEffectExpired = false;
                        const currentX = positionsAttribute.getX(j);
                        const currentY = positionsAttribute.getY(j);
                        const currentZ = positionsAttribute.getZ(j);

                        positionsAttribute.setXYZ(j,
                            currentX + velocities[j].x * delta,
                            currentY + velocities[j].y * delta,
                            currentZ + velocities[j].z * delta
                        );
                        if (effect.userData.type === 'impact_particle') { // 壁衝突のみ重力
                            velocities[j].y -= IMPACT_GRAVITY_EFFECT * delta;
                        }
                    }
                }
                positionsAttribute.needsUpdate = true;

                // エフェクト全体の寿命 (最初のパーティクルが生成されてから) で消去
                if (allParticlesInEffectExpired || (now - effect.userData.creationTime) / 1000 > effectLifetime + 0.1) {
                    this.scene.remove(effect);
                    if (effect.geometry) effect.geometry.dispose();
                    if (effect.material && effect.material.dispose && !this.isSharedMaterial(effect.material)) {
                         // クローンしたマテリアルなら破棄
                        effect.material.dispose();
                    }
                    this.activeEffects.splice(i, 1);
                }

            } else if (effect.userData.type === 'debris_container') {
                // --- デブリグループの処理 ---
                let activeDebrisCount = 0;
                effect.children.forEach(debrisMesh => {
                    if (!debrisMesh.userData) return;

                    const elapsedTime = (now - debrisMesh.userData.startTime) / 1000;
                    if (elapsedTime < debrisMesh.userData.lifetime && debrisMesh.visible) {
                        activeDebrisCount++;
                        debrisMesh.position.addScaledVector(debrisMesh.userData.velocity, delta);
                        debrisMesh.userData.velocity.y -= DEBRIS_GRAVITY * delta;

                        debrisMesh.rotation.x += debrisMesh.userData.angularVelocity.x * delta;
                        debrisMesh.rotation.y += debrisMesh.userData.angularVelocity.y * delta;
                        debrisMesh.rotation.z += debrisMesh.userData.angularVelocity.z * delta;

                        const groundY = 0; // TODO: 地面の高さを適切に設定
                        const debrisBottomY = debrisMesh.position.y - DEBRIS_BOX_SIZE / 2;

                        if (debrisBottomY <= groundY && debrisMesh.userData.velocity.y < 0) {
                            if (debrisMesh.userData.bounces < debrisMesh.userData.maxBounces) {
                                debrisMesh.position.y = groundY + DEBRIS_BOX_SIZE / 2;
                                debrisMesh.userData.velocity.y *= -debrisMesh.userData.restitution;
                                debrisMesh.userData.velocity.x *= 0.8;
                                debrisMesh.userData.velocity.z *= 0.8;
                                debrisMesh.userData.angularVelocity.multiplyScalar(0.7);
                                debrisMesh.userData.bounces++;
                            } else {
                                // 最大バウンド後、静止（またはゆっくり消える）
                                debrisMesh.userData.velocity.set(0, 0, 0);
                                debrisMesh.userData.angularVelocity.set(0,0,0);
                                debrisMesh.position.y = groundY + DEBRIS_BOX_SIZE / 2 * 0.5; // 少しめり込ませる
                                // ここで slowlyFadeAndRemove(debrisMesh) みたいな関数を呼んでも良い
                                debrisMesh.visible = false; // とりあえず非表示に
                            }
                        }
                    } else {
                        debrisMesh.visible = false; // 寿命が来たら非表示
                    }
                });

                // すべてのデブリが非表示（寿命切れ）になったらグループを削除
                if (activeDebrisCount === 0 || (now - effect.userData.creationTime) / 1000 > DEBRIS_LIFETIME + 2.0) { // 念のためグループ全体のタイムアウト
                    effect.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material && child.material.dispose) child.material.dispose();
                    });
                    this.scene.remove(effect);
                    this.activeEffects.splice(i, 1);
                }
            }
        }
    }

    // 共有マテリアルかどうかを判定するヘルパー（PointsMaterialはクローンしない前提なら不要）
    isSharedMaterial(material) {
        return material === this.impactParticleMaterial || material === this.sparkParticleBaseMaterial || material === this.debrisBaseMaterial;
    }
}