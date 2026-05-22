---
name: secrets-scan
description: Read-only, dependency-freier Klartext-Secret-Scanner für ein Repo (AWS/OpenAI/GitHub/Slack/Google-Keys, Private Keys, JWTs, Secret-Assignments, .env-Leaks). Use bei „secrets scan", „keine Secrets im Repo prüfen", vor Commit/Release, als CI-Gate.
---

# secrets-scan (CDP5 T1-Gate, §33.5)

Dependency-frei (nur `node:`-Builtins), daher überall lauffähig wo Node ist. Read-only Detektor; redacted-Output. Ergänzt — ersetzt nicht — spezialisierte Tools (gitleaks/trufflehog).

## Aufruf

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/secrets-scan/secrets-scan.mjs" --repo=<root> [--json]
```

Exit: `0` sauber · `1` ≥1 Fund · `2` Nutzungsfehler.

## Erkennung

Bekannte Key-Formate (AKIA…, `sk-…`, `ghp_…`, `xox…`, `AIza…`), Private-Key-Blöcke, JWTs und Secret-Assignments (`api_key/secret/token/password = …`). Placeholder (`${…}`, `your_…`, `changeme`, `<…>`) werden ignoriert. Funde werden **redacted** ausgegeben (kein Klartext-Leak im Report). `node_modules`/`vendor`/`.git` etc. übersprungen, Dateien > 1 MB übersprungen.
