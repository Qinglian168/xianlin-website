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
DEPLOY_TMP=$(mktemp -d)
cp -R dist/. "$DEPLOY_TMP/"
(
  cd "$DEPLOY_TMP"
  git init -q
  git checkout -q -b gh-pages
  git add -A
  git commit -q -m "$MSG"
  git remote add origin "$REMOTE"
  git push -q -f origin gh-pages
)
rm -rf "$DEPLOY_TMP"

echo ""
echo "=========================================="
echo " ✓ 上线成功！"
echo ""
echo " 线上地址：https://qinglian168.github.io/xianlin-website/"
echo " 约 1 分钟后生效（浏览器按 Cmd+Shift+R 强制刷新）"
echo "=========================================="
