import './definitions/genericError.definition';
import './definitions/success.definition';
import './definitions/site.definition';
import './definitions/jwt.definition';
import './definitions/businessService.definition';
import './definitions/progamme.definition';
import './definitions/brand.definition';
import './definitions/savingTip.definition';
import { RegisterPath } from './definitions/auth.register.definition';
import './definitions/user.definition';

import { LoginPath } from './definitions/auth.login.definition';
import { CreateSitePath } from './definitions/site.create.definition';
import { CreateUtilityPath } from './definitions/utility.create.definition';
import { AddUtilityPath } from './definitions/utilityEmission.add.definition';
import { UtilityFileImportPath } from './definitions/utilityFile.import.definition';
import { OpenApiDefinition } from './OpenApiDefinition';
import { GetDashboardDataPath } from './definitions/dashboard.get.definition';
import { GetUtilitiesPath } from './definitions/utility.get.definition';
import { UpdateUserPath } from './definitions/user.update.definition';
import { GetUserPath } from './definitions/user.get.definition';
import { AddBrandToBusinessPath } from './definitions/user.addBrand.definition';
import { GetSavingTipsPath } from './definitions/savingTips.get.definition';

export default OpenApiDefinition;
export {
  RegisterPath,
  LoginPath,
  CreateSitePath,
  CreateUtilityPath,
  AddUtilityPath,
  UtilityFileImportPath,
  GetDashboardDataPath,
  GetUtilitiesPath,
  UpdateUserPath,
  GetUserPath,
  AddBrandToBusinessPath,
  GetSavingTipsPath,
};
