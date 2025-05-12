// Game.js (エントリーポイント)
import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // CameraManager内でimport

import { PhysicsManager } from './PhysicsManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Character } from './Character.js';
import { InputManager } from './InputManager.js';
import { CameraManager } from './CameraManager.js'; 
import { ProjectileManager } from './ProjectileManager.js';
import { SphereManager } from './SphereManager.js';
import { Minimap } from './Minimap.js';
import { EffectManager } from './EffectManager.js';
import { EnemyManager } from './EnemyManager.js';


import { // 定数をインポート
    GRAVITY, MAZE_MODEL_PATH, CHARACTER_BASE_MODEL_PATH, ANIMATION_PATHS,
    CHARACTER_INITIAL_POSITION, CHARACTER_INITIAL_SCALE, CHARACTER_LOCAL_FORWARD,
    CHARACTER_SPEED, CHARACTER_ROTATION_SPEED, CHARACTER_HEIGHT,
    KICK_BEAM_DELAY, BEAM_SPAWN_OFFSET_FORWARD,
    NUM_SPHERES, MAZE_SCALE, MINIMAP_ENABLED,
    MINIMAP_INDICATOR_Y_OFFSET,
    ENEMY_MODEL_PATHS
} from './constants.js';


class Game {
    constructor() {
        // --- Three.js 関連 ---
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this._setupRenderer();

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000 * MAZE_SCALE);

        // --- ゲームの状態やワールドに関するもの ---
        this.world = { mazeModel: null, collidables: [], mazeFloor: null };
        this.raycastTargets = [];
        this.mazeFloorMaxY = 0;
        this.gameStarted = false; // ゲームが実際に開始されたかのフラグ
        this.tempTransform = null;

        // --- DOM要素の取得 ---
        this.startGameMessageElement = document.getElementById('start-game-message');
        this.loadingMessageElement = document.getElementById('loading-message');

        // --- 各マネージャーのインスタンス化 ---
        this.inputManager = new InputManager(this.renderer.domElement);
        this.physicsManager = new PhysicsManager(GRAVITY);
        this.assetLoader = new AssetLoader();
        this.cameraManager = new CameraManager(this.camera, this.renderer.domElement, this.world.collidables);
        this.effectManager = new EffectManager(this.scene);
        this.projectileManager = new ProjectileManager(this.scene, () => this.raycastTargets, this.effectManager);
        this.sphereManager = new SphereManager(this.scene, this.physicsManager, this.raycastTargets);

        this.character = null; // アセットロード後に初期化
        this.minimap = MINIMAP_ENABLED ? new Minimap(this.scene, this.renderer) : null;

