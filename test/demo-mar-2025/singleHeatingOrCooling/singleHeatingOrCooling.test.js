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
var testhelp_1 = require("../../testhelp");
var app_1 = require("../../../src/app");
describe('/Single heating or cooling ', function () {
    test('should import and calculate waste fine', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('admin@energypad.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api//business/importBusiness')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/demo-mar-2025/singleHeatingOrCooling/fixtures/businesses.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('bp1@gpad.org.uk', "Binod9774%")];
                case 3:
                    user = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/business/sites')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 4:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.length).toBe(1);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/business/importPatterns')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/demo-mar-2025/singleHeatingOrCooling/fixtures/profiles.xlsx')];
                case 5:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/demo-mar-2025/singleHeatingOrCooling/fixtures/consumptions.xlsx')];
                case 6:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/energyWaste?year=2024')
                            .set('Authorization', "Bearer ".concat(user.jwt))
                        //console.log(response.body.waste)
                    ];
                case 7:
                    response = _a.sent();
                    //console.log(response.body.waste)
                    expect(response.statusCode).toBe(200);
                    expect(response.body.waste.at(0).length).toBe(12);
                    expect(response.body.waste.at(0)[0].waste).toBe(59.51);
                    expect(response.body.waste.at(0)[1].waste).toBe(117.56);
                    expect(response.body.waste.at(0)[2].waste).toBe(-23.48);
                    expect(response.body.waste.at(0)[3].waste).toBe(-27.67);
                    expect(response.body.waste.at(0)[4].waste).toBe(5428.33);
                    expect(response.body.waste.at(0)[5].waste).toBe(1307.27);
                    expect(response.body.waste.at(0)[6].waste).toBe(222.10);
                    expect(response.body.waste.at(0)[7].waste).toBe(-132.92);
                    expect(response.body.waste.at(0)[8].waste).toBe(99.09);
                    expect(response.body.waste.at(0)[9].waste).toBe(-183.08);
                    expect(response.body.waste.at(0)[10].waste).toBe(-113.42);
                    expect(response.body.waste.at(0)[11].waste).toBe(424.01);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2luZ2xlSGVhdGluZ09yQ29vbGluZy50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2luZ2xlSGVhdGluZ09yQ29vbGluZy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0RBQWtDO0FBQ2xDLDJDQUEyQztBQUMzQyx3Q0FBdUM7QUFFdkMsUUFBUSxDQUFDLDZCQUE2QixFQUFFO0lBQ3RDLElBQUksQ0FBQyx3Q0FBd0MsRUFBRTs7Ozt3QkFDaEMscUJBQU0sSUFBQSxvQkFBUyxFQUFDLFNBQUcsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLEVBQUE7O29CQUFsRCxJQUFJLEdBQUcsU0FBMkM7b0JBRXpDLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ2hDLElBQUksQ0FBQywrQkFBK0IsQ0FBQzs2QkFDckMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsb0VBQW9FLENBQUMsRUFBQTs7b0JBSHBGLFFBQVEsR0FBRyxTQUd5RTtvQkFDeEYsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRXpCLHFCQUFNLElBQUEsb0JBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLENBQUMsRUFBQTs7b0JBQTVELElBQUksR0FBRyxTQUFxRDtvQkFDdkQscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDNUIsR0FBRyxDQUFDLHFCQUFxQixDQUFDOzZCQUMxQixHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQyxFQUFBOztvQkFGN0MsUUFBUSxHQUFHLFNBRWtDLENBQUE7b0JBQzdDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBRTFCLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQzVCLElBQUksQ0FBQyw4QkFBOEIsQ0FBQzs2QkFDcEMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsa0VBQWtFLENBQUMsRUFBQTs7b0JBSHRGLFFBQVEsR0FBRyxTQUcyRSxDQUFDO29CQUN2RixNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFFM0IscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDNUIsSUFBSSxDQUFDLHFDQUFxQyxDQUFDOzZCQUMzQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQzs2QkFDMUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxzRUFBc0UsQ0FBQyxFQUFBOztvQkFIMUYsUUFBUSxHQUFHLFNBRytFLENBQUM7b0JBQzNGLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUUzQixxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUM1QixHQUFHLENBQUMsc0NBQXNDLENBQUM7NkJBQzNDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDO3dCQUMzQyxrQ0FBa0M7c0JBRFM7O29CQUY3QyxRQUFRLEdBQUcsU0FFa0MsQ0FBQTtvQkFDM0Msa0NBQWtDO29CQUNwQyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7b0JBQ2xELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN2RCxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3pELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN6RCxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDeEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDekQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3ZELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3pELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzFELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOzs7O1NBQzFELENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIn0=