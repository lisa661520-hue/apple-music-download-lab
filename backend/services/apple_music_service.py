import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from gamdl import AppleMusicApi, ItunesApi, Downloader, DownloaderSong

from config import settings
from models.schemas import TrackInfo, AlbumInfo, ArtistInfo, PlaylistInfo

logger = logging.getLogger(__name__)


class AppleMusicService:
    """Apple Music service wrapper."""
    
    def __init__(self):
        """Initialize Apple Music API references."""
        self.apple_music_api: Optional[AppleMusicApi] = None
        self.itunes_api: Optional[ItunesApi] = None
        self.downloader: Optional[Downloader] = None
        self.downloader_song: Optional[DownloaderSong] = None
        self._initialized = False
        
    def initialize(self):
        """Initialize gamdl services."""
        try:
            if not settings.COOKIES_PATH.exists():
                raise FileNotFoundError(f"Cookies 文件不存在: {settings.COOKIES_PATH}")
            
            # Initialize Apple Music API from the cookie file
            self.apple_music_api = AppleMusicApi.from_netscape_cookies(
                cookies_path=settings.COOKIES_PATH,
                language="zh-CN"
            )
            
            # Initialize the iTunes API
            self.itunes_api = ItunesApi(
                storefront=self.apple_music_api.storefront,
                language=self.apple_music_api.language,
            )
            
            # Initialize the downloader
            self.downloader = Downloader(
                apple_music_api=self.apple_music_api,
                itunes_api=self.itunes_api,
            )
            self.downloader.set_cdm()
            
            # Initialize the song downloader
            self.downloader_song = DownloaderSong(downloader=self.downloader)
            
            self._initialized = True
            logger.info("Apple Music 服务初始化成功")
            
        except Exception as e:
            logger.error(f"Apple Music 服务初始化失败: {e}")
            raise
    
    def search_music(
        self,
        query: str,
        types: str = "songs,albums",
        limit: int = 25,
        offset: int = 0
    ) -> Dict[str, List[Any]]:
        """
        Search music.
        
        Args:
            query: Search keyword.
            types: Search types: songs,albums,artists,playlists.
            limit: Result limit.
            offset: Result offset.
            
        Returns:
            Search result dictionary.
        """
        if not self._initialized:
            raise RuntimeError("Apple Music 服务未初始化")
        
        try:
            results = self.apple_music_api.search(
                term=query,
                types=types,
                limit=limit,
                offset=offset
            )
            
            if not results:
                return {}
            
            # Convert search results to the standard response format
            formatted_results = {}
            
            # Process songs
            if "songs" in results and results["songs"].get("data"):
                formatted_results["songs"] = [
                    self._format_track(track) for track in results["songs"]["data"]
                ]
            
            # Process albums
            if "albums" in results and results["albums"].get("data"):
                formatted_results["albums"] = [
                    self._format_album(album) for album in results["albums"]["data"]
                ]
            
            # Process artists
            if "artists" in results and results["artists"].get("data"):
                formatted_results["artists"] = [
                    self._format_artist(artist) for artist in results["artists"]["data"]
                ]
            
            # Process playlists
            if "playlists" in results and results["playlists"].get("data"):
                formatted_results["playlists"] = [
                    self._format_playlist(playlist) for playlist in results["playlists"]["data"]
                ]
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            raise
    
    def get_track_info(self, track_id: str) -> Optional[TrackInfo]:
        """
        Get track information.
        
        Args:
            track_id: Track ID.
            
        Returns:
            Track information object.
        """
        if not self._initialized:
            raise RuntimeError("Apple Music 服务未初始化")
        
        try:
            track_data = self.apple_music_api.get_song(track_id)
            if not track_data:
                return None
            
            return self._format_track(track_data)
            
        except Exception as e:
            logger.error(f"获取曲目信息失败: {e}")
            raise
    
    def download_track(
        self,
        track_id: str,
        output_path: Path,
        codec: str = "aac-legacy"
    ) -> bool:
        """
        Download a track.
        
        Args:
            track_id: Track ID.
            output_path: Output path.
            codec: Audio codec.
            
        Returns:
            Whether download succeeded.
        """
        if not self._initialized:
            raise RuntimeError("Apple Music 服务未初始化")
        
        try:
            # Ensure the output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download through gamdl
            logger.info(f"开始下载曲目 {track_id}，编码格式: {codec}，输出路径: {output_path}")
            
            # Download directly to the target path through gamdl.
            # gamdl creates directory structures automatically, so temporarily change output_path.
            import shutil
            
            # Save the original downloader settings
            original_output_path = self.downloader.output_path
            original_template_folder = self.downloader.template_folder_album
            original_template_file = self.downloader.template_file_single_disc
            
            try:
                # Point gamdl to the temporary directory
                self.downloader.output_path = output_path.parent
                # Use a simple filename template to avoid nested directory structures
                self.downloader.template_folder_album = ""
                self.downloader.template_file_single_disc = output_path.stem
                
                # Download the track
                download_success = False
                for download_info in self.downloader_song.download(media_id=track_id):
                    # download_info includes progress data
                    logger.debug(f"下载进度: {download_info}")
                    download_success = True
                
                if not download_success:
                    logger.error("下载未成功完成")
                    return False
                
                # Check whether the file exists
                if output_path.exists():
                    logger.info(f"曲目 {track_id} 下载完成: {output_path}")
                    return True
                
                # Search for the file if it is not in the expected location
                logger.warning(f"文件不在预期位置，开始搜索: {output_path.parent}")
                downloaded_files = list(output_path.parent.glob("**/*.m4a"))
                
                if not downloaded_files:
                    logger.error(f"未找到下载的文件，目录: {output_path.parent}")
                    return False
                
                # Pick the newest file by modification time
                downloaded_file = max(downloaded_files, key=lambda p: p.stat().st_mtime)
                logger.info(f"找到下载文件: {downloaded_file}，移动到: {output_path}")
                
                # Move it to the target path
                if downloaded_file != output_path:
                    shutil.move(str(downloaded_file), str(output_path))
                
                logger.info(f"曲目 {track_id} 下载完成")
                return True
                
            finally:
                # Restore the original downloader settings
                self.downloader.output_path = original_output_path
                self.downloader.template_folder_album = original_template_folder
                self.downloader.template_file_single_disc = original_template_file
            
        except Exception as e:
            logger.error(f"下载曲目失败: {e}", exc_info=True)
            return False
    
    def _format_track(self, track_data: Dict) -> TrackInfo:
        """Format track data."""
        attributes = track_data.get("attributes", {})
        
        # Get artwork URL
        artwork = attributes.get("artwork", {})
        artwork_url = None
        if artwork and artwork.get("url"):
            # Replace artwork dimensions with a high quality size
            artwork_url = artwork["url"].replace("{w}", "600").replace("{h}", "600")
        
        return TrackInfo(
            id=track_data.get("id", ""),
            title=attributes.get("name", "Unknown"),
            artist=attributes.get("artistName", "Unknown Artist"),
            album=attributes.get("albumName"),
            duration=attributes.get("durationInMillis"),
            artwork_url=artwork_url,
            preview_url=attributes.get("previews", [{}])[0].get("url") if attributes.get("previews") else None,
            release_date=attributes.get("releaseDate"),
            genre=attributes.get("genreNames", [None])[0] if attributes.get("genreNames") else None
        )
    
    def _format_album(self, album_data: Dict) -> AlbumInfo:
        """Format album data."""
        attributes = album_data.get("attributes", {})
        
        # Get artwork URL
        artwork = attributes.get("artwork", {})
        artwork_url = None
        if artwork and artwork.get("url"):
            artwork_url = artwork["url"].replace("{w}", "600").replace("{h}", "600")
        
        return AlbumInfo(
            id=album_data.get("id", ""),
            title=attributes.get("name", "Unknown Album"),
            artist=attributes.get("artistName", "Unknown Artist"),
            artwork_url=artwork_url,
            release_date=attributes.get("releaseDate"),
            track_count=attributes.get("trackCount")
        )
    
    def _format_artist(self, artist_data: Dict) -> ArtistInfo:
        """Format artist data."""
        attributes = artist_data.get("attributes", {})
        
        # Get avatar URL
        artwork = attributes.get("artwork", {})
        artwork_url = None
        if artwork and artwork.get("url"):
            artwork_url = artwork["url"].replace("{w}", "600").replace("{h}", "600")
        
        return ArtistInfo(
            id=artist_data.get("id", ""),
            name=attributes.get("name", "Unknown Artist"),
            artwork_url=artwork_url,
            genre=attributes.get("genreNames", [None])[0] if attributes.get("genreNames") else None
        )
    
    def _format_playlist(self, playlist_data: Dict) -> PlaylistInfo:
        """Format playlist data."""
        attributes = playlist_data.get("attributes", {})
        
        # Get artwork URL
        artwork = attributes.get("artwork", {})
        artwork_url = None
        if artwork and artwork.get("url"):
            artwork_url = artwork["url"].replace("{w}", "600").replace("{h}", "600")
        
        return PlaylistInfo(
            id=playlist_data.get("id", ""),
            title=attributes.get("name", "Unknown Playlist"),
            curator=attributes.get("curatorName"),
            artwork_url=artwork_url,
            track_count=attributes.get("trackCount")
        )


# Create the global service instance
apple_music_service = AppleMusicService()

