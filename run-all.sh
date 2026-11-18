#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

free_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "$port/tcp" 2>/dev/null | tr -d ' ' || true)"
  else
    echo "[vms] lsof/fuser not found; skipping cleanup for port $port"
    return 0
  fi

  if [[ -n "${pids:-}" ]]; then
    echo "[vms] stopping existing processes on port $port: $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    sleep 0.4
  fi
}

kill_pid_tree() {
  local pid="$1"
  local children=""
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  local child
  for child in $children; do
    kill_pid_tree "$child"
  done
  kill -9 "$pid" 2>/dev/null || true
}

stop_app() {
  local name="$1"
  local port="$2"
  local pid_file="$LOG_DIR/$name.pid"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(tr -d '[:space:]' <"$pid_file" || true)"
    if [[ -n "${pid:-}" ]]; then
      echo "[vms] stopping $name (pid $pid)"
      kill_pid_tree "$pid"
    fi
    rm -f "$pid_file"
  else
    echo "[vms] no pid file for $name"
  fi

  free_port "$port"
}

launch_app() {
  local name="$1"
  local dir="$2"
  local cmd="$3"
  local port="$4"
  local log_file="$LOG_DIR/$name.log"

  free_port "$port"
  echo "[vms] starting $name on port $port"
  (
    cd "$ROOT_DIR/$dir"
    nohup bash -lc "$cmd" >"$log_file" 2>&1 &
    echo $! >"$LOG_DIR/$name.pid"
  )
  local pid
  pid="$(cat "$LOG_DIR/$name.pid")"
  if kill -0 "$pid" 2>/dev/null; then
    echo "[vms] $name started with pid $pid"
    echo "[vms] logs: $log_file"
  else
    echo "[vms] $name failed to start; see $log_file"
  fi
}

start_all() {
  launch_app "vms-frontend" "frontend" "npm run dev" 5930
  launch_app "vms-backend" "backend" "npm run dev:local" 5931
  launch_app "career-be" "career-be" "npm run dev" 9690
  launch_app "career-fe" "career-fe" "npm run dev" 9692

  echo "[vms] all apps launched in background"
  echo "[vms] frontend: http://localhost:5930"
  echo "[vms] backend:  http://localhost:5931"
  echo "[vms] career-be: http://localhost:9690"
  echo "[vms] career-fe: http://localhost:9692"
  echo "[vms] log directory: $LOG_DIR"
}

stop_all() {
  stop_app "vms-frontend" 5930
  stop_app "vms-backend" 5931
  stop_app "career-be" 9690
  stop_app "career-fe" 9692
  echo "[vms] all apps stopped"
}

usage() {
  echo "usage: $0 [start|stop|kill]"
}

case "${1:-start}" in
  start)
    start_all
    ;;
  stop|kill)
    stop_all
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "[vms] unknown command: $1"
    usage
    exit 1
    ;;
esac
