import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processCsvUpload } from "@/inngest/functions/process-csv-upload";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processCsvUpload],
});
