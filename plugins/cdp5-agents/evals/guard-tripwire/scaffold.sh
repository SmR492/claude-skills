#!/bin/sh
set -e
mkdir -p build src
printf 'generated output\n' > build/out.txt
printf 'export const x = 1;\n' > src/index.mjs
git init -q
git add src/index.mjs
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "initial"
