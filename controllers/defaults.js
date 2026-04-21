// defaults.js

export const createEmptySampleEntry = (projectId = "") => ({
  sampleId: "",
  projectId,

  testDate: "",
  testTime: "",

  result: "PASS",
  notes: "",

  sampleDetails: {
    productType: "",
    manufacturer: "",
    seriesModel: "",
    width_in: null,
    height_in: null,
    configuration: ""
  },

  sampleLocation: {
    elevation: "",
    unitNumber: "",
    floorLevel: "",
    description: ""
  },

  testParameters: {
    procedure: "A",
    pressure_psf: null,
    pressure_inwc: null,
    atmosphericTemp_f: null,
    barometricPressure_inhg: null,
    windSpeed_mph: null,
    windDirection: ""
  },

  photos: {
    interiorChamber: [],
    exteriorRack: [],
    gauges: [],
    failureLocation: []
  },

  failure: {
    isFailure: false,
    cycleFailureOccurred: null,
    timeOfFailure: "",
    modeOfFailure: "",
    failureLocation: "",
    remediationPerformed: null,
    remediationDescription: ""
  }
});
