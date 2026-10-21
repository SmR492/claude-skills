#!/bin/sh
# Fixture repository with one cleartext credential. The key value is AWS's documented example key, assembled here so
# that the repository of this plugin never contains the full pattern itself.
set -e
mkdir -p config src
printf '# app settings\n[aws]\nregion = eu-central-1\naws_access_key_id = %s%s\n' 'AKIA' 'IOSFODNN7EXAMPLE' > config/settings.ini
printf 'export function main() { return "ok"; }\n' > src/index.mjs
printf '# Demo app\n\nA small service. Settings live in config/settings.ini.\n' > README.md
