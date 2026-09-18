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
Object.defineProperty(exports, "__esModule", { value: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('ts-node').register({ transpileOnly: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
var DB = require('./src/lib/db/Db').default;
var setup = function () { return __awaiter(void 0, void 0, void 0, function () {
    var tables, tablesToIgnore, idx, t;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, DB('pg_catalog.pg_tables')
                    .select('tablename')
                    .where({ schemaname: 'public' })];
            case 1:
                tables = _a.sent();
                tablesToIgnore = ['knex_migrations', 'knex_migrations_lock'];
                tables = tables.filter(function (t) { return !tablesToIgnore.includes(t.tablename); });
                idx = 0;
                _a.label = 2;
            case 2:
                if (!(idx < tables.length)) return [3 /*break*/, 5];
                t = tables[idx];
                return [4 /*yield*/, DB.raw("TRUNCATE \"".concat(t.tablename, "\" CASCADE;"))];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4:
                idx++;
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/, DB.migrate
                    .rollback(undefined, true)
                    .then(function () {
                    console.log('TEST DB DELETED');
                    return DB.migrate.latest();
                })
                    .then(function () {
                    return DB.seed.run();
                })
                    .then(function () {
                    console.log('SEED ran');
                })
                    .catch(function (err) {
                    console.log(err);
                    return err;
                })];
        }
    });
}); };
exports.default = setup;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiamVzdC5zZXR1cC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImplc3Quc2V0dXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBOEQ7QUFDOUQsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELDhEQUE4RDtBQUM5RCxJQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxPQUFPLENBQUM7QUFFOUMsSUFBTSxLQUFLLEdBQUc7Ozs7b0JBQzBCLHFCQUFNLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQztxQkFDbkUsTUFBTSxDQUFDLFdBQVcsQ0FBQztxQkFDbkIsS0FBSyxDQUFDLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUE7O2dCQUY5QixNQUFNLEdBQTRCLFNBRUo7Z0JBQzVCLGNBQWMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLHNCQUFzQixDQUFDLENBQUM7Z0JBQ25FLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQUMsQ0FBQyxJQUFLLE9BQUEsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsRUFBckMsQ0FBcUMsQ0FBQyxDQUFDO2dCQUU1RCxHQUFHLEdBQUcsQ0FBQzs7O3FCQUFFLENBQUEsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUE7Z0JBQzdCLENBQUMsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3RCLHFCQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMscUJBQWEsQ0FBQyxDQUFDLFNBQVMsZ0JBQVksQ0FBQyxFQUFBOztnQkFBbEQsU0FBa0QsQ0FBQzs7O2dCQUZkLEdBQUcsRUFBRSxDQUFBOztvQkFLNUMsc0JBQU8sRUFBRSxDQUFDLE9BQU87cUJBQ2QsUUFBUSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUM7cUJBQ3pCLElBQUksQ0FBQztvQkFDSixPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7b0JBQy9CLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDN0IsQ0FBQyxDQUFDO3FCQUNELElBQUksQ0FBQztvQkFDSixPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3ZCLENBQUMsQ0FBQztxQkFDRCxJQUFJLENBQUM7b0JBQ0osT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQTtnQkFDekIsQ0FBQyxDQUFDO3FCQUNELEtBQUssQ0FBQyxVQUFDLEdBQVU7b0JBQ2hCLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2pCLE9BQU8sR0FBRyxDQUFDO2dCQUNiLENBQUMsQ0FBQyxFQUFDOzs7S0FDTixDQUFDO0FBRUYsa0JBQWUsS0FBSyxDQUFDIn0=