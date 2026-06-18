from common.schemas.v1.response import ApiResponse, Issue

from django.http import HttpRequest, JsonResponse, HttpResponse, HttpResponseRedirect, HttpResponseNotFound
from django.shortcuts import render, redirect
from django.utils import translation
from django.conf import settings

from asgiref.sync import sync_to_async

async_render = sync_to_async(render)

def view_404(request, exception=None) -> HttpResponseRedirect:
    """Redirect from unknown views to the Home.

        Args
        ----
            req (HttpRequest)
                HTTP request from client
        
        Returns
        -------
            HttpResponseRedirect to home page
    """
    supported = settings.API_MANIFEST.get("supported_languages", ["en"])
    user_language = translation.get_language_from_request(request, check_path=True).split('-')[0]
    
    return redirect(f'/{user_language if user_language in supported else "en"}')

async def index(req: HttpRequest, lang=None, sub=None) -> JsonResponse | HttpResponse:
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

        supported = settings.API_MANIFEST.get("supported_languages", ["en"])
        if lang and lang in supported:
            return await async_render(req, 'index.html')

        return HttpResponseNotFound()
    
    return ApiResponse().add_issue(
        Issue(
            status="error",
            code=405,
            message="Non-operable HTTP method was received.",
            hint="Try to send GET or POST request"
        )
    ).set_status(
        status="error",
        code=405
    ).json_response

async def env(req: HttpRequest) -> JsonResponse | HttpResponse:
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
        return await async_render(req, '_app/env.js')
    
    return ApiResponse().add_issue(
        Issue(
            status="error",
            code=405,
            message="Non-operable HTTP method was received.",
            hint="Try to send GET or POST request"
        )
    ).set_status(
        status="error",
        code=405
    ).json_response