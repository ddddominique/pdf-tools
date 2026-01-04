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
            })
            // Future action types can be added here
        ])
    ),
});

app.get("/health", (req, res) => {
    res.status(200).send("Server is healthy");
});

app.post("api/pdf/apply", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) { return res.status(400).json({ error: "No file uploaded" }); }
        if (!req.body.actions) { return res.status(400).json({ error: "No actions provided" }); }

        const parsed = ActionsSchema.safeParse(JSON.parse(req.body.actions));
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid actions format", details: parsed.error.errors });
        }

        
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
