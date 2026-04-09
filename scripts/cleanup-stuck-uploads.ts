import { db } from "../db";
import { csvUploads } from "../db/schema";
import { ne } from "drizzle-orm";

async function main() {
  await db
    .update(csvUploads)
    .set({
      status: "failed",
      errorLog: { error: "Stuck — cleaned by maintenance script" },
      finishedAt: new Date(),
    })
    .where(ne(csvUploads.status, "done"));
  console.log("✓ Cleaned stuck uploads");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
