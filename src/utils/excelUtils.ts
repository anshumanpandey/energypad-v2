import { parse } from 'date-fns';

export const excelDateToDate = (d: string) => {
  //Fri Jan 31 2020 20:00:00 GMT-0400 (COUNTRY Time)
  const dateTrimmed = d.slice(0, 24); //Fri Jan 31 2020 20:00:00

  const date = parse(dateTrimmed, `E LLL d yyyy HH:mm:ss`, new Date());
  return date;
};
