const keys = {
   accesskey: process.env.XMLTIME_ACCESS_KEY,
   secretkey: process.env.XMLTIME_SECRET_KEY
}
fetch(`https://api.xmltime.com/timeservice?version=3&prettyprint=1&accesskey=${keys.accesskey}&secretkey=${keys.secretkey}&placeid=norway/oslo&object=moon&types=meridian,phase`)
.then(res => {
   return res.json()
})
.then(res => {
   console.log(res)
})

/*
const crypto = require('crypto'); // https://nodejs.org/api/crypto.html
const axios = require("axios"); // 

const entrypoint = 'https://api.xmltime.com/';
const accesskey = process.env.XMLTIME_ACCESS_KEY;
const secretkey = process.env.XMLTIME_SECRET_KEY;

function servicecall(service, args) {
  const timestamp = new Date().toISOString();
  const message = `${accesskey}${service}${timestamp}`;
  const signature = crypto.createHmac('sha1', secretkey)
  .update(message)
  .digest('base64');
  Object.assign(args, {
    accesskey,
    timestamp,
    signature
  });

  const query = Object.keys(args)
  .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(args[key])}`)
  .join("&")

  const url = `${entrypoint}/${service}?${query}`
  return axios.get(url).then( (res) => res.data);
}

servicecall("timeservice", { "placeid": "norway/oslo", "out": "js", "version": 2} )
.then((res) => {
    console.log(JSON.stringify(res, '\t', 4));
})
.catch((e => {
    console.error(e);
}))*/

/*

const goodData = {
  data: [
    { fs: 'gas', use: 'heating', year: 2023, month: 1 },
    { fs: 'gas', use: 'heating', year: 2023, month: 2 },
  ],
  newData: [
    { fs: 'gas', use: 'heating', year: 2024, month: 1 },
    { fs: 'gas', use: 'heating', year: 2024, month: 2 },
  ],
};

const goodData2 = {
  data: [
    { fs: 'gas', use: 'cooling', year: 2023, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2023, month: 2 },
  ],
  newData: [
    { fs: 'gas', use: 'cooling', year: 2024, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2024, month: 2 },
  ],
};

const badData = {
  data: [
    { fs: 'gas', use: 'heating', year: 2023, month: 1 },
    { fs: 'gas', use: 'heating', year: 2023, month: 2 },
  ],
  newData: [
    { fs: 'gas', use: 'heating', year: 2024, month: 1 },
    { fs: 'petrol', use: 'heating', year: 2024, month: 2 },
  ],
};

const badData2 = {
  data: [
    { fs: 'gas', use: 'heating', year: 2023, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2023, month: 2 },
  ],
  newData: [
    { fs: 'gas', use: 'heating', year: 2024, month: 1 },
    { fs: 'gas', use: 'heating', year: 2024, month: 2 },
  ],
};

const badData3 = {
  data: [
    { fs: 'gas', use: 'cooling', year: 2023, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2023, month: 2 },
  ],
  newData: [
    { fs: 'gas', use: 'cooling', year: 2024, month: 1 },
    { fs: 'gas', use: 'heating', year: 2024, month: 2 },
  ],
};

const isFirstSheet = (oldData, newData) => {
  const all = oldData.concat(newData);

  const fuels = Array.from(new Set(all.map((i) => i.fs)));
  if (
    all.length !== 0 &&
    fuels.length === 1 &&
    (all.every((c) => c.use === 'heating') || all.every((c) => c.use === 'cooling'))
  ) {
    return true;
  }

  return false;
};

console.log(isFirstSheet(goodData.data, goodData.newData));
console.log(isFirstSheet(goodData2.data, goodData2.newData));
console.log(isFirstSheet(badData.data, badData.newData));
console.log(isFirstSheet(badData2.data, badData2.newData));
console.log(isFirstSheet(badData3.data, badData3.newData));

const isSecondSheet = (oldData, newData) => {
  const oldPowering = oldData.filter((c) => c.use === 'powering');
  const newPowering = newData.filter((c) => c.use === 'powering');

  if (oldPowering.length === 0 || newPowering.length === 0) {
    return false;
  }

  const validUses = ['heating', 'cooling'];
  for (let i = 0; i < validUses.length; i++) {
    const use = validUses[i];
    const oldRecords = oldData.filter((c) => c.use === use);
    const newRecords = newData.filter((c) => c.use === use);
    if (oldRecords.length !== 0 && newRecords.length !== 0) {
      return true;
    }
  }
  return false;
};

const secondGoodData = {
  data: [
    { fs: 'gas', use: 'heating', year: 2023, month: 1 },
    { fs: 'gas', use: 'lighting', year: 2023, month: 2 },
    { fs: 'gas', use: 'powering', year: 2023, month: 3 },
  ],
  newData: [
    { fs: 'gas', use: 'heating', year: 2024, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2024, month: 2 },
    { fs: 'gas', use: 'powering', year: 2024, month: 3 },
  ],
};

const secondGoodData2 = {
  data: [
    { fs: 'gas', use: 'lighting', year: 2023, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2023, month: 2 },
    { fs: 'gas', use: 'powering', year: 2023, month: 3 },
  ],
  newData: [
    { fs: 'gas', use: 'heating', year: 2024, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2024, month: 2 },
    { fs: 'gas', use: 'powering', year: 2024, month: 3 },
  ],
};

const secondBadData = {
  data: [
    { fs: 'gas', use: 'lighting', year: 2023, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2023, month: 2 },
    { fs: 'gas', use: 'powering', year: 2023, month: 3 },
  ],
  newData: [
    { fs: 'gas', use: 'heating', year: 2024, month: 1 },
    { fs: 'gas', use: 'lighting', year: 2024, month: 2 },
    { fs: 'gas', use: 'powering', year: 2024, month: 3 },
  ],
};

const secondBadData2 = {
  data: [
    { fs: 'gas', use: 'lighting', year: 2023, month: 1 },
    { fs: 'gas', use: 'cooling', year: 2023, month: 2 },
    { fs: 'gas', use: 'powering', year: 2023, month: 3 },
  ],
  newData: [
    { fs: 'gas', use: 'cooling', year: 2024, month: 1 },
    { fs: 'gas', use: 'lighting', year: 2024, month: 2 },
    { fs: 'gas', use: 'cooling', year: 2024, month: 3 },
  ],
};

console.log('-------------');
console.log(isSecondSheet(secondGoodData.data, secondGoodData.newData));
console.log(isSecondSheet(secondGoodData2.data, secondGoodData2.newData));
console.log(isSecondSheet(secondBadData.data, secondBadData.newData));
console.log(isSecondSheet(secondBadData2.data, secondBadData2.newData));
*/