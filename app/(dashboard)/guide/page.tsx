import { readFileSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default async function GuidePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Read markdown at build/request time
  let content = "";
  try {
    content = readFileSync(
      join(process.cwd(), "docs", "USER-GUIDE.md"),
      "utf-8",
    );
  } catch {
    content = "# Hướng dẫn sử dụng\n\nĐang cập nhật...";
  }

  // Simple markdown → HTML (headings, bold, lists, code, links, hr)
  const html = markdownToHtml(content);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Hướng dẫn sử dụng</h1>
          <p className="text-sm text-muted-foreground">
            Tài liệu hướng dẫn cho nhân viên mới
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none pt-6">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Minimal markdown → HTML converter (no dependencies).
 * Supports: headings, bold, italic, code blocks, inline code, lists, links, hr, paragraphs.
 */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push("</code></pre>");
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        out.push('<pre class="rounded-lg bg-zinc-50 p-4 text-xs overflow-x-auto border"><code>');
      }
      continue;
    }
    if (inCodeBlock) {
      out.push(escapeHtml(line));
      out.push("\n");
      continue;
    }

    // Close list if line is not a list item
    if (inList && !line.match(/^[\s]*[-*\d]/) && line.trim() !== "") {
      out.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }

    // HR
    if (line.match(/^---+$/)) {
      out.push('<hr class="my-6 border-zinc-200" />');
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = inlineFormat(hMatch[2]);
      const sizes = ["", "text-2xl font-bold mt-8 mb-4", "text-xl font-semibold mt-6 mb-3", "text-lg font-semibold mt-5 mb-2", "text-base font-semibold mt-4 mb-2", "text-sm font-semibold mt-3 mb-1", "text-sm font-medium mt-2 mb-1"];
      out.push(`<h${level} class="${sizes[level]}">${text}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (ulMatch) {
      if (!inList) { out.push('<ul class="list-disc pl-6 space-y-1 my-2">'); inList = true; listType = "ul"; }
      out.push(`<li class="text-sm">${inlineFormat(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+[.)]\s+(.*)/);
    if (olMatch) {
      if (!inList) { out.push('<ol class="list-decimal pl-6 space-y-1 my-2">'); inList = true; listType = "ol"; }
      out.push(`<li class="text-sm">${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      if (inList) { out.push(listType === "ul" ? "</ul>" : "</ol>"); inList = false; }
      continue;
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      // Check if next line is separator
      const nextLine = lines[i + 1] ?? "";
      if (nextLine.match(/^\|[\s-:|]+\|$/)) {
        // Start table
        out.push('<div class="overflow-x-auto my-4"><table class="min-w-full text-sm border">');
        // Header
        const headers = line.split("|").filter(Boolean).map(c => c.trim());
        out.push("<thead><tr>");
        headers.forEach(h => out.push(`<th class="border px-3 py-2 bg-zinc-50 font-medium text-left">${inlineFormat(h)}</th>`));
        out.push("</tr></thead><tbody>");
        i++; // Skip separator line
        // Body rows
        for (let j = i + 1; j < lines.length; j++) {
          if (!lines[j].includes("|") || !lines[j].trim().startsWith("|")) { i = j - 1; break; }
          const cells = lines[j].split("|").filter(Boolean).map(c => c.trim());
          out.push("<tr>");
          cells.forEach(c => out.push(`<td class="border px-3 py-2">${inlineFormat(c)}</td>`));
          out.push("</tr>");
          i = j;
        }
        out.push("</tbody></table></div>");
        continue;
      }
    }

    // Paragraph
    out.push(`<p class="text-sm leading-relaxed my-2">${inlineFormat(line)}</p>`);
  }

  if (inList) out.push(listType === "ul" ? "</ul>" : "</ol>");
  return out.join("\n");
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
