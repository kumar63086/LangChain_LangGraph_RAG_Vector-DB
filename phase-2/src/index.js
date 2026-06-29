import express from "express";
import dotenv from "dotenv";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import fs from "fs";
import { PDFParse } from "pdf-parse"
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// Check API Key
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing");
  process.exit(1);
}

// Gemini Model
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
  maxRetries: 5,
  maxOutputTokens: 500,
});

// Store PDF text globally
let pdfText = "";

// Read PDF
const upload = async () => {
  try {
     const pdfPath = path.resolve("knowledge.pdf")
    const buffer = fs.readFileSync(pdfPath)
    const pdfResult = new PDFParse({ data: buffer })
    const result = await pdfResult.getText()
    const text = result.text
   
  } catch (error) {
    console.error("❌ PDF Error:", error.message);
  }
};

// Load PDF before starting server
await upload();

// Home Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Gemini + PDF AI Server Running 🚀",
  });
});

// AI Route
app.post("/ai", async (req, res) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Input is required.",
      });
    }

    const prompt = `
You are an AI assistant.

Answer ONLY using the following PDF content.

-------------------------
${pdfText}
-------------------------

Question:
${input}

If the answer is not present in the document, say:
"I couldn't find this information in the provided document."
`;

    const result = await llm.invoke(prompt);

    return res.status(200).json({
      success: true,
      question: input,
      response: result.content,
    });
  } catch (error) {
    console.error("Gemini Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server Running at http://localhost:${PORT}`);
});