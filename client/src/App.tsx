import { useEffect, useMemo, useRef, useState } from "react";
import pdfjsLib from "./pdfjsWorker";

type AddTextAction = {
  type: "addText";
  page: number;
  x: number;
  y: number;
  text: string;
  size?: number;
};

type ActionsPayload = {
  actions: AddTextAction[];
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [actions, setActions] = useState<AddTextAction[]>([]);
  const [textToPlace, setTextToPlace] = useState<string>("Dominique");
  const [isRendering, setIsRendering] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<{width: number; height: number; scale: number} | null>(null);


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
      try{
      const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      viewportRef.current = { width: viewport.width, height: viewport.height, scale };

      const canvas = canvasRef.current ;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      }
      finally {
        setIsRendering(false);
      }
    })();
  }, [pdfData]) ; 


  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!viewportRef.current || isRendering) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

    const xCanvas = (e.clientX - rect.left) * (canvas.width / rect.width);
    const yCanvas = (e.clientY - rect.top) * (canvas.height / rect.height);

    const scale = viewportRef.current.scale;
    const xPdf = xCanvas / scale;
    const yPdf = (canvas.height - yCanvas) / scale;

    setActions((prev) => [
      ...prev,
      {type: "addText", page: 0, x: xPdf, y: yPdf, text: textToPlace, size: 18},
    ])
  }

  useEffect(()=> {
    if (!pdfData || !canvasRef.current || !viewportRef.current) return;

    (async () => {
      const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const canvas = canvasRef.current!;

      const scale = viewportRef.current!.scale;
      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvas, viewport }).promise;

      ctx.save();
      const scaledFontSize = 18 * scale;
      ctx.font = `${scaledFontSize}px Arial`;
      for (const a of actions) {
        const xCanvas = a.x * scale;
        const yCanvas = canvas.height - a.y * scale;
        ctx.fillText(a.text, xCanvas, yCanvas);
      }
      ctx.restore();
    })();
  }, [actions, pdfData, isRendering])

  async function exportPdf() {
    if (!file) return;
    const payload: ActionsPayload = { actions };
    const form = new FormData();
    form.append("file", file);
    form.append("actions", JSON.stringify(payload));

    const resp = await fetch("http://localhost:3000/api/pdf/apply", {
      method: "POST",
      body: form,
    })

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
    const actionCount = useMemo(() => actions.length, [actions]);
 return (
    <div style={{ fontFamily: "sans-serif", padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <h2>PDF Tool (Option B: Actions → Server Apply)</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <input
          value={textToPlace}
          onChange={(e) => setTextToPlace(e.target.value)}
          placeholder="Text to place"
          style={{ padding: 8, width: 260 }}
        />

        <button onClick={() => setActions([])} disabled={!actionCount}>
          Clear ({actionCount})
        </button>

        <button onClick={exportPdf} disabled={!file || !actionCount}>
          Export PDF
        </button>
      </div>

      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Click on the page to place text. (Preview is drawn on the canvas.)
      </p>

      <div style={{ border: "1px solid #ddd", display: "inline-block" }}>
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          style={{ cursor: "crosshair", display: "block", opacity: isRendering ? 0.6 : 1 }}
        />
      </div>
    </div>
  );
}
