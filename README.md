<!-- Improved compatibility of back to top link -->
<a id="readme-top"></a>

<div align="center">
  <a href="https://github.com/othneildrew/Best-README-Template">
    <img src="https://github.com/yousuf123456/LitLang/blob/main/public/logo.png" alt="Logo" width="100" height="100">
  </a>
  
  <h1>Litlang-Sync</h1>

  <p align="center">
    Repository containing data synchronization scripts and embedding generator script for Litlang's content pipeline.
    <br />
    <a href="https://github.com/othneildrew/Best-README-Template"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/othneildrew/Best-README-Template">View Demo</a>
    &middot;
    <a href="https://github.com/othneildrew/Best-README-Template/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/othneildrew/Best-README-Template/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>

  <br />
  <br />
</div>

<!-- GETTING STARTED -->
## Getting Started
To set up and run the sync and embedding scripts locally, follow the steps below.

### Prerequisites
Make sure the following tools are installed globally on your machine:
- [git (Version Control)](https://git-scm.com)
- [Node.js (Javascript running environment)](https://nodejs.org/en)
- [npm (Node Package Manager)](https://www.npmjs.com)
- [node-ts (For running TypeScript scripts directly)](https://www.npmjs.com/package/ts-node)


### Installation and Setup
Follow these steps to install the project and its dependencies in your machine:

1. Clone the repo
   ```sh
   git clone https://github.com/yousuf123456/Litlang.git
   ```

2. Install NPM packages
   ```sh
   npm install
   ```

3. Get your technologies credentials by creating an account on the following platforms:
   - [MongoDB](https://www.mongodb.com/)
   - [AWS-S3](https://aws.amazon.com/s3)
   - [Voyage](https://www.voyageai.com/)
   - [Pinecone](https://www.pinecone.io/)
   - [Gemini](https://ai.google.dev/gemini-api/docs/available-regions)

4. Add your obtained credentials in your `.env.local` file as.
   ```
   DATABASE_URL=mongo_database_url;
   
   S3_ACCESS_KEY=access_key;
   S3_SECRET_ACCESS_KEY=s3_secret_key;

   GEMINI_API_KEY=gemini_api_key;
   VOYAGE_API_KEY=voyage_api_key;
   PINECONE_API_KEY=pinecone_api_key;
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- USAGE EXAMPLES -->
## Usage and Setup

Usage and Setup Guide: For **Admins :open_file_folder:** 

### Adjust Constants
All constant values such as the LLM model name, embeddings model name, and S3 folder prefixes are defined in the file: ```src/utils/consts.ts```. Please review and update these constants to match your specific configuration.

1. **S3 Folder Prefixes**
   - Double-check that all S3 folder prefixes in ```consts.ts``` match your actual bucket structure to avoid errors.

2. **Language Model (LLM)**
   - Currently, the app uses a **Gemini gemini-2.5-flash model** (you may choose any other).
  
   - If switching to LLM other than Gemini:
  
   - Ensure Langchain.js supports it.
    
   - Modify ```src/utils/llm.ts``` to integrate the new model.

3. **Embedding Model**
   - Currently, the app uses a **Voyage voyage-large-2-instruct** embedding model (you may choose any other).
  
   - If switching to embedding model other than of Voyage:
  
     - Verify compatibility with Langchain.js.
    
     - Update ```src/utils/embeddings.ts``` accordingly. 


### Sync Scripts

All syncing scripts are located in the src/sync/ folder. These scripts iterate through files stored in a predefined structure in your S3 bucket, extract and organize their metadata according to the Prisma schema, and store it in the MongoDB database.

1. **Syncing Individual Content Types**
   - Each content type (subjects, texts, books, book reviews, articles) has its own dedicated sync script. You can sync specific content types by running individual scripts:
      ```
      ts-node src/sync/syncSubjects.ts  
      ts-node src/sync/syncBooks.ts  
      # ...and similarly for other content types
      ```

2. **Syncing All Content at Once**
   - To sync all content types at once, run:
      ```
      ts-node src/index.ts
      ```


<!-- Embeddings Generation Process Overview -->
## PDF Embeddings Generation

### Overview
```src/sync/generateEmbeddings.ts``` ,this script processes subjects PDF documents stored in an S3 bucket, breaks them into semantically meaningful chunks using LLM-based parsing, and generates embeddings. These embeddings are stored in a vector Pinecone database for efficient retrieval in a **Retrieval-Augmented Generation (RAG)** system.

### Key Workflow

1. **Getting PDFs**
   - The script recursively explores each subdirectory in ```Subjects/``` folder to get PDF files (ignoring handwritten or previously processed ones).
   - Downloads each PDF and extracts its text content using ```PDFLoader``` from Langchain Document Loaders.

2. **Semantic Chunking (LLM-Based)**
   - Uses **LLM** to identify natural document sections.
   - Creates sections based on **topics and concepts**.
   - **Title and Summary** is also created for each semantic chunk for better context.
   - Example LLM output format:
      ```
      {
        "sections": [
          {
            "title": "Literature Review",
            "summary": "This section discusses prior research on the topic.",
            "startIndex": 50,  // Starting line index
            "endIndex": 120    // Ending line index
          }
        ]
      }
      ```

3. **Chunking (Token-Based)**
   - If the section is oversized (e.g., > **528 tokens**), it’s further split into sub-chunks using ```RecursiveCharacterTextSplitter``` from Langchain Text Splitters.
   - Attach **metadata** (e.g., section titles, summaries, page numbers) to each sub chunk for efficient and accurate retrieval.
  
4. **Embeddings and Storage**
   - Chunks are converted into **embeddings** using a configured model (e.g., Voyage).
   - Stores in **Pinecone** with ```fileKey``` for filtering specific file when retrieving chunks.
  
### Usage
Run the script to process all PDFs in the S3 bucket:
```ts-node src/sync/generateEmbeddings.ts```
