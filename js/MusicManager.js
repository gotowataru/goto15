// js/MusicManager.js
import * as THREE from 'three';

export class MusicManager {
    constructor(listener) {
        if (!listener || !(listener instanceof THREE.AudioListener)) {
            console.warn("MusicManager: THREE.AudioListener is required for audio playback.");
            // リスナーがない場合は機能しないことを明確にする
            this.listener = null;
            this.audioLoader = null;
            this.sounds = {};
            this.currentMusicTrackName = null;
            this.globalVolume = 1.0;
            this.isMuted = false;
            return;
        }

        this.listener = listener;
        this.audioLoader = new THREE.AudioLoader();
        this.sounds = {}; // { trackName: { sound: THREE.Audio, baseVolume: number, loop: boolean, path: string } }
        this.currentMusicTrackName = null; // 現在再生中のBGMのトラック名
        this.globalVolume = 1.0;
        this.isMuted = false;
    }





setListener(listener) {
    this.listener = listener;
    for (const trackName in this.sounds) {
        if (this.sounds[trackName].sound) {
            this.sounds[trackName].sound.setListener(listener);
        }
    }
}





    _applyVolumeToSound(soundEntry) {
        if (soundEntry && soundEntry.sound) {
            const effectiveVolume = soundEntry.baseVolume * this.globalVolume * (this.isMuted ? 0 : 1);
            soundEntry.sound.setVolume(effectiveVolume);
        }
    }

    async load(trackName, path, loop = true, autoplay = false, baseVolume = 1.0) {
        if (!this.listener || !this.audioLoader) {
            console.error("MusicManager is not properly initialized (no AudioListener). Cannot load music.");
            return Promise.reject(new Error("MusicManager not initialized."));
        }

        if (this.sounds[trackName]) {
            if (this.sounds[trackName].sound) {
                console.warn(`Music track "${trackName}" already loaded.`);
                return Promise.resolve(this.sounds[trackName].sound);
            }
            // ロード処理が既に開始されているが、まだ完了していない場合も考慮できるが、
            // ここではシンプルに上書き、またはエラーとする。今回は警告のみで進める。
        }

        return new Promise((resolve, reject) => {
            const soundEntry = {
                sound: null,
                baseVolume: Math.max(0, Math.min(1, baseVolume)), // 0から1の範囲にクランプ
                loop: loop,
                path: path
            };
            this.sounds[trackName] = soundEntry; // プレースホルダーとして登録

            this.audioLoader.load(
                path,
                (buffer) => {
                    const audio = new THREE.Audio(this.listener);
                    audio.setBuffer(buffer);
                    audio.setLoop(loop);

                    soundEntry.sound = audio; // THREE.Audioオブジェクトを格納
                    this._applyVolumeToSound(soundEntry); // 初期ボリュームを適用

                    console.log(`MusicManager: Track "${trackName}" loaded from ${path}.`);
                    if (autoplay) {
                        this.play(trackName);
                    }
                    resolve(audio);
                },
                undefined, // onProgress コールバック (必要なら実装)
                (error) => {
                    console.error(`MusicManager: Error loading track "${trackName}" from ${path}:`, error);
                    delete this.sounds[trackName]; // 失敗したらエントリを削除
                    reject(error);
                }
            );
        });
    }

    play(trackName, forceRestart = false) {
        if (!this.listener) return false;

        const soundEntry = this.sounds[trackName];
        if (!soundEntry || !soundEntry.sound) {
            console.warn(`MusicManager: Track "${trackName}" not found or not loaded yet.`);
            return false;
        }
        const sound = soundEntry.sound;

        // 他のBGMが再生中の場合、それを停止 (BGMは通常1つだけ)
        if (this.currentMusicTrackName && this.currentMusicTrackName !== trackName) {
            const currentSoundEntry = this.sounds[this.currentMusicTrackName];
            if (currentSoundEntry && currentSoundEntry.sound && currentSoundEntry.sound.isPlaying) {
                currentSoundEntry.sound.stop();
            }
        }

        if (sound.isPlaying) {
            if (forceRestart) {
                sound.stop(); // stop()は再生位置をリセット
                sound.play();
                // console.log(`MusicManager: Track "${trackName}" restarted.`);
            } else {
                // console.log(`MusicManager: Track "${trackName}" is already playing.`);
            }
        } else {
            sound.play();
            // console.log(`MusicManager: Track "${trackName}" started.`);
        }
        this.currentMusicTrackName = trackName;
        return true;
    }

