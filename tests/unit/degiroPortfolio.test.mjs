import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioView, parseTransactionsCsv } from '../../src/lib/degiro/portfolio.js';

const csv = [
  'Datum,Tijd,Product,ISIN,Beurs,Uitvoeringsplaats,Aantal,Koers,,Lokale waarde,,Waarde EUR,Wisselkoers,AutoFX Kosten,Transactiekosten en/of kosten van derden EUR,Totaal EUR,Order ID,',
  '11-05-2026,18:52,MICRON TECHNOLOGY INC,US5951121038,NDQ,JNST,-4,"794,7900",USD,"3179,16",USD,"2699,94","1,1775","-6,75","-2,00","2691,19",,c392da2b-0698-4286-b0d4-c5281af43253',
  '22-01-2026,13:57,ISHARES PHYSICAL GOLD ETC,IE00B4ND3602,TDG,XGAT,1,"80,0100",EUR,"-80,01",EUR,"-80,01",,"0,00","-1,00","-81,01",,13ea1dae-b337-4485-a0c8-ae110c0421bc',
  '22-01-2026,13:18,ISHARES PHYSICAL SILVER ETC,IE00B4NCWG09,TDG,XGAT,6,"76,0458",EUR,"-456,27",EUR,"-456,27",,"0,00","-1,00","-457,27",,8a4ce3e5-3fb0-434b-8941-f88fbd27390b',
  '26-11-2025,14:29,SIF HOLDING NV,NL0011660485,EAM,XAMS,-1,"6,2500",EUR,"6,25",EUR,"6,25",,"0,00","-3,00","3,25",,4164f178-bc00-4535-9c66-f7268cb08af5',
  '18-11-2025,10:13,VANGUARD S&P 500 UCITS ETF USD DIS,IE00B3XXRP09,TDG,XGAT,2,"108,9140",EUR,"-217,83",EUR,"-217,83",,"0,00","-1,00","-218,83",,142d3933-a3af-4072-abfa-e64444ad55be',
  '17-11-2025,09:04,ISHARES CORE MSCI WORLD UCITS ETF USD (ACC),IE00B4L5Y983,EAM,XAMS,-1,"110,4700",EUR,"110,47",EUR,"110,47",,"0,00","-3,00","107,47",,c43315d5-e1bb-414a-8167-4aee048d99ec',
  '17-11-2025,09:04,VANECK WORLD EQUAL WEIGHT SCREENED UCITS ETF,NL0010408704,EAM,XAMS,-4,"36,2800",EUR,"145,12",EUR,"145,12",,"0,00","-3,00","142,12",,d375cd00-5edb-4fee-96a9-d2b1f928cf2d'
].join('\n');

test('parses Degiro CSV rows', () => {
  const parsed = parseTransactionsCsv(csv);
  assert.equal(parsed.transactions.length, 7);
  assert.equal(parsed.byAsset.length, 7);
  assert.equal(parsed.transactions[0].product, 'ISHARES CORE MSCI WORLD UCITS ETF USD (ACC)');
  assert.equal(parsed.transactions.at(-1).product, 'MICRON TECHNOLOGY INC');
});

test('builds holdings and summary metrics', () => {
  const portfolio = buildPortfolioView({
    csvText: csv,
    currentPrices: {
      US5951121038: 800,
      IE00B4ND3602: 82,
      IE00B4NCWG09: 78,
      NL0011660485: 7,
      IE00B3XXRP09: 110,
      IE00B4L5Y983: 120,
      NL0010408704: 37
    }
  });

  assert.equal(portfolio.summary.transactionCount, 7);
  assert.equal(portfolio.holdings.find((item) => item.isin === 'IE00B4NCWG09').quantity, 6);
  assert.notEqual(portfolio.metrics.totalValue, 0);
  assert.ok(portfolio.metrics.totalPnl !== 0);
});
