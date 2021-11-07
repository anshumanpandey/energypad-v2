import { Validator } from 'express-json-validator-middleware';
import schema from '../types/Schema.json';

const validatorOptions = {
  loadSchema: () => Promise.resolve(schema),
  validateSchema: true,
  inlineRefs: true,
};
const { validate: requestValidator } = new Validator(validatorOptions);

export default requestValidator;
