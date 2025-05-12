// constants.js

import * as THREE from 'three';

// --- モデル・アニメーション関連 ---
export const MAZE_MODEL_PATH = './models/debug_map03.glb'; // 迷路の3Dモデルファイルのパス。変更すると読み込まれる迷路が変わります。
export const CHARACTER_BASE_MODEL_PATH = './models/idle.fbx'; // キャラクターの基本（アイドル状態などのベース）モデルファイルのパス。
export const ANIMATION_PATHS = { // キャラクターのアニメーションファイルパス。各動作のアニメーションを変更します。
    idle: './models/idle.fbx',    // アイドル状態のアニメーション
    run: './models/run_03.fbx',   // 走行状態のアニメーション
    kick: './models/kick_01.fbx'  // キック動作のアニメーション
    //, jump: './models/jump_01.fbx' // ジャンプは削除済みなのでこのまま
};

// --- 敵キャラクター ---
export const ENEMY_MODEL_PATHS = { // 各敵モデルのGLBファイルへのパス
    enemy_01: './models/enemies/enemy_01.glb',
    enemy_02: './models/enemies/enemy_02.glb',
    enemy_03: './models/enemies/enemy_03.glb',
    enemy_04: './models/enemies/enemy_04.glb',
    enemy_05: './models/enemies/enemy_05.glb',
};

// --- キャラクター基本設定 ---
export const CHARACTER_INITIAL_POSITION = new THREE.Vector3(0, 0, 0); // キャラクターの初期位置 (x, y, z)。ゲーム開始時のキャラクターのスポーン地点。一時的にコメントアウト

export const CHARACTER_INITIAL_SCALE = 30; // キャラクターモデルの初期スケール。値を変更するとキャラクターのサイズが変わります。物理演算にも影響。
export const CHARACTER_SPEED = 200.0; // キャラクターの移動速度。大きいほど速く移動します。現在180
export const CHARACTER_ROTATION_SPEED = Math.PI; // キャラクターの回転速度 (ラジアン/秒)。大きいほど旋回が速くなります。 (Math.PI = 180度/秒)
export const BASE_CHARACTER_HEIGHT = 1.8; // キャラクターモデルの基準身長（スケール1の時の身長）。CHARACTER_HEIGHTの計算に使用。
export const BASE_CHARACTER_RADIUS = 0.4; // キャラクターモデルの基準半径（スケール1の時の半径）。CHARACTER_RADIUSの計算に使用。


export const CHARACTER_HEIGHT = BASE_CHARACTER_HEIGHT * CHARACTER_INITIAL_SCALE; // 実際のキャラクターの身長 (スケール適用後)。物理カプセルの高さなどに影響。
export const CHARACTER_RADIUS = BASE_CHARACTER_RADIUS * CHARACTER_INITIAL_SCALE; // 実際のキャラクターの半径 (スケール適用後)。物理カプセルの半径などに影響。
export const CHARACTER_LOCAL_FORWARD = new THREE.Vector3(0, 0, 1); // キャラクターモデルのローカル座標系における「前」方向。モデルの向きによって調整。
// export const CHARACTER_JUMP_FORCE = 2000 * CHARACTER_INITIAL_SCALE; // ジャンプ時に加える力の大きさ (要調整)
// export const CHARACTER_JUMP_INITIAL_VELOCITY = 100 * MAZE_SCALE; // ジャンプの初速 (Y方向) (要調整)
// export const CHARACTER_MAX_JUMPS = 1; // 最大ジャンプ回数 (2段ジャンプなら2)


// --- 迷路設定 ---
export const MAZE_SCALE = 10; // 迷路モデルの全体的なスケール。迷路の大きさを調整します。他の多くの値もこれに依存する場合があります。
export const MAZE_Y_OFFSET = 0; // 迷路モデルのY軸オフセット。迷路全体の高さを調整します。

// --- カメラ設定 ---
export const CAMERA_Y_OFFSET = 40; // カメラのターゲット（キャラクター）からのY軸方向の基本的なオフセット量。
export const CAMERA_OFFSET = new THREE.Vector3(0, 100, 50); // キャラクターを追従するカメラの相対位置オフセット (x, y, z)。Yを大きくすると見下ろし、Zを大きくすると遠景に。
export const CAMERA_FOLLOW_SPEED = 0.08; // カメラがキャラクターを追従する際の補間速度。小さいほど滑らかに追従 (0に近いほど遅く、1に近いほど速い)。
export const CAMERA_COLLISION_OFFSET = 5.0; // カメラが壁と衝突する際のオフセット距離。カメラのめり込み防止用。
export const CAMERA_CORRECTION_LERP_SPEED = 0.15; // カメラが壁衝突から復帰する際の補間速度。
export const INITIAL_CAMERA_DISTANCE = CAMERA_OFFSET.length(); // 初期状態でのカメラとキャラクター間の距離。ズームの基準。
export const MIN_ZOOM_DISTANCE = CHARACTER_RADIUS * 3; // カメラの最小ズーム距離。これよりキャラクターに近づけない。
export const MAX_ZOOM_DISTANCE = 1000 * MAZE_SCALE; // カメラの最大ズーム距離。これよりキャラクターから離れられない。
export const ZOOM_SPEED_FACTOR = 0.1; // カメラのズーム速度係数。マウスホイールなどでのズーム感度。

