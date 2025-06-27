import prisma from "../utils/prismadb";

import { listObjects } from "./listObjects";
import { standaloneFile } from "@prisma/client";

import { getPDF, getImage, getFolderPrefix } from "../utils/utils";
import { OUTSIDE_BOOKREVIEW_FOLDERS_PREFIX } from "../utils/consts";

export const syncBookReviews = async () => {
  let dbStandalones: Omit<
    standaloneFile,
    "id" | "createdAt" | "updatedAt" | "bookId"
  >[] = [];

  const allBooks = await prisma.standaloneFile.findMany({
    where: { type: "Book" },
  });

  await Promise.all(
    allBooks.map(async (book) => {
      const bookReviewsFolders = await listObjects(
        `${getFolderPrefix(book.pdfKey)}Book Reviews/`
      );

      await Promise.all(
        bookReviewsFolders.map(async (bookReviewFolder) => {
          const bookReviewFolderFiles = await listObjects(
            bookReviewFolder.prefix
          );

          const pdf = getPDF(bookReviewFolderFiles);
          const coverImage = getImage(bookReviewFolderFiles);

          dbStandalones.push({
            // @ts-ignore
            book: { connect: { id: book.id } },
            bookReviewIds: [],
            pdfKey: pdf.key,
            type: "BookReview",
            imageUrl: coverImage.url,
            name: bookReviewFolder.name || "Untitled",
          });
        })
      );
    })
  );

  const outsideBooksReviewsFolders = await listObjects(
    OUTSIDE_BOOKREVIEW_FOLDERS_PREFIX
  );

  await Promise.all(
    outsideBooksReviewsFolders.map(async (outsideBooksReviewsFolder) => {
      const outsideBookReviewFolderFiles = await listObjects(
        outsideBooksReviewsFolder.prefix
      );

      const pdf = getPDF(outsideBookReviewFolderFiles);
      const coverImage = getImage(outsideBookReviewFolderFiles);

      dbStandalones.push({
        pdfKey: pdf.key,
        bookReviewIds: [],
        type: "BookReview",
        imageUrl: coverImage.url,
        name: outsideBooksReviewsFolder.name || "Untitled",
      });
    })
  );

  await prisma.standaloneFile.deleteMany({ where: { type: "BookReview" } });

  await Promise.all(
    dbStandalones.map(async (dbStandalone) => {
      return await prisma.standaloneFile.create({
        data: dbStandalone,
      });
    })
  );

  const bookReviews = await prisma.standaloneFile.findMany({
    where: { type: "BookReview" },
  });

  let booksReviewIds: { [key: string]: string[] } = {};

  bookReviews.map((bookReview) => {
    if (!bookReview.bookId) return;

    if (booksReviewIds[bookReview.bookId])
      booksReviewIds[bookReview.bookId].push(bookReview.id);
    else booksReviewIds[bookReview.bookId] = [bookReview.id];
  });

  await Promise.all(
    Object.keys(booksReviewIds).map(async (bookId) => {
      await prisma.standaloneFile.update({
        where: {
          type: "Book",
          id: bookId,
        },
        data: {
          bookReviewIds: booksReviewIds[bookId],
        },
      });
    })
  );

  console.log("Synced books reviews");
};

syncBookReviews();
