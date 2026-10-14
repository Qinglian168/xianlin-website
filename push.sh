#!/usr/bin/env bash
# ============================================================
# 贤霖科技官网 - 一键推送到 GitHub
# 用途：日常改完产品/文章/页面后，运行此脚本一键推送到 GitHub
#       GitHub Actions 检测到推送后会自动构建并部署到 GitHub Pages（1~2 分钟生效）
#
# 用法：
#       bash push.sh "本次改动的简要说明"     # 带说明（最常用）
#       bash push.sh                          # 不带说明会提示输入
#
# 仓库：https://github.com/Qinglian168/xianlin-website （公开）
# 线上地址：https://qinglian168.github.io/xianlin-website/
# ============================================================
set -e

# 切到脚本所在目录（即项目根目录）
cd "$(dirname "$0")"

echo "=========================================="
echo " 贤霖科技官网 - 一键推送到 GitHub"
echo "=========================================="

# 1) 检查是否是 Git 仓库
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo ""
  echo "[错误] 当前目录不是 Git 仓库。"
  echo "       请先初始化："
  echo "         git init"
  echo "         git remote add origin https://github.com/Qinglian168/xianlin-website.git"
  exit 1
fi

# 2) 检查远端配置
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
  echo ""
  echo "[错误] 未配置 origin 远端仓库。"
  echo "       请运行："
  echo "         git remote add origin https://github.com/Qinglian168/xianlin-website.git"
  exit 1
fi
echo " 远端仓库：$REMOTE"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo " 当前分支：$BRANCH"
echo ""

# 3) 获取 commit 说明（优先使用参数，否则询问）
if [ -n "${1:-}" ]; then
  MSG="$1"
else
  echo -n "📝 请输入本次改动的简要说明（直接回车用时间戳）："
  read -r MSG
  if [ -z "$MSG" ]; then
    MSG="更新于 $(date '+%Y-%m-%d %H:%M')"
  fi
fi

# 4) git add
echo ""
echo "[1/4] 添加所有改动..."
git add -A

# 如果没有改动，直接退出
if git diff --cached --quiet; then
  echo ""
  echo "✓ 没有新的改动，无需推送。"
  exit 0
fi

# 5) 显示将要提交的文件清单（让用户确认）
echo ""
echo "[2/4] 本次提交的文件："
git diff --cached --stat | sed 's/^/      /'
echo ""

# 6) git commit
echo "[3/4] 提交：$MSG"
git commit -m "$MSG"

# 7) git push（处理首次推送需要 -u 的情况）
echo ""
echo "[4/4] 推送到 GitHub..."
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")
if [ -z "$UPSTREAM" ]; then
  echo "（首次推送，自动设置 upstream）"
  git push -u origin "$BRANCH"
else
  git push
fi

echo ""
echo "=========================================="
echo " ✓ 推送成功！"
echo ""
echo " 下一步："
echo "   • GitHub Actions 会自动构建（node build.js）并部署到 GitHub Pages"
echo "   • 一般 1~2 分钟后线上生效"
echo "   • 部署进度：https://github.com/Qinglian168/xianlin-website/actions"
echo "   • 线上地址：https://qinglian168.github.io/xianlin-website/"
echo "=========================================="