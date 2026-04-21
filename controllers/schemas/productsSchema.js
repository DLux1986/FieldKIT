// schemas/productsSchema.js
import { z } from "zod";

export const ProductSchema = z.object({
  type: z.string(),          // e.g., AWNG, STFR
  manufacturer: z.string(),  // e.g., Milgard
  models: z.array(z.string()) // e.g., ["Tuscany", "Trinsic"]
});

export const ProductsSchema = z.array(ProductSchema);
