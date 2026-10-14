// ============================================================
// 贤霖科技官网 - 静态化构建脚本
// 用途：把 data/*.json 数据烘焙到 HTML，生成可部署到任何静态托管的 dist/
// 用法：node build.js
// 输出：dist/ 目录（39 产品页 + 8 文章页 + 9 通用页 + css/js/images）
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// ---------- 0. 准备 dist（清空内容后重建，避免旧文件残留） ----------
if (fs.existsSync(DIST)) {
  for (const entry of fs.readdirSync(DIST)) {
    fs.rmSync(path.join(DIST, entry), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(DIST, { recursive: true });
}

// ---------- 1. 读取数据 ----------
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/products.json'), 'utf8'));
const articles = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/news.json'), 'utf8'));
console.log(`✓ 数据加载：${products.length} 个产品，${articles.length} 篇新闻`);

// ---------- 2. 拷贝资源（CSS / JS / 图片 / data） ----------
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

copyDir(path.join(ROOT, 'css'), path.join(DIST, 'css'));
copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));
copyDir(path.join(ROOT, 'images'), path.join(DIST, 'images'));
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'data/products.json'), path.join(DIST, 'data/products.json'));
fs.copyFileSync(path.join(ROOT, 'data/news.json'), path.join(DIST, 'data/news.json'));
console.log('✓ 资源拷贝：css/ js/ images/ data/');

// ---------- 2.5 部署辅助文件 ----------
// .nojekyll：告诉 GitHub Pages 跳过 Jekyll 处理（否则下划线开头的文件会被忽略）
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// 自定义域名：若项目根目录放了一个 CNAME 文件（内容就是域名，如 xianlin-tech.com），
// 构建时自动带到 dist/ 根目录 → GitHub Pages 会自动识别并绑定该域名
const cnameFile = path.join(ROOT, 'CNAME');
if (fs.existsSync(cnameFile)) {
  const domain = fs.readFileSync(cnameFile, 'utf8').trim();
  fs.writeFileSync(path.join(DIST, 'CNAME'), domain + '\n');
  console.log(`✓ 自定义域名：${domain}（已写入 dist/CNAME）`);
} else {
  console.log('· 未设置自定义域名（如需绑定，在项目根目录新建 CNAME 文件，内容写域名）');
}

// ---------- 3. 工具函数 ----------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 静态页面：去除数据加载失败时的"请刷新"提示，因为它永远不会失败
function removeDataLoadFailHint(html) {
  return html.replace(/数据加载失败，请刷新页面重试。?/g, '暂无数据');
}

// 产品列表卡片：把链接从 product.html?id=N 改为 products/N.html（兼容 JS 模板字符串）
function fixProductLinks(html) {
  return html
    .replace(/product\.html\?id=/g, 'products/')           // 静态 / 模板前缀都覆盖
    .replace(/\$\{([a-zA-Z_]+)\.id\}(?!\.html)/g, '${$1.id}.html'); // 模板里拼上 .html
}
// 新闻列表卡片：把链接从 article.html?id=N 改为 articles/N.html（兼容 JS 模板字符串）
function fixArticleLinks(html) {
  return html
    .replace(/article\.html\?id=/g, 'articles/')
    .replace(/\$\{([a-zA-Z_]+)\.id\}(?!\.html)/g, '${$1.id}.html');
}

// ---------- 子目录页面路径修正（关键） ----------
// products/X.html 与 articles/X.html 位于子目录，页面里的相对路径必须加 "../" 前缀，
// 否则浏览器会去 products/css/style.css、products/images/logo.jpg 找文件 → 全部 404
// （无样式、无图片、导航全失效）。这样改写后，无论部署在根域名还是 GitHub Pages 子路径都正常。
const ROOT_LEVEL_PAGES = ['index.html', 'about.html', 'contact.html', 'solutions.html', 'products.html', 'news.html'];
// 跳过：带协议的、锚点、协议相对、站点绝对路径、已修正过的
const SKIP_SUBDIR_URL = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/|\/|\.\.\/)/i;

