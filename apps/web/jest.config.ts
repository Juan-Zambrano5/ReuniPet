import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@reunipet/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  testMatch: ['**/__tests__/**/*.@(ts|tsx)', '**/*.test.@(ts|tsx)'],
  passWithNoTests: true,
};

export default createJestConfig(config);
