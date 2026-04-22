import logging
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from models.schemas import (
    TurnstileVerifyRequest,
    TurnstileVerifyResponse,
    SearchRequest,
    SearchResponse,
    PreparePlayRequest,
    PreparePlayResponse,
    PrepareDownloadRequest,
    PrepareDownloadResponse,
    ErrorResponse,
)
from services.apple_music_service import apple_music_service
from services.turnstile_service import turnstile_service
from services.token_service import token_service
from utils.file_manager import file_manager
from utils.audio_converter import audio_converter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Scheduled task runner
scheduler = AsyncIOScheduler()


def cleanup_task():
    """Run the periodic cleanup task."""
    logger.info("执行定时清理任务...")
    
    # Clean expired tokens
    token_service.cleanup_expired_tokens()
    
    # Clean expired sessions
    turnstile_service.cleanup_expired_sessions()
    
    # Clean temporary files older than 1 hour
    file_manager.cleanup_old_files(settings.TEMP_DIR, max_age_seconds=3600)
    
    logger.info("定时清理任务完成")


def daily_cleanup_task():
    """Run the daily 03:00 cleanup task."""
    logger.info("执行每日清理任务...")
    
    # Clear the temporary directory
    file_manager.cleanup_temp_directory()
    
    logger.info("每日清理任务完成")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the application lifecycle."""
    # Initialize services on startup
    logger.info("启动 Apple Music API 服务...")
    
    try:
        # Initialize the Apple Music service
        apple_music_service.initialize()
        
        # Start the scheduled task runner
        scheduler.start()
        
        # Run cleanup every 5 minutes
        scheduler.add_job(
            cleanup_task,
            trigger="interval",
            minutes=5,
            id="cleanup_task"
        )
        
        # Run daily cleanup at 03:00 Asia/Shanghai time
        scheduler.add_job(
            daily_cleanup_task,
            trigger=CronTrigger(hour=3, minute=0, timezone=settings.CLEANUP_TIMEZONE),
            id="daily_cleanup_task"
        )
        
        logger.info("服务启动成功")
        
    except Exception as e:
        logger.error(f"服务启动失败: {e}")
        raise
    
    yield
    
    # Cleanup on shutdown
    logger.info("关闭服务...")
    scheduler.shutdown()
    logger.info("服务已关闭")


# Create the FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Configure CORS; requests are expected to be proxied through the Worker
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be false when allowing all origins
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error="http_error",
            message=exc.detail
        ).model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(f"未处理的异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="internal_error",
            message="服务器内部错误"
        ).model_dump()
    )


# Dependency helper: validate the session
def verify_session(x_session_id: Optional[str] = Header(None)) -> str:
    """Validate the session ID."""
    if not x_session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少会话 ID，请先完成人机验证"
        )
    
    if not turnstile_service.validate_session(x_session_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="会话已过期或无效，请重新验证"
        )
    
    return x_session_id


# API routes

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "active_tokens": token_service.get_active_token_count()
    }


@app.post(
    f"{settings.API_PREFIX}/verify-turnstile",
    response_model=TurnstileVerifyResponse,
    summary="Verify Turnstile token"
)
async def verify_turnstile(request: TurnstileVerifyRequest, req: Request):
    """
    Verify a Cloudflare Turnstile challenge token.
    """
    # Get the client IP
    client_ip = req.client.host if req.client else None
    
    # Verify the token
    success, session_id = await turnstile_service.verify_token(
        request.token,
        client_ip
    )
    
    if not success:
        return TurnstileVerifyResponse(
            success=False,
            message="人机验证失败，请重试"
        )
    
    return TurnstileVerifyResponse(
        success=True,
        session_id=session_id
    )


@app.get(
    f"{settings.API_PREFIX}/search",
    response_model=SearchResponse,
    summary="Search music"
)
async def search_music(
    q: str,
    types: str = "songs,albums",
    limit: int = 25,
    x_session_id: str = Header(None)
):
    """
    Search Apple Music.
    
    Requires a completed Turnstile challenge and an X-Session-ID header.
    """
    # Validate the session
    verify_session(x_session_id)
    
    try:
        # Run the search
        results = apple_music_service.search_music(
            query=q,
            types=types,
            limit=limit
        )
        
        return SearchResponse(**results)
        
    except Exception as e:
        logger.error(f"搜索失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="搜索失败，请稍后重试"
        )


@app.post(
    f"{settings.API_PREFIX}/prepare-play",
    response_model=PreparePlayResponse,
    summary="Prepare playback"
)
async def prepare_play(
    request: PreparePlayRequest,
    x_session_id: str = Header(None)
):
    """
    Prepare a track for playback and generate a temporary stream URL.
    
    Requires a completed Turnstile challenge and an X-Session-ID header.
    """
    # Validate the session
    verify_session(x_session_id)
    
    try:
        # Fetch track metadata
        track_info = apple_music_service.get_track_info(request.track_id)
        if not track_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="曲目不存在"
            )
        
        # Create a temporary file path
        temp_file = file_manager.create_temp_file_path(request.track_id, "m4a")
        
        # Download the track
        success = apple_music_service.download_track(
            track_id=request.track_id,
            output_path=temp_file,
            codec=request.codec
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="下载曲目失败"
            )
        
        # Create a playback token
        filename = file_manager.get_safe_filename(
            track_info.title,
            track_info.artist,
            "m4a"
        )
        
        token, expires_at = token_service.create_token(
            file_path=temp_file,
            track_id=request.track_id,
            filename=filename,
            expire_seconds=settings.PLAY_TOKEN_EXPIRE
        )
        
        # Build the stream URL
        stream_url = f"https://{settings.BACKEND_DOMAIN}{settings.API_PREFIX}/stream/{token}"
        
        return PreparePlayResponse(
            token=token,
            stream_url=stream_url,
            expires_at=expires_at,
            track_info=track_info
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"准备播放失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="准备播放失败，请稍后重试"
        )


@app.post(
    f"{settings.API_PREFIX}/prepare-download",
    response_model=PrepareDownloadResponse,
    summary="Prepare download"
)
async def prepare_download(
    request: PrepareDownloadRequest,
    x_session_id: str = Header(None)
):
    """
    Prepare a track for download and generate a temporary download URL.
    
    Requires a completed Turnstile challenge and an X-Session-ID header.
    """
    logger.info("="*60)
    logger.info(f"收到下载请求: track_id={request.track_id}, codec={request.codec}, format={request.format}")
    logger.info(f"会话 ID: {x_session_id}")
    logger.info("="*60)
    
    # Validate the session
    verify_session(x_session_id)
    
    try:
        # Fetch track metadata
        logger.info(f"开始获取曲目信息: {request.track_id}")
        track_info = apple_music_service.get_track_info(request.track_id)
        logger.info(f"曲目信息: {track_info.title if track_info else 'None'}")
        if not track_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="曲目不存在"
            )
        
        # Download the original M4A file first
        original_file = file_manager.create_temp_file_path(request.track_id, "m4a")
        
        # Download the track
        success = apple_music_service.download_track(
            track_id=request.track_id,
            output_path=original_file,
            codec=request.codec
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="下载曲目失败"
            )
        
        # Decide whether format conversion is required
        output_format = request.format.lower() if request.format else "m4a"
        
        if output_format != "m4a" and audio_converter.is_format_supported(output_format):
            # Convert the format
            logger.info(f"开始转换格式: m4a -> {output_format}")
            converted_file = file_manager.create_temp_file_path(
                request.track_id, 
                audio_converter.get_format_extension(output_format)
            )
            
            # Run format conversion
            convert_success = audio_converter.convert(
                input_path=original_file,
                output_path=converted_file,
                output_format=output_format
            )
            
            if not convert_success:
                # Delete the original file after conversion failure
                file_manager.delete_file(original_file)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"格式转换失败: {output_format}"
                )
            
            # Delete the original file and use the converted file
            file_manager.delete_file(original_file)
            temp_file = converted_file
            extension = audio_converter.get_format_extension(output_format)
        else:
            # No conversion required; use the original file
            temp_file = original_file
            extension = "m4a"
        
        # Generate the download filename
        filename = file_manager.get_safe_filename(
            track_info.title,
            track_info.artist,
            extension
        )
        
        # Create a download token
        token, expires_at = token_service.create_token(
            file_path=temp_file,
            track_id=request.track_id,
            filename=filename,
            expire_seconds=settings.DOWNLOAD_TOKEN_EXPIRE
        )
        
        # Build the download URL
        download_url = f"https://{settings.BACKEND_DOMAIN}{settings.API_PREFIX}/download/{token}"
        
        # Get the file size
        file_size = file_manager.get_file_size(temp_file)
        
        return PrepareDownloadResponse(
            token=token,
            download_url=download_url,
            expires_at=expires_at,
            filename=filename,
            file_size=file_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"准备下载失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"准备下载失败: {str(e)}"
        )


@app.get(
    f"{settings.API_PREFIX}/stream/{{token}}",
    summary="Stream audio"
)
async def stream_audio(token: str):
    """
    Stream an audio file.
    
    Uses the token returned by the prepare-play endpoint.
    """
    # Validate the token
    token_info = token_service.get_token_info(token)
    if not token_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="播放链接不存在或已过期"
        )
    
    # Check whether the file exists
    if not token_info.file_path.exists():
        logger.error(f"文件不存在: {token_info.file_path}")
        token_service.delete_token(token)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
    
    # Return the file stream
    return FileResponse(
        path=token_info.file_path,
        media_type="audio/mp4",
        filename=token_info.filename,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache"
        }
    )


@app.get(
    f"{settings.API_PREFIX}/download/{{token}}",
    summary="Download file"
)
async def download_file(token: str):
    """
    Download an audio file.
    
    Uses the token returned by the prepare-download endpoint.
    """
    from urllib.parse import quote
    
    # Validate the token
    token_info = token_service.get_token_info(token)
    if not token_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="下载链接不存在或已过期"
        )
    
    # Check whether the file exists
    if not token_info.file_path.exists():
        logger.error(f"文件不存在: {token_info.file_path}")
        token_service.delete_token(token)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文件不存在"
        )
    
    # URL-encode the filename to support non-ASCII names
    encoded_filename = quote(token_info.filename)
    
    # Return the file download
    return FileResponse(
        path=token_info.file_path,
        media_type="audio/mpeg",
        filename=token_info.filename,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Cache-Control": "no-cache"
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

