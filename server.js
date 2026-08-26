/**
 * 贤霖科技官网 - 本地服务器（数据 + 后台管理 API）
 *
 * 启动方式：
 *   node server.js
 *
 * 功能：
 *   1. 静态文件服务（HTML/CSS/JS/图片），预览网站
 *   2. 产品 / 新闻数据的增删改查（数据持久化到 data/*.json）
 *   3. 图片上传（保存到 images/uploads/）
 *   4. 后台管理登录验证（密码存于 data/config.json）
 *
 * 默认端口：8080（可通过环境变量 PORT 修改）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'images', 'uploads');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const TOKEN_TTL = 1000 * 60 * 60 * 12; // token 有效期 12 小时
const STATS_SESSION_DAYS = 14; // 会话明细保留天数
const STATS_DAY_DAYS = 90; // 按日汇总保留天数

// ---------- 数据文件读写 ----------
function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(path.join(DATA_DIR, 'products.json'))) {
    fs.writeFileSync(path.join(DATA_DIR, 'products.json'), '[]', 'utf8');
  }
  if (!fs.existsSync(path.join(DATA_DIR, 'news.json'))) {
    fs.writeFileSync(path.join(DATA_DIR, 'news.json'), '[]', 'utf8');
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ password: 'admin123' }, null, 2), 'utf8');
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

// ---------- 登录 token ----------
const tokens = new Map(); // token -> expireTime

function getConfig() {
  return readJson('config.json', { password: 'admin123' });
}

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}

function isAuthed(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !tokens.has(token)) return false;
  if (tokens.get(token) < Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}

// ---------- 工具 ----------
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > (limitBytes || 30 * 1024 * 1024)) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------- 访问统计 ----------
// 结构：{ sessions: { sid: {ip, ua, page, firstVisit, lastActive, dur} }, days: { 'YYYY-MM-DD': {pv, uv, pages:{}, durTotal, durCount} } }
let stats = { sessions: {}, days: {} };
let statsDirty = false;
let statsFlushTimer = null;

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayKey() { return dayKey(Date.now()); }

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch (e) {}
  if (!stats || typeof stats !== 'object') stats = { sessions: {}, days: {} };
  if (!stats.sessions) stats.sessions = {};
  if (!stats.days) stats.days = {};
}

function flushStats(force) {
  if (!statsDirty && !force) return;
  // 清理过期数据
  const cutoffSession = Date.now() - STATS_SESSION_DAYS * 86400000;
  const cutoffDay = Date.now() - STATS_DAY_DAYS * 86400000;
  for (const k in stats.sessions) {
    if ((stats.sessions[k].firstVisit || 0) < cutoffSession) delete stats.sessions[k];
  }
  for (const k in stats.days) {
    if (new Date(k + 'T00:00:00').getTime() < cutoffDay) delete stats.days[k];
  }
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats), 'utf8');
    statsDirty = false;
  } catch (e) {}
}

function scheduleFlush() {
  statsDirty = true;
  if (!statsFlushTimer) {
    statsFlushTimer = setTimeout(() => { statsFlushTimer = null; flushStats(false); }, 30000);
  }
}

function recordStat(type, body, req) {
  if (!body || typeof body !== 'object') return;
  const sid = String(body.sid || '').slice(0, 64);
  const page = String(body.page || '/').slice(0, 200);
  if (!sid) return;
  const now = Date.now();
  const dk = dayKey(now);
  if (!stats.days[dk]) stats.days[dk] = { pv: 0, uv: 0, pages: {}, durTotal: 0, durCount: 0 };
  const day = stats.days[dk];

  if (type === 'visit') {
    const first = !stats.sessions[sid] || !stats.sessions[sid].firstVisit;
    if (first) day.uv += 1; // 每天首个请求的会话计入当日 UV
    day.pv += 1;
    day.pages[page] = (day.pages[page] || 0) + 1;
    stats.sessions[sid] = {
      ip: (req.socket && req.socket.remoteAddress) || '',
      ua: String(req.headers['user-agent'] || '').slice(0, 160),
      page,
      firstVisit: (stats.sessions[sid] && stats.sessions[sid].firstVisit) || now,
      lastActive: now,
      dur: stats.sessions[sid] ? (stats.sessions[sid].dur || 0) : 0
    };
    scheduleFlush();
  } else if (type === 'heartbeat') {
    const s = stats.sessions[sid];
    if (s) {
      s.lastActive = now;
      if (page) s.page = page;
      scheduleFlush();
    }
  } else if (type === 'leave') {
    const s = stats.sessions[sid];
    const dur = Math.max(0, parseInt(body.dur, 10) || 0);
    if (s) {
      // 优先使用前端上报时长，否则用 最后活跃-首次访问 推断
      let finalDur = dur;
      if (finalDur <= 0) finalDur = Math.max(0, Math.round((s.lastActive - s.firstVisit) / 1000));
      if (finalDur > 0) {
        day.durTotal += finalDur;
        day.durCount += 1;
      }
      s.dur = finalDur;
      scheduleFlush();
    }
  }
}

function dayStats(dk) {
  const d = stats.days[dk];
  if (!d) return { pv: 0, uv: 0, avgDuration: 0 };
  return {
    pv: d.pv || 0,
    uv: d.uv || 0,
    avgDuration: d.durCount ? Math.round(d.durTotal / d.durCount) : 0
  };
}

const PAGE_NAMES = {
  '/index.html': '首页', '/': '首页',
  '/products.html': '产品中心', '/product.html': '产品详情',
  '/solutions.html': '解决方案', '/news.html': '新闻动态',
  '/article.html': '文章详情', '/about.html': '关于我们',
  '/contact.html': '联系我们', '/admin.html': '后台管理'
};
function pageName(p) {
  return PAGE_NAMES[p] || p;
}

function getStatsSummary() {
  const today = todayKey();
  const d = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const t = new Date(d.getTime() - i * 86400000);
    const k = dayKey(t.getTime());
    dates.push({ date: k, ...dayStats(k) });
  }
  // 昨日
  const yk = dayKey(d.getTime() - 86400000);
  // 页面排行（近 7 天）
  const pages = {};
  dates.forEach((x) => {
    const dd = stats.days[x.date];
    if (dd && dd.pages) for (const p in dd.pages) pages[p] = (pages[p] || 0) + dd.pages[p];
  });
  const topPages = Object.keys(pages).map((p) => ({ page: p, name: pageName(p), pv: pages[p] }))
    .sort((a, b) => b.pv - a.pv).slice(0, 10);
  // 累计
  let totalPV = 0, totalUV = 0, durTotal = 0, durCount = 0;
  for (const k in stats.days) {
    const dd = stats.days[k];
    totalPV += dd.pv || 0;
    totalUV += dd.uv || 0;
    durTotal += dd.durTotal || 0;
    durCount += dd.durCount || 0;
  }
  // 最近访问记录
  const recent = Object.keys(stats.sessions)
    .map((sid) => ({ sid, ...stats.sessions[sid] }))
    .sort((a, b) => b.lastActive - a.lastActive)
    .slice(0, 12)
    .map((s) => ({ page: s.page, name: pageName(s.page), time: s.lastActive, dur: s.dur || 0, ua: s.ua, ip: s.ip }));
  return {
    totalPV, totalUV,
    totalDays: Object.keys(stats.days).length,
    avgDuration: durCount ? Math.round(durTotal / durCount) : 0,
    today: dayStats(today),
    yesterday: dayStats(yk),
    week: dates,
    topPages,
    recent
  };
}

// 前端埋点脚本（注入到 HTML 页面）
const TRACKER_SCRIPT = `<script>
(function(){
  try{
    var key='xl_sid';
    var sid=localStorage.getItem(key);
    if(!sid){sid='s'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);localStorage.setItem(key,sid);}
    var page=location.pathname;
    var t0=Date.now();
    function post(url,data){try{var r=new XMLHttpRequest();r.open('POST',url,true);r.setRequestHeader('Content-Type','application/json');r.send(JSON.stringify(data));}catch(e){}}
    post('/api/stats/visit',{sid:sid,page:page});
    setInterval(function(){post('/api/stats/heartbeat',{sid:sid,page:page});},30000);
    function leave(){try{var b=new Blob([JSON.stringify({sid:sid,page:page,dur:Math.round((Date.now()-t0)/1000)})],{type:'application/json'});navigator.sendBeacon('/api/stats/leave',b);}catch(e){}}
    window.addEventListener('pagehide',leave);
    window.addEventListener('beforeunload',leave);
  }catch(e){}
})();
<\/script>`;

// ---------- 业务处理 ----------
function listProducts() {
  return readJson('products.json', []);
}
function listNews() {
  return readJson('news.json', []);
}

function handleApi(req, res, url) {
  const method = req.method;
  const parts = url.pathname.split('/').filter(Boolean); // ['api','products','1']

  if (parts[0] !== 'api') return false;

  // 统计埋点上报（无需登录）
  if (parts[1] === 'stats' && method === 'POST') {
    readBody(req, 1024 * 1024).then((raw) => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) {}
      const type = parts[2];
      if (type === 'visit' || type === 'heartbeat' || type === 'leave') {
        recordStat(type, body, req);
        sendJson(res, 200, { ok: true });
      } else {
        sendJson(res, 404, { ok: false, error: '未知接口' });
      }
    }).catch(() => sendJson(res, 400, { ok: false, error: '请求格式错误' }));
    return true;
  }

  // GET /api/stats/summary （统计汇总，需登录）
  if (parts[1] === 'stats' && parts[2] === 'summary' && method === 'GET') {
    if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: '未登录' });
    flushStats(false);
    sendJson(res, 200, { ok: true, data: getStatsSummary() });
    return true;
  }

  // POST /api/login
  if (parts[1] === 'login' && method === 'POST') {
    readBody(req).then((raw) => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) {}
      if (body.password && body.password === getConfig().password) {
        sendJson(res, 200, { ok: true, token: issueToken() });
      } else {
        sendJson(res, 401, { ok: false, error: '密码错误' });
      }
    }).catch(() => sendJson(res, 400, { ok: false, error: '请求格式错误' }));
    return true;
  }

  // POST /api/password  (修改密码，需登录)
  if (parts[1] === 'password' && method === 'POST') {
    if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: '未登录' });
    readBody(req).then((raw) => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) {}
      const pw = String(body.password || '');
      if (pw.length < 6) return sendJson(res, 400, { ok: false, error: '密码至少 6 位' });
      const config = getConfig();
      config.password = pw;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
      sendJson(res, 200, { ok: true });
    }).catch(() => sendJson(res, 400, { ok: false, error: '请求格式错误' }));
    return true;
  }

  // POST /api/upload  (body: { filename, data: base64 })
  if (parts[1] === 'upload' && method === 'POST') {
    if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: '未登录' });
    readBody(req).then((raw) => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) {}
      const filename = String(body.filename || 'upload.png').replace(/[^\w.\-]/g, '');
      const data = String(body.data || '');
      const m = data.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return sendJson(res, 400, { ok: false, error: '图片数据格式错误' });
      const ext = path.extname(filename).toLowerCase() || '.png';
      const safeName = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
      const filePath = path.join(UPLOAD_DIR, safeName);
      fs.writeFileSync(filePath, Buffer.from(m[2], 'base64'));
      sendJson(res, 200, { ok: true, url: 'images/uploads/' + safeName });
    }).catch(() => sendJson(res, 400, { ok: false, error: '上传失败' }));
    return true;
  }

  // /api/products 与 /api/news
  const resource = parts[1];
  const isProduct = resource === 'products';
  const isNews = resource === 'news';
  if (!isProduct && !isNews) return false;

  const idParam = parts[2];

  if (method === 'GET') {
    const data = isProduct ? listProducts() : listNews();
    sendJson(res, 200, { ok: true, data });
    return true;
  }

  if (!isAuthed(req)) return sendJson(res, 401, { ok: false, error: '未登录' });

  const collection = isProduct ? 'products' : 'news';

  if (method === 'POST') {
    readBody(req).then((raw) => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) {}
      const list = readJson(collection + '.json', []);
      const maxId = list.reduce((mx, it) => Math.max(mx, it.id || 0), 0);
      body.id = maxId + 1;
      list.push(body);
      writeJson(collection + '.json', list);
      sendJson(res, 200, { ok: true, data: body });
    }).catch(() => sendJson(res, 400, { ok: false, error: '数据格式错误' }));
    return true;
  }

  if (method === 'PUT' && idParam) {
    readBody(req).then((raw) => {
      let body = {};
      try { body = JSON.parse(raw); } catch (e) {}
      const list = readJson(collection + '.json', []);
      const idx = list.findIndex(it => it.id === Number(idParam));
      if (idx === -1) return sendJson(res, 404, { ok: false, error: '未找到该记录' });
      body.id = Number(idParam);
      list[idx] = body;
      writeJson(collection + '.json', list);
      sendJson(res, 200, { ok: true, data: body });
    }).catch(() => sendJson(res, 400, { ok: false, error: '数据格式错误' }));
    return true;
  }

  if (method === 'DELETE' && idParam) {
    const list = readJson(collection + '.json', []);
    const next = list.filter(it => it.id !== Number(idParam));
    if (next.length === list.length) return sendJson(res, 404, { ok: false, error: '未找到该记录' });
    writeJson(collection + '.json', next);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

// ---------- 静态文件服务 ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  let filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + pathname);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    if (isHtml) {
      // HTML 页面注入访问统计埋点
      let html = '';
      try { html = fs.readFileSync(filePath, 'utf8'); } catch (e) {}
      if (html.indexOf('/api/stats/visit') === -1) {
        if (html.indexOf('</body>') !== -1) {
          html = html.replace('</body>', TRACKER_SCRIPT + '\n</body>');
        } else {
          html += TRACKER_SCRIPT;
        }
      }
      const buf = Buffer.from(html, 'utf8');
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'text/html; charset=utf-8',
        'Content-Length': buf.length,
        'Cache-Control': 'no-cache'
      });
      res.end(buf);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ---------- 启动 ----------
ensureDataFiles();
loadStats();
setInterval(() => flushStats(false), 60000); // 每分钟兜底落盘
process.on('exit', () => flushStats(true));
process.on('SIGINT', () => { flushStats(true); process.exit(); });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
  } else {
    serveStatic(req, res, url);
  }
});

server.listen(PORT, () => {
  console.log('贤霖科技官网服务器已启动: http://localhost:' + PORT);
  console.log('后台管理: http://localhost:' + PORT + '/admin.html');
});
