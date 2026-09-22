import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.@(ts|tsx)', '**/*.test.@(ts|tsx)'],
  passWithNoTests: true,
};

export default createJestConfig(config);
