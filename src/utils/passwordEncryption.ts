import { genSalt, hash, compare } from 'bcrypt';

export const encryptPassword = async (password: string) => {
  const salt = await genSalt(10);
  const hashValue = await hash(password, salt);
  return hashValue;
};

export const validPassword = async (password: string, hash: string) => {
  return compare(password, hash);
};
