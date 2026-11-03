import {
  ResultExport,
  ResultExportRow,
} from "../../domain/interfaces/result/index.js";

/** Lets Excel detect UTF-8 so accents (Kinestésico, Pérez) display correctly. */
const UTF8_BOM = "﻿";
/** RFC 4180 line break. */
const EOL = "\r\n";

/** Spanish headers: the file is shared with school authorities (HU-49). */
const HEADERS = [
  "Grado",
  "Nivel",
  "ID estudiante",
  "Nombre del estudiante",
  "Fecha del resultado",
  "Estilo predominante",
  "Confianza (%)",
  "Visual (%)",
  "Auditivo (%)",
  "Kinestésico (%)",
  "Perfil mixto",
  "Estilo secundario",
  "Clasificador",
];

const STYLE_LABELS: Record<string, string> = {
  Visual: "Visual",
  Auditory: "Auditivo",
  Kinesthetic: "Kinestésico",
};

/** Cells starting like a formula are prefixed so spreadsheets show them as text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function textCell(value: string | null): string {
  if (value === null || value === "") return "";
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== value
    ? `"${safe.replace(/"/g, '""')}"`
    : safe;
}

function numberCell(value: number | null): string {
  return value === null ? "" : String(Math.round(value * 100) / 100);
}

const styleCell = (style: string | null) =>
  textCell(style === null ? null : (STYLE_LABELS[style] ?? style));

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function toLine(row: ResultExportRow): string {
  return [
    textCell(row.gradeName),
    textCell(row.gradeLevel),
    String(row.studentId),
    textCell(row.studentName),
    isoDate(row.resultDate),
    styleCell(row.predominantStyle),
    numberCell(row.predominantConfidence),
    numberCell(row.visualProbability),
    numberCell(row.auditoryProbability),
    numberCell(row.kinestheticProbability),
    row.isMixedProfile ? "Sí" : "No",
    styleCell(row.secondaryStyle),
    textCell(row.classifierType),
  ].join(",");
}

/** HU-49 CSV: BOM, header row, one CRLF-terminated line per result. */
export function toResultsCsv(rows: ResultExportRow[]): string {
  return UTF8_BOM + [HEADERS.join(","), ...rows.map(toLine)].join(EOL) + EOL;
}

/** `reporte-estilos-colegio-<id>[-grado-<id>]-<from>-<to>.csv` (ASCII only). */
export function resultsCsvFilename(report: ResultExport): string {
  const scope =
    `colegio-${report.schoolId}` +
    (report.gradeId !== null ? `-grado-${report.gradeId}` : "");
  return `reporte-estilos-${scope}-${isoDate(report.from)}-${isoDate(report.to)}.csv`;
}
