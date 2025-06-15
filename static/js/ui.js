/**
 * UI管理クラス - ロト7予測PWA
 * ユーザーインターフェースの操作と表示を管理
 */

class UI {
    constructor() {
        this.currentTab = 'predict';
        this.toastContainer = document.getElementById('toast-container');
        this.modal = document.getElementById('modal-overlay');
        this.settings = this.loadSettings();
        
        this.init();
    }
    
    /**
     * 初期化
     */
    init() {
        this.setupEventListeners();
        this.applySettings();
        this.updateConnectionStatus(navigator.onLine);
    }
    
    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // タブ切り替え
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // モーダル関連
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideModal();
        });
        
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideModal();
            }
        });
        
        // 設定関連
        document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
            this.toggleDarkMode(e.target.checked);
        });
        
        document.getElementById('auto-refresh-toggle').addEventListener('change', (e) => {
            this.settings.autoRefresh = e.target.checked;
            this.saveSettings();
        });
        
        // ファイルアップロード
        document.getElementById('model-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'model');
        });
        
        document.getElementById('history-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0], 'history');
        });
        
        // その他のボタン
        this.setupButtonListeners();
    }
    
    /**
     * ボタンリスナーの設定
     */
    setupButtonListeners() {
        const buttons = {
            'refresh-btn': () => this.refreshCurrentTab(),
            'get-prediction-btn': () => this.getPrediction(),
            'refresh-prediction-btn': () => this.getPrediction(),
            'train-model-btn': () => this.trainModel(),
            'download-model-btn': () => this.downloadFile('model'),
            'download-history-btn': () => this.downloadFile('history'),
            'refresh-history-btn': () => this.loadPredictionHistory(),
            'run-validation-btn': () => this.runValidation(),
            'run-learning-btn': () => this.runLearning(),
            'clear-cache-btn': () => this.clearCache()
        };
        
        Object.entries(buttons).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('click', handler);
            }
        });
    }
    
    /**
     * タブ切り替え
     * @param {string} tabName - タブ名
     */
    switchTab(tabName) {
        // アクティブタブの更新
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // コンテンツの切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
        
        this.currentTab = tabName;
        
        // タブごとの初期化処理
        this.initTab(tabName);
    }
    
    /**
     * タブ初期化
     * @param {string} tabName - タブ名
     */
    async initTab(tabName) {
        switch (tabName) {
            case 'predict':
                await this.loadSystemStatus();
                await this.loadPrediction();
                break;
            case 'history':
                await this.loadPredictionHistory();
                break;
            case 'analysis':
                await this.loadAnalysisData();
                break;
            case 'settings':
                this.updateSettingsUI();
                break;
        }
    }
    
    /**
     * 現在のタブを更新
     */
    async refreshCurrentTab() {
        this.showToast('更新中...', 'info');
        await this.initTab(this.currentTab);
        this.showToast('更新完了', 'success');
    }
    
    /**
     * 接続状態の更新
     * @param {boolean} online - オンライン状態
     */
    updateConnectionStatus(online) {
        const indicator = document.querySelector('.connection-status .status-indicator');
        const text = document.querySelector('.connection-status .status-text');
        
        if (indicator && text) {
            indicator.className = `status-indicator ${online ? 'online' : 'offline'}`;
            text.textContent = online ? 'オンライン' : 'オフライン';
        }
        
        // オフライン時の警告表示
        this.toggleOfflineIndicator(!online);
    }
    
    /**
     * オフライン状態の表示切り替え
     * @param {boolean} show - 表示するか
     */
    toggleOfflineIndicator(show) {
        let indicator = document.querySelector('.offline-indicator');
        
        if (show && !indicator) {
            indicator = document.createElement('div');
            indicator.className = 'offline-indicator';
            indicator.textContent = 'オフラインです。一部機能が制限されます。';
            document.body.prepend(indicator);
            
            setTimeout(() => indicator.classList.add('show'), 100);
        } else if (!show && indicator) {
            indicator.classList.remove('show');
            setTimeout(() => indicator.remove(), 300);
        }
    }
    
    /**
     * ダークモードの切り替え
     * @param {boolean} enabled - ダークモード有効
     */
    toggleDarkMode(enabled) {
        document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
        this.settings.darkMode = enabled;
        this.saveSettings();
    }
    
    /**
     * ローディング表示
     * @param {string} elementId - 要素ID
     * @param {boolean} show - 表示するか
     */
    toggleLoading(elementId, show) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (show) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    }
    
    /**
     * トースト通知の表示
     * @param {string} message - メッセージ
     * @param {string} type - タイプ (success, error, warning, info)
     * @param {number} duration - 表示時間（ミリ秒）
     */
    showToast(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;
        
        // 閉じるボタン
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        // コンテナに追加
        this.toastContainer.appendChild(toast);
        
        // 自動削除
        if (duration > 0) {
            setTimeout(() => this.removeToast(toast), duration);
        }
        
        return toast;
    }
    
    /**
     * トースト削除
     * @param {HTMLElement} toast - トースト要素
     */
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOutDown 0.3s ease-in-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    /**
     * モーダル表示
     * @param {string} title - タイトル
     * @param {string} content - コンテンツ
     * @param {Array} buttons - ボタン配列
     */
    showModal(title, content, buttons = []) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').innerHTML = content;
        
        const footer = document.getElementById('modal-footer');
        footer.innerHTML = '';
        
        buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = `btn ${button.class || 'btn-secondary'}`;
            btn.textContent = button.text;
            btn.addEventListener('click', button.handler || (() => this.hideModal()));
            footer.appendChild(btn);
        });
        
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * モーダル非表示
     */
    hideModal() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    
    /**
     * 設定の読み込み
     * @returns {Object} 設定オブジェクト
     */
    loadSettings() {
        const defaultSettings = {
            darkMode: false,
            autoRefresh: true,
            notifications: false
        };
        
        try {
            const saved = localStorage.getItem('loto7-settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (e) {
            return defaultSettings;
        }
    }
    
    /**
     * 設定の保存
     */
    saveSettings() {
        try {
            localStorage.setItem('loto7-settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('設定の保存に失敗しました:', e);
        }
    }
    
    /**
     * 設定の適用
     */
    applySettings() {
        // ダークモード
        this.toggleDarkMode(this.settings.darkMode);
        document.getElementById('dark-mode-toggle').checked = this.settings.darkMode;
        
        // 自動更新
        document.getElementById('auto-refresh-toggle').checked = this.settings.autoRefresh;
        
        // 通知
        document.getElementById('notifications-toggle').checked = this.settings.notifications;
    }
    
    /**
     * ファイルアップロード処理
     * @param {File} file - ファイル
     * @param {string} type - ファイルタイプ
     */
    async handleFileUpload(file, type) {
        if (!file) return;
        
        try {
            this.showToast(`${type}ファイルをアップロード中...`, 'info');
            
            let result;
            if (type === 'model') {
                result = await window.api.uploadModel(file);
            } else if (type === 'history') {
                result = await window.api.uploadHistory(file);
            }
            
            if (result.status === 'success') {
                this.showToast(`${type}ファイルのアップロードが完了しました`, 'success');
                // 関連タブを更新
                if (type === 'model') {
                    await this.loadSystemStatus();
                } else if (type === 'history') {
                    await this.loadPredictionHistory();
                }
            } else {
                throw new Error(result.message || 'アップロードに失敗しました');
            }
        } catch (error) {
            this.showToast(`アップロードエラー: ${error.message}`, 'error');
        }
    }
    
    /**
     * ファイルダウンロード処理
     * @param {string} type - ファイルタイプ
     */
    async downloadFile(type) {
        try {
            this.showToast(`${type}ファイルをダウンロード中...`, 'info');
            
            let blob, filename;
            if (type === 'model') {
                blob = await window.api.downloadModel();
                filename = 'model.pkl';
            } else if (type === 'history') {
                blob = await window.api.downloadHistory();
                filename = 'prediction_history.csv';
            } else if (type === 'data') {
                blob = await window.api.downloadData();
                filename = 'loto7_data.csv';
            }
            
            // ダウンロード実行
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast(`${filename}をダウンロードしました`, 'success');
        } catch (error) {
            this.showToast(`ダウンロードエラー: ${error.message}`, 'error');
        }
    }
    
    /**
     * キャッシュクリア
     */
    async clearCache() {
        const confirmed = await this.showConfirmDialog(
            'キャッシュクリア',
            'アプリのキャッシュをクリアしますか？再読み込みが必要になります。'
        );
        
        if (confirmed) {
            try {
                // Service Workerキャッシュクリア
                if ('serviceWorker' in navigator && 'caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                
                // LocalStorageクリア（設定以外）
                const settings = localStorage.getItem('loto7-settings');
                localStorage.clear();
                if (settings) {
                    localStorage.setItem('loto7-settings', settings);
                }
                
                this.showToast('キャッシュをクリアしました。再読み込みしています...', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                this.showToast(`キャッシュクリアエラー: ${error.message}`, 'error');
            }
        }
    }
    
    /**
     * 確認ダイアログ表示
     * @param {string} title - タイトル
     * @param {string} message - メッセージ
     * @returns {Promise<boolean>} 確認結果
     */
    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            this.showModal(title, `<p>${message}</p>`, [
                {
                    text: 'キャンセル',
                    class: 'btn-secondary',
                    handler: () => {
                        resolve(false);
                        this.hideModal();
                    }
                },
                {
                    text: 'OK',
                    class: 'btn-primary',
                    handler: () => {
                        resolve(true);
                        this.hideModal();
                    }
                }
            ]);
        });
    }
    
    // 以下、具体的なデータ読み込み・表示メソッド（次のファイルで実装）
    async loadSystemStatus() { /* 次で実装 */ }
    async loadPrediction() { /* 次で実装 */ }
    async loadPredictionHistory() { /* 次で実装 */ }
    async loadAnalysisData() { /* 次で実装 */ }
    async getPrediction() { /* 次で実装 */ }
    async trainModel() { /* 次で実装 */ }
    async runValidation() { /* 次で実装 */ }
    async runLearning() { /* 次で実装 */ }
    updateSettingsUI() { /* 次で実装 */ }
}

// グローバルUIインスタンス
window.ui = new UI();