        // --- オーディオ関連のプロパティ ---
        this.audioListener = new THREE.AudioListener();
        this.audioLoader = new THREE.AudioLoader();
        this.bgmSound = null;
        this.bgmPath = '../audio/mikumiku.mp3';
        this.bgmVolume = 0.3;
        this.bgmLoaded = false;
        this.bgmPlayInitiated = false; // BGMが再生開始されたかのフラグ (初回のみ再生用)
        this.sfxBeamSound = null;
        this.sfxBeamPath = '../audio/beam_01.mp3';
        this.sfxBeamVolume = 0.6;
        this.sfxBeamLoaded = false;
    }

    _setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
    }

    async init() {
        try {
            // --- 1. 物理エンジン関連の初期化 ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理エンジンを初期化中...';
            await this.physicsManager.initAmmo();
            this.tempTransform = this.physicsManager.getTempTransform();
            if (!this.tempTransform) throw new Error("Failed to get tempTransform from PhysicsManager.");

            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '物理ワールドを構築中...';
            this.physicsManager.initPhysicsWorld();

            // --- 2. Three.js環境の初期化 ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = '3Dシーン環境を初期化中...';
            this._initThreeJSEnvironment();

            // --- 3. アセットのロードとゲームオブジェクトのセットアップ ---
            if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'アセットを読み込み中...';
            await this._loadAssetsAndSetupGame();

            // --- 4. オーディオ関連の初期化 ---
            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.cameraManager.getMainCamera().add(this.audioListener);
                console.log("AudioListener added to the main camera.");

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'BGMを読み込み中...';
                this.audioLoader.load(
                    this.bgmPath,
                    (buffer) => {
                        this.bgmSound = new THREE.Audio(this.audioListener);
                        this.bgmSound.setBuffer(buffer);
                        this.bgmSound.setLoop(true);
                        this.bgmSound.setVolume(this.bgmVolume);
                        this.bgmLoaded = true;
                        console.log('BGM loaded successfully.');
                        if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                            // 他のロードが終わっていればメッセージを変えるなど
                        }
                    },
                    (xhr) => {
                        if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) {
                            const percentLoaded = Math.round(xhr.loaded / xhr.total * 100);
                            this.loadingMessageElement.textContent = `BGMを読み込み中... ${percentLoaded}%`;
                        }
                    },
                    (error) => {
                        console.error('BGMの読み込みに失敗しました:', error);
                        if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('BGM')) this.loadingMessageElement.textContent = 'BGMの読み込みに失敗。';
                    }
                );

                if (this.loadingMessageElement) this.loadingMessageElement.textContent = '効果音を読み込み中...';
                this.audioLoader.load(
                    this.sfxBeamPath,
                    (buffer) => {
                        this.sfxBeamSound = new THREE.Audio(this.audioListener);
                        this.sfxBeamSound.setBuffer(buffer);
                        this.sfxBeamSound.setLoop(false);
                        this.sfxBeamSound.setVolume(this.sfxBeamVolume);
                        this.sfxBeamLoaded = true;
                        console.log('SFX (beam) loaded successfully.');
                        // 両方のオーディオロードが終わったタイミングでロードメッセージを最終更新しても良い
                    },
                    undefined,
                    (error) => {
                        console.error('SFX (beam) の読み込みに失敗しました:', error);
                         if (this.loadingMessageElement && this.loadingMessageElement.textContent.includes('効果音')) this.loadingMessageElement.textContent = '効果音の読み込みに失敗。';
                    }
                );
            } else {
                console.error("Main camera not available, cannot add AudioListener or load audio.");
                if (this.loadingMessageElement) this.loadingMessageElement.textContent = 'カメラの準備ができず、音声を読み込めません。';
            }

            // ローディングメッセージを非表示にし、スタートメッセージを表示
            if (this.loadingMessageElement) {
                this.loadingMessageElement.style.display = 'none';
            }
            if (this.startGameMessageElement) {
                this.startGameMessageElement.style.display = 'block';
                console.log("Start game message displayed.");
            }

            // ゲーム開始用のキーイベントリスナーを設定
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
            console.log("Keydown listener for game start added.");

            window.addEventListener('resize', this._onWindowResize.bind(this));
            this.animate();
            console.log("Animation loop started.");

        } catch (error) {
            console.error("ゲームの初期化中に致命的なエラーが発生 (Game.init):", error);
            if (this.loadingMessageElement) {
                this.loadingMessageElement.textContent = 'エラー: 初期化に失敗しました。コンソールを確認。';
                this.loadingMessageElement.style.display = 'block';
                if (this.startGameMessageElement) this.startGameMessageElement.style.display = 'none';
            }
        }
    }

    _handleStartKey(event) {
        if (event.key === 'Enter') {
            if (this.startGameMessageElement) {
                this.startGameMessageElement.style.display = 'none';
            }
            this.gameStarted = true;

            if (!this.bgmPlayInitiated) { // bgmPlayInitiated を使って初回のみ再生
                this._tryPlayBGM(); // この中で AudioContext.resume も行われる
                this.bgmPlayInitiated = true;
            }
            console.log("Game started by Enter key!");
        } else {
            // Enter以外のキーが押された場合は、再度リスナーを設定し直す
            window.addEventListener('keydown', this._handleStartKey.bind(this), { once: true });
        }
    }

    _tryPlayBGM() {
        if (!this.bgmLoaded || !this.bgmSound || this.bgmSound.isPlaying) return;
        if (this.audioListener.context.state === 'suspended') {
            this.audioListener.context.resume().then(() => {
                console.log("AudioContext resumed by user interaction (BGM).");
                if(this.bgmSound) this.bgmSound.play(); // 再度チェック
                console.log("BGM playback started after AudioContext resume.");
            }).catch(e => console.error("Error resuming AudioContext for BGM:", e));
        } else {
            if(this.bgmSound) this.bgmSound.play();
            console.log("BGM playback started.");
        }
    }

    _initThreeJSEnvironment() {
        this.scene.background = new THREE.Color(0x6699cc);
        this.scene.fog = new THREE.Fog(0x6699cc, 800 * MAZE_SCALE, 2500 * MAZE_SCALE);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.8);
        hemiLight.position.set(0, 250 * MAZE_SCALE, 0);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
        dirLight.position.set(150 * MAZE_SCALE, 350 * MAZE_SCALE, 200 * MAZE_SCALE);
        dirLight.castShadow = true;
        const shadowCamSize = 2000 * MAZE_SCALE;
        dirLight.shadow.camera.top = shadowCamSize;
        dirLight.shadow.camera.bottom = -shadowCamSize;
        dirLight.shadow.camera.left = -shadowCamSize;
        dirLight.shadow.camera.right = shadowCamSize;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 1000 * MAZE_SCALE;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
    }

    async _loadAssetsAndSetupGame() {
        // ★ AssetLoaderから受け取るアセットに enemyModels と enemyAnimations を追加
        const {
            mazeModel,
            characterBaseModel,
            animations,
            enemyModels,      // 敵モデル
            enemyAnimations   // 敵アニメーション
        } = await this.assetLoader.loadAll({
            MAZE_MODEL_PATH,
            CHARACTER_BASE_MODEL_PATH,
            ANIMATION_PATHS,
            ENEMY_MODEL_PATHS // ★ AssetLoaderに渡す
        });

        let floorObjectFound = false;
        const USE_DEBUG_FLOOR = true; // デバッグ床を使用する場合は true

        if (mazeModel) {
            this.world.mazeModel = mazeModel;
            this.scene.add(this.world.mazeModel);
            this.world.mazeModel.updateMatrixWorld(true);

            this.world.mazeModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    if (child.name.startsWith('Wall_')) {
                        child.userData.isWall = true;
                        this.world.collidables.push(child);
                        this.raycastTargets.push(child);
                        const isSlopeObject = child.name.includes('_Slope_');
                        if (this.physicsManager && this.physicsManager.isInitialized()) {
                            this.physicsManager.createWallPhysicsBody(child, isSlopeObject);
                        }
                    }
                    else if (child.name === 'MazeFloor') {
                        floorObjectFound = true;
                        if (USE_DEBUG_FLOOR) {
                            child.visible = false;
                            console.log("Game.js: 'MazeFloor' (original) set to invisible.");
                            // 元の床の物理ボディは生成しない
                        } else {
                            this.world.mazeFloor = child;
                            this.world.collidables.push(child);
                            if (this.physicsManager && this.physicsManager.isInitialized()) {
                                this.physicsManager.createWallPhysicsBody(child, false);
                            }
                            const boundingBox = new THREE.Box3().setFromObject(child);
                            this.mazeFloorMaxY = boundingBox.max.y;
                            console.log(`Game.js: Using original 'MazeFloor'. Max Y: ${this.mazeFloorMaxY.toFixed(2)}`);
                        }
                    }
                }
            });

            if (!floorObjectFound && !USE_DEBUG_FLOOR) {
                console.warn("警告: 'MazeFloor' という名前の床オブジェクトが見つかりませんでした。");
            }
        } else {
            throw new Error("迷路モデルの読み込みに失敗しました。");
        }

        // --- デバッグ床の作成 (USE_DEBUG_FLOORがtrueの場合) ---
        let debugFloorMesh = null; // スコープを広くする
        if (USE_DEBUG_FLOOR) {
            console.log("Game.js: Creating debug floor...");
            const planeGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1);
            const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x777777, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.2 });
            debugFloorMesh = new THREE.Mesh(planeGeometry, planeMaterial); // ここで代入
            debugFloorMesh.rotation.x = -Math.PI / 2;
            debugFloorMesh.position.y = 0;
            debugFloorMesh.receiveShadow = true;
            debugFloorMesh.name = "DEBUG_FLOOR_PLANE_MANUAL";
            this.scene.add(debugFloorMesh);
            console.log("Game.js: Added DEBUG_FLOOR_PLANE_MANUAL to the scene at Y=0.");

            if (this.physicsManager && this.physicsManager.isInitialized() && this.physicsManager.AmmoAPI && this.physicsManager.physicsWorld) {
                const groundShape = new this.physicsManager.AmmoAPI.btStaticPlaneShape(new this.physicsManager.AmmoAPI.btVector3(0, 1, 0), 0);
                const groundTransform = new this.physicsManager.AmmoAPI.btTransform();
                groundTransform.setIdentity();
                const groundMass = 0;
                const localInertia = new this.physicsManager.AmmoAPI.btVector3(0, 0, 0);
                const motionState = new this.physicsManager.AmmoAPI.btDefaultMotionState(groundTransform);
                const rbInfo = new this.physicsManager.AmmoAPI.btRigidBodyConstructionInfo(groundMass, motionState, groundShape, localInertia);
                const groundBody = new this.physicsManager.AmmoAPI.btRigidBody(rbInfo);
                groundBody.threeMesh = debugFloorMesh;
                this.physicsManager.addRigidBodyToWorld(groundBody);
                console.log("Game.js: Added physics body for DEBUG_FLOOR_PLANE_MANUAL.");

                this.world.collidables.push(debugFloorMesh);
                this.mazeFloorMaxY = 0;
                this.world.mazeFloor = debugFloorMesh; // デバッグ床を現在の床として設定
            } else {
                console.error("Game.js: PhysicsManager not ready for debug floor physics body.");
            }
        }
        // --- デバッグ床の作成ここまで ---


        if (characterBaseModel && animations) {
            this.character = new Character( // ★ this.character をここで確実に初期化
                characterBaseModel,
                animations,
                this.scene,
                this.physicsManager,
                CHARACTER_INITIAL_POSITION,
                CHARACTER_INITIAL_SCALE,
                CHARACTER_LOCAL_FORWARD,
                this.projectileManager
            );
            this.character.onAnimationFinishedCallback = this._onCharacterAnimationFinished.bind(this);
            console.log("Game.js: Player Character instance created.");
        } else {
            console.error("プレイヤーキャラクターモデルまたはアニメーションの読み込みに失敗しました。");
            this.character = null; // ★ 失敗時はnullを明示
            // throw new Error("キャラクターモデルまたはアニメーションの読み込みに失敗しました。"); // 必要ならエラーを投げる
        }

        // ★ EnemyManager の初期化と敵のスポーン ★
        if (this.character && enemyModels && enemyAnimations) { // プレイヤーキャラクターと敵アセットがロード成功した場合
            this.enemyManager = new EnemyManager(
                this.scene,
                this.physicsManager,
                this.character,     // プレイヤーキャラクターのインスタンスを渡す
                enemyModels,
                enemyAnimations
            );
            // スポーンさせる数、中心位置、半径などを指定
            const spawnCenter = new THREE.Vector3(0, 0, 200); // 例: 少し前方に
            this.enemyManager.spawnEnemies(3, spawnCenter, 100); // 例: 3体スポーン
            console.log("Game.js: EnemyManager initialized and enemies spawned.");
        } else {
            if (!this.character) console.error("Game.js: Player character not created, cannot initialize EnemyManager.");
            if (!enemyModels) console.error("Game.js: Enemy models not loaded, cannot initialize EnemyManager.");
            this.enemyManager = null; // EnemyManagerもnullに
        }
        // ★ EnemyManager の初期化ここまで ★


        this.sphereManager.createSpheres(NUM_SPHERES, this.world.mazeModel);

        if (this.character && this.character.model) { // ★ nullチェック強化
            this.cameraManager.setInitialCameraState(this.character.model);
        } else {
            console.warn("Game.js: Character model not available for initial camera state.");
            // カメラの初期位置をデフォルトにするなどのフォールバック処理
        }

        if (this.minimap) {
            const floorForMinimap = USE_DEBUG_FLOOR ? debugFloorMesh : this.world.mazeFloor;
            if (floorForMinimap) {
                this.minimap.setupMinimapCameraView(this.world.mazeModel, floorForMinimap);
            } else {
                console.warn("Minimap: 床オブジェクトが見つからないため、ミニマップカメラのセットアップをスキップしました。");
                this.minimap.setupMinimapCameraView(this.world.mazeModel, null);
            }
        }
    }


    _onCharacterAnimationFinished(finishedActionName) {
    console.log("Game._onCharacterAnimationFinished: CALLED with action:", finishedActionName); // ★ ログ追加
        if (finishedActionName === 'kick') {
            if (this.character) { // nullチェックを追加
            console.log("Game._onCharacterAnimationFinished: Kick finished. Setting character.canPlayAction = true."); // ★ ログ追加
            this.character.canPlayAction = true;
            }
        }
        if (this.character && this.character.canPlayAction) { // nullチェックと条件の簡略化
            // if (this.character.isGrounded) { // ← isGrounded は Character 側で常に true (仮)
                if (!this.character.isMoving && this.character.currentActionName !== 'idle') {
                    this.character.switchAnimation('idle');
                } else if (this.character.isMoving && this.character.currentActionName !== 'run') {
                    this.character.switchAnimation('run');
                }
        }
    }



    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const fixedTimeStep = 1.0 / 60.0; // 物理演算の固定時間ステップ

        // ★★★ 修正箇所: gameStarted のチェックを animate の先頭に移動 ★★★
        if (!this.gameStarted) {
            if (this.character && this.cameraManager && this.cameraManager.getMainCamera()) {
            }
            this.renderer.clear();

            if (this.cameraManager && this.cameraManager.getMainCamera()) {
                this.renderer.render(this.scene, this.cameraManager.getMainCamera());
            }
            if (MINIMAP_ENABLED && this.minimap && this.character) { // MINIMAP_ENABLED も考慮
                this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
            }
            return; // gameStartedがfalseの間は、以下の処理に進まない
        }

        // --- 通常のゲームループ (gameStarted が true の場合) ---

        // ★★★ 修正箇所: キック入力処理 (character の存在チェックを追加) ★★★
        if (this.inputManager.consumeSpacePress()) {
            if (this.character && this.character.startKickAction()) {
                // キックアクションが成功した場合の処理 (例:効果音の再生など)
                // (効果音再生は Character.startKickAction 内か、ここで行うか設計による)
            }
        }

        // キャラクターの更新 (character の存在チェックを追加)
        if (this.character) {
            this.character.update(
                delta, this.inputManager, this.cameraManager.getMainCamera(),
                CHARACTER_SPEED, CHARACTER_ROTATION_SPEED
            );
        }

    // ★ 敵マネージャーの更新 ★
    if (this.enemyManager && this.character && this.character.model) { // EnemyManagerとプレイヤーキャラクターが存在する場合
        this.enemyManager.update(delta, this.character.model.position); // プレイヤーの位置を渡す
    }


        // 物理シミュレーションのステップ
        this.physicsManager.stepSimulation(delta, 2, fixedTimeStep);

        // キャラクターの物理状態をモデルに同期 (character の存在チェックを追加)
        if (this.character) {
            this.character.syncPhysicsToModel(this.tempTransform, CHARACTER_HEIGHT);
        }

        // 球の物理状態をモデルに同期
        this.sphereManager.syncAllSpheres(this.tempTransform);


        // ビーム生成ロジック (character の存在チェックと kickActionStartTime のチェックを追加)
        if (this.character && this.character.currentActionName === 'kick' &&
            this.character.kickActionStartTime !== null && !this.character.beamGeneratedDuringKick) {
            const elapsedSinceKickStart = (performance.now() - this.character.kickActionStartTime) / 1000;
            if (elapsedSinceKickStart >= KICK_BEAM_DELAY) {
                const worldForward = this.character.localForwardDirection.clone().applyQuaternion(this.character.model.quaternion);
                this.projectileManager.createBeam(
                    this.character.model, worldForward, CHARACTER_HEIGHT, BEAM_SPAWN_OFFSET_FORWARD
                );
                this.character.beamGeneratedDuringKick = true;
                if (this.sfxBeamLoaded && this.sfxBeamSound) {
                    if (this.sfxBeamSound.isPlaying) this.sfxBeamSound.stop();
                    this.sfxBeamSound.play();
                }
            }
        }

        // カメラの更新 (character の存在チェックを追加)
        if (this.character && this.cameraManager) {
            this.cameraManager.updateCamera(
                this.character.model, this.character.isMoving, this.inputManager
            );
        }

        // エフェクトの更新
        this.effectManager.update(delta);

        // プロジェクタイル（ビーム）の更新
        this.projectileManager.update(delta, (hitObject, projectile, hitPoint, distanceToHit, intersection) => {
            // ... (既存のビーム衝突処理) ...
            if (hitObject.userData && hitObject.userData.isWall) {
                return "stop_and_adjust";
            }
            if (this.sphereManager.isSphere(hitObject)) {
                if (projectile.userData.hitSpheresThisFrame && !projectile.userData.hitSpheresThisFrame.has(hitObject.uuid)) {
                    if (this.effectManager && hitObject.material && typeof hitObject.material.color !== 'undefined') {
                        const sphereColor = hitObject.material.color.clone();
                        this.effectManager.createSparkExplosion(hitObject.position.clone(), sphereColor.clone().multiplyScalar(1.5));
                        this.effectManager.createDebrisExplosion(hitObject.position.clone(), sphereColor);
                    }
                    this.sphereManager.destroySphereByMesh(hitObject);
                    projectile.userData.hitSpheresThisFrame.add(hitObject.uuid);
                    return "destroy_target_and_continue";
                } else {
                    return "ignore";
                }
            }
            return "ignore";
        });


        // レンダリング
        this.renderer.clear();
        if (this.cameraManager && this.cameraManager.getMainCamera()) {
            this.renderer.render(this.scene, this.cameraManager.getMainCamera());
        }

        // ミニマップの更新とレンダリング (character の存在チェックを追加)
        if (MINIMAP_ENABLED && this.minimap && this.character) { // MINIMAP_ENABLED も考慮
            this.minimap.updateAndRender(this.character.model, CHARACTER_HEIGHT, this.mazeFloorMaxY, this.world.mazeFloor);
        }
    }


    _onWindowResize() {
        if (!this.cameraManager || !this.renderer) return;
        const mainCamera = this.cameraManager.getMainCamera();
        if (!mainCamera) return;
        mainCamera.aspect = window.innerWidth / window.innerHeight;
        mainCamera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.minimap) this.minimap.onWindowResize();
    }
}

export { Game };

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});