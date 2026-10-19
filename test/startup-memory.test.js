'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('startup automatically restores shared library without competing country boot', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  const domReady = source.slice(source.indexOf("window.addEventListener('DOMContentLoaded'"), source.indexOf('window.__piVintageTv'));
  assert.match(domReady, /bootFromServer\(\)/);
  assert.doesNotMatch(domReady, /loadCountry\(currentCountry\)/);
  assert.match(source, /if \(st && Number\(st\.total\) > 0\)\s*\{\s*await fetchUserState\(\);\s*await loadLibraryIntoTv\(\{ automatic: true \}\);/);
  assert.match(domReady, /setPower\(false\)/);
  const sw = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
  assert.match(sw, /pi-vintage-tv-v1\.9\.\d+/);
  assert.match(source, /setPower\(true\);\s*applyLanguage\(\);\s*\}\)\(\);/);
});
