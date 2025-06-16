/**
 * メインアプリケーション - ロト7予測PWA
 * アプリ全体の初期化と制御
 */

// グローバルAPIインスタンス
window.api = new API();

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
            
            // PWA登録
            if (window.pwa) {
                await window.pwa.init();
            }
            
            // システム状態確認（初回のみ実行）
            if (!this.initialized) {
                await this.checkSystemStatus();
                this.initialized = true;
            }
            
            // 初期タブの読み込み（初回のみ実行）
            if (window.ui) {
                await window.ui.initTab('predict');
            }
            
            console.log('アプリケーション初期化完了');
            
        } catch (error) {
            console.error('アプリケーション初期化エラー:', error);
            if (window.ui) {
                window.ui.showToast('システム初期化に失敗しました', 'error');
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
                // システムが正常に初期化されている
                if (status.data.system_initialized) {
                    console.log('システムは正常に初期化されています');
                } else {
                    console.warn('システムが初期化されていません');
                    if (window.ui) {
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

// UI クラスの機能実装を拡張（既存のUIクラスに追加）
Object.assign(UI.prototype, {
    
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
            this.showToast('データの読み込みに失敗しました', 'error');
        } finally {
            this.isLoadingTab = false;
        }
    },
    
    /**
     * 現在のタブを更新（修正版）
     */
    async refreshCurrentTab() {
        this.showToast('更新中...', 'info');
        await this.initTab(this.currentTab, true);
    },
    
    /**
     * システム状態の読み込み・表示
     */
    async loadSystemStatus() {
        try {
            const status = await window.api.getDetailedStatus();
            
            if (status.status === 'success') {
                this.displaySystemStatus(status.data);
            } else {
                throw new Error(status.message || 'システム状態の取得に失敗しました');
            }
        } catch (error) {
            console.error('システム状態読み込みエラー:', error);
            this.displaySystemError(error.message);
        }
    },
    
    /**
     * システム状態の表示
     * @param {Object} statusData - ステータスデータ
     */
    displaySystemStatus(statusData) {
        const indicator = document.getElementById('system-indicator');
        const details = document.getElementById('status-details');
        
        if (!indicator || !details) return;
        
        // ステータスインジケーター
        const dot = indicator.querySelector('.dot');
        const text = indicator.querySelector('.text');
        
        if (statusData.initialized && statusData.models_trained > 0) {
            dot.style.backgroundColor = 'var(--success-color)';
            text.textContent = 'システム稼働中';
        } else if (statusData.initialized) {
            dot.style.backgroundColor = 'var(--warning-color)';
            text.textContent = '学習が必要';
        } else {
            dot.style.backgroundColor = 'var(--danger-color)';
            text.textContent = '初期化エラー';
        }
        
        // 詳細情報
        details.innerHTML = this.createStatusItems([
            { label: 'モデル数', value: `${statusData.models_trained || 0}個` },
            { label: '学習データ数', value: `${statusData.data_count || 0}件` },
            { label: '最新開催回', value: `第${statusData.latest_round || 0}回` },
            { label: 'データ状態', value: statusData.has_data ? '取得済み' : '未取得' },
            { label: '予測履歴', value: `${statusData.prediction_history?.total_predictions || 0}件` },
            { label: '照合済み', value: `${statusData.prediction_history?.verified_predictions || 0}件` }
        ]);
    },
    
    /**
     * システムエラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displaySystemError(errorMessage) {
        const indicator = document.getElementById('system-indicator');
        const details = document.getElementById('status-details');
        
        if (indicator) {
            const dot = indicator.querySelector('.dot');
            const text = indicator.querySelector('.text');
            dot.style.backgroundColor = 'var(--danger-color)';
            text.textContent = 'エラー';
        }
        
        if (details) {
            details.innerHTML = `<div class="error-message">${errorMessage}</div>`;
        }
    },
    
    /**
     * ステータスアイテムのHTML生成
     * @param {Array} items - ステータスアイテム配列
     * @returns {string} HTML
     */
    createStatusItems(items) {
        return items.map(item => `
            <div class="status-item">
                <div class="status-label">${item.label}</div>
                <div class="status-value">${item.value}</div>
            </div>
        `).join('');
    },
    
    /**
     * 予測の読み込み・表示
     */
    async loadPrediction() {
        try {
            const prediction = await window.api.getPrediction();
            
            if (prediction.status === 'success') {
                this.displayPrediction(prediction.data);
            } else {
                throw new Error(prediction.message || '予測の取得に失敗しました');
            }
        } catch (error) {
            console.error('予測読み込みエラー:', error);
            this.displayPredictionError(error.message);
        }
    },
    
    /**
     * 予測結果の表示
     * @param {Object} predictionData - 予測データ
     */
    displayPrediction(predictionData) {
        // タイトル更新
        const title = document.getElementById('prediction-title');
        if (title) {
            const status = predictionData.is_existing ? '📂 既存予測' : '🆕 新規予測';
            title.textContent = `第${predictionData.round}回 ${status}`;
        }
        
        // 情報表示
        const info = document.getElementById('prediction-info');
        if (info) {
            info.innerHTML = this.createInfoItems([
                { label: '開催回', value: `第${predictionData.round}回` },
                { label: '予測作成日', value: predictionData.created_at || '-' },
                { label: '予測セット数', value: `${predictionData.prediction_count || 0}セット` },
                { label: '学習モデル数', value: `${predictionData.model_info?.trained_models || 0}個` }
            ]);
        }
        
        // 予測番号表示
        const predictions = document.getElementById('predictions');
        if (predictions && predictionData.predictions) {
            predictions.innerHTML = predictionData.predictions.map((pred, index) => 
                this.createPredictionSet(pred, index + 1)
            ).join('');
        }
        
        // 前回結果表示
        if (predictionData.previous_results) {
            this.displayPreviousResults(predictionData.previous_results);
        }
        
        // ボタン状態更新
        this.updatePredictionButtons(predictionData);
    },
    
    /**
     * 予測エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayPredictionError(errorMessage) {
        const predictions = document.getElementById('predictions');
        if (predictions) {
            predictions.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">予測読み込みエラー</div>
                    <div class="error-message">${errorMessage}</div>
                    <button class="btn btn-primary" onclick="window.ui.loadPrediction()">
                        再試行
                    </button>
                </div>
            `;
        }
    },
    
    /**
     * 予測セットのHTML生成
     * @param {Array} numbers - 予測番号
     * @param {number} index - インデックス
     * @returns {string} HTML
     */
    createPredictionSet(numbers, index) {
        return `
            <div class="prediction-set">
                <div class="prediction-header">
                    <span class="prediction-index">予測 ${index}</span>
                </div>
                <div class="number-container">
                    ${numbers.map(num => `
                        <div class="number-ball">${num}</div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    /**
     * 前回結果の表示
     * @param {Object} previousResults - 前回結果
     */
    displayPreviousResults(previousResults) {
        const container = document.getElementById('previous-results');
        if (!container || !previousResults) return;
        
        container.innerHTML = `
            <h3>📊 第${previousResults.round}回 照合結果</h3>
            <div class="result-summary">
                <div class="summary-item">
                    <span class="summary-value">${previousResults.avg_matches.toFixed(1)}</span>
                    <span class="summary-label">平均一致数</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${previousResults.max_matches}</span>
                    <span class="summary-label">最高一致数</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${previousResults.matches.filter(m => m >= 4).length}</span>
                    <span class="summary-label">4個以上一致</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${previousResults.matches.filter(m => m >= 3).length}</span>
                    <span class="summary-label">3個以上一致</span>
                </div>
            </div>
        `;
        
        container.classList.remove('hidden');
    },
    
    /**
     * 情報アイテムのHTML生成
     * @param {Array} items - 情報アイテム配列
     * @returns {string} HTML
     */
    createInfoItems(items) {
        return items.map(item => `
            <div class="info-item">
                <div class="info-label">${item.label}</div>
                <div class="info-value">${item.value}</div>
            </div>
        `).join('');
    },
    
    /**
     * 予測ボタンの状態更新
     * @param {Object} predictionData - 予測データ
     */
    updatePredictionButtons(predictionData) {
        const getPredictionBtn = document.getElementById('get-prediction-btn');
        const refreshPredictionBtn = document.getElementById('refresh-prediction-btn');
        
        if (getPredictionBtn) {
            getPredictionBtn.disabled = false;
            if (predictionData.is_existing) {
                getPredictionBtn.innerHTML = '<span class="btn-icon">📂</span>既存予測表示';
            } else {
                getPredictionBtn.innerHTML = '<span class="btn-icon">🎲</span>予測を取得';
            }
        }
        
        if (refreshPredictionBtn) {
            refreshPredictionBtn.disabled = false;
        }
    },
    
    /**
     * 予測履歴の読み込み
     */
    async loadPredictionHistory() {
        try {
            const countSelect = document.getElementById('history-count');
            const count = countSelect ? parseInt(countSelect.value) : 5;
            
            const history = await window.api.getPredictionHistory(count);
            
            if (history.status === 'success') {
                this.displayPredictionHistory(history.data);
            } else {
                throw new Error(history.message || '履歴の取得に失敗しました');
            }
        } catch (error) {
            console.error('履歴読み込みエラー:', error);
            this.displayHistoryError(error.message);
        }
    },
    
    /**
     * 予測履歴の表示
     * @param {Object} historyData - 履歴データ
     */
    displayPredictionHistory(historyData) {
        // 精度サマリー表示
        this.displayAccuracySummary(historyData.accuracy_report);
        
        // 履歴リスト表示
        this.displayHistoryList(historyData.recent_predictions);
    },
    
    /**
     * 精度サマリーの表示
     * @param {Object} accuracyReport - 精度レポート
     */
    displayAccuracySummary(accuracyReport) {
        const container = document.getElementById('accuracy-summary');
        if (!container) return;
        
        if (accuracyReport.status === 'no_data') {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <div class="empty-title">精度データなし</div>
                    <div class="empty-description">${accuracyReport.message}</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <h3>📊 予測精度サマリー</h3>
            <div class="accuracy-grid">
                <div class="accuracy-item">
                    <span class="accuracy-value">${accuracyReport.verified_rounds}</span>
                    <span class="accuracy-label">照合済み回数</span>
                </div>
                <div class="accuracy-item">
                    <span class="accuracy-value">${accuracyReport.total_predictions}</span>
                    <span class="accuracy-label">総予測セット数</span>
                </div>
                <div class="accuracy-item">
                    <span class="accuracy-value">${accuracyReport.avg_matches}</span>
                    <span class="accuracy-label">平均一致数</span>
                </div>
                <div class="accuracy-item">
                    <span class="accuracy-value">${accuracyReport.max_matches}</span>
                    <span class="accuracy-label">最高一致数</span>
                </div>
            </div>
            <div class="match-distribution">
                <h4>一致数分布</h4>
                <div class="chart-container">
                    ${this.createMatchDistributionChart(accuracyReport.match_distribution)}
                </div>
            </div>
        `;
    },
    
    /**
     * 一致数分布チャートの生成
     * @param {Array} distribution - 分布データ
     * @returns {string} HTML
     */
    createMatchDistributionChart(distribution) {
        const maxCount = Math.max(...distribution.map(d => d.count));
        
        return `
            <div class="chart-data">
                ${distribution.map(item => `
                    <div class="chart-row">
                        <div class="chart-label">${item.matches}個一致</div>
                        <div class="chart-bar-container">
                            <div class="chart-bar" style="width: ${(item.count / maxCount) * 100}%">
                                <span class="chart-value">${item.count}回 (${item.percentage}%)</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    /**
     * 履歴リストの表示
     * @param {Array} predictions - 予測履歴
     */
    displayHistoryList(predictions) {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        if (!predictions || predictions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">履歴がありません</div>
                    <div class="empty-description">まだ予測履歴がありません</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = predictions.map(pred => 
            this.createHistoryItem(pred)
        ).join('');
    },
    
    /**
     * 履歴アイテムのHTML生成
     * @param {Object} prediction - 予測データ
     * @returns {string} HTML
     */
    createHistoryItem(prediction) {
        const statusIcon = prediction.verified ? '✅' : '⏳';
        const statusText = prediction.verified ? '照合済み' : '未照合';
        
        return `
            <div class="history-item ${prediction.verified ? 'verified' : ''}">
                <div class="history-header">
                    <span class="history-round">第${prediction.round}回</span>
                    <span class="history-date">${prediction.date}</span>
                    <span class="history-status">${statusIcon} ${statusText}</span>
                </div>
                <div class="history-body">
                    <div class="history-info">
                        予測セット数: ${prediction.prediction_count}
                    </div>
                    ${prediction.verified ? `
                        <div class="history-result">
                            <span>平均一致数: ${prediction.avg_matches?.toFixed(1) || '-'}</span>
                            <span>最高一致数: ${prediction.max_matches || '-'}</span>
                        </div>
                    ` : ''}
                </div>
                <button class="btn btn-sm btn-secondary" 
                        onclick="window.ui.viewPredictionDetail(${prediction.round})">
                    詳細を見る
                </button>
            </div>
        `;
    },
    
    /**
     * 履歴エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayHistoryError(errorMessage) {
        const container = document.getElementById('history-list');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">履歴読み込みエラー</div>
                    <div class="error-message">${errorMessage}</div>
                    <button class="btn btn-primary" onclick="window.ui.loadPredictionHistory()">
                        再試行
                    </button>
                </div>
            `;
        }
    },
    
    /**
     * 分析データの読み込み
     */
    async loadAnalysisData() {
        try {
            const results = await window.api.getRecentResults(10);
            
            if (results.status === 'success') {
                this.displayAnalysisData(results.data);
            } else {
                throw new Error(results.message || '分析データの取得に失敗しました');
            }
        } catch (error) {
            console.error('分析データ読み込みエラー:', error);
            this.displayAnalysisError(error.message);
        }
    },
    
    /**
     * 分析データの表示
     * @param {Object} analysisData - 分析データ
     */
    displayAnalysisData(analysisData) {
        // 実装は analysis.js で行う
        if (window.analysis) {
            window.analysis.displayData(analysisData);
        }
    },
    
    /**
     * 分析エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayAnalysisError(errorMessage) {
        const container = document.getElementById('analysis-content');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-title">分析データ読み込みエラー</div>
                    <div class="error-message">${errorMessage}</div>
                    <button class="btn btn-primary" onclick="window.ui.loadAnalysisData()">
                        再試行
                    </button>
                </div>
            `;
        }
    },
    
    /**
     * 予測詳細の表示
     * @param {number} roundNumber - 開催回
     */
    async viewPredictionDetail(roundNumber) {
        try {
            const analysis = await window.api.getPredictionAnalysis(roundNumber);
            
            if (analysis.status === 'success') {
                this.showPredictionDetailModal(analysis.data);
            } else {
                throw new Error(analysis.message || '詳細の取得に失敗しました');
            }
        } catch (error) {
            this.showToast('詳細の取得に失敗しました', 'error');
        }
    },
    
    /**
     * 予測詳細モーダルの表示
     * @param {Object} detailData - 詳細データ
     */
    showPredictionDetailModal(detailData) {
        const content = `
            <div class="prediction-detail">
                <h4>第${detailData.round}回 予測詳細</h4>
                <p>作成日: ${detailData.date}</p>
                ${detailData.verified ? `
                    <div class="detail-results">
                        <h5>照合結果</h5>
                        <p>当選番号: ${detailData.actual.join(', ')}</p>
                        <div class="detail-predictions">
                            ${detailData.detailed_results.map(result => `
                                <div class="detail-prediction">
                                    <span>予測${result.prediction_index + 1}: ${result.prediction.join(', ')}</span>
                                    <span class="match-count">${result.matches}個一致</span>
                                    ${result.matched_numbers.length > 0 ? `
                                        <div class="matched-numbers">
                                            一致: ${result.matched_numbers.join(', ')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="detail-predictions">
                        ${detailData.predictions.map((pred, idx) => `
                            <div class="detail-prediction">
                                <span>予測${idx + 1}: ${pred.join(', ')}</span>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
        
        this.showModal('予測詳細', content, [
            { text: '閉じる', class: 'btn-primary' }
        ]);
    },
    
    /**
     * 予測取得
     */
    async getPrediction() {
        try {
            const btn = document.getElementById('get-prediction-btn');
            if (btn) btn.disabled = true;
            
            this.showToast('予測を取得中...', 'info');
            
            await this.loadPrediction();
            
        } catch (error) {
            this.showToast('予測の取得に失敗しました', 'error');
        } finally {
            const btn = document.getElementById('get-prediction-btn');
            if (btn) btn.disabled = false;
        }
    },
    
    /**
     * モデル学習
     */
    async trainModel() {
        try {
            const confirmed = await this.showConfirmDialog(
                'モデル学習',
                'モデルの学習を開始します。これには数分かかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const btn = document.getElementById('train-model-btn');
            if (btn) btn.disabled = true;
            
            this.showToast('モデル学習を開始しました...', 'info');
            
            const result = await window.api.trainModel();
            
            if (result.status === 'success') {
                this.showToast('モデル学習が完了しました', 'success');
                // システム状態を更新
                await this.loadSystemStatus();
            } else {
                throw new Error(result.message || '学習に失敗しました');
            }
            
        } catch (error) {
            this.showToast(`学習エラー: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('train-model-btn');
            if (btn) btn.disabled = false;
        }
    },
    
    /**
     * 時系列検証
     */
    async runValidation() {
        try {
            const confirmed = await this.showConfirmDialog(
                '時系列検証',
                '時系列検証を実行します。これには時間がかかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const btn = document.getElementById('run-validation-btn');
            if (btn) btn.disabled = true;
            
            this.showToast('時系列検証を開始しました...', 'info');
            
            // 学習APIに含まれているため、学習を実行
            const result = await window.api.trainModel({
                force_full_train: false,
                run_timeseries_validation: true,
                run_auto_verification: false
            });
            
            if (result.status === 'success') {
                this.showToast('時系列検証が完了しました', 'success');
                // 結果を表示
                if (result.data.timeseries_validation) {
                    this.showValidationResults(result.data.timeseries_validation);
                }
            } else {
                throw new Error(result.message || '検証に失敗しました');
            }
            
        } catch (error) {
            this.showToast(`検証エラー: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('run-validation-btn');
            if (btn) btn.disabled = false;
        }
    },
    
    /**
     * 自動照合学習
     */
    async runLearning() {
        try {
            const confirmed = await this.showConfirmDialog(
                '自動照合学習',
                '自動照合学習を実行します。過去の予測と実績を照合して学習します。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const btn = document.getElementById('run-learning-btn');
            if (btn) btn.disabled = true;
            
            this.showToast('自動照合学習を開始しました...', 'info');
            
            const result = await window.api.trainModel({
                force_full_train: false,
                run_timeseries_validation: false,
                run_auto_verification: true
            });
            
            if (result.status === 'success') {
                this.showToast('自動照合学習が完了しました', 'success');
                // 結果を表示
                if (result.data.auto_verification) {
                    this.showLearningResults(result.data.auto_verification);
                }
            } else {
                throw new Error(result.message || '学習に失敗しました');
            }
            
        } catch (error) {
            this.showToast(`学習エラー: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('run-learning-btn');
            if (btn) btn.disabled = false;
        }
    },
    
    /**
     * 検証結果の表示
     * @param {Object} validationResults - 検証結果
     */
    showValidationResults(validationResults) {
        const content = `
            <div class="validation-results">
                <p>検証が完了しました。詳細な結果は分析タブで確認できます。</p>
                ${validationResults ? `
                    <div class="result-summary">
                        <p>検証済みラウンド数: ${validationResults.validated_rounds || 0}</p>
                        <p>総予測精度: ${validationResults.total_accuracy || 0}%</p>
                    </div>
                ` : ''}
            </div>
        `;
        
        this.showModal('時系列検証結果', content, [
            { text: '閉じる', class: 'btn-primary' }
        ]);
    },
    
    /**
     * 学習結果の表示
     * @param {Object} learningResults - 学習結果
     */
    showLearningResults(learningResults) {
        const content = `
            <div class="learning-results">
                <p>自動照合学習が完了しました。</p>
                ${learningResults ? `
                    <div class="result-summary">
                        <p>照合済み予測数: ${learningResults.verified_count || 0}</p>
                        ${learningResults.improvements ? `
                            <p>改善項目数: ${Object.keys(learningResults.improvements).length}</p>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.showModal('自動照合学習結果', content, [
            { text: '閉じる', class: 'btn-primary' }
        ]);
    },
    
    /**
     * ファイルダウンロード
     * @param {string} fileType - ファイルタイプ (model, history)
     */
    async downloadFile(fileType) {
        try {
            const filename = fileType === 'model' ? 'model.pkl' : 'prediction_history.csv';
            const blob = await window.api.downloadFile(`/api/download/${filename}`);
            
            // ダウンロード
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showToast(`${filename}をダウンロードしました`, 'success');
            
        } catch (error) {
            this.showToast(`ダウンロードエラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * ファイルアップロード
     * @param {File} file - ファイル
     * @param {string} fileType - ファイルタイプ
     */
    async handleFileUpload(file, fileType) {
        if (!file) return;
        
        try {
            const filename = fileType === 'model' ? 'model.pkl' : 'prediction_history.csv';
            
            this.showToast(`${filename}をアップロード中...`, 'info');
            
            const result = await window.api.uploadFile(`/api/upload/${filename}`, file);
            
            if (result.status === 'success') {
                this.showToast(`${filename}をアップロードしました`, 'success');
                // システム状態を更新
                await this.loadSystemStatus();
            } else {
                throw new Error(result.message || 'アップロードに失敗しました');
            }
            
        } catch (error) {
            this.showToast(`アップロードエラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 設定UIの更新
     */
    updateSettingsUI() {
        // ダークモード
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.checked = this.settings.darkMode;
        }
        
        // 自動更新
        const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.checked = this.settings.autoRefresh;
        }
        
        // 通知設定
        const notificationToggle = document.getElementById('notification-toggle');
        if (notificationToggle) {
            notificationToggle.checked = this.settings.notifications;
        }
        
        // バージョン情報
        const versionInfo = document.getElementById('version-info');
        if (versionInfo) {
            versionInfo.textContent = 'v1.0.0';
        }
        
        // 最終更新
        const lastUpdate = document.getElementById('last-update');
        if (lastUpdate) {
            lastUpdate.textContent = new Date().toLocaleString('ja-JP');
        }
        
        // キャッシュサイズ（推定）
        this.updateCacheSize();
    },
    
    /**
     * キャッシュサイズの更新
     */
    async updateCacheSize() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 0;
                
                const usageMB = (usage / 1024 / 1024).toFixed(1);
                const quotaMB = (quota / 1024 / 1024).toFixed(0);
                
                const cacheSize = document.getElementById('cache-size');
                if (cacheSize) {
                    cacheSize.textContent = `${usageMB} MB / ${quotaMB} MB`;
                }
            } catch (error) {
                console.error('ストレージ推定エラー:', error);
            }
        }
    },
    
    /**
     * 設定の読み込み
     * @returns {Object} 設定
     */
    loadSettings() {
        const defaultSettings = {
            darkMode: false,
            autoRefresh: false,
            notifications: false,
            refreshInterval: 300000 // 5分
        };
        
        try {
            const saved = localStorage.getItem('loto7-settings');
            if (saved) {
                return { ...defaultSettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('設定読み込みエラー:', error);
        }
        
        return defaultSettings;
    },
    
    /**
     * 設定の保存
     */
    saveSettings() {
        try {
            localStorage.setItem('loto7-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('設定保存エラー:', error);
        }
    },
    
    /**
     * 設定の適用
     */
    applySettings() {
        // ダークモード
        if (this.settings.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        // 自動更新
        if (this.settings.autoRefresh) {
            this.startAutoRefresh();
        }
    },
    
    /**
     * 自動更新の開始
     */
    startAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
        
        this.autoRefreshTimer = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.refreshCurrentTab();
            }
        }, this.settings.refreshInterval);
    },
    
    /**
     * 自動更新の停止
     */
    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
    },
    
    /**
     * キャッシュクリア
     */
    async clearCache() {
        const confirmed = await this.showConfirmDialog(
            'キャッシュクリア',
            'キャッシュをクリアすると、オフラインで使用できるデータが削除されます。続行しますか？'
        );
        
        if (!confirmed) return;
        
        try {
            // Service Workerのキャッシュクリア
            if ('caches' in window) {
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
});

// DOMContentLoaded イベント
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM読み込み完了');
    
    try {
        // アプリケーション初期化
        await window.app.initialize();
        
    } catch (error) {
        console.error('初期化エラー:', error);
    }
});

// ページ可視性の変更を監視
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.ui) {
        // ページが表示されたときに接続状態を更新
        window.ui.updateConnectionStatus(navigator.onLine);
    }
});

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);
});