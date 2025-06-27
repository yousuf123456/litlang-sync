import { Pinecone } from "@pinecone-database/pinecone";

export const PineconeClient = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});
