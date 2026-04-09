import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processCsvUpload } from "@/inngest/functions/process-csv-upload";
import { nightlySnapshot } from "@/inngest/functions/nightly-snapshot";
import { nightlyArchive } from "@/inngest/functions/nightly-archive";
import { rebuildAggregates } from "@/inngest/functions/rebuild-aggregates";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processCsvUpload,
    nightlySnapshot,
    nightlyArchive,
    rebuildAggregates,
  ],
});
