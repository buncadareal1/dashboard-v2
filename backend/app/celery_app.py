import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "smartland",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.tasks.sync_campaigns",
        "app.tasks.sync_bitrix24",
        "app.tasks.ai_analysis",
        "app.tasks.sync_facebook_ads",
        "app.tasks.attribution",
    ],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)

celery.conf.beat_schedule = {
    "sync-campaigns-every-15min": {
        "task": "app.tasks.sync_campaigns.sync_all_campaign_data",
        "schedule": crontab(minute="*/15"),
    },
    "sync-bitrix24-backup-every-30min": {
        "task": "app.tasks.sync_bitrix24.sync_bitrix24_leads",
        "schedule": crontab(minute="*/30"),
    },
    "refresh-dashboard-kpis-every-5min": {
        "task": "app.tasks.sync_campaigns.refresh_dashboard_cache",
        "schedule": crontab(minute="*/5"),
    },
    "sync-facebook-ads-every-10min": {
        "task": "app.tasks.sync_facebook_ads.sync_all_facebook_accounts",
        "schedule": crontab(minute="*/10"),
    },
    "run-attribution-every-30min": {
        "task": "app.tasks.attribution.run_attribution_task",
        "schedule": crontab(minute="*/30"),
    },
}
