"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  name?: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * MultiSelect — popover + checkbox list.
 *
 * - Hidden `<input name={name} value={id} />` per selected id để native form submission work.
 * - Controlled: caller quản lý state `value`.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn...",
  name,
  emptyLabel = "Không có lựa chọn",
  className,
}: MultiSelectProps) {
  const selectedSet = React.useMemo(() => new Set(value), [value]);

  function toggle(id: string) {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? "1 đã chọn")
        : `${value.length} người đã chọn`;

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
          )}
        >
          <span
            className={cn(
              "truncate",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            {label}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1">
          {options.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            <ul
              role="listbox"
              aria-multiselectable="true"
              className="max-h-64 overflow-y-auto"
            >
              {options.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {name &&
        value.map((v) => (
          <input key={v} type="hidden" name={name} value={v} />
        ))}
    </div>
  );
}
