import { Request, Response } from 'express';
import { ResultController } from '../../../../src/presentation/controllers/result.controller.js';
import { ResultEntity } from '../../../../src/domain/entities/result.entity.js';

function makeRes(): jest.Mocked<Response> {
  const res = {} as jest.Mocked<Response>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ResultController student result listings', () => {
  let studentResults: { execute: jest.Mock };
  let controller: ResultController;

  beforeEach(() => {
    studentResults = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }) };
    const unused = {} as never;
    controller = new ResultController(
      unused, unused, studentResults as never, unused, unused, unused, unused, unused, unused, unused, unused,
    );
  });

  const query = {
    classifierType: 'xgboost',
    predominantStyle: 'Visual',
    startDate: '2026-09-01',
    endDate: '2026-09-13',
  };

  it('getByStudent forwards classifierType and a whole-day endDate', async () => {
    const req = {
      params: { studentId: '42' },
      query,
      user: { id: 7, roleId: 2 },
    } as unknown as Request;

    await controller.getByStudent(req, makeRes(), jest.fn());

    const [studentId, , filters] = studentResults.execute.mock.calls[0];
    expect(studentId).toBe(42);
    expect(filters.classifierType).toBe('xgboost');
    expect(filters.predominantStyle).toBe('Visual');
    expect(filters.startDate.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(filters.endDate.toISOString()).toBe('2026-09-13T23:59:59.999Z');
  });

  it('listMine uses the same filter normalization for the authenticated student', async () => {
    const req = { params: {}, query, user: { id: 9, roleId: 3 } } as unknown as Request;

    await controller.listMine(req, makeRes(), jest.fn());

    const [studentId, , filters] = studentResults.execute.mock.calls[0];
    expect(studentId).toBe(9);
    expect(filters.endDate.toISOString()).toBe('2026-09-13T23:59:59.999Z');
  });

  it('returns 400 for an invalid endDate', async () => {
    const res = makeRes();
    const req = { params: { studentId: '42' }, query: { endDate: 'nope' }, user: { id: 7, roleId: 2 } } as unknown as Request;

    await controller.getByStudent(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid endDate' });
    expect(studentResults.execute).not.toHaveBeenCalled();
  });
});

const NOW = new Date('2026-10-10T12:00:00.000Z');

describe('ResultController school-scoped endpoints', () => {
  const teacher = { id: 7, roleId: 2 };

  function makeController() {
    const schoolStats = { execute: jest.fn().mockResolvedValue({}) };
    const byGrade = { execute: jest.fn().mockResolvedValue([]) };
    const allResults = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }) };
    const unused = {} as never;
    const controller = new ResultController(
      unused, unused, unused, allResults as never, unused, schoolStats as never, byGrade as never, unused, unused,
      unused, unused, () => NOW,
    );
    return { controller, schoolStats, byGrade, allResults };
  }

  it('getSchoolStats passes the authenticated requester', async () => {
    const { controller, schoolStats } = makeController();
    const req = { params: { schoolId: '3' }, query: {}, user: teacher } as unknown as Request;

    await controller.getSchoolStats(req, makeRes(), jest.fn());

    expect(schoolStats.execute).toHaveBeenCalledWith(3, teacher, {});
  });

  it('getStatsByGrade passes level and the authenticated requester', async () => {
    const { controller, byGrade } = makeController();
    const req = { params: { schoolId: '3' }, query: { level: 'Primaria' }, user: teacher } as unknown as Request;

    await controller.getStatsByGrade(req, makeRes(), jest.fn());

    expect(byGrade.execute).toHaveBeenCalledWith(3, 'Primaria', teacher, {});
  });

  it('listAll passes the schoolId filter and the authenticated requester', async () => {
    const { controller, allResults } = makeController();
    const req = { params: {}, query: { schoolId: '3' }, user: teacher } as unknown as Request;

    await controller.listAll(req, makeRes(), jest.fn());

    const [, filters, requester] = allResults.execute.mock.calls[0];
    expect(filters.schoolId).toBe(3);
    expect(requester).toEqual(teacher);
  });
});

