import logging
import uuid
import time
from pathlib import Path
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta

from config import settings

logger = logging.getLogger(__name__)


class TokenInfo:
    """Token metadata."""
    
    def __init__(self, file_path: Path, expire_time: float, track_id: str, filename: str):
        self.file_path = file_path
        self.expire_time = expire_time
        self.track_id = track_id
        self.filename = filename


class TokenService:
    """Download and playback token management service."""
    
    def __init__(self):
        """Initialize the token service."""
        self._tokens: Dict[str, TokenInfo] = {}  # token -> TokenInfo
        
    def create_token(
        self,
        file_path: Path,
        track_id: str,
        filename: str,
        expire_seconds: int = None
    ) -> Tuple[str, datetime]:
        """
        Create a token.
        
        Args:
            file_path: File path.
            track_id: Track ID.
            filename: Filename.
            expire_seconds: Expiration in seconds; defaults to configured value.
            
        Returns:
            Token string and expiration time.
        """
        if expire_seconds is None:
            expire_seconds = settings.DOWNLOAD_TOKEN_EXPIRE
        
        token = str(uuid.uuid4())
        expire_time = time.time() + expire_seconds
        
        token_info = TokenInfo(
            file_path=file_path,
            expire_time=expire_time,
            track_id=track_id,
            filename=filename
        )
        
        self._tokens[token] = token_info
        
        expires_at = datetime.fromtimestamp(expire_time)
        logger.info(f"创建令牌: {token}，过期时间: {expires_at}")
        
        return token, expires_at
    
    def get_token_info(self, token: str) -> Optional[TokenInfo]:
        """
        Get token metadata.
        
        Args:
            token: Token string.
            
        Returns:
            Token metadata, or None if missing or expired.
        """
        if token not in self._tokens:
            logger.warning(f"令牌不存在: {token}")
            return None
        
        token_info = self._tokens[token]
        current_time = time.time()
        
        if current_time > token_info.expire_time:
            # Token has expired
            logger.info(f"令牌已过期: {token}")
            self._delete_token(token)
            return None
        
        return token_info
    
    def delete_token(self, token: str) -> bool:
        """
        Delete a token.
        
        Args:
            token: Token string.
            
        Returns:
            Whether deletion succeeded.
        """
        return self._delete_token(token)
    
    def _delete_token(self, token: str) -> bool:
        """
        Delete a token internally.
        
        Args:
            token: Token string.
            
        Returns:
            Whether deletion succeeded.
        """
        if token in self._tokens:
            token_info = self._tokens[token]
            
            # Delete the associated file
            try:
                if token_info.file_path.exists():
                    token_info.file_path.unlink()
                    logger.info(f"删除文件: {token_info.file_path}")
            except Exception as e:
                logger.error(f"删除文件失败 {token_info.file_path}: {e}")
            
            # Delete the token record
            del self._tokens[token]
            logger.info(f"删除令牌: {token}")
            return True
        
        return False
    
    def cleanup_expired_tokens(self):
        """Clean up expired tokens."""
        current_time = time.time()
        expired_tokens = [
            token for token, info in self._tokens.items()
            if current_time > info.expire_time
        ]
        
        for token in expired_tokens:
            self._delete_token(token)
        
        if expired_tokens:
            logger.info(f"清理了 {len(expired_tokens)} 个过期令牌")
    
    def get_active_token_count(self) -> int:
        """Get the active token count."""
        return len(self._tokens)


# Create the global service instance
token_service = TokenService()

