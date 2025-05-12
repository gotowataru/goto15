// SphereManager.js
import * as THREE from 'three';
import {
    MIN_SPHERE_RADIUS, MAX_SPHERE_RADIUS, SPHERE_INITIAL_Y_OFFSET,
    SPHERE_MASS, SPHERE_FRICTION, SPHERE_RESTITUTION
} from './constants.js';

export class SphereManager {
    constructor(scene, physicsManager, raycastTargetsArrayRef) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        // raycastTargetsはGameクラスが持つ配列への参照。球体を追加・削除する。
        this.raycastTargetsRef = raycastTargetsArrayRef;
        this.spheres = []; // Three.js Meshと物理ボディのペアを管理 { mesh, body }
    }

    createSpheres(numSpheres, mazeModel) {
        if (!mazeModel) {
            console.warn("Maze model not available for sphere placement.");
            return;
        }
        const mazeBoundingBox = new THREE.Box3().setFromObject(mazeModel);
        const mazeSize = mazeBoundingBox.getSize(new THREE.Vector3());
        const mazeCenter = mazeBoundingBox.getCenter(new THREE.Vector3());

        for (let i = 0; i < numSpheres; i++) {
            const radius = THREE.MathUtils.randFloat(MIN_SPHERE_RADIUS, MAX_SPHERE_RADIUS);
            const geometry = new THREE.SphereGeometry(radius, 16, 16); // セグメント数を調整
            const color = new THREE.Color(Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2, Math.random() * 0.8 + 0.2); // やや明るめに
            const material = new THREE.MeshPhongMaterial({ color: color, shininess: 30 });
            material.castShadow = true;
            material.receiveShadow = true;
            const sphereMesh = new THREE.Mesh(geometry, material);

            // ランダムな位置 (迷路の範囲内、かつ地面から少し浮かせた高さ)
            const x = THREE.MathUtils.randFloat(mazeCenter.x - mazeSize.x / 2 * 0.7, mazeCenter.x + mazeSize.x / 2 * 0.7); // 少し内側に
            const z = THREE.MathUtils.randFloat(mazeCenter.z - mazeSize.z / 2 * 0.7, mazeCenter.z + mazeSize.z / 2 * 0.7);
            const y = mazeBoundingBox.max.y + SPHERE_INITIAL_Y_OFFSET + THREE.MathUtils.randFloat(0, MAX_SPHERE_RADIUS * 1.5);
            sphereMesh.position.set(x, y, z);
            sphereMesh.name = `Sphere_${i}`; // デバッグ用

            this.scene.add(sphereMesh);

            // 物理ボディを作成
            const physicsBody = this.physicsManager.createSpherePhysicsBody(
                sphereMesh, radius, SPHERE_MASS, SPHERE_FRICTION, SPHERE_RESTITUTION
            );

            if (physicsBody) {
                this.spheres.push({ mesh: sphereMesh, body: physicsBody });
                this.raycastTargetsRef.push(sphereMesh); // ビーム衝突判定用に追加
            } else {
                // 物理ボディ作成失敗時はメッシュも削除
                this.scene.remove(sphereMesh);
                geometry.dispose();
                material.dispose();
            }
        }
        // console.log(`${this.spheres.length} 個の球体を生成・配置しました (SphereManager).`);
    }

    isSphere(object) {
        return this.spheres.some(s => s.mesh === object);
    }

    destroySphereByMesh(sphereMesh) {
        const sphereIndex = this.spheres.findIndex(s => s.mesh === sphereMesh);
        if (sphereIndex === -1) return; // 管理下にない球体

        const sphereData = this.spheres[sphereIndex];

        // 1. Ammo.js 物理ボディを削除
        if (sphereData.body) {
            this.physicsManager.removeRigidBody(sphereData.body);
        }

        // 2. Three.js メッシュをシーンから削除
        if (sphereMesh.parent) {
            sphereMesh.parent.remove(sphereMesh);
        }

        // 3. GeometryとMaterialを解放
        if (sphereMesh.geometry) sphereMesh.geometry.dispose();
        if (sphereMesh.material) {
            if (Array.isArray(sphereMesh.material)) {
                sphereMesh.material.forEach(mat => mat.dispose());
            } else {
                sphereMesh.material.dispose();
            }
        }

        // 4. 管理配列から除去
        this.spheres.splice(sphereIndex, 1);

        // 5. raycastTargets配列からも除去
        const indexInRaycastTargets = this.raycastTargetsRef.indexOf(sphereMesh);
        if (indexInRaycastTargets !== -1) {
            this.raycastTargetsRef.splice(indexInRaycastTargets, 1);
        }
        // console.log(`${sphereMesh.name} 破壊完了 (SphereManager).`);
    }

    syncAllSpheres(tempTransform) {
        if (!tempTransform) return;
        for (const sphereData of this.spheres) {
            if (sphereData.body) {
                const motionState = sphereData.body.getMotionState();
                if (motionState) {
                    motionState.getWorldTransform(tempTransform);
                    const p = tempTransform.getOrigin();
                    sphereData.mesh.position.set(p.x(), p.y(), p.z());
                    const q = tempTransform.getRotation();
                    sphereData.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
                }
            }
        }
    }
}