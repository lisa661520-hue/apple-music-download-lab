# Apple Music 搜索下载系统

这是一个在线 Apple Music 搜索、试听和下载应用。前端使用 Cloudflare Worker 渲染页面并代理 API 请求；后端使用 FastAPI，集成 `gamdl`、Apple Music cookies、Cloudflare Turnstile 验证、短期会话 ID 和临时下载令牌。

当前仓库只保留示例域名和示例密钥。部署前请替换所有 `example.com`、`example-*` 和 `EXAMPLE_*` 值。

## 免责声明

本项目仅供学习和技术研究使用，请勿用于商业用途。

所有音乐内容版权归 Apple Inc. 及相应版权所有者所有。用户应遵守当地法律法规，尊重音乐创作者，支持正版音乐服务。使用本项目产生的任何法律责任由使用者自行承担。

## 功能特性

前端功能：

- 支持搜索歌曲、专辑、艺术家和播放列表。
- 内置在线播放器。
- 下载弹窗支持编码和输出格式选择。
- 集成 Cloudflare Turnstile 人机验证。
- 响应式界面，支持浅色/深色模式、语言切换和 GSAP 动画。
- 独立免责声明页面。

后端功能：

- FastAPI REST API。
- 通过 `gamdl` 集成 Apple Music。
- Turnstile token 验证和短期会话管理。
- 临时播放/下载 token 管理。
- 定时清理过期 token、会话和临时文件。
- 基于 FFmpeg 的格式转换。
- 提供 systemd 和 cron 部署示例。

## 项目结构

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

## 部署架构

推荐的生产部署链路：

```text
Browser
  -> Cloudflare Worker frontend: https://applemusic.example.com
  -> Worker proxies /api/* to backend: https://applemusic-api.example.com
  -> Nginx reverse proxy
  -> FastAPI on 127.0.0.1:8000
```

后端敏感配置保存在服务器的 `/opt/apple-music/backend/.env` 和 `apple-music.txt` 中。前端只需要公开的后端 API 地址和公开的 Turnstile site key。

## 前置条件

- Linux 服务器，建议 Ubuntu 22.04 或更新版本。
- Python 3.10 或更新版本。
- FFmpeg。
- Nginx 和 Certbot。
- 已启用 Workers 的 Cloudflare 账号。
- Cloudflare Turnstile widget。
- Netscape cookie 格式的 Apple Music cookies。
- 用于部署 Worker 的 Node.js 和 Wrangler。

## 后端部署

### 1. 安装系统依赖

```bash
# Update package indexes
sudo apt update

# Install Python, virtualenv support, FFmpeg, Nginx, and Certbot
sudo apt install python3 python3-venv python3-pip ffmpeg nginx certbot python3-certbot-nginx -y

# Use the timezone expected by the cleanup schedule
sudo timedatectl set-timezone Asia/Shanghai
```

### 2. 复制项目

如果使用 `/opt/apple-music`，可以直接使用仓库内的 `applemusic.service`，无需修改路径。

```bash
# Create a service user
sudo useradd --system --home /opt/apple-music --shell /usr/sbin/nologin appuser

# Copy the project to the deployment directory
sudo mkdir -p /opt/apple-music
sudo rsync -a ./ /opt/apple-music/
sudo chown -R appuser:appuser /opt/apple-music
```

如果部署到其他目录，请同步修改 `WorkingDirectory`、`ExecStart` 和 cron 路径。

### 3. 安装 Python 依赖

```bash
cd /opt/apple-music/backend

# Create and activate the virtual environment
sudo -u appuser python3 -m venv venv
sudo -u appuser ./venv/bin/pip install --upgrade pip
sudo -u appuser ./venv/bin/pip install -r requirements.txt
```

### 4. 配置后端环境变量

创建 `/opt/apple-music/backend/.env`：

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

限制配置文件权限：

```bash
sudo chown appuser:appuser /opt/apple-music/backend/.env
sudo chmod 600 /opt/apple-music/backend/.env
```

### 5. 配置 Apple Music cookies

将 `/opt/apple-music/backend/apple-music.txt` 替换为你自己导出的 Apple Music Netscape 格式 cookies。仓库中的文件只是占位示例，不能直接使用。

```bash
sudo chown appuser:appuser /opt/apple-music/backend/apple-music.txt
sudo chmod 600 /opt/apple-music/backend/apple-music.txt
```

不要把真实 cookies 或密钥提交到代码仓库。

### 6. 手动测试后端

