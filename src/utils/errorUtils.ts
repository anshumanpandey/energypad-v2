import { ApiError } from '../lib/ApiError';

export const isErrorInstance = (i: unknown): i is ApiError => {
  return i instanceof ApiError;
};
