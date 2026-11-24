#!/usr/bin/env bash
# 免疫卫士官网一键发布
#
# 做四件事（--release 时）：
#   1. 把当前版本的 APK 发到官网仓库的 Release（已存在则跳过）
#   2. 从 GitHub Release 重新生成 version.json
#   3. 提交并推送官网仓库（GitHub Pages 会自动跟着更新）
#   4. 把静态文件同步到腾讯云 personal-ip-site/immune-guard/
#
# 用法：
#   bash deploy.sh                 # 只同步已发布的版本（不发 Release）
#   bash deploy.sh --release       # 连 Release 一起发（读 05-App 的版本号）
#   bash deploy.sh --dry-run       # 只看要做什么
#
# 脚本位置：放在官网设计/ 或 site/tools/ 下都能用，路径自动探测。
# 服务器凭据从 E:/AI新青年/.env 读取，不写在脚本里。

set -euo pipefail

ENV_FILE="E:/AI新青年/.env"
REMOTE_DIR="/opt/opc-agent-business-network-demo/personal-ip-site/immune-guard"
SITE_REPO="Handsome5201314/immune-guard-site"
APP_REPO="Handsome5201314/immune-guard-app"

DRY_RUN=false
DO_RELEASE=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --release) DO_RELEASE=true ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "未知参数：$arg"; exit 1 ;;
  esac
done

say() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
die() { printf '\033[1;31m错误：%s\033[0m\n' "$1" >&2; exit 1; }

