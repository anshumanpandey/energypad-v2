export const getRecordId = (r: { id: number }) => r.id;

export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const sortByProp = (prop: string, order: 'asc' | 'desc') => (a: any, b: any) => {
  if (order === 'desc') {
    return b[prop].toString().localeCompare(a[prop].toString());
  }
  return a[prop].toString().localeCompare(b[prop].toString());
};

export const agroupByDate = (arr: { date: string }[]) => {
  const map = new Map();
  arr.forEach((i) => {
    const key = i.date;
    const found = map.get(key);
    if (found) {
      found.push(i);
      map.set(key, found);
    } else {
      map.set(key, [i]);
    }
  });
  return Array.from(map.values());
};

export const agroupBy = <T>(arr: T[], k: keyof T) => {
  const map = new Map();
  arr.forEach((i) => {
    const key = i[k];
    const found = map.get(key);
    if (found) {
      found.push(i);
      map.set(key, found);
    } else {
      map.set(key, [i]);
    }
  });
  return Array.from(map.values());
};
