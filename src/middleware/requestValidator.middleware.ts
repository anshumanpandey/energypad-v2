import { Validator } from "express-json-validator-middleware";
import schema from "../types/Schema.json";

const { validate: requestValidator } = new Validator({ loadSchema: () => Promise.resolve(schema), validateSchema: true, inlineRefs: true });

export default requestValidator;