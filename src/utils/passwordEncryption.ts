import { genSalt, hash, compare } from 'bcrypt';

export const encryptPassword = async (password: string) => {
  const salt = await genSalt(10);
  const hashValue = await hash(password, salt);
  return hashValue;
};

export const validPassword = (password: string, encrypted: string) => {
  return compare(password, encrypted);
};
