/*
  Warnings:

  - You are about to drop the column `numberOfClicks` on the `Answer` table. All the data in the column will be lost.
  - You are about to drop the column `engagementLevel` on the `MLDataset` table. All the data in the column will be lost.
  - You are about to drop the column `totalClicks` on the `MLDataset` table. All the data in the column will be lost.
  - You are about to drop the column `totalTime` on the `MLDataset` table. All the data in the column will be lost.
  - You are about to drop the column `totalTimeSeconds` on the `Questionnaire` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Answer" DROP COLUMN "numberOfClicks";

-- AlterTable
ALTER TABLE "MLDataset" DROP COLUMN "engagementLevel",
DROP COLUMN "totalClicks",
DROP COLUMN "totalTime",
ADD COLUMN     "totalReviews" INTEGER;

-- AlterTable
ALTER TABLE "Questionnaire" DROP COLUMN "totalTimeSeconds";
