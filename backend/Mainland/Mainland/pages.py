from common.schemas.v1.response import ApiResponse, Issue

from django.http import HttpRequest, JsonResponse, HttpResponse
from django.shortcuts import render

from asgiref.sync import sync_to_async

async_render = sync_to_async(render)

async def index(req: HttpRequest, sub=None) -> JsonResponse | HttpResponse:
    """Main page view.

        Args
        ----
            req (HttpRequest)
                HTTP request from client
        
        Returns
        -------
            JsonResponse (if error occured) or rendered html-page 
    """
    if req.method == "GET":
        return await async_render(req, 'frontend/index.html')
    
    response = ApiResponse().add_issue(
        Issue(
            status="error",
            code=405,
            message="Non-operable HTTP method was received.",
            hint="Try to send GET or POST request"
        )
    ).set_status(
        status="error",
        code=405
    )
    return JsonResponse(response.dict_response, status=response.code)
