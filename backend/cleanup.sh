#!/bin/bash

# Apple Music temporary file cleanup script
# Runs automatically at 03:00 Asia/Shanghai time

# Resolve working directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$SCRIPT_DIR/temp"

# Log file
LOG_FILE="$SCRIPT_DIR/cleanup.log"

# Log helper
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "========== 开始清理任务 =========="

# Check whether the temporary directory exists
if [ ! -d "$TEMP_DIR" ]; then
    log "临时目录不存在: $TEMP_DIR"
    exit 0
fi

# Count files before cleanup
BEFORE_COUNT=$(find "$TEMP_DIR" -type f | wc -l)
log "清理前文件数量: $BEFORE_COUNT"

# Clear the temporary directory
rm -rf "$TEMP_DIR"/*

# Count files after cleanup
AFTER_COUNT=$(find "$TEMP_DIR" -type f 2>/dev/null | wc -l)
log "清理后文件数量: $AFTER_COUNT"

DELETED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))
log "删除了 $DELETED_COUNT 个文件"

log "========== 清理任务完成 =========="
log ""

exit 0
