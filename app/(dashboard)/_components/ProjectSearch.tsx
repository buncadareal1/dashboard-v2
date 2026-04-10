"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  searchProjectsAction,
  type SearchResult,
} from "@/lib/actions/search";

export function ProjectSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchProjectsAction(query);
      setResults(data);
      setOpen(true);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(`/projects/${slug}`);
  }

  const statusLabel: Record<string, { text: string; className: string }> = {
    running: { text: "Đang chạy", className: "bg-green-100 text-green-700" },
    warning: { text: "Cảnh báo", className: "bg-orange-100 text-orange-700" },
    paused: { text: "Tạm dừng", className: "bg-zinc-100 text-zinc-700" },
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Tìm dự án..."
        className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
      />

      {/* Dropdown results */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
          {loading ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Đang tìm...
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Không tìm thấy dự án nào
            </p>
          ) : (
            <ul className="py-1">
              {results.map((r) => {
                const s = statusLabel[r.status] ?? statusLabel.running;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => handleSelect(r.slug)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.name}</p>
                        {r.location && (
                          <p className="truncate text-xs text-muted-foreground">
                            {r.location}
                          </p>
                        )}
                      </div>
                      <Badge className={s.className}>{s.text}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
