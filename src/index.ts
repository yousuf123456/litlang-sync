import * as dotenv from "dotenv";
dotenv.config();

// S3 Folder Structure

//For Subjects
// litlang2/ -> Litlang/ -> Subjects/ -> SubjectsFolders/ -> Here Subject Image and All Subject Files

//For Books
// litlang2/ -> Litlang/ -> Books/ -> BookFileFolder/ -> Here Book Image and Book pdf file -> Book Reviews/ -> Here book reviews pdf files

//For Articles
// litlang2/ -> Litlang/ -> Articles/ -> ArticleFileFolder/ -> Here Article Image and Book pdf file

//For Texts
// litlang2/ -> Litlang/ -> Texts/ -> TextFileFolder/ -> Here Text Image and Book pdf file

import { syncTexts } from "./sync/syncTexts";
import { syncBooks } from "./sync/syncBooks";
import { syncSubjects } from "./sync/syncSubjects";
import { syncArticles } from "./sync/syncArticles";
import { syncBookReviews } from "./sync/syncBookReviews";

export const syncUpWithS3 = async () => {
  await syncSubjects();
  await syncBooks();
  await syncArticles();
  await syncTexts();
  await syncBookReviews();

  console.log("Completely in sync with s3");
};
