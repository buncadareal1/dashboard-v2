/**
 * Clear ALL transactional data of 1 project, giữ lại:
 *   - projects row + project_users + project_fanpages + project_ad_accounts
 *   - users, stages, stage_aliases, employees, fanpages, sources
 *
 * Xoá:
 *   - leads, lead_snapshots, lead_stage_events
 *   - campaigns, adsets, ads
 *   - daily_aggregates, monthly_aggregates
 *   - project_costs
 *   - match_conflicts
 *   - csv_uploads
 *
 * Usage: tsx scripts/clear-project-data.ts <project-slug>
 */
import { db } from "../db";
import { projects } from "../db/schema";
import {
  leads,
  leadSnapshots,
  leadStageEvents,
} from "../db/schema/leads";
import { campaigns, adsets, ads } from "../db/schema/ads";
import {
  csvUploads,
  dailyAggregates,
  monthlyAggregates,
  projectCosts,
} from "../db/schema/ops";
import { eq } from "drizzle-orm";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: tsx scripts/clear-project-data.ts <project-slug>");
    process.exit(1);
  }
  const p = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (!p) {
    console.error("Project not found:", slug);
    process.exit(1);
  }
  console.log(`Clearing: ${p.name} (${p.id})`);

  // Order matters — FK cascade some but not all
  const steps: Array<[string, () => Promise<unknown>]> = [
    ["lead_stage_events", () =>
      db.delete(leadStageEvents).where(eq(leadStageEvents.projectId, p.id)),
    ],
    ["lead_snapshots", () =>
      db.delete(leadSnapshots).where(eq(leadSnapshots.projectId, p.id)),
    ],
    // match_conflicts cascades via csv_uploads FK — deleted later
    // daily/monthly aggregates reference campaigns — delete them first
    ["daily_aggregates", () =>
      db.delete(dailyAggregates).where(eq(dailyAggregates.projectId, p.id)),
    ],
    ["monthly_aggregates", () =>
      db.delete(monthlyAggregates).where(eq(monthlyAggregates.projectId, p.id)),
    ],
    ["leads", () => db.delete(leads).where(eq(leads.projectId, p.id))],
    ["ads", () => db.delete(ads).where(eq(ads.projectId, p.id))],
    // adsets cascade qua campaign FK — xoá qua join riêng không tiện;
    // dùng raw: xoá adsets có campaign thuộc project
    ["adsets", async () => {
      const camps = await db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.projectId, p.id));
      if (camps.length === 0) return;
      const ids = camps.map((c) => c.id);
      const { inArray } = await import("drizzle-orm");
      return db.delete(adsets).where(inArray(adsets.campaignId, ids));
    }],
    ["campaigns", () =>
      db.delete(campaigns).where(eq(campaigns.projectId, p.id)),
    ],
    ["project_costs", () =>
      db.delete(projectCosts).where(eq(projectCosts.projectId, p.id)),
    ],
    ["csv_uploads", () =>
      db.delete(csvUploads).where(eq(csvUploads.projectId, p.id)),
    ],
  ];

  for (const [name, fn] of steps) {
    await fn();
    console.log(`  ✓ cleared ${name}`);
  }
  console.log("\n✅ done. Project row + assignments + stages preserved.");
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
