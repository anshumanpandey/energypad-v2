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
var Schema_json_1 = __importDefault(require("../src/types/Schema.json"));
var ulid_1 = require("ulid");
expect.extend(testhelp_1.matcher);
describe('/Site ', function () {
    test('It should respond with success message when create a site', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail238@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/site').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            name: 'a site 1',
                            type: 'in amet enim',
                            code: (0, ulid_1.ulid)(),
                            address: 'irure aliquip cillum esse magna',
                            postCode: 'dolor enim',
                            town: 'somwehre',
                            population: 17391920,
                            size: 45786843,
                            workinghours: 10,
                            vat: 18.66,
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.Site.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when creating 2 sites with same code', function () { return __awaiter(void 0, void 0, void 0, function () {
        var user, code, response, user2, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail620@mail.com')];
                case 1:
                    user = _a.sent();
                    code = (0, ulid_1.ulid)();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/site').set('Authorization', "Bearer ".concat(user.jwt)).send({
                            name: 'a site 2',
                            type: 'in amet enim',
                            code: code,
                            address: 'irure aliquip cillum esse magna',
                            postCode: 'dolor enim',
                            town: 'somwehre',
                            population: 17391920,
                            size: 45786843,
                            workinghours: 10,
                            vat: 18.66,
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.Site.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail622@mail.com')];
                case 3:
                    user2 = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/site').set('Authorization', "Bearer ".concat(user2.jwt)).send({
                            name: 'a site 3',
                            type: 'in amet enim',
                            code: code,
                            address: 'irure aliquip cillum esse magna',
                            postCode: 'dolor enim',
                            town: 'somwehre',
                            population: 17391920,
                            size: 45786843,
                            workinghours: 10,
                            vat: 18.66,
                        })];
                case 4:
                    response2 = _a.sent();
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.Site.content['application/json'].schema);
                    expect(response2.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when updating a site', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, siteBody, response, details, siteBody2, response2, details2, s;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail316@mail.com')];
                case 1:
                    body = _a.sent();
                    siteBody = {
                        id: 478,
                        name: 'cccc',
                        type: 'some_new',
                        code: (0, ulid_1.ulid)(),
                        address: 'anywhere_new',
                        postCode: '484 sd8_new',
                        town: 'some town_new',
                        population: 44444444,
                        size: 8798,
                        workinghours: 88,
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .put('/api/site/update/478')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(siteBody)];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SiteUpdate.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/sites').set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    details = _a.sent();
                    expect(details.body[1].type).toBe(siteBody.type);
                    expect(details.body[1].address).toBe(siteBody.address);
                    expect(details.body[1].postCode).toBe(siteBody.postCode);
                    expect(details.body[1].town).toBe(siteBody.town);
                    expect(details.body[1].population).toBe(siteBody.population);
                    expect(details.body[1].size).toBe(siteBody.size);
                    expect(details.body[1].workinghours).toBe(siteBody.workinghours);
                    expect(details.body[1].code).toBe(siteBody.code);
                    siteBody2 = {
                        id: 479,
                        name: 'ttttt',
                        type: 'iuiuiu',
                        address: 'yuyucxwh',
                        postCode: 'cccccccc',
                        town: 'axqqeqweq',
                        population: 44444444,
                        size: 8798,
                        workinghours: 99,
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .put('/api/site/update/479')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(siteBody2)];
                case 4:
                    response2 = _a.sent();
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.SiteUpdate.content['application/json'].schema);
                    expect(response2.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/sites').set('Authorization', "Bearer ".concat(body.jwt))];
                case 5:
                    details2 = _a.sent();
                    s = details2.body.find(function (i) { return i.name === 'ttttt'; });
                    expect(s.type).toBe(siteBody2.type);
                    expect(s.address).toBe(siteBody2.address);
                    expect(s.postCode).toBe(siteBody2.postCode);
                    expect(s.town).toBe(siteBody2.town);
                    expect(s.population).toBe(siteBody2.population);
                    expect(s.size).toBe(siteBody2.size);
                    expect(s.workinghours).toBe(siteBody2.workinghours);
                    expect(s.code).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with fail message when create a site when passing wrong data', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2, response3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail238@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/site').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            name: 'aaaaa',
                            type: 'in amet enim',
                            code: 'in amet enim',
                            address: 'irure aliquip cillum esse magna',
                            postCode: 'dolor enim',
                            town: 35779417.474086836,
                            population: 'some',
                            size: 45786843.40282458,
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    expect(response.body.message).toBe('town: should be string');
                    expect(response.statusCode).toBe(400);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/site').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            type: 'in amet enim',
                            address: 'irure aliquip cillum esse magna',
                            code: (0, ulid_1.ulid)(),
                            postCode: 'dolor enim',
                            town: 'a town',
                            population: 'some',
                            size: 45786843.40282458,
                            fuel: 'sed sint incididunt',
                            uses: 'anim consectetur eu',
                            another: 1,
                        })];
                case 3:
                    response2 = _a.sent();
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    expect(response2.body.message).toBe(testhelp_1.NO_EXTRA_PROPERTY_ERROR_MESSAGE);
                    expect(response2.statusCode).toBe(400);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/site').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            name: 'bbbb',
                            type: 'some_new',
                            code: (0, ulid_1.ulid)(),
                            address: 'anywhere_new',
                            postCode: '484 sd8_new',
                            town: 'some town_new',
                            population: 222222,
                            size: 8888,
                            workinghours: 'a',
                        })];
                case 4:
                    response3 = _a.sent();
                    expect(response3.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    expect(response3.body.message).toBe('workinghours: should be number');
                    expect(response3.statusCode).toBe(400);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success when setting the conversion unit for a site', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail400@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/site/setConversionUnit/490')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send([
                            { unitType: 'L', unitValue: 58.52 },
                            { unitType: 'm3', unitValue: 789.12 },
                        ])];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SetSiteConversionUnit.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success when deleting site', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail312@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).delete('/api/site').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            id: 474,
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.DeleteSite.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with error when site does not exist on db', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail312@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).delete('/api/site').set('Authorization', "Bearer ".concat(body.jwt)).send({
                            id: 999,
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(400);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success when getting sites details', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail312@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/site/details/476').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.GetSiteDetails.content['application/json'].schema);
                    expect(response.body.energies[0].usedInId.length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should filter sites by fuel source', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail312@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/sites?fsi=1').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l0ZXMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNpdGVzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBa0M7QUFDbEMsa0NBQWlDO0FBQ2pDLHVDQUFpRjtBQUNqRix5RUFBOEM7QUFDOUMsNkJBQTRCO0FBRTVCLE1BQU0sQ0FBQyxNQUFNLENBQUMsa0JBQU8sQ0FBQyxDQUFDO0FBRXZCLFFBQVEsQ0FBQyxRQUFRLEVBQUU7SUFDakIsSUFBSSxDQUFDLDJEQUEyRCxFQUFFOzs7O3dCQUNuRCxxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBQTs7b0JBQS9DLElBQUksR0FBRyxTQUF3QztvQkFDcEMscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDdEcsSUFBSSxFQUFFLFVBQVU7NEJBQ2hCLElBQUksRUFBRSxjQUFjOzRCQUNwQixJQUFJLEVBQUUsSUFBQSxXQUFJLEdBQUU7NEJBQ1osT0FBTyxFQUFFLGlDQUFpQzs0QkFDMUMsUUFBUSxFQUFFLFlBQVk7NEJBQ3RCLElBQUksRUFBRSxVQUFVOzRCQUNoQixVQUFVLEVBQUUsUUFBUTs0QkFDcEIsSUFBSSxFQUFFLFFBQVE7NEJBQ2QsWUFBWSxFQUFFLEVBQUU7NEJBQ2hCLEdBQUcsRUFBRSxLQUFLO3lCQUNYLENBQUMsRUFBQTs7b0JBWEksUUFBUSxHQUFHLFNBV2Y7b0JBQ0YsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMscUJBQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsa0JB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