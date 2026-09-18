"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var supertest_1 = __importDefault(require("supertest"));
var app_1 = require("../src/app");
var testhelp_1 = require("./testhelp");
expect.extend(testhelp_1.matcher);
describe('/Dashboard ', function () {
    test('It should respond with success message when create an utility', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2, response3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail322@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard?year=2020&fuelSourceId=1&siteId=484')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.consumptions.length).toBe(1);
                    expect(response.body.energyTargets.length).toBe(3);
                    expect(response.body.consumptions[0].find(function (c) { return c.date === '2020-01-01'; }).consumption).toBe(200);
                    expect(response.body.consumptions[0].find(function (c) { return c.date === '2020-02-01'; }).consumption).toBe(89);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard?year=2022&fuelSourceId=1')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.body.consumptions.flat().length).toBe(2);
                    expect(response2.body.consumptionsDetails.length).toBe(3);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard?year=2022&fuelSourceId=6')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 4:
                    response3 = _a.sent();
                    expect(response3.body.consumptions.flat().length).toBe(0);
                    expect(response3.body.energyTargets.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); }, 15 * 1000);
    test('It should respond with success message no fuelSourceId and no siteId is pass', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, gridElectricityFor484, jan, feb;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail322@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/dashboard?year=2020').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.consumptions.length).toBe(4);
                    expect(response.body.consumptions.find(function (c) {
                        return c.find(function (i) { return i.date === '2020-01-01' && i.fuelSourceId === 1 && i.siteId === 484; }) !== undefined;
                    }).length).toBe(3);
                    expect(response.body.consumptions.find(function (c) {
                        return c.find(function (i) { return i.date === '2020-01-01' && i.fuelSourceId === 2 && i.siteId === 484; }) !== undefined;
                    }).length).toBe(1);
                    expect(response.body.consumptions.find(function (c) { return c.find(function (i) { return i.fuelSourceId === 1 && i.siteId === 486; }) !== undefined; }).length).toBe(1);
                    expect(response.body.consumptions.find(function (c) { return c.find(function (i) { return i.fuelSourceId === 2 && i.siteId === 486; }) !== undefined; }).length).toBe(1);
                    gridElectricityFor484 = response.body.consumptions
                        .flat()
                        .filter(function (i) { return i.fuelSourceId === 1 && i.siteId === 484; });
                    jan = gridElectricityFor484.find(function (r) { return r.date === '2020-01-01'; });
                    feb = gridElectricityFor484.find(function (r) { return r.date === '2020-02-01'; });
                    expect(jan).toBeDefined();
                    expect(feb).toBeDefined();
                    expect(feb.increasedConsumptionPercentage).not.toBe(0);
                    expect(response.body.energyTargets.length).toBe(3);
                    expect(response.body.energyTargets.flat().every(function (r) { return r.date.endsWith('-01'); })).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); }, 15 * 1000);
    test('It should respond with success message no fuelSourceId and no siteId is pass', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail700@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/dashboard?year=2023').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.consumptions.length).toBe(3);
                    expect(response.body.consumptions.flat().every(function (r) { return r.date.startsWith('2023'); })).toBe(true);
                    return [2 /*return*/];
            }
        });
    }); }, 15 * 1000);
    test('It should respond with correct carbonFootprint data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail322@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/carbonFootprint?year=2020&fuelSourceId=2&siteId=486')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.carbonEmissions.length).toBe(1);
                    expect(response.body.allCarbonEmissions.length).toBe(1);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/carbonFootprint?year=2020')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body.carbonEmissions.length).toBe(1);
                    expect(response2.body.carbonEmissions[0].length).toBe(2);
                    expect(response2.body.allCarbonEmissions.length).toBe(1);
                    expect(response2.body.allCarbonEmissions[0].length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); }, 15 * 1000);
    test('It should respond with correct energyWasteData data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2, response3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail723@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/energyWaste?year=2002')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.waste.length).toBe(3);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/energyWaste?year=2006')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body.waste.length).toBe(3);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/energyWaste?year=2010')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 4:
                    response3 = _a.sent();
                    expect(response3.statusCode).toBe(200);
                    expect(response3.body.waste.length).toBe(3);
                    return [2 /*return*/];
            }
        });
    }); }, 20 * 1000);
    test.only('It should respond with correct report data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail723@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/getReport?year=2002')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.reports.length).toBe(3);
                    return [2 /*return*/];
            }
        });
    }); }, 20 * 1000);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGFzaGJvYXJkLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXNoYm9hcmQudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHdEQUFrQztBQUNsQyxrQ0FBaUM7QUFDakMsdUNBQXNEO0FBRXRELE1BQU0sQ0FBQyxNQUFNLENBQUMsa0JBQU8sQ0FBQyxDQUFDO0FBRXZCLFFBQVEsQ0FBQyxhQUFhLEVBQUU7SUFDdEIsSUFBSSxDQUNGLCtEQUErRCxFQUMvRDs7Ozt3QkFDZSxxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBQTs7b0JBQS9DLElBQUksR0FBRyxTQUF3QztvQkFDcEMscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDbEMsR0FBRyxDQUFDLG9EQUFvRCxDQUFDOzZCQUN6RCxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQyxFQUFBOztvQkFGdkMsUUFBUSxHQUFHLFNBRTRCO29CQUU3QyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDbEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFFbkQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFDLENBQU8sSUFBSyxPQUFBLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUF2QixDQUF1QixD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