import './definitions/jwt.definition';
import './definitions/genericError.definition';
import './definitions/success.definition';
import { RegisterPath } from './definitions/auth.register.definition';
import './definitions/user.definition';

import { LoginPath } from './definitions/auth.login.definition';
import { OpenApiDefinition } from './OpenApiDefinition';

export default OpenApiDefinition;
export { RegisterPath, LoginPath };
