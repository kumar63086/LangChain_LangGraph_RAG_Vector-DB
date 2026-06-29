import express from "express";
import dotenv from "dotenv";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import fs from "fs";
import { PDFParse } from "pdf-parse"
import path from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { TaskType } from "@google/generative-ai";
import { QdrantVectorStore } from "@langchain/qdrant"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

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
const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001", // 768 dimensions
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Document title",
    apiKey: process.env.GEMINI_API_KEY,
});

const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    collectionName: "grocery-store",
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
    const spilitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200
    })
    const docs = await spilitter.createDocuments([text])
    // console.log(docs);
     await vectorStore.addDocuments(docs)
   
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

 const docs = await vectorStore.similaritySearch(input, 5)
    const context = docs.map((d) => d.pageContent).join("/n")

    const result = await llm.invoke([
        new SystemMessage(`You are a RAG AI assistant.

STRICT RULES:
- Answer ONLY from context
- Do not use outside knowledge
- If answer not found say:
  "I don't know from uploaded PDF."

Context:
${context}`)
,
new HumanMessage(input)
    ])

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