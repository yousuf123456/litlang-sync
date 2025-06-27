import prisma from "../utils/prismadb";

import { listObjects } from "./listObjects";

import { ResourceType, SubjectType } from "../types";
import { SUBJECT_FOLDERS_PREFIX } from "../utils/consts";
import { getImage } from "../utils/utils";

export const syncSubjects = async () => {
  let dbSubjects: Omit<SubjectType, "id" | "updatedAt" | "createdAt">[] = [];

  const subjectFolders = await listObjects(SUBJECT_FOLDERS_PREFIX);

  await Promise.all(
    (subjectFolders || []).map(async (subFolder) => {
      const subjectResources = await listObjects(subFolder.prefix);

      const subjectImage = getImage(subjectResources);

      //@ts-ignore
      async function fetchandMapResources(
        initialResources: {
          id: string;
          key: string;
          url: string;
          prefix: string;
          mimeType: string;
          isPremium: boolean;
          isHandwritten: boolean;
          name: string | undefined;
        }[]
      ) {
        return await Promise.all(
          initialResources.map(async (resource): Promise<ResourceType> => {
            if (resource.mimeType === "application/x-directory") {
              const folderResources = await listObjects(resource.prefix);

              //@ts-ignore
              const mappedFolderResources = await fetchandMapResources(
                folderResources
              );

              return {
                type: "Folder",
                id: resource.id,
                isPremium: false,
                name: resource.name || "Untitled",
                resources: mappedFolderResources,
              };
            }

            return {
              resources: [],
              key: resource.key,
              id: resource.id || "No Id",
              isPremium: resource.isPremium,
              isHandwritten: resource.isHandwritten,
              name: resource.name || "Untitled",
              type: resource.mimeType === "application/pdf" ? "PDF" : "Audio",
            } as ResourceType;
          })
        );
      }

      // Resources without subject cover image
      const filteredSubjResources = (subjectResources || []).filter(
        (subjectResource) =>
          subjectResource.mimeType !== "image/jpeg" &&
          subjectResource.mimeType !== "image/png" &&
          subjectResource.mimeType !== "image/gif" &&
          subjectResource.mimeType !== "image/bmp" &&
          subjectResource.mimeType !== "image/tiff" &&
          subjectResource.mimeType !== "image/webp" &&
          subjectResource.mimeType !== "image/svg+xml"
      );

      const dbSubject = {
        imageUrl: subjectImage?.url || "",
        name: subFolder.name || "Untitled",
        resources: await fetchandMapResources(filteredSubjResources),
      };

      // Prisma.JsonValue does not match with ResourceType
      dbSubjects.push(dbSubject as (typeof dbSubjects)[0]);
    })
  );

  await prisma.subject.deleteMany();

  await Promise.all(
    dbSubjects.map(async (dbSubject) => {
      return await prisma.subject.create({
        data: dbSubject as any,
      });
    })
  );

  console.log("Synced subjects");
};

syncSubjects();
