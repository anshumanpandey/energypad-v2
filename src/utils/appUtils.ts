export const getRecordId = (r: { id: number }) => r.id;

export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const sortByProp = (prop: string, order: 'asc' | 'desc') => (a: any, b: any) => {
  if (order === 'desc') {
    return b[prop].localeCompare(a[prop]);
  }
  return a[prop].localeCompare(b[prop]);
};
