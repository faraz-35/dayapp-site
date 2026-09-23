#!/bin/sh
# DayApp installer — no security dialogs.
#
#   curl -fsSL https://getdayapp.vercel.app/install.sh | sh
#
# Downloads DayApp from the latest GitHub release and installs it to
# /Applications. Files fetched with curl carry no Gatekeeper quarantine
# stamp, so the app opens without the "damaged" wall that browser
# downloads hit on Apple Silicon. Your tasks live in ~/Library
# and are never touched by this script.

set -eu

DOWNLOAD_URL="https://github.com/faraz-35/dayapp/releases/latest/download/DayApp.app.tar.gz"

say() { printf '%s\n' "▸ $*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "this installer is for macOS"
[ "$(uname -m)" = "arm64" ] || die "DayApp is Apple Silicon only — this Mac is $(uname -m)"

# A running DayApp holds the old bundle; quit it gracefully first.
osascript -e 'tell application id "com.farazshah.dayapp" to quit' >/dev/null 2>&1 || true

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say "downloading the latest release"
curl -fSL --progress-bar -o "$TMP/DayApp.app.tar.gz" "$DOWNLOAD_URL"

say "unpacking"
tar -xzf "$TMP/DayApp.app.tar.gz" -C "$TMP"
[ -d "$TMP/DayApp.app" ] || die "unexpected archive layout — nothing was installed"

if [ -d /Applications/DayApp.app ]; then
  say "removing the previous install (your data in ~/Library stays)"
  rm -rf /Applications/DayApp.app
fi
say "installing to /Applications"
if mkdir -p /Applications 2>/dev/null && cp -R "$TMP/DayApp.app" /Applications/; then
  :
else
  mkdir -p "$HOME/Applications"
  cp -R "$TMP/DayApp.app" "$HOME/Applications/"
  say "/Applications was not writable — installed to ~/Applications instead"
fi

say "done — open DayApp from Applications. No dialogs: this download was never quarantined."
