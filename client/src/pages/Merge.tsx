import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type MergeItem = {
  id: string;
  file: File;
};

export default function MergePage() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const next = files.map((file) => ({ id: crypto.randomUUID(), file }));
    setItems((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const [removed] = next.splice(index, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function mergePdfs() {
    if (!items.length) return;
    setIsMerging(true);
    try {
      const form = new FormData();
      items.forEach((item) => form.append("files", item.file));
      const resp = await fetch("http://localhost:3000/api/pdf/merge", {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert("Error: " + (err.message || resp.statusText));
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_60%,_#d1d5db_100%)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-4 rounded-2xl border bg-white/80 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back
              </Link>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Merge PDFs
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">MyPDF</h1>
            <p className="text-sm text-muted-foreground">
              Upload multiple PDFs, reorder them, and merge into one.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="application/pdf"
              multiple
              onChange={onFilesSelected}
              className="cursor-pointer"
            />
            <Button onClick={mergePdfs} disabled={!items.length || isMerging}>
              {isMerging ? "Merging..." : "Merge PDFs"}
            </Button>
          </div>
        </div>

        <Card className="border-2 border-white/60 bg-white/80 shadow-xl backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Files to Merge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Add PDFs to begin merging.
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                    >
                      Down
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeItem(item.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
