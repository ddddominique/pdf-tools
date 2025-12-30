import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {z} from 'zod';

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });