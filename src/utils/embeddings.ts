import { VoyageEmbeddings } from "@langchain/community/embeddings/voyage";
import { EMBEDDINGS_MODEL_NAME } from "./consts";

let embeddings = new VoyageEmbeddings({
  inputType: "document",
  apiKey: process.env.VOYAGE_API_KEY,
  modelName: EMBEDDINGS_MODEL_NAME,
});

export default embeddings;
