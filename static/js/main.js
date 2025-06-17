// UI クラスが確実に読み込まれるまで待機する関数
function waitForUI() {
    return new Promise((resolve) => {
        function checkUI() {
            if (window.UI && typeof window.UI === 'function') {
                console.log('✅ UI クラスの読み込み確認');
                resolve(true);
                return;
            }
            
            console.log('⏳ UI クラスの読み込み待機中...');
            setTimeout(checkUI, 50);
        }
        
        checkUI();
    });
}

/**
 * アプリケーションクラス
 */
class App {
    constructor() {
        this.initialized = false;
        this.isLoading = false;
    }
    
    /**
     * アプリケーション初期化
     */
    async initialize() {
        try {
            console.log('アプリケーション初期化開始...');
            
            // UIクラスの読み込み待機
            await waitForUI();
            
            // APIの存在確認
            if (!window.api || typeof window.api.getSystemStatus !== 'function') {
                throw new Error('API が正しく初期化されていません');
            }
            
            // PWA登録
            if (window.pwa && typeof window.pwa.init === 'function') {
                await window.pwa.init();
            }
            
            // システム状態確認（初回のみ実行）
            if (!this.initialized) {
                await this.checkSystemStatus();
                this.initialized = true;
            }
            
            // UIインスタンス作成（UIクラスが確実に存在することを確認後）
            if (!window.ui && window.UI) {
                window.ui = new window.UI();
                console.log('✅ UI インスタンス作成完了');
            }
            
            // 初期タブの読み込み（初回のみ実行）
            if (window.ui && typeof window.ui.initTab === 'function') {
                await window.ui.initTab('predict');
            }
            
            console.log('アプリケーション初期化完了');
            
        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            if (window.ui && typeof window.ui.showToast === 'function') {
                window.ui.showToast('システム初期化に失敗しました: ' + error.message, 'error');
            }
        }
    }
    
    /**
     * システム状態確認
     */
    async checkSystemStatus() {
        try {
            const status = await window.api.getSystemStatus();
            
            if (status.status === 'success' && status.data) {
                if (status.data.system_initialized) {
                    console.log('システムは正常に初期化されています');
                } else {
                    console.warn('システムが初期化されていません');
                    if (window.ui && typeof window.ui.showToast === 'function') {
                        window.ui.showToast('システムを初期化しています...', 'info');
                    }
                }
            }
        } catch (error) {
            console.error('システム状態確認エラー:', error);
            throw error;
        }
    }
}

// グローバルアプリインスタンス
window.app = new App();

