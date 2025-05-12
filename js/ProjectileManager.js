// ProjectileManager.js
import * as THREE from 'three';
import {
    BEAM_COLOR, BEAM_RADIUS, BEAM_LENGTH, BEAM_SPEED, // BEAM_RAYCAST_DISTANCE は不要
    RING_COLOR, RING_RADIUS, RING_DURATION, BEAM_SPAWN_OFFSET_FORWARD,
    RING_SPAWN_OFFSET_FORWARD, RING_SPAWN_OFFSET_UP, CHARACTER_HEIGHT,
    MAX_BEAM_LIFETIME // constants.js に定義されていることを想定
} from './constants.js';

export class ProjectileManager {

    constructor(scene, raycastTargetsGetter, effectManager) {
        this.scene = scene;
        this.getRaycastTargets = raycastTargetsGetter;
        this.effectManager = effectManager;
        this.activeBeams = [];
        this.activeRings = [];

        this.beamRaycaster = new THREE.Raycaster();
        this.beamRaycaster.near = 0.1;

        this._initGeometriesAndMaterials();
    }

    _initGeometriesAndMaterials() {
        this.beamGeometry = new THREE.CylinderGeometry(BEAM_RADIUS * 0.5, BEAM_RADIUS * 0.5, BEAM_LENGTH, 8);
        this.beamGeometry.translate(0, BEAM_LENGTH / 2, 0);
        this.beamMaterial = new THREE.MeshBasicMaterial({ color: BEAM_COLOR, side: THREE.DoubleSide });

        this.ringGeometry = new THREE.TorusGeometry(RING_RADIUS, BEAM_RADIUS * 0.1, 16, 32);
        this.ringMaterial = new THREE.MeshBasicMaterial({ color: RING_COLOR, side: THREE.DoubleSide });
    }

    createRing(characterModel, characterWorldForward) {
        if (!characterModel) return;

        const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
        const forward = characterWorldForward.clone();
        forward.y = 0;
        forward.normalize();

        const characterPosition = characterModel.position.clone();
        const ringPosition = characterPosition.clone()
            .addScaledVector(forward, RING_SPAWN_OFFSET_FORWARD)
            .add(new THREE.Vector3(0, RING_SPAWN_OFFSET_UP, 0));
        ring.position.copy(ringPosition);

        const rotateY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // Y軸回転で垂直に
        const ringHoleDirWhenVertical = new THREE.Vector3(1, 0, 0); // 垂直にしたときの穴の向き (X+を向いていると仮定)
        const alignToForward = new THREE.Quaternion().setFromUnitVectors(ringHoleDirWhenVertical, forward);
        ring.quaternion.copy(rotateY).multiply(alignToForward);

        ring.userData.creationTime = performance.now();
        ring.userData.duration = RING_DURATION * 1000;
        this.scene.add(ring);
        this.activeRings.push(ring);
    }

    createBeam(characterModel, characterWorldForward, charHeight, spawnOffsetFwd) {
        if (!characterModel) return;

        const beam = new THREE.Mesh(this.beamGeometry, this.beamMaterial);
        const forward = characterWorldForward.clone();
        forward.y = 0;
        forward.normalize();

        const characterPosition = characterModel.position.clone();
        const beamSpawnHeight = charHeight * 0.5;
        const beamPosition = characterPosition.clone()
            .addScaledVector(forward, spawnOffsetFwd)
            .add(new THREE.Vector3(0, beamSpawnHeight, 0));
        beam.position.copy(beamPosition);

        const beamDefaultDir = new THREE.Vector3(0, 1, 0);
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(beamDefaultDir, forward);
        beam.quaternion.copy(targetQuaternion);

        beam.userData.direction = forward.clone();
        beam.userData.speed = BEAM_SPEED;
        beam.userData.creationTime = performance.now();
        beam.userData.hasHitWall = false;
        beam.userData.hitSpheresThisFrame = new Set(); // ★ 球体への複数ヒット防止用Setを追加

        this.scene.add(beam);
        this.activeBeams.push(beam);
    }

