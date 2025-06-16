"""
Flask-based Loto7 Prediction API
Render.com対応版
"""

from flask import Flask, request, jsonify, send_file, send_from_directory, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
import traceback
from datetime import datetime
import logging

# 自作モジュール
from models.prediction_system import AutoFetchEnsembleLoto7
from utils.file_manager import FileManager

# Flask設定
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = './uploads'

# CORS設定（PWA対応）
CORS(app, origins=['*'])  # 本番環境では適切なオリジンを設定

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ディレクトリ作成
os.makedirs('./uploads', exist_ok=True)
os.makedirs('./models', exist_ok=True)
os.makedirs('./data', exist_ok=True)
os.makedirs('./static', exist_ok=True)
os.makedirs('./templates', exist_ok=True)

# グローバル変数
prediction_system = None
file_manager = None

def init_system():
    """システム初期化（デバッグ版）"""
    global prediction_system, file_manager
    try:
        logger.info("=== システム初期化開始 ===")
        
        # ファイル管理器の初期化
        logger.info("ファイル管理器を初期化中...")
        file_manager = FileManager()
        logger.info("ファイル管理器の初期化完了")
        
        # 予測システムの初期化
        logger.info("予測システムを初期化中...")
        prediction_system = AutoFetchEnsembleLoto7()
        logger.info("予測システムの初期化完了")
        
        # ファイル管理器を設定
        logger.info("ファイル管理器を予測システムに設定中...")
        prediction_system.set_file_manager(file_manager)
        logger.info("ファイル管理器の設定完了")
        
        # 保存済みモデルがあれば読み込み
        if file_manager.model_exists():
            logger.info("保存済みモデルを読み込み中...")
            try:
                success = prediction_system.load_models()
                if success:
                    logger.info("保存済みモデルの読み込み成功")
                else:
                    logger.warning("保存済みモデルの読み込み失敗")
            except Exception as e:
                logger.error(f"モデル読み込みエラー: {str(e)}")
                logger.error(traceback.format_exc())
        else:
            logger.info("保存済みモデルが存在しません")
        
        # 予測履歴があれば読み込み
        if file_manager.history_exists():
            logger.info("予測履歴を読み込み中...")
            try:
                success = prediction_system.history.load_from_csv()
                if success:
                    logger.info("予測履歴の読み込み成功")
                else:
                    logger.warning("予測履歴の読み込み失敗")
            except Exception as e:
                logger.error(f"履歴読み込みエラー: {str(e)}")
                logger.error(traceback.format_exc())
        else:
            logger.info("予測履歴が存在しません")
        
        logger.info("=== システム初期化完了 ===")
        return True
        
    except Exception as e:
        logger.error(f"システム初期化エラー: {str(e)}")
        logger.error(f"エラー詳細:\n{traceback.format_exc()}")
        return False

def create_success_response(data, message="Success"):
    """統一成功レスポンス"""
    response = {
        "status": "success",
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }
    return jsonify(response)

@app.route('/', methods=['GET'])
def index():
    """PWAメインページ"""
    try:
        # APIアクセスの場合はJSONを返す
        if request.headers.get('Accept') == 'application/json' or 'api' in request.args:
            system_status = {
                "api_version": "1.0.0",
                "system_initialized": prediction_system is not None,
                "files_status": {
                    "model_exists": file_manager.model_exists() if file_manager else False,
                    "history_exists": file_manager.history_exists() if file_manager else False,
                    "data_cached": file_manager.data_cached() if file_manager else False
                }
            }
            
            if prediction_system:
                system_status.update(prediction_system.get_system_status())
            
            return create_success_response(system_status, "Loto7 Prediction API is running")
        
        # 通常のアクセスはPWAページを返す
        return render_template('index.html')
    
    except Exception as e:
        if request.headers.get('Accept') == 'application/json':
            return create_error_response(f"Health check failed: {str(e)}")
        else:
            return f"Error: {str(e)}", 500