function fixSubdirPaths(html, dir) {
  return html.replace(/(href|src)="([^"]*)"/gi, function (match, attr, url) {
    if (!url || SKIP_SUBDIR_URL.test(url)) return match;
    // 详情页互链：同目录的直接用文件名，跨目录的补 ../目录/
    const detail = url.match(/^(products|articles)\/([^/]+)$/);
    if (detail) {
      return attr + '="' + (detail[1] === dir ? detail[2] : '../' + url) + '"';
    }
    // 根级页面、根级资源目录（css/ js/ images/ data/）→ 补 ../
    if (ROOT_LEVEL_PAGES.indexOf(url) !== -1 || /^(css|js|images|data)\//.test(url)) {
      return attr + '="../' + url + '"';
    }
    return match;
  });
}

// ---------- 4. 复制通用页面（首页/about/contact/solutions/products/news）----------
// 这些页面是数据驱动的列表/单页，已经支持 data/xxx.json 静态兜底，只改链接即可
const staticPages = ['index', 'about', 'contact', 'solutions', 'products', 'news'];
for (const page of staticPages) {
  let html = fs.readFileSync(path.join(ROOT, `${page}.html`), 'utf8');
  html = fixProductLinks(html);
  html = fixArticleLinks(html);
  html = removeDataLoadFailHint(html);
  fs.writeFileSync(path.join(DIST, `${page}.html`), html);
}
console.log(`✓ 通用页面：${staticPages.length} 个（首页/about/contact/solutions/products/news）`);

// ---------- 5. 生成产品详情页（39 个独立 HTML）----------
function buildProductPage(product, products) {
  const idx = products.findIndex(p => p.id === product.id);
  const prev = products[idx - 1];
  const next = products[idx + 1];

  const specsHtml = Object.entries(product.specs || {})
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('') || `<tr><td colspan="2" style="color:#94a3b8;">暂无参数</td></tr>`;

  const scenariosHtml = (product.scenarios || [])
    .map(s => `<div class="scenario-item">${escapeHtml(s)}</div>`)
    .join('') || `<div class="scenario-item">暂无</div>`;

  // 上一款 / 下一款
  const prevEl = prev
    ? `<a href="products/${prev.id}.html">← ${escapeHtml(prev.name.length > 16 ? prev.name.slice(0, 16) + '…' : prev.name)}</a>`
    : `<a href="#" style="visibility:hidden;">← 上一款产品</a>`;
  const nextEl = next
    ? `<a href="products/${next.id}.html">${escapeHtml(next.name.length > 16 ? next.name.slice(0, 16) + '…' : next.name)} →</a>`
    : `<a href="#" style="visibility:hidden;">下一款产品 →</a>`;

  // 模板：读 product.html，去掉 initProduct 那段 script
  let html = fs.readFileSync(path.join(ROOT, 'product.html'), 'utf8');
  // 删除 <script>\n// ===== 从服务器加载产品 ===== ... </script>
  html = html.replace(/<script>\s*\/\/ ===== 从服务器加载产品 =====[\s\S]*?<\/script>/, '');

  // 注入数据点
  html = html
    .replace(/<title>[^<]+<\/title>/, `<title>${escapeHtml(product.name)} | 深圳市贤霖科技有限公司</title>`)
    .replace(/<img id="product-image" src="" alt="">/,
      `<img id="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">`)
    .replace(/<span class="brand-tag" id="product-brand"><\/span>/,
      `<span class="brand-tag">${escapeHtml(product.brand)}</span>`)
    .replace(/<h1 id="product-title"><\/h1>/, `<h1>${escapeHtml(product.name)}</h1>`)
    .replace(/<p class="desc" id="product-desc"><\/p>/, `<p class="desc">${escapeHtml(product.desc)}</p>`)
    .replace(/<table class="spec-table" id="product-specs"><\/table>/, `<table class="spec-table">${specsHtml}</table>`)
    .replace(/<div class="scenario-list" id="product-scenarios"><\/div>/, `<div class="scenario-list">${scenariosHtml}</div>`)
    .replace(/<a href="#" id="product-prev">[^<]*<\/a>/, prevEl)
    .replace(/<a href="#" id="product-next">[^<]*<\/a>/, nextEl);

  // 修复面包屑中的产品详情链接（一般不存在，原模板没有，保持）
  // 关键：页面位于 products/ 子目录，所有相对路径补 ../
  return fixSubdirPaths(html, 'products');
}

