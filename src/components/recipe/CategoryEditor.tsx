"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRecipeCategoryStore } from "@/store/recipeCategoryStore";
import type { CategoryNode } from "@/lib/recipeCategories";

// レシピの分類の編集（世帯で共有、2段まで）。
// 名前を変えると、その分類のレシピもまとめて変わる。消した分類のレシピは「未分類」に移る。

export function CategoryEditor({ onClose }: { onClose: () => void }) {
  const { tree, editable, add, rename, remove, move } = useRecipeCategoryStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 名前を変えている行の id と入力中の名前
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // 追加の入力欄を開いている場所（"top" か、上の分類の id）
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const run = async (fn: () => Promise<string | null | void>) => {
    setBusy(true);
    setError("");
    const message = await fn();
    if (message) setError(message);
    setBusy(false);
    return !message;
  };

  const saveRename = async (node: CategoryNode) => {
    if (draft.trim() === node.name) { setEditingId(null); return; }
    if (await run(() => rename(node.id, draft))) setEditingId(null);
  };

  const saveNew = async () => {
    const parentId = addingTo === "top" ? null : addingTo;
    if (await run(() => add(newName, parentId))) { setAddingTo(null); setNewName(""); }
  };

  // 行と追加欄は部品（コンポーネント）にせず関数で描く。部品にすると入力のたびに作り直され、
  // 入力欄からフォーカスが外れてしまう。
  const row = (node: CategoryNode, siblings: CategoryNode[], index: number, child = false) => (
    <div key={node.id} className={child ? "pl-6" : ""}>
      <div className="flex items-center gap-2 py-2 border-b border-border/50">
        {editingId === node.id ? (
          <input
            autoFocus
            value={draft}
            maxLength={20}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(node); if (e.key === "Escape") setEditingId(null); }}
            onBlur={() => saveRename(node)}
            className="flex-1 bg-transparent border-b border-foreground/40 text-[13px] outline-none"
          />
        ) : (
          <button
            onClick={() => { setEditingId(node.id); setDraft(node.name); setConfirmingId(null); }}
            disabled={!editable || busy}
            className={`flex-1 text-left ${child ? "text-[12px]" : "text-[13px]"} tracking-wide`}
          >
            {node.name}
          </button>
        )}

        {confirmingId === node.id ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => run(() => remove(node.id)).then(() => setConfirmingId(null))}
              disabled={busy}
              className="text-[11px] text-red-500 underline disabled:opacity-50"
            >
              消す
            </button>
            <button onClick={() => setConfirmingId(null)} className="text-[11px] text-muted-foreground underline">
              やめる
            </button>
          </div>
        ) : (
          editable && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <button onClick={() => move(node.id, -1)} disabled={busy || index === 0} aria-label="上へ" className="disabled:opacity-20">
                <ArrowUp size={13} />
              </button>
              <button onClick={() => move(node.id, 1)} disabled={busy || index === siblings.length - 1} aria-label="下へ" className="disabled:opacity-20">
                <ArrowDown size={13} />
              </button>
              <button onClick={() => { setConfirmingId(node.id); setEditingId(null); }} disabled={busy} aria-label="消す">
                <X size={13} />
              </button>
            </div>
          )
        )}
      </div>
      {confirmingId === node.id && (
        <p className="text-[10px] text-muted-foreground leading-relaxed py-1">
          この分類{!child && node.children.length > 0 ? "と、その下の分類" : ""}を消します。入っているレシピは消えず、
          {child ? "上の分類のまま残ります" : "「未分類」に移ります"}。
        </p>
      )}
    </div>
  );

  const addField = (target: string, label: string) =>
    addingTo === target ? (
      <div className={`flex items-center gap-2 py-2 ${target === "top" ? "" : "pl-6"}`}>
        <input
          autoFocus
          value={newName}
          maxLength={20}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") saveNew(); if (e.key === "Escape") setAddingTo(null); }}
          placeholder="名前（20文字まで）"
          className="flex-1 bg-transparent border-b border-foreground/40 text-[12px] outline-none"
        />
        <button onClick={saveNew} disabled={busy || !newName.trim()} className="text-[11px] underline disabled:opacity-40">追加</button>
        <button onClick={() => { setAddingTo(null); setNewName(""); }} className="text-[11px] text-muted-foreground underline">やめる</button>
      </div>
    ) : (
      <button
        onClick={() => { setAddingTo(target); setNewName(""); setEditingId(null); setConfirmingId(null); }}
        disabled={!editable || busy}
        className={`flex items-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 ${target === "top" ? "" : "pl-6"}`}
      >
        <Plus size={11} /> {label}
      </button>
    );

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      <div className="flex items-center justify-between px-7 pt-10 pb-4">
        <div>
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">categories</p>
          <h2 className="text-[18px] tracking-wide">レシピの分類</h2>
        </div>
        <button onClick={onClose} aria-label="閉じる" className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-10">
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
          分類は2人で共有します。名前を押すと変えられ、その分類のレシピもまとめて変わります。
          分類の下に、もう1段だけ分類を作れます。
        </p>
        {!editable && (
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
            いまは分類を編集できません。時間をおいてもう一度開いてください。
          </p>
        )}

        {tree.map((top, i) => (
          <div key={top.id}>
            {row(top, tree, i)}
            {top.children.map((sub, j) => row(sub, top.children, j, true))}
            {addField(top.id, "下の分類を追加")}
          </div>
        ))}

        <div className="pt-2">
          {addField("top", "分類を追加")}
        </div>

        {error && <p className="text-[11px] text-red-500 leading-relaxed pt-2">{error}</p>}
      </div>
    </div>
  );
}
