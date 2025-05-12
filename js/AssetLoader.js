// AssetLoader.js

import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import {
    MAZE_SCALE, MAZE_Y_OFFSET,
    CHARACTER_INITIAL_SCALE,
    ENEMY_DEFAULT_SCALE

} from './constants.js';

export class AssetLoader {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
    }

    async loadAll(paths) {
        // paths = { MAZE_MODEL_PATH, CHARACTER_BASE_MODEL_PATH, ANIMATION_PATHS, ENEMY_MODEL_PATHS }
        const promises = [];
        const loadedAssets = {
            mazeModel: null,
            characterBaseModel: null,
            animations: {}, // プレイヤーキャラクター用アニメーション
            enemyModels: {},    // ★ 敵モデル格納用
            enemyAnimations: {} // ★ 敵アニメーション格納用
        };

        // --- 迷路モデルの読み込み ---
        if (paths.MAZE_MODEL_PATH) {
            promises.push(
                this.gltfLoader.loadAsync(paths.MAZE_MODEL_PATH).then(gltf => {
                    loadedAssets.mazeModel = gltf.scene;
                    loadedAssets.mazeModel.scale.setScalar(MAZE_SCALE);
                    loadedAssets.mazeModel.position.y = MAZE_Y_OFFSET;
                }).catch(e => { console.error(`迷路 (${paths.MAZE_MODEL_PATH}) 読込エラー:`, e); throw e; })
            );
        }

        // --- プレイヤーキャラクターベースモデルの読み込み ---
        if (paths.CHARACTER_BASE_MODEL_PATH) {
            promises.push(
                this.fbxLoader.loadAsync(paths.CHARACTER_BASE_MODEL_PATH).then(object => {
                    loadedAssets.characterBaseModel = object;
                    loadedAssets.characterBaseModel.scale.setScalar(CHARACTER_INITIAL_SCALE);
                    object.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                }).catch(e => { console.error(`キャラクターベース (${paths.CHARACTER_BASE_MODEL_PATH}) 読込エラー:`, e); throw e; })
            );
        }

        // --- プレイヤーキャラクター用アニメーションの読み込み (FBX) ---
        if (paths.ANIMATION_PATHS) {
            for (const name in paths.ANIMATION_PATHS) {
                const path = paths.ANIMATION_PATHS[name];
                promises.push(
                    this.fbxLoader.loadAsync(path).then(object => {
                        if (object.animations && object.animations.length > 0) {
                            loadedAssets.animations[name] = object.animations[0];
                        } else {
                            console.warn(`プレイヤーアニメーション ${path} にクリップが見つかりません (${name})`);
                        }
                    }).catch(e => { console.error(`プレイヤーアニメーション ${name} (${path}) 読込エラー:`, e); })
                );
            }
        }

        // --- 敵モデルとアニメーションの読み込み (GLB) ---
        if (paths.ENEMY_MODEL_PATHS) {
            for (const enemyName in paths.ENEMY_MODEL_PATHS) {
                const path = paths.ENEMY_MODEL_PATHS[enemyName];
                promises.push(
                    this.gltfLoader.loadAsync(path)
                        .then(gltf => {
                            loadedAssets.enemyModels[enemyName] = gltf.scene;
                            // ★ 敵モデルの初期スケールをここで設定 (または EnemyManager/Enemy クラスで)
                            loadedAssets.enemyModels[enemyName].scale.setScalar(ENEMY_DEFAULT_SCALE);
                            loadedAssets.enemyModels[enemyName].traverse(child => { // 敵モデルも影の設定
                                if (child.isMesh) {
                                    child.castShadow = true;
                                    child.receiveShadow = true;
                                }
                            });

                            if (gltf.animations && gltf.animations.length > 0) {
                                // 各GLBにアニメーションが1つだけという前提であれば、
                                // そのアニメーション群 (配列) をそのまま格納する
                                loadedAssets.enemyAnimations[enemyName] = gltf.animations;
                                console.log(`敵モデル ${enemyName}: ${gltf.animations.length}個のアニメーションをロードしました。`);
                            } else {
                                loadedAssets.enemyAnimations[enemyName] = []; // アニメーションがない場合は空配列
                                console.log(`敵モデル ${enemyName} にアニメーションは見つかりませんでした。`);
                            }
                        })
                        .catch(e => { console.error(`敵モデル ${enemyName} (${path}) 読込エラー:`, e); })
                );
            }
        }
        // --- 敵モデルとアニメーションの読み込みここまで ---

        try {
            await Promise.all(promises);
            console.log("全てのアセット読み込み試行完了 (AssetLoader).");

            // ログ出力 (プレイヤーアニメーション)
            console.log("AssetLoader: Final 'loadedAssets.animations' (Player):",
                JSON.parse(JSON.stringify(loadedAssets.animations, (key, value) => {
                    if (value instanceof THREE.AnimationClip) {
                        return `AnimationClip[name:${value.name}, duration:${value.duration.toFixed(2)}s, tracks:${value.tracks.length}]`;
                    }
                    return value;
                }))
            );
            // ログ出力 (敵アニメーション)
            console.log("AssetLoader: Final 'loadedAssets.enemyAnimations':");
            for (const enemyName in loadedAssets.enemyAnimations) {
                const anims = loadedAssets.enemyAnimations[enemyName];
                console.log(`  ${enemyName}:`, anims.map(clip =>
                    `AnimationClip[name:${clip.name}, duration:${clip.duration.toFixed(2)}s, tracks:${clip.tracks.length}]`
                ));
            }


            return loadedAssets;
        } catch (error) {
            console.error("アセット読み込み中にエラーが発生しました (AssetLoader):", error);
            throw error;
        }
    }
}