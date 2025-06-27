import prisma from "../utils/prismadb";

import { standaloneFile } from "@prisma/client";
import { getImage, getPDF } from "../utils/utils";

import { listObjects } from "./listObjects";
import { TEXT_FOLDERS_PREFIX } from "../utils/consts";

export const syncTexts = async () => {
  let dbStandalones: Omit<
    standaloneFile,
    "id" | "createdAt" | "updatedAt" | "bookId"
  >[] = [];

  const textsFolders = await listObjects(TEXT_FOLDERS_PREFIX);

  await Promise.all(
    (textsFolders || []).map(async (folder) => {
      const textFiles = await listObjects(folder.prefix);

      const textImage = getImage(textFiles);

      const pdfFile = getPDF(textFiles);

      dbStandalones.push({
        type: "Text",
        bookReviewIds: [],
        name: folder.name || "Untitled",
        imageUrl:
          textImage?.url ||
          "https://drwjw5urvo0gp.cloudfront.net/Litlang/Books/100 mistakes that changed history backfires and blunders that collapsed empires, crashed economies, and altered the course of our world by Bill Fawcett/WhatsApp Image 2024-07-20 at 2.48.33 PM.jpeg",
        pdfKey: pdfFile.key,
      });
    })
  );

  await prisma.standaloneFile.deleteMany({
    where: {
      type: "Text",
    },
  });

  await Promise.all(
    dbStandalones.map(async (dbStandalone) => {
      return await prisma.standaloneFile.create({
        data: dbStandalone,
      });
    })
  );

  console.log("Synced texts");
};

syncTexts();
