import { registerAs } from "@nestjs/config";

export const envConfig = registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5003", 10),

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  // JWT (shared secret with LMS — must match JWT_ACCESS_SECRET from LMS)
  jwtSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",

  // CORS
  corsOrigins: process.env.CORS_ORIGINS || "",

  // S3
  s3Bucket: process.env.S3_BUCKET || "",
  s3Region: process.env.S3_REGION || "ap-southeast-1",
  s3Endpoint: process.env.S3_ENDPOINT || "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
}));
