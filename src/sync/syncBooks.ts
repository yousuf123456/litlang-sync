import prisma from "../utils/prismadb";

import { listObjects } from "./listObjects";
import { standaloneFile } from "@prisma/client";

import { getImage, getPDF } from "../utils/utils";
import { BOOK_FOLDERS_PREFIX } from "../utils/consts";

export const syncBooks = async () => {
  let dbStandalones: Omit<
    standaloneFile,
    "id" | "createdAt" | "updatedAt" | "bookId"
  >[] = [];

  const booksFolders = await listObjects(BOOK_FOLDERS_PREFIX);

  await Promise.all(
    (booksFolders || []).map(async (folder) => {
      const bookFiles = await listObjects(folder.prefix);

      const bookImage = getImage(bookFiles);

      const pdfFile = getPDF(bookFiles);

      dbStandalones.push({
        type: "Book",
        bookReviewIds: [],
        name: folder.name || "Untitled",
        imageUrl:
          bookImage?.url ||
          "https://drwjw5urvo0gp.cloudfront.net/Litlang/Books/100 mistakes that changed history backfires and blunders that collapsed empires, crashed economies, and altered the course of our world by Bill Fawcett/WhatsApp Image 2024-07-20 at 2.48.33 PM.jpeg",
        pdfKey: pdfFile.key,
      });
    })
  );

  await prisma.standaloneFile.deleteMany({
    where: {
      type: "BookReview",
    },
  });

  await prisma.standaloneFile.deleteMany({
    where: {
      type: "Book",
    },
  });

  await Promise.all(
    dbStandalones.map(async (dbStandalone) => {
      return await prisma.standaloneFile.create({
        data: dbStandalone,
      });
    })
  );

  console.log("Synced books");
};

syncBooks();
