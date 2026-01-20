import kopf
import logging

@kopf.on.startup()
def configure(settings: kopf.OperatorSettings, **_):
    settings.posting.level = logging.INFO

@kopf.on.startup()
def startup(logger, **_):
    logger.info("🧠 Brain Operator Online. Watching for chaos...")

# Skeleton for restarting deployment
@kopf.on.create('pods', labels={'app': 'api-service'})
def pod_created(meta, logger, **_):
    logger.info(f"👀 New victim pod detected: {meta.get('name')}")
