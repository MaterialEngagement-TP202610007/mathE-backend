import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ImageStorageAdapter } from "../../domain/adapters/image-storage.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

export class S3ImageStorageAdapter implements ImageStorageAdapter {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: envs.AWS_REGION,
      credentials: {
        accessKeyId: envs.AWS_ACCESS_KEY_ID,
        secretAccessKey: envs.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<string> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: envs.AWS_BUCKET,
          Key: key,
          Body: data,
          ContentType: mimeType,
        }),
      );
    } catch {
      throw CustomError.serviceUnavailable("S3 upload failed");
    }

    let domain = envs.CLOUDFRONT_DOMAIN.replace(/\/$/, "");
    if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
      domain = `https://${domain}`;
    }
    const normalizedKey = key.replace(/^\//, "");
    return `${domain}/${normalizedKey}`;
  }
}
