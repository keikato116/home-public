"use client";

import { useEffect, useState, useRef } from "react";
import { useDiaryStore } from "@/store/diaryStore";
import { useAuthStore } from "@/store/authStore";
import { DiaryEntry } from "@/types";
import { Trash2 } from "lucide-react";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function groupByDate(entries: DiaryEntry[]): [string, DiaryEntry[]][] {
  const map: Record<string, DiaryEntry[]> = {};
  for (const e of entries) {
    if (!map[e.entry_date]) map[e.entry_date] = [];
    map[e.entry_date].push(e);
  }
  return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
}

export function DiaryTab() {
  const { householdId, user } = useAuthStore();
  const { entries, loading, load, addEntry, deleteEntry, subscribeRealtime } = useDiaryStore();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    load(user.id);
    const unsub = subscribeRealtime(user.id);
    return unsub;
  }, [user, load, subscribeRealtime]);

  async function handleSubmit() {
    if (!text.trim() || !householdId || !user) return;
    await addEntry(householdId, user.id, text.trim());
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  const grouped = groupByDate(entries);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex flex-col h-full px-7 py-8">
      <div className="mb-8">
        <p className="text-[10px] tracking-widest text-muted-foreground uppercase">diary</p>
        <h2 className="text-[22px] tracking-wide">
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </h2>
      </div>

      {/* Entry input */}
      <div className="mb-6 border border-border rounded p-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="今日の出来事を書く..."
          rows={2}
          className="w-full bg-transparent text-[12px] tracking-wide outline-none placeholder:text-muted-foreground resize-none overflow-hidden leading-relaxed"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="text-[10px] tracking-widest border border-border rounded px-3 py-1 hover:bg-muted transition-colors disabled:opacity-30"
          >
            add
          </button>
        </div>
      </div>

      {/* Entries list */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {loading && <p className="text-[11px] text-muted-foreground">loading...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-[11px] text-muted-foreground">no entries yet</p>
        )}
        {grouped.map(([date, dayEntries]) => (
          <div key={date}>
            <p className={[
              "text-[10px] tracking-widest uppercase mb-2",
              date === today ? "text-foreground" : "text-muted-foreground",
            ].join(" ")}>
              {formatDate(date)}
              {date === today && <span className="ml-2 inline-block w-1 h-1 rounded-full bg-foreground align-middle" />}
            </p>
            <div className="space-y-3">
              {dayEntries.map((entry) => (
                <div key={entry.id} className="flex gap-2 group">
                  <div className="flex-1">
                    <p className="text-[9px] text-muted-foreground tracking-wide mb-0.5">
                      {formatTime(entry.created_at)}
                    </p>
                    <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                  </div>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all self-start pt-0.5 flex-shrink-0"
                    aria-label="delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
