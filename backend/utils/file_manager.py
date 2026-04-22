import logging
import shutil
from pathlib import Path
from typing import Optional
import time

from config import settings

logger = logging.getLogger(__name__)


class FileManager:
    """File management helpers."""
    
    @staticmethod
    def create_temp_file_path(track_id: str, extension: str = "m4a") -> Path:
        """
        Create a temporary file path.
        
        Args:
            track_id: Track ID.
            extension: File extension.
            
        Returns:
            Temporary file path.
        """
        timestamp = int(time.time() * 1000)
        filename = f"{track_id}_{timestamp}.{extension}"
        file_path = settings.TEMP_DIR / filename
        
        # Ensure the temporary directory exists
        settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        
        return file_path
    
    @staticmethod
    def get_safe_filename(title: str, artist: str, extension: str = "m4a") -> str:
        """
        Generate a safe filename.
        
        Args:
            title: Track title.
            artist: Artist name.
            extension: File extension.
            
        Returns:
            Safe filename.
        """
        # Remove unsafe characters
        unsafe_chars = '<>:"/\\|?*'
        safe_title = "".join(c for c in title if c not in unsafe_chars)
        safe_artist = "".join(c for c in artist if c not in unsafe_chars)
        
        # Limit filename length
        max_length = 200
        if len(safe_title) + len(safe_artist) > max_length:
            safe_title = safe_title[:max_length // 2]
            safe_artist = safe_artist[:max_length // 2]
        
        filename = f"{safe_artist} - {safe_title}.{extension}"
        return filename
    
    @staticmethod
    def delete_file(file_path: Path) -> bool:
        """
        Safely delete a file.
        
        Args:
            file_path: File path.
            
        Returns:
            Whether deletion succeeded.
        """
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"删除文件: {file_path}")
                return True
            else:
                logger.warning(f"文件不存在: {file_path}")
                return False
        except Exception as e:
            logger.error(f"删除文件失败 {file_path}: {e}")
            return False
    
    @staticmethod
    def cleanup_temp_directory() -> int:
        """
        Clear the temporary file directory.
        
        Returns:
            Number of deleted files.
        """
        try:
            if not settings.TEMP_DIR.exists():
                logger.warning(f"临时目录不存在: {settings.TEMP_DIR}")
                return 0
            
            file_count = 0
            for file_path in settings.TEMP_DIR.iterdir():
                if file_path.is_file():
                    try:
                        file_path.unlink()
                        file_count += 1
                    except Exception as e:
                        logger.error(f"删除文件失败 {file_path}: {e}")
            
            logger.info(f"清空临时目录，删除了 {file_count} 个文件")
            return file_count
            
        except Exception as e:
            logger.error(f"清空临时目录失败: {e}")
            return 0
    
    @staticmethod
    def cleanup_old_files(directory: Path, max_age_seconds: int = 3600) -> int:
        """
        Clean up old files.
        
        Args:
            directory: Directory path.
            max_age_seconds: Maximum file age in seconds.
            
        Returns:
            Number of deleted files.
        """
        try:
            if not directory.exists():
                return 0
            
            current_time = time.time()
            file_count = 0
            
            for file_path in directory.iterdir():
                if file_path.is_file():
                    try:
                        file_age = current_time - file_path.stat().st_mtime
                        if file_age > max_age_seconds:
                            file_path.unlink()
                            file_count += 1
                            logger.debug(f"删除旧文件: {file_path}")
                    except Exception as e:
                        logger.error(f"删除文件失败 {file_path}: {e}")
            
            if file_count > 0:
                logger.info(f"清理了 {file_count} 个旧文件")
            
            return file_count
            
        except Exception as e:
            logger.error(f"清理旧文件失败: {e}")
            return 0
    
    @staticmethod
    def get_file_size(file_path: Path) -> Optional[int]:
        """
        Get file size.
        
        Args:
            file_path: File path.
            
        Returns:
            File size in bytes, or None if the file does not exist.
        """
        try:
            if file_path.exists():
                return file_path.stat().st_size
            else:
                return None
        except Exception as e:
            logger.error(f"获取文件大小失败 {file_path}: {e}")
            return None


# Create the global instance
file_manager = FileManager()

