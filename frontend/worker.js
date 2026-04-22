/**
 * Apple Music search/download web app.
 * Cloudflare Worker modern version.
 * Includes 3D particle waves, bilingual UI, and mobile optimizations.
 */

const API_BACKEND = 'https://applemusic-api.example.com';
const TURNSTILE_SITE_KEY = 'example-turnstile-site-key';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  // Route handling
  if (path === '/' || path === '/index.html') {
    return new Response(getHomePage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  if (path === '/disclaimer') {
    return new Response(getDisclaimerPage(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // API proxy to avoid CORS issues
  if (path.startsWith('/api/')) {
    return proxyToBackend(request);
  }

  // 404
  return new Response('Not Found', { status: 404 });
}

/**
 * Handle OPTIONS preflight requests.
 */
function handleOptions(request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
    'Access-Control-Max-Age': '86400',
  };
  return new Response(null, { headers });
}

/**
 * Proxy requests to the backend API.
 */
async function proxyToBackend(request) {
  const url = new URL(request.url);
  const backendUrl = API_BACKEND + url.pathname + url.search;

  console.log(`[Worker] 代理请求: ${request.method} ${backendUrl}`);
  console.log(`[Worker] 原始请求头:`, Object.fromEntries(request.headers.entries()));

  try {
    // Build request options
    const fetchOptions = {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'X-Session-ID': request.headers.get('X-Session-ID') || '',
        'User-Agent': 'Cloudflare-Worker/1.0',
      },
    };

    // Add body for POST/PUT requests
    if (request.method === 'POST' || request.method === 'PUT') {
      const contentType = request.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.text();
        fetchOptions.body = body;
        console.log(`[Worker] 请求体: ${body}`);
      } else {
        fetchOptions.body = request.body;
      }
    }

    console.log(`[Worker] 发送选项:`, JSON.stringify({
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      bodyLength: fetchOptions.body ? fetchOptions.body.length : 0
    }));

    // Send the request to the backend with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(backendUrl, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      console.log(`[Worker] 后端响应状态: ${response.status} ${response.statusText}`);
      console.log(`[Worker] 响应头:`, Object.fromEntries(response.headers.entries()));

      // Read response
      const responseBody = await response.text();
      console.log(`[Worker] 响应体长度: ${responseBody.length} 字节`);
      
      // Build response headers
      const responseHeaders = new Headers({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      });

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`[Worker] 请求超时: ${backendUrl}`);
        throw new Error('后端请求超时（30秒）');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error(`[Worker] 代理请求失败:`, error);
    console.error(`[Worker] 错误类型:`, error.name);
    console.error(`[Worker] 错误消息:`, error.message);
    console.error(`[Worker] 错误堆栈:`, error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Backend request failed', 
      message: error.message,
      error_type: error.name,
      backend_url: backendUrl
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

/**
 * Home page HTML.
 */
function getHomePage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Apple Music 搜索下载</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      /* Light theme variables */
      --bg-primary: #ffffff;
      --bg-secondary: #f8f9fa;
      --text-primary: #1a1a1a;
      --text-secondary: #666666;
      --text-tertiary: #999999;
      --card-bg: rgba(255, 255, 255, 0.95);
      --card-shadow: rgba(0, 0, 0, 0.1);
      --border-color: #e0e0e0;
      --input-bg: #ffffff;
      --input-border: #e0e0e0;
      --input-focus: #667eea;
      --button-gradient-start: #667eea;
      --button-gradient-end: #764ba2;
      --player-bg: rgba(255, 255, 255, 0.98);
      --player-text: #1a1a1a;
      --header-text: #ffffff;
      --header-shadow: rgba(0, 0, 0, 0.2);
      --highlight-bg: #fff3cd;
      --highlight-border: #ffc107;
      --highlight-text: #856404;
    }

    [data-theme="dark"] {
      /* Dark theme variables */
      --bg-primary: #0a0a0a;
      --bg-secondary: #1a1a1a;
      --text-primary: #ffffff;
      --text-secondary: #b0b0b0;
      --text-tertiary: #808080;
      --card-bg: rgba(26, 26, 26, 0.95);
      --card-shadow: rgba(0, 0, 0, 0.5);
      --border-color: #333333;
      --input-bg: #1a1a1a;
      --input-border: #333333;
      --input-focus: #667eea;
      --button-gradient-start: #667eea;
      --button-gradient-end: #764ba2;
      --player-bg: rgba(26, 26, 26, 0.98);
      --player-text: #ffffff;
      --header-text: #ffffff;
      --header-shadow: rgba(0, 0, 0, 0.4);
      --highlight-bg: rgba(255, 193, 7, 0.15);
      --highlight-border: #ffc107;
      --highlight-text: #ffd54f;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      color: var(--text-primary);
      transition: background-color 0.3s ease, color 0.3s ease;
      position: relative;
      overflow-x: hidden;
    }

    #waveCanvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      pointer-events: none;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      position: relative;
      z-index: 1;
    }

    .header {
      text-align: center;
      padding: 40px 0;
      position: relative;
    }

    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--text-primary);
      text-shadow: 2px 2px 4px var(--header-shadow);
    }

    .header p {
      font-size: 1rem;
      color: var(--text-secondary);
      opacity: 0.9;
    }

    .controls-container {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 1001;
    }

    .blog-btn {
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(255, 107, 157, 0.2);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 107, 157, 0.4);
      border-radius: 50px;
      padding: 10px 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s ease;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.9rem;
      touch-action: manipulation;
      min-height: 44px;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      z-index: 1001;
    }

    .blog-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(255, 107, 157, 0.4);
      background: rgba(255, 107, 157, 0.3);
      border-color: rgba(255, 107, 157, 0.6);
    }

    .blog-btn:active {
      transform: scale(0.95);
    }

    .blog-btn-icon {
      font-size: 1.2rem;
      transition: transform 0.3s ease;
    }

    .blog-btn:hover .blog-btn-icon {
      transform: rotate(20deg);
    }

    .particle-toggle {
      background: rgba(102, 126, 234, 0.2);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(102, 126, 234, 0.3);
      border-radius: 50px;
      padding: 10px 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s ease;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.9rem;
      touch-action: manipulation;
      min-height: 44px;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .particle-toggle:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
      background: rgba(102, 126, 234, 0.3);
    }

    .particle-toggle:active {
      transform: scale(0.95);
    }

    .particle-toggle.paused {
      background: rgba(255, 59, 48, 0.2);
      border-color: rgba(255, 59, 48, 0.3);
    }

    .particle-toggle.paused:hover {
      background: rgba(255, 59, 48, 0.3);
      box-shadow: 0 5px 15px rgba(255, 59, 48, 0.4);
    }

    .lang-toggle,
    .theme-toggle {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50px;
      padding: 10px 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s ease;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.9rem;
      touch-action: manipulation;
      min-height: 44px;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    [data-theme="dark"] .lang-toggle,
    [data-theme="dark"] .theme-toggle {
      background: rgba(26, 26, 26, 0.8);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .lang-toggle:hover,
    .theme-toggle:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      background: rgba(255, 255, 255, 0.3);
    }

    [data-theme="dark"] .lang-toggle:hover,
    [data-theme="dark"] .theme-toggle:hover {
      background: rgba(26, 26, 26, 0.9);
    }

    .lang-toggle-icon,
    .theme-toggle-icon {
      font-size: 1.2rem;
      transition: transform 0.3s ease;
    }

    .lang-toggle:hover .lang-toggle-icon,
    .theme-toggle:hover .theme-toggle-icon {
      transform: rotate(20deg);
    }

    .search-box {
      background: var(--card-bg);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 10px 40px var(--card-shadow);
      transition: all 0.3s ease;
      backdrop-filter: blur(20px);
    }

    .search-input-wrapper {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .search-input {
      flex: 1;
      padding: 15px 20px;
      border: 2px solid var(--input-border);
      border-radius: 12px;
      font-size: 1rem;
      transition: all 0.3s;
      color: var(--text-primary);
      background: var(--input-bg);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--input-focus);
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .search-btn {
      padding: 15px 40px;
      background: linear-gradient(135deg, var(--button-gradient-start) 0%, var(--button-gradient-end) 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      white-space: nowrap;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      min-height: 44px;
    }

    .search-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .search-btn:active {
      transform: scale(0.98);
    }

    .search-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .turnstile-container {
      display: flex;
      justify-content: center;
      margin-top: 20px;
      min-height: 65px;
    }

    .results-container {
      margin-top: 20px;
    }

    .result-card {
      background: var(--card-bg);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 15px;
      display: flex;
      gap: 20px;
      align-items: center;
      box-shadow: 0 5px 15px var(--card-shadow);
      transition: all 0.3s ease;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      backdrop-filter: blur(20px);
    }

    .result-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px var(--card-shadow);
    }

    .result-artwork {
      width: 80px;
      height: 80px;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .result-info {
      flex: 1;
      min-width: 0;
    }

    .result-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 5px;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .result-artist {
      font-size: 0.9rem;
      color: var(--text-secondary);
      margin-bottom: 5px;
    }

    .result-album {
      font-size: 0.85rem;
      color: var(--text-tertiary);
    }

    .result-actions {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }

    .action-btn {
      min-width: 44px;
      min-height: 44px;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .play-btn {
      background: #34c759;
      color: white;
    }

    .play-btn:hover {
      background: #2fb34d;
      transform: scale(1.05);
    }

    .play-btn:active {
      transform: scale(0.95);
    }

    .download-btn {
      background: #007aff;
      color: white;
    }

    .download-btn:hover {
      background: #0066d6;
      transform: scale(1.05);
    }

    .download-btn:active {
      transform: scale(0.95);
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .player-container {
      position: fixed;
      top: 20px;
      left: 20px;
      max-width: 350px;
      width: auto;
      min-width: 280px;
      background: var(--player-bg);
      padding: 15px;
      transform: translate(-120%, 0);
      transition: all 0.3s ease;
      z-index: 1000;
      border: 1px solid var(--border-color);
      box-shadow: 0 10px 40px var(--card-shadow);
      backdrop-filter: blur(20px);
      border-radius: 16px;
    }

    .player-container.active {
      transform: translate(0, 0);
    }

    .player-content {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .player-artwork {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
    }

    .player-info {
      flex: 1;
      min-width: 0;
    }

    .player-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--player-text);
    }

    .player-artist {
      font-size: 0.8rem;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .player-btn {
      background: none;
      border: none;
      color: var(--player-text);
      font-size: 1.3rem;
      cursor: pointer;
      transition: all 0.3s;
      padding: 5px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .player-btn:hover {
      transform: scale(1.2);
    }

    .player-btn:active {
      transform: scale(0.9);
    }

    .close-player-btn {
      background: #ff3b30;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.3s ease;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      white-space: nowrap;
    }

    .close-player-btn:hover {
      background: #e6342a;
      transform: scale(1.05);
    }

    .close-player-btn:active {
      transform: scale(0.95);
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: var(--text-primary);
    }

    .spinner {
      border: 4px solid var(--border-color);
      border-top: 4px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .message {
      padding: 15px 20px;
      border-radius: 10px;
      margin: 20px 0;
      text-align: center;
      font-weight: 500;
      backdrop-filter: blur(20px);
    }

    .message.error {
      background: rgba(255, 59, 48, 0.9);
      color: white;
    }

    .message.success {
      background: rgba(52, 199, 89, 0.9);
      color: white;
    }

    .message.info {
      background: rgba(0, 122, 255, 0.9);
      color: white;
    }

    .footer {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
    }

    .footer a {
      color: var(--text-secondary);
      text-decoration: underline;
      transition: color 0.3s ease;
    }

    .footer a:hover {
      color: var(--text-primary);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      backdrop-filter: blur(5px);
    }

    .modal-overlay.active {
      display: flex;
    }

    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 3000;
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
    }

    .confirm-overlay.active {
      display: flex;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        backdrop-filter: blur(0px);
      }
      to {
        opacity: 1;
        backdrop-filter: blur(15px);
      }
    }

    .confirm-dialog {
      background: var(--card-bg);
      border-radius: 20px;
      padding: 35px;
      max-width: 450px;
      width: 85%;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      transform: scale(0.9);
      animation: popIn 0.3s ease forwards;
    }

    @keyframes popIn {
      to {
        transform: scale(1);
      }
    }

    .confirm-title {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 15px;
      color: var(--text-primary);
      text-align: center;
    }

    .confirm-message {
      font-size: 1rem;
      color: var(--text-secondary);
      margin-bottom: 25px;
      text-align: center;
      line-height: 1.6;
    }

    .confirm-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .confirm-btn {
      padding: 12px 30px;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      min-height: 44px;
      min-width: 100px;
    }

    .confirm-btn.primary {
      background: linear-gradient(135deg, #FF6B9D 0%, #FF8A5B 100%);
      color: white;
    }

    .confirm-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(255, 107, 157, 0.4);
    }

    .confirm-btn.primary:active {
      transform: scale(0.98);
    }

    .confirm-btn.secondary {
      background: var(--border-color);
      color: var(--text-primary);
    }

    .confirm-btn.secondary:hover {
      background: var(--input-border);
    }

    .confirm-btn.secondary:active {
      transform: scale(0.98);
    }

    .modal-content {
      background: var(--card-bg);
      border-radius: 20px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      transition: all 0.3s ease;
      backdrop-filter: blur(20px);
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--text-primary);
    }

    .format-selector {
      margin-bottom: 20px;
    }

    .format-selector label {
      display: block;
      margin-bottom: 10px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .format-selector select {
      width: 100%;
      padding: 12px;
      border: 2px solid var(--input-border);
      border-radius: 10px;
      font-size: 1rem;
      color: var(--text-primary);
      background: var(--input-bg);
      transition: all 0.3s ease;
    }

    .format-selector select:focus {
      outline: none;
      border-color: var(--input-focus);
    }

    .modal-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .modal-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      min-height: 44px;
    }

    .modal-btn.primary {
      background: #007aff;
      color: white;
    }

    .modal-btn.primary:hover {
      background: #0066d6;
    }

    .modal-btn.primary:active {
      transform: scale(0.98);
    }

    .modal-btn.secondary {
      background: var(--border-color);
      color: var(--text-primary);
    }

    .modal-btn.secondary:hover {
      background: var(--input-border);
    }

    .modal-btn.secondary:active {
      transform: scale(0.98);
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 2rem;
      }

      .controls-container {
        top: 10px;
        right: 10px;
        gap: 8px;
      }

      .blog-btn {
        top: 10px;
        left: 10px;
        padding: 10px;
        width: 44px;
        height: 44px;
        justify-content: center;
        border-radius: 50%;
      }

      .blog-btn-text {
        display: none;
      }

      .particle-toggle-text {
        display: none;
      }

      .particle-toggle {
        width: 44px;
        height: 44px;
        padding: 10px;
        justify-content: center;
        border-radius: 50%;
      }

      .lang-toggle-text,
      .theme-toggle-text {
        display: none;
      }

      .lang-toggle,
      .theme-toggle {
        width: 44px;
        height: 44px;
        padding: 10px;
        justify-content: center;
        border-radius: 50%;
      }

      .confirm-dialog {
        width: 90%;
        padding: 25px;
      }

      .confirm-title {
        font-size: 1.1rem;
      }

      .confirm-actions {
        flex-direction: column;
      }

      .confirm-btn {
        width: 100%;
      }

      .search-input-wrapper {
        flex-direction: column;
      }

      .search-btn {
        width: 100%;
      }

      .result-card {
        flex-direction: column;
        text-align: center;
        padding: 15px;
      }

      .result-artwork {
        width: 100px;
        height: 100px;
      }

      .result-actions {
        width: 100%;
        justify-content: center;
        gap: 15px;
      }

      .result-actions .action-btn {
        flex: 1;
        padding: 14px 20px;
        font-size: 1rem;
      }

      .player-container {
        top: 10px;
        left: 10px;
        right: 10px;
        max-width: calc(100vw - 20px);
        min-width: unset;
      }

      .player-content {
        gap: 10px;
      }

      .player-artwork {
        width: 45px;
        height: 45px;
      }

      .player-title {
        font-size: 0.85rem;
      }

      .player-artist {
        font-size: 0.75rem;
      }

      .close-player-btn {
        font-size: 0.75rem;
        padding: 5px 10px;
      }

      .modal-actions {
        flex-direction: column;
      }

      .modal-btn {
        width: 100%;
      }
    }
  </style>
</head>
<body data-theme="light">
  <div id="waveCanvas"></div>
  
  <button class="blog-btn" onclick="openBlogConfirm()" aria-label="访问博客">
    <span class="blog-btn-icon">📝</span>
    <span class="blog-btn-text">小熊的博客</span>
  </button>
  
  <div class="controls-container">
    <button class="particle-toggle" onclick="toggleParticles()" aria-label="暂停/开启粒子">
      <span class="particle-toggle-icon" id="particleIcon">⏸️</span>
      <span class="particle-toggle-text" id="particleText">暂停粒子</span>
    </button>
    
    <button class="lang-toggle" onclick="toggleLanguage()" aria-label="切换语言">
      <span class="lang-toggle-icon">🌐</span>
      <span class="lang-toggle-text" id="langText">中文</span>
    </button>
    
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="切换主题">
      <span class="theme-toggle-icon" id="themeIcon">🌙</span>
      <span class="theme-toggle-text" id="themeText">深色模式</span>
    </button>
  </div>

  <div class="container">
    <div class="header">
      <h1 data-i18n="title">🎵 Apple Music</h1>
      <p data-i18n="subtitle">搜索和下载你喜欢的音乐</p>
    </div>

    <div class="search-box">
      <div class="search-input-wrapper">
        <input 
          type="text" 
          id="searchInput" 
          class="search-input" 
          data-i18n-placeholder="searchPlaceholder"
          placeholder="输入歌曲名称、艺术家或专辑..."
          onkeypress="handleSearchKeyPress(event)"
        />
        <button id="searchBtn" class="search-btn" data-i18n="searchButton" onclick="initiateSearch()">搜索</button>
      </div>
      <div id="turnstileContainer" class="turnstile-container"></div>
    </div>

    <div id="messageContainer"></div>
    <div id="resultsContainer" class="results-container"></div>
  </div>

  <div id="playerContainer" class="player-container">
    <div class="player-content">
      <img id="playerArtwork" class="player-artwork" src="" alt="">
      <div class="player-info">
        <div id="playerTitle" class="player-title"></div>
        <div id="playerArtist" class="player-artist"></div>
      </div>
      <div class="player-controls">
        <button class="player-btn" onclick="togglePlay()">
          <span id="playPauseIcon">▶️</span>
        </button>
        <audio id="audioPlayer"></audio>
      </div>
      <button class="close-player-btn" data-i18n="closeButton" onclick="closePlayer()">关闭</button>
    </div>
  </div>

  <div id="modalOverlay" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-title" data-i18n="modalTitle">选择下载格式</div>
      <div class="format-selector">
        <label for="codecSelect" data-i18n="codecLabel">音频编码：</label>
        <select id="codecSelect">
          <option value="aac-legacy">AAC 256kbps (推荐)</option>
          <option value="aac-he-legacy">AAC-HE 64kbps</option>
          <option value="aac">AAC 256kbps (48kHz)</option>
        </select>
      </div>
      <div class="format-selector">
        <label for="formatSelect" data-i18n="formatLabel">文件格式：</label>
        <select id="formatSelect">
          <option value="m4a">M4A - 原始格式（推荐，最快）</option>
          <option value="mp3">MP3 - 320kbps（通用格式）</option>
          <option value="wav">WAV - 无损格式（文件较大）</option>
          <option value="flac">FLAC - 无损压缩（高质量）</option>
          <option value="aac">AAC - 256kbps（高质量）</option>
          <option value="ogg">OGG - Vorbis（开源格式）</option>
          <option value="opus">OPUS - 256kbps（新一代编码）</option>
        </select>
      </div>
      <div style="margin-top: 15px; padding: 12px 15px; background: var(--highlight-bg); border-left: 4px solid var(--highlight-border); border-radius: 8px; font-size: 0.85rem; color: var(--text-secondary); transition: all 0.3s ease;">
        <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">💡 格式说明</div>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          <li><strong>M4A</strong>：原始格式，无需转换，速度最快</li>
          <li><strong>MP3</strong>：通用格式，兼容所有设备</li>
          <li><strong>WAV</strong>：无损格式，音质最佳，文件较大</li>
          <li><strong>FLAC</strong>：无损压缩，音质高，文件适中</li>
          <li><strong>其他</strong>：需要 FFmpeg 转换，耗时较长</li>
        </ul>
      </div>
      <div class="modal-actions">
        <button class="modal-btn secondary" data-i18n="cancelButton" onclick="closeModal()">取消</button>
        <button class="modal-btn primary" data-i18n="confirmButton" onclick="confirmDownload()">确认下载</button>
      </div>
    </div>
  </div>

  <div class="footer">
    <p data-i18n="disclaimer">本服务仅供学习研究使用，请勿用于商业用途</p>
    <p><a href="/disclaimer" target="_blank" data-i18n="disclaimerLink">查看免责声明</a></p>
  </div>

  <div id="confirmOverlay" class="confirm-overlay" onclick="closeConfirm(event)">
    <div class="confirm-dialog" onclick="event.stopPropagation()">
      <div class="confirm-title">🐻 访问确认</div>
      <div class="confirm-message" id="confirmMessage">你确认要访问小熊的博客吗？</div>
      <div class="confirm-actions">
        <button class="confirm-btn secondary" onclick="closeConfirm()">取消</button>
        <button class="confirm-btn primary" onclick="confirmVisitBlog()">确认访问</button>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = '/api';
    const TURNSTILE_SITE_KEY = '${TURNSTILE_SITE_KEY}';
    
    let sessionId = null;
    let turnstileToken = null;
    let turnstileWidgetId = null;
    let currentTrackForDownload = null;
    let currentLang = 'zh'; // Default language is Chinese
    let waveScene = null;

    // Translation map
    const translations = {
      zh: {
        title: '🎵 Apple Music',
        subtitle: '搜索和下载你喜欢的音乐',
        searchPlaceholder: '输入歌曲名称、艺术家或专辑...',
        searchButton: '搜索',
        verifySuccess: '人机验证成功',
        verifyReady: '验证成功，可以开始搜索',
        verifyRequired: '请先完成人机验证',
        verifyFailed: '验证失败，正在重试...',
        verifyExpired: '验证已过期',
        searching: '搜索中...',
        noResults: '未找到相关结果',
        preparing: '准备播放中...',
        playing: '开始播放',
        preparingDownload: '准备下载中...',
        downloadStarted: '下载已开始！链接 5 分钟后失效',
        playButton: '播放',
        downloadButton: '下载',
        closeButton: '关闭',
        modalTitle: '选择下载格式',
        codecLabel: '音频编码：',
        formatLabel: '文件格式：',
        cancelButton: '取消',
        confirmButton: '确认下载',
        langSwitch: '中文',
        themeLight: '深色模式',
        themeDark: '浅色模式',
        disclaimer: '本服务仅供学习研究使用，请勿用于商业用途',
        disclaimerLink: '查看免责声明',
        searchFailed: '搜索失败，请重试',
        playFailed: '播放失败，请重试',
        downloadFailed: '下载失败，请重试',
        reVerifying: '正在重新验证，请稍候...',
        reVerifyFailed: '验证失败，请刷新页面重试',
        reVerifyRetry: '请重新点击下载',
        blogButton: '小熊的博客',
        particlePause: '暂停粒子',
        particleResume: '开启粒子',
        confirmTitle: '🐻 访问确认',
        confirmMessage: '你确认要访问小熊的博客吗？',
        confirmVisit: '确认访问'
      },
      en: {
        title: '🎵 Apple Music',
        subtitle: 'Search and download your favorite music',
        searchPlaceholder: 'Enter song name, artist or album...',
        searchButton: 'Search',
        verifySuccess: 'Verification successful',
        verifyReady: 'Verified, ready to search',
        verifyRequired: 'Please complete verification first',
        verifyFailed: 'Verification failed, retrying...',
        verifyExpired: 'Verification expired',
        searching: 'Searching...',
        noResults: 'No results found',
        preparing: 'Preparing to play...',
        playing: 'Now playing',
        preparingDownload: 'Preparing download...',
        downloadStarted: 'Download started! Link expires in 5 minutes',
        playButton: 'Play',
        downloadButton: 'Download',
        closeButton: 'Close',
        modalTitle: 'Select Download Format',
        codecLabel: 'Audio Codec:',
        formatLabel: 'File Format:',
        cancelButton: 'Cancel',
        confirmButton: 'Confirm',
        langSwitch: 'English',
        themeLight: 'Dark Mode',
        themeDark: 'Light Mode',
        disclaimer: 'For educational and research purposes only',
        disclaimerLink: 'View Disclaimer',
        searchFailed: 'Search failed, please retry',
        playFailed: 'Play failed, please retry',
        downloadFailed: 'Download failed, please retry',
        reVerifying: 'Re-verifying, please wait...',
        reVerifyFailed: 'Verification failed, please refresh the page',
        reVerifyRetry: 'Please click download again',
        blogButton: "Bear's Blog",
        particlePause: 'Pause Particles',
        particleResume: 'Resume Particles',
        confirmTitle: '🐻 Visit Confirmation',
        confirmMessage: "Do you want to visit Bear's blog?",
        confirmVisit: 'Confirm Visit'
      }
    };

    // 3D wave scene class
    class WaveScene {
      constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = null;
        this.lights = [];
        this.baseSpeed = 3 + Math.random(); // Random base speed from 3 to 4
        this.waveSpeed = this.baseSpeed;
        this.waveDensity = 1.0;
        this.scrollVelocity = 0;
        this.lastScrollY = 0;
        this.lastScrollTime = Date.now();
        this.colorIndex = 0;
        this.time = 0;
        this.isPaused = false; // Particle animation pause flag
        this.scrollTween = null; // Scroll animation reference
        this.resetTween = null; // Reset animation reference
        this.scrollTimeout = null; // Scroll timeout timer
        this.baseSpeedTween = null; // Base speed transition reference
        
        // Surreal colors independent from the active theme
        this.colors = [
          0xFF6B9D, 0xFF8A5B, 0xFFA94D, 0xFFD93D, 0xFFE66D,
          0xF4E04D, 0xFFB627, 0xFF8C42, 0xFF6F61, 0xFF5252,
          0xE74C3C, 0xC0392B, 0x9B59B6, 0x8E44AD, 0x6C5CE7,
          0xA29BFE, 0x00CEC9, 0x00B894, 0x55EFC4, 0x74B9FF,
          0x81ECEC, 0x74F2CE, 0xA8E6CF, 0xFFD3B6, 0xFD79A8,
          0xFDCB6E, 0x6C5CE7, 0x00B894, 0xA29BFE, 0x74B9FF,
          0x55EFC4, 0xFD79A8, 0xFF9FF3, 0xFECA57, 0x48DBFB,
          0x1DD1A1, 0xF368E0, 0xFF6348, 0xFFBE76, 0x00D2D3
        ];
      }
      
      init() {
        const container = document.getElementById('waveCanvas');
        
        // Create the scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 100, 300);
        
        // Create the camera
        this.camera = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        this.camera.position.set(0, 60, 120);
        this.camera.lookAt(0, 0, 0);
        
        // Create the renderer
        this.renderer = new THREE.WebGLRenderer({ 
          alpha: true,
          antialias: window.innerWidth > 768,
          powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);
        
        // Add lights
        this.addLights();
        
        // Create the particle system
        this.createParticles();
        
        // Register events
        window.addEventListener('scroll', () => this.onScroll(), { passive: true });
        window.addEventListener('resize', () => this.onResize(), { passive: true });
        
        // Periodically switch the base speed between 3 and 4
        setInterval(() => {
          const newBaseSpeed = 3 + Math.random();
          
          // Stop the previous base speed animation
          if (this.baseSpeedTween) {
            this.baseSpeedTween.kill();
          }
          
          this.baseSpeedTween = gsap.to(this, {
            baseSpeed: newBaseSpeed,
            duration: 3,
            ease: 'power1.inOut',
            overwrite: false, // Do not overwrite scroll animation
            onUpdate: () => {
              // Sync waveSpeed only when not scrolling
              if (!this.scrollTween || !this.scrollTween.isActive()) {
                if (Math.abs(this.waveSpeed - this.baseSpeed) < 0.1) {
                  this.waveSpeed = this.baseSpeed;
                }
              }
            }
          });
        }, 8000); // Switch every 8 seconds
        
        // Start animation
        this.animate();
      }
      
      addLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);
        
        // Point light 1 - warm tone
        const pointLight1 = new THREE.PointLight(0xff6b9d, 2, 200);
        pointLight1.position.set(50, 50, 50);
        this.scene.add(pointLight1);
        this.lights.push(pointLight1);
        
        // Point light 2 - cool tone
        const pointLight2 = new THREE.PointLight(0x74b9ff, 2, 200);
        pointLight2.position.set(-50, 50, -50);
        this.scene.add(pointLight2);
        this.lights.push(pointLight2);
        
        // Point light 3 - neutral tone
        const pointLight3 = new THREE.PointLight(0xffd93d, 1.5, 150);
        pointLight3.position.set(0, 80, 0);
        this.scene.add(pointLight3);
        this.lights.push(pointLight3);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 100, 100);
        this.scene.add(directionalLight);
        this.lights.push(directionalLight);
      }
      
      createParticles() {
        const isMobile = window.innerWidth < 768;
        const particleCount = isMobile ? 6000 : 20000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        const gridSize = Math.sqrt(particleCount);
        const spacing = isMobile ? 4 : 3;
        
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const x = (i % gridSize) * spacing - (gridSize * spacing) / 2;
          const z = Math.floor(i / gridSize) * spacing - (gridSize * spacing) / 2;
          const y = 0;
          
          positions[i3] = x;
          positions[i3 + 1] = y;
          positions[i3 + 2] = z;
          
          // Initial color
          const color = new THREE.Color(this.colors[i % this.colors.length]);
          colors[i3] = color.r;
          colors[i3 + 1] = color.g;
          colors[i3 + 2] = color.b;
          
          // Particle size
          sizes[i] = isMobile ? 2 : 3;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
          size: isMobile ? 2 : 3,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
          depthWrite: false
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
      }
      
      onScroll() {
        const now = Date.now();
        const deltaY = Math.abs(window.scrollY - this.lastScrollY);
        const deltaTime = now - this.lastScrollTime;
        
        if (deltaTime > 0 && deltaY > 0) {
          // Calculate scroll velocity in pixels per millisecond
          const velocity = deltaY / deltaTime;
          const scrollBoost = Math.min(velocity * 8, 6 - this.baseSpeed); // Keep total speed at or below 6
          
          // Stop previous animations to avoid conflicts
          if (this.scrollTween) {
            this.scrollTween.kill();
          }
          if (this.resetTween) {
            this.resetTween.kill();
          }
          
          // Clear the previous reset timer
          if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
          }
          
          // Smoothly transition to the target speed, capped at 6
          this.scrollTween = gsap.to(this, {
            waveSpeed: this.baseSpeed + scrollBoost,
            waveDensity: 1.0 + scrollBoost * 0.4,
            duration: 0.3,
            ease: 'power2.out',
            overwrite: 'auto' // Automatically overwrite conflicting animations
          });
          
          // Set a new reset timer after scrolling stops
          this.scrollTimeout = setTimeout(() => {
            // Gradually return to base speed after scrolling stops
            this.resetTween = gsap.to(this, {
              waveSpeed: this.baseSpeed,
              waveDensity: 1.0,
              duration: 2,
              ease: 'power2.inOut',
              overwrite: 'auto'
            });
          }, 200); // Start recovery 200ms after scrolling stops
        }
        
        this.lastScrollY = window.scrollY;
        this.lastScrollTime = now;
      }
      
      onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
      
      animate() {
        requestAnimationFrame(() => this.animate());
        
        // If paused, render the current frame without updating animation
        if (this.isPaused) {
          this.renderer.render(this.scene, this.camera);
          return;
        }
        
        // Keep speed and density in safe ranges during fast scrolling
        this.waveSpeed = Math.max(0, Math.min(this.waveSpeed, 6));
        this.waveDensity = Math.max(0.5, Math.min(this.waveDensity, 3));
        
        this.time += 0.01 * this.waveSpeed;
        const positions = this.particles.geometry.attributes.position.array;
        const colors = this.particles.geometry.attributes.color.array;
        
        // Time-driven color changes
        this.colorIndex = (this.colorIndex + 0.0002) % 1.0;
        
        // Looping wave effect
        for (let i = 0; i < positions.length / 3; i++) {
          const i3 = i * 3;
          const x = positions[i3];
          const z = positions[i3 + 2];
          
          // Multi-layer looping wave effect
          // Wave 1: left-right flow
          const wave1 = Math.sin(x * 0.05 * this.waveDensity + this.time) * 10;
          // Wave 2: front-back flow
          const wave2 = Math.cos(z * 0.05 * this.waveDensity + this.time * 0.7) * 8;
          // Wave 3: diagonal flow
          const wave3 = Math.sin((x + z) * 0.03 * this.waveDensity + this.time * 0.5) * 6;
          // Wave 4: cross flow
          const wave4 = Math.cos((x - z) * 0.02 * this.waveDensity + this.time * 0.3) * 4;
          
          // Y position is the sum of multiple looping waves
          positions[i3 + 1] = wave1 + wave2 + wave3 + wave4;
          
          // Color gradient based on position and time
          const colorOffset = (i / (positions.length / 3) + this.colorIndex) % 1.0;
          const localColorPos = colorOffset * (this.colors.length - 1);
          const localIdx1 = Math.floor(localColorPos) % this.colors.length;
          const localIdx2 = (localIdx1 + 1) % this.colors.length;
          const localMix = localColorPos - Math.floor(localColorPos);
          
          const localColor1 = new THREE.Color(this.colors[localIdx1]);
          const localColor2 = new THREE.Color(this.colors[localIdx2]);
          const finalColor = localColor1.clone().lerp(localColor2, localMix);
          
          colors[i3] = finalColor.r;
          colors[i3 + 1] = finalColor.g;
          colors[i3 + 2] = finalColor.b;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
        
        // Subtle camera movement to enhance the looping visual effect
        this.camera.position.x = Math.sin(this.time * 0.05) * 15;
        this.camera.position.y = 60 + Math.cos(this.time * 0.03) * 10;
        this.camera.lookAt(0, 0, 0);
        
        // Light animation to enhance the looping lighting effect
        if (this.lights.length >= 3) {
          this.lights[1].position.x = Math.sin(this.time * 0.1) * 60;
          this.lights[1].position.z = Math.cos(this.time * 0.1) * 60;
          this.lights[2].position.x = Math.cos(this.time * 0.15) * 60;
          this.lights[2].position.z = Math.sin(this.time * 0.15) * 60;
        }
        
        this.renderer.render(this.scene, this.camera);
      }
    }

    // Initialize
    console.log('[前端] JavaScript 开始执行');
    
    window.addEventListener('DOMContentLoaded', () => {
      console.log('[前端] DOM 加载完成');
      
      // Initialize theme
      loadThemePreference();
      console.log('[前端] 主题加载完成');
      
      // Initialize the 3D scene
      if (typeof THREE !== 'undefined') {
        waveScene = new WaveScene();
        waveScene.init();
        console.log('[前端] 3D 波浪场景初始化完成');
      } else {
        console.error('[前端] Three.js 未加载');
      }
      
      // Render Turnstile
      renderTurnstile();
      console.log('[前端] Turnstile 渲染函数已调用');
      
      // Add touch feedback
      addTouchFeedbackToButtons();
    });

    // Language switch
    function toggleLanguage() {
      const newLang = currentLang === 'zh' ? 'en' : 'zh';
      
      // Update all elements with data-i18n
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[newLang][key]) {
          animateTextChange(el, translations[newLang][key]);
        }
      });
      
      // Update placeholders
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[newLang][key]) {
          el.placeholder = translations[newLang][key];
        }
      });
      
      currentLang = newLang;
      document.getElementById('langText').textContent = translations[newLang].langSwitch;
    }

    function animateTextChange(element, newText) {
      const oldText = element.textContent;
      
      if (oldText === newText) return;
      
      // GSAP animation
      gsap.to(element, {
        opacity: 0,
        y: -10,
        duration: 0.2,
        onComplete: () => {
          element.textContent = newText;
          gsap.fromTo(element, 
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.7)' }
          );
        }
      });
    }

    // Theme switch
    function toggleTheme() {
      const body = document.body;
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Update button icon and text
      const icon = document.getElementById('themeIcon');
      const text = document.getElementById('themeText');
      
      if (newTheme === 'dark') {
        icon.textContent = '☀️';
        text.textContent = translations[currentLang].themeDark;
      } else {
        icon.textContent = '🌙';
        text.textContent = translations[currentLang].themeLight;
      }

      // GSAP animation effect
      gsap.from(body, {
        opacity: 0.8,
        duration: 0.3,
        ease: 'power2.inOut'
      });
    }

    // Load theme preference
    function loadThemePreference() {
      console.log('[前端] 加载主题偏好');
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = savedTheme || (prefersDark ? 'dark' : 'light');
      console.log('[前端] 当前主题:', theme);
      
      document.body.setAttribute('data-theme', theme);
      
      const icon = document.getElementById('themeIcon');
      const text = document.getElementById('themeText');
      
      if (theme === 'dark') {
        icon.textContent = '☀️';
        text.textContent = translations[currentLang].themeDark;
      } else {
        icon.textContent = '🌙';
        text.textContent = translations[currentLang].themeLight;
      }
    }

    // Open blog confirmation dialog
    function openBlogConfirm() {
      const overlay = document.getElementById('confirmOverlay');
      const message = document.getElementById('confirmMessage');
      message.textContent = translations[currentLang].confirmMessage;
      overlay.classList.add('active');
      
      gsap.from('.confirm-dialog', {
        scale: 0.8,
        opacity: 0,
        duration: 0.3,
        ease: 'back.out'
      });
    }

    // Close confirmation dialog
    function closeConfirm(event) {
      if (event && event.target !== event.currentTarget) {
        return;
      }
      document.getElementById('confirmOverlay').classList.remove('active');
    }

    // Confirm blog visit
    function confirmVisitBlog() {
      window.open('https://example.com', '_blank');
      closeConfirm();
    }

    // Toggle particle animation
    function toggleParticles() {
      if (!waveScene) return;
      
      waveScene.isPaused = !waveScene.isPaused;
      
      const icon = document.getElementById('particleIcon');
      const text = document.getElementById('particleText');
      const button = document.querySelector('.particle-toggle');
      
      if (waveScene.isPaused) {
        icon.textContent = '▶️';
        text.textContent = translations[currentLang].particleResume;
        button.classList.add('paused');
      } else {
        icon.textContent = '⏸️';
        text.textContent = translations[currentLang].particlePause;
        button.classList.remove('paused');
      }
    }

    // Touch feedback
    function addTouchFeedbackToButtons() {
      const buttons = document.querySelectorAll('.action-btn, .search-btn, .player-btn, .close-player-btn, .modal-btn, .lang-toggle, .theme-toggle, .blog-btn, .particle-toggle, .confirm-btn');
      
      buttons.forEach(button => {
        button.addEventListener('touchstart', function(e) {
          gsap.to(this, { scale: 0.95, duration: 0.1 });
        }, { passive: true });
        
        button.addEventListener('touchend', function(e) {
          gsap.to(this, { scale: 1, duration: 0.1 });
        }, { passive: true });
      });
    }

    // Render Turnstile verification
    function renderTurnstile() {
      console.log('[前端] renderTurnstile 被调用');
      
      if (typeof turnstile === 'undefined') {
        console.log('[前端] Turnstile 脚本未加载，100ms 后重试...');
        setTimeout(renderTurnstile, 100);
        return;
      }

      console.log('[前端] Turnstile 脚本已加载，开始渲染');
      console.log('[前端] TURNSTILE_SITE_KEY:', TURNSTILE_SITE_KEY);
      
      try {
        turnstileWidgetId = turnstile.render('#turnstileContainer', {
          sitekey: TURNSTILE_SITE_KEY,
          callback: onTurnstileSuccess,
          'expired-callback': onTurnstileExpired,
          'error-callback': onTurnstileError,
        });
        console.log('[前端] Turnstile 组件已渲染，Widget ID:', turnstileWidgetId);
      } catch (error) {
        console.error('[前端] Turnstile 渲染失败:', error);
      }
    }

    // Turnstile verification success
    async function onTurnstileSuccess(token) {
      turnstileToken = token;
      showMessage(translations[currentLang].verifySuccess, 'success');
      
      // Verify the token and get a session ID automatically
      try {
        console.log('[前端] 开始验证 Turnstile 令牌...');
        const response = await fetch(\`\${API_BASE}/verify-turnstile\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token })
        });

        console.log('[前端] 收到验证响应:', response.status, response.statusText);
        const data = await response.json();
        console.log('[前端] 验证数据:', data);
        
        if (data.success) {
          sessionId = data.session_id;
          console.log('[前端] 会话 ID:', sessionId);
          showMessage(translations[currentLang].verifyReady, 'success');
        } else {
          console.error('[前端] 验证失败:', data);
          showMessage(translations[currentLang].verifyFailed + (data.message || ''), 'error');
        }
      } catch (error) {
        console.error('[前端] 验证异常:', error);
        showMessage(translations[currentLang].verifyFailed, 'error');
      }
    }

    // Turnstile verification expired
    function onTurnstileExpired() {
      turnstileToken = null;
      sessionId = null;
      console.log('[前端] ' + translations[currentLang].verifyExpired);
    }

    // Turnstile verification error
    function onTurnstileError(error) {
      console.error('[前端] Turnstile 验证出错:', error);
      showMessage(translations[currentLang].verifyFailed, 'error');
      // Retry automatically
      setTimeout(() => {
        console.log('[前端] 自动重试 Turnstile 验证');
        if (turnstileWidgetId) {
          turnstile.reset(turnstileWidgetId);
        }
      }, 2000);
    }

    // Wait for session creation
    function waitForSession() {
      return new Promise((resolve) => {
        if (sessionId) {
          resolve();
          return;
        }

        // Wait up to 30 seconds
        const maxWaitTime = 30000;
        const checkInterval = 500;
        let waited = 0;

        const intervalId = setInterval(() => {
          waited += checkInterval;
          
          if (sessionId) {
            clearInterval(intervalId);
            resolve();
          } else if (waited >= maxWaitTime) {
            clearInterval(intervalId);
            resolve();
          }
        }, checkInterval);
      });
    }

    // Handle search key presses
    function handleSearchKeyPress(event) {
      if (event.key === 'Enter') {
        initiateSearch();
      }
    }

    // Start search
    function initiateSearch() {
      if (!sessionId) {
        showMessage(translations[currentLang].verifyRequired, 'error');
        return;
      }

      const query = document.getElementById('searchInput').value.trim();
      if (!query) {
        showMessage(translations[currentLang].verifyRequired, 'error');
        return;
      }

      performSearch(query);
    }

    // Execute search
    async function performSearch(query) {
      const resultsContainer = document.getElementById('resultsContainer');
      resultsContainer.innerHTML = '<div class="search-box loading"><div class="spinner"></div><p>' + translations[currentLang].searching + '</p></div>';

      try {
        console.log('[前端] 开始搜索:', query);
        console.log('[前端] 会话 ID:', sessionId);
        const searchUrl = \`\${API_BASE}/search?q=\${encodeURIComponent(query)}&types=songs&limit=25\`;
        console.log('[前端] 搜索 URL:', searchUrl);
        
        const response = await fetch(searchUrl, {
          headers: {
            'X-Session-ID': sessionId
          }
        });

        console.log('[前端] 搜索响应:', response.status, response.statusText);

        if (response.status === 401) {
          // Session expired; re-verify automatically
          showMessage(translations[currentLang].reVerifying, 'info');
          sessionId = null;
          turnstile.reset(turnstileWidgetId);
          await waitForSession();
          if (sessionId) {
            // Run the search again
            return performSearch(query);
          } else {
            showMessage(translations[currentLang].reVerifyFailed, 'error');
            resultsContainer.innerHTML = '';
            return;
          }
        }

        const data = await response.json();
        
        if (data.songs && data.songs.length > 0) {
          displayResults(data.songs);
        } else {
          resultsContainer.innerHTML = '<div class="search-box"><p style="color: var(--text-secondary); text-align: center;">' + translations[currentLang].noResults + '</p></div>';
        }
      } catch (error) {
        console.error('搜索失败：', error);
        showMessage(translations[currentLang].searchFailed, 'error');
        resultsContainer.innerHTML = '';
      }
    }

    // Render search results
    function displayResults(songs) {
      const resultsContainer = document.getElementById('resultsContainer');
      resultsContainer.innerHTML = '';

      songs.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.opacity = '0';
        
        // Create card content
        card.innerHTML = \`
          <img src="\${song.artwork_url || '/placeholder.png'}" alt="\${escapeHtml(song.title)}" class="result-artwork" loading="lazy">
          <div class="result-info">
            <div class="result-title">\${escapeHtml(song.title)}</div>
            <div class="result-artist">\${escapeHtml(song.artist)}</div>
            \${song.album ? \`<div class="result-album">\${escapeHtml(song.album)}</div>\` : ''}
          </div>
          <div class="result-actions">
            <button class="action-btn play-btn" data-track-id="\${song.id}" data-track-title="\${escapeHtml(song.title)}" data-track-artist="\${escapeHtml(song.artist)}" data-track-artwork="\${song.artwork_url || ''}">\${translations[currentLang].playButton}</button>
            <button class="action-btn download-btn" data-track-id="\${song.id}" data-track-title="\${escapeHtml(song.title)}" data-track-artist="\${escapeHtml(song.artist)}">\${translations[currentLang].downloadButton}</button>
          </div>
        \`;
        
        resultsContainer.appendChild(card);
        
        // Add event listeners through safer event delegation
        const playBtn = card.querySelector('.play-btn');
        const downloadBtn = card.querySelector('.download-btn');
        
        playBtn.addEventListener('click', function() {
          const trackId = this.getAttribute('data-track-id');
          const title = this.getAttribute('data-track-title');
          const artist = this.getAttribute('data-track-artist');
          const artwork = this.getAttribute('data-track-artwork');
          playTrack(trackId, title, artist, artwork);
        });
        
        downloadBtn.addEventListener('click', function() {
          const trackId = this.getAttribute('data-track-id');
          const title = this.getAttribute('data-track-title');
          const artist = this.getAttribute('data-track-artist');
          openDownloadModal(trackId, title, artist);
        });

        // GSAP animation
        gsap.to(card, {
          opacity: 1,
          y: 0,
          duration: 0.5,
          delay: index * 0.05,
          ease: 'power2.out'
        });
      });
      
      // Add touch feedback to newly created buttons
      addTouchFeedbackToButtons();
    }

    // Play track
    async function playTrack(trackId, title, artist, artworkUrl) {
      if (!sessionId) {
        showMessage(translations[currentLang].reVerifying, 'info');
        await waitForSession();
        if (!sessionId) {
          showMessage(translations[currentLang].reVerifyFailed, 'error');
          return;
        }
      }

      showMessage(translations[currentLang].preparing, 'info');

      try {
        const response = await fetch(\`\${API_BASE}/prepare-play\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({
            track_id: trackId,
            codec: 'aac-legacy'
          })
        });

        if (response.status === 401) {
          // Session expired; re-verify automatically
          showMessage(translations[currentLang].reVerifying, 'info');
          sessionId = null;
          turnstile.reset(turnstileWidgetId);
          await waitForSession();
          if (sessionId) {
            // Try playback again
            return playTrack(trackId, title, artist, artworkUrl);
          } else {
            showMessage(translations[currentLang].reVerifyFailed, 'error');
            return;
          }
        }

        const data = await response.json();
        
        if (data.stream_url) {
          showPlayer(title, artist, artworkUrl, data.stream_url);
          showMessage(translations[currentLang].playing, 'success');
        } else {
          showMessage(translations[currentLang].playFailed, 'error');
        }
      } catch (error) {
        console.error('播放失败：', error);
        showMessage(translations[currentLang].playFailed, 'error');
      }
    }

    // Show player
    function showPlayer(title, artist, artworkUrl, streamUrl) {
      document.getElementById('playerTitle').textContent = title;
      document.getElementById('playerArtist').textContent = artist;
      document.getElementById('playerArtwork').src = artworkUrl;
      
      const audioPlayer = document.getElementById('audioPlayer');
      audioPlayer.src = streamUrl;
      audioPlayer.play();
      
      const playerContainer = document.getElementById('playerContainer');
      playerContainer.classList.add('active');

      gsap.from(playerContainer, {
        x: -100,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out'
      });
    }

    // Toggle play/pause
    function togglePlay() {
      const audioPlayer = document.getElementById('audioPlayer');
      const playPauseIcon = document.getElementById('playPauseIcon');
      
      if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseIcon.textContent = '⏸️';
      } else {
        audioPlayer.pause();
        playPauseIcon.textContent = '▶️';
      }
    }

    // Close player
    function closePlayer() {
      const audioPlayer = document.getElementById('audioPlayer');
      audioPlayer.pause();
      audioPlayer.src = '';
      
      const playerContainer = document.getElementById('playerContainer');
      playerContainer.classList.remove('active');
    }

    // Open download modal
    function openDownloadModal(trackId, title, artist) {
      currentTrackForDownload = { trackId, title, artist };
      document.getElementById('modalOverlay').classList.add('active');
      
      gsap.from('.modal-content', {
        scale: 0.8,
        opacity: 0,
        duration: 0.3,
        ease: 'back.out'
      });
    }

    // Close modal
    function closeModal(event) {
      if (event && event.target !== event.currentTarget && !event.target.classList.contains('secondary')) {
        return;
      }
      document.getElementById('modalOverlay').classList.remove('active');
      currentTrackForDownload = null;
    }

    // Confirm download
    async function confirmDownload() {
      if (!currentTrackForDownload) {
        showMessage(translations[currentLang].downloadFailed, 'error');
        closeModal();
        return;
      }

      if (!sessionId) {
        showMessage(translations[currentLang].reVerifying, 'info');
        await waitForSession();
        if (!sessionId) {
          showMessage(translations[currentLang].reVerifyFailed, 'error');
          closeModal();
          return;
        }
      }

      const codec = document.getElementById('codecSelect').value;
      const format = document.getElementById('formatSelect').value;
      
      // Store current track data locally before closeModal clears it
      const trackInfo = {
        trackId: currentTrackForDownload.trackId,
        title: currentTrackForDownload.title,
        artist: currentTrackForDownload.artist
      };

      closeModal();
      showMessage(translations[currentLang].preparingDownload, 'info');

      try {
        const response = await fetch(\`\${API_BASE}/prepare-download\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({
            track_id: trackInfo.trackId,
            codec: codec,
            format: format
          })
        });

        if (response.status === 401) {
          // Session expired; re-verify automatically
          showMessage(translations[currentLang].reVerifying, 'info');
          sessionId = null;
          turnstile.reset(turnstileWidgetId);
          await waitForSession();
          if (sessionId) {
            // Reopen the download modal and retry
            openDownloadModal(trackInfo.trackId, trackInfo.title, trackInfo.artist);
            showMessage(translations[currentLang].reVerifyRetry, 'info');
            return;
          } else {
            showMessage(translations[currentLang].reVerifyFailed, 'error');
            return;
          }
        }

        const data = await response.json();
        
        if (data.download_url) {
          // Create the download link
          const link = document.createElement('a');
          link.href = data.download_url;
          link.download = data.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showMessage(translations[currentLang].downloadStarted, 'success');
        } else {
          showMessage(translations[currentLang].downloadFailed, 'error');
        }
      } catch (error) {
        console.error('下载失败：', error);
        showMessage(translations[currentLang].downloadFailed, 'error');
      }
    }

    // Show message
    function showMessage(message, type = 'info') {
      const container = document.getElementById('messageContainer');
      const messageDiv = document.createElement('div');
      messageDiv.className = \`message \${type}\`;
      messageDiv.textContent = message;
      
      container.innerHTML = '';
      container.appendChild(messageDiv);

      gsap.from(messageDiv, {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: 'power2.out'
      });

      setTimeout(() => {
        gsap.to(messageDiv, {
          opacity: 0,
          y: -20,
          duration: 0.3,
          onComplete: () => messageDiv.remove()
        });
      }, 5000);
    }

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Listen for audio playback state changes
    document.getElementById('audioPlayer').addEventListener('play', () => {
      document.getElementById('playPauseIcon').textContent = '⏸️';
    });

    document.getElementById('audioPlayer').addEventListener('pause', () => {
      document.getElementById('playPauseIcon').textContent = '▶️';
    });
  </script>
</body>
</html>`;
}

/**
 * Disclaimer page.
 */
function getDisclaimerPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>免责声明 - Apple Music 搜索下载</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-gradient-start: #667eea;
      --bg-gradient-end: #764ba2;
      --text-primary: #333333;
      --text-secondary: #555555;
      --text-tertiary: #999999;
      --card-bg: #ffffff;
      --card-shadow: rgba(0, 0, 0, 0.3);
      --border-color: #e0e0e0;
      --highlight-bg: #fff3cd;
      --highlight-border: #ffc107;
    }

    [data-theme="dark"] {
      --bg-primary: #0a0a0a;
      --bg-gradient-start: #667eea;
      --bg-gradient-end: #764ba2;
      --text-primary: #ffffff;
      --text-secondary: #b0b0b0;
      --text-tertiary: #808080;
      --card-bg: #1a1a1a;
      --card-shadow: rgba(0, 0, 0, 0.6);
      --border-color: #333333;
      --highlight-bg: rgba(255, 193, 7, 0.15);
      --highlight-border: #ffc107;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg-primary);
      min-height: 100vh;
      padding: 40px 20px;
      position: relative;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 300px;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      z-index: -1;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 60px var(--card-shadow);
      position: relative;
      transition: all 0.3s ease;
    }

    .theme-toggle {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(102, 126, 234, 0.2);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(102, 126, 234, 0.3);
      border-radius: 50%;
      width: 45px;
      height: 45px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      font-size: 1.3rem;
    }

    .theme-toggle:hover {
      transform: translateY(-2px) rotate(20deg);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
      background: rgba(102, 126, 234, 0.3);
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 30px;
      color: var(--text-primary);
      text-align: center;
      transition: color 0.3s ease;
    }

    .content {
      line-height: 1.8;
      color: var(--text-secondary);
      font-size: 1rem;
      transition: color 0.3s ease;
    }

    .content p {
      margin-bottom: 20px;
    }

    .content strong {
      color: var(--text-primary);
      font-weight: 600;
    }

    .highlight {
      background: var(--highlight-bg);
      border-left: 4px solid var(--highlight-border);
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 5px;
      transition: all 0.3s ease;
    }

    .back-link {
      display: inline-block;
      margin-top: 30px;
      padding: 12px 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 10px;
      transition: all 0.3s;
    }

    .back-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      color: var(--text-tertiary);
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }
  </style>
