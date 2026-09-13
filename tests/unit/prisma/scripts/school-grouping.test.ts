import {
  EXCLUDED_INSTITUTION_KEYS,
  groupSchoolServices,
  normalizeSchoolName,
  SchoolServiceRow,
} from '../../../../prisma/scripts/school-grouping.js';

function row(overrides: Partial<SchoolServiceRow>): SchoolServiceRow {
  return {
    codInst: '25306813',
    codMod: '0331041',
    codLocal: '337988',
    cenEdu: 'CLARETIANO',
    level: 'Primaria',
    address: 'AV. LA MAR 123',
    district: 'SAN MIGUEL',
    businessName: 'CONGREGACION CLARETIANA',
    ...overrides,
  };
}

describe('normalizeSchoolName', () => {
  it('ignores case, accents, punctuation and repeated spaces', () => {
    expect(normalizeSchoolName("  Uribe's   Schóol ")).toBe('URIBE S SCHOOL');
    expect(normalizeSchoolName('URIBE S SCHOOL')).toBe('URIBE S SCHOOL');
  });
});

describe('groupSchoolServices', () => {
  it('merges level variants of the same school (same CODLOCAL and name)', () => {
    const { schools } = groupSchoolServices([
      row({ codMod: '0336743', level: 'Secundaria' }),
      row({ codMod: '0331041', level: 'Primaria' }),
    ]);

    expect(schools).toHaveLength(1);
    expect(schools[0]).toEqual({
      institutionKey: 'LOC-337988-CLARETIANO',
      cenEdu: 'CLARETIANO',
      district: 'SAN MIGUEL',
      address: 'AV. LA MAR 123',
      businessName: 'CONGREGACION CLARETIANA',
      levels: ['Primaria', 'Secundaria'],
      codMods: ['0331041', '0336743'],
    });
  });

  it('never merges homonymous schools located in different premises', () => {
    const { schools } = groupSchoolServices([
      row({ codMod: '0331041', codLocal: '337988', codInst: '25306813', district: 'SAN MIGUEL' }),
      row({ codMod: '0999001', codLocal: '999001', codInst: '29999001', district: 'SURCO' }),
    ]);

    expect(schools.map((s) => s.institutionKey).sort()).toEqual([
      'LOC-337988-CLARETIANO',
      'LOC-999001-CLARETIANO',
    ]);
  });

  it('excludes the duplicate Claretiano (Villa Maria del Triunfo) removed for the demo', () => {
    expect(EXCLUDED_INSTITUTION_KEYS).toContain('LOC-347708-CLARETIANO');

    const { schools, stats } = groupSchoolServices([
      row({ codMod: '0331041', level: 'Primaria' }),
      row({ codMod: '0336743', level: 'Secundaria' }),
      row({ codMod: '0825018', codLocal: '347708', codInst: '21312908', district: 'VILLA MARIA DEL TRIUNFO' }),
      row({ codMod: '1267541', codLocal: '347708', codInst: '21312908', district: 'VILLA MARIA DEL TRIUNFO', level: 'Secundaria' }),
      row({ codMod: '7', codLocal: '100000', cenEdu: 'ALFA' }),
    ]);

    expect(schools.map((s) => s.institutionKey)).toEqual([
      'LOC-100000-ALFA',
      'LOC-337988-CLARETIANO',
    ]);
    expect(schools[1].codMods).toEqual(['0331041', '0336743']);
    expect(stats).toMatchObject({ uniqueCodMods: 5, schools: 2, mergedRows: 2, excludedSchools: 1 });
  });

  it('does not merge different names sharing the same premises', () => {
    const { schools } = groupSchoolServices([
      row({ codMod: '1', codLocal: '346983', cenEdu: 'NEW HOPE' }),
      row({ codMod: '2', codLocal: '346983', cenEdu: 'AMERICA', level: 'Secundaria' }),
    ]);

    expect(schools).toHaveLength(2);
  });

  it('does not merge campuses of one institution code located in different premises', () => {
    const { schools, stats } = groupSchoolServices([
      row({ codMod: '1', codInst: '26662877', codLocal: '341198', cenEdu: 'MARKHAM' }),
      row({ codMod: '2', codInst: '26662877', codLocal: '317278', cenEdu: 'MARKHAM', level: 'Secundaria' }),
    ]);

    expect(schools).toHaveLength(2);
    expect(stats.codInstSpanningMultipleCodLocal).toBe(1);
  });

  it('falls back to MOD-<codMod> when CODLOCAL is empty or a placeholder', () => {
    const { schools, stats } = groupSchoolServices([
      row({ codMod: '0000001', codLocal: '' }),
      row({ codMod: '0000002', codLocal: '000000', level: 'Secundaria' }),
    ]);

    expect(schools.map((s) => s.institutionKey).sort()).toEqual(['MOD-0000001', 'MOD-0000002']);
    expect(stats.fallbackKeys).toBe(2);
  });

  it('deduplicates repeated COD_MOD rows (last one wins) and reports stats', () => {
    const { schools, stats } = groupSchoolServices([
      row({ codMod: '0331041', address: 'OLD ADDRESS' }),
      row({ codMod: '0331041', address: 'AV. LA MAR 123' }),
      row({ codMod: '0336743', level: 'Secundaria' }),
    ]);

    expect(schools).toHaveLength(1);
    expect(schools[0].address).toBe('AV. LA MAR 123');
    expect(stats).toMatchObject({
      totalRows: 3,
      uniqueCodMods: 2,
      schools: 1,
      mergedRows: 1,
    });
  });

  it('skips rows without COD_MOD', () => {
    const { schools, stats } = groupSchoolServices([row({ codMod: '  ' })]);

    expect(schools).toHaveLength(0);
    expect(stats.skippedRows).toBe(1);
  });

  it('returns schools sorted by institutionKey for a stable generated file', () => {
    const { schools } = groupSchoolServices([
      row({ codMod: '2', codLocal: '900000', cenEdu: 'ZETA' }),
      row({ codMod: '1', codLocal: '100000', cenEdu: 'ALFA' }),
    ]);

    expect(schools.map((s) => s.institutionKey)).toEqual(['LOC-100000-ALFA', 'LOC-900000-ZETA']);
  });
});
