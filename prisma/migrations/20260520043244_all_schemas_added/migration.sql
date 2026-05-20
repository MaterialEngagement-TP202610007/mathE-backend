/*
  Warnings:

  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - Added the required column `birthDate` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "status",
DROP COLUMN "username",
ADD COLUMN     "academicGradeId" INTEGER,
ADD COLUMN     "birthDate" DATE NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(0),
ADD COLUMN     "phoneNumber" VARCHAR(20),
ADD COLUMN     "schoolName" VARCHAR(100),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "AcademicGrade" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "level" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(0),

    CONSTRAINT "AcademicGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" SERIAL NOT NULL,
    "questionnaireId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "selectedOptionId" INTEGER,
    "navigationSequence" INTEGER,
    "questionTimeSeconds" DOUBLE PRECISION,
    "numberOfChanges" INTEGER,
    "numberOfClicks" INTEGER,
    "timesReviewed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLDataset" (
    "id" SERIAL NOT NULL,
    "questionnaireId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "visualScore" INTEGER,
    "auditoryScore" INTEGER,
    "kinestheticScore" INTEGER,
    "avgQuestionTime" DOUBLE PRECISION,
    "totalTime" DOUBLE PRECISION,
    "totalChanges" INTEGER,
    "totalClicks" INTEGER,
    "engagementLevel" DOUBLE PRECISION,
    "responseConsistency" DOUBLE PRECISION,
    "completionPercentage" DOUBLE PRECISION,
    "vakLabel" VARCHAR(20),
    "labelSource" VARCHAR(50),
    "includedInTraining" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLModel" (
    "id" SERIAL NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "fileUrl" VARCHAR(500) NOT NULL,
    "algorithm" VARCHAR(50) NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "f1Visual" DOUBLE PRECISION,
    "f1Auditory" DOUBLE PRECISION,
    "f1Kinesthetic" DOUBLE PRECISION,
    "trainingSamples" INTEGER,
    "testSamples" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "trainingDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "resultId" INTEGER,
    "type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "vakValue" VARCHAR(1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionEmbedding" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "embeddingVector" TEXT NOT NULL,
    "modelVersion" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER,
    "statement" TEXT NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "vakStyle" VARCHAR(20) NOT NULL,
    "mediaUrl" VARCHAR(500),
    "origin" VARCHAR(50) NOT NULL,
    "validationStatus" VARCHAR(50) NOT NULL,
    "rejectionReason" TEXT,
    "generationDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "totalTimeSeconds" DOUBLE PRECISION,
    "completionPercentage" DOUBLE PRECISION,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "questionnaireId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "mlModelId" INTEGER,
    "predominantStyle" VARCHAR(20),
    "visualProbability" DOUBLE PRECISION,
    "auditoryProbability" DOUBLE PRECISION,
    "kinestheticProbability" DOUBLE PRECISION,
    "isMixedProfile" BOOLEAN NOT NULL DEFAULT false,
    "classifierType" VARCHAR(50),
    "modelVersion" VARCHAR(20),
    "aiFeedback" TEXT,
    "feedbackSource" VARCHAR(50),
    "correctedVakLabel" VARCHAR(20),
    "correctingTeacherId" INTEGER,
    "resultDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MLDataset_questionnaireId_key" ON "MLDataset"("questionnaireId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionEmbedding_questionId_key" ON "QuestionEmbedding"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_questionnaireId_key" ON "Result"("questionnaireId");

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLDataset" ADD CONSTRAINT "MLDataset_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLDataset" ADD CONSTRAINT "MLDataset_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionEmbedding" ADD CONSTRAINT "QuestionEmbedding_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_questionnaireId_fkey" FOREIGN KEY ("questionnaireId") REFERENCES "Questionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_mlModelId_fkey" FOREIGN KEY ("mlModelId") REFERENCES "MLModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_correctingTeacherId_fkey" FOREIGN KEY ("correctingTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_academicGradeId_fkey" FOREIGN KEY ("academicGradeId") REFERENCES "AcademicGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