    stop(trackName) {
        if (!this.listener) return false;

        const soundEntry = this.sounds[trackName];
        if (soundEntry && soundEntry.sound && soundEntry.sound.isPlaying) {
            soundEntry.sound.stop();
            // console.log(`MusicManager: Track "${trackName}" stopped.`);
            if (this.currentMusicTrackName === trackName) {
                this.currentMusicTrackName = null;
            }
            return true;
        }
        return false;
    }

    stopCurrent() {
        if (this.currentMusicTrackName) {
            return this.stop(this.currentMusicTrackName);
        }
        return false;
    }

    stopAll() {
        if (!this.listener) return;
        for (const trackName in this.sounds) {
            this.stop(trackName);
        }
        this.currentMusicTrackName = null;
        // console.log("MusicManager: All tracks stopped.");
    }

    pause(trackName) {
        if (!this.listener) return false;

        const soundEntry = this.sounds[trackName];
        if (soundEntry && soundEntry.sound && soundEntry.sound.isPlaying) {
            soundEntry.sound.pause();
            // console.log(`MusicManager: Track "${trackName}" paused.`);
            return true;
        }
        return false;
    }

    pauseCurrent() {
        if (this.currentMusicTrackName) {
            return this.pause(this.currentMusicTrackName);
        }
        return false;
    }

    resume(trackName) {
        if (!this.listener) return false;

        const soundEntry = this.sounds[trackName];
        // isPlayingがfalseで、かつsound.source (AudioBufferSourceNode) が存在すればpause状態
        if (soundEntry && soundEntry.sound && !soundEntry.sound.isPlaying && soundEntry.sound.source) {
            soundEntry.sound.play(); // Three.jsのAudio.play()はpause状態から再開できる
            // console.log(`MusicManager: Track "${trackName}" resumed.`);
            return true;
        }
        return false;
    }

    resumeCurrent() {
        if (this.currentMusicTrackName) {
            return this.resume(this.currentMusicTrackName);
        }
        return false;
    }

    setBaseVolume(trackName, volume) {
        if (!this.listener) return false;

        const soundEntry = this.sounds[trackName];
        if (soundEntry) {
            soundEntry.baseVolume = Math.max(0, Math.min(1, volume));
            this._applyVolumeToSound(soundEntry);
            // console.log(`MusicManager: Base volume for track "${trackName}" set to ${soundEntry.baseVolume}.`);
            return true;
        }
        return false;
    }

    setGlobalVolume(volume) {
        if (!this.listener) return;
        this.globalVolume = Math.max(0, Math.min(1, volume));
        for (const trackName in this.sounds) {
            this._applyVolumeToSound(this.sounds[trackName]);
        }
        // console.log(`MusicManager: Global volume set to ${this.globalVolume}.`);
    }

    mute() {
        if (!this.listener) return;
        if (!this.isMuted) {
            this.isMuted = true;
            for (const trackName in this.sounds) {
                this._applyVolumeToSound(this.sounds[trackName]);
            }
            // console.log("MusicManager: Muted.");
        }
    }

    unmute() {
        if (!this.listener) return;
        if (this.isMuted) {
            this.isMuted = false;
            for (const trackName in this.sounds) {
                this._applyVolumeToSound(this.sounds[trackName]);
            }
            // console.log("MusicManager: Unmuted.");
        }
    }

    toggleMute() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    isPlaying(trackName) {
        if (!this.listener) return false;
        const soundEntry = this.sounds[trackName];
        return soundEntry && soundEntry.sound ? soundEntry.sound.isPlaying : false;
    }

    isCurrentMusicPlaying() {
        if (this.currentMusicTrackName) {
            return this.isPlaying(this.currentMusicTrackName);
        }
        return false;
    }

    getCurrentTrackName() {
        return this.currentMusicTrackName;
    }
}