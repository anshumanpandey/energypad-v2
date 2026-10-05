export type WastePreview = {
  year: number;
  years: number[];
  drivers: string[];
  method: string;
  weather?: { required: boolean; ready: boolean; throughMonth?: string };
  meters: {
    id: string;
    name: string;
    fuel: string;
    issues: string[];
    downloadable: boolean;
    baselineSource?: { id: string; name: string; fuel: string; endUse: string };
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
