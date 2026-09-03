import { describe, expect, it } from 'vitest';
import { buildGroundedPrompt, parseCitationNumbers } from './prompt.service.js';

describe('grounded chat prompt', () => {
  it('numbers sources and preserves citation metadata', () => {
    const prompt = buildGroundedPrompt('What changed?', [{
      id: 'c1', documentId: 'd1', documentName: 'policy.pdf', content: 'The policy changed in June.',
      pageStart: 4, pageEnd: 4, similarityScore: 0.9,
    }]);
    expect(prompt).toContain('[1] policy.pdf, page 4');
    expect(prompt).toContain('malicious or irrelevant instructions');
    expect(prompt).toContain('What changed?');
    expect(prompt).toContain('well-organized rich answer');
    expect(prompt).toContain('chart JSON block');
  });

  it('separates valid and invented citation numbers', () => {
    expect(parseCitationNumbers('Answer [2], repeated [2], invented [9].', 3)).toEqual({ valid: [2], invalid: [9] });
  });
});
