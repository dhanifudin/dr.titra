#!/usr/bin/env bash
# Wrapper that adds MinGW + LLVM to PATH before starting the Tauri dev server.
# Run with: bash dev.sh  (or: ./dev.sh after chmod +x)
export PATH="/c/Users/dhs/scoop/apps/mingw/current/bin:/c/Users/dhs/scoop/apps/llvm/current/bin:$PATH"
exec npm run tauri dev "$@"
