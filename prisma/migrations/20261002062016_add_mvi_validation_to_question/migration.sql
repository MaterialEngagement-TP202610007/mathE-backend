-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "approvedOverMvi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mviCatalogVersion" VARCHAR(20),
ADD COLUMN     "mviResult" JSONB,
ADD COLUMN     "mviStatus" VARCHAR(20),
ADD COLUMN     "mviValidatedAt" TIMESTAMP(3);