# 静的ファイル配信（PWA用）
@app.route('/static/<path:filename>')
def static_files(filename):
    """静的ファイル配信"""
    return send_from_directory('static', filename)

# PWA必須ファイル
@app.route('/manifest.json')
def manifest():
    """PWA Manifest"""
    return send_from_directory('static', 'manifest.json')

@app.route('/sw.js')
def service_worker():
    """Service Worker"""
    response = send_from_directory('static', 'sw.js')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/api/predict', methods=['GET'])
def predict():
    """20セットの予測を返す（永続化対応）"""
    try:
        if not prediction_system:
            return create_error_response("システムが初期化されていません", 500)
        
        # データ取得
        if not prediction_system.data_fetcher.fetch_latest_data():
            return create_error_response("最新データの取得に失敗しました", 500)
        
        # 次回開催回情報取得
        next_info = prediction_system.data_fetcher.get_next_round_info()
        if not next_info:
            return create_error_response("次回開催回情報の取得に失敗しました", 500)
        
        # 既存予測のチェック
        existing_prediction = prediction_system.history.find_prediction_by_round(next_info['next_round'])
        
        if existing_prediction:
            # 既存予測を返す
            response_data = {
                "round": next_info['next_round'],
                "predictions": existing_prediction['predictions'],
                "is_existing": True,
                "created_at": existing_prediction['date'],
                "prediction_count": len(existing_prediction['predictions']),
                "verified": existing_prediction.get('verified', False)
            }
            
            # 検証済みの場合は結果も含める
            if existing_prediction.get('verified'):
                response_data["actual_result"] = existing_prediction.get('actual')
                response_data["matches"] = existing_prediction.get('matches')
            
            return create_success_response(response_data, "既存の予測を返しました")
        
        else:
            # 新規予測生成
            # モデルが学習されていない場合は学習実行
            if not prediction_system.trained_models:
                training_success = prediction_system.auto_setup_and_train()
                if not training_success:
                    return create_error_response("モデル学習に失敗しました", 500)
            
            # 予測生成
            predictions, next_info = prediction_system.predict_next_round(20, use_learning=True)
            
            if not predictions:
                return create_error_response("予測生成に失敗しました", 500)
            
            # 前回結果の分析（可能な場合）
            previous_results = None
            if next_info['latest_round'] > 1:
                previous_prediction = prediction_system.history.find_prediction_by_round(next_info['latest_round'])
                if previous_prediction and previous_prediction.get('verified'):
                    previous_results = {
                        "round": next_info['latest_round'],
                        "predictions": previous_prediction['predictions'],
                        "actual": previous_prediction['actual'],
                        "matches": previous_prediction['matches'],
                        "avg_matches": sum(previous_prediction['matches']) / len(previous_prediction['matches']) if previous_prediction['matches'] else 0,
                        "max_matches": max(previous_prediction['matches']) if previous_prediction['matches'] else 0
                    }
            
            response_data = {
                "round": next_info['next_round'],
                "predictions": predictions,
                "is_existing": False,
                "created_at": next_info['current_date'],
                "prediction_count": len(predictions),
                "model_info": {
                    "trained_models": len(prediction_system.trained_models),
                    "data_count": prediction_system.data_count,
                    "model_scores": prediction_system.model_scores
                },
                "previous_results": previous_results
            }
            
            return create_success_response(response_data, "新規予測を生成しました")
    
    except Exception as e:
        logger.error(f"予測エラー: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(f"予測処理中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/train', methods=['POST'])
def train():
    """モデル再学習（時系列検証・自動照合学習含む）"""
    try:
        if not prediction_system:
            return create_error_response("システムが初期化されていません", 500)
        
        # リクエストパラメータ
        request_data = request.get_json() or {}
        force_full_train = request_data.get('force_full_train', False)
        run_timeseries_validation = request_data.get('run_timeseries_validation', True)
        run_auto_verification = request_data.get('run_auto_verification', True)
        
        training_results = {
            "training": None,
            "timeseries_validation": None,
            "auto_verification": None
        }
        
        # 1. データ取得
        if not prediction_system.data_fetcher.fetch_latest_data():
            return create_error_response("最新データの取得に失敗しました", 500)
        
        # 2. 自動セットアップ・学習
        training_success = prediction_system.auto_setup_and_train(force_full_train=force_full_train)
        if not training_success:
            return create_error_response("モデル学習に失敗しました", 500)
        
        training_results["training"] = {
            "success": True,
            "model_count": len(prediction_system.trained_models),
            "data_count": prediction_system.data_count,
            "model_scores": prediction_system.model_scores
        }
        
        # 3. 時系列交差検証（オプション）
        if run_timeseries_validation:
            try:
                validation_result = prediction_system.run_timeseries_validation()
                training_results["timeseries_validation"] = {
                    "success": validation_result is not None,
                    "result": validation_result
                }
            except Exception as e:
                logger.error(f"時系列検証エラー: {e}")
                training_results["timeseries_validation"] = {
                    "success": False,
                    "error": str(e)
                }
        
        # 4. 自動照合・学習改善（オプション）
        if run_auto_verification:
            try:
                verification_result = prediction_system.run_auto_verification_learning()
                training_results["auto_verification"] = {
                    "success": verification_result is not None,
                    "verified_count": verification_result.get('verified_count', 0) if verification_result else 0,
                    "improvements": verification_result.get('improvements', {}) if verification_result else {}
                }
            except Exception as e:
                logger.error(f"自動照合学習エラー: {e}")
                training_results["auto_verification"] = {
                    "success": False,
                    "error": str(e)
                }
        
        # 5. モデル・履歴保存
        file_manager.save_model(prediction_system)
        file_manager.save_history(prediction_system.history)
        
        return create_success_response(training_results, "学習処理が完了しました")
    
    except Exception as e:
        logger.error(f"学習エラー: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(f"学習処理中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    """ファイルダウンロード"""
    try:
        allowed_files = ['model.pkl', 'prediction_history.csv', 'loto7_data.csv']
        
        if filename not in allowed_files:
            return create_error_response(f"ダウンロード許可されていないファイル: {filename}", 400)
        
        file_path = file_manager.get_file_path(filename)
        
        if not os.path.exists(file_path):
            return create_error_response(f"ファイルが見つかりません: {filename}", 404)
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    
    except Exception as e:
        logger.error(f"ダウンロードエラー: {e}")
        return create_error_response(f"ダウンロード中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/upload/<filename>', methods=['POST'])
def upload_file(filename):
    """ファイルアップロード"""
    try:
        allowed_files = ['model.pkl', 'prediction_history.csv', 'loto7_data.csv']
        
        if filename not in allowed_files:
            return create_error_response(f"アップロード許可されていないファイル: {filename}", 400)
        
        if 'file' not in request.files:
            return create_error_response("ファイルが指定されていません", 400)
        
        file = request.files['file']
        
        if file.filename == '':
            return create_error_response("ファイル名が空です", 400)
        
        # ファイル保存
        file_path = file_manager.get_file_path(filename)
        file.save(file_path)
        
        # モデルファイルの場合は読み込み
        if filename == 'model.pkl' and prediction_system:
            try:
                prediction_system.load_models()
                logger.info("アップロードされたモデルを読み込みました")
            except Exception as e:
                logger.error(f"モデル読み込みエラー: {e}")
        
        # 履歴ファイルの場合は読み込み
        if filename == 'prediction_history.csv' and prediction_system:
            try:
                prediction_system.history.load_from_csv()
                logger.info("アップロードされた履歴を読み込みました")
            except Exception as e:
                logger.error(f"履歴読み込みエラー: {e}")
        
        return create_success_response({
            "filename": filename,
            "size": os.path.getsize(file_path)
        }, f"{filename}をアップロードしました")
    
    except Exception as e:
        logger.error(f"アップロードエラー: {e}")
        return create_error_response(f"アップロード中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/status', methods=['GET'])
def get_status():
    """システム状態取得"""
    try:
        if prediction_system:
            status = prediction_system.get_system_status()
        else:
            status = {
                "system_initialized": False,
                "files": {
                    "model_exists": file_manager.model_exists() if file_manager else False,
                    "history_exists": file_manager.history_exists() if file_manager else False,
                    "data_cached": file_manager.data_cached() if file_manager else False
                }
            }
        
        return create_success_response(status)
    
    except Exception as e:
        logger.error(f"ステータス取得エラー: {e}")
        return create_error_response(f"ステータス取得中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/recent_results', methods=['GET'])
def get_recent_results():
    """最近の抽選結果を取得"""
    try:
        if not prediction_system:
            return create_error_response("システムが初期化されていません", 500)
        
        # データが読み込まれていない場合は取得
        if prediction_system.data_fetcher.latest_data is None:
            if not prediction_system.data_fetcher.fetch_latest_data():
                return create_error_response("データの取得に失敗しました", 500)
        
        count = int(request.args.get('count', 5))
        count = min(max(count, 1), 20)  # 1-20の範囲に制限
        
        recent_results = prediction_system.data_fetcher.get_recent_results(count)
        
        response_data = {
            'results': recent_results,
            'count': len(recent_results),
            'latest_round': prediction_system.data_fetcher.latest_round
        }
        
        return create_success_response(response_data, f"最近{len(recent_results)}回の結果を取得しました")
    
    except Exception as e:
        logger.error(f"最近の結果取得エラー: {e}")
        return create_error_response(f"最近の結果取得中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/prediction_history', methods=['GET'])
def get_prediction_history():
    """予測履歴を取得"""
    try:
        if not prediction_system:
            return create_error_response("システムが初期化されていません", 500)
        
        count = int(request.args.get('count', 5))
        count = min(max(count, 1), 20)  # 1-20の範囲に制限
        
        recent_predictions = prediction_system.history.get_recent_predictions(count)
        accuracy_report = prediction_system.history.get_accuracy_report()
        
        response_data = {
            'recent_predictions': recent_predictions,
            'accuracy_report': accuracy_report,
            'total_predictions': len(prediction_system.history.predictions)
        }
        
        return create_success_response(response_data, f"予測履歴を取得しました")
    
    except Exception as e:
        logger.error(f"予測履歴取得エラー: {e}")
        return create_error_response(f"予測履歴取得中にエラーが発生しました: {str(e)}", 500)

@app.route('/api/prediction_analysis/<int:round_number>', methods=['GET'])
def get_prediction_analysis(round_number):
    """指定開催回の予測詳細分析を取得"""
    try:
        if not prediction_system:
            return create_error_response("システムが初期化されていません", 500)
        
        analysis = prediction_system.history.get_detailed_analysis(round_number)
        
        if not analysis:
            return create_error_response(f"第{round_number}回の予測が見つかりません", 404)
        
        return create_success_response(analysis, f"第{round_number}回の詳細分析を取得しました")
    
    except Exception as e:
        logger.error(f"予測分析取得エラー: {e}")
        return create_error_response(f"予測分析取得中にエラーが発生しました: {str(e)}", 500)

@app.errorhandler(404)
def not_found(error):
    return create_error_response("エンドポイントが見つかりません", 404)

@app.errorhandler(500)
def internal_error(error):
    return create_error_response("内部サーバーエラー", 500)

if __name__ == '__main__':
    logger.info("Loto7 Prediction API starting...")
    
    # システム初期化
    if init_system():
        logger.info("システム初期化成功")
    else:
        logger.warning("システム初期化に問題がありました")
    
    # Flask開発サーバー起動（本番環境ではgunicornなどを使用）
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
