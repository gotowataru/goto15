// InputManager.js
import {
    INITIAL_CAMERA_DISTANCE, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE, ZOOM_SPEED_FACTOR
} from './constants.js';

export class InputManager {
    constructor(domElement) {
        this.keys = {}; // 汎用的なキーの状態 (現在押されているか)

        // スペースキー (キック) 用のフラグ
        this.isSpaceKeyCurrentlyPressed = false; // スペースキーが物理的に押されているか
        this._isSpacePressedThisFrame = false;   // 1フレームだけtrueになるフラグ (消費型)

        // Jキー (ジャンプ) 用のフラグ
        this.isJKeyCurrentlyPressed = false;   // Jキーが物理的に押されているか
        this._isJPressedThisFrame = false;      // 1フレームだけtrueになるフラグ (消費型)

        this.desiredCameraDistance = INITIAL_CAMERA_DISTANCE;
        this.userHasZoomed = false;

        document.addEventListener('keydown', this._onKeyDown.bind(this));
        document.addEventListener('keyup', this._onKeyUp.bind(this));
        domElement.addEventListener('wheel', this._onMouseWheel.bind(this), { passive: false });
    }

    _onKeyDown(event) {
        const key = event.code; // event.key.toLowerCase() から event.code に変更推奨
                               // ' ' (スペース) は event.key で良いが、アルファベットキーは
                               // 大文字・小文字や修飾キーの影響を受けない event.code が安定
        this.keys[key] = true;

        // スペースキーの処理
        if (key === 'Space' && !this.isSpaceKeyCurrentlyPressed) {
            this.isSpaceKeyCurrentlyPressed = true;
            this._isSpacePressedThisFrame = true;
        }

        // Jキーの処理 (スペースキーと同様のロジック)
        if (key === 'KeyJ' && !this.isJKeyCurrentlyPressed) {
            this.isJKeyCurrentlyPressed = true;
            this._isJPressedThisFrame = true;
        }
    }

    _onKeyUp(event) {
        const key = event.code; // event.key.toLowerCase() から event.code に変更推奨
        this.keys[key] = false;

        if (key === 'Space') {
            this.isSpaceKeyCurrentlyPressed = false;
        }

        if (key === 'KeyJ') {
            this.isJKeyCurrentlyPressed = false;
        }
    }

    _onMouseWheel(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 1 : -1;
        this.desiredCameraDistance += delta * this.desiredCameraDistance * ZOOM_SPEED_FACTOR;
        this.desiredCameraDistance = Math.max(MIN_ZOOM_DISTANCE, Math.min(MAX_ZOOM_DISTANCE, this.desiredCameraDistance));
        this.userHasZoomed = true;
    }

    // 特定のキーが現在押されているか (押しっぱなし判定用)
    isPhysicalKeyPressed(keyCode) { // メソッド名を isKeyPressed から isPhysicalKeyPressed に変更 (汎用的なキー状態のため)
        return this.keys[keyCode] === true;
    }

    // スペースキーがこのフレームで押された瞬間か (単発アクション用)
    consumeSpacePress() {
        if (this._isSpacePressedThisFrame) {
            this._isSpacePressedThisFrame = false;
            return true;
        }
        return false;
    }

    // Jキーがこのフレームで押された瞬間か (単発アクション用)
    consumeJPress() {
        if (this._isJPressedThisFrame) {
            this._isJPressedThisFrame = false;
            return true;
        }
        return false;
    }

    getDesiredCameraDistance() {
        return this.desiredCameraDistance;
    }

    setDesiredCameraDistance(distance) {
        this.desiredCameraDistance = distance;
    }

    setUserHasZoomed(hasZoomed) {
        this.userHasZoomed = hasZoomed;
    }

    getUserHasZoomed() {
        return this.userHasZoomed;
    }
}