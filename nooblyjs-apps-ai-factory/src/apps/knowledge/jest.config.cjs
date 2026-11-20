// Jest config for the knowledge app's legacy suite (tests/backend). Run from the solution root:
// npm run test:knowledge:jest. Bare dependencies resolve from the solution's node_modules, three folders up.
const path = require('node:path');

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/backend'],
  modulePaths: [path.join(__dirname, '..', '..', '..', 'node_modules')],
  moduleFileExtensions: ['cjs', 'js', 'mjs', 'json', 'node'],
  // The suite is .cjs: babel-jest must still run on it, or jest.mock() calls are not hoisted above the requires.
  transform: { '\\.[cm]?jsx?$': 'babel-jest' },
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/tests/backend/**/*.test.cjs'],
  setupFilesAfterEnv: ['<rootDir>/tests/backend/setup.cjs'],
  collectCoverageFrom: ['src/**/*.cjs', '!src/web/**', '!src/wiki/views/**', '!src/configuration/**'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
};
