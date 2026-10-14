# 贤霖科技官网 — GitHub Pages 部署指南

> 本文对应「公开 GitHub 仓库 + GitHub Pages 自动部署」方案。
> 如果你以后想改用国内 CDN（大陆访问更快），见同目录 `静态化部署指南.md`。

---

## 一、整体原理（看懂这张图就够了）

```
你的 Mac（本地）
  ├── 页面模板 *.html  ┐
  ├── data/products.json ├─ 源码（push 到 GitHub）
  ├── build.js          │
  └── .github/workflows/deploy.yml ┘
              │
              │  git push
              ▼
        GitHub 仓库（Qinglian168/xianlin-website）
              │
              │  自动触发 GitHub Actions
              ▼
        ① 装 Node  ② 跑 node build.js  ③ 生成 dist/
              │
              │  自动发布
              ▼
        GitHub Pages（全球 CDN）
              │
              ▼
        访客访问  https://qinglian168.github.io/xianlin-website/
              │
              └─ 可选：绑定自己的域名，如 https://xianlin-tech.com
```

**关键点**：你只需要把源码 push 上去，构建和发布全自动完成，不需要手动跑命令。

---

## 二、首次部署（只做一次）

### 前置：需要 GitHub 访问令牌（Token）

GitHub 从 2021 年起就不再支持用账号密码推送代码，必须用 Token。

1. 打开 **https://github.com/settings/tokens/new**
2. 按下表填写：

   | 字段 | 填什么 |
   |------|--------|
   | Note（备注）| `xianlin-website` |
   | Expiration（有效期）| `No expiration`（永不过期，省事）或 `90 days` |
   | 权限勾选 | 只勾 ✅ **repo**（整块） |

3. 点最下方的绿色按钮 **Generate token**
4. 页面会显示一串 `ghp_` 开头的字符，**只显示这一次**，请立刻复制

> ⚠️ 这串 Token 等同于你的账号密码，只用于推送代码。
> 不要写进任何代码文件、不要发到群里。用完可以随时到同一页面删除。

### 第 1 步：推送代码

把代码推到 GitHub（Token 只在这一步用一次）：

```bash
cd /Users/macbook/WorkBuddy/贤霖科技官网
git push
# 提示 Username 时输入：Qinglian168
# 提示 Password 时粘贴：刚才复制的 ghp_ 开头的 Token（注意不是账号密码）
```

成功后会看到 `main -> main` 的字样。

### 第 2 步：把仓库设为公开

GitHub Pages 免费版只支持公开仓库。

1. 打开 **https://github.com/Qinglian168/xianlin-website/settings**
2. 拉到页面最底部 **Danger Zone**
3. 点 **Change repository visibility** → **Change to public**
4. 按提示输入仓库名确认

> 说明：你的网站是 HTML/CSS/JS，浏览器本来就必须下载这些文件才能显示页面，
> 所以公开仓库不会额外泄露任何东西。后台密码 `data/config.json` 已在 `.gitignore` 中排除，不会上传。

### 第 3 步：启用 GitHub Pages

1. 打开 **https://github.com/Qinglian168/xianlin-website/settings/pages**
2. **Source** 选择 **GitHub Actions**（不是 "Deploy from a branch"）
3. 保存

### 第 4 步：等待自动部署

1. 打开 **https://github.com/Qinglian168/xianlin-website/actions**
2. 会看到一个名为「构建并部署到 GitHub Pages」的任务在运行
3. 等 1-2 分钟变成绿色 ✅

### 第 5 步：访问网站

```
https://qinglian168.github.io/xianlin-website/
```

能正常打开就成功了。

---

## 三、绑定自己的域名（可选，但推荐）

### 3.1 前置条件

- 已有一个域名（阿里云 / 腾讯云 / 其他注册商，约 80 元/年）

### 3.2 在项目里声明域名

1. 在项目根目录新建一个名为 `CNAME` 的文件（无后缀）
2. 文件内容只写一行你的域名，例如：

   ```
   xianlin-tech.com
   ```

3. 提交并推送：

   ```bash
   cd /Users/macbook/WorkBuddy/贤霖科技官网
   git add CNAME && git commit -m "绑定自定义域名" && git push
   ```

   > `build.js` 会自动把 CNAME 文件带进 `dist/`，GitHub Pages 识别后即绑定成功。

4. 回到 **Settings → Pages**，在 **Custom domain** 处填入同一域名并保存
5. 勾选 **Enforce HTTPS**（等证书签发完成后生效，通常几分钟到几小时）

### 3.3 在域名服务商处配置 DNS

登录你买域名的平台，找到「域名解析 / DNS 设置」，按下面添加记录：

**如果绑定的是主域名（如 `xianlin-tech.com`）**，添加 4 条 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**如果绑定的是子域名（如 `www.xianlin-tech.com`）**，添加 1 条 CNAME 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| CNAME | `www` | `qinglian168.github.io` |

配置后等待 DNS 生效（几分钟到几小时），访问你的域名即可看到网站。

---

## 四、以后怎么更新网站

改完产品、新闻或页面后，只需三条命令：

```bash
cd /Users/macbook/WorkBuddy/贤霖科技官网
git add -A
git commit -m "更新说明"
git push
```

推送后 GitHub Actions 会自动重新构建并发布，**1-2 分钟全网生效**。

也可以直接用项目里的脚本：

```bash
cd /Users/macbook/WorkBuddy/贤霖科技官网
bash push.sh "更新说明"
```

### 想先在本机看效果再上线

```bash
cd /Users/macbook/WorkBuddy/贤霖科技官网
node build.js                                  # 生成 dist/
cd dist && python3 -m http.server 8080         # 本地预览
# 浏览器打开 http://localhost:8080
```

---

## 五、常见问题

### Q1：大陆访客打开慢怎么办？
GitHub Pages 的服务器在境外，大陆访问速度一般（1-5 秒），偶尔会被干扰。
如果客户主要在大陆，建议后续改用国内 CDN（腾讯云 Webify / 阿里云 OSS），
同一份代码 + `build.js` 可以直接复用，见 `静态化部署指南.md`。

### Q2：Actions 报错怎么办？
打开仓库的 **Actions** 页面，点进失败的任务看红色步骤的日志。
常见原因：`build.js` 缺少依赖文件、`data/*.json` 格式错误。

### Q3：改了产品但网站没变化？
1. 确认 `git push` 成功
2. 打开 Actions 页面确认任务跑完 ✅
3. 浏览器按 `Cmd + Shift + R` 强制刷新（清缓存）

### Q4：Token 过期了怎么办？
重新生成一个，再次 `git push` 时粘贴即可。
macOS 钥匙串里如果存了旧 Token，执行下面命令清除：
```bash
printf "protocol=https\nhost=github.com\n" | git credential-osxkeychain erase
```

### Q5：仓库改回私有会怎样？
GitHub Pages 会立即停止服务（免费账号）。要保持网站可访问，必须保持公开。

---

## 六、相关文件说明

| 文件 | 作用 |
|------|------|
| `build.js` | 构建脚本：读 `data/*.json`，生成完整静态站到 `dist/` |
| `.github/workflows/deploy.yml` | 自动部署配置（push 后自动构建 + 发布） |
| `CNAME` | （可选）自定义域名声明 |
| `data/products.json` | 39 个产品数据 |
| `data/news.json` | 8 篇新闻数据 |
| `push.sh` | 一键提交 + 推送脚本 |

> `dist/` 是构建产物，已在 `.gitignore` 中排除，不需要也不应该手动上传。