describe('ResultController report period (HU-51)', () => {
  const teacher = { id: 7, roleId: 2 };

  function makeController() {
    const schoolStats = { execute: jest.fn().mockResolvedValue({}) };
    const byGrade = { execute: jest.fn().mockResolvedValue([]) };
    const allResults = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }) };
    const unused = {} as never;
    const controller = new ResultController(
      unused, unused, unused, allResults as never, unused, schoolStats as never, byGrade as never, unused, unused,
      unused, unused, () => NOW,
    );
    return { controller, schoolStats, byGrade, allResults };
  }

  it('getSchoolStats resolves period=month against the injected clock', async () => {
    const { controller, schoolStats } = makeController();
    const req = { params: { schoolId: '3' }, query: { period: 'month' }, user: teacher } as unknown as Request;

    await controller.getSchoolStats(req, makeRes(), jest.fn());

    const [, , period] = schoolStats.execute.mock.calls[0];
    expect(period.from.toISOString()).toBe('2026-09-10T12:00:00.000Z');
    expect(period.to.toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('getStatsByGrade forwards from/to', async () => {
    const { controller, byGrade } = makeController();
    const req = { params: { schoolId: '3' }, query: { from: '2026-09-01', to: '2026-09-30' }, user: teacher } as unknown as Request;

    await controller.getStatsByGrade(req, makeRes(), jest.fn());

    const [, , , period] = byGrade.execute.mock.calls[0];
    expect(period.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(period.to.toISOString()).toBe('2026-09-30T23:59:59.999Z');
  });

  it('listAll maps the period onto startDate/endDate', async () => {
    const { controller, allResults } = makeController();
    const req = { params: {}, query: { schoolId: '3', period: 'week' }, user: teacher } as unknown as Request;

    await controller.listAll(req, makeRes(), jest.fn());

    const [, filters] = allResults.execute.mock.calls[0];
    expect(filters.startDate.toISOString()).toBe('2026-10-03T12:00:00.000Z');
    expect(filters.endDate.toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it.each([
    ['getSchoolStats', { from: '2026-10-02', to: '2026-10-01' }, 'from must be before or equal to to'],
    ['getStatsByGrade', { period: 'decade' }, 'period must be one of: week, month, quarter, year'],
    ['listAll', { from: 'nope' }, 'Invalid from date'],
  ] as const)('%s returns 400 for an invalid period', async (method, query, message) => {
    const { controller, schoolStats, byGrade, allResults } = makeController();
    const res = makeRes();
    const req = { params: { schoolId: '3' }, query, user: teacher } as unknown as Request;

    await controller[method](req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(schoolStats.execute).not.toHaveBeenCalled();
    expect(byGrade.execute).not.toHaveBeenCalled();
    expect(allResults.execute).not.toHaveBeenCalled();
  });
});

describe('ResultController CSV export (HU-49)', () => {
  const teacher = { id: 7, roleId: 2 };
  const exported = {
    schoolId: 3,
    gradeId: null,
    from: new Date('2026-09-10T12:00:00.000Z'),
    to: new Date('2026-10-10T12:00:00.000Z'),
    rows: [
      {
        gradeName: '1ro Primaria', gradeLevel: 'Primaria', studentId: 12, studentName: 'Ana',
        resultDate: new Date('2026-09-20T10:00:00.000Z'), predominantStyle: 'Visual', predominantConfidence: 70,
        visualProbability: 70, auditoryProbability: 20, kinestheticProbability: 10, isMixedProfile: false,
        secondaryStyle: 'Auditory', classifierType: 'xgboost',
      },
    ],
  };

  function makeController() {
    const exportResults = { execute: jest.fn().mockResolvedValue(exported) };
    const unused = {} as never;
    const controller = new ResultController(
      unused, unused, unused, unused, unused, unused, unused, unused, unused,
      exportResults as never, unused, () => NOW,
    );
    return { controller, exportResults };
  }

  function makeCsvRes() {
    const res = makeRes();
    res.setHeader = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  }

  it('sends a UTF-8 CSV attachment for the school, grade and period', async () => {
    const { controller, exportResults } = makeController();
    const res = makeCsvRes();
    const req = { params: {}, query: { schoolId: '3', gradeId: '4', period: 'month' }, user: teacher } as unknown as Request;

    await controller.exportCsv(req, res, jest.fn());

    const [filters, requester] = exportResults.execute.mock.calls[0];
    expect(filters).toEqual({
      schoolId: 3,
      gradeId: 4,
      from: new Date('2026-09-10T12:00:00.000Z'),
      to: NOW,
    });
    expect(requester).toEqual(teacher);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="reporte-estilos-colegio-3-2026-09-10-2026-10-10.csv"',
    );
    const body = (res.send as jest.Mock).mock.calls[0][0] as string;
    expect(body.startsWith('\uFEFFGrado,')).toBe(true);
    expect(body).toContain('1ro Primaria,Primaria,12,Ana,2026-09-20,Visual,70');
  });

  it.each([
    [{}, 'schoolId is required'],
    [{ schoolId: 'abc' }, 'Invalid schoolId'],
    [{ schoolId: '3', gradeId: 'x' }, 'Invalid gradeId'],
    [{ schoolId: '3', period: 'decade' }, 'period must be one of: week, month, quarter, year'],
  ])('returns 400 for %p', async (query, message) => {
    const { controller, exportResults } = makeController();
    const res = makeCsvRes();
    const req = { params: {}, query, user: teacher } as unknown as Request;

    await controller.exportCsv(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(exportResults.execute).not.toHaveBeenCalled();
  });

  it('passes use case errors (e.g. 404 no data) to the error handler', async () => {
    const { controller, exportResults } = makeController();
    const error = new Error('No results to export for the selected filters');
    exportResults.execute.mockRejectedValue(error);
    const res = makeCsvRes();
    const next = jest.fn();
    const req = { params: {}, query: { schoolId: '3' }, user: teacher } as unknown as Request;

    await controller.exportCsv(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe('ResultController school stability (HU-38)', () => {
  const teacher = { id: 7, roleId: 2 };
  const report = {
    schoolId: 3,
    gradeId: 4,
    summary: { students: 0, stable: 0, variable: 0, insufficientData: 0 },
    students: [],
  };

  function makeController() {
    const stability = { execute: jest.fn().mockResolvedValue(report) };
    const unused = {} as never;
    const controller = new ResultController(
      unused, unused, unused, unused, unused, unused, unused, unused, unused,
      unused, stability as never, () => NOW,
    );
    return { controller, stability };
  }

  it('forwards school, grade, the resolved period and the requester', async () => {
    const { controller, stability } = makeController();
    const res = makeRes();
    const req = {
      params: { schoolId: '3' },
      query: { gradeId: '4', period: 'quarter' },
      user: teacher,
    } as unknown as Request;

    await controller.getSchoolStability(req, res, jest.fn());

    expect(stability.execute).toHaveBeenCalledWith(
      { schoolId: 3, gradeId: 4, from: new Date('2026-07-10T12:00:00.000Z'), to: NOW },
      teacher,
    );
    expect(res.json).toHaveBeenCalledWith(report);
  });

  it.each([
    [{ schoolId: 'abc' }, {}, 'Invalid schoolId'],
    [{ schoolId: '3' }, { gradeId: 'x' }, 'Invalid gradeId'],
    [{ schoolId: '3' }, { period: 'decade' }, 'period must be one of: week, month, quarter, year'],
  ])('returns 400 for params %p query %p', async (params, query, message) => {
    const { controller, stability } = makeController();
    const res = makeRes();

    await controller.getSchoolStability(
      { params, query, user: teacher } as unknown as Request,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(stability.execute).not.toHaveBeenCalled();
  });
});

describe('ResultController label correction fields (HU-44)', () => {
  const teacher = { id: 7, roleId: 2 };
  const student = { id: 30, roleId: 3 };
  const correctedAt = new Date('2026-10-10T12:00:00.000Z');
  const corrected = ResultEntity.fromObject({
    id: 10, questionnaireId: 20, studentId: 30, predominantStyle: 'Visual',
    correctedVakLabel: 'Auditory', correctedAt, correctingTeacher: { id: 7, name: 'Profe Ana' },
  });
  const page = { items: [corrected], total: 1, page: 1, limit: 10 };

  function makeController() {
    const one = { execute: jest.fn().mockResolvedValue(corrected) };
    const list = { execute: jest.fn().mockResolvedValue(page) };
    const correct = { execute: jest.fn().mockResolvedValue(corrected) };
    const unused = {} as never;
    const controller = new ResultController(
      one as never, one as never, list as never, list as never, correct as never,
      unused, unused, unused, unused, unused, unused, () => NOW,
    );
    return { controller, one, list, correct };
  }

  function json(res: jest.Mocked<Response>) {
    return JSON.parse(JSON.stringify(res.json.mock.calls[0][0]));
  }

  const auditFields = {
    correctedVakLabel: 'Auditory',
    correctedAt: '2026-10-10T12:00:00.000Z',
    correctedBy: { id: 7, name: 'Profe Ana' },
  };

  it('PATCH /:id/correct-label returns the label, when and who', async () => {
    const { controller, correct } = makeController();
    const res = makeRes();
    const req = { params: { id: '10' }, body: { vakLabel: 'Auditory' }, user: teacher } as unknown as Request;

    await controller.correctLabel(req, res, jest.fn());

    expect(correct.execute).toHaveBeenCalledWith(10, 7, expect.objectContaining({ vakLabel: 'Auditory' }));
    expect(json(res)).toMatchObject(auditFields);
  });

  it.each(['getById', 'getByQuestionnaire'] as const)('%s returns the correction to a teacher', async (handler) => {
    const { controller } = makeController();
    const res = makeRes();
    const req = { params: { id: '10', questionnaireId: '20' }, query: {}, user: teacher } as unknown as Request;

    await controller[handler](req, res, jest.fn());

    expect(json(res)).toMatchObject(auditFields);
  });

  it.each(['listAll', 'getByStudent'] as const)('%s returns the correction in teacher lists', async (handler) => {
    const { controller } = makeController();
    const res = makeRes();
    const req = { params: { studentId: '30' }, query: {}, user: teacher } as unknown as Request;

    await controller[handler](req, res, jest.fn());

    expect(json(res).items[0]).toMatchObject(auditFields);
  });

  it.each(['getById', 'getByQuestionnaire', 'listMine'] as const)('%s hides the correction audit from a student', async (handler) => {
    const { controller } = makeController();
    const res = makeRes();
    const req = { params: { id: '10', questionnaireId: '20' }, query: {}, user: student } as unknown as Request;

    await controller[handler](req, res, jest.fn());

    const body = json(res);
    const item = handler === 'listMine' ? body.items[0] : body;
    expect(item.id).toBe(10);
    expect(item).not.toHaveProperty('correctedVakLabel');
    expect(item).not.toHaveProperty('correctedAt');
    expect(item).not.toHaveProperty('correctedBy');
  });

  it('listAll forwards labelStatus', async () => {
    const { controller, list } = makeController();
    const req = { params: {}, query: { labelStatus: 'uncorrected' }, user: teacher } as unknown as Request;

    await controller.listAll(req, makeRes(), jest.fn());

    expect(list.execute.mock.calls[0][1].labelStatus).toBe('uncorrected');
  });

  it('listAll rejects an unknown labelStatus with 400', async () => {
    const { controller, list } = makeController();
    const res = makeRes();
    const req = { params: {}, query: { labelStatus: 'pending' }, user: teacher } as unknown as Request;

    await controller.listAll(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'labelStatus must be one of: corrected, uncorrected' });
    expect(list.execute).not.toHaveBeenCalled();
  });
});
