# Apple Music Search and Download System

An online Apple Music search, preview, and download application. The frontend is a Cloudflare Worker that renders the web UI and proxies API calls. The backend is a FastAPI service that uses `gamdl`, Apple Music cookies, Cloudflare Turnstile verification, short-lived session IDs, and temporary download tokens.

This repository is configured with example domains and example keys only. Replace every `example.com`, `example-*`, and `EXAMPLE_*` value before deployment.

## Disclaimer

This project is for learning and technical research only. Do not use it for commercial purposes.

All music content belongs to Apple Inc. and the respective copyright owners. Users must comply with local laws, respect music creators, and support legitimate music services. You are responsible for any legal consequences caused by your own use of this project.

## Features

Frontend:

- Apple Music search for songs, albums, artists, and playlists.
- Built-in audio player.
- Download modal with codec and output format choices.
- Cloudflare Turnstile verification.
- Responsive UI with light/dark mode, language switch, and GSAP animation.
- Standalone disclaimer page.

Backend:

- FastAPI REST API.
- Apple Music integration through `gamdl`.
- Turnstile token verification and short-lived sessions.
- Temporary play/download token management.
- Scheduled cleanup for expired tokens, sessions, and temporary files.
- FFmpeg-based format conversion.
- systemd and cron deployment examples.

## Project Structure

```text
apple-music/
├── frontend/
│   ├── worker.js                    # Cloudflare Worker entry
│   └── wrangler.toml                # Wrangler deployment config
├── backend/
│   ├── main.py                      # FastAPI entry
│   ├── config.py                    # Runtime settings
│   ├── requirements.txt             # Python dependencies
│   ├── apple-music.txt              # Apple Music cookie file, example only
│   ├── applemusic.service           # systemd service example
│   ├── cleanup.sh                   # Temporary file cleanup script
│   ├── crontab.txt                  # Cron example
│   ├── models/                      # Pydantic models
│   ├── services/                    # API, token, and Turnstile services
│   └── utils/                       # File and audio helpers
├── README.md
└── readme_CN.md
```

## Deployment Overview

The recommended production layout is:

```text
Browser
  -> Cloudflare Worker frontend: https://applemusic.example.com
  -> Worker proxies /api/* to backend: https://applemusic-api.example.com
  -> Nginx reverse proxy
  -> FastAPI on 127.0.0.1:8000
```

Backend secrets stay on the server in `/opt/apple-music/backend/.env` and `apple-music.txt`. The frontend only needs the public API backend URL and the public Turnstile site key.

## Prerequisites

- A Linux server, preferably Ubuntu 22.04 or newer.
- Python 3.10 or newer.
- FFmpeg.
- Nginx and Certbot for HTTPS.
- A Cloudflare account with Workers enabled.
- A Cloudflare Turnstile widget.
- An Apple Music cookie export in Netscape cookie format.
- Node.js and Wrangler on the machine where you deploy the Worker.

## Backend Deployment

### 1. Install system packages

```bash
# Update package indexes
sudo apt update

# Install Python, virtualenv support, FFmpeg, Nginx, and Certbot
sudo apt install python3 python3-venv python3-pip ffmpeg nginx certbot python3-certbot-nginx -y

# Use the timezone expected by the cleanup schedule
sudo timedatectl set-timezone Asia/Shanghai
```

### 2. Copy the project

Use `/opt/apple-music` if you want to use the included `applemusic.service` without path changes.

```bash
# Create a service user
sudo useradd --system --home /opt/apple-music --shell /usr/sbin/nologin appuser

# Copy the project to the deployment directory
sudo mkdir -p /opt/apple-music
sudo rsync -a ./ /opt/apple-music/
sudo chown -R appuser:appuser /opt/apple-music
```

If you deploy to another path, update `WorkingDirectory`, `ExecStart`, and cron paths accordingly.

### 3. Install Python dependencies

```bash
cd /opt/apple-music/backend

# Create and activate the virtual environment
sudo -u appuser python3 -m venv venv
sudo -u appuser ./venv/bin/pip install --upgrade pip
sudo -u appuser ./venv/bin/pip install -r requirements.txt
```

### 4. Configure backend environment variables

Create `/opt/apple-music/backend/.env`:

```env
# App runtime
APP_NAME=Apple Music API
APP_VERSION=1.0.0
DEBUG=false
HOST=0.0.0.0
PORT=8000

# Public domains
BACKEND_DOMAIN=applemusic-api.example.com
FRONTEND_DOMAIN=applemusic.example.com

# Cloudflare Turnstile secret key, server-side only
TURNSTILE_SECRET_KEY=example-turnstile-secret-key

# Token lifetimes in seconds
TURNSTILE_SESSION_EXPIRE=100
DOWNLOAD_TOKEN_EXPIRE=300
PLAY_TOKEN_EXPIRE=300

# Cleanup schedule timezone
CLEANUP_TIMEZONE=Asia/Shanghai
```

Then restrict access:

```bash
sudo chown appuser:appuser /opt/apple-music/backend/.env
sudo chmod 600 /opt/apple-music/backend/.env
```

### 5. Configure Apple Music cookies

Replace `/opt/apple-music/backend/apple-music.txt` with your real Apple Music cookie export in Netscape format. The repository file is only a placeholder and will not work.

