import './definitions/genericError.definition';
import './definitions/success.definition';
import './definitions/site.definition';
import './definitions/jwt.definition';
import './definitions/businessPattern.definition';
import './definitions/programme.definition';
import './definitions/review.definition';
import './definitions/businessEnergyBrand.definition';
import './definitions/businessEnergyCost.definition';
import './definitions/businessEnergyDistance.definition';
import './definitions/businessFloor.definition';
import './definitions/savingTip.definition';
import './definitions/businessEnergy.definition';
import './definitions/tenant.definition';
import './definitions/fuelSource.definition';
import { RegisterPath } from './definitions/auth.register.definition';
import './definitions/user.definition';

import { LoginPath } from './definitions/auth.login.definition';
import { CreateSitePath } from './definitions/site.create.definition';
import { CreateUtilityPath } from './definitions/utility.create.definition';
import { AddUtilityConsumptionPath } from './definitions/utilityConsumption.add.definition';
import { UtilityFileImportPath } from './definitions/utilityFile.import.definition';
import { OpenApiDefinition } from './OpenApiDefinition';
import { GetDashboardDataPath } from './definitions/dashboard.get.definition';
import { GetUtilitiesPath } from './definitions/utility.get.definition';
import { UpdateUserPath } from './definitions/user.update.definition';
import { GetUserPath } from './definitions/user.get.definition';
import { AddBrandToBusinessPath } from './definitions/user.saveEnergy.definition';
import { GetSavingTipsPath } from './definitions/savingTips.get.definition';
import { GetBusinessEnergyPath } from './definitions/user.energy.get.definition';
import { AddUtilityEmissionPath } from './definitions/utilityEmission.add.definition';
import { AddBusinessLogPath } from './definitions/user.log.post.definition';
import { SetBusinessTenantPath } from './definitions/user.tenant.post.definition';
import { SetBusinessReviewPath } from './definitions/user.review.post.definition';
import { SetBusinessSetProgrammesPath } from './definitions/user.programmes.post.definition';
import { GetBusinessSitesPath } from './definitions/user.get.sites.definition';
import { GetFuelSourcesPath } from './definitions/utility.fuelSources.get.definition';
import { SetBusinessSetFloorsPath } from './definitions/user.floors.post.definition';

export default OpenApiDefinition;
export {
  RegisterPath,
  LoginPath,
  CreateSitePath,
  CreateUtilityPath,
  AddUtilityConsumptionPath,
  AddUtilityEmissionPath,
  UtilityFileImportPath,
  GetDashboardDataPath,
  GetUtilitiesPath,
  UpdateUserPath,
  GetUserPath,
  AddBrandToBusinessPath,
  GetSavingTipsPath,
  GetBusinessEnergyPath,
  AddBusinessLogPath,
  SetBusinessTenantPath,
  SetBusinessReviewPath,
  SetBusinessSetProgrammesPath,
  GetBusinessSitesPath,
  GetFuelSourcesPath,
  SetBusinessSetFloorsPath,
};
