"use strict";
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
var pathsToModuleNameMapper = require('ts-jest/utils').pathsToModuleNameMapper;
var tsconfig = require('./tsconfig.json');
var paths = tsconfig.compilerOptions.paths;
module.exports = {
    preset: 'ts-jest',
    transform: {
        'node_modules/variables/.+\\.(j|t)sx?$': 'ts-jest',
    },
    transformIgnorePatterns: ['node_modules/(?!variables/.*)'],
    modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/Energiepad/'],
    testEnvironment: 'node',
    moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVzdC51bml0LmNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImplc3QudW5pdC5jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLGdFQUFnRTtBQUN4RCxJQUFBLHVCQUF1QixHQUFLLE9BQU8sQ0FBQyxlQUFlLENBQUMsd0JBQTdCLENBQThCO0FBQzdELElBQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzVDLElBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDO0FBRTdDLE1BQU0sQ0FBQyxPQUFPLEdBQUc7SUFDZixNQUFNLEVBQUUsU0FBUztJQUNqQixTQUFTLEVBQUU7UUFDVCx1Q0FBdUMsRUFBRSxTQUFTO0tBQ25EO0lBQ0QsdUJBQXVCLEVBQUUsQ0FBQywrQkFBK0IsQ0FBQztJQUMxRCx3QkFBd0IsRUFBRSxDQUFDLGlCQUFpQixFQUFFLHVCQUF1QixDQUFDO0lBQ3RFLGVBQWUsRUFBRSxNQUFNO0lBQ3ZCLGdCQUFnQixFQUFFLHVCQUF1QixDQUFDLEtBQUssRUFBRSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsQ0FBQztDQUMzRSxDQUFDIn0=