// --- プロジェクタイル (ビーム・リング) 設定 ---
export const BEAM_COLOR = 0xffff00; // ビームの色 (16進数カラーコード、例: 黄色)。
export const BEAM_RADIUS = 0.7 * MAZE_SCALE; // ビームの半径。ビームの太さを決定します。
export const BEAM_LENGTH = 500 * MAZE_SCALE; // ビームの視覚的な長さ。
export const BEAM_SPEED = 0.8 * MAZE_SCALE; // ビームの進行速度。
export const BEAM_RAYCAST_DISTANCE = BEAM_SPEED * (1.0 / 60.0) * 1.2; // ビームの1フレームあたりのレイキャスト（衝突判定）距離。貫通防止用。速度とフレームレートから算出。
export const RING_COLOR = 0x00ff7f; // キック時に発生するリングエフェクトの色 (例: あざやかな緑系の色 )。
export const RING_RADIUS = 1.5 * MAZE_SCALE; // リングエフェクトの半径。
export const RING_DURATION = 1.0; // リングエフェクトの表示時間 (秒)。
export const BEAM_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 3.1; // ビームをキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_SPAWN_OFFSET_FORWARD = CHARACTER_RADIUS * 3.0; // リングをキャラクターの前方、どれだけ離れた位置からスポーンさせるかのオフセット。
export const RING_SPAWN_OFFSET_UP = RING_RADIUS * 1.8; // リングをキャラクターの足元基準で、どれだけ上方向にオフセットしてスポーンさせるか。
export const KICK_BEAM_DELAY = 0.7; // キックアニメーション開始からビームが発射されるまでの遅延時間 (秒)。アニメーションと同期させるために調整。
export const MAX_BEAM_LIFETIME = 1000; // ビームが3秒で消える (3000ミリ秒)


// --- ミニマップ設定 ---
export const MINIMAP_ENABLED = true; // ミニマップ表示の有効/無効フラグ。trueで表示、falseで非表示。
export const MINIMAP_SIZE_PX = 300; // ミニマップの表示サイズ (ピクセル)。
export const MINIMAP_MARGIN_PX = 20; // ミニマップの画面端からのマージン (ピクセル)。
export const MINIMAP_CAMERA_Y_OFFSET_FACTOR = 1.5; // ミニマップ用カメラのY軸オフセット係数。迷路のバウンディングボックスの高さに対する倍率などで使用される想定。値が大きいほど広範囲を映す。
export const MINIMAP_INDICATOR_Y_OFFSET = 50; // ミニマップ上のキャラクター位置インジケータのY軸オフセット（対象オブジェクトの上面からの高さ）。
export const MINIMAP_INDICATOR_SIZE = CHARACTER_RADIUS * 20; // ミニマップ上のキャラクター位置インジケータのサイズ。

// --- 物理演算関連 ---
export const GRAVITY = -9.8 * CHARACTER_INITIAL_SCALE * 2; // 物理エンジンで使用する重力加速度。キャラクターのスケールに合わせて調整されています。負の値で下向き。
export const CHARACTER_MASS = 40; // キャラクターの物理的な質量 (kg相当)。衝突時の挙動に影響します。
export const CHARACTER_FRICTION = 0.7; // キャラクターの物理的な摩擦係数 (0-1)。地面との滑りやすさに影響。大きいほど滑りにくい。現在0.5
export const CHARACTER_RESTITUTION = 0.1; // キャラクターの物理的な反発係数 (0-1)。衝突時の跳ね返りやすさに影響。0で跳ね返らず、1で完全に跳ね返る。
export const WALL_FRICTION = 0.7; // 壁の物理的な摩擦係数。現在0.5
export const WALL_RESTITUTION = 0.5; // 壁の物理的な反発係数。
// export const CHARACTER_AIR_CONTROL_FACTOR = 0.5; // 空中での移動制御の効き具合 (1で地上と同じ)


// --- 球体 (Sphere) 設定 ---
export const NUM_SPHERES = 100; // ゲーム内に生成する球体の数。
export const MIN_SPHERE_RADIUS = 5 * MAZE_SCALE; // 生成される球体の最小半径。
export const MAX_SPHERE_RADIUS = 15 * MAZE_SCALE; // 生成される球体の最大半径。
export const SPHERE_MASS = 10; // 球体の物理的な質量。
export const SPHERE_FRICTION = 0.1; // 球体の物理的な摩擦係数。
export const SPHERE_RESTITUTION = 0.6; // 球体の物理的な反発係数。
export const SPHERE_INITIAL_Y_OFFSET = 300 * MAZE_SCALE; // 球体の初期配置時のY軸オフセット（床面からの高さ）。埋まらないように調整。

// 敵の基本パラメータ
export const ENEMY_DEFAULT_SCALE = 5;   // 敵モデルのデフォルトスケール
export const ENEMY_DEFAULT_HP = 100;     // 敵のデフォルトHP
export const ENEMY_DEFAULT_SPEED = 80;   // 敵のデフォルト移動速度
export const ENEMY_MASS = 50;            // 敵の物理ボディの質量
export const ENEMY_HEIGHT_FACTOR = 1.6;  // スケールに対する高さの係数 (モデルの実際の寸法に合わせて調整)
export const ENEMY_RADIUS_FACTOR = 0.4;  // スケールに対する半径の係数 (モデルの実際の寸法に合わせて調整)
export const ENEMY_ATTACK_RANGE = 70;    // 敵が攻撃を開始する（または追跡を止める）距離
export const ENEMY_DETECTION_RANGE = 300; // 敵がプレイヤーを検知する距離 (オプション)
export const ENEMY_DEFAULT_ANIMATION_NAME = "default"; // Enemy.js でこのキー名を使ってアニメーションを参照する
