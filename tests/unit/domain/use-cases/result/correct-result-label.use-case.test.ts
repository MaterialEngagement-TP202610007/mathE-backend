import { CorrectResultLabelUseCase } from '../../../../../src/domain/use-cases/result/correct-result-label.use-case.js';
import { CorrectResultLabelDto } from '../../../../../src/domain/dtos/result/correct-result-label.dto.js';
import { ResultRepository } from '../../../../../src/domain/repositories/result.repository.js';
import { ResultEntity } from '../../../../../src/domain/entities/result.entity.js';

const NOW = new Date('2026-10-10T12:00:00.000Z');

function makeUseCase(existing: ResultEntity | null) {
  const corrected = ResultEntity.fromObject({
    id: 10, questionnaireId: 20, studentId: 30,
    correctedVakLabel: 'Auditory', correctedAt: NOW, correctingTeacher: { id: 7, name: 'Profe Ana' },
  });
  const repo = {
    findById: jest.fn().mockResolvedValue(existing),
    correctLabel: jest.fn().mockResolvedValue(corrected),
  } as unknown as jest.Mocked<ResultRepository>;
  return { repo, corrected, useCase: new CorrectResultLabelUseCase(repo, () => NOW) };
}

describe('CorrectResultLabelUseCase (HU-44)', () => {
  it('records the label with the correcting user and the clock time', async () => {
    const { repo, corrected, useCase } = makeUseCase(ResultEntity.fromObject({ id: 10, questionnaireId: 20, studentId: 30 }));
    const [, dto] = CorrectResultLabelDto.create({ vakLabel: 'Auditory' });

    const result = await useCase.execute(10, 7, dto!);

    expect(repo.correctLabel).toHaveBeenCalledWith({
      resultId: 10,
      teacherId: 7,
      vakLabel: 'Auditory',
      correctedAt: NOW,
    });
    expect(result).toBe(corrected);
  });

  it('returns 404 for an unknown result', async () => {
    const { repo, useCase } = makeUseCase(null);
    const [, dto] = CorrectResultLabelDto.create({ vakLabel: 'Visual' });

    await expect(useCase.execute(99, 7, dto!)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.correctLabel).not.toHaveBeenCalled();
  });
});
