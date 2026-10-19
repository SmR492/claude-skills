# Concept maturity policy (pointer)

The policy moved into the plugin so that `konzept-lint` and `konzept-reviewer` share one source:

- Source: [`plugins/cdp5-gates/policy/reife-rubrik.policy.md`](../plugins/cdp5-gates/policy/reife-rubrik.policy.md)
- Generated: `plugins/cdp5-gates/policy/reife-rubrik.policy.json` (run `node plugins/cdp5-gates/scripts/generate-rubric.mjs`; CI runs `--check`)

The shipped default threshold is 8.0. This repository's own concept (`konzept.md` §1/§4) sets a project threshold of 9.0; a project copy of the policy carries such a value, the plugin default does not change.
