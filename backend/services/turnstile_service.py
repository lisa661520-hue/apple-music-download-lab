import logging
import uuid
import time
from typing import Optional, Dict
import httpx

from config import settings

logger = logging.getLogger(__name__)


class TurnstileService:
    """Cloudflare Turnstile verification service."""
    
    def __init__(self):
        """Initialize the verification service."""
        self._sessions: Dict[str, float] = {}  # session_id -> expire_time
        
    async def verify_token(self, token: str, remote_ip: Optional[str] = None) -> tuple[bool, Optional[str]]:
        """
        Verify a Turnstile token.
        
        Args:
            token: Cloudflare Turnstile token.
            remote_ip: Optional client IP address.
            
        Returns:
            Whether verification succeeded and the session ID.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    settings.TURNSTILE_VERIFY_URL,
                    json={
                        "secret": settings.TURNSTILE_SECRET_KEY,
                        "response": token,
                        "remoteip": remote_ip
                    },
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    logger.error(f"Turnstile 验证请求失败: HTTP {response.status_code}")
                    return False, None
                
                result = response.json()
                
                if result.get("success"):
                    # Create a session after successful verification
                    session_id = str(uuid.uuid4())
                    expire_time = time.time() + settings.TURNSTILE_SESSION_EXPIRE
                    self._sessions[session_id] = expire_time
                    
                    logger.info(f"Turnstile 验证成功，会话 ID: {session_id}")
                    return True, session_id
                else:
                    error_codes = result.get("error-codes", [])
                    logger.warning(f"Turnstile 验证失败: {error_codes}")
                    return False, None
                    
        except httpx.TimeoutException:
            logger.error("Turnstile 验证超时")
            return False, None
        except Exception as e:
            logger.error(f"Turnstile 验证异常: {e}")
            return False, None
    
    def validate_session(self, session_id: str) -> bool:
        """
        Validate whether a session is active.
        
        Args:
            session_id: Session ID.
            
        Returns:
            Whether the session is active.
        """
        if not session_id or session_id not in self._sessions:
            return False
        
        expire_time = self._sessions[session_id]
        current_time = time.time()
        
        if current_time > expire_time:
            # Session has expired; delete it
            del self._sessions[session_id]
            logger.info(f"会话已过期: {session_id}")
            return False
        
        return True
    
    def cleanup_expired_sessions(self):
        """Clean up expired sessions."""
        current_time = time.time()
        expired_sessions = [
            sid for sid, expire_time in self._sessions.items()
            if current_time > expire_time
        ]
        
        for sid in expired_sessions:
            del self._sessions[sid]
        
        if expired_sessions:
            logger.info(f"清理了 {len(expired_sessions)} 个过期会话")


# Create the global service instance
turnstile_service = TurnstileService()

