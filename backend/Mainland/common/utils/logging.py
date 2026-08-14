import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """One JSON object per line on stdout -- lets Alloy parse `level` (and
    anything else here) as a real field via `stage.json`, instead of
    grepping/regexing plain text.
    """

    def format(self, record):
        # Not self.formatTime(record, "...%f...") -- logging.Formatter's
        # formatTime goes through time.strftime, which (unlike
        # datetime.strftime) doesn't support %f and silently leaves it as a
        # literal "%f" in the output. Building the timestamp directly from
        # record.created via datetime instead, which does support it.
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc)
        payload = {
            "level": record.levelname,
            "time": timestamp.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload)