# ---------- 定位各目录 ----------
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 从起点往上找，直到某个目录下存在 $2
find_up() {
  local d="$1"
  for _ in 1 2 3 4 5 6 7 8; do
    [ -e "$d/$2" ] && { printf '%s' "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}

# 含 scripts/sync_versions.py 的目录（生成脚本所在）
TOOL_ROOT="$(find_up "$SELF_DIR" "scripts/sync_versions.py")" || true
# 含 05-App 的项目根
PROJECT_ROOT="$(find_up "$SELF_DIR" "05-App/package.json")" || true

# site 目录：脚本可能在 site 内，也可能在其上一级
if [ -f "$SELF_DIR/version.json" ]; then
  SITE="$SELF_DIR"
elif [ -f "$SELF_DIR/site/version.json" ]; then
  SITE="$SELF_DIR/site"
else
  SITE="$(find_up "$SELF_DIR" "version.json")" || SITE=""
fi

[ -n "$SITE" ] && [ -f "$SITE/version.json" ] || die "找不到 site 目录（version.json）"
[ -n "${PROJECT_ROOT:-}" ] || die "找不到项目根（含 05-App 的目录）"
[ -n "${TOOL_ROOT:-}" ] && [ -f "$TOOL_ROOT/scripts/sync_versions.py" ] || die "找不到 scripts/sync_versions.py"

APP_DIR="$PROJECT_ROOT/05-App"
APK_DIR="$PROJECT_ROOT/03-产出/免疫卫士-App-Demo"

# ---------- 读 .env ----------
[ -f "$ENV_FILE" ] || die "找不到 $ENV_FILE"
read_env() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' \
    | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//'
}

IP="$(read_env TENCENT_SERVER_IP)"
USER_="$(read_env TENCENT_SERVER_SSH_USER)"
KEY="$(read_env TENCENT_SERVER_SSH_KEY)"
DOMAIN="$(read_env TENCENT_SERVER_DOMAIN)"

[ -n "$IP" ] && [ -n "$USER_" ] && [ -f "$KEY" ] || die "服务器凭据不完整（检查 .env 的 TENCENT_SERVER_*）"

TOTAL=3
if $DO_RELEASE; then TOTAL=4; fi
STEP=0
step() { STEP=$((STEP + 1)); say "$STEP/$TOTAL $1"; }

# ---------- 0. 可选：发布官网仓库的 Release ----------
if $DO_RELEASE; then
  step "发布官网仓库 Release"
  VER="$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "$APP_DIR/package.json" | head -1 | sed -E 's/.*"([^"]+)"$/\1/' || true)"
  [ -n "$VER" ] || die "读不到 05-App/package.json 的版本号"
  TAG="v$VER"
  APK="$APK_DIR/免疫卫士-$TAG.apk"
  [ -f "$APK" ] || die "找不到安装包：$APK"

  if gh release view "$TAG" -R "$SITE_REPO" >/dev/null 2>&1; then
    echo "官网仓库已有 $TAG，跳过发布"
  elif $DRY_RUN; then
    echo "dry-run：将把 $APK 发布为 $SITE_REPO 的 $TAG"
  else
    # 说明文字直接复用 App 仓库同名 Release，保证两边一致
    NOTES_FILE="/tmp/ig-release-notes-$TAG.md"
    gh release view "$TAG" -R "$APP_REPO" --json body --jq '.body' > "$NOTES_FILE" 2>/dev/null || true
    [ -s "$NOTES_FILE" ] || echo "免疫卫士 $TAG" > "$NOTES_FILE"
    TITLE="$(gh release view "$TAG" -R "$APP_REPO" --json name --jq '.name' 2>/dev/null || true)"
    [ -n "$TITLE" ] || TITLE="免疫卫士 $TAG"

    gh release create "$TAG" "$APK" -R "$SITE_REPO" \
      --title "$TITLE" --notes-file "$NOTES_FILE" --latest >/dev/null
    rm -f "$NOTES_FILE"
    echo "已发布 $TAG 到 $SITE_REPO"

    # 中文路径会让 gh 的 #重命名 失效，上传后用 API 改名
    ID="$(gh api "repos/$SITE_REPO/releases/tags/$TAG" --jq '.assets[0].id')"
    printf '{"name":"ImmunGuard-%s.apk"}' "$TAG" > /tmp/ig-rename.json
    gh api -X PATCH "repos/$SITE_REPO/releases/assets/$ID" --input /tmp/ig-rename.json >/dev/null
    rm -f /tmp/ig-rename.json
    echo "安装包已重命名为 ImmunGuard-$TAG.apk"
  fi
fi

# ---------- 1. 生成 version.json ----------
step "生成 version.json"
cd "$TOOL_ROOT"
# 记下同步前的版本号，用来判断这次是不是真有新版本
OLD_TAG="$(grep -o '"tag": "[^"]*"' "$SITE/version.json" | head -1 | cut -d'"' -f4 || true)"
if command -v python >/dev/null 2>&1; then
  python scripts/sync_versions.py
elif command -v py >/dev/null 2>&1; then
  py scripts/sync_versions.py
else
  die "找不到 python"
fi

TAG="$(grep -o '"tag": "[^"]*"' "$SITE/version.json" | head -1 | cut -d'"' -f4 || true)"
say "当前最新版本：$TAG"

if $DRY_RUN; then
  say "dry-run：跳过提交与上传"
  echo "将上传到 $USER_@$IP:$REMOTE_DIR"
  exit 0
fi

# ---------- 2. 提交并推送仓库 ----------
step "提交官网仓库"
cd "$SITE"
OTHER_CHANGES="$(git status --porcelain | awk '!/version\.json/' | wc -l | tr -d ' ' || true)"
if [ "$OLD_TAG" = "$TAG" ] && [ "$OTHER_CHANGES" = "0" ]; then
  # 版本没变，只有 generatedAt 变了，不值得留一条提交
  git checkout -- version.json
  echo "版本未变（$TAG），跳过提交"
elif [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "chore(release): 同步至 $TAG"
  git push origin "$(git rev-parse --abbrev-ref HEAD)"
  echo "已推送，GitHub Pages 会自动重建"
else
  echo "无改动，跳过提交"
fi

# ---------- 3. 上传到腾讯云 ----------
step "同步到 $DOMAIN"
cd "$SITE"
BACKUP="$REMOTE_DIR.bak-$(date +%Y%m%d-%H%M%S)"

ssh -i "$KEY" -o StrictHostKeyChecking=no "$USER_@$IP" \
  "cp -r '$REMOTE_DIR' '$BACKUP' && echo 已备份到 $BACKUP"

scp -i "$KEY" -o StrictHostKeyChecking=no \
  index.html download.html version.json "$USER_@$IP:$REMOTE_DIR/"
scp -i "$KEY" -o StrictHostKeyChecking=no -r \
  assets "$USER_@$IP:$REMOTE_DIR/"

say "验证线上"
ONLINE="$(curl -sL --max-time 20 "https://$DOMAIN/immune-guard/version.json?t=$(date +%s)" \
  | grep -o '"tag": "[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [ "$ONLINE" = "$TAG" ]; then
  printf '\033[1;32m完成：线上已是 %s\033[0m\n' "$ONLINE"
  echo "https://$DOMAIN/immune-guard/"
else
  printf '\033[1;33m注意：线上读到 %s，期望 %s（可能有缓存，稍后再看）\033[0m\n' "${ONLINE:-空}" "$TAG"
fi
