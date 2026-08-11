import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { randomUUID } from "crypto";

export const BUCKET_PATHS = {
  SOAL_IMAGES: "cbt/soal-images",
} as const;

/** Allowed MIME types for soal image upload */
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Max upload size: 5 MB */
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

/** Max dimension for soal images after resize */
const IMAGE_MAX_DIMENSION = 1024;

/** WebP quality for compression */
const WEBP_QUALITY = 80;

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("S3_BUCKET")!;
    this.endpoint = this.configService.get<string>("S3_ENDPOINT")!;

    const region = this.configService.get<string>("S3_REGION") || "auto";

    this.s3Client = new S3Client({
      region,
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.configService.get<string>("S3_ACCESS_KEY_ID")!,
        secretAccessKey: this.configService.get<string>(
          "S3_SECRET_ACCESS_KEY",
        )!,
      },
      forcePathStyle:
        this.configService.get<string>("S3_FORCE_PATH_STYLE", "false") ===
        "true",
    });
  }

  /**
   * Upload a file to S3 storage.
   * @param path - Full object key
   * @param file - File content as Buffer
   * @param contentType - MIME type of the file
   * @returns The object key that was stored
   */
  async upload(
    path: string,
    file: Buffer,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: file,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Uploaded file to ${path}`);
    return path;
  }

  /**
   * Download a file from S3 storage.
   * @param key - Object key to download
   * @returns File content as Buffer
   */
  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const stream = response.Body;

    if (!stream) {
      throw new Error(`Empty response body for key: ${key}`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from S3 storage.
   * @param key - Object key to delete
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Deleted file at ${key}`);
  }

  /**
   * Generate a presigned URL for temporary access to a private object.
   * @param key - Object key
   * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL string
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client as any, command, { expiresIn });
  }

  /**
   * Construct a public URL for a stored object key.
   * Format: {endpoint}/{bucket}/{key}
   */
  getPublicUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Validate, compress, and upload a soal image to S3.
   *
   * - Validates MIME type via Sharp metadata
   * - Validates file size ≤ 5 MB
   * - Resizes to max 1024×1024 preserving aspect ratio
   * - Converts to WebP with quality 80 for compression
   * - Uploads with UUID-based filename under cbt/soal-images/{tenantId}/
   * - Returns the public URL
   *
   * @param tenantId - Tenant ID for organizing files
   * @param file - Multer file object
   * @returns Public URL of the uploaded image
   */
  async uploadSoalImage(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    // Validate size before processing
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new BadRequestException("Ukuran file maksimum 5 MB.");
    }

    // Validate MIME type via Sharp metadata
    let sharpMeta: sharp.Metadata;
    try {
      sharpMeta = await sharp(file.buffer).metadata();
    } catch {
      throw new BadRequestException(
        "Format file tidak valid. Gunakan JPEG, PNG, atau WebP.",
      );
    }

    // Map Sharp format names to MIME types
    const formatToMime: Record<string, string> = {
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    const detectedMime = sharpMeta.format
      ? formatToMime[sharpMeta.format]
      : undefined;

    if (!detectedMime || !ALLOWED_IMAGE_MIME_TYPES.includes(detectedMime)) {
      throw new BadRequestException(
        "Format file tidak valid. Gunakan JPEG, PNG, atau WebP.",
      );
    }

    // Resize and convert to WebP for storage efficiency
    const compressedBuffer = await sharp(file.buffer)
      .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const uuid = randomUUID();
    const key = `${BUCKET_PATHS.SOAL_IMAGES}/${tenantId}/${uuid}.webp`;

    await this.upload(key, compressedBuffer, "image/webp");

    this.logger.log(
      `Soal image uploaded for tenant ${tenantId}: ${key} (original: ${file.size} bytes, compressed: ${compressedBuffer.length} bytes)`,
    );

    return this.getPublicUrl(key);
  }

  /**
   * Delete a soal image by its URL.
   * Extracts the key from the URL and deletes from S3.
   *
   * @param url - Public URL of the image to delete
   */
  async deleteSoalImage(url: string): Promise<void> {
    // Extract key from URL: {endpoint}/{bucket}/{key}
    const prefix = `${this.endpoint}/${this.bucket}/`;
    if (!url.startsWith(prefix)) {
      this.logger.warn(`Cannot extract key from URL: ${url}`);
      return;
    }

    const key = url.slice(prefix.length);
    await this.delete(key);
  }
}
