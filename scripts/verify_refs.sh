#!/bin/bash
# 验证所有 HTML 文件中的本地引用是否指向真实存在的文件
# 用法: bash scripts/verify_refs.sh
set +e
errors=0
checked=0

check_refs() {
  local file="$1"
  local dir
  dir=$(dirname "$file")
  # 提取所有 href/src 指向本地资源（非 http/非 #/非 mailto/非 data:）的引用
  local refs
  refs=$(grep -oE '(href|src)="[^"]+"' "$file" \
        | sed -E 's/.*="([^"]+)"/\1/' \
        | grep -vE '^(https?:|//|#|mailto:|data:|tel:|javascript:)' \
        | sort -u)
  for r in $refs; do
    checked=$((checked+1))
    local target="$dir/$r"
    # 规范化路径（消除 ./ 和 ../）
    local real
    real=$(cd "$dir" 2>/dev/null && realpath -m -- "$r" 2>/dev/null)
    if [ -z "$real" ] || [ ! -e "$real" ]; then
      echo "  [缺失] $file -> $r"
      errors=$((errors+1))
    fi
  done
}

echo "=== 引用完整性验证 ==="
for f in index.html pages/*.html pages/contact/*.html pages/web_ku/*.html; do
  [ -f "$f" ] && check_refs "$f"
done

# 额外检查 web_ku.js 中硬编码的 index.html 引用
echo "=== web_ku.js 硬编码引用检查 ==="
if grep -q "setAttribute('href', 'index.html')" pages/web_ku/web_ku.js 2>/dev/null; then
  echo "  [警告] web_ku.js 仍存在未修正的 'index.html' 硬编码引用"
  errors=$((errors+1))
else
  echo "  OK: web_ku.js 中 index.html 引用已修正为相对路径"
fi

# 检查 watermark_tool 的 ZIP_LIB_PATH
echo "=== watermark_tool ZIP_LIB_PATH 检查 ==="
zip_path=$(grep -oE "ZIP_LIB_PATH: '[^']+'" pages/watermark_tool.html | sed -E "s/ZIP_LIB_PATH: '([^']+)'/\1/")
if [ -n "$zip_path" ]; then
  checked=$((checked+1))
  if [ -f "pages/$zip_path" ]; then
    echo "  OK: $zip_path 存在"
  else
    echo "  [缺失] pages/watermark_tool.html -> $zip_path"
    errors=$((errors+1))
  fi
fi

echo ""
echo "=== 汇总 ==="
echo "检查引用数: $checked"
echo "缺失/错误: $errors"
if [ "$errors" -eq 0 ]; then
  echo "结论: 全部引用有效 ✓"
  exit 0
else
  echo "结论: 存在失效引用 ✗"
  exit 1
fi
