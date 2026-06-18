from common.schemas.v1.response import ApiResponse
from common.mixins.v1.ws_consumer import WSConsumer

import json

class SegmConsumer(WSConsumer):

    @property
    def group_name(self):
        return f"Dicom.segment.{self.scope['url_route']['kwargs']['sop_uid']}"

    @WSConsumer.connect_wrapper()
    async def connect(self):
        pass

    @WSConsumer.disconnect_wrapper()
    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        pass

    async def from_task_event(self, event):
        await self.send(
            text_data=json.dumps(
                ApiResponse().update_data(
                    event["data"]
                ).dict_response
            )
        )