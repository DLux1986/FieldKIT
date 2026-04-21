// schemas/sampleEntrySchema.js
import { z } from "zod";

export const SampleEntrySchema = z.object({
  sampleId: z.string(),
  projectId: z.string(),

  testDate: z.string(),
  testTime: z.string(),

  result: z.enum(["PASS", "FAIL"]),
  notes: z.string(),

  sampleDetails: z.object({
    productType: z.string(),
    manufacturer: z.string(),
    seriesModel: z.string(),
    width_in: z.number().nullable(),
    height_in: z.number().nullable(),
    configuration: z.string()
  }),

  sampleLocation: z.object({
    elevation: z.string(),
    unitNumber: z.string(),
    floorLevel: z.string(),
    description: z.string()
  }),

  testParameters: z.object({
    procedure: z.enum(["A", "B"]),
    pressure_psf: z.number().nullable(),
    pressure_inwc: z.number().nullable(),
    atmosphericTemp_f: z.number().nullable(),
    barometricPressure_inhg: z.number().nullable(),
    windSpeed_mph: z.number().nullable(),
    windDirection: z.string()
  }),

  photos: z.object({
    interiorChamber: z.array(z.string()),
    exteriorRack: z.array(z.string()),
    gauges: z.array(z.string()),
    failureLocation: z.array(z.string())
  }),

  failure: z.object({
    isFailure: z.boolean(),
    cycleFailureOccurred: z.number().nullable(),
    timeOfFailure: z.string(),
    modeOfFailure: z.string(),
    failureLocation: z.string(),
    remediationPerformed: z.boolean().nullable(),
    remediationDescription: z.string()
  })
})
.superRefine((data, ctx) => {
  if (data.result === "FAIL") {
    if (!data.failure.timeOfFailure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Time of Failure is required when result is FAIL",
        path: ["failure", "timeOfFailure"]
      });
    }

    if (!data.failure.modeOfFailure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mode of Failure is required when result is FAIL",
        path: ["failure", "modeOfFailure"]
      });
    }

    if (!data.failure.failureLocation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Failure Location is required when result is FAIL",
        path: ["failure", "failureLocation"]
      });
    }
  }
});
