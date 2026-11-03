import { ApproveQuestionDto } from '../../../../../src/domain/dtos/question/approve-question.dto.js';

describe('ApproveQuestionDto.create (HU-42)', () => {
  it.each(['Visual', 'Auditory', 'Kinesthetic'])('accepts vakStyle %s', (vakStyle) => {
    const [err, dto] = ApproveQuestionDto.create({ vakStyle });
    expect(err).toBeUndefined();
    expect(dto!.vakStyle).toBe(vakStyle);
  });

  it.each([undefined, null, {}])('keeps the current style when the body is %p', (body) => {
    const [err, dto] = ApproveQuestionDto.create(body as never);
    expect(err).toBeUndefined();
    expect(dto!.vakStyle).toBeNull();
  });

  it('treats an explicit null vakStyle as absent', () => {
    const [err, dto] = ApproveQuestionDto.create({ vakStyle: null });
    expect(err).toBeUndefined();
    expect(dto!.vakStyle).toBeNull();
  });

  it.each(['Tactile', 'visual', '', 3])('rejects vakStyle %p', (vakStyle) => {
    const [err, dto] = ApproveQuestionDto.create({ vakStyle });
    expect(err).toBe('Invalid Vak Style. Allowed: Visual, Auditory, Kinesthetic');
    expect(dto).toBeUndefined();
  });
});
