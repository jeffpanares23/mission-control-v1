#!/bin/bash
# Telegram Poller — PM2 management script
# Usage:
#   ./telegram-poller.sh start     Start the continuous poller
#   ./telegram-poller.sh stop      Stop the continuous poller
#   ./telegram-poller.sh restart   Restart
#   ./telegram-poller.sh logs      Tail logs
#   ./telegram-poller.sh status    Show PM2 status
#   ./telegram-poller.sh once      Run a single poll cycle (manual/test)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="mission-control-telegram-poller"
ECOSYSTEM="$SCRIPT_DIR/ecosystem.telegram.yml"

case "${1:-}" in
  start)
    echo "[telegram-poller] Starting PM2 process..."
    pm2 start "$ECOSYSTEM" --name "$APP_NAME"
    pm2 save
    echo "[telegram-poller] Done. Run './telegram-poller.sh logs' to watch."
    ;;
  stop)
    echo "[telegram-poller] Stopping PM2 process..."
    pm2 stop "$APP_NAME" 2>/dev/null || true
    echo "[telegram-poller] Stopped."
    ;;
  restart)
    echo "[telegram-poller] Restarting PM2 process..."
    pm2 restart "$APP_NAME"
    ;;
  logs)
    pm2 logs "$APP_NAME" --lines 50 --nostream
    ;;
  status)
    pm2 status "$APP_NAME"
    ;;
  once)
    echo "[telegram-poller] Running single poll cycle (no loop)..."
    php artisan telegram:poll --once
    ;;
  monit)
    pm2 monit
    ;;
  *)
    echo "Usage: ./telegram-poller.sh {start|stop|restart|logs|status|once|monit}"
    exit 1
    ;;
esac
