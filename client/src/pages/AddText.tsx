import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import pdfjsLib from "@/pdfjsWorker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";

type AddTextAction = {
  type: "addText";
  page: number;
  x: number;
  y: number;
  text: string;
  size?: number;
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  width?: number;
  lineHeight?: number;
};

type ActionsPayload = {
  actions: AddTextAction[];
};

type TextBoxRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextAlign = "left" | "center" | "right";

type TextBox = {
  id: string;
  page: number;
  rect: TextBoxRect;
  text: string;
  font: string;
  size: number; // PDF points
  color: string;
  bold: boolean;
  align: TextAlign;
};

export default function AddTextPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragRect, setDragRect] = useState<{ page: number; rect: TextBoxRect } | null>(null);

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const viewportRefs = useRef<Map<number, { width: number; height: number; scale: number }>>(
    new Map()
  );
  const pdfDocRef = useRef<any>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const interactionRef = useRef<{
    id: string;
    type: "move" | "resize";
    handle?: "nw" | "ne" | "se" | "sw";
    startX: number;
    startY: number;
    startRect: TextBoxRect;
  } | null>(null);
  const dragOriginRef = useRef<{ page: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    (async () => {
      const buffer = await file.arrayBuffer();
      setPdfData(new Uint8Array(buffer));
    })();
  }, [file]);

  useEffect(() => {
    if (!pdfData) return;
    (async () => {
      setIsRendering(true);
      try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          await renderPage(pdf, pageNumber);
        }
      } finally {
        setIsRendering(false);
      }
    })();
  }, [pdfData]);

  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

  function setCanvasRef(pageNumber: number) {
    return (node: HTMLCanvasElement | null) => {
      if (!node) {
        canvasRefs.current.delete(pageNumber);
        return;
      }
      canvasRefs.current.set(pageNumber, node);
      if (pdfDocRef.current) {
        renderPage(pdfDocRef.current, pageNumber);
      }
    };
  }

  async function renderPage(pdf: any, pageNumber: number) {
    const canvas = canvasRefs.current.get(pageNumber);
    if (!canvas) return;
    const scale = viewportRefs.current.get(pageNumber)?.scale ?? 1.5;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    viewportRefs.current.set(pageNumber, {
      width: viewport.width,
      height: viewport.height,
      scale,
    });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
  }

  useEffect(() => {
    if (activeId) {
      textAreaRef.current?.focus();
    }
  }, [activeId]);

  const activeBox = activeId
    ? textBoxes.find((box) => box.id === activeId) ?? null
    : null;

  function updateBox(id: string, patch: Partial<TextBox>) {
    setTextBoxes((prev) =>
      prev.map((box) => (box.id === id ? { ...box, ...patch } : box))
    );
  }

  function updateBoxRect(id: string, rect: TextBoxRect) {
    setTextBoxes((prev) =>
      prev.map((box) => (box.id === id ? { ...box, rect } : box))
    );
  }

  function removeBox(id: string) {
    setTextBoxes((prev) => prev.filter((box) => box.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function startInteraction(
    e: React.MouseEvent,
    id: string,
    type: "move" | "resize",
    handle?: "nw" | "ne" | "se" | "sw"
  ) {
    const box = textBoxes.find((b) => b.id === id);
    if (!box) return;
    interactionRef.current = {
      id,
      type,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: box.rect,
    };
    setActiveId(id);
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!interactionRef.current) return;
      const { id, type, handle, startX, startY, startRect } = interactionRef.current;
      const targetBox = textBoxes.find((box) => box.id === id);
      if (!targetBox) return;
      const canvas = canvasRefs.current.get(targetBox.page);
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const minWidth = 40;
      const minHeight = 24;

      if (type === "move") {
        const nextX = Math.min(
          Math.max(0, startRect.x + dx),
          Math.max(0, canvasRect.width - startRect.width)
        );
        const nextY = Math.min(
          Math.max(0, startRect.y + dy),
          Math.max(0, canvasRect.height - startRect.height)
        );
        updateBoxRect(id, { ...startRect, x: nextX, y: nextY });
        return;
      }

      if (type === "resize" && handle) {
        let next = { ...startRect };
        if (handle.includes("n")) {
          const newY = Math.min(startRect.y + dy, startRect.y + startRect.height - minHeight);
          next.height = startRect.y + startRect.height - newY;
          next.y = newY;
        }
        if (handle.includes("s")) {
          next.height = Math.max(minHeight, startRect.height + dy);
        }
        if (handle.includes("w")) {
          const newX = Math.min(startRect.x + dx, startRect.x + startRect.width - minWidth);
          next.width = startRect.x + startRect.width - newX;
          next.x = newX;
        }
        if (handle.includes("e")) {
          next.width = Math.max(minWidth, startRect.width + dx);
        }

        next.width = Math.min(next.width, canvasRect.width - next.x);
        next.height = Math.min(next.height, canvasRect.height - next.y);
        updateBoxRect(id, next);
      }
    };

    const handleUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [textBoxes]);

  function onCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>, pageNumber: number) {
    if (!isTextMode || isRendering) return;
    const canvas = canvasRefs.current.get(pageNumber);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragOriginRef.current = { page: pageNumber, x, y };
    setDragRect({ page: pageNumber, rect: { x, y, width: 0, height: 0 } });
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>, pageNumber: number) {
    if (!dragOriginRef.current || dragOriginRef.current.page !== pageNumber) return;
    const canvas = canvasRefs.current.get(pageNumber);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const start = dragOriginRef.current;
    const next = {
      x: Math.min(start.x, x),
      y: Math.min(start.y, y),
      width: Math.abs(x - start.x),
      height: Math.abs(y - start.y),
    };
    setDragRect({ page: pageNumber, rect: next });
  }

  function onCanvasMouseUp(pageNumber: number) {
    if (!dragRect || dragRect.page !== pageNumber) return;
    dragOriginRef.current = null;
    const minWidth = 60;
    const minHeight = 32;
    const rect = {
      x: dragRect.rect.x,
      y: dragRect.rect.y,
      width: Math.max(minWidth, dragRect.rect.width),
      height: Math.max(minHeight, dragRect.rect.height),
    };

    const newBox: TextBox = {
      id: crypto.randomUUID(),
      page: pageNumber,
      rect,
      text: "",
      font: "Arial",
      size: 12,
      color: "#111111",
      bold: false,
      align: "left",
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setActiveId(newBox.id);
    setDragRect(null);
  }

  async function exportPdf() {
    if (!file) return;
    const actions: AddTextAction[] = textBoxes
      .filter((box) => box.text.trim().length > 0)
      .flatMap((box) => {
        const canvas = canvasRefs.current.get(box.page);
        const viewport = viewportRefs.current.get(box.page);
        if (!canvas || !viewport) return [];
        const rect = canvas.getBoundingClientRect();
        const scale = viewport.scale;
        const xCanvas = (box.rect.x / rect.width) * canvas.width;
        const yCanvas = (box.rect.y / rect.height) * canvas.height;
        const fontSize = box.size;
        const lineHeight = fontSize * 1.2;
        const baselineCanvas = yCanvas + fontSize * scale;
        const xPdf = xCanvas / scale;
        const yPdf = (canvas.height - baselineCanvas) / scale;
        return [
          {
            type: "addText",
            page: box.page - 1,
            x: xPdf,
            y: yPdf,
            text: box.text,
            size: fontSize,
            color: box.color,
            bold: box.bold,
            align: box.align,
            width: box.rect.width / scale,
            lineHeight,
          },
        ];
      });

    const payload: ActionsPayload = { actions };
    const form = new FormData();
    form.append("file", file);
    form.append("actions", JSON.stringify(payload));

    const resp = await fetch("http://localhost:3000/api/pdf/apply", {
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
    a.download = "modified.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  const actionCount = textBoxes.length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_60%,_#d1d5db_100%)]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-4 rounded-2xl border bg-white/80 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back
              </Link>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                PDF Editor
              </span>
              {file && (
                <span className="text-xs text-muted-foreground">
                  Loaded: {file.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">MyPDF</h1>
            <p className="text-sm text-muted-foreground">
              {isTextMode
                ? "Drag to create a text box, then type inside it."
                : "Click Add Text to start placing a text box."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-[240px]"
            />
            <Button
              variant={isTextMode ? "default" : "outline"}
              onClick={() => setIsTextMode((v) => !v)}
              disabled={!file}
            >
              {isTextMode ? "Exit Text Mode" : "Add Text"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setTextBoxes([]);
                setActiveId(null);
              }}
              disabled={!actionCount}
            >
              Clear ({actionCount})
            </Button>
            <Button onClick={exportPdf} disabled={!file || !actionCount}>
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr_300px]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Text Mode</span>
                  <Toggle
                    pressed={isTextMode}
                    onClick={() => setIsTextMode((v) => !v)}
                  >
                    {isTextMode ? "On" : "Off"}
                  </Toggle>
                </div>
              </div>
              <div className="rounded-xl border bg-background p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Text boxes</span>
                    <span className="font-semibold">{actionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Active</span>
                    <span className="font-semibold">{activeBox ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" disabled={!file} className="w-full">
                Fit to Width
              </Button>
              <Button variant="outline" disabled={!file} className="w-full">
                Reset View
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 border-white/60 bg-white/80 shadow-xl backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Canvas {pageCount ? `(${pageCount} pages)` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {pageNumbers.map((pageNumber) => (
                  <div
                    key={pageNumber}
                    className="relative overflow-auto rounded-xl border bg-[linear-gradient(90deg,rgba(148,163,184,0.15)_1px,transparent_1px),linear-gradient(180deg,rgba(148,163,184,0.15)_1px,transparent_1px)] bg-[size:24px_24px]"
                  >
                    <canvas
                      ref={setCanvasRef(pageNumber)}
                      onMouseDown={(e) => onCanvasMouseDown(e, pageNumber)}
                      onMouseMove={(e) => onCanvasMouseMove(e, pageNumber)}
                      onMouseUp={() => onCanvasMouseUp(pageNumber)}
                      className={isTextMode ? "cursor-crosshair" : "cursor-default"}
                      style={{ opacity: isRendering ? 0.6 : 1 }}
                    />
                    {dragRect && dragRect.page === pageNumber && (
                      <div
                        style={{
                          position: "absolute",
                          left: dragRect.rect.x,
                          top: dragRect.rect.y,
                          width: dragRect.rect.width,
                          height: dragRect.rect.height,
                        }}
                        className="pointer-events-none border border-dashed border-primary/70 bg-primary/10"
                      />
                    )}
                    {textBoxes
                      .filter((box) => box.page === pageNumber)
                      .map((box) => {
                        const isActive = box.id === activeId;
                        const scale = viewportRefs.current.get(pageNumber)?.scale ?? 1;
                        return (
                          <div
                            key={box.id}
                            onMouseDown={(e) => {
                              if ((e.target as HTMLElement).dataset.handle) return;
                              if ((e.target as HTMLElement).dataset.textarea) return;
                              startInteraction(e, box.id, "move");
                            }}
                            style={{
                              position: "absolute",
                              left: box.rect.x,
                              top: box.rect.y,
                              width: box.rect.width,
                              height: box.rect.height,
                            }}
                            className={
                              isActive
                                ? "border-2 border-primary bg-primary/5 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]"
                                : "border border-dashed border-primary/50"
                            }
                          >
                            <textarea
                              ref={isActive ? textAreaRef : undefined}
                              data-textarea
                              value={box.text}
                              onChange={(e) => updateBox(box.id, { text: e.target.value })}
                              onFocus={() => setActiveId(box.id)}
                              className="h-full w-full resize-none bg-transparent p-2 text-sm outline-none"
                              style={{
                                fontSize: box.size * scale,
                                fontFamily: box.font,
                                fontWeight: box.bold ? "bold" : "normal",
                                color: box.color,
                                textAlign: box.align,
                                lineHeight: `${box.size * scale * 1.2}px`,
                              }}
                            />
                            {isActive && (
                              <>
                                {(["nw", "ne", "se", "sw"] as const).map((handle) => {
                                  const styleMap: Record<string, React.CSSProperties> = {
                                    nw: { left: -6, top: -6, cursor: "nwse-resize" },
                                    ne: { right: -6, top: -6, cursor: "nesw-resize" },
                                    se: { right: -6, bottom: -6, cursor: "nwse-resize" },
                                    sw: { left: -6, bottom: -6, cursor: "nesw-resize" },
                                  };
                                  return (
                                    <div
                                      key={handle}
                                      data-handle
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                        startInteraction(e, box.id, "resize", handle);
                                      }}
                                      style={styleMap[handle]}
                                      className="absolute h-2.5 w-2.5 rounded-sm bg-primary shadow"
                                    />
                                  );
                                })}
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                Text Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeBox ? (
                <>
                  <Select
                    value={activeBox.font}
                    onChange={(e) => updateBox(activeBox.id, { font: e.target.value })}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                  </Select>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min={6}
                      max={72}
                      value={activeBox.size}
                      onChange={(e) => updateBox(activeBox.id, { size: Number(e.target.value) })}
                    />
                    <Input
                      type="color"
                      value={activeBox.color}
                      onChange={(e) => updateBox(activeBox.id, { color: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Toggle
                      pressed={activeBox.bold}
                      onClick={() => updateBox(activeBox.id, { bold: !activeBox.bold })}
                    >
                      Bold
                    </Toggle>
                    <Separator className="h-8 w-px" />
                    <Toggle
                      pressed={activeBox.align === "left"}
                      onClick={() => updateBox(activeBox.id, { align: "left" })}
                    >
                      Left
                    </Toggle>
                    <Toggle
                      pressed={activeBox.align === "center"}
                      onClick={() => updateBox(activeBox.id, { align: "center" })}
                    >
                      Center
                    </Toggle>
                    <Toggle
                      pressed={activeBox.align === "right"}
                      onClick={() => updateBox(activeBox.id, { align: "right" })}
                    >
                      Right
                    </Toggle>
                  </div>
                  <Button variant="destructive" onClick={() => removeBox(activeBox.id)}>
                    Delete Text Box
                  </Button>
                </>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Select a text box to edit its font, size, and alignment.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
