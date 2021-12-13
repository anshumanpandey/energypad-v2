export const getSinglePropArr = <T>(p: { arr: T[]; prop: keyof T }) => p.arr.map((i) => i[p.prop]);
