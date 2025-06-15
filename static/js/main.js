/**
 * メイン機能実装 - ロト7予測PWA
 * 予測表示・履歴・分析画面の具体的な実装
 */

// UI クラスの機能実装を拡張
Object.assign(UI.prototype, {
    
    /**
     * システム状態の読み込み・表示
     */
    async loadSystemStatus() {
        try {
            const status = await window.api.getSystemStatus();
            
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
        
        if (statusData.system_initialized && statusData.models_trained > 0) {
            dot.style.backgroundColor = 'var(--success-color)';
            text.textContent = 'システム稼働中';
        } else if (statusData.system_initialized) {
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
            const status = predictionData.is_existing ? '保存済み予測' : '新規予測';
            title.textContent = `第${predictionData.round}回 ${status}`;
        }
        
        // 予測結果表示
        this.displayPredictionResults(predictionData.predictions);
        
        // 予測情報表示
        this.displayPredictionInfo(predictionData);
        
        // 前回結果表示（ある場合）
        if (predictionData.previous_results) {
            this.displayPreviousResults(predictionData.previous_results);
        }
        
        // ボタン状態更新
        this.updatePredictionButtons(predictionData);
    },
    
    /**
     * 予測結果（20セット）の表示
     * @param {Array} predictions - 予測配列
     */
    displayPredictionResults(predictions) {
        const container = document.getElementById('prediction-results');
        if (!container) return;
        
        container.innerHTML = predictions.map((prediction, index) => `
            <div class="prediction-set">
                <div class="set-number">予測${index + 1}</div>
                <div class="numbers-container">
                    ${prediction.map(num => `
                        <span class="number-ball">${num}</span>
                    `).join('')}
                </div>
            </div>
        `).join('');
        
        container.classList.remove('hidden');
    },
    
    /**
     * 予測情報の表示
     * @param {Object} predictionData - 予測データ
     */
    displayPredictionInfo(predictionData) {
        const container = document.getElementById('prediction-info');
        if (!container) return;
        
        const infoItems = [
            { label: '開催回', value: `第${predictionData.round}回` },
            { label: '作成日時', value: new Date(predictionData.created_at).toLocaleString('ja-JP') },
            { label: '予測セット数', value: `${predictionData.prediction_count}セット` },
            { label: '状態', value: predictionData.is_existing ? '保存済み' : '新規作成' }
        ];
        
        if (predictionData.model_info) {
            infoItems.push(
                { label: 'モデル数', value: `${predictionData.model_info.trained_models}個` },
                { label: '学習データ数', value: `${predictionData.model_info.data_count}件` }
            );
        }
        
        if (predictionData.verified) {
            infoItems.push(
                { label: '検証状況', value: '照合済み' },
                { label: '最高一致数', value: `${Math.max(...predictionData.matches)}個` }
            );
        }
        
        container.innerHTML = `
            <div class="info-grid">
                ${this.createInfoItems(infoItems)}
            </div>
        `;
        
        container.classList.remove('hidden');
    },
    
    /**
     * 前回結果の表示
     * @param {Object} previousResults - 前回結果データ
     */
    displayPreviousResults(previousResults) {
        const container = document.getElementById('previous-results');
        if (!container) return;
        
        container.innerHTML = `
            <h3>第${previousResults.round}回 結果分析</h3>
            <div class="winning-numbers">
                <h4>🎯 当選番号</h4>
                <div class="numbers-container">
                    ${previousResults.actual.map(num => `
                        <span class="number-ball matched">${num}</span>
                    `).join('')}
                </div>
            </div>
            <div class="result-summary">
                <div class="summary-item">
                    <span class="summary-value">${previousResults.avg_matches.toFixed(2)}</span>
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
                getPredictionBtn.innerHTML = '<span class="btn-icon">🎯</span>新規予測生成';
            }
        }
        
        if (refreshPredictionBtn) {
            refreshPredictionBtn.disabled = false;
        }
    },
    
    /**
     * 予測エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayPredictionError(errorMessage) {
        const container = document.getElementById('prediction-results');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">予測取得エラー</div>
                    <div class="empty-description">${errorMessage}</div>
                </div>
            `;
            container.classList.remove('hidden');
        }
    },
    
    /**
     * 予測取得の実行
     */
    async getPrediction() {
        const button = document.getElementById('get-prediction-btn');
        const loading = document.getElementById('prediction-loading');
        
        try {
            // ローディング表示
            if (button) button.disabled = true;
            this.toggleLoading('prediction-loading', true);
            
            await this.loadPrediction();
            
            this.showToast('予測を取得しました', 'success');
        } catch (error) {
            this.showToast(`予測取得エラー: ${error.message}`, 'error');
        } finally {
            // ローディング非表示
            if (button) button.disabled = false;
            this.toggleLoading('prediction-loading', false);
        }
    },
    
    /**
     * 予測履歴の読み込み・表示
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
                        <div class="chart-bar">
                            <div class="chart-fill" style="width: ${(item.count / maxCount) * 100}%"></div>
                        </div>
                        <div class="chart-value">${item.count} (${item.percentage}%)</div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    /**
     * 履歴リストの表示
     * @param {Array} predictions - 予測履歴配列
     */
    displayHistoryList(predictions) {
        const container = document.getElementById('history-list');
        if (!container) return;
        
        if (!predictions || predictions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <div class="empty-title">履歴なし</div>
                    <div class="empty-description">まだ予測履歴がありません</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = predictions.map(prediction => `
            <div class="history-item" onclick="window.ui.showPredictionDetail(${prediction.round})">
                <div class="history-header-info">
                    <div class="round-info">
                        <span class="round-number">第${prediction.round}回</span>
                        <span class="round-date">${new Date(prediction.date).toLocaleDateString('ja-JP')}</span>
                    </div>
                    <div class="verification-badge ${prediction.verified ? 'badge-verified' : 'badge-pending'}">
                        ${prediction.verified ? '照合済み' : '未照合'}
                    </div>
                </div>
                <div class="prediction-summary">
                    <div class="summary-stats">
                        <span>予測セット数: ${prediction.prediction_count}</span>
                        ${prediction.verified ? `
                            <span>最高一致: ${prediction.max_matches}個</span>
                            <span>平均一致: ${prediction.avg_matches.toFixed(2)}個</span>
                        ` : ''}
                    </div>
                </div>
                ${prediction.verified && prediction.actual ? `
                    <div class="actual-numbers">
                        <span class="label">当選番号:</span>
                        <div class="numbers-container">
                            ${prediction.actual.map(num => `
                                <span class="number-ball matched">${num}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    },
    
    /**
     * 予測詳細表示
     * @param {number} roundNumber - 開催回
     */
    async showPredictionDetail(roundNumber) {
        try {
            const analysis = await window.api.getPredictionAnalysis(roundNumber);
            
            if (analysis.status === 'success') {
                this.displayPredictionDetailModal(analysis.data);
            } else {
                throw new Error(analysis.message || '詳細の取得に失敗しました');
            }
        } catch (error) {
            this.showToast(`詳細取得エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 予測詳細モーダル表示
     * @param {Object} analysisData - 分析データ
     */
    displayPredictionDetailModal(analysisData) {
        const content = `
            <div class="prediction-detail">
                <div class="detail-header">
                    <h4>第${analysisData.round}回 予測詳細分析</h4>
                    <p>作成日時: ${new Date(analysisData.date).toLocaleString('ja-JP')}</p>
                </div>
                
                ${analysisData.verified ? `
                    <div class="actual-result">
                        <h5>🎯 当選番号</h5>
                        <div class="numbers-container">
                            ${analysisData.actual.map(num => `
                                <span class="number-ball matched">${num}</span>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="detailed-analysis">
                        <h5>📊 詳細分析</h5>
                        <div class="analysis-summary">
                            <div class="stat-item">
                                <span class="stat-value">${analysisData.summary.avg_matches.toFixed(2)}</span>
                                <span class="stat-label">平均一致数</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${analysisData.summary.max_matches}</span>
                                <span class="stat-label">最高一致数</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${analysisData.summary.total_predictions}</span>
                                <span class="stat-label">予測セット数</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="prediction-sets">
                    <h5>予測セット (${analysisData.predictions.length}セット)</h5>
                    <div class="sets-list">
                        ${analysisData.predictions.map((prediction, index) => `
                            <div class="prediction-set-detail">
                                <div class="set-header">
                                    <span class="set-number">予測${index + 1}</span>
                                    ${analysisData.verified ? `
                                        <span class="match-count">${analysisData.detailed_results[index].matches}個一致</span>
                                    ` : ''}
                                </div>
                                <div class="numbers-container">
                                    ${prediction.map(num => {
                                        let className = 'number-ball';
                                        if (analysisData.verified) {
                                            const result = analysisData.detailed_results[index];
                                            if (result.matched_numbers.includes(num)) {
                                                className += ' matched';
                                            } else {
                                                className += ' extra';
                                            }
                                        }
                                        return `<span class="${className}">${num}</span>`;
                                    }).join('')}
                                </div>
                                ${analysisData.verified ? `
                                    <div class="match-details">
                                        <small>見逃し: ${analysisData.detailed_results[index].missed_numbers.join(', ')}</small>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.showModal(`第${analysisData.round}回 予測詳細`, content, [
            { text: '閉じる', class: 'btn-primary' }
        ]);
    },
    
    /**
     * 履歴エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayHistoryError(errorMessage) {
        const container = document.getElementById('history-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">履歴取得エラー</div>
                    <div class="empty-description">${errorMessage}</div>
                </div>
            `;
        }
    }
});

// グローバル関数として公開（HTMLから呼び出すため）
window.showPredictionDetail = (roundNumber) => {
    if (window.ui) {
        window.ui.showPredictionDetail(roundNumber);
    }
};