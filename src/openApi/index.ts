import './definitions/genericError.definition';
import './definitions/success.definition';
import './definitions/site.definition';
import './definitions/jwt.definition';
import { RegisterPath } from './definitions/auth.register.definition';
import './definitions/user.definition';

import { LoginPath } from './definitions/auth.login.definition';
import { CreateSitePath } from './definitions/site.create.definition';
import { CreateUtilityPath } from './definitions/utility.create.definition';
import { OpenApiDefinition } from './OpenApiDefinition';

export default OpenApiDefinition;
export { RegisterPath, LoginPath, CreateSitePath, CreateUtilityPath };
