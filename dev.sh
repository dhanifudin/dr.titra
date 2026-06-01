#!/usr/bin/env bash
set -euo pipefail

# Use the native host toolchain by default. On Windows shells like Git Bash,
# optionally add Scoop-managed toolchains when they are available.
append_path_if_dir() {
  if [ -d "$1" ]; then
    export PATH="$1:$PATH"
  fi
}

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    # lld-link (LLVM) is the MSVC-compatible linker used by the stable toolchain
    append_path_if_dir "/c/Users/dhs/scoop/apps/llvm/current/bin"
    ;;
  Linux*)
    # linuxdeploy AppImage bundles an old strip that can't parse newer ELF .relr.dyn sections
    export APPIMAGE_EXTRACT_AND_RUN=1
    export NO_STRIP=1
    ;;
esac

exec npm run tauri dev "$@"
