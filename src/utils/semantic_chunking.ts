import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StructuredOutputParser } from "langchain/output_parsers";
import { BaseLanguageModelInterface } from "@langchain/core/language_models/base";

import { z } from "zod";
import { Document } from "langchain/document";

interface Section {
  title: string;
  summary: string;
  endIndex: number;
  startIndex: number;
}

type SectionWithText = Section & {
  content: string;
};

interface StructuredDocument {
  sections: Section[];
}

const systemPrompt = `
Read the document below and extract a StructuredDocument object from it, where each section of the document is centered around a single concept/topic. Whenever possible, your sections (and section titles) should match up with the natural sections of the document (i.e. Introduction, Conclusion, References, etc.). Sections can vary in length, but should generally be anywhere from a few paragraphs to a few pages long.
Each line of the document is marked with its line number in square brackets (e.g. [1], [2], [3], etc). Use the line numbers to indicate section start and end.
The start and end line numbers will be treated as inclusive. For example, if the first line of a section is line 5 and the last line is line 10, the startIndex should be 5 and the endIndex should be 10.
The first section must start at the first line number of the document ({startLine} in this case), and the last section must end at the last line of the document ({endLine} in this case). The sections MUST be non-overlapping and cover the entire document. In other words, they must form a partition of the document.
Section titles should be descriptive enough such that a person who is just skimming over the section titles and not actually reading the document can get a clear idea of what each section is about.
Also give section summaries telling what the section is mainly about. The summary should be a single sentence, and it shouldn't be an excessively long sentence. DO NOT respond with anything else. Your response should take the form of "This section is about: X". For example, if the section is a balance sheet from a financial report about Apple, your response might be "This section is about: the financial position of Apple as of the end of the fiscal year." If the section is a chapter from a book on the history of the United States, and this chapter covers the Civil War, your response might be "This section is about: the causes and consequences of the American Civil War.
Create sections only for main topics. Include subtopics within their parent section, not as separate sections.
Please generate a JSON output with the following structure.
{{
  "sections": [
    {{
      "title": "<SECTION_TITLE_1>",
      "summary": "<SECTION_SUMMARY_1>",
      "startIndex": <START_INDEX_1>,
      "endIndex": <END_INDEX_1>
    }}
    ...
  ]
}}
Note: the document provided to you may just be an excerpt from a larger document, rather than a complete document. Therefore, you can't always assume, for example, that the first line of the document is the beginning of the Introduction section and the last line is the end of the Conclusion section (if those section are even present).
`;

export const getPagesIndex = (docs: Document[]) => {
  const pagesIndex: {
    pageNumber: number;
    startIndex: number;
    endIndex: number;
  }[] = [];

  docs.forEach((d, i) => {
    const lines = d.pageContent.split("\n");

    const startIndex = i !== 0 ? pagesIndex[i - 1].endIndex + 1 : 0;

    pagesIndex.push({
      startIndex,
      pageNumber: d.metadata.loc.pageNumber,
      endIndex: startIndex + lines.length,
    });
  });

  return pagesIndex;
};

function getDocumentLines(document: string): string[] {
  return document.split("\n");
}

function getDocumentWithLines(
  documentLines: string[],
  startLine: number,
  maxCharacters: number
): { documentWithLineNumbers: string; endLine: number } {
  let documentWithLineNumbers = "";
  let characterCount = 0;
  let endLine = startLine;

  for (let i = startLine; i < documentLines.length; i++) {
    const line = documentLines[i];
    documentWithLineNumbers += `[${i}] ${line}\n`;
    characterCount += line.length;

    if (characterCount > maxCharacters || i === documentLines.length - 1) {
      endLine = i;
      break;
    }
  }

  return { documentWithLineNumbers, endLine };
}

async function getStructuredDocument(
  documentWithLineNumbers: string,
  llm: BaseLanguageModelInterface,
  startLine: number,
  endLine: number
): Promise<StructuredDocument> {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", documentWithLineNumbers],
  ]);

  const outputParser = StructuredOutputParser.fromZodSchema(
    z.object({
      sections: z.array(
        z.object({
          title: z.string(),
          summary: z.string(),
          startIndex: z.number(),
          endIndex: z.number(),
        })
      ),
    })
  );

  const chain = RunnableSequence.from([prompt, llm, outputParser]);

  return await chain.invoke({
    startLine: startLine.toString(),
    endLine: endLine.toString(),
  });
}

