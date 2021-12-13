/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
const { pathsToModuleNameMapper } = require('ts-jest/utils');
const tsconfig = require('./tsconfig.json')
const paths = tsconfig.compilerOptions.paths

module.exports = {
  preset: 'ts-jest',
  transform: {
    "node_modules/variables/.+\\.(j|t)sx?$": "ts-jest"
  },
  transformIgnorePatterns: [
    "node_modules/(?!variables/.*)"
  ],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  globalSetup: "<rootDir>/jest.setup.ts",
};