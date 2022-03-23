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
import './definitions/energyLog.definition';
import './definitions/fuelUse.definition';
import { RegisterPath } from './definitions/auth.register.definition';
import './definitions/user.definition';

import { LoginPath } from './definitions/auth.login.definition';
import { CreateSitePath } from './definitions/site.create.definition';
import { AddUtilityConsumptionPath } from './definitions/utilityConsumption.add.definition';
import { UtilityFileImportPath } from './definitions/utilityFile.import.definition';
import { OpenApiDefinition } from './OpenApiDefinition';
import { GetDashboardDataPath } from './definitions/dashboard.get.definition';
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
import { GetBusinessFloorsPath } from './definitions/user.get.floors.definition';
import { GetEmissionsPath } from './definitions/utility.getEmissions.get.definition';
import './definitions/utilityConsumption.definition';
import { GetConsumptionsPath } from './definitions/utility.getConsumption.get.definition';
import { DeleteSitePath } from './definitions/site.delete.definition';
import { GetSiteDetailsPath } from './definitions/siteDetails.get.definition';
import { UpdateSitePath } from './definitions/site.update.definition';
import { SetBusinessPatternsPath } from './definitions/user.savePattern.definition';
import { LogFileImportPath } from './definitions/logFile.import.definition';
import { GetUsedInPath } from './definitions/utility.usedIn.get.definition';
import { GetCountriesPath } from './definitions/countries.get.definition';
import { GetStatesPath } from './definitions/states.get.definition';
import { GetPatternsPath } from './definitions/user.patterns.get.definition';
import { FileImportBusinessPath } from './definitions/user.import.definition';
import { FileImportBusinessTenantsPath } from './definitions/user.tenant.import.definition';
import { FileImportBusinessPatternPath } from './definitions/user.operation.import.definition';

export default OpenApiDefinition;
export {
  RegisterPath,
  LoginPath,
  CreateSitePath,
  AddUtilityConsumptionPath,
  AddUtilityEmissionPath,
  UtilityFileImportPath,
  GetDashboardDataPath,
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
  GetBusinessFloorsPath,
  GetEmissionsPath,
  GetConsumptionsPath,
  DeleteSitePath,
  GetSiteDetailsPath,
  UpdateSitePath,
  SetBusinessPatternsPath,
  LogFileImportPath,
  GetUsedInPath,
  GetCountriesPath,
  GetStatesPath,
  GetPatternsPath,
  FileImportBusinessPath,
  FileImportBusinessTenantsPath,
  FileImportBusinessPatternPath,
};
