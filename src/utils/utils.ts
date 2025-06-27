export const getImage = (
  files: {
    key: string;
    prefix: string;
    id: string;
    name: string | undefined;
    url: string;
    mimeType: string;
  }[]
) => {
  return (files || []).filter(
    (files) =>
      files.mimeType === "image/jpeg" ||
      files.mimeType === "image/png" ||
      files.mimeType === "image/gif" ||
      files.mimeType === "image/bmp" ||
      files.mimeType === "image/tiff" ||
      files.mimeType === "image/webp" ||
      files.mimeType === "image/svg+xml"
  )[0];
};

export const getPDF = (
  files: {
    key: string;
    prefix: string;
    id: string;
    name: string | undefined;
    url: string;
    mimeType: string;
  }[]
) => {
  return (files || []).filter((file) => file.mimeType === "application/pdf")[0];
};

export function getFolderPrefix(s3Key: string) {
  // Split the key by '/'
  const parts = s3Key.split("/");

  // Remove the last part (filename) and join the rest
  const folderPrefix = parts.slice(0, -1).join("/") + "/";

  return folderPrefix;
}
