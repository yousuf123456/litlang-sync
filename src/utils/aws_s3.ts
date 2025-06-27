import { S3Client } from "@aws-sdk/client-s3";

let aws_s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    //@ts-ignore
    accessKeyId: process.env.S3_ACCESS_KEY!,
    //@ts-ignore
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export default aws_s3;