```bash
sudo chown appuser:appuser /opt/apple-music/backend/apple-music.txt
sudo chmod 600 /opt/apple-music/backend/apple-music.txt
```

Do not commit real cookies or keys to source control.

### 6. Test the backend manually

```bash
cd /opt/apple-music/backend
sudo -u appuser ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
curl http://127.0.0.1:8000/health
```

Stop the manual server after the health check succeeds.

### 7. Install the systemd service

The included service assumes:

- Project path: `/opt/apple-music`
- Backend path: `/opt/apple-music/backend`
- Virtual environment: `/opt/apple-music/backend/venv`
- Service user: `appuser`

```bash
sudo cp /opt/apple-music/backend/applemusic.service /etc/systemd/system/applemusic.service
sudo systemctl daemon-reload
sudo systemctl enable applemusic.service
sudo systemctl start applemusic.service
sudo systemctl status applemusic.service
```

Logs:

```bash
sudo journalctl -u applemusic.service -f
tail -f /var/log/applemusic-api.log
```

### 8. Configure Nginx and HTTPS

Create `/etc/nginx/sites-available/applemusic-api`:

```nginx
server {
    listen 80;
    server_name applemusic-api.example.com;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
```

Enable it and issue a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/applemusic-api /etc/nginx/sites-enabled/applemusic-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d applemusic-api.example.com
```

Verify:

```bash
curl https://applemusic-api.example.com/health
```

### 9. Optional cron cleanup

The FastAPI app already schedules cleanup tasks. Use cron only if you also want an external cleanup job:

```bash
sudo crontab -e

# Run daily cleanup at 03:00
0 3 * * * /opt/apple-music/backend/cleanup.sh
```

## Frontend Deployment

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure Worker values

Edit `/opt/apple-music/frontend/worker.js`:

```javascript
const API_BACKEND = 'https://applemusic-api.example.com';
const TURNSTILE_SITE_KEY = 'example-turnstile-site-key';
```

Keep `/opt/apple-music/frontend/wrangler.toml` in sync:

```toml
[vars]
API_BACKEND = "https://applemusic-api.example.com"
TURNSTILE_SITE_KEY = "example-turnstile-site-key"
```

The Turnstile site key is public. The Turnstile secret key must only be stored in the backend `.env`.

### 3. Test locally

```bash
cd /opt/apple-music/frontend
wrangler dev
```

Open `http://localhost:8787`.

### 4. Deploy

```bash
cd /opt/apple-music/frontend
wrangler deploy
```

### 5. Attach a custom domain

In the Cloudflare dashboard:

1. Open Workers & Pages.
2. Select the deployed Worker.
3. Open Triggers.
4. Add the custom domain `applemusic.example.com`.
5. Add the same frontend domain to the Turnstile widget hostnames.

## API Summary

All API routes are under `/api`.

```http
POST /api/verify-turnstile
Content-Type: application/json

{
  "token": "turnstile_token"
}
```

```http
GET /api/search?q=keyword&types=songs,albums&limit=25
X-Session-ID: session_id
```

```http
POST /api/prepare-play
X-Session-ID: session_id
Content-Type: application/json

{
  "track_id": "1234567890",
  "codec": "aac-legacy"
}
```

```http
POST /api/prepare-download
X-Session-ID: session_id
Content-Type: application/json

{
  "track_id": "1234567890",
  "codec": "aac-legacy",
  "format": "m4a"
}
```

```http
GET /api/stream/{token}
GET /api/download/{token}
```

## Operations

Backend service:

```bash
sudo systemctl start applemusic.service
sudo systemctl stop applemusic.service
sudo systemctl restart applemusic.service
sudo systemctl status applemusic.service
sudo journalctl -u applemusic.service -f
```

Manual cleanup:

```bash
/opt/apple-music/backend/cleanup.sh
```

Worker:

```bash
wrangler dev
wrangler deploy
wrangler deployments list
wrangler rollback
```

## Troubleshooting

Backend does not start:

- Check `sudo journalctl -u applemusic.service -n 100`.
- Confirm `/opt/apple-music/backend/venv/bin/python` exists.
- Confirm `.env` and `apple-music.txt` are readable by `appuser`.
- Run `cd /opt/apple-music/backend && sudo -u appuser ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000`.

Apple Music requests fail:

- Export a fresh `apple-music.txt` cookie file.
- Confirm the cookie file is Netscape format.
- Restart `applemusic.service`.

Downloads or conversions fail:

- Check `ffmpeg -version`.
- Check disk space with `df -h`.
- Check permissions on `/opt/apple-music/backend/temp` and `/opt/apple-music/backend/downloads`.

Frontend API calls fail:

- Confirm `API_BACKEND` points to the HTTPS backend domain.
- Confirm Nginx and the backend health check work.
- Confirm the Turnstile site key matches the Turnstile widget.
- Confirm the Turnstile secret key in `.env` belongs to the same widget.

## Security Notes

- Never commit real `apple-music.txt`, `.env`, Cloudflare secrets, or private keys.
- Use HTTPS for both frontend and backend domains.
- Keep backend API access behind the Worker unless you intentionally expose it.
- Rotate Apple Music cookies and Turnstile keys if they were ever committed or shared.
- Consider adding `.env`, real cookie files, `temp/`, `downloads/`, and logs to `.gitignore` before using Git.

## License

This project is for learning and research only and must not be used commercially.
