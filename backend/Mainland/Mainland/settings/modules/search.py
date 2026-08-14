import os

ELASTICSEARCH_HOST = os.getenv("ES_PROXY_HOST", "es-proxy")
ELASTICSEARCH_PORT = int(os.getenv("ES_PORT", 9200))
ES_APP_USER = "spine_segmentation_user"
ELASTIC_PASSWORD = os.getenv("ELASTIC_PASSWORD")

ELASTICSEARCH_DSL = {
    'default': {
        'hosts': f'http://{ELASTICSEARCH_HOST}:{ELASTICSEARCH_PORT}',
        'basic_auth': (ES_APP_USER, ELASTIC_PASSWORD),
    },
}

ELASTICSEARCH_DSL_SIGNAL_PROCESSOR = 'common.utils.elasticsearch.FilteredCelerySignalProcessor'
