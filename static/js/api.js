/**
 * API通信クラス - ロト7予測PWA
 * バックエンドAPIとの通信を管理
 */

class API {
    constructor() {
        this.baseURL = window.location.origin;
        this.isOnline = navigator.onLine;
        this.requestCount = 0;
        
        // オンライン/オフライン状態の監視
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.onConnectionChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.onConnectionChange(false);
        });
    }
    
    /**
     * 接続状態変更時のコールバック
     * @param {boolean} online - オンライン状態
     */
    onConnectionChange(online) {
        // UIクラスで処理
        if (window.ui) {
            window.ui.updateConnectionStatus(online);
        }
    }
    
    /**
     * APIリクエストの共通処理
     * @param {string} endpoint - エンドポイント
     * @param {Object} options - fetch options
     * @returns {Promise<Object>} レスポンス
     */
    async request(endpoint, options = {}) {
        // オフライン時の処理
        if (!this.isOnline && !options.allowOffline) {
            throw new Error('オフライン状態です。インターネット接続を確認してください。');
        }
        
        const requestId = ++this.requestCount;
        const url = `${this.baseURL}${endpoint}`;
        
        // デフォルトオプション
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        };
        
        // オプションをマージ
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };
        
        try {
            console.log(`[API ${requestId}] ${finalOptions.method || 'GET'} ${url}`);
            
            const response = await fetch(url, finalOptions);
            
            // レスポンスの検証
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // JSONパースに失敗した場合はHTTPステータスを使用
                }
                
                throw new Error(errorMessage);
            }
            
            // JSONレスポンスの解析
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            console.log(`[API ${requestId}] Success:`, data);
            return data;
            
        } catch (error) {
            console.error(`[API ${requestId}] Error:`, error);
            
            // ネットワークエラーの場合
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('ネットワークエラーが発生しました。接続を確認してください。');
            }
            
            throw error;
        }
    }
    
    /**
     * GETリクエスト
     * @param {string} endpoint - エンドポイント
     * @param {Object} params - クエリパラメータ
     * @returns {Promise<Object>} レスポンス
     */
    async get(endpoint, params = {}) {
        const url = new URL(endpoint, this.baseURL);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return this.request(url.pathname + url.search);
    }
    
    /**
     * POSTリクエスト
     * @param {string} endpoint - エンドポイント
     * @param {Object} data - リクエストボディ
     * @returns {Promise<Object>} レスポンス
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    /**
     * ファイルアップロード
     * @param {string} endpoint - エンドポイント
     * @param {File} file - ファイル
     * @returns {Promise<Object>} レスポンス
     */
    async uploadFile(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.request(endpoint, {
            method: 'POST',
            headers: {
                // Content-Typeを設定しない（ブラウザが自動設定）
            },
            body: formData
        });
    }
    
    /**
     * ファイルダウンロード
     * @param {string} endpoint - エンドポイント
     * @returns {Promise<Blob>} ファイルBlob
     */
    async downloadFile(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`ダウンロードに失敗しました: ${response.statusText}`);
        }
        
        return response.blob();
    }
    
    // === 予測API ===
    
    /**
     * システム状態を取得
     * @returns {Promise<Object>} システム状態
     */
    async getSystemStatus() {
        return this.get('/?api=true');
    }
    
    /**
     * 詳細ステータスを取得
     * @returns {Promise<Object>} 詳細ステータス
     */
    async getDetailedStatus() {
        return this.get('/api/status');
    }
    
    /**
     * 予測を取得
     * @returns {Promise<Object>} 予測結果
     */
    async getPrediction() {
        return this.get('/api/predict');
    }
    
    /**
     * モデル学習を実行
     * @param {Object} options - 学習オプション
     * @returns {Promise<Object>} 学習結果
     */
    async trainModel(options = {}) {
        const defaultOptions = {
            force_full_train: false,
            run_timeseries_validation: true,
            run_auto_verification: true
        };
        
        return this.post('/api/train', { ...defaultOptions, ...options });
    }
    
    /**
     * 最近の抽選結果を取得
     * @param {number} count - 取得件数
     * @returns {Promise<Object>} 抽選結果
     */
    async getRecentResults(count = 5) {
        return this.get('/api/recent_results', { count });
    }
    
    /**
     * 予測履歴を取得
     * @param {number} count - 取得件数
     * @returns {Promise<Object>} 予測履歴
     */
    async getPredictionHistory(count = 5) {
        return this.get('/api/prediction_history', { count });
    }
    
    /**
     * 指定回の予測分析を取得
     * @param {number} roundNumber - 開催回
     * @returns {Promise<Object>} 予測分析
     */
    async getPredictionAnalysis(roundNumber) {
        return this.get(`/api/prediction_analysis/${roundNumber}`);
    }
    
    /**
     * モデルファイルをダウンロード
     * @returns {Promise<Blob>} モデルファイル
     */
    async downloadModel() {
        return this.downloadFile('/api/download/model.pkl');
    }
    
    /**
     * 履歴ファイルをダウンロード
     * @returns {Promise<Blob>} 履歴ファイル
     */
    async downloadHistory() {
        return this.downloadFile('/api/download/prediction_history.csv');
    }
    
    /**
     * データファイルをダウンロード
     * @returns {Promise<Blob>} データファイル
     */
    async downloadData() {
        return this.downloadFile('/api/download/loto7_data.csv');
    }
    
    /**
     * モデルファイルをアップロード
     * @param {File} file - モデルファイル
     * @returns {Promise<Object>} アップロード結果
     */
    async uploadModel(file) {
        return this.uploadFile('/api/upload/model.pkl', file);
    }
    
    /**
     * 履歴ファイルをアップロード
     * @param {File} file - 履歴ファイル
     * @returns {Promise<Object>} アップロード結果
     */
    async uploadHistory(file) {
        return this.uploadFile('/api/upload/prediction_history.csv', file);
    }
    
    /**
     * データファイルをアップロード
     * @param {File} file - データファイル
     * @returns {Promise<Object>} アップロード結果
     */
    async uploadData(file) {
        return this.uploadFile('/api/upload/loto7_data.csv', file);
    }
}

// グローバルAPIインスタンス
window.api = new API();