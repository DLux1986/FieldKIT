// storage/indexedDbAdapter.js

export class IndexedDbAdapter {
  constructor(projectId) {
    this.projectId = projectId;
    this.dbName = `fieldkit_${projectId}`;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("samples")) {
          db.createObjectStore("samples", { keyPath: "sampleId" });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSample(sample) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("samples", "readwrite");
      tx.objectStore("samples").put(sample);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }

  async loadSamples() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("samples", "readonly");
      const req = tx.objectStore("samples").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = reject;
    });
  }
}
