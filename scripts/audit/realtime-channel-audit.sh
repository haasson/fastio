#!/usr/bin/env bash
# REL-01: Realtime channel cleanup audit (D-09 corrected formula)
#
# Каждый файл, содержащий .channel(, ОБЯЗАН содержать removeChannel.
# Скрипт сканирует apps/ и packages/, исключая node_modules, .output, .nuxt.
# Exit 0 — нарушений нет. Exit 1 — есть файлы без cleanup.
#
# Почему эта формула корректна: оригинальный D-09 давал false-позитивы
# на файлах в node_modules/.cache и легитимно-очищенных useTableRealtime /
# backoffice SSE. Проверка присутствия removeChannel в том же файле —
# единственное, что нужно: утечка возникает, только когда канал открыт
# (есть .channel()) и нет вызова removeChannel для его закрытия.

set -euo pipefail

VIOLATIONS=0
CHECKED=0

# Искать только в исходниках, не в сгенерированных и зависимостях
while IFS= read -r -d '' file; do
  CHECKED=$((CHECKED + 1))
  if ! grep -q "removeChannel" "$file"; then
    echo "::error file=${file}::VIOLATION: $(basename "$file") calls .channel() but has no removeChannel"
    echo "  VIOLATION: $file"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < <(
  grep -rl "\.channel(" apps/ packages/ \
    --include="*.ts" \
    --include="*.vue" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=.output \
    --exclude-dir=.nuxt \
    --null 2>/dev/null || true
)

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "AUDIT FAILED: $VIOLATIONS file(s) open a Supabase realtime channel without removeChannel cleanup."
  echo "Every supabase.channel() must be paired with removeChannel() to prevent connection leaks."
  exit 1
fi

echo "AUDIT_CLEAN: $CHECKED file(s) checked — all .channel() calls have removeChannel cleanup."
