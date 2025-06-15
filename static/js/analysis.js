/**
 * 分析機能実装 - ロト7予測PWA
 * 分析タブと学習機能の実装
 */

// UI クラスの分析機能を拡張
Object.assign(UI.prototype, {
    
    /**
     * 分析データの読み込み
     */
    async loadAnalysisData() {
        try {
            // 最近の抽選結果を読み込み
            await this.loadRecentResults();
            
            // 現在の分析状態を表示
            this.displayAnalysisStatus();
        } catch (error) {
            console.error('分析データ読み込みエラー:', error);
            this.displayAnalysisError(error.message);
        }
    },
    
    /**
     * 最近の抽選結果読み込み
     */
    async loadRecentResults() {
        try {
            const results = await window.api.getRecentResults(10);
            
            if (results.status === 'success') {
                this.displayRecentResults(results.data);
            } else {
                throw new Error(results.message || '抽選結果の取得に失敗しました');
            }
        } catch (error) {
            console.error('抽選結果読み込みエラー:', error);
            this.displayRecentResultsError(error.message);
        }
    },
    
    /**
     * 最近の抽選結果表示
     * @param {Object} resultsData - 抽選結果データ
     */
    displayRecentResults(resultsData) {
        const container = document.getElementById('recent-results-list');
        if (!container) return;
        
        if (!resultsData.results || resultsData.results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎱</div>
                    <div class="empty-title">抽選結果なし</div>
                    <div class="empty-description">抽選結果データがありません</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="results-header">
                <h4>最近の抽選結果 (${resultsData.count}件)</h4>
                <p class="text-muted">最新: 第${resultsData.latest_round}回まで</p>
            </div>
            <div class="results-list">
                ${resultsData.results.map(result => `
                    <div class="result-item">
                        <div class="result-header">
                            <div class="round-info">
                                <span class="round-number">第${result.round}回</span>
                                <span class="round-date">${result.date}</span>
                            </div>
                        </div>
                        <div class="result-numbers">
                            <div class="main-numbers">
                                <span class="numbers-label">本数字:</span>
                                <div class="numbers-container">
                                    ${result.main_numbers.map(num => `
                                        <span class="number-ball">${num}</span>
                                    `).join('')}
                                </div>
                            </div>
                            ${result.bonus_numbers && result.bonus_numbers.length > 0 ? `
                                <div class="bonus-numbers">
                                    <span class="numbers-label">ボーナス:</span>
                                    <div class="numbers-container">
                                        ${result.bonus_numbers.map(num => `
                                            <span class="number-ball bonus">${num}</span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    /**
     * 分析状態の表示
     */
    displayAnalysisStatus() {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        container.innerHTML = `
            <div class="analysis-status">
                <div class="status-card">
                    <h4>🔍 分析機能</h4>
                    <p>時系列交差検証と自動学習改善を実行できます。</p>
                    <div class="analysis-info">
                        <div class="info-item">
                            <span class="info-label">時系列検証:</span>
                            <span class="info-value">固定窓・累積窓での予測精度検証</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">学習改善:</span>
                            <span class="info-value">過去結果との照合による自動学習</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 時系列検証の実行
     */
    async runValidation() {
        const button = document.getElementById('run-validation-btn');
        
        try {
            // ボタン無効化とローディング表示
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="btn-icon">⏳</span>検証実行中...';
            }
            
            this.showToast('時系列交差検証を実行中...', 'info', 0);
            
            // 検証実行（時間がかかる可能性があるのでタイムアウト設定）
            const result = await Promise.race([
                window.api.trainModel({
                    force_full_train: false,
                    run_timeseries_validation: true,
                    run_auto_verification: false
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('検証がタイムアウトしました')), 180000) // 3分
                )
            ]);
            
            if (result.status === 'success') {
                this.displayValidationResults(result.data);
                this.showToast('時系列検証が完了しました', 'success');
            } else {
                throw new Error(result.message || '検証に失敗しました');
            }
        } catch (error) {
            console.error('時系列検証エラー:', error);
            this.showToast(`検証エラー: ${error.message}`, 'error');
            this.displayValidationError(error.message);
        } finally {
            // ボタン復旧
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="btn-icon">📊</span>時系列検証実行';
            }
        }
    },
    
    /**
     * 検証結果の表示
     * @param {Object} validationData - 検証データ
     */
    displayValidationResults(validationData) {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        const trainingResult = validationData.training;
        const validationResult = validationData.timeseries_validation;
        
        let content = `
            <div class="validation-results">
                <div class="analysis-card">
                    <h4>📊 時系列交差検証結果</h4>
        `;
        
        // 学習結果
        if (trainingResult && trainingResult.success) {
            content += `
                <div class="training-summary">
                    <h5>🤖 モデル学習結果</h5>
                    <div class="metric-grid">
                        <div class="metric-item">
                            <span class="metric-value">${trainingResult.model_count}</span>
                            <span class="metric-label">学習モデル数</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${trainingResult.data_count}</span>
                            <span class="metric-label">学習データ数</span>
                        </div>
                    </div>
                    <div class="model-scores">
                        <h6>モデル別精度</h6>
                        ${Object.entries(trainingResult.model_scores).map(([model, score]) => `
                            <div class="score-item">
                                <span class="model-name">${this.getModelDisplayName(model)}:</span>
                                <span class="score-value">${(score * 100).toFixed(2)}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // 検証結果
        if (validationResult && validationResult.success && validationResult.result) {
            const vResult = validationResult.result;
            content += `
                <div class="validation-summary">
                    <h5>🔍 交差検証結果</h5>
                    <div class="metric-grid">
                        <div class="metric-item">
                            <span class="metric-value">${vResult.best_method || '不明'}</span>
                            <span class="metric-label">最適手法</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${vResult.best_score?.toFixed(3) || 'N/A'}</span>
                            <span class="metric-label">ベストスコア</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${vResult.improvement?.toFixed(3) || 'N/A'}</span>
                            <span class="metric-label">改善幅</span>
                        </div>
                    </div>
                    
                    ${vResult.detailed_results ? this.createValidationDetailChart(vResult.detailed_results) : ''}
                </div>
            `;
        }
        
        content += `
                </div>
            </div>
        `;
        
        container.innerHTML = content;
    },
    
    /**
     * 検証詳細チャートの生成
     * @param {Object} detailedResults - 詳細結果
     * @returns {string} HTML
     */
    createValidationDetailChart(detailedResults) {
        const methods = Object.entries(detailedResults);
        if (methods.length === 0) return '';
        
        const maxScore = Math.max(...methods.map(([_, data]) => data.avg_matches || 0));
        
        return `
            <div class="validation-chart">
                <h6>手法別性能比較</h6>
                <div class="chart-container">
                    <div class="chart-data">
                        ${methods.map(([method, data]) => `
                            <div class="chart-row">
                                <div class="chart-label">${this.getMethodDisplayName(method)}</div>
                                <div class="chart-bar">
                                    <div class="chart-fill" style="width: ${(data.avg_matches / maxScore) * 100}%"></div>
                                </div>
                                <div class="chart-value">${data.avg_matches?.toFixed(3) || 'N/A'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * モデル表示名の取得
     * @param {string} modelName - モデル名
     * @returns {string} 表示名
     */
    getModelDisplayName(modelName) {
        const displayNames = {
            'random_forest': 'ランダムフォレスト',
            'gradient_boost': '勾配ブースティング',
            'neural_network': 'ニューラルネット'
        };
        return displayNames[modelName] || modelName;
    },
    
    /**
     * 手法表示名の取得
     * @param {string} methodName - 手法名
     * @returns {string} 表示名
     */
    getMethodDisplayName(methodName) {
        const displayNames = {
            'fixed_10': '固定窓(10回)',
            'fixed_20': '固定窓(20回)',
            'fixed_30': '固定窓(30回)',
            'expanding': '累積窓'
        };
        return displayNames[methodName] || methodName;
    },
    
    /**
     * 自動学習改善の実行
     */
    async runLearning() {
        const button = document.getElementById('run-learning-btn');
        
        try {
            // ボタン無効化とローディング表示
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="btn-icon">⏳</span>学習実行中...';
            }
            
            this.showToast('自動学習改善を実行中...', 'info', 0);
            
            // 学習実行
            const result = await Promise.race([
                window.api.trainModel({
                    force_full_train: false,
                    run_timeseries_validation: false,
                    run_auto_verification: true
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('学習がタイムアウトしました')), 120000) // 2分
                )
            ]);
            
            if (result.status === 'success') {
                this.displayLearningResults(result.data);
                this.showToast('自動学習改善が完了しました', 'success');
            } else {
                throw new Error(result.message || '学習に失敗しました');
            }
        } catch (error) {
            console.error('自動学習エラー:', error);
            this.showToast(`学習エラー: ${error.message}`, 'error');
            this.displayLearningError(error.message);
        } finally {
            // ボタン復旧
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="btn-icon">🧠</span>学習改善実行';
            }
        }
    },
    
    /**
     * 学習結果の表示
     * @param {Object} learningData - 学習データ
     */
    displayLearningResults(learningData) {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        const autoVerification = learningData.auto_verification;
        
        let content = `
            <div class="learning-results">
                <div class="analysis-card">
                    <h4>🧠 自動学習改善結果</h4>
        `;
        
        if (autoVerification && autoVerification.success) {
            content += `
                <div class="learning-summary">
                    <div class="metric-grid">
                        <div class="metric-item">
                            <span class="metric-value">${autoVerification.verified_count || 0}</span>
                            <span class="metric-label">照合件数</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${Object.keys(autoVerification.improvements || {}).length}</span>
                            <span class="metric-label">改善項目数</span>
                        </div>
                    </div>
                    
                    ${this.createLearningImprovements(autoVerification.improvements)}
                </div>
            `;
        } else {
            content += `
                <div class="learning-summary">
                    <div class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <div class="empty-title">照合データなし</div>
                        <div class="empty-description">新しい照合可能な予測がありませんでした</div>
                    </div>
                </div>
            `;
        }
        
        content += `
                </div>
            </div>
        `;
        
        container.innerHTML = content;
    },
    
    /**
     * 学習改善内容の生成
     * @param {Object} improvements - 改善データ
     * @returns {string} HTML
     */
    createLearningImprovements(improvements) {
        if (!improvements || Object.keys(improvements).length === 0) {
            return '<p class="text-muted">改善項目はありませんでした</p>';
        }
        
        let content = '<div class="improvements-list">';
        
        // 高精度パターン学習
        if (improvements.high_accuracy_patterns) {
            const patterns = improvements.high_accuracy_patterns;
            content += `
                <div class="improvement-item">
                    <h6>🎯 高精度パターン学習</h6>
                    <div class="improvement-details">
                        <div class="pattern-stats">
                            <div class="stat-item">
                                <span class="stat-label">理想的な合計値:</span>
                                <span class="stat-value">${patterns.ideal_sum}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">理想的な奇数個数:</span>
                                <span class="stat-value">${patterns.ideal_odd_count}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">学習サンプル数:</span>
                                <span class="stat-value">${patterns.sample_size}件</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 頻出見逃し数字
        if (improvements.frequently_missed) {
            content += `
                <div class="improvement-item">
                    <h6>🔍 見逃し数字のブースト</h6>
                    <div class="improvement-details">
                        <div class="missed-numbers">
                            ${improvements.frequently_missed.map(item => `
                                <div class="missed-item">
                                    <span class="number-ball warning">${item.number}</span>
                                    <span class="miss-count">${item.miss_count}回見逃し</span>
                                </div>
                            `).join('')}
                        </div>
                        <p class="improvement-note">これらの番号は次回予測でブースト対象となります</p>
                    </div>
                </div>
            `;
        }
        
        content += '</div>';
        return content;
    },
    
    /**
     * モデル学習の実行
     */
    async trainModel() {
        const button = document.getElementById('train-model-btn');
        
        try {
            // ボタン無効化とローディング表示
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="btn-icon">⏳</span>学習中...';
            }
            
            this.showToast('モデル学習を実行中...', 'info', 0);
            
            // フル学習実行
            const result = await Promise.race([
                window.api.trainModel({
                    force_full_train: true,
                    run_timeseries_validation: true,
                    run_auto_verification: true
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('学習がタイムアウトしました')), 300000) // 5分
                )
            ]);
            
            if (result.status === 'success') {
                this.displayTrainingResults(result.data);
                this.showToast('モデル学習が完了しました', 'success');
                
                // システム状態を更新
                await this.loadSystemStatus();
            } else {
                throw new Error(result.message || '学習に失敗しました');
            }
        } catch (error) {
            console.error('モデル学習エラー:', error);
            this.showToast(`学習エラー: ${error.message}`, 'error');
            this.displayTrainingError(error.message);
        } finally {
            // ボタン復旧
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="btn-icon">🤖</span>モデル学習実行';
            }
        }
    },
    
    /**
     * 学習結果の表示
     * @param {Object} trainingData - 学習データ
     */
    displayTrainingResults(trainingData) {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        const training = trainingData.training;
        const validation = trainingData.timeseries_validation;
        const learning = trainingData.auto_verification;
        
        let content = `
            <div class="training-results">
                <div class="analysis-card">
                    <h4>🤖 フルモデル学習結果</h4>
        `;
        
        // 学習結果
        if (training && training.success) {
            content += `
                <div class="training-success">
                    <h5>✅ 学習完了</h5>
                    <div class="metric-grid">
                        <div class="metric-item">
                            <span class="metric-value">${training.model_count}</span>
                            <span class="metric-label">学習モデル数</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-value">${training.data_count}</span>
                            <span class="metric-label">学習データ数</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 検証結果サマリー
        if (validation && validation.success) {
            content += `
                <div class="validation-success">
                    <h5>📊 時系列検証: 完了</h5>
                    <p class="text-success">最適な予測手法が決定されました</p>
                </div>
            `;
        }
        
        // 学習改善サマリー
        if (learning && learning.success) {
            content += `
                <div class="learning-success">
                    <h5>🧠 自動学習: 完了</h5>
                    <p class="text-success">${learning.verified_count}件の予測を照合し、改善を適用しました</p>
                </div>
            `;
        }
        
        content += `
                <div class="training-complete">
                    <p class="text-center"><strong>🎉 全ての学習処理が正常に完了しました！</strong></p>
                    <p class="text-center text-muted">予測精度が向上し、次回予測でより良い結果が期待できます。</p>
                </div>
                </div>
            </div>
        `;
        
        container.innerHTML = content;
    },
    
    /**
     * 設定UIの更新
     */
    updateSettingsUI() {
        // アプリ情報の更新
        document.getElementById('last-update').textContent = new Date().toLocaleString('ja-JP');
        
        // キャッシュサイズの計算
        this.calculateCacheSize().then(size => {
            document.getElementById('cache-size').textContent = this.formatFileSize(size);
        });
    },
    
    /**
     * キャッシュサイズの計算
     * @returns {Promise<number>} キャッシュサイズ（バイト）
     */
    async calculateCacheSize() {
        let totalSize = 0;
        
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                totalSize = estimate.usage || 0;
            } else {
                // LocalStorageのサイズを概算
                let localStorageSize = 0;
                for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        localStorageSize += localStorage[key].length;
                    }
                }
                totalSize = localStorageSize * 2; // UTF-16なので2倍
            }
        } catch (error) {
            console.warn('キャッシュサイズの計算に失敗:', error);
        }
        
        return totalSize;
    },
    
    /**
     * ファイルサイズのフォーマット
     * @param {number} bytes - バイト数
     * @returns {string} フォーマット済みサイズ
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * 検証エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayValidationError(errorMessage) {
        const container = document.getElementById('analysis-results');
        if (container) {
            container.innerHTML = `
                <div class="analysis-card">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-title">検証エラー</div>
                        <div class="empty-description">${errorMessage}</div>
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * 学習エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayLearningError(errorMessage) {
        const container = document.getElementById('analysis-results');
        if (container) {
            container.innerHTML = `
                <div class="analysis-card">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-title">学習エラー</div>
                        <div class="empty-description">${errorMessage}</div>
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * 学習エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayTrainingError(errorMessage) {
        const container = document.getElementById('analysis-results');
        if (container) {
            container.innerHTML = `
                <div class="analysis-card">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-title">学習エラー</div>
                        <div class="empty-description">${errorMessage}</div>
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * 抽選結果エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayRecentResultsError(errorMessage) {
        const container = document.getElementById('recent-results-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-title">抽選結果取得エラー</div>
                    <div class="empty-description">${errorMessage}</div>
                </div>
            `;
        }
    },
    
    /**
     * 分析エラー表示
     * @param {string} errorMessage - エラーメッセージ
     */
    displayAnalysisError(errorMessage) {
        const container = document.getElementById('analysis-results');
        if (container) {
            container.innerHTML = `
                <div class="analysis-card">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-title">分析データ取得エラー</div>
                        <div class="empty-description">${errorMessage}</div>
                    </div>
                </div>
            `;
        }
    }
});