import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDelimited,
  classifyProductType,
  parseSalesReport,
  aggregateSales,
  convertToUsd,
} from '../api/_lib/parsers.js';

test('parseDelimited handles TSV and quoting', () => {
  const tsv = 'Title\tUnits\tPrice\n"SmartKind\tPro"\t10\t4.99\nCho Con\t5\t2.99\n';
  const { headers, rows } = parseDelimited(tsv, '\t');
  assert.deepEqual(headers, ['Title', 'Units', 'Price']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'SmartKind\tPro');
  assert.equal(rows[0].units, '10');
  assert.equal(rows[1].title, 'Cho Con');
});

test('classifyProductType maps standard Apple IDs', () => {
  assert.equal(classifyProductType('1'), 'download');
  assert.equal(classifyProductType('1F'), 'download');
  assert.equal(classifyProductType('3'), 'redownload');
  assert.equal(classifyProductType('7'), 'update');
  assert.equal(classifyProductType('IA1'), 'iap');
  assert.equal(classifyProductType('IAY'), 'iap');
  assert.equal(classifyProductType('FI1'), 'iap');
});

test('parseSalesReport and aggregateSales sum proceeds correctly', () => {
  const sampleTsv = [
    'Provider\tProvider Country\tSKU\tDeveloper\tTitle\tVersion\tProduct Type Identifier\tUnits\tDeveloper Proceeds\tBegin Date\tEnd Date\tCustomer Currency\tCountry Code\tCurrency of Proceeds\tApple Identifier\tCustomer Price\tPromo Code\tParent Identifier\tSubscription\tPeriod',
    'ARCHONIC\tUS\tSK_PRO\tARCHONIC\tSmartKind Pro\t1.0\t1\t10\t2.80\t2026-10-20\t2026-10-20\tUSD\tUS\tUSD\t123456789\t3.99\t\t\t\t',
    'ARCHONIC\tUS\tCC_PREM\tARCHONIC\tCho Con Premium\t1.0\t1\t5\t2.10\t2026-10-20\t2026-10-20\tUSD\tUS\tUSD\t987654321\t2.99\t\t\t\t',
  ].join('\n');

  const rows = parseSalesReport(sampleTsv);
  assert.equal(rows.length, 2);

  const { byApp } = aggregateSales(rows);
  const sk = byApp.get('123456789');
  assert.ok(sk);
  assert.equal(sk.downloads, 10);
  assert.equal(sk.proceedsLocal.USD, 28.0);

  const cc = byApp.get('987654321');
  assert.ok(cc);
  assert.equal(cc.downloads, 5);
  assert.equal(cc.proceedsLocal.USD, 10.5);

  const fxRates = { USD: 1.0, EUR: 1.08 };
  const skUsd = convertToUsd(sk.proceedsLocal, fxRates);
  assert.equal(skUsd.usd, 28.0);
});
