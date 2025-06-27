import { subject } from "@prisma/client";

export type ResourceMimeType = "PDF" | "Folder" | "Audio";

export type ResourceType = {
  resources: ResourceType[];
  isHandwritten?: boolean;
  type: ResourceMimeType;
  isPremium?: Boolean;
  name: string;
  key?: string;
  id: string;
};

export type SubjectType = subject & {
  resources: ResourceType[];
  paginationToken?: string;
};
