# LangChain & Gemini RAG Server

This project is an Express.js-based API server that implements a **Retrieval-Augmented Generation (RAG)** system using LangChain, Google Gemini models, and a Qdrant vector database. It reads a local PDF file, processes its text, stores it in a vector database, and uses it as context to answer user questions with high accuracy and strict adherence to the provided document.

## End-to-End Workflow & Modules Used

Here is a step-by-step breakdown of how the application works and the specific modules used at each step:

### 1. Setup & Configuration
- **`express`**: Used to spin up the web server and handle HTTP requests (routing and JSON parsing).
- **`dotenv`**: Loads environment variables (like `GEMINI_API_KEY` and `QDRANT_URL`) from a `.env` file to keep secrets secure.

### 2. Document Processing (Ingestion Phase)
When the server starts, it immediately loads the knowledge base:
- **`fs` & `path`** (Node.js built-ins): Resolve the file path and read the raw binary data of the `knowledge.pdf` file.
- **`pdf-parse`**: Parses the binary PDF data to extract clean, readable text.
- **`@langchain/textsplitters` (`RecursiveCharacterTextSplitter`)**: Since LLMs have token limits and to improve search relevance, the extracted text is chunked into smaller, overlapping segments (e.g., 1000 characters each with a 200-character overlap).

### 3. Vector Database Integration (Storage Phase)
- **`@langchain/google-genai` (`GoogleGenerativeAIEmbeddings`)**: Converts the text chunks into numerical vectors (embeddings) using the `gemini-embedding-001` model. This allows the system to understand the semantic meaning of the text.
- **`@langchain/qdrant` (`QdrantVectorStore`)**: Connects to a Qdrant vector database instance (to a collection named `grocery-store`). It stores the generated text chunks alongside their vector embeddings.

### 4. Querying & Response Generation (Retrieval Phase)
When a user submits a question via the `/ai` POST endpoint:
- **Similarity Search**: The user's question is converted into an embedding, and the `QdrantVectorStore` is queried to find the top 5 most semantically similar text chunks from the PDF.
- **`@langchain/core/messages` (`SystemMessage`, `HumanMessage`)**: Formats the interaction. The retrieved text chunks are combined into a context string and injected into a `SystemMessage`. This message instructs the AI to strictly use only the provided context and refuse to answer outside of it. The user's input is passed as a `HumanMessage`.
- **`@langchain/google-genai` (`ChatGoogleGenerativeAI`)**: The `gemini-2.5-flash` model receives the system instructions (with context) and the user's question, generating an accurate response based *only* on the PDF's contents.

## Running the Project

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up your `.env` file with `GEMINI_API_KEY` and `QDRANT_URL`.
3. Ensure you have a `knowledge.pdf` file in the root of the project.
4. Start the development server:
   ```bash
   npm run dev
   ```

The server will run on `http://localhost:8000`. You can send POST requests to `http://localhost:8000/ai` with a JSON body `{"input": "your question here"}` to test the RAG system.