// UI クラスの機能拡張（UIクラスが存在する場合のみ）
function extendUIClass() {
    if (!window.UI || !window.UI.prototype) {
        console.warn('UI クラスが見つかりません。拡張をスキップします。');
        return;
    }
    
    // UI クラスの機能実装を拡張
    Object.assign(window.UI.prototype, {
        
        /**
         * タブ切り替え（修正版）
         * @param {string} tabName - タブ名
         */
        switchTab(tabName) {
            // 同じタブへの切り替えは無視
            if (this.currentTab === tabName) {
                return;
            }
            
            // アクティブタブの更新
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            
            // コンテンツの切り替え
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}-tab`);
            });
            
            this.currentTab = tabName;
            
            // タブごとの初期化処理（更新通知なし）
            this.initTab(tabName, false);
        },
        
        /**
         * タブ初期化（修正版）
         * @param {string} tabName - タブ名
         * @param {boolean} showUpdateToast - 更新通知を表示するか
         */
        async initTab(tabName, showUpdateToast = false) {
            // 既に読み込み中の場合はスキップ
            if (this.isLoadingTab) {
                return;
            }
            
            this.isLoadingTab = true;
            
            try {
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
                
                if (showUpdateToast) {
                    this.showToast('更新完了', 'success');
                }
            } catch (error) {
                console.error(`タブ初期化エラー (${tabName}):`, error);
                this.showToast(`${tabName}タブの読み込みに失敗しました`, 'error');
            } finally {
                this.isLoadingTab = false;
            }
        }
    });
    
    console.log('✅ UI クラス拡張完了');
}

// DOM読み込み完了後に実行
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 DOM読み込み完了');
    
    // UIクラスが読み込まれるまで待機
    await waitForUI();
    
    // UIクラスを拡張
    extendUIClass();
    
    // アプリケーション初期化
    await window.app.initialize();
});

// モバイルデバッグコンソール
class MobileDebugConsole {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.init();
    }
    
    init() {
        this.createPanel();
        this.interceptConsole();
        this.interceptErrors();
        console.log('📱 モバイルデバッグシステムが起動しました');
        console.log('🐛 ボタンでデバッグコンソールを開けます');
        console.log('🔍 ボタンでシステム診断を実行できます');
    }
    
    createPanel() {
        this.panel = document.createElement('div');
        this.panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            bottom: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 10px;
            z-index: 999999;
            display: none;
            flex-direction: column;
            font-family: monospace;
            font-size: 12px;
        `;
        
        this.panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #4CAF50;">📱 モバイルデバッグ</h3>
                <div>
                    <button onclick="window.mobileDebug.clear()" style="margin-right: 10px; padding: 5px 10px; background: #FF9800; border: none; border-radius: 5px; color: white;">クリア</button>
                    <button onclick="window.systemChecker.runDiagnostics()" style="margin-right: 10px; padding: 5px 10px; background: #2196F3; border: none; border-radius: 5px; color: white;">診断</button>
                    <button onclick="window.mobileDebug.hide()" style="padding: 5px 10px; background: #f44336; border: none; border-radius: 5px; color: white;">×</button>
                </div>
            </div>
            <div id="mobile-logs" style="flex: 1; overflow-y: auto; background: #111; padding: 10px; border-radius: 5px;"></div>
        `;
        
        document.body.appendChild(this.panel);
        this.logsContainer = this.panel.querySelector('#mobile-logs');
        
        // デバッグボタン追加
        this.addDebugButton();
    }
    
    addDebugButton() {
        const button = document.createElement('button');
        button.innerHTML = '🐛';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background: #4CAF50;
            border: none;
            color: white;
            font-size: 20px;
            z-index: 999998;
            cursor: pointer;
        `;
        button.onclick = () => this.toggle();
        document.body.appendChild(button);
    }
    
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const originalInfo = console.info;
        
        console.log = (...args) => {
            originalLog.apply(console, args);
            this.addLog('log', args);
        };
        
        console.error = (...args) => {
            originalError.apply(console, args);
            this.addLog('error', args);
        };
        
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.addLog('warn', args);
        };
        
        console.info = (...args) => {
            originalInfo.apply(console, args);
            this.addLog('info', args);
        };
    }
    
    interceptErrors() {
        window.addEventListener('error', (event) => {
            this.addLog('error', [
                `Error: ${event.message}`,
                `File: ${event.filename}`,
                `Line: ${event.lineno}:${event.colno}`
            ]);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.addLog('error', ['Unhandled Promise Rejection:', event.reason]);
        });
    }
    
    addLog(type, args) {
        const timestamp = new Date().toLocaleTimeString('ja-JP');
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        const log = { timestamp, type, message };
        this.logs.push(log);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.updateDisplay();
    }
    
    updateDisplay() {
        if (!this.logsContainer) return;
        
        const html = this.logs.map(log => {
            const color = {
                log: '#fff',
                error: '#ff5252',
                warn: '#ff9800',
                info: '#03a9f4'
            }[log.type] || '#fff';
            
            return `
                <div style="margin-bottom: 5px; color: ${color};">
                    <span style="color: #888;">[${log.timestamp}]</span>
                    <span style="color: ${color};">[${log.type.toUpperCase()}]</span>
                    <span>${this.escapeHtml(log.message)}</span>
                </div>
            `;
        }).join('');
        
        this.logsContainer.innerHTML = html;
        this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    show() {
        this.panel.style.display = 'flex';
    }
    
    hide() {
        this.panel.style.display = 'none';
    }
    
    toggle() {
        if (this.panel.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    }
    
    clear() {
        this.logs = [];
        this.updateDisplay();
    }
}

// システム診断クラス
class SystemStatusChecker {
    async runDiagnostics() {
        console.log('=== システム診断開始 ===');
        
        try {
            // 1. API接続テスト
            console.log('1. API接続テスト...');
            const response = await fetch('/?api=true');
            const data = await response.json();
            console.log('✅ API接続: OK', data);
        } catch (error) {
            console.error('❌ API接続: エラー', error.message);
        }
        
        try {
            // 2. システム初期化状態
            console.log('2. システム初期化状態...');
            const status = await window.api.getSystemStatus();
            console.log('✅ システム状態取得: OK', status);
        } catch (error) {
            console.error('❌ システム状態取得: エラー', error.message);
        }
        
        // 3. UI状態確認
        console.log('3. UI状態確認...');
        console.log('UI クラス:', typeof window.UI);
        console.log('ui インスタンス:', typeof window.ui);
        console.log('現在のタブ:', window.ui ? window.ui.currentTab : 'N/A');
        
        console.log('=== システム診断完了 ===');
    }
}

// グローバルに公開
window.mobileDebug = new MobileDebugConsole();
window.systemChecker = new SystemStatusChecker();