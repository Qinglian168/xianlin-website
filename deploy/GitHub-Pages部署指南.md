# 贤霖科技官网 — GitHub Pages 部署指南

> **当前实际方案**：公开 GitHub 仓库 + gh-pages 分支部署。
> 源码提交到 `main` 分支（备份用），`node build.js` 生成的 dist 部署到 `gh-pages` 分支，GitHub Pages 自动提供服务。
> **不依赖 GitHub Actions**（用户 Token 不必加 workflow 权限）。

## 一、整体原理

```
你的 Mac（本地）
  └── 项目源码（*.html / data/*.json / images/）
              │
              │  bash push.sh "说明"   ← 一条命令全搞定
              ▼
   ┌──────────────────────────┐
   │ 1) node build.js → dist  │  39 产品页 + 8 文章页 + 6 通用页
   │ 2) 推 main（备份源码）   │
   │ 3) 推 gh-pages（网站）   │
   └──────────────────────────┘
              │
              ▼
        GitHub Pages（全球 CDN）
              │
              ▼
   https://qinglian168.github.io/xianlin-website/
```

## 二、日常更新网站（最常用）

改完产品/新闻/页面后：

```bash
cd /Users/macbook/WorkBuddy/贤霖科技官网
bash push.sh "更新说明"
```

脚本自动完成：构建 → 推 main → 推 gh-pages，1-2 分钟全网生效。

## 三、本地预览

```bash
cd /Users/macbook/WorkBuddy/贤霖科技官网
node build.js                          # 生成 dist/
cd dist && python3 -m http.server 8080 # 浏览器打开 http://localhost:8080
```

## 四、绑定自己的域名

### 4.1 在项目里声明域名

在项目根目录新建 `CNAME` 文件（无后缀），内容只写一行：

```
xianlin-tech.com
```

下次 `bash push.sh` 时会自动带入 dist/，GitHub Pages 自动识别。

### 4.2 在域名服务商处配置 DNS

登录域名注册商，找到「域名解析 / DNS 设置」：

**主域名（如 `xianlin-tech.com`）** — 添加 4 条 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.111.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |

**子域名（如 `www.xianlin-tech.com`）** — 添加 1 条 CNAME 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| CNAME | `www` | `qinglian168.github.io` |

生效后访问 `https://你的域名` 即可。

## 五、首次部署（已完成，跳过此节）

如果你从零开始，需要：

1. 准备 GitHub 仓库（公开）
2. 生成 Personal Access Token（https://github.com/settings/tokens/new，勾 `repo`）
3. `git remote add origin https://github.com/你的账号/xianlin-website.git`
4. `git config --global credential.helper store`（明文存 `~/.git-credentials`，免密推送）
5. `git config --global http.https://github.com.proxy http://127.0.0.1:7897`（大陆需要走代理）
6. 在 GitHub 网页启用 Pages：Settings → Pages → Source 选 `gh-pages` 分支 / (root)
7. 跑 `bash push.sh "首次部署"`

## 六、相关文件

| 文件 | 作用 |
|------|------|
| `build.js` | 构建脚本：读 `data/*.json` → 生成 `dist/`（自动修正子目录路径、生成 `.nojekyll`、处理 CNAME）|
| `push.sh` | 一键上线脚本（构建 + 推 main + 推 gh-pages，含自动重试）|
| `CNAME` | （可选）自定义域名 |
| `data/products.json` | 39 个产品数据 |
| `data/news.json` | 8 篇新闻数据 |
| `deploy/github-actions-deploy.yml` | Actions 备选配置（需 token 加 workflow 权限才能用）|
| `deploy/静态化部署指南.md` | 国内 CDN 方案（大陆访问更快但要备案）|

## 七、常见问题

### Q1：大陆访客访问慢怎么办？
GitHub Pages 服务器在境外，1-5 秒延迟属正常。
我们已经把总体积压到 2.3MB（PNG banner 全部转 JPEG），首次加载比预期快。
如想极致快，参考 `deploy/静态化部署指南.md` 迁国内 CDN。

### Q2：推 gh-pages 失败（HTTP 408 / curl 52）？
通常是代理网络瞬时中断。`push.sh` 已内置自动重试 5 次。
如反复失败，检查：① Clash Verge 是否运行 ② 换更稳定的代理节点。

### Q3：改了产品但网站没变化？
1. 确认 `bash push.sh` 跑通并看到 "✓ 上线成功"
2. 浏览器按 `Cmd + Shift + R` 强制刷新（清缓存）
3. 等 1-2 分钟（CDN 传播）

### Q4：想换域名？
1. 把 `CNAME` 文件内容改成新域名
2. 在新域名服务商处加 A/CNAME 记录
3. GitHub Pages → Settings → Custom domain 填新域名并保存
4. 跑 `bash push.sh`

### Q5：Token 失效了？
到 https://github.com/settings/tokens 找 `xianlin-website` token → 必要时旋转/重新生成。
更新 `~/.git-credentials` 里的密码字段。
