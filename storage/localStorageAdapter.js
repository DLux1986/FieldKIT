// storage/localStorageAdapter.js

export class LocalStorageAdapter {
  constructor(projectId) {
    this.projectId = projectId;
    this.key = `project_${projectId}_samples`;
  }

  // Load all samples for this project
  loadSamples() {
    return JSON.parse(localStorage.getItem(this.key)) || [];
  }

  // Save a single sample (create or update)
  async saveSample(sample) {
    const samples = this.loadSamples();

    const index = samples.findIndex(s => s.sampleId === sample.sampleId);

    if (index === -1) {
      samples.push(sample);
    } else {
      samples[index] = sample;
    }

    localStorage.setItem(this.key, JSON.stringify(samples));
  }

  // Get next sample number (S##)
  getNextSampleNumber() {
    const samples = this.loadSamples();
    return samples.length + 1;
  }

  // Get next test number (T##) for a given sample
  getNextTestNumber(sampleId) {
    const samples = this.loadSamples();
    const matches = samples.filter(s => s.sampleId.startsWith(sampleId));
    return matches.length + 1;
  }
}
