#!/usr/bin/env bash
# ============================================================
# 贤霖科技官网 —— 一键上线
#
# 一条命令完成全部工作：
#   1. 构建静态站（node build.js → dist/）
#   2. 提交并推送源码到 main 分支（版本备份）
#   3. 把 dist/ 发布到 gh-pages 分支（GitHub Pages 自动上线）
#
# 用法：
#   bash push.sh "本次改动的简要说明"     # 带说明（推荐）
#   bash push.sh                          # 不带说明会提示输入
#
# 线上地址：https://qinglian168.github.io/xianlin-website/
# 部署进度：https://github.com/Qinglian168/xianlin-website/actions
# ============================================================
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo " 贤霖科技官网 - 一键上线"
echo "=========================================="

# ---------- 0. 环境检查 ----------
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "[错误] 当前目录不是 Git 仓库。"
  exit 1
fi

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
  echo "[错误] 未配置 origin 远端仓库。"
  echo "       请运行：git remote add origin https://github.com/Qinglian168/xianlin-website.git"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未找到 node 命令，无法构建静态站。"
  echo "       请先安装 Node.js：https://nodejs.org"
  exit 1
fi

if ! nc -z 127.0.0.1 7897 2>/dev/null; then
  echo "⚠️  未检测到代理服务（127.0.0.1:7897）。"
  echo "    大陆网络直连 GitHub 会失败，请先打开 Clash Verge 再运行本脚本。"
  echo ""
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo " 仓库：$REMOTE"
echo " 分支：$BRANCH"
echo ""

# ---------- 1. 提交说明 ----------
if [ -n "${1:-}" ]; then
  MSG="$1"
else
  printf "本次改动说明（直接回车用时间戳）："
  read -r MSG
  [ -z "$MSG" ] && MSG="更新于 $(date '+%Y-%m-%d %H:%M')"
fi

# ---------- 2. 构建静态站 ----------
echo ""
echo "[1/3] 构建静态站（读 data/*.json → 生成 dist/）..."
node build.js

# ---------- 3. 提交并推送源码 ----------
echo ""
echo "[2/3] 提交并推送源码到 $BRANCH..."
git add -A
if git diff --cached --quiet; then
  echo "      （源码无改动，跳过提交）"
else
  git commit -m "$MSG"
fi
git push origin "$BRANCH"

# ---------- 4. 发布 dist 到 gh-pages 分支 ----------
echo ""
echo "[3/3] 发布静态文件到 gh-pages 分支..."
PROJECT_DIR="$(pwd)"
DEPLOY_TMP=$(mktemp -d)

# 安全校验：确保只在系统临时目录里做清理操作
case "$DEPLOY_TMP" in
  /var/folders/*|/tmp/*) ;;
  *) echo "[错误] 临时目录路径异常，已中止。"; exit 1 ;;
esac

(
  cd "$DEPLOY_TMP"
  git init -q
  git remote add origin "$REMOTE"

  # 拉取已有 gh-pages 做增量提交：只上传变化的文件，避免全量 6MB 导致网络超时
  if git fetch -q --depth=1 origin gh-pages 2>/dev/null; then
    git checkout -q -b gh-pages FETCH_HEAD
    find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} + 2>/dev/null || true
    echo "      （增量更新）"
  else
    git checkout -q -b gh-pages
    echo "      （首次全量发布，约需 10~30 秒）"
  fi

  cp -R "$PROJECT_DIR/dist/." .
  git add -A

  if git diff --cached --quiet; then
    echo "      （网站内容无变化，跳过发布）"
  else
    git commit -q -m "$MSG"
    git -c http.postBuffer=524288000 \
        -c http.version=HTTP/1.1 \
        -c http.lowSpeedLimit=1000 \
        -c http.lowSpeedTime=300 \
        push -q origin gh-pages
  fi
)
rm -rf "$DEPLOY_TMP"

echo ""
echo "=========================================="
echo " ✓ 上线成功！"
echo ""
echo " 线上地址：https://qinglian168.github.io/xianlin-website/"
echo " 约 1 分钟后生效（浏览器按 Cmd+Shift+R 强制刷新）"
echo "=========================================="
