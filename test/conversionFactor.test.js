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
expect.extend(testhelp_1.matcher);
describe('/ConversionFactor', function () {
    test('It should respond with conversion values', function () { return __awaiter(void 0, void 0, void 0, function () {
        var body, response, response2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, testhelp_1.loginUser)(app_1.app)('mail238@mail.com')];
                case 1:
                    body = _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/conversionUnit?fuelSource=L')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 2:
                    response = _a.sent();
                    expect(response.body).toMatchSchema(Schema_json_1.default.components.responses.GetConversionUnit.content['application/json'].schema);
                    expect(response.body.length).toBe(1);
                    expect(response.statusCode).toBe(200);
                    return [4 /*yield*/, (0, supertest_1.default)(app_1.app)
                            .get('/api/conversionUnit?fuelSource=L,m3')
                            .set('Authorization', "Bearer ".concat(body.jwt))];
                case 3:
                    response2 = _a.sent();
                    expect(response2.body).toMatchSchema(Schema_json_1.default.components.responses.GetConversionUnit.content['application/json'].schema);
                    expect(response2.body.length).toBe(1);
                    expect(response2.statusCode).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udmVyc2lvbkZhY3Rvci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29udmVyc2lvbkZhY3Rvci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsd0RBQWtDO0FBQ2xDLGtDQUFpQztBQUNqQyx1Q0FBZ0Q7QUFDaEQseUVBQThDO0FBRTlDLE1BQU0sQ0FBQyxNQUFNLENBQUMsa0JBQU8sQ0FBQyxDQUFDO0FBRXZCLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRTtJQUM1QixJQUFJLENBQUMsMENBQTBDLEVBQUU7Ozs7d0JBQ2xDLHFCQUFNLElBQUEsb0JBQVMsRUFBQyxTQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFBOztvQkFBL0MsSUFBSSxHQUFHLFNBQXdDO29CQUNwQyxxQkFBTSxJQUFBLG1CQUFTLEVBQUMsU0FBRyxDQUFDOzZCQUNsQyxHQUFHLENBQUMsa0NBQWtDLENBQUM7NkJBQ3ZDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsaUJBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBRSxDQUFDLEVBQUE7O29CQUZ2QyxRQUFRLEdBQUcsU0FFNEI7b0JBRTdDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUNqQyxxQkFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUNqRixDQUFDO29CQUNGLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDckMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBRXBCLHFCQUFNLElBQUEsbUJBQVMsRUFBQyxTQUFHLENBQUM7NkJBQ25DLEdBQUcsQ0FBQyxxQ0FBcUMsQ0FBQzs2QkFDMUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxpQkFBVSxJQUFJLENBQUMsR0FBRyxDQUFFLENBQUMsRUFBQTs7b0JBRnZDLFNBQVMsR0FBRyxTQUUyQjtvQkFFN0MsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQ2xDLHFCQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQ2pGLENBQUM7b0JBQ0YsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN0QyxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQzs7OztTQUN4QyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyJ9