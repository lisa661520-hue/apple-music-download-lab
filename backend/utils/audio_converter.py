import logging
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class AudioConverter:
    """Audio format conversion helpers using FFmpeg."""
    
    # Supported output formats and their settings
    SUPPORTED_FORMATS = {
        "mp3": {
            "ext": "mp3",
            "codec": "libmp3lame",
            "bitrate": "320k",
            "quality": "0"  # Highest quality
        },
        "wav": {
            "ext": "wav",
            "codec": "pcm_s16le",
            "sample_rate": "44100"
        },
        "flac": {
            "ext": "flac",
            "codec": "flac",
            "compression": "8"  # Highest compression
        },
        "aac": {
            "ext": "aac",
            "codec": "aac",
            "bitrate": "256k"
        },
        "m4a": {
            "ext": "m4a",
            "codec": "aac",
            "bitrate": "256k"
        },
        "ogg": {
            "ext": "ogg",
            "codec": "libvorbis",
            "quality": "10"  # Highest quality
        },
        "opus": {
            "ext": "opus",
            "codec": "libopus",
            "bitrate": "256k"
        }
    }
    
    @staticmethod
    def convert(
        input_path: Path,
        output_path: Path,
        output_format: str = "mp3"
    ) -> bool:
        """
        Convert an audio file.
        
        Args:
            input_path: Input file path.
            output_path: Output file path.
            output_format: Output format.
            
        Returns:
            Whether conversion succeeded.
        """
        try:
            if output_format not in AudioConverter.SUPPORTED_FORMATS:
                logger.error(f"不支持的格式: {output_format}")
                return False
            
            if not input_path.exists():
                logger.error(f"输入文件不存在: {input_path}")
                return False
            
            # Get format settings
            format_config = AudioConverter.SUPPORTED_FORMATS[output_format]
            
            # Build the FFmpeg command
            cmd = ["ffmpeg", "-i", str(input_path), "-y"]
            
            # Add the audio encoder
            if "codec" in format_config:
                cmd.extend(["-c:a", format_config["codec"]])
            
            # Add the bitrate
            if "bitrate" in format_config:
                cmd.extend(["-b:a", format_config["bitrate"]])
            
            # Add the quality parameter
            if "quality" in format_config:
                cmd.extend(["-q:a", format_config["quality"]])
            
            # Add the sample rate
            if "sample_rate" in format_config:
                cmd.extend(["-ar", format_config["sample_rate"]])
            
            # Add the compression level
            if "compression" in format_config:
                cmd.extend(["-compression_level", format_config["compression"]])
            
            # Add the output file
            cmd.append(str(output_path))
            
            logger.info(f"执行 FFmpeg 转换: {' '.join(cmd)}")
            
            # Run conversion
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                logger.info(f"转换成功: {input_path} -> {output_path}")
                return True
            else:
                error_msg = result.stderr.decode('utf-8', errors='ignore')
                logger.error(f"FFmpeg 转换失败: {error_msg}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("FFmpeg 转换超时")
            return False
        except Exception as e:
            logger.error(f"转换异常: {e}")
            return False
    
    @staticmethod
    def is_format_supported(format_name: str) -> bool:
        """
        Check whether a format is supported.
        
        Args:
            format_name: Format name.
            
        Returns:
            Whether the format is supported.
        """
        return format_name.lower() in AudioConverter.SUPPORTED_FORMATS
    
    @staticmethod
    def get_supported_formats() -> list:
        """
        Get the supported format list.
        
        Returns:
            Format list.
        """
        return list(AudioConverter.SUPPORTED_FORMATS.keys())
    
    @staticmethod
    def get_format_extension(format_name: str) -> str:
        """
        Get the file extension for a format.
        
        Args:
            format_name: Format name.
            
        Returns:
            File extension.
        """
        if format_name in AudioConverter.SUPPORTED_FORMATS:
            return AudioConverter.SUPPORTED_FORMATS[format_name]["ext"]
        return format_name


# Create the global instance
audio_converter = AudioConverter()

