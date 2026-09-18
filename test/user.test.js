"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
expect.extend(testhelp_1.matcher);
describe('/Business ', function () {
    test('It should respond with success message when updating an user', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response, login;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.registerUser)(app_1.app)()];
                case 1:
                    body = _a.sent();
                    newData = {
                        businessName: 'new_businessName',
                        businessType: 'new_businessType',
                        businessService: 'new_businessService',
                        password: 'new_password',
                        buildingName: 'new_buildingName',
                        contactName: 'new_contactName',
                        position: 'new_position',
                        phoneNumber: 'new_phoneNumber',
                        email: 'new_email@mail.com',
                        countryId: 5,
                        stateId: 46,
                        town: 'new_town',
                        postCode: 'new_postCode',
                        address_1: 'new_address_1',
                        subscriptionDate: '2021-01-01',
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).put('/api/business').set('Authorization', "Bearer ".concat(body.jwt)).send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.UpdateUser.content['application/json'].schema);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({
                            email: newData.email,
                            password: newData.password,
                        })];
                case 3:
                    login = _a.sent();
                    expect(login.body).toMatchSchema(Schema_json_1.default.components.responses.Login.content['application/json'].schema);
                    expect(login.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when updating an user without optional values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.registerUser)(app_1.app)()];
                case 1:
                    body = _a.sent();
                    newData = {
                        businessName: 'new_businessName2',
                        businessType: 'new_businessType',
                        businessService: 'new_businessService',
                        password: 'new_password',
                        buildingName: 'new_buildingName',
                        contactName: 'new_contactName',
                        position: 'new_position',
                        phoneNumber: 'new_phoneNumber',
                        email: 'new_email',
                        countryId: 5,
                        stateId: 46,
                        address_1: 'address_1',
                        town: 'new_town',
                        postCode: 'new_postCode',
                        subscriptionDate: '2021-01-01',
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).put('/api/business').set('Authorization', "Bearer ".concat(body.jwt)).send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.UpdateUser.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when saving energy', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response, newData2, response2, meData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail482@mail.com')];
                case 1:
                    body = _a.sent();
                    newData = {
                        siteId: 101,
                        records: [
                            {
                                fuelSourceId: 1,
                                usedInId: [2, 3, 4],
                                brands: [
                                    {
                                        name: 'All Time',
                                        startTime: '00:00:00',
                                        endTime: '00:20:00',
                                        days: ['Mon', 'Tue'],
                                        rate: 200,
                                    },
                                    {
                                        name: 'Rate 1',
                                        startTime: '00:00:00',
                                        endTime: '00:12:00',
                                        days: ['Mon', 'Tue'],
                                        rate: 300,
                                    },
                                ],
                                meternumbers: [
                                    {
                                        meters: '54984315135',
                                    },
                                    {
                                        meters: '445ads654sd',
                                    },
                                ],
                                cost: {
                                    currencyCode: 'GBP',
                                    vat: 200,
                                },
                            },
                        ],
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/saveEnergy')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SaveBusinessEnergy.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    newData2 = newData;
                    newData2.records[0].brands[0].days.push('Wed');
                    newData2.records[0].usedInId.pop();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/saveEnergy')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData2)];
                case 3:
                    response2 = _a.sent();
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.UpdateUser.content['application/json'].schema);
                    expect(response2.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/energies').set('Authorization', "Bearer ".concat(body.jwt))];
                case 4:
                    meData = _a.sent();
                    expect(meData.statusCode).toBe(200);
                    expect(meData.body.length).toBe(1);
                    expect(meData.body[0].brands.length).toBe(2);
                    expect(meData.body[0].meternumbers.length).toBe(2);
                    expect(meData.body[0].brands[0].days.length).toBe(2);
                    expect(meData.body[0].brands[0].name).toBe('Rate 1');
                    expect(meData.body[0].brands[1].days.length).toBe(3);
                    expect(meData.body[0].brands[1].name).toBe('All Time');
                    expect(meData.body[0].usedInId.length).toBe(2);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when saving a log', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail226@mail.com')];
                case 1:
                    body = _a.sent();
                    newData = {
                        usedInId: 2,
                        siteId: 454,
                        operation: 'an opetation',
                        comments: 'some comments',
                        startDate: '2020-10-01',
                        endDate: '2020-10-08',
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/addLog')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.AddLog.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when saving tenants', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail226@mail.com')];
                case 1:
                    body = _a.sent();
                    newData = [
                        {
                            siteId: 454,
                            usedInId: 2,
                            date: '2021-08-01',
                            regularTenantAmount: 25,
                            irregularTenantAmount: 50,
                        },
                        { siteId: 454, usedInId: 3, date: '2021-08-09', regularTenantAmount: 25, irregularTenantAmount: 55 },
                    ];
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setTenants')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setTenants')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send([
                            __assign(__assign({}, newData[0]), { date: '2020-08-01' }),
                        ])];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when saving reviews', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail232@mail.com')];
                case 1:
                    body = _a.sent();
                    newData = [
                        {
                            siteId: 460,
                            question: 'How often?',
                            answers: ['montly', 'Quarterly', 'Bianually'],
                        },
                        {
                            siteId: 460,
                            question: 'How near?',
                            answers: ['montly', 'Quarterly', 'Bianually'],
                        },
                    ];
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setReviews')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setReviews')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send([
                            {
                                siteId: 460,
                                question: 'How near?',
                                answers: ['Montly', 'Quarterly', 'Bianually'],
                            },
                        ])];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when saving programmes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail234@mail.com')];
                case 1:
                    body = _a.sent();
                    newData = [
                        { question: 'How often?', answers: ['Montly', 'Yearly'], siteId: 464, usedInId: 2 },
                        { question: 'What type?', answers: ['Single', 'Triple'], siteId: 464, usedInId: 2 },
                    ];
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setProgrammes')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with correct sites for user', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, body2, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail236@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/sites').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(2);
                    expect(response.body.find(function (s) { return s.id === 466; })).toBeDefined();
                    expect(response.body.find(function (s) { return s.id === 468; })).toBeDefined();
                    return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail240@mail.com')];
                case 3:
                    body2 = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/sites').set('Authorization', "Bearer ".concat(body2.jwt))];
                case 4:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body.length).toBe(2);
                    expect(response2.body.find(function (s) { return s.id === 470; })).toBeDefined();
                    expect(response2.body.find(function (s) { return s.id === 472; })).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when saving floors', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, newData, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.registerUser)(app_1.app)()];
                case 1:
                    body = _a.sent();
                    newData = [
                        {
                            size: 'floor_1',
                            area: 200,
                            population: 100,
                        },
                        {
                            size: 'floor_2',
                            area: 300,
                            population: 200,
                        },
                    ];
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setFloors')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send(newData)];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/setFloors')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send([
                            {
                                size: 'floor_3',
                                area: 300,
                                population: 200,
                            },
                        ])];
                case 3:
                    response2 = _a.sent();
                    expect(response2.statusCode).toBe(200);
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.SetTenants.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with correct floors for user', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail242@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/foors').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(2);
                    expect(response.body[0].id).toBe(10);
                    expect(response.body[1].id).toBe(12);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should save patterns successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail434@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/savePattern')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .send([
                            {
                                startDate: '2020-08-01',
                                endDate: '2020-09-01',
                                temperature: 20,
                                daysOnYear: 20,
                                siteId: 353,
                                usedInId: 2,
                            },
                        ])];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should get user data successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.registerUser)(app_1.app)()];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business').set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should data from excel file successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, user, site;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                        .post('/api/business/importBusiness')
                        .attach('excel', 'test/fixtures/business sites 1.xlsx')];
                case 1:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('info@gpad.org.uk', 'ffd11212')];
                case 2:
                    user = _a.sent();
                    expect(user.jwt).toBeDefined();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).get('/api/business/sites').set('Authorization', "Bearer ".concat(user.jwt))];
                case 3:
                    site = _a.sent();
                    expect(site.statusCode).toBe(200);
                    expect(site.body.find(function (s) { return s.name === 'Head Office'; })).toBeDefined();
                    expect(site.body.find(function (s) { return s.name === 'Regional Office'; })).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    /*test('It should data from excel file without a state successfully', async () => {
      const body = await registerUser(app)();
      const response = await supertest(app)
        .post('/api/business/importBusiness')
        .set('Authorization', `Bearer ${body.jwt}`)
        .attach('excel', 'test/fixtures/business_example_v3.xlsx');
      expect(response.statusCode).toBe(200);
    });*/
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXNlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBa0M7QUFDbEMsa0NBQWlDO0FBQ2pDLHVDQUFvRTtBQUNwRSx5RUFBOEM7QUFFOUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxrQkFBTyxDQUFDLENBQUM7QUFFdkIsUUFBUSxDQUFDLFlBQVksRUFBRTtJQUNyQixJQUFJLENBQUMsOERBQThELEVBQUU7Ozs7d0JBQ3RELHFCQUFNLElBQUEsdUJBQVksRUFBQyxTQUFHLENBQUMsRUFBRSxFQUFBOztvQkFBaEMsSUFBSSxHQUFHLFNBQXlCO29CQUNoQyxPQUFPLEdBQUc7d0JBQ2QsWUFBWSxFQUFFLGtCQUFrQjt3QkFDaEMsWUFBWSxFQUFFLGtCQUFrQjt3QkFDaEMsZUFBZSxFQUFFLHFCQUFxQjt3QkFDdEMsUUFBUSxFQUFFLGNBQWM7d0JBQ3hCLFlBQVksRUFBRSxrQkFBa0I7d0JBQ2hDLFdBQVcsRUFBRSxpQkFBaUI7d0JBQzlCLFFBQVEsRUFBRSxjQUFjO3dCQUN4QixXQUFXLEVBQUUsaUJBQWlCO3dCQUM5QixLQUFLLEVBQUUsb0JBQW9CO3dCQUMzQixTQUFTLEVBQUUsQ0FBQzt3QkFDWixPQUFPLEVBQUUsRUFBRTt3QkFDWCxJQUFJLEVBQUUsVUFBVTt3QkFDaEIsUUFBUSxFQUFFLGNBQWM7d0JBQ3hCLFNBQVMsRUFBRSxlQUFlO3dCQUMxQixnQkFBZ0IsRUFBRSxZQUFZO3FCQUMvQixDQUFDO29CQUVlLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUE7O29CQUE3RyxRQUFRLEdBQUcsU0FBa0c7b0JBQ25ILE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNqRyxxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDOzRCQUM5RCxLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7NEJBQ3BCLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUTt5QkFDM0IsQ0FBQyxFQUFBOztvQkFISSxLQUFLLEdBQUcsU0FHWjtvQkFDRixNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN2RyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzs7OztTQUNwQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsc0ZBQXNGLEVBQUU7Ozs7d0JBQzlFLHFCQUFNLElBQUEsdUJBQVksRUFBQyxTQUFHLENBQUMsRUFBRSxFQUFBOztvQkFBaEMsSUFBSSxHQUFHLFNBQXlCO29CQUNoQyxPQUFPLEdBQUc7d0JBQ2QsWUFBWSxFQUFFLG1CQUFtQjt3QkFDakMsWUFBWSxFQUFFLGtCQUFrQjt3QkFDaEMsZUFBZSxFQUFFLHFCQUFxQjt3QkFDdEMsUUFBUSxFQUFFLGNBQWM7d0JBQ3hCLFlBQVksRUFBRSxrQkFBa0I7d0JBQ2hDLFdBQVcsRUFBRSxpQkFBaUI7d0JBQzlCLFFBQVEsRUFBRSxjQUFjO3dCQUN4QixXQUFXLEVBQUUsaUJBQWlCO3dCQUM5QixLQUFLLEVBQUUsV0FBVzt3QkFDbEIsU0FBUyxFQUFFLENBQUM7d0JBQ1osT0FBTyxFQUFFLEVBQUU7d0JBQ1gsU0FBUyxFQUFFLFdBQVc7d0JBQ3RCLElBQUksRUFBRSxVQUFVO3dCQUNoQixRQUFRLEVBQUUsY0FBYzt3QkFDeEIsZ0JBQWdCLEVBQUUsWUFBWTtxQkFDL0IsQ0FBQztvQkFFZSxxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFBOztvQkFBN0csUUFBUSxHQUFHLFNBQWtHO29CQUNuSCxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMscUJBQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQzs7OztTQUNoSCxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMkRBQTJELEVBQUU7Ozs7d0JBQ25ELHFCQUFNLElBQUEsb0JBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFBOztvQkFBL0MsSUFBSSxHQUFHLFNBQXdDO29CQUMvQyxPQUFPLEdBQUc7d0JBQ2QsTUFBTSxFQUFFLEdBQUc7d0JBQ1gsT0FBTyxFQUFFOzRCQUNQO2dDQUNFLFlBQVksRUFBRSxDQUFDO2dDQUNmLFFBQVEsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dDQUNuQixNQUFNLEVBQUU7b0NBQ047d0NBQ0UsSUFBSSxFQUFFLFVBQVU7d0NBQ2hCLFNBQVMsRUFBRSxVQUFVO3dDQUNyQixPQUFPLEVBQUUsVUFBVTt3Q0FDbkIsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQzt3Q0FDcEIsSUFBSSxFQUFFLEdBQUc7cUNBQ1Y7b0NBQ0Q7d0NBQ0UsSUFBSSxFQUFFLFFBQVE7d0NBQ2QsU0FBUyxFQUFFLFVBQVU7d0NBQ3JCLE9BQU8sRUFBRSxVQUFVO3dDQUNuQixJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO3dDQUNwQixJQUFJLEVBQUUsR0FBRztxQ0FDVjtpQ0FDRjtnQ0FDRCxZQUFZLEVBQUU7b0NBQ1o7d0NBQ0UsTUFBTSxFQUFFLGFBQWE7cUNBQ3RCO29DQUNEO3dDQUNFLE1BQU0sRUFBRSxhQUFhO3FDQUN0QjtpQ0FDRjtnQ0FDRCxJQUFJLEVBQUU7b0NBQ0osWUFBWSxFQUFFLEtBQUs7b0NBQ25CLEdBQUcsRUFBRSxHQUFHO2lDQUNUOzZCQUNGO3lCQUNGO3FCQUNGLENBQUM7b0JBQ2UscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDbEMsSUFBSSxDQUFDLDBCQUEwQixDQUFDOzZCQUNoQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQzs2QkFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFBOztvQkFIVixRQUFRLEdBQUcsU0FHRDtvQkFDaEIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQ2pDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQ2xGLENBQUM7b0JBQ0YsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRWhDLFFBQVEsR0FBRyxPQUFPLENBQUM7b0JBQ3pCLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQy9DLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUNqQixxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUNuQyxJQUFJLENBQUMsMEJBQTBCLENBQUM7NkJBQ2hDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDOzZCQUMxQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUE7O29CQUhYLFNBQVMsR0FBRyxTQUdEO29CQUVqQixNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUNoSCxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFFeEIscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUE7O29CQUF0RyxNQUFNLEdBQUcsU0FBNkY7b0JBQzVHLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUNwQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ25DLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzdDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ25ELE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNyRCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNyRCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDckQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDdkQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7OztTQUNoRCxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMERBQTBELEVBQUU7Ozs7d0JBQ2xELHFCQUFNLElBQUEsb0JBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFBOztvQkFBL0MsSUFBSSxHQUFHLFNBQXdDO29CQUMvQyxPQUFPLEdBQUc7d0JBQ2QsUUFBUSxFQUFFLENBQUM7d0JBQ1gsTUFBTSxFQUFFLEdBQUc7d0JBQ1gsU0FBUyxFQUFFLGNBQWM7d0JBQ3pCLFFBQVEsRUFBRSxlQUFlO3dCQUN6QixTQUFTLEVBQUUsWUFBWTt3QkFDdkIsT0FBTyxFQUFFLFlBQVk7cUJBQ3RCLENBQUM7b0JBQ2UscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDbEMsSUFBSSxDQUFDLHNCQUFzQixDQUFDOzZCQUM1QixHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQzs2QkFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFBOztvQkFIVixRQUFRLEdBQUcsU0FHRDtvQkFDaEIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3RDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7U0FDNUcsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDREQUE0RCxFQUFFOzs7O3dCQUNwRCxxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBQTs7b0JBQS9DLElBQUksR0FBRyxTQUF3QztvQkFDL0MsT0FBTyxHQUFHO3dCQUNkOzRCQUNFLE1BQU0sRUFBRSxHQUFHOzRCQUNYLFFBQVEsRUFBRSxDQUFDOzRCQUNYLElBQUksRUFBRSxZQUFZOzRCQUNsQixtQkFBbUIsRUFBRSxFQUFFOzRCQUN2QixxQkFBcUIsRUFBRSxFQUFFO3lCQUMxQjt3QkFDRCxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLG1CQUFtQixFQUFFLEVBQUUsRUFBRSxxQkFBcUIsRUFBRSxFQUFFLEVBQUU7cUJBQ3JHLENBQUM7b0JBQ2UscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDbEMsSUFBSSxDQUFDLDBCQUEwQixDQUFDOzZCQUNoQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQzs2QkFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFBOztvQkFIVixRQUFRLEdBQUcsU0FHRDtvQkFDaEIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3RDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBRTdGLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ25DLElBQUksQ0FBQywwQkFBMEIsQ0FBQzs2QkFDaEMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLElBQUksQ0FBQztrREFFQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQ2IsSUFBSSxFQUFFLFlBQVk7eUJBRXJCLENBQUMsRUFBQTs7b0JBUkUsU0FBUyxHQUFHLFNBUWQ7b0JBQ0osTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3ZDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7U0FDakgsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDREQUE0RCxFQUFFOzs7O3dCQUNwRCxxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBQTs7b0JBQS9DLElBQUksR0FBRyxTQUF3QztvQkFDL0MsT0FBTyxHQUFHO3dCQUNkOzRCQUNFLE1BQU0sRUFBRSxHQUFHOzRCQUNYLFFBQVEsRUFBRSxZQUFZOzRCQUN0QixPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQzt5QkFDOUM7d0JBQ0Q7NEJBQ0UsTUFBTSxFQUFFLEdBQUc7NEJBQ1gsUUFBUSxFQUFFLFdBQVc7NEJBQ3JCLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDO3lCQUM5QztxQkFDRixDQUFDO29CQUNlLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ2xDLElBQUksQ0FBQywwQkFBMEIsQ0FBQzs2QkFDaEMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQTs7b0JBSFYsUUFBUSxHQUFHLFNBR0Q7b0JBQ2hCLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUU3RixxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUNuQyxJQUFJLENBQUMsMEJBQTBCLENBQUM7NkJBQ2hDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDOzZCQUMxQyxJQUFJLENBQUM7NEJBQ0o7Z0NBQ0UsTUFBTSxFQUFFLEdBQUc7Z0NBQ1gsUUFBUSxFQUFFLFdBQVc7Z0NBQ3JCLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDOzZCQUM5Qzt5QkFDRixDQUFDLEVBQUE7O29CQVRFLFNBQVMsR0FBRyxTQVNkO29CQUNKLE1BQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN2QyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDOzs7O1NBQ2pILENBQUMsQ0FBQztJQUVILElBQUksQ0FBQywrREFBK0QsRUFBRTs7Ozt3QkFDdkQscUJBQU0sSUFBQSxvQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLEVBQUE7O29CQUEvQyxJQUFJLEdBQUcsU0FBd0M7b0JBQy9DLE9BQU8sR0FBRzt3QkFDZCxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTt3QkFDbkYsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7cUJBQ3BGLENBQUM7b0JBQ2UscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDbEMsSUFBSSxDQUFDLDZCQUE2QixDQUFDOzZCQUNuQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQzs2QkFDMUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFBOztvQkFIVixRQUFRLEdBQUcsU0FHRDtvQkFDaEIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3RDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7U0FDaEgsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLCtDQUErQyxFQUFFOzs7O3dCQUN2QyxxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBQTs7b0JBQS9DLElBQUksR0FBRyxTQUF3QztvQkFDcEMscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUE7O29CQUFyRyxRQUFRLEdBQUcsU0FBMEY7b0JBQzNHLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3JDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFDLENBQU8sSUFBSyxPQUFBLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRyxFQUFaLENBQVksQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQ3BFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFDLENBQU8sSUFBSyxPQUFBLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRyxFQUFaLENBQVksQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBRXRELHFCQUFNLElBQUEsb0JBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFBOztvQkFBaEQsS0FBSyxHQUFHLFNBQXdDO29CQUNwQyxxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxLQUFLLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBQTs7b0JBQXZHLFNBQVMsR0FBRyxTQUEyRjtvQkFDN0csTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3ZDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQUMsQ0FBTyxJQUFLLE9BQUEsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLEVBQVosQ0FBWSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDckUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQUMsQ0FBTyxJQUFLLE9BQUEsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLEVBQVosQ0FBWSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs7OztTQUN0RSxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMkRBQTJELEVBQUU7Ozs7d0JBQ25ELHFCQUFNLElBQUEsdUJBQVksRUFBQyxTQUFHLENBQUMsRUFBRSxFQUFBOztvQkFBaEMsSUFBSSxHQUFHLFNBQXlCO29CQUNoQyxPQUFPLEdBQUc7d0JBQ2Q7NEJBQ0UsSUFBSSxFQUFFLFNBQVM7NEJBQ2YsSUFBSSxFQUFFLEdBQUc7NEJBQ1QsVUFBVSxFQUFFLEdBQUc7eUJBQ2hCO3dCQUNEOzRCQUNFLElBQUksRUFBRSxTQUFTOzRCQUNmLElBQUksRUFBRSxHQUFHOzRCQUNULFVBQVUsRUFBRSxHQUFHO3lCQUNoQjtxQkFDRixDQUFDO29CQUNlLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ2xDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQzs2QkFDL0IsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBQTs7b0JBSFYsUUFBUSxHQUFHLFNBR0Q7b0JBQ2hCLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUU3RixxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUNuQyxJQUFJLENBQUMseUJBQXlCLENBQUM7NkJBQy9CLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDOzZCQUMxQyxJQUFJLENBQUM7NEJBQ0o7Z0NBQ0UsSUFBSSxFQUFFLFNBQVM7Z0NBQ2YsSUFBSSxFQUFFLEdBQUc7Z0NBQ1QsVUFBVSxFQUFFLEdBQUc7NkJBQ2hCO3lCQUNGLENBQUMsRUFBQTs7b0JBVEUsU0FBUyxHQUFHLFNBU2Q7b0JBQ0osTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ3ZDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7Ozs7U0FDakgsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdEQUFnRCxFQUFFOzs7O3dCQUN4QyxxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsa0JBQWtCLENBQUMsRUFBQTs7b0JBQS9DLElBQUksR0FBRyxTQUF3QztvQkFDcEMscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUE7O29CQUFyRyxRQUFRLEdBQUcsU0FBMEY7b0JBQzNHLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3JDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDckMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDOzs7O1NBQ3RDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxzQ0FBc0MsRUFBRTs7Ozt3QkFDOUIscUJBQU0sSUFBQSxvQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLEVBQUE7O29CQUEvQyxJQUFJLEdBQUcsU0FBd0M7b0JBQ3BDLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ2xDLElBQUksQ0FBQywyQkFBMkIsQ0FBQzs2QkFDakMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLElBQUksQ0FBQzs0QkFDSjtnQ0FDRSxTQUFTLEVBQUUsWUFBWTtnQ0FDdkIsT0FBTyxFQUFFLFlBQVk7Z0NBQ3JCLFdBQVcsRUFBRSxFQUFFO2dDQUNmLFVBQVUsRUFBRSxFQUFFO2dDQUNkLE1BQU0sRUFBRSxHQUFHO2dDQUNYLFFBQVEsRUFBRSxDQUFDOzZCQUNaO3lCQUNGLENBQUMsRUFBQTs7b0JBWkUsUUFBUSxHQUFHLFNBWWI7b0JBQ0osTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Ozs7U0FDdkMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHNDQUFzQyxFQUFFOzs7O3dCQUM5QixxQkFBTSxJQUFBLHVCQUFZLEVBQUMsU0FBRyxDQUFDLEVBQUUsRUFBQTs7b0JBQWhDLElBQUksR0FBRyxTQUF5QjtvQkFDckIscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQyxFQUFBOztvQkFBL0YsUUFBUSxHQUFHLFNBQW9GO29CQUNyRyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzs7OztTQUN2QyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsNkNBQTZDLEVBQUU7Ozs7d0JBQ2pDLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7eUJBQ2xDLElBQUksQ0FBQyw4QkFBOEIsQ0FBQzt5QkFDcEMsTUFBTSxDQUFDLE9BQU8sRUFBRSxxQ0FBcUMsQ0FBQyxFQUFBOztvQkFGbkQsUUFBUSxHQUFHLFNBRXdDO29CQUN6RCxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFFekIscUJBQU0sSUFBQSxvQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxFQUFBOztvQkFBM0QsSUFBSSxHQUFHLFNBQW9EO29CQUNqRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO29CQUNsQixxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBQTs7b0JBQWpHLElBQUksR0FBRyxTQUEwRjtvQkFDdkcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFDLENBQXlCLElBQUssT0FBQSxDQUFDLENBQUMsSUFBSSxLQUFLLGFBQWEsRUFBeEIsQ0FBd0IsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQzlGLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFDLENBQXlCLElBQUssT0FBQSxDQUFDLENBQUMsSUFBSSxLQUFLLGlCQUFpQixFQUE1QixDQUE0QixDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzs7OztTQUNuRyxDQUFDLENBQUM7SUFFSDs7Ozs7OztTQU9LO0FBQ1AsQ0FBQyxDQUFDLENBQUMifQ==