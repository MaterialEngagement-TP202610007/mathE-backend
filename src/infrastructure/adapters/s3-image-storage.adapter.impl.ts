import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ImageStorageAdapter } from "../../domain/adapters/image-storage.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { envs } from "../../config/envs.js";

// Keys are unique (uuid) and never overwritten, so CloudFront can cache forever.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export class S3ImageStorageAdapter implements ImageStorageAdapter {
  private client: S3Client | null = null;

  async upload(key: string, data: Buffer, mimeType: string): Promise<string> {
    if (
      !envs.AWS_BUCKET ||
      !envs.AWS_ACCESS_KEY_ID ||
      !envs.AWS_SECRET_ACCESS_KEY ||
      !envs.CLOUDFRONT_DOMAIN
    ) {
      throw CustomError.serviceUnavailable(
        "Image storage is not configured (AWS_BUCKET, AWS keys, CLOUDFRONT_DOMAIN)",
      );
    }

    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: envs.AWS_BUCKET,
          Key: key,
          Body: data,
          ContentType: mimeType,
          CacheControl: CACHE_CONTROL,
        }),
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : "UnknownError";
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[s3] upload of ${key} failed: ${name}: ${message}`);
      throw CustomError.serviceUnavailable("S3 upload failed");
    }

    let domain = envs.CLOUDFRONT_DOMAIN.replace(/\/$/, "");
    if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
      domain = `https://${domain}`;
    }
    const normalizedKey = key.replace(/^\//, "");
    return `${domain}/${normalizedKey}`;
  }

  private getClient(): S3Client {
    this.client ??= new S3Client({
      region: envs.AWS_REGION,
      credentials: {
        accessKeyId: envs.AWS_ACCESS_KEY_ID,
        secretAccessKey: envs.AWS_SECRET_ACCESS_KEY,
      },
    });
    return this.client;
  }
}
