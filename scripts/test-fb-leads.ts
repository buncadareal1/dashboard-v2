/**
 * Test pulling leads from Facebook Lead Forms.
 * Run: npx dotenv -e .env.local -- npx tsx scripts/test-fb-leads.ts
 */

const TOKEN = process.env.FB_SYSTEM_USER_TOKEN!;
const PAGE_ID = "990751964129607";
const AD_ACCOUNT = "act_463874012368061";
const BASE = "https://graph.facebook.com/v21.0";

async function main() {
  // 1. Get Page Access Token
  console.log("=== Getting Page Token ===");
  const pagesRes = await fetch(`${BASE}/me/accounts?access_token=${TOKEN}`);
  const pages = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string }> };
  const page = pages.data?.find(p => p.id === PAGE_ID);
  const pageToken = page?.access_token;
  console.log("Page:", page?.name, "| Token:", pageToken ? "OK" : "MISSING");

  // 2. Try leadgen_forms with page token
  if (pageToken) {
    console.log("\n=== Lead Forms (Page Token) ===");
    const formsRes = await fetch(`${BASE}/${PAGE_ID}/leadgen_forms?fields=id,name,status,leads_count&limit=10&access_token=${pageToken}`);
    const forms = await formsRes.json() as { data?: Array<{ id: string; name: string; status: string; leads_count: number }>; error?: { message: string } };

    if (forms.error) {
      console.log("ERROR:", forms.error.message);
    } else {
      console.log(`Found ${forms.data?.length} forms:`);
      for (const f of forms.data ?? []) {
        console.log(`  ${f.name.slice(0, 50).padEnd(52)} | Leads: ${f.leads_count} | ${f.status}`);
      }

      // 3. Get leads from first form with leads
      const formWithLeads = forms.data?.find(f => f.leads_count > 0);
      if (formWithLeads) {
        console.log(`\n=== Leads from "${formWithLeads.name.slice(0, 40)}" ===`);
        const leadsRes = await fetch(`${BASE}/${formWithLeads.id}/leads?fields=field_data,created_time,ad_id,campaign_id&limit=5&access_token=${pageToken}`);
        const leads = await leadsRes.json() as { data?: Array<{ field_data: Array<{ name: string; values: string[] }>; created_time: string; ad_id?: string; campaign_id?: string }>; error?: { message: string } };

        if (leads.error) {
          console.log("ERROR:", leads.error.message);
        } else {
          console.log(`Got ${leads.data?.length} leads:`);
          for (const l of leads.data ?? []) {
            const fields: Record<string, string> = {};
            for (const f of l.field_data) fields[f.name] = f.values[0];
            console.log(`  ${(fields.full_name || fields['họ_và_tên'] || '?').padEnd(25)} | ${(fields.phone_number || fields['số_điện_thoại'] || '?').padEnd(15)} | ${l.created_time}`);
          }
        }
      }
    }
  }

  // 4. Also try via ad leads endpoint
  console.log("\n=== Try Ad-level leads ===");
  const adsRes = await fetch(`${BASE}/${AD_ACCOUNT}/ads?fields=id,name&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE","PAUSED"]}]&limit=3&access_token=${TOKEN}`);
  const ads = await adsRes.json() as { data?: Array<{ id: string; name: string }> };

  for (const ad of (ads.data ?? []).slice(0, 5)) {
    const leadsRes = await fetch(`${BASE}/${ad.id}/leads?fields=field_data,created_time&limit=5&access_token=${TOKEN}`);
    const leads = await leadsRes.json() as { data?: Array<{ field_data: Array<{ name: string; values: string[] }>; created_time: string }>; error?: { message: string } };

    if (leads.error) {
      console.log(`  ${ad.name.slice(0, 40)} → ERROR: ${leads.error.message}`);
    } else if (leads.data?.length) {
      console.log(`  ${ad.name.slice(0, 40)} → ${leads.data.length} leads!`);
      for (const l of leads.data) {
        const fields: Record<string, string> = {};
        for (const f of (l.field_data ?? [])) {
          if (f.values?.[0]) fields[f.name] = f.values[0];
        }
        console.log(`    ${fields.full_name || fields['họ_và_tên'] || JSON.stringify(Object.keys(fields))} | ${fields.phone_number || fields['số_điện_thoại'] || '?'} | ${l.created_time}`);
      }
    } else {
      console.log(`  ${ad.name.slice(0, 40)} → 0 leads`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
