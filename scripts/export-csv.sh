#!/bin/sh
# Exports the study data to CSV files, one per dataset.
#
# Usage:
#   DATABASE_URL="<External Database URL from Render>" ./scripts/export-csv.sh [output-dir]
#
# The External URL is on the Render dashboard: mathe-db -> Connect -> External.
# Never commit the URL or the exported files: they contain student data.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: set DATABASE_URL to the External Database URL first." >&2
  exit 1
fi

OUT_DIR=${1:-"mathe-export-$(date +%Y%m%d-%H%M)"}
mkdir -p "$OUT_DIR"

run_copy() {
  name=$1
  query=$2
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\copy ($query) TO '$OUT_DIR/$name.csv' WITH (FORMAT csv, HEADER true)"
  echo "  $OUT_DIR/$name.csv"
}

echo "==> Exporting to $OUT_DIR"

# One row per completed questionnaire: features, prediction and student context.
run_copy "resultados" '
SELECT r.id AS result_id, r."questionnaireId", r."studentId",
       u.name AS student_name, u.email AS student_email, u."birthDate",
       ag.name AS grade, ag.level AS grade_level,
       s."cenEdu" AS school, s.district AS school_district,
       q.status, q."usedFallback", q."completionPercentage",
       q."startTime", q."endTime",
       d."visualScore", d."auditoryScore", d."kinestheticScore",
       d."responseConsistency", d."avgQuestionTime", d."totalChanges", d."totalReviews",
       r."predominantStyle", r."secondaryStyle",
       r."visualProbability", r."auditoryProbability", r."kinestheticProbability",
       r."predominantConfidence", r."profileType", r."isMixedProfile",
       r."classifierType", r."modelVersion", r."feedbackSource", r."aiFeedback",
       r."correctedVakLabel", r."resultDate", r."createdAt"
FROM "Result" r
JOIN "Questionnaire" q ON q.id = r."questionnaireId"
JOIN "User" u ON u.id = r."studentId"
LEFT JOIN "AcademicGrade" ag ON ag.id = u."academicGradeId"
LEFT JOIN "School" s ON s.id = u."schoolId"
LEFT JOIN "MLDataset" d ON d."questionnaireId" = q.id
WHERE r."deletedAt" IS NULL
ORDER BY r.id'

# Model input features, exactly as the classifier receives them.
run_copy "ml_dataset" '
SELECT * FROM "MLDataset" ORDER BY id'

# One row per answered question, with the style of the question and of the chosen option.
run_copy "respuestas" '
SELECT a.id AS answer_id, a."questionnaireId", q."studentId",
       a."questionId", qu."vakStyle" AS question_style, qu.origin AS question_origin,
       a."selectedOptionId", o."vakValue" AS selected_option_style, o.text AS selected_option_text,
       a."navigationSequence", a."questionTimeSeconds", a."numberOfChanges", a."timesReviewed",
       a."createdAt"
FROM "Answer" a
JOIN "Questionnaire" q ON q.id = a."questionnaireId"
JOIN "Question" qu ON qu.id = a."questionId"
LEFT JOIN "Option" o ON o.id = a."selectedOptionId"
WHERE a."deletedAt" IS NULL
ORDER BY a."questionnaireId", a."navigationSequence"'

# Every questionnaire, including abandoned ones.
run_copy "cuestionarios" '
SELECT q.id, q."studentId", u.name AS student_name, q.status, q."usedFallback",
       q."completionPercentage", q."startTime", q."endTime", q."createdAt"
FROM "Questionnaire" q
JOIN "User" u ON u.id = q."studentId"
WHERE q."deletedAt" IS NULL
ORDER BY q.id'

# Students and teachers, without password hashes.
run_copy "usuarios" '
SELECT u.id, u.name, u.email, u."birthDate", u."phoneNumber", u."isActive",
       r.description AS role, ag.name AS grade, s."cenEdu" AS school, s.district,
       u."createdAt"
FROM "User" u
LEFT JOIN "Roles" r ON r.id = u."roleId"
LEFT JOIN "AcademicGrade" ag ON ag.id = u."academicGradeId"
LEFT JOIN "School" s ON s.id = u."schoolId"
WHERE u."deletedAt" IS NULL
ORDER BY u.id'

# Question bank.
run_copy "preguntas" '
SELECT q.id, q."teacherId", t.name AS teacher_name, q."schoolId", s."cenEdu" AS school,
       q.statement, q."vakStyle", q.origin, q."validationStatus", q."rejectionReason",
       q."mediaUrl", q."generationDate",
       q."mviStatus", q."approvedOverMvi", q."mviCatalogVersion", q."mviValidatedAt"
FROM "Question" q
LEFT JOIN "User" t ON t.id = q."teacherId"
LEFT JOIN "School" s ON s.id = q."schoolId"
WHERE q."deletedAt" IS NULL
ORDER BY q.id'

# Answer options of every question (join with preguntas.csv by question_id).
run_copy "opciones" '
SELECT o.id AS option_id, o."questionId" AS question_id, o."vakValue", o.text
FROM "Option" o
JOIN "Question" q ON q.id = o."questionId"
WHERE o."deletedAt" IS NULL AND q."deletedAt" IS NULL
ORDER BY o."questionId", o.id'

echo "==> Done. Files in $OUT_DIR"
