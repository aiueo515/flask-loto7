"""
Celery設定 - 非同期タスク処理
"""

import os
from celery import Celery

# dotenvの安全なimport
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenvが利用できない場合はスキップ
    pass

# Celeryアプリの作成
def make_celery(app_name=__name__):
    # Redis URLの取得（Render.com環境変数対応）
    redis_url = (
        os.environ.get('CELERY_BROKER_URL') or 
        os.environ.get('REDIS_URL') or 
        os.environ.get('REDISCLOUD_URL') or
        'redis://localhost:6379/0'
    )
    
    # デバッグ用ログ
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Redis URL: {redis_url[:50]}...")  # 最初の50文字のみ表示（セキュリティ）
    
    celery = Celery(
        app_name,
        broker=redis_url,
        backend=redis_url,
        include=['tasks']  # タスクモジュールを指定
    )
    
    # Celery設定
    celery.conf.update(
        # タスク設定
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='Asia/Tokyo',
        enable_utc=True,
        
        # ワーカー設定
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        worker_disable_rate_limits=True,
        
        # 結果保存設定
        result_expires=3600,  # 1時間で結果を削除
        
        # タスクルート設定
        task_routes={
            'tasks.train_model_task': {'queue': 'training'},
            'tasks.predict_task': {'queue': 'prediction'},
            'tasks.validation_task': {'queue': 'validation'},
            'tasks.progressive_learning_stage_task': {'queue': 'learning'},
        },
        
        # メモリ最適化
        worker_max_tasks_per_child=50,  # ワーカーを定期的に再起動
        worker_max_memory_per_child=400000,  # 400MBでワーカー再起動
        
        # タイムアウト設定
        task_soft_time_limit=300,  # 5分のソフトタイムアウト
        task_time_limit=600,       # 10分のハードタイムアウト
        
        # エラーハンドリング
        task_reject_on_worker_lost=True,
        task_ignore_result=False,
        
        # Render.com対応
        broker_connection_retry_on_startup=True,
        broker_connection_retry=True,
    )
    
    return celery

# Celeryインスタンス作成
celery_app = make_celery()