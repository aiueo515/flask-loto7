"""
高度統合予測システム - Flask対応版
自動取得、学習、予測を統合
"""

import numpy as np
import pandas as pd
import logging
from collections import Counter
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score

from .data_fetcher import AutoDataFetcher
from .prediction_history import RoundAwarePredictionHistory
from .learning import AutoVerificationLearner
from .validation import TimeSeriesCrossValidator

logger = logging.getLogger(__name__)

class AutoFetchEnsembleLoto7:
    """高度統合予測システム（自動取得対応版）"""
    
    def __init__(self):
        logger.info("AutoFetchEnsembleLoto7初期化")
        
        # データ取得器
        self.data_fetcher = AutoDataFetcher()
        
        # 複数モデル
        self.models = {
            'random_forest': RandomForestClassifier(
                n_estimators=100, max_depth=12, random_state=42, n_jobs=-1
            ),
            'gradient_boost': GradientBoostingClassifier(
                n_estimators=80, max_depth=8, random_state=42
            ),
            'neural_network': MLPClassifier(
                hidden_layer_sizes=(128, 64, 32), max_iter=300, random_state=42
            )
        }
        
        self.scalers = {}
        self.model_weights = {
            'random_forest': 0.4,
            'gradient_boost': 0.35,
            'neural_network': 0.25
        }
        
        # データ分析
        self.freq_counter = Counter()
        self.pair_freq = Counter()
        self.pattern_stats = {}
        
        # 学習状態
        self.trained_models = {}
        self.model_scores = {}
        self.data_count = 0
        
        # 開催回対応予測履歴
        self.history = RoundAwarePredictionHistory()
        
        # 時系列検証器（第2段階）
        self.validator = None
        
        # 自動照合学習器（第3段階）
        self.auto_learner = AutoVerificationLearner()
        
        # ファイル管理器（外部から設定）
        self.file_manager = None
        
        logger.info("初期化完了 - 自動データ取得システム")
        
    def set_file_manager(self, file_manager):
        """ファイル管理器を設定"""
        self.file_manager = file_manager
        
        # 各コンポーネントにも設定
        self.data_fetcher.set_cache_manager(file_manager)
        self.history.set_file_manager(file_manager)
        
    def load_models(self):
        """保存済みモデルと統計情報を読み込み"""
        if not self.file_manager:
            logger.warning("ファイル管理器が設定されていません")
            return False
            
        return self.file_manager.load_model(self)
    
    def save_models(self):
        """学習済みモデルと統計情報を保存"""
        if not self.file_manager:
            logger.warning("ファイル管理器が設定されていません")
            return False
            
        return self.file_manager.save_model(self)
    
    def auto_setup_and_train(self, force_full_train=False):
        """自動セットアップ・学習"""
        try:
            logger.info("=== 自動セットアップ・学習開始 ===")
            
            # 1. 最新データ取得
            if not self.data_fetcher.fetch_latest_data():
                logger.error("データ取得失敗")
                return False
            
            training_data = self.data_fetcher.get_data_for_training()
            
            # 2. 保存済みモデルの確認
            if not force_full_train and self.file_manager and self.file_manager.model_exists():
                if self.load_models():
                    logger.info("保存済みモデルを使用")
                    
                    # 差分学習が必要かチェック
                    if self.data_count < len(training_data):
                        logger.info(f"差分学習を実行: {len(training_data) - self.data_count}件の新規データ")
                        # 新規学習を実行
                        success = self.train_ensemble_models(training_data)
                        if success and self.file_manager:
                            self.save_models()
                        return success
                    else:
                        logger.info("モデルは最新です")
                        return True
            
            logger.info("新規学習を実行")
            
            # 3. 過去の予測と自動照合
            verified_count = self.history.auto_verify_with_data(
                training_data, 
                self.data_fetcher.round_column,
                self.data_fetcher.main_columns
            )
            
            if verified_count > 0:
                logger.info(f"{verified_count}件の過去予測を自動照合・学習に反映")
            
            # 4. 学習実行
            success = self.train_ensemble_models(training_data)
            if not success:
                logger.error("学習失敗")
                return False
            
            # 5. モデル保存
            if self.file_manager:
                self.save_models()
            
            logger.info("自動セットアップ・学習完了")
            return True
            
        except Exception as e:
            logger.error(f"自動セットアップエラー: {e}")
            return False
    
    def train_ensemble_models(self, data):
        """アンサンブルモデル学習（データフレーム対応）"""
        try:
            logger.info("=== アンサンブル学習開始 ===")
            
            # 実際のカラム名を使用
            main_cols = self.data_fetcher.main_columns
            
            # 高度特徴量作成
            X, y = self.create_advanced_features(data, main_cols)
            if X is None or len(X) < 100:
                logger.error(f"特徴量不足: {len(X) if X is not None else 0}件")
                return False
            
            self.data_count = len(data)
            
            # 各モデルの学習
            logger.info("アンサンブルモデル学習中...")
            
            for name, model in self.models.items():
                try:
                    logger.info(f"  {name} 学習中...")
                    
                    # スケーリング
                    scaler = StandardScaler()
                    X_scaled = scaler.fit_transform(X)
                    self.scalers[name] = scaler
                    
                    # 学習
                    model.fit(X_scaled, y)
                    
                    # クロスバリデーション評価
                    cv_score = np.mean(cross_val_score(model, X_scaled, y, cv=3))
                    
                    self.trained_models[name] = model
                    self.model_scores[name] = cv_score
                    
                    logger.info(f"    ✅ {name}: CV精度 {cv_score*100:.2f}%")
                    
                except Exception as e:
                    logger.error(f"    ❌ {name}: エラー {e}")
                    continue
            
            logger.info(f"アンサンブル学習完了: {len(self.trained_models)}モデル")
            return True
            
        except Exception as e:
            logger.error(f"アンサンブル学習エラー: {str(e)}")
            return False
    
    def create_advanced_features(self, data, main_cols):
        """高度な特徴量エンジニアリング"""
        try:
            logger.info("高度特徴量エンジニアリング開始")
            
            features = []
            targets = []
            
            for i in range(len(data)):
                try:
                    current = []
                    for col in main_cols:
                        if col in data.columns:
                            current.append(int(data.iloc[i][col]))
                    
                    if len(current) != 7:
                        continue
                    
                    if not all(1 <= x <= 37 for x in current):
                        continue
                    if len(set(current)) != 7:
                        continue
                    
                    # 基本統計
                    for num in current:
                        self.freq_counter[num] += 1
                    
                    # ペア分析
                    for j in range(len(current)):
                        for k in range(j+1, len(current)):
                            pair = tuple(sorted([current[j], current[k]]))
                            self.pair_freq[pair] += 1
                    
                    # 特徴量（16次元に簡略化）
                    sorted_nums = sorted(current)
                    gaps = [sorted_nums[j+1] - sorted_nums[j] for j in range(6)]
                    
                    feat = [
                        float(np.mean(current)),           # 平均
                        float(np.std(current)),            # 標準偏差
                        float(np.sum(current)),            # 合計
                        float(sum(1 for x in current if x % 2 == 1)),  # 奇数数
                        float(max(current)),               # 最大値
                        float(min(current)),               # 最小値
                        float(np.median(current)),         # 中央値
                        float(max(current) - min(current)), # 範囲
                        float(len([j for j in range(len(sorted_nums)-1) 
                                 if sorted_nums[j+1] - sorted_nums[j] == 1])), # 連続数
                        float(current[0]),                 # 第1数字
                        float(current[3]),                 # 第4数字
                        float(current[6]),                 # 第7数字
                        float(np.mean(gaps)),              # 平均ギャップ
                        float(max(gaps)),                  # 最大ギャップ
                        float(min(gaps)),                  # 最小ギャップ
                        float(len([x for x in current if x <= 12])), # 小数字数
                    ]
                    
                    # 次回予測ターゲット
                    if i < len(data) - 1:
                        next_nums = []
                        for col in main_cols:
                            if col in data.columns:
                                next_nums.append(int(data.iloc[i+1][col]))
                        
                        if len(next_nums) == 7:
                            for target_num in next_nums:
                                features.append(feat.copy())
                                targets.append(target_num)
                        
                except Exception as e:
                    continue
                
                if (i + 1) % 100 == 0:
                    logger.info(f"  特徴量進捗: {i+1}/{len(data)}件")
            
            # パターン統計
            if len(features) > 0:
                sum_patterns = []
                for i in range(len(data)):
                    try:
                        current = []
                        for col in main_cols:
                            if col in data.columns:
                                current.append(int(data.iloc[i][col]))
                        if len(current) == 7 and all(1 <= x <= 37 for x in current) and len(set(current)) == 7:
                            sum_patterns.append(sum(current))
                    except:
                        continue
                
                if sum_patterns:
                    self.pattern_stats = {
                        'avg_sum': float(np.mean(sum_patterns)),
                        'std_sum': float(np.std(sum_patterns)),
                        'most_frequent_pairs': self.pair_freq.most_common(10)
                    }
            
            logger.info(f"高度特徴量完成: {len(features)}個（16次元）")
            return np.array(features), np.array(targets)
            
        except Exception as e:
            logger.error(f"特徴量エンジニアリングエラー: {e}")
            return None, None
    
    def predict_next_round(self, count=20, use_learning=True):
        """次回開催回の予測（学習改善オプション付き）"""
        try:
            # 次回情報取得
            next_info = self.data_fetcher.get_next_round_info()
            if not next_info:
                logger.error("次回開催回情報取得失敗")
                return [], {}
            
            logger.info(f"=== {next_info['prediction_target']}の予測開始 ===")
            logger.info(f"予測日時: {next_info['current_date']}")
            logger.info(f"最新データ: 第{next_info['latest_round']}回まで")
            
            # 学習改善の適用確認
            if use_learning and hasattr(self, 'auto_learner') and self.auto_learner.improvement_metrics:
                logger.info("学習改善を適用した予測を実行")
                predictions = self.ensemble_predict_with_learning(count)
            else:
                # 通常のアンサンブル予測
                predictions = self.ensemble_predict(count)
            
            if predictions:
                # 予測を開催回付きで記録
                self.history.add_prediction_with_round(
                    predictions, 
                    next_info['next_round'], 
                    next_info['current_date']
                )
                
                logger.info(f"第{next_info['next_round']}回の予測として記録")
            
            return predictions, next_info
            
        except Exception as e:
            logger.error(f"次回予測エラー: {e}")
            return [], {}
    
    def ensemble_predict(self, count=20):
        """アンサンブル予測実行"""
        try:
            if not self.trained_models:
                logger.error("学習済みモデルなし")
                return []
            
            # 基準特徴量
            if not hasattr(self, 'pattern_stats') or not self.pattern_stats:
                base_features = [19.0, 10.0, 133.0, 3.5, 35.0, 5.0, 19.0, 30.0, 1.0, 10.0, 20.0, 30.0, 4.5, 8.0, 2.0, 3.0]
            else:
                base_features = [
                    self.pattern_stats.get('avg_sum', 133) / 7,
                    10.0, self.pattern_stats.get('avg_sum', 133), 3.5, 35.0, 5.0, 19.0, 30.0, 1.0,
                    10.0, 20.0, 30.0, 4.5, 8.0, 2.0, 3.0
                ]
            
            predictions = []
            
            for i in range(count):
                # 各モデルの予測を収集
                ensemble_votes = Counter()
                
                for name, model in self.trained_models.items():
                    try:
                        scaler = self.scalers[name]
                        X_scaled = scaler.transform([base_features])
                        
                        # 複数回予測
                        for _ in range(8):
                            if hasattr(model, 'predict_proba'):
                                proba = model.predict_proba(X_scaled)[0]
                                classes = model.classes_
                                if len(classes) > 0:
                                    selected = np.random.choice(classes, p=proba/proba.sum())
                                    if 1 <= selected <= 37:
                                        weight = self.model_weights.get(name, 0.33)
                                        ensemble_votes[int(selected)] += weight
                            else:
                                pred = model.predict(X_scaled)[0]
                                if 1 <= pred <= 37:
                                    weight = self.model_weights.get(name, 0.33)
                                    ensemble_votes[int(pred)] += weight
                                    
                    except Exception as e:
                        continue
                
                # 頻出数字と組み合わせ
                frequent_nums = [num for num, _ in self.freq_counter.most_common(15)]
                for num in frequent_nums[:8]:
                    ensemble_votes[num] += 0.1
                
                # 上位7個を選択
                top_numbers = [num for num, _ in ensemble_votes.most_common(7)]
                
                # 不足分をランダム補完
                while len(top_numbers) < 7:
                    candidate = np.random.randint(1, 38)
                    if candidate not in top_numbers:
                        top_numbers.append(candidate)
                
                final_pred = sorted([int(x) for x in top_numbers[:7]])
                predictions.append(final_pred)
            
            return predictions
            
        except Exception as e:
            logger.error(f"アンサンブル予測エラー: {str(e)}")
            return []
    
    def ensemble_predict_with_learning(self, count=20):
        """学習改善を適用したアンサンブル予測"""
        try:
            if not self.trained_models:
                logger.error("学習済みモデルなし")
                return []
            
            # 学習調整パラメータを取得
            adjustments = self.auto_learner.get_learning_adjustments()
            boost_numbers = adjustments.get('boost_numbers', [])
            pattern_targets = adjustments.get('pattern_targets', {})
            
            # 基準特徴量（学習改善を反映）
            if pattern_targets:
                target_sum = pattern_targets.get('avg_sum', 133)
                base_features = [
                    target_sum / 7,  # 調整された平均
                    10.0, target_sum, pattern_targets.get('avg_odd_count', 3.5),
                    35.0, 5.0, 19.0, 30.0, 1.0,
                    10.0, 20.0, 30.0, 4.5, 8.0, 2.0, 3.0
                ]
            else:
                base_features = [19.0, 10.0, 133.0, 3.5, 35.0, 5.0, 19.0, 30.0, 1.0, 10.0, 20.0, 30.0, 4.5, 8.0, 2.0, 3.0]
            
            predictions = []
            
            for i in range(count):
                # 各モデルの予測を収集
                ensemble_votes = Counter()
                
                for name, model in self.trained_models.items():
                    try:
                        scaler = self.scalers[name]
                        X_scaled = scaler.transform([base_features])
                        
                        # 複数回予測
                        for _ in range(8):
                            if hasattr(model, 'predict_proba'):
                                proba = model.predict_proba(X_scaled)[0]
                                classes = model.classes_
                                if len(classes) > 0:
                                    selected = np.random.choice(classes, p=proba/proba.sum())
                                    if 1 <= selected <= 37:
                                        weight = self.model_weights.get(name, 0.33)
                                        ensemble_votes[int(selected)] += weight
                            else:
                                pred = model.predict(X_scaled)[0]
                                if 1 <= pred <= 37:
                                    weight = self.model_weights.get(name, 0.33)
                                    ensemble_votes[int(pred)] += weight
                                    
                    except Exception as e:
                        continue
                
                # 頻出数字と組み合わせ
                frequent_nums = [num for num, _ in self.freq_counter.most_common(15)]
                for num in frequent_nums[:8]:
                    ensemble_votes[num] += 0.1
                
                # 学習改善：頻繁に見逃す数字をブースト
                for num in boost_numbers:
                    if 1 <= num <= 37:
                        ensemble_votes[num] += 0.2
                        if i == 0:  # 最初の予測時のみログ
                            logger.info(f"  {num}番をブースト（頻出見逃し）")
                
                # 上位7個を選択
                top_numbers = [num for num, _ in ensemble_votes.most_common(7)]
                
                # 不足分をランダム補完
                while len(top_numbers) < 7:
                    candidate = np.random.randint(1, 38)
                    if candidate not in top_numbers:
                        top_numbers.append(candidate)
                
                final_pred = sorted([int(x) for x in top_numbers[:7]])
                predictions.append(final_pred)
            
            return predictions
            
        except Exception as e:
            logger.error(f"学習改善予測エラー: {str(e)}")
            return []
    
    def run_timeseries_validation(self):
        """時系列交差検証を実行（第2段階）"""
        try:
            logger.info("=== 時系列交差検証実行開始 ===")
            
            if self.data_fetcher.latest_data is None:
                logger.error("データが読み込まれていません")
                return None
            
            # バリデーター初期化
            self.validator = TimeSeriesCrossValidator()
            
            # データ準備
            data = self.data_fetcher.latest_data
            main_cols = self.data_fetcher.main_columns
            
            # 1. 固定窓検証
            fixed_results = self.validator.fixed_window_validation(
                data, main_cols, self.data_fetcher.round_column
            )
            
            # 2. 累積窓検証
            expanding_results = self.validator.expanding_window_validation(
                data, main_cols, self.data_fetcher.round_column
            )
            
            # 3. 結果比較
            comparison = self.validator.compare_validation_methods()
            
            # 4. モデル重みを調整
            if comparison:
                self._adjust_model_weights(comparison)
            
            logger.info("時系列交差検証完了")
            return comparison
            
        except Exception as e:
            logger.error(f"時系列検証エラー: {e}")
            return None
    
    def _adjust_model_weights(self, comparison):
        """検証結果に基づいてモデル重みを調整"""
        logger.info("=== モデル重み調整 ===")
        
        # 基本調整率
        adjustment_rate = 0.1
        
        # 固定窓が優位な場合
        if 'fixed' in comparison.get('recommendation', ''):
            logger.info("固定窓優位のため、短期パターン重視に調整")
            # Random Forestの重みを増加（短期パターンに強い）
            self.model_weights['random_forest'] *= (1 + adjustment_rate)
            self.model_weights['neural_network'] *= (1 - adjustment_rate * 0.5)
        else:
            logger.info("累積窓優位のため、長期トレンド重視に調整")
            # Gradient Boostingの重みを増加（長期トレンドに強い）
            self.model_weights['gradient_boost'] *= (1 + adjustment_rate)
            self.model_weights['random_forest'] *= (1 - adjustment_rate * 0.5)
        
        # 重みの正規化
        total_weight = sum(self.model_weights.values())
        for model in self.model_weights:
            self.model_weights[model] /= total_weight
        
        logger.info("調整後のモデル重み:")
        for model, weight in self.model_weights.items():
            logger.info(f"  {model}: {weight:.3f}")
    
    def run_auto_verification_learning(self):
        """自動照合・学習改善を実行（第3段階）"""
        try:
            logger.info("=== 自動照合・学習改善実行開始 ===")
            
            if self.data_fetcher.latest_data is None:
                logger.info("データ取得が必要です...")
                if not self.data_fetcher.fetch_latest_data():
                    return None
            
            # データ準備
            latest_data = self.data_fetcher.latest_data
            main_cols = self.data_fetcher.main_columns
            
            # 1. 予測履歴との自動照合
            verified_count = self.auto_learner.verify_and_learn(
                self.history,
                latest_data,
                main_cols,
                self.data_fetcher.round_column
            )
            
            if verified_count > 0:
                # 2. 学習改善を反映してモデル再学習
                logger.info("学習改善を反映してモデル再学習...")
                success = self.train_ensemble_models(latest_data)
                
                if success:
                    logger.info("改善学習完了")
                    
                    # 3. 改善されたモデルを保存
                    if self.file_manager:
                        self.save_models()
            else:
                logger.info("新しい照合可能な予測がありません")
            
            logger.info("自動照合・学習改善完了")
            return {
                'verified_count': verified_count,
                'improvements': self.auto_learner.improvement_metrics
            }
            
        except Exception as e:
            logger.error(f"自動照合学習エラー: {e}")
            return None
    
    def get_system_status(self):
        """システム状態を取得"""
        status = {
            'initialized': True,
            'models_trained': len(self.trained_models),
            'data_count': self.data_count,
            'latest_round': self.data_fetcher.latest_round,
            'model_scores': self.model_scores,
            'model_weights': self.model_weights,
            'has_data': self.data_fetcher.latest_data is not None,
            'prediction_history': self.history.get_prediction_summary(),
            'learning_status': self.auto_learner.get_learning_summary()
        