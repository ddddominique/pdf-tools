import express, { text } from 'express';
import cors from 'cors';
import multer from 'multer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {z} from 'zod';

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const ActionsSchema = z.object({
    actions: z.array(
        z.discriminatedUnion("type", [
            z.object({
                type: z.literal("addText"),
                page: z.number().int().nonnegative(),
                x: z.number(),
                y: z.number(),
                text: z.string().min(1),
                size: z.number().optional(),
                color: z.string().optional(),
                bold: z.boolean().optional(),
                align: z.enum(["left", "center", "right"]).optional(),
                width: z.number().optional(),
                lineHeight: z.number().optional(),
            })
            // Future action types can be added here
        ])
    ),
});

app.get("/health", (req, res) => {
    res.status(200).send("Server is healthy");
});

app.post("/api/pdf/apply", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) { return res.status(400).json({ error: "No file uploaded" }); }
        if (!req.body.actions) { return res.status(400).json({ error: "No actions provided" }); }

        const parsed = ActionsSchema.safeParse(JSON.parse(req.body.actions));
        // string -> JSON.parse -> JSON -> Zod parse
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid actions format", details: parsed.error.errors });
        }

        const pdfDoc = await PDFDocument.load(req.file.buffer); // req.file.buffer contains the uploaded PDF file in Uint8Array format
        const pages = pdfDoc.getPages();
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const hexToRgb = (hex) => {
            if (!hex) return null;
            const clean = hex.replace("#", "");
            if (clean.length !== 3 && clean.length !== 6) return null;
            const normalized = clean.length === 3
                ? clean.split("").map((c) => c + c).join("")
                : clean;
            const num = parseInt(normalized, 16);
            return {
                r: ((num >> 16) & 255) / 255,
                g: ((num >> 8) & 255) / 255,
                b: (num & 255) / 255,
            };
        };

        for (const action of parsed.data.actions) {
            if (action.type === "addText") {
                const page = pages[action.page];
                if (!page) continue;

                const size = action.size ?? 12;
                const lineHeight = action.lineHeight ?? size * 1.2;
                const font = action.bold ? fontBold : fontRegular;
                const colorRgb = hexToRgb(action.color);
                const color = colorRgb ? rgb(colorRgb.r, colorRgb.g, colorRgb.b) : rgb(0, 0, 0);
                const lines = action.text.split(/\r?\n/);

                lines.forEach((line, index) => {
                    let drawX = action.x;
                    if (action.align && action.width) {
                        const textWidth = font.widthOfTextAtSize(line, size);
                        if (action.align === "center") {
                            drawX = action.x + Math.max(0, (action.width - textWidth) / 2);
                        } else if (action.align === "right") {
                            drawX = action.x + Math.max(0, action.width - textWidth);
                        }
                    }
                    const drawY = action.y - index * lineHeight;
                    page.drawText(line, {
                        x: drawX,
                        y: drawY,
                        size,
                        font,
                        color,
                    });
                });
            }
        }
        const out = await pdfDoc.save(); // Uint8Array (binary data of the modified PDF)
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="edited_${req.file.originalname}"`);
        return res.send(Buffer.from(out));
    } catch (e) {
        console.error("Error processing PDF:", e);
        res.status(500).json({ error: "Failed to process PDF" });
    }
});

app.post("/api/pdf/merge", upload.array("files"), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length < 2) {
            return res.status(400).json({ error: "Please upload at least two PDF files" });
        }

        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
            const src = await PDFDocument.load(file.buffer);
            const pages = await mergedPdf.copyPages(src, src.getPageIndices());
            pages.forEach((page) => mergedPdf.addPage(page));
        }

        const out = await mergedPdf.save();
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=\"merged.pdf\"");
        return res.send(Buffer.from(out));
    } catch (e) {
        console.error("Error merging PDFs:", e);
        res.status(500).json({ error: "Failed to merge PDFs" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
