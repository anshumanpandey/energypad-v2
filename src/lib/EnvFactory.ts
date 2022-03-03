import { GlobalEnv } from '@lib';

const EnvFactory = <T>(p: { test: T; fallback: T }) => {
  return GlobalEnv.isTest ? p.test : p.fallback;
};

export default EnvFactory;
