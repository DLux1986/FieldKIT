import assert from 'node:assert/strict';
import { generateSampleId, formatSampleId } from '../controllers/idGenerator.js';

const tests = [
  {
    name: 'builds a storefront sample id with sample and test numbers',
    input: { systemType: 'STFR', sampleNumber: 1, testNumber: 1 },
    expected: 'STFR-S01T01'
  },
  {
    name: 'builds a curtain wall fixed sample id and increments test number',
    input: { systemType: 'CWFX', sampleNumber: 3, testNumber: 2 },
    expected: 'CWFX-S03T02'
  }
];

for (const testCase of tests) {
  const actual = generateSampleId(testCase.input.systemType, testCase.input.sampleNumber, testCase.input.testNumber);
  assert.equal(actual, testCase.expected, testCase.name);
}

assert.equal(formatSampleId('STFR-S01T01'), 'STFR-S01T01');
assert.equal(formatSampleId({ systemType: 'CWFX', sampleNumber: 3, testNumber: 2 }), 'CWFX-S03T02');
assert.equal(formatSampleId({ window_type: 'STFR', sample_number: 1, test_number: 1 }), 'STFR-S01T01');
assert.equal(formatSampleId('7'), 'S07');

console.log('sample-id-generator tests passed');
