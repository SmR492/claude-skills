#!/bin/sh
# A committed repository with one claim to verify: review-verify requires a commit as the target state.
set -e
printf '# Demo service\n\nRequirements: Node.js 20 or later and git.\n\nRun `node src/index.mjs`.\n' > README.md
mkdir -p src
printf 'console.log("ok");\n' > src/index.mjs
git init -q
git add README.md src/index.mjs
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "initial"
