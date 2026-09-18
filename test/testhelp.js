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
exports.WRONG_NUMBER_ERROR_MESSAGE = exports.WRONG_DATE_ERROR_MESSAGE = exports.NO_EXTRA_PROPERTY_ERROR_MESSAGE = exports.SHOULD_BE_STRING_ERROR = exports.buildFakeUtilityMonitoring = exports.buildFakeTarget = exports.buildFakeConsumption = exports.buildFakeEmission = exports.buildFakeSite = exports.buildFakeBusiness = exports.loginUser = exports.registerUser = exports.matcher = void 0;
var supertest_1 = __importDefault(require("supertest"));
var faker_1 = require("@faker-js/faker");
var requestValidator_middleware_1 = require("../src/middleware/requestValidator.middleware");
var jest_json_schema_1 = require("jest-json-schema");
var ulid_1 = require("ulid");
exports.matcher = (0, jest_json_schema_1.matchersWithOptions)({
    formats: {
        int32: requestValidator_middleware_1.int32Format,
    },
});
var registerUser = function (app) { return function (email, password) { return __awaiter(void 0, void 0, void 0, function () {
    var body;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                body = {
                    businessName: "".concat(faker_1.faker.company.name(), " ").concat((0, ulid_1.ulid)()),
                    businessType: 'dolor',
                    businessService: 'sit nisi',
                    password: password || 'irure in eiusmod sint nostrud',
                    buildingName: 'sint consequat',
                    contactName: 'labore exercitation id',
                    position: 'ullamco tempor exercitation laboris consectetur',
                    phoneNumber: 'velit',
                    email: email ? email : "mail".concat(new Date().valueOf().toString(), "@mail.com"),
                    countryId: 2,
                    stateId: 42,
                    town: 'magna dolore dolor in',
                    currencyCode: 'USD',
                    postCode: 'velit id',
                    address_1: 'address_1',
                    subscriptionDate: '1989-07-20',
                };
                return [4 /*yield*/, (0, supertest_1.default)(app).post('/api/auth').send(body)];
            case 1:
                _a.sent();
                return [2 /*return*/, (0, supertest_1.default)(app)
                        .post('/api/auth/login')
                        .send({
                        email: body.email,
                        password: body.password,
                    })
                        .then(function (res) {
                        return res.body;
                    })];
        }
    });
}); }; };
exports.registerUser = registerUser;
var loginUser = function (app) { return function (email, password) {
    return (0, supertest_1.default)(app)
        .post('/api/auth/login')
        .send({
        email: email,
        password: password || '123456Abc!',
    })
        .then(function (res) {
        return res.body;
    });
}; };
exports.loginUser = loginUser;
var buildFakeBusiness = function (p) {
    return {
        id: p.id,
        businessName: "".concat(faker_1.faker.company.name(), " ").concat((0, ulid_1.ulid)()),
        businessType: 'Arts, Entertainment and Recreation',
        businessService: 'a service',
        password: '$2b$10$XYSGA3eqhW17sX1Gyb83bemjRva.O2CfzlgE6EJH.NGBnKlyuWQWW',
        buildingName: 'a name',
        contactName: 'a contact name',
        position: 'a position',
        phoneNumber: '+55 122334444',
        email: p.email,
        countryId: 2,
        stateId: 42,
        town: 'a town',
        currencyCode: 'USD',
        postCode: '485 s8d',
        subscriptionDate: new Date().toISOString().split('T')[0],
    };
};
exports.buildFakeBusiness = buildFakeBusiness;
var buildFakeSite = function (p) { return ({
    id: p.id,
    name: p.name || "".concat(faker_1.faker.word.noun(), " ").concat((0, ulid_1.ulid)()),
    type: 'some',
    code: p.code || (0, ulid_1.ulid)(),
    address: 'anywhere',
    postCode: '484 sd8',
    town: 'some town',
    size: 15,
    vat: p.vat || 1,
    businessId: p.businessId,
}); };
exports.buildFakeSite = buildFakeSite;
var buildFakeEmission = function (p) { return ({
    id: p.id,
    conversionFactor: 20,
    fuelUnit: 'm3',
    emissionFactor: 25,
    date: p.date || '2020-01-01',
    siteId: p.siteId,
    fuelSourceId: p.fuelSourceId,
}); };
exports.buildFakeEmission = buildFakeEmission;
var buildFakeConsumption = function (p) {
    return {
        id: p.id,
        date: p.date,
        consumption: p.consumption,
        vat: 20,
        conversionFactor: 10,
        totalCost: p.totalCost || 10,
        fuelUnit: 'm3',
        siteId: p.siteId,
        fuelSourceId: p.fuelSourceId,
        usedInId: 2,
        population: 0,
        workingHours: 0
    };
};
exports.buildFakeConsumption = buildFakeConsumption;
var buildFakeTarget = function (p) {
    var data = {
        TargetConsumption: p.map(function (i) {
            return {
                id: i.id,
                date: i.date,
                siteId: i.siteId,
                fuelSourceId: i.fuelSourceId,
            };
        }),
        TargetConsumptionFuelConversion: p
            .map(function (item) {
            return item.targets.map(function (i) {
                return {
                    targetConsumptionId: item.id,
                    targetValue: i.targetValue,
                    fuelUnit: i.fuelUnit,
                };
            });
        })
            .flat(),
    };
    return data;
};
exports.buildFakeTarget = buildFakeTarget;
var buildFakeUtilityMonitoring = function (p) {
    return {
        id: p.id,
        date: p.date,
        carbon: p.carbon,
        energy: 20,
        conversionFactor: 10,
        fuelUnit: 'm3',
        siteId: p.siteId,
        fuelSourceId: p.fuelSourceId,
    };
};
exports.buildFakeUtilityMonitoring = buildFakeUtilityMonitoring;
exports.SHOULD_BE_STRING_ERROR = 'should be string';
exports.NO_EXTRA_PROPERTY_ERROR_MESSAGE = 'should NOT have additional properties';
exports.WRONG_DATE_ERROR_MESSAGE = 'should match format "date"';
exports.WRONG_NUMBER_ERROR_MESSAGE = 'should match format "int32"';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGhlbHAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0ZXN0aGVscC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBa0M7QUFDbEMseUNBQXdDO0FBQ3hDLDZGQUE0RTtBQUM1RSxxREFBdUQ7QUFDdkQsNkJBQTRCO0FBSWYsUUFBQSxPQUFPLEdBQUcsSUFBQSxzQ0FBbUIsRUFBQztJQUN6QyxPQUFPLEVBQUU7UUFDUCxLQUFLLEVBQUUseUNBQVc7S0FDbkI7Q0FDRixDQUFDLENBQUM7QUFFSSxJQUFNLFlBQVksR0FBRyxVQUFDLEdBQXdCLElBQUssT0FBQSxVQUFPLEtBQWMsRUFBRSxRQUFpQjs7Ozs7Z0JBQzFGLElBQUksR0FBRztvQkFDWCxZQUFZLEVBQUUsVUFBRyxhQUFLLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxjQUFJLElBQUEsV0FBSSxHQUFFLENBQUU7b0JBQ2pELFlBQVksRUFBRSxPQUFPO29CQUNyQixlQUFlLEVBQUUsVUFBVTtvQkFDM0IsUUFBUSxFQUFFLFFBQVEsSUFBSSwrQkFBK0I7b0JBQ3JELFlBQVksRUFBRSxnQkFBZ0I7b0JBQzlCLFdBQVcsRUFBRSx3QkFBd0I7b0JBQ3JDLFFBQVEsRUFBRSxpREFBaUQ7b0JBQzNELFdBQVcsRUFBRSxPQUFPO29CQUNwQixLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGNBQU8sSUFBSSxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxRQUFRLEVBQUUsY0FBVztvQkFDeEUsU0FBUyxFQUFFLENBQUM7b0JBQ1osT0FBTyxFQUFFLEVBQUU7b0JBQ1gsSUFBSSxFQUFFLHVCQUF1QjtvQkFDN0IsWUFBWSxFQUFFLEtBQUs7b0JBQ25CLFFBQVEsRUFBRSxVQUFVO29CQUNwQixTQUFTLEVBQUUsV0FBVztvQkFDdEIsZ0JBQWdCLEVBQUUsWUFBWTtp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