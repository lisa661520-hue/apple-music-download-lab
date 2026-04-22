from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class TurnstileVerifyRequest(BaseModel):
    """Turnstile verification request."""
    token: str = Field(..., description="Cloudflare Turnstile token")


class TurnstileVerifyResponse(BaseModel):
    """Turnstile verification response."""
    success: bool = Field(..., description="Whether verification succeeded")
    session_id: Optional[str] = Field(None, description="Session ID")
    message: Optional[str] = Field(None, description="Error message")


class SearchRequest(BaseModel):
    """Search request."""
    q: str = Field(..., min_length=1, description="Search keyword")
    types: str = Field(default="songs,albums", description="Search types: songs,albums,artists,playlists")
    limit: int = Field(default=25, ge=1, le=50, description="Result limit")


class TrackInfo(BaseModel):
    """Track information."""
    id: str = Field(..., description="Track ID")
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Artist")
    album: Optional[str] = Field(None, description="Album name")
    duration: Optional[int] = Field(None, description="Duration in milliseconds")
    artwork_url: Optional[str] = Field(None, description="Artwork image URL")
    preview_url: Optional[str] = Field(None, description="Preview URL")
    release_date: Optional[str] = Field(None, description="Release date")
    genre: Optional[str] = Field(None, description="Genre")


class AlbumInfo(BaseModel):
    """Album information."""
    id: str = Field(..., description="Album ID")
    title: str = Field(..., description="Album title")
    artist: str = Field(..., description="Artist")
    artwork_url: Optional[str] = Field(None, description="Artwork image URL")
    release_date: Optional[str] = Field(None, description="Release date")
    track_count: Optional[int] = Field(None, description="Track count")


class ArtistInfo(BaseModel):
    """Artist information."""
    id: str = Field(..., description="Artist ID")
    name: str = Field(..., description="Artist name")
    artwork_url: Optional[str] = Field(None, description="Avatar URL")
    genre: Optional[str] = Field(None, description="Genre")


class PlaylistInfo(BaseModel):
    """Playlist information."""
    id: str = Field(..., description="Playlist ID")
    title: str = Field(..., description="Playlist title")
    curator: Optional[str] = Field(None, description="Curator")
    artwork_url: Optional[str] = Field(None, description="Artwork image URL")
    track_count: Optional[int] = Field(None, description="Track count")


class SearchResponse(BaseModel):
    """Search response."""
    songs: Optional[List[TrackInfo]] = Field(default_factory=list, description="Song list")
    albums: Optional[List[AlbumInfo]] = Field(default_factory=list, description="Album list")
    artists: Optional[List[ArtistInfo]] = Field(default_factory=list, description="Artist list")
    playlists: Optional[List[PlaylistInfo]] = Field(default_factory=list, description="Playlist list")


class PreparePlayRequest(BaseModel):
    """Prepare playback request."""
    track_id: str = Field(..., description="Track ID")
    codec: str = Field(default="aac-legacy", description="Audio codec")


class PreparePlayResponse(BaseModel):
    """Prepare playback response."""
    token: str = Field(..., description="Playback token")
    stream_url: str = Field(..., description="Streaming URL")
    expires_at: datetime = Field(..., description="Token expiration time")
    track_info: Optional[TrackInfo] = Field(None, description="Track information")


class PrepareDownloadRequest(BaseModel):
    """Prepare download request."""
    track_id: str = Field(..., description="Track ID")
    codec: str = Field(default="aac-legacy", description="Audio codec")
    format: str = Field(
        default="m4a", 
        description="File format: m4a, mp3, wav, flac, aac, ogg, opus"
    )


class PrepareDownloadResponse(BaseModel):
    """Prepare download response."""
    token: str = Field(..., description="Download token")
    download_url: str = Field(..., description="Download URL")
    expires_at: datetime = Field(..., description="Token expiration time")
    filename: str = Field(..., description="Filename")
    file_size: Optional[int] = Field(None, description="File size in bytes")


class ErrorResponse(BaseModel):
    """Error response."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Details")

