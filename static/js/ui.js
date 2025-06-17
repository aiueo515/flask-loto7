/**
 * UI管理クラス - 非同期対応機能追加
 * 長時間処理の進捗表示とユーザー体験向上
 */

// 既存のUIクラスに非同期対応機能を追加
Object.assign(UI.prototype, {
    
    /**
     * 🔥 非同期タスクの進捗モーダル表示
     * @param {string} title - モーダルタイトル
     * @param {string} taskId - タスクID
     * @param {Function} onComplete - 完了コールバック
     * @param {Function} onError - エラーコールバック
     */
    showProgressModal(title, taskId, onComplete, onError) {
        const content = `
            <div class="progress-modal">
                <div class="progress-info">
                    <div class="progress-status" id="progress-status">準備中...</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-percentage" id="progress-percentage">0%</div>
                    </div>
                    <div class="progress-details" id="progress-details">
                        <span id="progress-current">0</span> / <span id="progress-total">1</span>
                    </div>
                </div>
                <div class="progress-actions">
                    <button id="cancel-task-btn" class="btn btn-danger">
                        <span class="btn-icon">❌</span>
                        キャンセル
                    </button>
                </div>
            </div>
        `;
        
        // モーダル表示
        this.showModal(title, content, []);
        
        // キャンセルボタンのイベント
        document.getElementById('cancel-task-btn').addEventListener('click', async () => {
            try {
                await window.api.cancelTask(taskId);
                this.hideModal();
                this.showToast('タスクをキャンセルしました', 'warning');
            } catch (error) {
                this.showToast('キャンセルに失敗しました', 'error');
            }
        });
        
        // 進捗更新のコールバック
        const onProgress = (progress) => {
            this.updateProgress(progress);
        };
        
        const onCompleteWrapper = (result) => {
            this.hideModal();
            onComplete && onComplete(result);
        };
        
        const onErrorWrapper = (error) => {
            this.hideModal();
            this.showToast(`エラー: ${error.message}`, 'error');
            onError && onError(error);
        };
        
        // APIからポーリング開始（taskIdは既に開始済み）
        window.api.pollTaskStatus(taskId, onProgress, onCompleteWrapper, onErrorWrapper);
    },
    
    /**
     * 進捗情報の更新
     * @param {Object} progress - 進捗情報
     */
    updateProgress(progress) {
        const statusEl = document.getElementById('progress-status');
        const fillEl = document.getElementById('progress-fill');
        const percentageEl = document.getElementById('progress-percentage');
        const currentEl = document.getElementById('progress-current');
        const totalEl = document.getElementById('progress-total');
        
        if (statusEl) statusEl.textContent = progress.status || '処理中...';
        if (fillEl) fillEl.style.width = `${progress.progress || 0}%`;
        if (percentageEl) percentageEl.textContent = `${progress.progress || 0}%`;
        if (currentEl) currentEl.textContent = progress.current || 0;
        if (totalEl) totalEl.textContent = progress.total || 1;
    },
    
    /**
     * 🔥 重いコンポーネントの非同期初期化
     */
    async initHeavyComponentsAsync() {
        try {
            const taskId = await window.api.initHeavyComponentsAsync(
                // onProgress
                (progress) => {
                    console.log('初期化進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.showToast('初期化が完了しました！', 'success');
                    // システム状態を更新
                    this.loadSystemStatus();
                },
                // onError
                (error) => {
                    console.error('初期化エラー:', error);
                }
            );
            
            this.showProgressModal('重いコンポーネント初期化', taskId,
                (result) => {
                    this.showToast('初期化が完了しました！', 'success');
                    this.loadSystemStatus();
                },
                (error) => {
                    this.showToast(`初期化エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`初期化開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 🔥 非同期予測取得
     */
    async getPredictionAsync() {
        try {
            const taskId = await window.api.getPredictionAsync(
                // onProgress
                (progress) => {
                    console.log('予測進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.displayPredictionFromAsync(result);
                },
                // onError
                (error) => {
                    console.error('予測エラー:', error);
                }
            );
            
            this.showProgressModal('予測生成中', taskId,
                (result) => {
                    this.displayPredictionFromAsync(result);
                    this.showToast('予測が完了しました！', 'success');
                },
                (error) => {
                    this.showToast(`予測エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`予測開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 🔥 非同期モデル学習
     */
    async trainModelAsync(options = {}) {
        try {
            const confirmed = await this.showConfirmDialog(
                'モデル学習',
                '非同期でモデル学習を開始します。処理には数分かかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const taskId = await window.api.trainModelAsync(
                options,
                // onProgress
                (progress) => {
                    console.log('学習進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.displayTrainingResults(result);
                },
                // onError
                (error) => {
                    console.error('学習エラー:', error);
                }
            );
            
            this.showProgressModal('モデル学習中', taskId,
                (result) => {
                    this.displayTrainingResults(result);
                    this.showToast('学習が完了しました！', 'success');
                    this.loadSystemStatus(); // システム状態更新
                },
                (error) => {
                    this.showToast(`学習エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`学習開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 🔥 非同期時系列検証
     */
    async runValidationAsync() {
        try {
            const confirmed = await this.showConfirmDialog(
                '時系列検証',
                '非同期で時系列検証を開始します。処理には時間がかかる場合があります。続行しますか？'
            );
            
            if (!confirmed) return;
            
            const taskId = await window.api.runValidationAsync(
                // onProgress
                (progress) => {
                    console.log('検証進捗:', progress);
                },
                // onComplete
                (result) => {
                    this.displayValidationResults(result);
                },
                // onError
                (error) => {
                    console.error('検証エラー:', error);
                }
            );
            
            this.showProgressModal('時系列検証中', taskId,
                (result) => {
                    this.displayValidationResults(result);
                    this.showToast('検証が完了しました！', 'success');
                },
                (error) => {
                    this.showToast(`検証エラー: ${error.message}`, 'error');
                }
            );
            
        } catch (error) {
            this.showToast(`検証開始エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 非同期予測結果の表示
     * @param {Object} result - 非同期タスクの結果
     */
    displayPredictionFromAsync(result) {
        if (result.status === 'success') {
            // 予測データを適切な形式に変換
            const predictionData = {
                round: result.next_info?.next_round || 'Unknown',
                predictions: result.predictions || [],
                is_existing: false,
                created_at: result.next_info?.current_date || new Date().toISOString(),
                prediction_count: result.predictions?.length || 0
            };
            
            this.displayPrediction(predictionData);
        } else {
            this.displayPredictionError(result.message || '予測生成に失敗しました');
        }
    },
    
    /**
     * 非同期学習結果の表示
     * @param {Object} result - 学習結果
     */
    displayTrainingResults(result) {
        if (result.status === 'success' && result.results) {
            // 分析タブに結果を表示
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="training-results">
                        <div class="analysis-card">
                            <h4>🤖 非同期学習完了</h4>
                            
                            ${result.results.training ? `
                                <div class="training-success">
                                    <h5>✅ モデル学習完了</h5>
                                    <div class="metric-grid">
                                        <div class="metric-item">
                                            <span class="metric-value">${result.results.training.model_count}</span>
                                            <span class="metric-label">学習モデル数</span>
                                        </div>
                                        <div class="metric-item">
                                            <span class="metric-value">${result.results.training.data_count}</span>
                                            <span class="metric-label">学習データ数</span>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${result.results.timeseries_validation ? `
                                <div class="validation-success">
                                    <h5>📊 時系列検証: ${result.results.timeseries_validation.success ? '完了' : '失敗'}</h5>
                                </div>
                            ` : ''}
                            
                            ${result.results.auto_verification ? `
                                <div class="learning-success">
                                    <h5>🧠 自動学習: ${result.results.auto_verification.success ? '完了' : '失敗'}</h5>
                                    ${result.results.auto_verification.verified_count ? `
                                        <p>${result.results.auto_verification.verified_count}件の予測を照合・改善しました</p>
                                    ` : ''}
                                </div>
                            ` : ''}
                            
                            <div class="training-complete">
                                <p class="text-center"><strong>🎉 非同期学習処理が正常に完了しました！</strong></p>
                                <p class="text-center text-muted">予測精度が向上し、次回予測でより良い結果が期待できます。</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">❌</div>
                            <div class="empty-title">学習エラー</div>
                            <div class="empty-description">${result.message || '学習に失敗しました'}</div>
                        </div>
                    </div>
                `;
            }
        }
    },
    
    /**
     * 非同期検証結果の表示
     * @param {Object} result - 検証結果
     */
    displayValidationResults(result) {
        if (result.status === 'success') {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="validation-results">
                        <div class="analysis-card">
                            <h4>📊 非同期時系列検証完了</h4>
                            <div class="validation-summary">
                                <p>✅ 時系列交差検証が正常に完了しました</p>
                                <p>詳細な結果は今後のアップデートで表示予定です</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        } else {
            const container = document.getElementById('analysis-results');
            if (container) {
                container.innerHTML = `
                    <div class="analysis-card">
                        <div class="empty-state">
                            <div class="empty-icon">❌</div>
                            <div class="empty-title">検証エラー</div>
                            <div class="empty-description">${result.message || '検証に失敗しました'}</div>
                        </div>
                    </div>
                `;
            }
        }
    },
    
    /**
     * システム最適化の実行
     */
    async optimizeSystem() {
        try {
            this.showToast('システム最適化中...', 'info');
            
            const result = await window.api.optimizeSystem();
            
            if (result.status === 'success') {
                const freed = result.data.freed_memory_mb;
                this.showToast(`最適化完了！${freed > 0 ? freed + 'MB解放' : 'メモリクリーンアップ完了'}`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            this.showToast(`最適化エラー: ${error.message}`, 'error');
        }
    },
    
    /**
     * 段階的初期化オプション表示（非同期対応版）
     */
    showSystemInitializationOptions() {
        const container = document.getElementById('prediction-card');
        if (!container) return;
        
        container.innerHTML = `
            <div class="card-header">
                <h2>🎯 予測システム（非同期対応）</h2>
            </div>
            
            <div class="init-options">
                <div class="init-status">
                    <h3>📱 アプリ準備完了</h3>
                    <p>超軽量初期化が完了しました。重い処理は非同期で実行されます。</p>
                    <p>以下のオプションから選択してください：</p>
                </div>
                
                <div class="init-methods">
                    <div class="method-card">
                        <h4>🎲 予測開始（自動初期化）</h4>
                        <p>必要に応じて自動初期化してから予測を実行します</p>
                        <button id="auto-predict-btn" class="btn btn-primary">
                            <span class="btn-icon">🎯</span>
                            予測開始（非同期）
                        </button>
                    </div>
                    
                    <div class="method-card">
                        <h4>⚡ 事前初期化</h4>
                        <p>重いコンポーネントを事前に初期化します</p>
                        <button id="manual-init-btn" class="btn btn-secondary">
                            <span class="btn-icon">🔧</span>
                            事前初期化（非同期）
                        </button>
                    </div>
                    
                    <div class="method-card">
                        <h4>🔧 システム最適化</h4>
                        <p>メモリ使用量を最適化します</p>
                        <button id="optimize-btn" class="btn btn-warning">
                            <span class="btn-icon">💾</span>
                            メモリ最適化
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // イベントリスナー設定
        document.getElementById('auto-predict-btn').addEventListener('click', () => {
            this.getPredictionAsync();
        });
        
        document.getElementById('manual-init-btn').addEventListener('click', () => {
            this.initHeavyComponentsAsync();
        });
        
        document.getElementById('optimize-btn').addEventListener('click', () => {
            this.optimizeSystem();
        });
    }
});

// 既存のメソッドを非同期版にリダイレクト
Object.assign(UI.prototype, {
    
    /**
     * 予測取得（非同期版に自動リダイレクト）
     */
    async getPrediction() {
        console.log('🔄 getPrediction() -> getPredictionAsync() にリダイレクト');
        return this.getPredictionAsync();
    },
    
    /**
     * モデル学習（非同期版に自動リダイレクト）
     */
    async trainModel() {
        console.log('🔄 trainModel() -> trainModelAsync() にリダイレクト');
        return this.trainModelAsync();
    },
    
    /**
     * 時系列検証（非同期版に自動リダイレクト）
     */
    async runValidation() {
        console.log('🔄 runValidation() -> runValidationAsync() にリダイレクト');
        return this.runValidationAsync();
    },
    
    /**
     * 段階的システム初期化（非同期対応版）
     */
    async initializeSystemProgressively() {
        console.log('🚀 段階的システム初期化開始（非同期対応）');
        
        try {
            // 基本状態確認
            const basicStatus = await window.api.getSystemStatus();
            console.log('✅ 基本システム状態確認完了');
            
            if (basicStatus.status === 'success') {
                this.displayBasicSystemStatus(basicStatus.data);
            }
        } catch (error) {
            console.error('❌ 基本システム状態確認エラー:', error);
            this.showToast('システムの基本確認に失敗しました', 'warning');
        }
        
        // 非同期対応の初期化オプションを表示
        this.showSystemInitializationOptions();
    }
});

console.log('✅ UI非同期対応機能が追加されました');