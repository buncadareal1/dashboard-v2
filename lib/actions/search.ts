"use server";

import { sql, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getAccessibleProjectIds } from "@/lib/auth/guards";

export type SearchResult = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  status: "running" | "warning" | "paused";
};

export async function searchProjectsAction(
  query: string,
): Promise<SearchResult[]> {
  const user = await getSessionUser();
  if (!user) return [];
  if (!query || query.trim().length < 2) return [];

  const accessible = await getAccessibleProjectIds(user.id, user.role);

  const conditions = [
    isNull(projects.deletedAt),
    sql`${projects.name} ILIKE ${"%" + query.trim() + "%"}`,
  ];
  if (accessible !== null) {
    if (accessible.length === 0) return [];
    conditions.push(inArray(projects.id, accessible));
  }

  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      location: projects.location,
      status: projects.status,
    })
    .from(projects)
    .where(and(...conditions))
    .limit(8);

  return rows as SearchResult[];
}
