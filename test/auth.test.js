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
var jest_json_schema_1 = require("jest-json-schema");
var faker_1 = require("@faker-js/faker");
expect.extend(jest_json_schema_1.matchers);
var app_1 = require("../src/app");
var Schema_json_1 = __importDefault(require("../src/types/Schema.json"));
describe('/auth', function () {
    test('It should respond with success message when register', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth').send({
                        businessName: faker_1.faker.company.name(),
                        businessType: 'dolor',
                        businessService: 'sit nisi',
                        password: 'irure in eiusmod sint nostrud',
                        buildingName: 'sint consequat',
                        contactName: 'labore exercitation id',
                        position: 'ullamco tempor exercitation laboris consectetur',
                        phoneNumber: 'velit',
                        email: 'mail1a@mail.com',
                        countryId: 2,
                        stateId: 42,
                        town: 'magna dolore dolor in',
                        currencyCode: 'USD',
                        postCode: 'velit id',
                        address_1: 'address_1',
                        subscriptionDate: '1989-07-20',
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.Register.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when register with services', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth').send({
                        businessName: faker_1.faker.company.name(),
                        businessType: 'dolor',
                        businessService: 'sit nisi',
                        password: 'irure in eiusmod sint nostrud',
                        buildingName: 'sint consequat',
                        contactName: 'labore exercitation id',
                        position: 'ullamco tempor exercitation laboris consectetur',
                        phoneNumber: 'velit',
                        email: 'mail1service1@mail.com',
                        countryId: 2,
                        stateId: 42,
                        town: 'magna dolore dolor in',
                        currencyCode: 'USD',
                        postCode: 'velit id',
                        address_1: 'address_1',
                        subscriptionDate: '1989-07-20',
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.Register.content['application/json'].schema);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with success message when register without passing optional values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth').send({
                        businessName: faker_1.faker.company.name(),
                        businessType: 'dolor',
                        businessService: 'sit nisi',
                        password: 'irure in eiusmod sint nostrud',
                        buildingName: 'sint consequat',
                        contactName: 'labore exercitation id',
                        position: 'ullamco tempor exercitation laboris consectetur',
                        phoneNumber: 'velit',
                        email: 'mail1x@mail.com',
                        countryId: 2,
                        stateId: 42,
                        town: 'magna dolore dolor in',
                        currencyCode: 'USD',
                        postCode: 'velit id',
                        address_1: 'address_1',
                        subscriptionDate: '1989-07-20',
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.Register.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    /*
      TODO: FIX when task on src/openApi/definitions/auth.register.definition.ts#L63 is resolvedtest('It should respond with error message when register when services has wrong data', async () => {
      const goodData = {
        businessName: 'proident nulla dolor',
        businessType: 'dolor',
        businessService: 'sit nisi',
        password: 'irure in eiusmod sint nostrud',
        buildingName: 'sint consequat',
        contactName: 'labore exercitation id',
        position: 'ullamco tempor exercitation laboris consectetur',
        phoneNumber: 'velit',
        email: 'mail1service2@mail.com',
        countryId: 2,
        stateId: 42,
        town: 'magna dolore dolor in',
        postCode: 'velit id',
        subscriptionDate: '1989-07-20',
      };
      const response1 = await supertest(app)
        .post('/api/auth')
        .send({
          ...goodData,
          totalxxxxx: 78438954.75821584,
        });
      expect(response1.body).toMatchSchema(schema.components.schemas.GenericError);
      expect(response1.body.message).toBe(NO_EXTRA_PROPERTY_ERROR_MESSAGE);
      expect(response1.statusCode).toBe(400);
      const response2 = await supertest(app)
        .post('/api/auth')
        .send({
          ...goodData,
          town: 111,
        });
      expect(response2.body).toMatchSchema(schema.components.schemas.GenericError);
      expect(response2.body.message).toBe('town: ' + SHOULD_BE_STRING_ERROR);
      expect(response2.statusCode).toBe(400);
      const response3 = await supertest(app)
        .post('/api/auth')
        .send({
          ...goodData,
        });
      expect(response3.body).toMatchSchema(schema.components.schemas.GenericError);
      expect(response3.body.message).toBe('holydayDate: ' + WRONG_DATE_ERROR_MESSAGE);
      expect(response3.statusCode).toBe(400);
    });
  
    test('It should respond with fail with wrong parameters types', async () => {
      const correctBody = {
        businessName: 'proident nulla dolor',
        businessType: 'dolor',
        businessService: 'sit nisi',
        password: 'irure in eiusmod sint nostrud',
        buildingName: 'sint consequat',
        contactName: 'labore exercitation id',
        position: 'ullamco tempor exercitation laboris consectetur',
        phoneNumber: 'velit',
        email: 'mail2@mail.com',
        countryId: 2,
        stateId: 42,
        town: 'magna dolore dolor in',
        postCode: 'velit id',
        subscriptionDate: '1989-07-20',
      };
  
      const badBody1 = { ...correctBody, extra: 1 };
      const response1 = await supertest(app).post('/api/auth').send(badBody1);
      expect(response1.body).toMatchSchema(schema.components.schemas.GenericError);
      expect(response1.statusCode).toBe(400);
    });*/
    test('It should respond with success message when login', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    body = {
                        businessName: faker_1.faker.company.name(),
                        businessType: 'dolor',
                        businessService: 'sit nisi',
                        password: 'irure in eiusmod sint nostrud',
                        buildingName: 'sint consequat',
                        contactName: 'labore exercitation id',
                        position: 'ullamco tempor exercitation laboris consectetur',
                        phoneNumber: 'velit',
                        email: 'mail5@mail.com',
                        countryId: 2,
                        stateId: 42,
                        town: 'magna dolore dolor in',
                        currencyCode: 'USD',
                        postCode: 'velit id',
                        address_1: 'address_1',
                        subscriptionDate: '1989-07-20',
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth').send(body)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({
                            email: body.email,
                            password: body.password,
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.Login.content['application/json'].schema);
                    expect(response.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with error message when login with wrong credentials', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    body = {
                        businessName: faker_1.faker.company.name(),
                        businessType: 'dolor',
                        businessService: 'sit nisi',
                        password: 'irure in eiusmod sint nostrud',
                        buildingName: 'sint consequat',
                        contactName: 'labore exercitation id',
                        position: 'ullamco tempor exercitation laboris consectetur',
                        phoneNumber: 'velit',
                        email: 'mail6@mail.com',
                        countryId: 2,
                        stateId: 42,
                        town: 'magna dolore dolor in',
                        currencyCode: 'USD',
                        postCode: 'velit id',
                        address_1: 'address_1',
                        subscriptionDate: '1989-07-20',
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth').send(body)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({
                            email: body.email,
                            password: 'wrong!!',
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    expect(response.body.message).toBe('Wrong credentials');
                    expect(response.statusCode).toBe(400);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({
                            email: 'wrong@mail.com',
                            password: body.password,
                        })];
                case 3:
                    response2 = _a.sent();
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    expect(response2.body.message).toBe('Credentials not found');
                    expect(response2.statusCode).toBe(400);
                    return [2 /*return*/];
            }
        });
    }); });
    test('It should respond with error when using existing email', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    body = {
                        businessName: faker_1.faker.company.name(),
                        businessType: 'dolor',
                        businessService: 'sit nisi',
                        password: 'irure in eiusmod sint nostrud',
                        buildingName: 'sint consequat',
                        contactName: 'labore exercitation id',
                        position: 'ullamco tempor exercitation laboris consectetur',
                        phoneNumber: 'velit',
                        email: 'mail10@mail.com',
                        countryId: 2,
                        stateId: 42,
                        town: 'magna dolore dolor in',
                        currencyCode: 'USD',
                        address_1: 'address_1',
                        postCode: 'velit id',
                        subscriptionDate: '1989-07-20',
                    };
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app).post('/api/auth').send(body)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/auth')
                            .send(__assign(__assign({}, body), { email: 'mail10@mail.com' }))];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.schemas.GenericError);
                    expect(response.statusCode).toBe(400);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aC50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBa0M7QUFDbEMscURBQTRDO0FBQzVDLHlDQUF3QztBQUN4QyxNQUFNLENBQUMsTUFBTSxDQUFDLDJCQUFRLENBQUMsQ0FBQztBQUN4QixrQ0FBaUM7QUFDakMseUVBQThDO0FBRTlDLFFBQVEsQ0FBQyxPQUFPLEVBQUU7SUFDaEIsSUFBSSxDQUFDLHNEQUFzRCxFQUFFOzs7O3dCQUMxQyxxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQzt3QkFDM0QsWUFBWSxFQUFFLGFBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO3dCQUNsQyxZQUFZLEVBQUUsT0FBTzt3QkFDckIsZUFBZSxFQUFFLFVBQVU7d0JBQzNCLFFBQVEsRUFBRSwrQkFBK0I7d0JBQ3pDLFlBQVksRUFBRSxnQkFBZ0I7d0JBQzlCLFdBQVcsRUFBRSx3QkFBd0I7d0JBQ3JDLFFBQVEsRUFBRSxpREFBaUQ7d0JBQzNELFdBQVcsRUFBRSxPQUFPO3dCQUNwQixLQUFLLEVBQUUsaUJBQWlCO3dCQUN4QixTQUFTLEVBQUUsQ0FBQzt3QkFDWixPQUFPLEVBQUUsRUFBRTt3QkFDWCxJQUFJLEVBQUUsdUJBQXVCO3dCQUM3QixZQUFZLEVBQUUsS0FBSzt3QkFDbkIsUUFBUSxFQUFFLFVBQVU7d0JBQ3BCLFNBQVMsRUFBRSxXQUFXO3dCQUN0QixnQkFBZ0IsRUFBRSxZQUFZO3FCQUMvQixDQUFDLEVBQUE7O29CQWpCSSxRQUFRLEdBQUcsU0FpQmY7b0JBQ0YsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMscUJBQU0sQ0FBQyxVQUFVLENBQUMsU0FB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