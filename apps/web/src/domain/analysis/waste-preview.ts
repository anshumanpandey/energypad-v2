export type WastePreview = {
  year: number;
  years: number[];
  drivers: string[];
  method: string;
  meters: {
    id: string;
    name: string;
    fuel: string;
    issues: string[];
    downloadable: boolean;
    rows: {
      month: string;
      actual: number | null;
      expected: number | null;
      adjusted: number | null;
      variance: number | null;
      cost: number | null;
      note: string;
    }[];
  }[];
};
