/*
  Warnings:

  - You are about to drop the column `schoolName` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "schoolName",
ADD COLUMN     "schoolId" INTEGER;

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "codMod" VARCHAR(20) NOT NULL,
    "cenEdu" VARCHAR(250) NOT NULL,
    "level" VARCHAR(50) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "district" VARCHAR(150) NOT NULL,
    "businessName" VARCHAR(250) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_codMod_key" ON "School"("codMod");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
