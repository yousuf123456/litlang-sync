import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { LLM_MODEL_NAME } from "./consts";

let llm = new ChatGoogleGenerativeAI({
  modelName: LLM_MODEL_NAME,
  apiKey: process.env.GEMINI_API_KEY,
});

export default llm;
