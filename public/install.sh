#!/bin/sh
# DayApp installer — macOS and Linux, no security dialogs.
#
#   curl -fsSL https://getdayapp.vercel.app/install.sh | sh
#
# Detects the platform and installs the right build:
#   macOS — the latest release .app into /Applications. Files fetched with
#           curl carry no Gatekeeper quarantine stamp, so the app opens
#           without the "damaged" wall browser downloads hit on Apple Silicon.
#   Linux — the AppImage from the rolling linux-dev release into ~/.local/bin.
#           Needs webkit2gtk-4.1 (the script names the install command if
#           it's missing). Linux tracks the dev channel until it joins the
#           versioned release channel.
# Your tasks live in the app's data dir and are never touched by this script.

set -eu

say() { printf '%s\n' "▸ $*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

OS="$(uname -s)"
ARCH="$(uname -m)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ "$OS" = "Darwin" ]; then
  # ---- macOS ----------------------------------------------------------
  [ "$ARCH" = "arm64" ] || die "DayApp is Apple Silicon only — this Mac is $ARCH"

  # A running DayApp holds the old bundle; quit it gracefully first.
  osascript -e 'tell application id "com.farazshah.dayapp" to quit' >/dev/null 2>&1 || true

  say "downloading the latest release"
  curl -fSL --progress-bar -o "$TMP/DayApp.app.tar.gz" \
    "https://github.com/faraz-35/dayapp/releases/latest/download/DayApp.app.tar.gz"

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

elif [ "$OS" = "Linux" ]; then
  # ---- Linux ----------------------------------------------------------
  [ "$ARCH" = "x86_64" ] || die "DayApp Linux is x86_64 only — this machine is $ARCH"

  # WebKitGTK 4.1 is the one runtime dependency (the AppImage doesn't bundle it).
  if ! ldconfig -p 2>/dev/null | grep -q libwebkit2gtk-4.1; then
    die "missing webkit2gtk-4.1 — install it first:
    Arch/Omarchy:   sudo pacman -S webkit2gtk-4.1
    Debian/Ubuntu:  sudo apt install libwebkit2gtk-4.1-0"
  fi

  say "resolving the latest Linux build"
  ASSET_URL="$(curl -fsSL https://api.github.com/repos/faraz-35/dayapp/releases/tags/linux-dev \
    | grep -o 'https://[^"]*\.AppImage' | head -1)"
  [ -n "$ASSET_URL" ] || die "no Linux build found — is the linux-dev release up?"

  say "downloading DayApp"
  curl -fSL --progress-bar -o "$TMP/DayApp.AppImage" "$ASSET_URL"
  chmod +x "$TMP/DayApp.AppImage"

  say "installing to ~/.local/bin/DayApp.AppImage"
  mkdir -p "$HOME/.local/bin"
  mv "$TMP/DayApp.AppImage" "$HOME/.local/bin/DayApp.AppImage"
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) say "note: ~/.local/bin is not on your PATH — add it, or run the file by full path" ;;
  esac

  say "done — run it with: DayApp.AppImage"

else
  die "unsupported platform: $OS (DayApp is macOS and Linux)"
fi
