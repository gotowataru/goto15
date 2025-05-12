// main.js (エントリーポイント)
import { Game } from './js/Game.js'; // Game.js のパスをプロジェクト構造に合わせる

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init().catch(error => { // init() が async なので catch を追加
        console.error("ゲームの初期化中に致命的なエラーが発生 (main.js):", error);
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.textContent = 'エラー: 初期化に失敗しました。コンソールで詳細を確認してください。';
            loadingMessage.style.display = 'block';
        }
    });
});