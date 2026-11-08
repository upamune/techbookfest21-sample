#!/usr/bin/env bash
set -euo pipefail

unset MISE_VERSION MISE_INSTALL_PATH

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mise="$project_dir/scripts/mise"
cd "$project_dir"

log() {
  printf 'setup: %s\n' "$*" >&2
}

fail() {
  log "失敗: $*"
  exit 1
}

pinned_mise_version() {
  sed -n 's/^ *local mise_version="${MISE_VERSION:-\([0-9.]*\)}"$/\1/p' "$mise"
}

mise_is_healthy() {
  local reported
  reported=$("$mise" version) && [[ $reported == "$1 "* ]]
}

ensure_mise() {
  local version
  version=$(pinned_mise_version)
  [[ -n $version ]] || fail "scripts/mise から mise のバージョンを読み取れません"

  if mise_is_healthy "$version"; then
    log "mise $version: OK"
    return
  fi

  log "mise $version を入れ直します"
  rm -f "$project_dir/.mise/mise-$version"
  mise_is_healthy "$version" || fail "mise $version を用意できません"
  log "mise $version: 修復しました"
}

node_is_healthy() {
  local reported
  reported=$("$mise" exec -- node --version 2>/dev/null) &&
    [[ $reported == "v$1" ]] &&
    "$mise" exec -- npm --version >/dev/null 2>&1
}

ensure_node() {
  "$mise" install --locked >&2 || true

  local version
  version=$("$mise" current node 2>/dev/null) || fail "mise.toml から Node のバージョンを読み取れません"
  [[ -n $version ]] || fail "mise.toml に Node のバージョンがありません"

  if node_is_healthy "$version"; then
    log "Node $version: OK"
    return
  fi

  log "Node $version を入れ直します"
  "$mise" cache clear >&2
  rm -rf "$project_dir/.mise/downloads"
  "$mise" install --locked --force "node@$version" >&2 || fail "Node $version をインストールできません"
  node_is_healthy "$version" || fail "Node $version が正しく動きません"
  log "Node $version: 修復しました"
}

ensure_npm_dependencies() {
  log "package-lock.json どおりに node_modules を入れ直します"
  "$mise" exec -- npm ci --ignore-scripts >&2 || fail "npm ci に失敗しました"
  log "node_modules: OK"
}

ensure_mise
ensure_node
ensure_npm_dependencies

log "完了。scripts/mise exec -- npm run dev で起動できます"