</head>
<body data-theme="light">
  <div class="container">
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="切换主题">
      <span id="themeIcon">🌙</span>
    </button>
    <h1>免责声明</h1>
    
    <div class="content">
      <div class="highlight">
        <strong>重要提示：</strong>本网站提供的服务仅供个人学习、研究和技术交流使用，严禁用于任何商业目的。
      </div>

      <p><strong>1. 服务性质</strong></p>
      <p>本网站（以下简称"本站"）是一个技术演示项目，旨在展示 Apple Music API 的技术应用能力。本站所提供的音乐搜索和下载功能仅供学习和研究目的使用。</p>

      <p><strong>2. 版权声明</strong></p>
      <p>所有通过本站搜索和访问的音乐内容均来自 Apple Music 官方服务，版权归相应的唱片公司、艺术家和版权所有者所有。用户下载的任何内容应遵守当地法律法规和版权法律。</p>

      <p><strong>3. 用户责任</strong></p>
      <p>用户在使用本站服务时，应确保其行为符合所在国家或地区的法律法规。用户对使用本站服务产生的任何后果承担全部责任，包括但不限于版权侵权、违反服务条款等行为。</p>

      <p><strong>4. 服务限制</strong></p>
      <p>本站不保证服务的持续可用性、准确性或完整性。本站保留随时修改、暂停或终止服务的权利，无需事先通知用户。</p>

      <p><strong>5. 免责条款</strong></p>
      <p>本站对用户使用服务产生的任何直接或间接损失、损害不承担任何责任。本站不对用户的违法行为负责，用户因违反法律法规而产生的一切法律责任由用户自行承担。</p>

      <p><strong>6. 法律适用</strong></p>
      <p>本免责声明受中华人民共和国法律管辖。如本声明的任何条款与适用法律相冲突，以法律规定为准。</p>

      <div class="highlight">
        <strong>特别提醒：</strong>请尊重音乐创作者的劳动成果，支持正版音乐。如需长期使用，请订阅 Apple Music 官方服务。
      </div>

      <p style="text-align: center;">
        <a href="/" class="back-link">返回首页</a>
      </p>
    </div>

    <div class="footer">
      <p>最后更新时间：2025年1月</p>
      <p>使用本站服务即表示您已阅读并同意本免责声明</p>
    </div>
  </div>

  <script>
    // Load theme
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.body.setAttribute('data-theme', theme);

    // Update icon
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // Toggle theme
    function toggleTheme() {
      const body = document.body;
      const currentTheme = body.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      const icon = document.getElementById('themeIcon');
      icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
  </script>
</body>
</html>`;
}