const productsDir = path.join(DIST, 'products');
fs.mkdirSync(productsDir, { recursive: true });
for (const p of products) {
  const html = buildProductPage(p, products);
  fs.writeFileSync(path.join(productsDir, `${p.id}.html`), html);
}
console.log(`✓ 产品详情页：${products.length} 个（dist/products/）`);

// ---------- 6. 生成文章详情页（8 个独立 HTML）----------
function buildArticlePage(article, articles) {
  const idx = articles.findIndex(a => a.id === article.id);
  const prev = articles[idx - 1];
  const next = articles[idx + 1];

  // 正文渲染（H3: 小节 / TIP: 提示框）
  let bodyHtml = '';
  (article.body || []).forEach(para => {
    if (para.startsWith('H3:')) {
      bodyHtml += '<h3>' + escapeHtml(para.slice(3)) + '</h3>';
    } else if (para.startsWith('TIP:')) {
      bodyHtml += '<div class="tip-box">' + escapeHtml(para.slice(4)) + '</div>';
    } else {
      bodyHtml += '<p>' + escapeHtml(para) + '</p>';
    }
  });
  if (!bodyHtml) bodyHtml = '<p>暂无内容</p>';

  // 上一篇 / 下一篇
  const prevEl = prev
    ? `<a href="articles/${prev.id}.html">← ${escapeHtml(prev.title.length > 16 ? prev.title.slice(0, 16) + '…' : prev.title)}</a>`
    : `<a href="#" style="visibility:hidden;">← 上一篇</a>`;
  const nextEl = next
    ? `<a href="articles/${next.id}.html">${escapeHtml(next.title.length > 16 ? next.title.slice(0, 16) + '…' : next.title)} →</a>`
    : `<a href="#" style="visibility:hidden;">下一篇 →</a>`;

  let html = fs.readFileSync(path.join(ROOT, 'article.html'), 'utf8');
  html = html.replace(/<script>\s*\/\/ ===== 从服务器加载新闻 =====[\s\S]*?<\/script>/, '');

  html = html
    .replace(/<title>[^<]+<\/title>/, `<title>${escapeHtml(article.title)} | 深圳市贤霖科技有限公司</title>`)
    .replace(/<span id="article-date">[^<]*<\/span>|<span class="article-date" id="article-date">[^<]*<\/span>/,
      `<span id="article-date">${escapeHtml(article.date)}</span>`)
    .replace(/<span id="article-tag">[^<]*<\/span>|<span class="article-tag" id="article-tag">[^<]*<\/span>/,
      `<span id="article-tag">${escapeHtml(article.tag)}</span>`)
    .replace(/<h1 id="article-title"><\/h1>/, `<h1>${escapeHtml(article.title)}</h1>`)
    .replace(/<div class="article-body" id="article-body"><\/div>/, `<div class="article-body">${bodyHtml}</div>`)
    .replace(/<a href="#" id="article-prev">[^<]*<\/a>/, prevEl)
    .replace(/<a href="#" id="article-next">[^<]*<\/a>/, nextEl);

  // 关键：页面位于 articles/ 子目录，所有相对路径补 ../
  return fixSubdirPaths(html, 'articles');
}

const articlesDir = path.join(DIST, 'articles');
fs.mkdirSync(articlesDir, { recursive: true });
for (const a of articles) {
  const html = buildArticlePage(a, articles);
  fs.writeFileSync(path.join(articlesDir, `${a.id}.html`), html);
}
console.log(`✓ 文章详情页：${articles.length} 个（dist/articles/）`);

// ---------- 7. 静态化报告 ----------
function dirSize(dir) {
  let total = 0;
  function walk(p) {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const sub = path.join(p, entry.name);
      if (entry.isDirectory()) walk(sub);
      else total += fs.statSync(sub).size;
    }
  }
  walk(dir);
  return total;
}

const totalSize = dirSize(DIST);
console.log(`\n========================================`);
console.log(`✓ 构建完成：${path.relative(ROOT, DIST)}/`);
console.log(`  - 文件数：${fs.readdirSync(DIST).length} 个顶层项`);
console.log(`  - 总大小：${(totalSize / 1024).toFixed(1)} KB`);
console.log(`  - 入口文件：dist/index.html`);
console.log(`\n预览方法：cd dist && python3 -m http.server 8080`);
console.log(`========================================\n`);