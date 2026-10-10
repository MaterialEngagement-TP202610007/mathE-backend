import { resultsCsvFilename, toResultsCsv } from '../../../../src/presentation/mappers/result-csv.mapper.js';
import { ResultExport, ResultExportRow } from '../../../../src/domain/interfaces/result/index.js';

function row(overrides: Partial<ResultExportRow> = {}): ResultExportRow {
  return {
    gradeName: '1ro Primaria',
    gradeLevel: 'Primaria',
    studentId: 12,
    studentName: 'Ana Pérez',
    resultDate: new Date('2026-09-03T10:00:00.000Z'),
    predominantStyle: 'Kinesthetic',
    predominantConfidence: 61.456,
    visualProbability: 20,
    auditoryProbability: 18.544,
    kinestheticProbability: 61.456,
    isMixedProfile: false,
    secondaryStyle: 'Visual',
    classifierType: 'xgboost',
    ...overrides,
  };
}

function exportOf(rows: ResultExportRow[], gradeId: number | null = null): ResultExport {
  return {
    schoolId: 8,
    gradeId,
    from: new Date('2026-09-01T00:00:00.000Z'),
    to: new Date('2026-09-30T23:59:59.999Z'),
    rows,
  };
}

describe('toResultsCsv (HU-49)', () => {
  it('starts with a UTF-8 BOM and a Spanish header row', () => {
    const csv = toResultsCsv([row()]);

    expect(csv.startsWith('﻿')).toBe(true);
    const [header] = csv.slice(1).split('\r\n');
    expect(header).toBe(
      'Grado,Nivel,ID estudiante,Nombre del estudiante,Fecha del resultado,Estilo predominante,Confianza (%),Visual (%),Auditivo (%),Kinestésico (%),Perfil mixto,Estilo secundario,Clasificador',
    );
  });

  it('writes one CRLF-terminated line per result with translated styles and rounded percentages', () => {
    const lines = toResultsCsv([row(), row({ isMixedProfile: true, secondaryStyle: null, gradeName: null, gradeLevel: null })])
      .slice(1)
      .split('\r\n');

    expect(lines[1]).toBe('1ro Primaria,Primaria,12,Ana Pérez,2026-09-03,Kinestésico,61.46,20,18.54,61.46,No,Visual,xgboost');
    expect(lines[2]).toBe(',,12,Ana Pérez,2026-09-03,Kinestésico,61.46,20,18.54,61.46,Sí,,xgboost');
    expect(lines[3]).toBe('');
  });

  it('quotes cells with commas, quotes or line breaks', () => {
    const csv = toResultsCsv([row({ studentName: 'Pérez, "Ana"\nMaría' })]);

    expect(csv).toContain('"Pérez, ""Ana""\nMaría"');
  });

  it('neutralizes spreadsheet formulas in text cells', () => {
    const csv = toResultsCsv([row({ studentName: '=HYPERLINK("x")' })]);

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('resultsCsvFilename (HU-49)', () => {
  it('names the school scope and the date range', () => {
    expect(resultsCsvFilename(exportOf([row()]))).toBe('reporte-estilos-colegio-8-2026-09-01-2026-09-30.csv');
  });

  it('adds the grade to the scope when filtered by grade', () => {
    expect(resultsCsvFilename(exportOf([row()], 3))).toBe('reporte-estilos-colegio-8-grado-3-2026-09-01-2026-09-30.csv');
  });
});
