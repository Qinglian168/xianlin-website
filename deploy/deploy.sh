#!/usr/bin/env bash
# ============================================================
# 贤霖科技官网 - 服务器一键部署脚本
# 适用系统：Ubuntu / Debian / Alibaba Cloud Linux / CentOS / Rocky
# 用法：把整个网站文件夹上传到服务器后，进入网站目录执行：
#     bash deploy/deploy.sh
# ============================================================
set -e

APP_NAME="xianlin-website"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8080}"
NODE_MAJOR="${NODE_MAJOR:-20}"

echo "=========================================="
echo " 贤霖科技官网 部署脚本"
echo " 网站目录: $APP_DIR"
echo " 服务端口: $PORT"
echo "=========================================="

if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

if command -v apt-get >/dev/null 2>&1; then
  PKG="apt"
elif command -v dnf >/dev/null 2>&1; then
  PKG="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG="yum"
else
  echo "[错误] 未识别的系统，请手动安装 Node.js 18+ 后重试"; exit 1
fi

echo ""
echo "[1/5] 安装基础工具..."
if [ "$PKG" = "apt" ]; then
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq curl git >/dev/null
else
  $SUDO $PKG install -y -q curl git >/dev/null
fi

echo "[2/5] 检查 / 安装 Node.js ${NODE_MAJOR}.x ..."
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  CUR="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$CUR" -ge 18 ] 2>/dev/null; then
    NEED_NODE=0
    echo "      已安装 Node $(node -v)，跳过"
  fi
fi
if [ "$NEED_NODE" = "1" ]; then
  if [ "$PKG" = "apt" ]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash - >/dev/null
    $SUDO apt-get install -y -qq nodejs
  else
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO bash - >/dev/null
    $SUDO $PKG install -y nodejs
  fi
  echo "      已安装 Node $(node -v)"
fi

echo "[3/5] 安装 pm2 进程守护..."
$SUDO npm install -g pm2 --silent >/dev/null 2>&1 || npm install -g pm2 --silent

echo "[4/5] 准备目录与数据文件..."
cd "$APP_DIR"
mkdir -p logs images/uploads
[ -f data/products.json ] || echo "[]" > data/products.json
[ -f data/news.json ] || echo "[]" > data/news.json
[ -f data/stats.json ] || echo '{"sessions":{},"days":{}}' > data/stats.json
chmod -R u+rw data images/uploads logs

echo "[5/5] 启动服务..."
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
PORT="$PORT" pm2 start deploy/ecosystem.config.js
pm2 save >/dev/null

echo ""
echo "=========================================="
echo " 部署完成！"
echo "=========================================="
echo " 本机验证:   curl -I http://127.0.0.1:${PORT}"
echo " 查看状态:   pm2 status"
echo " 查看日志:   pm2 logs ${APP_NAME}"
echo " 重启服务:   pm2 restart ${APP_NAME}"
echo ""
echo " 还差两步（见 deploy/部署指南.md）："
echo "  1) 配置开机自启：执行下面这行命令"
echo "     sudo env PATH=\$PATH:$(dirname "$(command -v pm2)") pm2 startup systemd -u $(whoami) --hp $HOME"
echo "  2) 安装 Nginx 做反向代理 80 -> ${PORT}，并申请 HTTPS 证书"
echo "=========================================="
