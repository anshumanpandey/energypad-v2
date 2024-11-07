import { randomBytes, createHmac } from 'crypto';
import axios from 'axios';
import { ApiError } from '@lib';
import { formatISO } from 'date-fns';
import { DbUtils, ErrorUtils, MathUtils } from '@utils';

const accountKey = 'test-test-test';
const securityKey = 'test-test-test-test-test-test-test-test-test-test-test-test-test';
// You can call the API over HTTP using http://apiv1.degreedays.net/json or
// over HTTPS using https://apiv1.degreedays.net/json - set the endpoint URL
// below as appropriate.
const endpoint = 'http://apiv1.degreedays.net/json';

const makeRequest = (locationDataRequest: any, siteId: number) => {
  const fullRequest = {
    securityInfo: {
      endpoint: endpoint,
      accountKey: accountKey,
      timestamp: formatISO(new Date()),
      random: Buffer.from(randomBytes(12)).toString('hex'),
    },
    request: locationDataRequest,
  };
  const fullRequestJson = JSON.stringify(fullRequest);
  const signatureBytes = createHmac('sha256', securityKey).update(fullRequestJson).digest();

  function base64urlEncode(unencoded: string | Buffer) {
    return Buffer.from(unencoded).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  return axios
    .request<GreenData>({
      url: endpoint,
      method: 'POST',
      data:
        'request_encoding=base64url' +
        '&signature_method=HmacSHA256' +
        '&signature_encoding=base64url' +
        '&encoded_request=' +
        base64urlEncode(fullRequestJson) +
        '&encoded_signature=' +
        base64urlEncode(signatureBytes),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    })
    .then(handleResponse(fullRequest.request.dataSpecs.myHDD.breakdown.dayRanges, siteId));
};
let SEED = 1;
function random() {
    const x = Math.sin(SEED ++) * 10000;
    return Math.trunc((x - Math.floor(x)) * 10000);
}
const handleResponse =
  (a: any[], siteId: number) =>
  ({ data }: { data: GreenData }): HDDRecord[] | ApiError => {
    const response = data.response;
    if (response.type === 'Failure') {
      const kinds = ['CDD', 'HDD'] as const;

      const records: HDDRecord[] = [];
      for (let k = 0; k < kinds.length; k++) {
        for (let i = 0; i < a.length; i++) {
          const kind = kinds[k];
          const _ = a[i];
          records.push({
            date: DbUtils.stringDateToDate(_.first),
            //value: Math.floor(Math.random() * 60) + 10,
            value: random(),
            siteId,
            kind,
          });
          IDX++;
        }
      }
      return records;
      //TODO: remove line below when deploy
      //return new ApiError(response.message);
    }

    const reducedData: HDDRecord[] = [];

    const hddData = response.dataSets.myHDD;
    const cddData = response.dataSets.myCDD;

    if (hddData.type === 'Failure') {
      return new ApiError(hddData.message);
    } else {
      for (let i = 0; i < hddData.values.length; i++) {
        const v = hddData.values[i];
        const dateUnits = v.d.split('-').map(MathUtils.toInt);
        const item = { date: new Date(dateUnits[0], dateUnits[1] - 1, 1), value: v.v, siteId, kind: 'HDD' as const };
        reducedData.push(item);
      }
    }

    if (cddData.type === 'Failure') {
      return new ApiError(cddData.message);
    } else {
      for (let i = 0; i < cddData.values.length; i++) {
        const v = cddData.values[i];
        const dateUnits = v.d.split('-').map(MathUtils.toInt);
        const item = { date: new Date(dateUnits[0], dateUnits[1] - 1, 1), value: v.v, siteId, kind: 'CDD' as const };
        reducedData.push(item);
      }
    }
    return reducedData;
  };

type DateRange = {
  startDate: string;
  endDate: string;
  siteId: number;
};

const dateRangeToBreakdownRange = (i: DateRange) => {
  return {
    first: i.startDate,
    last: i.endDate,
  };
};

type GetHddsParams = {
  postalCode: string;
  breakDowns: DateRange[];
  valuesToGet: ('HDD' | 'CDD')[];
};

export type HDDRecord = {
  date: Date;
  value: number;
  siteId: number;
  kind: 'HDD' | 'CDD';
};

export const isHdd = (r: HDDRecord) => {
  return r.kind === 'HDD';
};

export const isCdd = (r: HDDRecord) => {
  return r.kind === 'CDD';
};

const getHdds = (p: GetHddsParams) => {
  const location = {
    type: 'PostalCodeLocation',
    //TODO: uncomment this code after testing
    //postalCode: p.postalCode,
    postalCode: '02632',
    countryCode: 'US',
  };

  const sitesId = Array.from(new Set(p.breakDowns.map((i) => i.siteId)).values());

  const groupBySite = (ranges: DateRange[]) => {
    const table = [];
    for (let i = 0; i < sitesId.length; i++) {
      const el = sitesId[i];
      const rowElements = {
        siteId: el,
        breakDowns: ranges.filter((i) => i.siteId === el),
      };
      table.push(rowElements);
    }
    return table;
  };

  const toIterate = groupBySite(p.breakDowns);

  const promises = [];

  for (let i = 0; i < toIterate.length; i++) {
    const el = toIterate[i];

    const breakdown = {
      type: 'CustomBreakdown',
      dayRanges: el.breakDowns.map(dateRangeToBreakdownRange),
    };

    const locationDataRequest = {
      type: 'LocationDataRequest',
      location: location,
      dataSpecs: {} as Record<string, any>,
    };
    if (p.valuesToGet.includes('HDD')) {
      locationDataRequest.dataSpecs.myHDD = {
        type: 'DatedDataSpec',
        calculation: {
          type: 'HeatingDegreeDaysCalculation',
          baseTemperature: {
            unit: 'C',
            value: 60,
          },
        },
        breakdown: breakdown,
      };
    }
    if (p.valuesToGet.includes('CDD')) {
      locationDataRequest.dataSpecs.myCDD = {
        type: 'DatedDataSpec',
        calculation: {
          type: 'CoolingDegreeDaysCalculation',
          baseTemperature: {
            unit: 'C',
            value: 60,
          },
        },
        breakdown: breakdown,
      };
    }

    promises.push(makeRequest(locationDataRequest, el.siteId));
  }

  return Promise.all(promises).then((results) => {
    const errorFound = results.find(ErrorUtils.isErrorInstance);
    if (errorFound) {
      return errorFound;
    }
    return results.flatMap((f) => (ErrorUtils.isErrorInstance(f) ? [] : f));
  });
};

export type GetHddsParams2 = {
  temperature: number;
  postalCode: string;
  siteId: number;
  breakDowns: DateRange[];
  valuesToGet: ('HDD' | 'CDD')[];
};
const getHdds2 = async (params: GetHddsParams2[]) => {
  const promises = [];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];

    const location = {
      type: 'PostalCodeLocation',
      //TODO: uncomment this code after testing
      //postalCode: p.postalCode,
      postalCode: '02632',
      countryCode: 'GB',
    };

    const locationDataRequest = {
      type: 'LocationDataRequest',
      location: location,
      dataSpecs: {} as Record<string, any>,
    };

    const breaks = new Map();
    for (let i = 0; i < p.breakDowns.length; i++) {
      const item = p.breakDowns[i];
      breaks.set(item.startDate, item);
    }

    const breakdown = {
      type: 'CustomBreakdown',
      dayRanges: Array.from(breaks.values()).map(dateRangeToBreakdownRange),
    };

    if (p.valuesToGet.includes('HDD')) {
      locationDataRequest.dataSpecs.myHDD = {
        type: 'DatedDataSpec',
        calculation: {
          type: 'HeatingDegreeDaysCalculation',
          baseTemperature: {
            unit: 'C',
            value: p.temperature,
          },
        },
        breakdown: breakdown,
      };
    }
    if (p.valuesToGet.includes('CDD')) {
      locationDataRequest.dataSpecs.myCDD = {
        type: 'DatedDataSpec',
        calculation: {
          type: 'CoolingDegreeDaysCalculation',
          baseTemperature: {
            unit: 'C',
            value: p.temperature,
          },
        },
        breakdown: breakdown,
      };
    }
    promises.push(makeRequest(locationDataRequest, p.siteId));
  }
  SEED = 1;
  return Promise.all(promises).then((results) => {
    const errorFound = results.find(ErrorUtils.isErrorInstance);
    if (errorFound) {
      return errorFound;
    }
    return results.flatMap((f) => (ErrorUtils.isErrorInstance(f) ? [] : f));
  });
};

export default { getHdds, getHdds2 };

export interface GreenData {
  metadata: Metadata;
  response: Response | Failure;
}

export interface Metadata {
  rateLimit: RateLimit;
}

export interface RateLimit {
  requestUnitsAvailable: number;
  minutesToReset: number;
}

export interface Failure {
  type: 'Failure';
  message: string;
}

export interface Response {
  type: 'LocationDataResponse';
  stationId: string;
  targetLongLat: LongLat;
  sources: Source[];
  dataSets: DataSets;
}

export interface DataSets {
  myHDD: My | Failure;
  myCDD: My | Failure;
}

export interface My {
  type: 'DatedDataSet';
  percentageEstimated: number;
  values: Value[];
}

export interface Value {
  d: string;
  v: number;
  pe?: number;
}

export interface Source {
  station: Station;
  metresFromTarget: number;
}

export interface Station {
  id: string;
  longLat: LongLat;
  elevationMetres: number;
  displayName: string;
}

export interface LongLat {
  longitude: number;
  latitude: number;
}
