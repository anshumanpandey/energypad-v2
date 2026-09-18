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
var jest_json_schema_1 = require("jest-json-schema");
expect.extend(jest_json_schema_1.matchers);
var app_1 = require("../src/app");
var testhelp_1 = require("./testhelp");
var Schema_json_1 = __importDefault(require("../src/types/Schema.json"));
describe('/Utility ', function () {
    test('It should respond with success when adding a consuption to a utility', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, user2, consumptions, first, second;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail198@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/addConsumption')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send([
                            {
                                date: '2010-01-01',
                                consumption: 134.48,
                                totalCost: 100,
                                vat: 2,
                                conversionFactor: 12.45,
                                fuelUnit: 'L',
                                siteId: 89,
                                fuelSourceId: 1,
                                usedInId: [3],
                            },
                            {
                                date: '2010-02-01',
                                consumption: 34.64,
                                totalCost: 100,
                                vat: 2,
                                conversionFactor: 19.78,
                                fuelUnit: 'm3',
                                siteId: 89,
                                fuelSourceId: 1,
                                usedInId: [2],
                            },
                        ])];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.AddFuelSourceConsumption.content['application/json'].schema);
                    return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail198@mail.com')];
                case 3:
                    user2 = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/consumptions')
                            .set('Authorization', "Bearer ".concat(user2.jwt))];
                case 4:
                    consumptions = _a.sent();
                    expect(consumptions.body.length).toBe(2);
                    first = consumptions.body.find(function (i) { return i.date === '2010-01-01'; });
                    expect(first.consumption).toBe(1674.28);
                    second = consumptions.body.find(function (i) { return i.date === '2010-02-01'; });
                    expect(second.consumption).toBe(685.18);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when importing utilities from file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail212@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/utility').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            name: 'Gas',
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtility')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .field('fuelSource', '1')
                            .attach('excel', 'test/fixtures/utility_sample_good.xlsx')];
                case 3:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.UtilityFileImport.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when importing logs from file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail212@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importLogs')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/fixtures/log_sample_good.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.UtilityFileImport.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when importing patterns from file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail230@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/importPatterns')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/fixtures/Sites Profile.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.FileImportBusinessPatterns.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when importing tenants from file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail228@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/importTenants')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/fixtures/business_tenant.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.FileImportBusiness.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with saving tips succesfully', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.registerUser)(app_1.app)()];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/utility/savingTips').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.body.length).toBeGreaterThan(0);
                    expect(response.body[0].id).toBe(1);
                    expect(typeof response.body[0].category).toBe('string');
                    expect(typeof response.body[0].text).toBe('string');
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success when saving energy emission', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail224@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/addEmission')
                            .send([
                            {
                                emissionFactor: 15,
                                conversionFactor: 34,
                                fuelUnit: 'm3',
                                date: '2001-01-01',
                                siteId: 452,
                                fuelSourceId: 1,
                                usedInId: [2],
                            },
                            {
                                emissionFactor: 8,
                                conversionFactor: 22,
                                fuelUnit: 'm3',
                                date: '2001-01-01',
                                siteId: 452,
                                fuelSourceId: 2,
                                usedInId: [2],
                            },
                        ])
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.AddFuelSourceEmission.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/addEmission')
                            .send([
                            {
                                emissionFactor: 18,
                                conversionFactor: 52,
                                fuelUnit: 'm3',
                                date: '2003-05-01',
                                siteId: 452,
                                fuelSourceId: 1,
                                usedInId: [2],
                            },
                            {
                                emissionFactor: 4,
                                conversionFactor: 37,
                                fuelUnit: 'm3',
                                date: '2002-07-01',
                                siteId: 452,
                                fuelSourceId: 2,
                                usedInId: [2],
                            },
                        ])
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success when saving energy monitoring', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail611@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/addMonitoring')
                            .send([
                            {
                                carbon: 12,
                                energy: 22,
                                conversionFactor: 34,
                                fuelUnit: 'm3',
                                date: '2001-01-01',
                                siteId: 602,
                                fuelSourceId: 1,
                                usedInId: [2],
                            },
                            {
                                carbon: 8,
                                energy: 18,
                                conversionFactor: 22,
                                fuelUnit: 'L',
                                date: '2001-01-01',
                                siteId: 602,
                                fuelSourceId: 2,
                                usedInId: [2, 3],
                            },
                        ])
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.AddFuelSourceMonitoring.content['application/json'].schema);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/addMonitoring')
                            .send([
                            {
                                carbon: 18,
                                energy: 28,
                                conversionFactor: 52,
                                fuelUnit: 'm3',
                                date: '2003-05-01',
                                siteId: 602,
                                fuelSourceId: 1,
                                usedInId: [2],
                            },
                            {
                                carbon: 4,
                                energy: 44,
                                conversionFactor: 37,
                                fuelUnit: 'm3',
                                date: '2002-07-01',
                                siteId: 602,
                                fuelSourceId: 3,
                                usedInId: [2],
                            },
                        ])
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with fuel sources', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.registerUser)(app_1.app)()];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/utility/fuelSources').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(6);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with monitoring', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail611@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/monitoring?siteId=603&month=0&year=2020')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(2);
                    expect(response.body[0].carbon).toBe(22);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with business emissions', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail310@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/utility/emissions').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(2);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/emissions?siteId=640&year=2019')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body.length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with business consumption', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail310@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/utility/consumptions').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when importing utilities cost from file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail614@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .field('fileType', 'cost')
                            .attach('excel', 'test/fixtures/Consumption.xlsx')];
                case 2:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with error when site is not found on emissions and target', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail614@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/fixtures/Consumption_bad_1.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(400);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/fixtures/Consumption_bad_2.xlsx')];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(400);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when importing utilities cost then consumption from file', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, response, consumptions, one, two, monitoringReq, response2, consumptions2, three, four, five, emissionsReq, emission1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail614@mail.com')];
                case 1:
                    user = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(user.jwt))
                            .attach('excel', 'test/fixtures/Consumption.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/consumptions')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 3:
                    consumptions = _a.sent();
                    expect(consumptions.body.length).toBe(14);
                    one = consumptions.body.find(function (i) { return i.date === '2023-01-01' && i.siteId === 604 && i.fuelSourceId === 2; });
                    expect(one.consumption).toBe(200);
                    expect(one.vat).toBe(49.48);
                    expect(one.totalCost).toBe(400);
                    two = consumptions.body.find(function (i) { return i.date === '2023-02-01' && i.siteId === 604 && i.fuelSourceId === 1; });
                    expect(two.consumption).toBe(120);
                    expect(two.vat).toBe(37.11);
                    expect(two.totalCost).toBe(300);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/monitoring')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 4:
                    monitoringReq = _a.sent();
                    expect(monitoringReq.body.length).toBe(1);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(user.jwt))
                            .attach('excel', 'test/fixtures/Consumption.xlsx')];
                case 5:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/consumptions')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 6:
                    consumptions2 = _a.sent();
                    expect(consumptions2.body.length).toBe(14);
                    three = consumptions2.body.find(function (i) { return i.date === '2023-01-01' && i.siteId === 604 && i.fuelSourceId === 2; });
                    expect(three.consumption).toBe(200);
                    expect(three.vat).toBe(49.48);
                    expect(three.totalCost).toBe(400);
                    four = consumptions2.body.find(function (i) { return i.date === '2023-02-01' && i.siteId === 604 && i.fuelSourceId === 1; });
                    expect(four.consumption).toBe(120);
                    expect(four.vat).toBe(37.11);
                    expect(four.totalCost).toBe(300);
                    five = consumptions2.body.find(function (i) { return i.date === '2023-03-01' && i.siteId === 604 && i.fuelSourceId === 4; });
                    expect(five.consumption).toBe(6815.24);
                    expect(five.vat).toBe(49.48);
                    expect(five.totalCost).toBe(400);
                    expect(five.conversionFactor).toBe(25.88);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/emissions?siteId=604&year=2023')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 7:
                    emissionsReq = _a.sent();
                    expect(emissionsReq.body.length).toBe(2);
                    emission1 = emissionsReq.body.find(function (e) { return e.siteId === 604 && e.fuelSourceId === 2 && e.date === '2023-02-01'; });
                    expect(emission1.conversionFactor).toBe(127.04);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should not update the emissions conversionFactor when a consumption is not provided for that date', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, response, consumptions, emissionsReq, emission1, emission2, response2, emissionsReq2, emission3, emission4, emission5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail616@mail.com')];
                case 1:
                    user = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(user.jwt))
                            .attach('excel', 'test/fixtures/Consumption-2case-1.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/consumptions')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 3:
                    consumptions = _a.sent();
                    expect(consumptions.body.length).toBe(2);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/emissions?siteId=608&year=2023')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 4:
                    emissionsReq = _a.sent();
                    expect(emissionsReq.body.length).toBe(2);
                    emission1 = emissionsReq.body.find(function (e) { return e.siteId === 608 && e.fuelSourceId === 4 && e.date === '2023-01-01'; });
                    expect(emission1.conversionFactor).toBe(250);
                    emission2 = emissionsReq.body.find(function (e) { return e.siteId === 608 && e.fuelSourceId === 1 && e.date === '2023-02-01'; });
                    expect(emission2.conversionFactor).toBe(300);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(user.jwt))
                            .attach('excel', 'test/fixtures/Consumption-2case-2.xlsx')];
                case 5:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/utility/emissions?siteId=608&year=2023')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 6:
                    emissionsReq2 = _a.sent();
                    expect(emissionsReq2.body.length).toBe(4);
                    emission3 = emissionsReq2.body.find(function (e) { return e.siteId === 608 && e.fuelSourceId === 4 && e.date === '2023-01-01'; });
                    expect(emission3.conversionFactor).toBe(250);
                    emission4 = emissionsReq2.body.find(function (e) { return e.siteId === 608 && e.fuelSourceId === 4 && e.date === '2023-02-01'; });
                    expect(emission4.conversionFactor).toBe(87.18);
                    emission5 = emissionsReq2.body.find(function (e) { return e.siteId === 608 && e.fuelSourceId === 1 && e.date === '2023-03-01'; });
                    expect(emission5.conversionFactor).toBe(374.48);
                    return [2 /*return*/];
            }
        });
    }); });
    test.only('It should respond with sucess when passing another month name and when there is no emissions or targets', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail618@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/fixtures/Consumption_3.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbGl0eS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXRpbGl0eS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0RBQWtDO0FBQ2xDLHFEQUE0QztBQUM1QyxNQUFNLENBQUMsTUFBTSxDQUFDLDJCQUFRLENBQUMsQ0FBQztBQUN4QixrQ0FBaUM7QUFDakMsdUNBQTJEO0FBQzNELHlFQUE4QztBQUU5QyxRQUFRLENBQUMsV0FBVyxFQUFFO0lBQ3BCLElBQUksQ0FBQyxzRUFBc0UsRUFBRTs7Ozt3QkFDOUQscUJBQU0sSUFBQSxvQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLEVBQUE7O29CQUEvQyxJQUFJLEdBQUcsU0FBd0M7b0JBRXBDLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ2xDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQzs2QkFDbkMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLElBQUksQ0FBQzs0QkFDSjtnQ0FDRSxJQUFJLEVBQUUsWUFBWTtnQ0FDbEIsV0FBVyxFQUFFLE1BQU07Z0NBQ25CLFNBQVMsRUFBRSxHQUFHO2dDQUNkLEdBQUcsRUFBRSxDQUFDO2dDQUNOLGdCQUFnQixFQUFFLEtBQUs7Z0NBQ3ZCLFFBQVEsRUFBRSxHQUFHO2dDQUNiLE1BQU0sRUFBRSxFQUFFO2dDQUNWLFlBQVksRUFBRSxDQUFDO2dDQUNmLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQzs2QkFDZDs0QkFDRDtnQ0FDRSxJQUFJLEVBQUUsWUFBWTtnQ0FDbEIsV0FBVyxFQUFFLEtBQUs7Z0NBQ2xCLFNBQVMsRUFBRSxHQUFHO2dDQUNkLEdBQUcsRUFBRSxDQUFDO2dDQUNOLGdCQUFnQixFQUFFLEtBQUs7Z0NBQ3ZCLFFBQVEsRUFBRSxJQUFJO2dDQUNkLE1B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