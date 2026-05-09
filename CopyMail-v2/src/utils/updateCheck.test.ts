import { describe, it, expect } from 'vitest';
import { compareSemver } from './updateCheck';

describe('compareSemver', () => {
  it('orders major', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
  it('orders minor', () => {
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
  });
  it('orders patch', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
  });
  it('handles equal', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
  });
  it('handles short', () => {
    expect(compareSemver('1.2', '1.2.0')).toBe(0);
  });
});
