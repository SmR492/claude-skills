import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const market = JSON.parse(readFileSync(join(PLUGIN, 'probes', 'probe-marketplace.json'), 'utf8'));
const repoMarket = JSON.parse(readFileSync(join(PLUGIN, '..', '..', '.claude-plugin', 'marketplace.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));

test('A-6: the template names the marketplace cdp6-probe with the single plugin cdp6-core from the kit copy', () => {
  assert.equal(market.name, 'cdp6-probe');
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, manifest.name);
  assert.equal(market.plugins[0].source, './cdp6-core');
});

test('A-6: the template uses the field names of the repository marketplace file', () => {
  assert.deepEqual(Object.keys(market).sort(), ['metadata', 'name', 'owner', 'plugins']);
  const repoPluginKeys = Object.keys(repoMarket.plugins[0]);
  for (const key of Object.keys(market.plugins[0])) assert.ok(repoPluginKeys.includes(key), key);
  assert.deepEqual(Object.keys(market.owner), Object.keys(repoMarket.owner).filter((k) => k in market.owner));
});