function getSectionsText(
  sections: Section[],
  documentLines: string[]
): SectionWithText[] {
  return sections.map((s) => ({
    title: s.title,
    summary: s.summary,
    content: documentLines.slice(s.startIndex, s.endIndex + 1).join("\n"),
    startIndex: s.startIndex,
    endIndex: s.endIndex,
  }));
}

function partitionSections(
  sections: Section[],
  a: number,
  b: number
): Section[] {
  if (sections.length === 0) {
    return [{ title: "", startIndex: a, endIndex: b, summary: "" }];
  }

  sections = sections
    .filter((s) => s.startIndex <= b && s.endIndex >= a)
    .filter((s) => s.startIndex <= s.endIndex);

  if (sections.length === 0) {
    return [{ title: "", startIndex: a, endIndex: b, summary: "" }];
  }

  sections.forEach((s) => {
    if (s.startIndex < a) {
      s.startIndex = a;
      s.title = "";
    }
    if (s.endIndex > b) {
      s.endIndex = b;
      s.title = "";
    }
  });

  sections.sort((x, y) => x.startIndex - y.startIndex);

  let i = 0;
  while (i < sections.length - 1) {
    if (sections[i].endIndex >= sections[i + 1].endIndex) {
      sections.splice(i + 1, 1);
    } else {
      i++;
    }
  }

  if (sections[0].startIndex > a) {
    sections.unshift({
      title: "",
      summary: "",
      startIndex: a,
      endIndex: sections[0].startIndex - 1,
    });
  }

  if (sections[sections.length - 1].endIndex < b) {
    sections.push({
      title: "",
      summary: "",
      startIndex: sections[sections.length - 1].endIndex + 1,
      endIndex: b,
    });
  }

  const completedSections: Section[] = [];

  for (let i = 0; i < sections.length; i++) {
    if (i === 0) {
      completedSections.push(sections[i]);
    } else {
      if (sections[i].startIndex > sections[i - 1].endIndex + 1) {
        completedSections.push({
          title: "",
          summary: "",
          startIndex: sections[i - 1].endIndex + 1,
          endIndex: sections[i].startIndex - 1,
        });
      } else if (sections[i].startIndex <= sections[i - 1].endIndex) {
        completedSections[completedSections.length - 1].endIndex =
          sections[i].startIndex - 1;
        completedSections[completedSections.length - 1].title = "";
      }
      completedSections.push(sections[i]);
    }
  }

  return completedSections;
}

function isValidPartition(sections: Section[], a: number, b: number): boolean {
  if (
    sections[0].startIndex !== a ||
    sections[sections.length - 1].endIndex !== b
  ) {
    return false;
  }

  for (let i = 1; i < sections.length; i++) {
    if (sections[i].startIndex !== sections[i - 1].endIndex + 1) {
      return false;
    }
  }

  return true;
}

export async function getSections(
  document: string,
  maxCharacters: number = 45000000,
  llm: BaseLanguageModelInterface
): Promise<SectionWithText[]> {
  const maxIterations = 2 * (Math.floor(document.length / maxCharacters) + 1);

  const documentLines = getDocumentLines(document);

  let startLine = 0;
  let allSections: Section[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const { documentWithLineNumbers, endLine } = getDocumentWithLines(
      documentLines,
      startLine,
      maxCharacters
    );

    const structuredDoc = await getStructuredDocument(
      documentWithLineNumbers,
      llm,
      startLine,
      endLine
    );

    const newSections = structuredDoc.sections;

    allSections = allSections.concat(newSections);

    if (endLine >= documentLines.length - 1) {
      console.log("Breaking: ", i);
      break;
    } else {
      if (newSections.length > 1) {
        allSections.pop(); // remove the last section if it's incomplete
      }
      startLine = allSections[allSections.length - 1].endIndex + 1; // start from the next line
    }
  }

  const a = 0;
  const b = documentLines.length - 1;
  allSections = partitionSections(allSections, a, b);

  if (!isValidPartition(allSections, a, b)) {
    throw new Error("Invalid partition");
  }

  const sectionsWithText = getSectionsText(allSections, documentLines);

  return sectionsWithText;
}

export const getContextualChunkHeader = (
  section_title: string,
  section_summary: string
) => {
  return `Section context: this excerpt is from the section titled '${section_title}'. ${section_summary}`;
};
