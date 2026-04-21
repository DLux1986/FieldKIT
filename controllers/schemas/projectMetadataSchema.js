// schemas/projectMetadataSchema.js
import { z } from "zod";

export const ProjectMetadataSchema = z.object({
  testDate: z.string().optional(),
  technicians: z.string().optional(),
  witnesses: z.string().optional(),
  temp_f: z.number().optional(),
  wind_mph: z.number().optional(),
  wind_dir: z.string().optional(),
  barometric: z.number().optional()
});
