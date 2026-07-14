import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseIcs } from '../assets/js/ics-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

test('parseIcs normalizes onsite contact headings', () => {
  const fixture = loadFixture('ics-contact-regression.ics');
  const events = parseIcs(fixture);

  assert.equal(events.length, 2, 'expected two events in fixture');

  for (const ev of events) {
    assert.match(ev.description, /Contact-\s*/m, 'contact heading should normalize to Contact-');
    assert.doesNotMatch(ev.description, /Onsite\s+Contact|On\s*site\s+contact/i, 'onsite variants should not remain');
  }
});
