/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'apps/**/*.ts',
    '!apps/hcm-mock-server/**/*.ts',
    '!apps/**/main.ts',
    '!apps/**/dist/**',
    '!apps/**/node_modules/**',
    '!apps/**/test/**',
    '!apps/**/src/**/dto/**',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 90,
      lines: 90,
    },
  },
};

