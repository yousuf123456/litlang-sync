import prisma from "../utils/prismadb";

import { listObjects } from "./listObjects";

import { getImage, getPDF } from "../utils/utils";
import { standaloneFile } from "@prisma/client";
import { ARTICLE_FOLDERS_PREFIX } from "../utils/consts";

export const syncArticles = async () => {
  let dbStandalones: Omit<
    standaloneFile,
    "id" | "createdAt" | "updatedAt" | "bookId"
  >[] = [];

  const articlesFolders = await listObjects(ARTICLE_FOLDERS_PREFIX);

  await Promise.all(
    (articlesFolders || []).map(async (folder) => {
      const articleFiles = await listObjects(folder.prefix);

      const articleImage = getImage(articleFiles);

      const pdfFile = getPDF(articleFiles);

      dbStandalones.push({
        type: "Article",
        bookReviewIds: [],
        name: folder.name || "Untitled",
        imageUrl:
          articleImage?.url ||
          "https://drwjw5urvo0gp.cloudfront.net/Litlang/Books/100 mistakes that changed history backfires and blunders that collapsed empires, crashed economies, and altered the course of our world by Bill Fawcett/WhatsApp Image 2024-07-20 at 2.48.33 PM.jpeg",
        pdfKey: pdfFile.key,
      });
    })
  );

  await prisma.standaloneFile.deleteMany({
    where: {
      type: "Article",
    },
  });

  await Promise.all(
    dbStandalones.map(async (dbStandalone) => {
      return await prisma.standaloneFile.create({
        data: dbStandalone,
      });
    })
  );

  console.log("Synced articles");
};

syncArticles();
