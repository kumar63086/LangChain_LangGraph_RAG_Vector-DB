import express, { json } from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearch } from "@langchain/tavily";

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());


app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "hello world...!"
    });
});

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 2,
    maxRetries: 2,
    maxTokens: 100
});

// with out Langchin

// app.post("/api", async (req, res) => {
//     const { input } = req.body;

//     try {
//         if (!input) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Input is required",
//             });
//         }

//         const response = await ai.models.generateContent({
//             model: "gemini-2.5-flash",
//             contents: input,
//         });

//         return res.status(200).json({
//             success: true,
//             ai: response.text,
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// });

// with langchin
const tool = new TavilySearch({
    maxResults: 2,
    topic: "general",
});
const checkPointer = new MemorySaver()

const tools = [tool];

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY,
}).bindTools(tools)

const toolNode = new ToolNode(tools);

const CallLLM = async (state) => {
  const response = await llm.invoke([
    {
      role: "system",
      content: `You are Kumar AI assistant.

Use conversation memory first.

Only use tools when the answer requires
external real-time information like
weather, news, web search, stock prices, etc.

Do NOT call tools for simple conversation,
memory-based questions, greetings,
or personal context.`,
    },
    ...state.messages,
  ]);

  return {
    messages: [response], // Return the AIMessage in an array
  };
};
const shouldContinue = async (state) => {
    const lastMessage = state.messages[state.messages.length - 1]
    if (lastMessage.tool_calls.length > 0) {
        return "tools"
    } else {
        return "__end__"
    }
}
const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", CallLLM)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addEdge("tools", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .compile({ checkpointer: checkPointer })



app.post("/api", async (req, res) => {
  try {
    const { input } = req.body;

    const result = await graph.invoke(
      {
        messages: [
          {
            role: "user",
            content: input,
          },
        ],
      },
      {
        configurable: {
          thread_id: "user123",
        },
      }
    );

    console.log(result);

    return res.status(200).json({
      success: true,
      message: result.messages[result.messages.length - 1].content,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});