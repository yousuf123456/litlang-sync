import { formatDocumentsAsString } from "langchain/util/document";
import * as dotenv from "dotenv";
dotenv.config();

import { PineconeClient } from "../utils/pinecone";
import { PineconeStore } from "@langchain/pinecone";

import llm from "../utils/llm";
import aws_s3 from "../utils/aws_s3";
import embeddings from "../utils/embeddings";

import { encode } from "gpt-tokenizer";

import { Document } from "langchain/document";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import {
  ListObjectsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";

import {
  getContextualChunkHeader,
  getPagesIndex,
  getSections,
} from "../utils/semantic_chunking";

import ObjectID from "bson-objectid";
import {
  BUCKET_NAME,
  PINECONE_INDEX,
  SUBJECT_FOLDERS_PREFIX,
} from "../utils/consts";

const bucketName = "litlang2";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getChunksToEmbed = async (docs: Document[]) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 528,
    chunkOverlap: 0,
    lengthFunction: countTokens,
  });

  const pagesIndexes = getPagesIndex(docs);

  const docsString = formatDocumentsAsString(docs);

  let sections = await getSections(docsString, 450000000, llm);

  // Remove any section containing only few words or new lines
  sections = sections.filter(
    (section) =>
      section.content.trim() !== "" &&
      section.content.trim().split(/\s+/).length >= 10
  );

  let chunksToEmbed: Document[] = [];

  await Promise.all(
    sections.map(async (section) => {
      const pageNumber = pagesIndexes
        .filter((pageIndex) => {
          return (
            (section.startIndex >= pageIndex.startIndex &&
              section.startIndex <= pageIndex.endIndex) ||
            (section.endIndex >= pageIndex.startIndex &&
              section.endIndex <= pageIndex.endIndex) ||
            (section.startIndex <= pageIndex.startIndex &&
              section.endIndex >= pageIndex.endIndex)
          );
        })
        .map((pageNumber) => pageNumber.pageNumber)
        .join(" & ");

      if (countTokens(section.content) > 528) {
        const splittedSectionContentChunks = await splitter.createDocuments([
          section.content,
        ]);

        const sectionId = ObjectID().toHexString();

        splittedSectionContentChunks.forEach((chunk, i) => {
          const text = chunk.pageContent;

          chunksToEmbed.push(
            new Document({
              pageContent: `${getContextualChunkHeader(
                section.title,
                section.summary
              )}\n\n${text}`,
              metadata: {
                sectionId,
                chunkIndex: i,
                end: section.endIndex,
                start: section.startIndex,
                "loc.pageNumber": pageNumber,
              },
            })
          );
        });
      } else
        chunksToEmbed.push(
          new Document({
            pageContent: `${getContextualChunkHeader(
              section.title,
              section.summary
            )}\n\n${section.content}`,
            metadata: {
              end: section.endIndex,
              start: section.startIndex,
              "loc.pageNumber": pageNumber,
            },
          })
        );
    })
  );

  return chunksToEmbed;
};

const processSubjectsFiles = async (prefix: string, subPrefix: string) => {
  const command = new ListObjectsCommand({
    Bucket: bucketName,
    Prefix: prefix,
    Delimiter: "/",
  });

  const data = await aws_s3.send(command);

  // Process files directly under the current prefix
  if (data.Contents) {
    await Promise.all(
      data.Contents.map(async (file) => {
        if (file.Key !== prefix) {
          if (!file.Key) return;

          // Ignore if not a pdf
          if (!file.Key.toLowerCase().endsWith(".pdf")) return;

          const headResponse = await aws_s3.send(
            new HeadObjectCommand({ Bucket: bucketName, Key: file.Key })
          );

          const metadata = headResponse.Metadata || {};

          const isHandWritten = metadata["ishandwritten"] === "true"; // If the pdf is handwritten than it cannot be processed.
          const isEmbeddingsGenerated =
            metadata["isembeddingsgenerated"] === "true"; // If the embeddings of pdf has already been generated

          if (isEmbeddingsGenerated || isHandWritten) return;

          // Updating pdf metadata
          await aws_s3.send(
            new CopyObjectCommand({
              Key: file.Key,
              Bucket: bucketName,
              MetadataDirective: "REPLACE",
              CopySource: `${bucketName}/${file.Key}`,
              Metadata: {
                ...metadata,
                isembeddingsgenerated: "true",
              },
            })
          );

          const pdfUint8Array = await downloadPdfFromS3(file.Key);

          if (!pdfUint8Array) return;

          const loader = new PDFLoader(
            new Blob([pdfUint8Array], { type: "application/pdf" })
          );

          const docs = await loader.load();

          const chunksToEmbed = await getChunksToEmbed(docs);

          for (const chunkToEmbed of chunksToEmbed) {
            chunkToEmbed.metadata["fileKey"] = file.Key;
          }

          const pineconeIndex = PineconeClient.index(PINECONE_INDEX);

          const store = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex,
            namespace: subPrefix,
          });

          const customDocsIds = chunksToEmbed.map(
            (_, i) => `${file.Key}#chunk_${i}#${ObjectID().toHexString()}`
          );

          await store.addDocuments(chunksToEmbed, { ids: customDocsIds });

          await delay(20000);
          console.log("Embeddings Generated of: ", file.Key);
          console.log("-------------------");
        }
      })
    );
  }

  // Recursively process subfolders
  if (data.CommonPrefixes) {
    await Promise.all(
      data.CommonPrefixes.map(async (folder) => {
        if (!folder.Prefix) return;

        await processSubjectsFiles(folder.Prefix, subPrefix);
      })
    );
  }
};

export const generateEmbeddings = async () => {
  try {
    // Getting all the subjects folders
    const command = new ListObjectsCommand({
      Prefix: SUBJECT_FOLDERS_PREFIX,
      Bucket: bucketName,
      Delimiter: "/",
    });

    const subFolders = await aws_s3.send(command);

    // Iterating over all subjects folders and processing all their pdf files to generate embeddings
    await Promise.all(
      (subFolders.CommonPrefixes || []).map(async (subFolder) => {
        if (!subFolder.Prefix) return;

        processSubjectsFiles(subFolder.Prefix, subFolder.Prefix);
      })
    );
  } catch (err) {
    console.log("Error creating embeddings of objects");
    console.log("------------------------------------");
    console.log(err);
  }
};

const countTokens = (text: string) => encode(text).length;

async function downloadPdfFromS3(key: string): Promise<Uint8Array | undefined> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  const response = await aws_s3.send(command);

  if (!response.Body) return;

  return await response.Body.transformToByteArray();
}

generateEmbeddings();
