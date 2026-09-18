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
                            .attach('excel', 'test/demo-mar-2025/heatingOrCoolingAndPower/fixtures/businesses.xlsx')];
                case 2:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('bp2@gpad.org.uk', "Binod9774%")];
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
                            .attach('excel', 'test/demo-mar-2025/heatingOrCoolingAndPower/fixtures/profiles.xlsx')];
                case 5:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .post('/api/utility/importUtilityEmissions')
                            .set('Authorization', "Bearer ".concat(body.jwt))
                            .attach('excel', 'test/demo-mar-2025/heatingOrCoolingAndPower/fixtures/consumptions.xlsx')];
                case 6:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/dashboard/energyWaste?year=2024')
                            .set('Authorization', "Bearer ".concat(user.jwt))];
                case 7:
                    response = _a.sent();
                    expect(response.statusCode).toBe(200);
                    expect(response.body.waste.at(0).length).toBe(12);
                    expect(response.body.waste.at(0)[0].waste).toBe(126.585597);
                    expect(response.body.waste.at(0)[1].waste).toBe(271.156043);
                    expect(response.body.waste.at(0)[2].waste).toBe(26.564406);
                    expect(response.body.waste.at(0)[3].waste).toBe(-41.543618);
                    expect(response.body.waste.at(0)[4].waste).toBe(977.070488);
                    expect(response.body.waste.at(0)[5].waste).toBe(886.545622);
                    expect(response.body.waste.at(0)[6].waste).toBe(952.172793);
                    expect(response.body.waste.at(0)[7].waste).toBe(-99.661536);
                    expect(response.body.waste.at(0)[8].waste).toBe(-180.190512);
                    expect(response.body.waste.at(0)[9].waste).toBe(-138.883148);
                    expect(response.body.waste.at(0)[10].waste).toBe(-107.135742);
                    expect(response.body.waste.at(0)[11].waste).toBe(-120.783722);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVhdGluZ09yQ29vbGluZ0FuZFBvd2VyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoZWF0aW5nT3JDb29saW5nQW5kUG93ZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHdEQUFrQztBQUNsQywyQ0FBMkM7QUFDM0Msd0NBQXVDO0FBRXZDLFFBQVEsQ0FBQyw2QkFBNkIsRUFBRTtJQUN0QyxJQUFJLENBQUMsd0NBQXdDLEVBQUU7Ozs7d0JBQ2hDLHFCQUFNLElBQUEsb0JBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFBOztvQkFBbEQsSUFBSSxHQUFHLFNBQTJDO29CQUV6QyxxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUNoQyxJQUFJLENBQUMsK0JBQStCLENBQUM7NkJBQ3JDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDOzZCQUMxQyxNQUFNLENBQUMsT0FBTyxFQUFFLHNFQUFzRSxDQUFDLEVBQUE7O29CQUh0RixRQUFRLEdBQUcsU0FHMkU7b0JBQzFGLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUV6QixxQkFBTSxJQUFBLG9CQUFTLEVBQUMsU0FBRyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsWUFBWSxDQUFDLEVBQUE7O29CQUE1RCxJQUFJLEdBQUcsU0FBcUQ7b0JBQ3ZELHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQzVCLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQzs2QkFDMUIsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBQTs7b0JBRjdDLFFBQVEsR0FBRyxTQUVrQyxDQUFBO29CQUM3QyxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUUxQixxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUM1QixJQUFJLENBQUMsOEJBQThCLENBQUM7NkJBQ3BDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDOzZCQUMxQyxNQUFNLENBQUMsT0FBTyxFQUFFLG9FQUFvRSxDQUFDLEVBQUE7O29CQUh4RixRQUFRLEdBQUcsU0FHNkUsQ0FBQztvQkFDekYsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRTNCLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQzVCLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQzs2QkFDM0MsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUM7NkJBQzFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsd0VBQXdFLENBQUMsRUFBQTs7b0JBSDVGLFFBQVEsR0FBRyxTQUdpRixDQUFDO29CQUM3RixNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFFM0IscUJBQU0sSUFBQSxtQkFBUyxFQUFDLFNBQUcsQ0FBQzs2QkFDNUIsR0FBRyxDQUFDLHNDQUFzQyxDQUFDOzZCQUMzQyxHQUFHLENBQUMsZUFBZSxFQUFFLGlCQUFVLElBQUksQ0FBQyxHQUFHLENBQUUsQ0FBQyxFQUFBOztvQkFGN0MsUUFBUSxHQUFHLFNBRWtDLENBQUE7b0JBQzdDLE1BQU0sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDbEQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQzVELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUM1RCxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDM0QsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7b0JBQzVELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUM1RCxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDNUQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDN0QsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDN0QsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDOUQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQzs7OztTQUMvRCxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyJ9