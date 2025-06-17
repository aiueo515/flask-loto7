"""
Celery設定 - 非同期タスク処理
"""

import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Celeryアプリの作成
def make_celery(app_name=__name__):
    # Redis URLの取得
    redis_url = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    
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
        },
        
        # メモリ最適化
        worker_max_tasks_per_child=50,  # ワーカーを定期的に再起動
        worker_max_memory_per_child=400000,  # 400MBでワーカー再起動
        
        # タイムアウト設定
        task_soft_time_limit=300,  # 5分のソフトタイムアウト
        task_time_limit=600,       # 10分のハードタイムアウト
    )
    
    return celery

# Celeryインスタンス作成
celery_app = make_celery()