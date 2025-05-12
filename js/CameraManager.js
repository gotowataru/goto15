// CameraManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    CAMERA_Y_OFFSET, CAMERA_OFFSET,
    INITIAL_CAMERA_DISTANCE, CAMERA_FOLLOW_SPEED, CAMERA_COLLISION_OFFSET,
    CAMERA_CORRECTION_LERP_SPEED, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE // これらは updateCamera に渡される
} from './constants.js';

export class CameraManager {
    constructor(camera, rendererDomElement, collidables) {
        this.camera = camera;
        this.controls = new OrbitControls(this.camera, rendererDomElement);
        this.collidables = collidables; // 壁などのThree.jsメッシュの配列

        this.raycaster = new THREE.Raycaster();
        this.raycaster.near = 0.1; // レイキャストのニアクリップ

        this._configureControls();

        this.userZoomJustReset = false; // ズームがリセットされたフレームかを示すフラグ
    }

    _configureControls() {
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = MAX_ZOOM_DISTANCE * 1.2; // OrbitControls自体の最大距離は少し大きめに
        this.controls.enableZoom = false; // 自前のズームロジックを使用
        // minDistance も設定するなら
        // this.controls.minDistance = MIN_ZOOM_DISTANCE * 0.8;
    }

    getMainCamera() {
        return this.camera;
    }

    getControls() {
        return this.controls;
    }

    setInitialCameraState(characterModel) {
        if (characterModel && this.controls) {
            const initialTargetPosition = characterModel.position.clone().add(new THREE.Vector3(0, CAMERA_Y_OFFSET, 0));
            this.controls.target.copy(initialTargetPosition);

            const initialCameraDirection = CAMERA_OFFSET.clone().normalize();
            const initialCameraPos = initialTargetPosition.clone().addScaledVector(initialCameraDirection, INITIAL_CAMERA_DISTANCE);
            this.camera.position.copy(initialCameraPos);

            this.controls.update(); // OrbitControlsの内部状態を更新
            // console.log("メインカメラ初期視点設定完了 (CameraManager).");
        }
    }

    updateCamera(characterModel, isCharacterMoving, inputManager) {
        this.userZoomJustReset = false;
        let currentDesiredDistance = inputManager.getDesiredCameraDistance();
        const userHadZoomed = inputManager.getUserHasZoomed(); // 更新前の状態を取得

        // ユーザーが手動ズーム後、キャラクターが移動開始したら自動で初期距離に戻す
        if (userHadZoomed && isCharacterMoving) {
            const LERP_FACTOR_ZOOM_RESET = 0.08; // ズームリセットの補間係数
            currentDesiredDistance = THREE.MathUtils.lerp(currentDesiredDistance, INITIAL_CAMERA_DISTANCE, LERP_FACTOR_ZOOM_RESET);

            if (Math.abs(currentDesiredDistance - INITIAL_CAMERA_DISTANCE) < 0.5) {
                currentDesiredDistance = INITIAL_CAMERA_DISTANCE;
                inputManager.setUserHasZoomed(false); // ズームリセット完了
                this.userZoomJustReset = true;
            }
            inputManager.setDesiredCameraDistance(currentDesiredDistance); // InputManagerの値を更新
        }


        let idealCameraTargetPosition = null;
        let calculatedCameraPosition; // 壁衝突考慮前のカメラ位置
        let collisionCorrectedCameraPosition = null; // 壁衝突考慮後のカメラ位置

        if (this.controls && characterModel) {
            // 1. カメラの理想的な注視点 (OrbitControlsのtarget) を計算
            idealCameraTargetPosition = characterModel.position.clone().add(new THREE.Vector3(0, CAMERA_Y_OFFSET, 0));

            // 2. OrbitControlsのtargetを理想的な注視点に滑らかに追従
            this.controls.target.lerp(idealCameraTargetPosition, CAMERA_FOLLOW_SPEED);

            // 3. 現在のカメラ位置から更新されたcontrols.targetへの方向ベクトルを取得
            const directionToTarget = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).normalize();
            let directionFromTargetToCamera = directionToTarget.clone().negate(); // ターゲットからカメラへの方向

            // 稀にカメラとターゲットが一致して方向ベクトルがゼロになる場合へのフォールバック
            if (directionFromTargetToCamera.lengthSq() === 0) {
                directionFromTargetToCamera.copy(CAMERA_OFFSET).normalize().negate();
            }

            // 4. 望ましい距離に基づいてカメラの計算上の位置を決定
            calculatedCameraPosition = this.controls.target.clone().addScaledVector(directionFromTargetToCamera, currentDesiredDistance);

            // 5. 壁との衝突判定とカメラ位置補正
            const rayOrigin = idealCameraTargetPosition.clone(); // レイの始点 (キャラクター頭上)
            const rayDirection = new THREE.Vector3().subVectors(calculatedCameraPosition, rayOrigin).normalize();
            const rayDistance = calculatedCameraPosition.distanceTo(rayOrigin);

            this.raycaster.set(rayOrigin, rayDirection);
            this.raycaster.far = rayDistance; // レイの最大長
            this.raycaster.near = MIN_ZOOM_DISTANCE * 0.8; // これより手前には補正しない

            const cameraIntersects = this.raycaster.intersectObjects(this.collidables, false); // false: 子孫はチェックしない

            if (cameraIntersects.length > 0) {
                const closestHit = cameraIntersects[0]; // 最も近い衝突
                // 衝突点より少し手前にカメラを移動 (めり込み防止)
                const newDistance = Math.max(this.raycaster.near, closestHit.distance - CAMERA_COLLISION_OFFSET);
                collisionCorrectedCameraPosition = rayOrigin.clone().addScaledVector(rayDirection, newDistance);
            }
        } else if (this.controls) { // キャラクターモデルがない場合 (フォールバック)
            calculatedCameraPosition = this.camera.position.clone();
        } else { // OrbitControlsもない場合 (ありえないはず)
            calculatedCameraPosition = this.camera.position.clone();
        }

        // 6. 最終的なカメラの目標位置を決定
        const finalCameraTargetPos = collisionCorrectedCameraPosition !== null ? collisionCorrectedCameraPosition : calculatedCameraPosition;

        // 7. 現在のカメラ位置から最終目標位置へ滑らかに補間
        if (finalCameraTargetPos) { // 念のためundefinedチェック
            this.camera.position.lerp(finalCameraTargetPos, CAMERA_CORRECTION_LERP_SPEED);
        }

        // 8. OrbitControlsのupdateを呼び出し、内部状態を更新
        this.controls.update();
    }
}