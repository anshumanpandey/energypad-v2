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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVzdC51bml0LmNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImplc3QudW5pdC5jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsZ0VBQWdFO0FBQ3hELElBQUEsdUJBQXVCLEdBQUssT0FBTyxDQUFDLGVBQWUsQ0FBQyx3QkFBN0IsQ0FBOEI7QUFDN0QsSUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDNUMsSUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7QUFFN0MsTUFBTSxDQUFDLE9BQU8sR0FBRztJQUNmLE1BQU0sRUFBRSxTQUFTO0lBQ2pCLFNBQVMsRUFBRTtRQUNULHVDQUF1QyxFQUFFLFNBQVM7S0FDbkQ7SUFDRCx1QkFBdUIsRUFBRSxDQUFDLCtCQUErQixDQUFDO0lBQzFELHdCQUF3QixFQUFFLENBQUMsaUJBQWlCLEVBQUUsdUJBQXVCLENBQUM7SUFDdEUsZUFBZSxFQUFFLE1BQU07SUFDdkIsZ0JBQWdCLEVBQUUsdUJBQXVCLENBQUMsS0FBSyxFQUFFLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxDQUFDO0NBQzNFLENBQUMifQ==