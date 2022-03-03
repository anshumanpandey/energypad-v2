import { randomBytes, createHmac } from 'crypto';
import axios from 'axios';
import { ApiError } from '@lib';
import { formatISO } from 'date-fns';

const accountKey = 'test-test-test';
const securityKey = 'test-test-test-test-test-test-test-test-test-test-test-test-test';
// You can call the API over HTTP using http://apiv1.degreedays.net/json or
// over HTTPS using https://apiv1.degreedays.net/json - set the endpoint URL
// below as appropriate.
const endpoint = 'http://apiv1.degreedays.net/json';

const toInt = (i: string) => parseInt(i, 10);

const makeRequest = (locationDataRequest: any) => {
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
    .then(handleResponse);
};
function handleResponse({ data }: { data: GreenData }) {
  const response = data.response;
  if (response.type === 'Failure') {
    return new ApiError(response.message);
  }

  const reducedData: HDDRecord[] = [];

  const mapFn = (v: Value) => {
    const dateUnits = v.d.split('-').map(toInt);
    const item = { date: new Date(dateUnits[0], dateUnits[1] - 1, 1), value: v.v };
    reducedData.push(item);
  };
  const hddData = response.dataSets.myHDD;

  if (hddData.type === 'Failure') {
    return new ApiError(hddData.type);
  } else {
    hddData.values.map(mapFn);
  }

  return reducedData;
}

type DateRange = {
  startDate: string;
  endDate: string;
};

type GetHddsParams = {
  postalCode: string;
  breakDowns: DateRange[];
  valuesToGet: ('HDD' | 'CDD')[];
};

export type HDDRecord = {
  date: Date;
  value: number;
};

const getHdds = (p: GetHddsParams) => {
  const location = {
    type: 'PostalCodeLocation',
    postalCode: p.postalCode,
    countryCode: 'US',
  };

  const mapDateReanges = (i: DateRange) => {
    return {
      first: i.startDate,
      last: i.endDate,
    };
  };

  const breakdown = {
    type: 'CustomBreakdown',
    dayRanges: p.breakDowns.map(mapDateReanges),
  };

  const locationDataRequest = {
    type: 'LocationDataRequest',
    location: location,
    dataSpecs: {},
  };
  if (p.valuesToGet.includes('HDD')) {
    locationDataRequest.dataSpecs = {
      myHDD: {
        type: 'DatedDataSpec',
        calculation: {
          type: 'HeatingDegreeDaysCalculation',
          baseTemperature: {
            unit: 'C',
            value: 60,
          },
        },
        breakdown: breakdown,
      },
    };
  }
  if (p.valuesToGet.includes('CDD')) {
    locationDataRequest.dataSpecs = {
      myCDD: {
        type: 'DatedDataSpec',
        calculation: {
          type: 'CoolingDegreeDaysCalculation',
          baseTemperature: {
            unit: 'C',
            value: 60,
          },
        },
        breakdown: breakdown,
      },
    };
  }

  return makeRequest(locationDataRequest);
};

export default { getHdds };

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
  myHDD: My;
  myCDD: My;
}

export interface My {
  type: string;
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
