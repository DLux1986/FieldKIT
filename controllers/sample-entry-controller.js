// controllers/sample-entry-controller.js
import { SampleEntrySchema } from "./schemas/sampleEntrySchema.js";
import { createEmptySampleEntry } from "./defaults.js";

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
  normalizeValue(path, value) {
    if (path === "sampleId") {
      return String(value ?? "");
    }

    if ([
      "sampleDetails.width_in",
      "sampleDetails.height_in",
      "testParameters.pressure_psf",
      "testParameters.pressure_inwc",
      "testParameters.atmosphericTemp_f",
      "testParameters.barometricPressure_inhg",
      "testParameters.windSpeed_mph",
      "failure.cycleFailureOccurred"
    ].includes(path)) {
      if (value === "" || value === null || value === undefined) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (path === "failure.remediationPerformed") {
      if (value === "" || value === null || value === undefined) return null;
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
    }

    return value;
  }

  updateField(path, value) {
    const segments = path.split(".");
    let obj = this.state;

    while (segments.length > 1) {
      obj = obj[segments.shift()];
    }

    obj[segments[0]] = this.normalizeValue(path, value);

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
  // Validate using Zod
  // -------------------------------------------------------
  validate() {
    const normalizedState = JSON.parse(JSON.stringify(this.state));
    Object.entries(normalizedState).forEach(([key, value]) => {
      if (key === "sampleId") {
        normalizedState.sampleId = String(value ?? "");
      }
    });

    return SampleEntrySchema.safeParse(normalizedState);
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


    return { success: true };
  }
}
