#!/usr/bin/env bash
set -e
[ -d node_modules ] || npm i
TOKEN="${TOKEN:-secret123}" PANEL_TOKEN="${PANEL_TOKEN:-panel123}" node server.js
