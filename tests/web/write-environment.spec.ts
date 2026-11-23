import { describe, expect, it } from 'vitest';
import { buildEnvironmentSource } from '../../scripts/write-environment.mjs';

const outputs = {
  ChineseWordsStatefulStack: { UserPoolId: 'us-east-1_abc', UserPoolClientId: 'client123' },
  ChineseWordsApiStack: { ApiUrl: 'https://api.example.com' },
};

describe('write-environment', () => {
  it('builds the environment from CDK outputs across stacks', () => {
    const src = buildEnvironmentSource(outputs, 'us-east-1');
    expect(src).toContain('"apiUrl": "https://api.example.com"');
    expect(src).toContain('"userPoolId": "us-east-1_abc"');
    expect(src).toContain('"userPoolClientId": "client123"');
    expect(src).toContain('"region": "us-east-1"');
  });

  it('fails when an output is missing', () => {
    expect(() => buildEnvironmentSource({ A: {} }, 'us-east-1')).toThrow(/ApiUrl/);
  });
});
