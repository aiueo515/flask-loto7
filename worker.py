#!/usr/bin/env python3
"""
Celeryワーカー起動スクリプト
Render.com対応版
"""

import os
import sys
import logging
from celery_app import celery_app

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def start_worker():
    """Celeryワーカーを起動"""
    try:
        logger.info("🚀 Celeryワーカーを開始します...")
        
        # 環境変数の確認
        redis_url = os.environ.get('CELERY_BROKER_URL')
        if not redis_url:
            logger.error("❌ CELERY_BROKER_URL環境変数が設定されていません")
            sys.exit(1)
        
        logger.info(f"📡 Redis接続先: {redis_url}")
        
        # ワーカー設定
        worker_options = {
            'loglevel': 'info',
            'concurrency': 1,  # Render.com無料プランは1コア
            'pool': 'solo',    # メモリ効率の良いプール
            'queues': ['training', 'prediction', 'validation', 'celery'],
            'max_tasks_per_child': 10,  # メモリリーク防止
            'max_memory_per_child': 400000,  # 400MB制限
        }
        
        # ワーカー開始
        logger.info("✅ Celeryワーカーが開始されました")
        celery_app.worker_main(['worker'] + [f'--{k}={v}' for k, v in worker_options.items()])
        
    except KeyboardInterrupt:
        logger.info("🛑 ワーカーが停止されました")
    except Exception as e:
        logger.error(f"❌ ワーカー開始エラー: {e}")
        sys.exit(1)

if __name__ == '__main__':
    start_worker()