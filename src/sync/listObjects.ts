import aws_s3 from "../utils/aws_s3";
import { ListObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

import { lookup } from "mime-types";
import ObjectId from "bson-objectid";
import { BUCKET_NAME } from "../utils/consts";

export const listObjects = async (prefix: string) => {
  const params = {
    Bucket: BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  };

  try {
    const response = await aws_s3.send(new ListObjectsCommand(params));

    // Folders will be in CommonPrefixes
    const folders = (response.CommonPrefixes || []).map((prefixObj) => ({
      isPremium: false,
      isHandwritten: false,
      key: prefixObj.Prefix!,
      prefix: prefixObj.Prefix!,
      id: ObjectId().toHexString(),
      name: (prefixObj.Prefix || "").split("/").slice(-2, -1)[0], // Extract folder name
      url: `https://drwjw5urvo0gp.cloudfront.net/${prefixObj.Prefix}`, // Serve files through cloudfront distribution
      mimeType: "application/x-directory",
    }));

    // Files will be in Contents
    const files = await Promise.all(
      (response.Contents || [])
        .filter((contentObj) => contentObj.Key !== prefix)
        .map(async (contentObj) => {
          const headParams = {
            Bucket: "litlang2",
            Key: contentObj.Key,
          };

          const headResponse = await aws_s3.send(
            new HeadObjectCommand(headParams)
          );

          const metadata = headResponse.Metadata || {};

          const isPremium = metadata["ispremium"] === "true";
          const isHandwritten = metadata["ishandwritten"] === "true";

          return {
            isPremium,
            isHandwritten,
            key: contentObj.Key!,
            prefix: contentObj.Key!,
            id: ObjectId().toHexString(),
            name: (contentObj.Key || "").split("/").pop(), // Extract file name
            url: `https://drwjw5urvo0gp.cloudfront.net/${contentObj.Key}`, // Serve files through cloudfront distribution
            mimeType:
              lookup(contentObj.Key || "") || "application/octet-stream", // Simple mimeType determination by file extension
          };
        })
    );

    const filteredFiles = files.filter((file) => file.prefix !== prefix);
    const combinedResources = [...folders, ...filteredFiles];

    return combinedResources;
  } catch (err) {
    console.error("Error listing objects from S3:", err);
    throw err;
  }
};
