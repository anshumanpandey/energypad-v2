import './definitions/genericError.definition';
import './definitions/success.definition';
import './definitions/site.definition';
import './definitions/jwt.definition';
import { RegisterPath } from './definitions/auth.register.definition';
import './definitions/user.definition';

import { LoginPath } from './definitions/auth.login.definition';
import { CreateSitePath } from './definitions/site.create.definition';
import { CreateUtilityPath } from './definitions/utility.create.definition';
import { AddUtilityPath } from './definitions/utilityEmission.add.definition';
import { UtilityFileImportPath } from './definitions/utilityFile.import.definition';
import { OpenApiDefinition } from './OpenApiDefinition';

export default OpenApiDefinition;
export { RegisterPath, LoginPath, CreateSitePath, CreateUtilityPath, AddUtilityPath, UtilityFileImportPath };
