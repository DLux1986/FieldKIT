// controllers/sample-entry-controller.js
import { SampleEntrySchema } from "../schemas/sampleEntrySchema.js";
import { createEmptySampleEntry } from "../defaults.js";
import { generateSampleId } from "./idGenerator.js";

export class SampleEntryController {
  constructor(projectId, storage) {
    this.projectId = projectId;
    this.storage = storage; // saveSample(data)
    this.state = createEmptySampleEntry(projectId);

    console.log("🧪 FieldKIT SampleEntryController initialized");
  }

  // -------------------------------------------------------
  // Update a nested field using dot-path notation
  // -------------------------------------------------------
  updateField(path, value) {
    const segments = path.split(".");
    let obj = this.state;

    while (segments.length > 1) {
      obj = obj[segments.shift()];
    }

    obj[segments[0]] = value;

    // Auto-toggle failure block
    if (path === "result") {
      this.state.failure.isFailure = value === "FAIL";
    }
  }

  // -------------------------------------------------------
  // Add a photo to a category (interior, exterior, gauges, failure)
  // -------------------------------------------------------
  addPhoto(category, url) {
    if (!this.state.photos[category]) {
      console.warn("Unknown photo category:", category);
      return;
    }
    this.state.photos[category].push(url);
  }

  // -------------------------------------------------------
  // Assign Sample ID using your deterministic generator
  // -------------------------------------------------------
  assignSampleId(productType, sampleNumber, testNumber) {
    const id = generateSampleId({
      projectId: this.projectId,
      productType,
      sampleNumber,
      testNumber
    });

    this.state.sampleId = id;
    return id;
  }

  // -------------------------------------------------------
  // Validate using Zod
  // -------------------------------------------------------
  validate() {
    return SampleEntrySchema.safeParse(this.state);
  }

  // -------------------------------------------------------
  // Save sample using injected storage layer
  // -------------------------------------------------------
  async save() {
    const result = this.validate();

    if (!result.success) {
      console.error("❌ Validation failed:", result.error);
      return { success: false, errors: result.error };
    }

    await this.storage.saveSample(result.data);

    console.log("💾 Sample saved:", result.data.sampleId);

    return { success: true };
  }
}
