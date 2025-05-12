// Minimap.js
import * as THREE from 'three';
import {
    MINIMAP_SIZE_PX, MINIMAP_MARGIN_PX, MINIMAP_CAMERA_Y_OFFSET_FACTOR,
    MINIMAP_INDICATOR_Y_OFFSET, MINIMAP_INDICATOR_SIZE, MAZE_SCALE
} from './constants.js';

export class Minimap {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = null;
        this.characterIndicator = null;
        this.mazeFloor = null; // 床オブジェクトの参照を保持するプロパティ
        this.isEnabled = true; // Game.js側のMINIMAP_ENABLEDで実質制御

        if (this.isEnabled) { // この条件分岐は実質常にtrue (Game.jsで制御済みのため)
            this._initMinimapCamera();
            this._initCharacterIndicator();
        }
    }

    _initMinimapCamera() {
        this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 4000 * MAZE_SCALE);
        this.camera.up.set(0, 0, -1); // カメラの上方向をZ-に (真上から見た視点)
        // this.scene.add(this.camera); // カメラをシーンに追加する必要は通常ない
        this.camera.layers.enableAll(); // ミニマップカメラは全レイヤーを描画
    }

_initCharacterIndicator() {
    const arrowShape = new THREE.Shape();

    // 矢印の頂点を定義 (例: 上向きの矢印)
    // サイズは MINIMAP_INDICATOR_SIZE を基準に調整
    const s = MINIMAP_INDICATOR_SIZE; // 基本サイズ

    // 矢印の先端
    arrowShape.moveTo(0, s); // (x, y)
    // 右肩
    arrowShape.lineTo(s * 0.5, 0);
    // 右くびれ
    arrowShape.lineTo(s * 0.25, 0);
    // 右下
    arrowShape.lineTo(s * 0.25, -s * 0.75);
    // 左下
    arrowShape.lineTo(-s * 0.25, -s * 0.75);
    // 左くびれ
    arrowShape.lineTo(-s * 0.25, 0);
    // 左肩
    arrowShape.lineTo(-s * 0.5, 0);
    // 先端に戻る
    arrowShape.lineTo(0, s);

    // 2D形状からジオメトリを生成
    // Option A: そのまま平面の矢印として使う
    const indicatorGeo = new THREE.ShapeGeometry(arrowShape);

    // Option B: 少し厚みを持たせる (ExtrudeGeometry)
    /*
    const extrudeSettings = {
        steps: 1,
        depth: s * 0.2, // 厚み
        bevelEnabled: false
    };
    const indicatorGeo = new THREE.ExtrudeGeometry(arrowShape, extrudeSettings);
    */

    // ジオメトリの向きを調整 (X軸で90度回転してXY平面からXZ平面にする)
    indicatorGeo.rotateX(-Math.PI / 2); // 上から見たときにXY平面で作った形状が見えるように
    // 必要に応じて、さらにY軸周りの回転で初期の向きを調整
    indicatorGeo.rotateY(Math.PI); // 例: 初期で下向きにするなど

    const indicatorMat = new THREE.MeshBasicMaterial({
        color: 0x00FF00,       // 赤色
        side: THREE.DoubleSide, // PlaneGeometry や ShapeGeometry を使う場合、両面表示が良い
        depthTest: false,
        toneMapped: false
    });

    this.characterIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);

    // シーンに追加し、レイヤーを設定
    this.scene.add(this.characterIndicator);
    this.characterIndicator.layers.set(1); // ミニマップ専用レイヤー
    console.log("Minimap: Arrow indicator initialized.");
}



    setupMinimapCameraView(mazeModel, mazeFloorRef) { // mazeFloorRef を引数に追加
        if (!this.isEnabled || !mazeModel || !this.camera) return;

        this.mazeFloor = mazeFloorRef; // Game.js から渡された床の参照を保存

        const mazeBox = new THREE.Box3().setFromObject(mazeModel);
        const mazeSize = mazeBox.getSize(new THREE.Vector3());
        const mazeCenter = mazeBox.getCenter(new THREE.Vector3());

        const maxMazeDim = Math.max(mazeSize.x, mazeSize.z) * 1.1;

        this.camera.left = -maxMazeDim / 2;
        this.camera.right = maxMazeDim / 2;
        this.camera.top = maxMazeDim / 2;
        this.camera.bottom = -maxMazeDim / 2;

        this.camera.position.set(
            mazeCenter.x,
            mazeCenter.y + maxMazeDim * MINIMAP_CAMERA_Y_OFFSET_FACTOR,
            mazeCenter.z
        );
        this.camera.lookAt(mazeCenter.x, mazeCenter.y, mazeCenter.z);
        this.camera.updateProjectionMatrix();
        // console.log("ミニマップカメラ設定完了 (Minimap).");
    }

    updateAndRender(characterModel, characterHeight, mazeFloorMaxY, mazeFloorFromGame) { // mazeFloorFromGame を引数に追加
        if (!this.isEnabled || !this.camera || !characterModel || !this.characterIndicator) return;

        // Gameから渡された床の参照を優先的に使用 (setup時と異なる場合も考慮)
        // もしmazeFloorFromGameが常に渡されるなら、this.mazeFloorは不要になる可能性もある
        const currentActiveMazeFloor = mazeFloorFromGame || this.mazeFloor;

        // --- キャラクターインジケーターの更新 ---
        const charPos = characterModel.position;
        this.characterIndicator.position.x = charPos.x;
        this.characterIndicator.position.z = charPos.z;

        if (mazeFloorMaxY !== undefined) {
             this.characterIndicator.position.y = mazeFloorMaxY + MINIMAP_INDICATOR_Y_OFFSET;
        } else {
            this.characterIndicator.position.y = charPos.y + characterHeight / 2 + MINIMAP_INDICATOR_Y_OFFSET;
        }

        const eulerY = new THREE.Euler().setFromQuaternion(characterModel.quaternion, 'YXZ');
        this.characterIndicator.rotation.set(0, eulerY.y, 0);
        this.characterIndicator.updateMatrixWorld(true);


        // --- ミニマップのレンダリング処理 ---
        const mapScreenX = MINIMAP_MARGIN_PX;
        const mapScreenY = MINIMAP_MARGIN_PX;

        const currentScissorTest = this.renderer.getScissorTest();
        const currentScissor = new THREE.Vector4();
        if (currentScissorTest) this.renderer.getScissor(currentScissor);
        const currentViewport = new THREE.Vector4();
        this.renderer.getViewport(currentViewport);

        // --- 床マテリアルの一時的な変更 ---
        let originalOpacity, originalTransparent;
        if (currentActiveMazeFloor && currentActiveMazeFloor.material) {
            originalOpacity = currentActiveMazeFloor.material.opacity;
            originalTransparent = currentActiveMazeFloor.material.transparent;

            currentActiveMazeFloor.material.opacity = 0.3; // ミニマップ用の透明度
            currentActiveMazeFloor.material.transparent = true;
            currentActiveMazeFloor.material.needsUpdate = true;
        }

        this.renderer.setScissorTest(true);
        this.renderer.setScissor(mapScreenX, mapScreenY, MINIMAP_SIZE_PX, MINIMAP_SIZE_PX);
        this.renderer.setViewport(mapScreenX, mapScreenY, MINIMAP_SIZE_PX, MINIMAP_SIZE_PX);

        this.renderer.clearDepth(); // 深度バッファのみクリア
        this.renderer.render(this.scene, this.camera); // ミニマップカメラでシーンを描画

        // --- 床マテリアルを元に戻す ---
        if (currentActiveMazeFloor && currentActiveMazeFloor.material) {
            currentActiveMazeFloor.material.opacity = originalOpacity;
            currentActiveMazeFloor.material.transparent = originalTransparent;
            currentActiveMazeFloor.material.needsUpdate = true;
        }

        // レンダラーの状態を元に戻す
        this.renderer.setScissorTest(currentScissorTest);
        if (currentScissorTest) this.renderer.setScissor(currentScissor);
        this.renderer.setViewport(currentViewport);
    }
}