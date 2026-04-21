// storage/memoryAdapter.js

export class MemoryAdapter {
  constructor() {
    this.samples = [];
  }

  loadSamples() {
    return this.samples;
  }

  async saveSample(sample) {
    const index = this.samples.findIndex(s => s.sampleId === sample.sampleId);

    if (index === -1) {
      this.samples.push(sample);
    } else {
      this.samples[index] = sample;
    }
  }

  getNextSampleNumber() {
    return this.samples.length + 1;
  }

  getNextTestNumber(sampleId) {
    const matches = this.samples.filter(s => s.sampleId.startsWith(sampleId));
    return matches.length + 1;
  }
}