```bash
cd /opt/apple-music/backend
sudo -u appuser ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

另开终端测试：

```bash
curl http://127.0.0.1:8000/health
```

健康检查成功后停止手动启动的服务。

### 7. 安装 systemd 服务

内置 service 文件默认使用：

- 项目路径：`/opt/apple-music`
- 后端路径：`/opt/apple-music/backend`
- 虚拟环境：`/opt/apple-music/backend/venv`
- 服务用户：`appuser`

```bash
sudo cp /opt/apple-music/backend/applemusic.service /etc/systemd/system/applemusic.service
sudo systemctl daemon-reload
sudo systemctl enable applemusic.service
sudo systemctl start applemusic.service
sudo systemctl status applemusic.service
```

查看日志：

```bash
sudo journalctl -u applemusic.service -f
tail -f /var/log/applemusic-api.log
```

### 8. 配置 Nginx 和 HTTPS

创建 `/etc/nginx/sites-available/applemusic-api`：

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

启用站点并签发证书：

```bash
sudo ln -s /etc/nginx/sites-available/applemusic-api /etc/nginx/sites-enabled/applemusic-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d applemusic-api.example.com
```

验证：

```bash
curl https://applemusic-api.example.com/health
```

### 9. 可选 cron 清理

FastAPI 应用已经内置定时清理任务。只有在需要外部兜底清理时才额外配置 cron：

```bash
sudo crontab -e

# Run daily cleanup at 03:00
0 3 * * * /opt/apple-music/backend/cleanup.sh
```

## 前端部署

### 1. 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. 配置 Worker

编辑 `/opt/apple-music/frontend/worker.js`：

```javascript
const API_BACKEND = 'https://applemusic-api.example.com';
const TURNSTILE_SITE_KEY = 'example-turnstile-site-key';
```

同步更新 `/opt/apple-music/frontend/wrangler.toml`：

```toml
[vars]
API_BACKEND = "https://applemusic-api.example.com"
TURNSTILE_SITE_KEY = "example-turnstile-site-key"
```

Turnstile site key 是公开值。Turnstile secret key 只能放在后端 `.env` 中。

### 3. 本地测试

```bash
cd /opt/apple-music/frontend
wrangler dev
```

访问 `http://localhost:8787`。

### 4. 部署 Worker

```bash
cd /opt/apple-music/frontend
wrangler deploy
```

### 5. 绑定自定义域名

在 Cloudflare 控制台中：

1. 打开 Workers & Pages。
2. 选择已部署的 Worker。
3. 进入 Triggers。
4. 添加自定义域名 `applemusic.example.com`。
5. 将同一个前端域名加入 Turnstile widget 的允许主机名。

## API 概览

所有 API 都以 `/api` 开头。

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

## 运维命令

后端服务：

```bash
sudo systemctl start applemusic.service
sudo systemctl stop applemusic.service
sudo systemctl restart applemusic.service
sudo systemctl status applemusic.service
sudo journalctl -u applemusic.service -f
```

手动清理：

```bash
/opt/apple-music/backend/cleanup.sh
```

Worker：

```bash
wrangler dev
wrangler deploy
wrangler deployments list
wrangler rollback
```

## 故障排查

后端无法启动：

- 查看 `sudo journalctl -u applemusic.service -n 100`。
- 确认 `/opt/apple-music/backend/venv/bin/python` 存在。
- 确认 `.env` 和 `apple-music.txt` 可被 `appuser` 读取。
- 执行 `cd /opt/apple-music/backend && sudo -u appuser ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000`。

Apple Music 请求失败：

- 重新导出 `apple-music.txt`。
- 确认 cookie 文件是 Netscape 格式。
- 重启 `applemusic.service`。

下载或格式转换失败：

- 检查 `ffmpeg -version`。
- 用 `df -h` 检查磁盘空间。
- 检查 `/opt/apple-music/backend/temp` 和 `/opt/apple-music/backend/downloads` 的权限。

前端 API 请求失败：

- 确认 `API_BACKEND` 指向 HTTPS 后端域名。
- 确认 Nginx 和后端健康检查正常。
- 确认 Turnstile site key 和 widget 匹配。
- 确认 `.env` 里的 Turnstile secret key 属于同一个 widget。

## 安全建议

- 不要提交真实 `apple-music.txt`、`.env`、Cloudflare secret 或私钥。
- 前端和后端域名都应启用 HTTPS。
- 除非有明确需求，否则后端 API 应通过 Worker 访问。
- 如果 Apple Music cookies 或 Turnstile key 曾经泄露，请立即轮换。
- 使用 Git 前，建议将 `.env`、真实 cookie 文件、`temp/`、`downloads/` 和日志加入 `.gitignore`。

## 许可证

本项目仅供学习和研究使用，不得用于商业用途。

### 推广
NiubiStar 新活动上线：

项目入驻 NiubiStar，即刻获取 30 颗冷启动加速 Star。

活动页： https://niubistar.com/free-20-stars