    update(delta, collisionCallback) {
        const now = performance.now();
        const currentRaycastTargets = this.getRaycastTargets();

        // --- リングの更新 ---
        for (let i = this.activeRings.length - 1; i >= 0; i--) {
            const ring = this.activeRings[i];
            if (now - ring.userData.creationTime > ring.userData.duration) {
                this.scene.remove(ring);
                this.activeRings.splice(i, 1);
            }
        }

        // --- ビームの更新 ---
        for (let i = this.activeBeams.length - 1; i >= 0; i--) {
            const beam = this.activeBeams[i];
            const beamDirection = beam.userData.direction; // 毎フレームアクセスするので変数にキャッシュ

            // 1. 壁に衝突後、表示時間が経過したら消去
            if (beam.userData.hasHitWall && beam.userData.hitTime) {
                if (now - beam.userData.hitTime > (beam.userData.displayDurationAfterHit || 150)) {
                    this.scene.remove(beam);
                    this.activeBeams.splice(i, 1);
                    continue; // このビームの更新は終了
                }
                // 壁に当たったビームはそれ以上何もしない (移動もレイキャストも)
                continue;
            }

            // 2. ビームの寿命チェック (MAX_BEAM_LIFETIME が 0 以下なら無制限寿命)
            if (MAX_BEAM_LIFETIME > 0 && (now - beam.userData.creationTime > MAX_BEAM_LIFETIME)) {
                this.scene.remove(beam);
                this.activeBeams.splice(i, 1);
                continue;
            }

            // 3. ビームを移動 (壁に当たっていなければ)
            const moveDistance = beam.userData.speed * delta;
            beam.position.addScaledVector(beamDirection, moveDistance);

            // 4. ビームの衝突判定
            this.beamRaycaster.set(beam.position, beamDirection); // レイの始点はビームの根元
            this.beamRaycaster.far = BEAM_LENGTH;                   // 判定距離はビームの見た目の長さ

            // intersectObjectsの第2引数は recursive (通常はfalseでOK、ターゲットがGroupでその子も判定したいならtrue)
            const beamIntersects = this.beamRaycaster.intersectObjects(currentRaycastTargets, false);

            if (beamIntersects.length > 0) {
                for (const intersection of beamIntersects) {
                    // 既にこのフレームで壁にヒット処理済みのビームは、他の衝突を見ない
                    if (beam.userData.hasHitWall) break;

                    const hitObject = intersection.object;
                    const hitPoint = intersection.point;
                    const distanceToHit = intersection.distance; // レイの始点からの距離

                    if (collisionCallback) {
                        const action = collisionCallback(hitObject, beam, hitPoint, distanceToHit, intersection);

                        if (action === "stop_and_adjust") {
                            beam.userData.speed = 0; // 移動停止
                            beam.userData.hasHitWall = true;
                            beam.userData.hitTime = now;
                            // displayDurationAfterHit は Game.js のコールバック側や定数で定義しても良い
                            beam.userData.displayDurationAfterHit = 150; // ms

                            const originalLength = BEAM_LENGTH;
                            if (distanceToHit < originalLength && distanceToHit > 0.01) {
                                beam.scale.y = distanceToHit / originalLength;
                            } else if (distanceToHit <= 0.01) { // 非常に近い場合
                                beam.scale.y = 0.01 / originalLength;
                            } else { // distanceToHit >= originalLength の場合 (ほぼ発生しないはず)
                                beam.scale.y = 1.0;
                            }

                            // エフェクト生成
                            if (this.effectManager && intersection.face && intersection.face.normal) {
                                const worldNormal = intersection.face.normal.clone();
                                // hitObject のワールドマトリックスを使って法線を変換
                                const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitObject.matrixWorld);
                                worldNormal.applyMatrix3(normalMatrix).normalize();
                                this.effectManager.createImpactEffect(hitPoint.clone(), worldNormal);
                            }
                            // 壁に当たったら、このビームに対する他の衝突処理は行わない
                            break;
                        } else if (action === "destroy_target_and_continue") {
                            // 破壊可能オブジェクトにヒット。コールバック側で破壊処理済み。
                            // ビームは貫通するので、ここでは何もしない。
                        } else { // "ignore" or other
                            // 無視する場合もビームは貫通。
                        }
                    }
                }
            }
        }
    }
}