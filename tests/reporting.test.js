import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDashboard, sheetDate} from '../netlify/lib/dashboard-data.js';
import {dashboardResponse} from '../netlify/functions/dashboard.js';
import {monthlySummary, yearlySummary, filterDimensions, GROUPS, productGroup, categoryLabel, monthlyMatrix, inReportPeriod} from '../shared/reporting.js';

const shops=['SHOPEE DLH','SHOPEE PFT','SHOPEE KW','SHOPEE Nutri','SHOPEE Cimbali','LZD PFT-Mall','LZD PFT','LZD DLH','Tiki PFT','Tiki DLH','TikTok PFT','TikTok Delonghi','PERFETTO','LZD NUTRI'];
// Duplicate Số PO headers and a misleading header at C mirror the live sheet structure.
const headers=['Xử lý','Đặt hàng','PFT ID','Platform','Số PO','Số PO','ID Per','Sàn ID','Tên sản phẩm','STOCK','Giá thực bán','SL','CAT','BRAND'];
const row=({date='2026-01-15',shop='SHOPEE PFT',id='order-a',price=100,qty=2,category='Coffee maker',product='Product',code='SKU-1'}={})=>['',date,shop,'Wrong guessed channel','',id,code,'',product,'',price,qty,category,'Brand'];
const parse=rows=>parseDashboard([headers,...rows],[]).orders;

test('API maps exact shop names from physical column C and groups revenue separately',async()=>{
 const values=[headers,...shops.map((shop,index)=>row({shop,id:`order-${index}`,price:index+1,qty:2})),row({shop:'',id:'empty'}),row({shop:'  SHOPEE PFT  ',id:'spaces',price:7})];
 const response=await dashboardResponse(async()=>({poValues:values,trafficValues:[]}));
 assert.equal(response.status,200);
 const body=await response.json();
 assert.deepEqual(body.orders.slice(0,shops.length).map(r=>r.platform),shops);
 for(const [index,shop] of shops.entries())assert.equal(body.reports.shops.find(group=>group.name===shop).value,(index+1)*2);
 assert.equal(body.orders.at(-2).platform,'Unidentified');
 assert.equal(body.orders.at(-1).platform,'  SHOPEE PFT  ');
 assert.equal(body.reports.shops.find(group=>group.name==='  SHOPEE PFT  ').value,14);
});

test('monthly summary includes 12 months, line revenue, quantities and distinct order IDs',()=>{
 const orders=parse([row(),row({price:50,qty:3}),row({date:'2026-02-01',price:40,qty:1}),row({date:'2025-12-31',id:'previous-year',price:999})]);
 const summary=monthlySummary(orders,2026);
 assert.equal(summary.months.length,12);
 assert.deepEqual(summary.months[0],{month:1,revenue:350,qty:5,orders:1});
 assert.deepEqual(summary.months[1],{month:2,revenue:40,qty:1,orders:1});
 assert.deepEqual(summary.months[11],{month:12,revenue:0,qty:0,orders:0});
 assert.deepEqual(summary.total,{revenue:390,qty:6,orders:1});
 assert.equal(monthlySummary(orders,2024).total.revenue,0);
 assert.deepEqual(yearlySummary([], [2025,2026]).map(row=>row.revenue),[0,0]);
});

test('yearly categories reconcile and never guess from product names or codes',()=>{
 const orders=parse([row(),row({category:'Coffee',price:20}),row({category:'Hygiene products',price:30}),row({category:'Coffee grinder',price:40}),row({category:'',product:'Máy pha cà phê',code:'COFFEE-MACHINE',price:50}),row({category:'Unknown',price:60}),row({date:'2025-12-31',price:70})]);
 const years=yearlySummary(orders);
 assert.deepEqual(years.map(y=>y.year),[2025,2026]);
 assert.deepEqual(years[1].categories,{'Coffee Maker':200,'Coffee':40,'Hygiene Products':60,'Other / Unclassified':300});
 for(const result of years){assert.equal(GROUPS.reduce((sum,key)=>sum+result.categories[key],0),result.revenue);assert.equal(monthlySummary(orders,result.year).total.revenue,result.revenue);}
 assert.equal(productGroup('Accessory'),GROUPS[3]);assert.equal(productGroup(''),GROUPS[3]);
 const payload=parseDashboard([headers,...[row({category:''}),row({category:'Unmatched'})]],[]);
 assert(payload.warnings.some(w=>w.includes('2 order lines are in Other / Unclassified')));
});

test('dimension filters apply to full-year rows without a weekly/monthly restriction',()=>{
 const orders=parse([row(),row({date:'2026-12-31'}),row({shop:'PERFETTO',price:999})]);
 assert.equal(monthlySummary(filterDimensions(orders,{platform:'SHOPEE PFT'}),2026).total.revenue,400);
});

test('invalid dates, missing or negative prices and invalid quantities are excluded; explicit free items remain',()=>{
 const orders=parse([row({date:'2026-02-30'}),row({price:''}),row({price:'bad'}),row({price:-1}),row({qty:0}),row({qty:Infinity}),row({price:0}),row({price:'1.200.000',qty:1})]);
 assert.equal(orders.length,2);assert.equal(orders[0].revenue,0);assert.equal(orders[1].revenue,1200000);
});

test('Vietnam date boundaries preserve sheet dates and convert timestamp instants',()=>{
 assert.equal(sheetDate('2025-12-31T18:00:00Z'),'2026-01-01');
 assert.equal(sheetDate('2026-01-01T00:00:00+07:00'),'2026-01-01');
 assert.equal(sheetDate('31/12/2025'),'2025-12-31');
 assert.equal(sheetDate(46023),'2026-01-01');
});

test('API failures and header changes return safe JSON without upstream detail',async()=>{
 for(const read of [async()=>{throw new Error('Sensitive upstream detail')},async()=>({poValues:[['unexpected']],trafficValues:[]})]){
  const response=await dashboardResponse(read);assert.equal(response.status,502);const body=await response.json();assert.equal(typeof body.error,'string');assert.equal(JSON.stringify(body).includes('Sensitive'),false);assert.equal(body.detail,undefined);
 }
});


test('horizontal monthly matrices keep all years and twelve months with reconciled categories',()=>{
 const orders=parse([row({date:'2025-12-31',price:10}),row({price:20}),row({category:'Coffee',price:30}),row({category:'Hygiene products',price:40}),row({category:'Unknown',price:50})]);
 const years=[2025,2026];
 const overall=monthlyMatrix(orders,years);
 assert.deepEqual(overall.map(row=>row.year),years);
 assert.equal(overall[0].months[11].revenue,20);
 assert.equal(overall[0].months[0].revenue,0);
 for(const year of years){
  const total=overall.find(row=>row.year===year);
  const groups=GROUPS.map(group=>monthlyMatrix(orders,years,group).find(row=>row.year===year));
  for(let month=0;month<12;month++)assert.equal(groups.reduce((sum,row)=>sum+row.months[month].revenue,0),total.months[month].revenue);
  assert.equal(groups.reduce((sum,row)=>sum+row.total.revenue,0),total.total.revenue);
 }
});

test('all reports share week, month, year and all-dates filters while keeping year rows',()=>{
 const orders=parse([row({date:'2025-12-31'}),row({date:'2026-01-01'}),row({date:'2026-02-01'})]);
 assert.equal(orders.filter(row=>inReportPeriod(row.date,'week','2026-01-01')).length,2);
 assert.equal(orders.filter(row=>inReportPeriod(row.date,'month','2026-01-01')).length,1);
 assert.equal(orders.filter(row=>inReportPeriod(row.date,'year','2026-01-01')).length,2);
 assert.equal(orders.filter(row=>inReportPeriod(row.date,'all','')).length,3);
 const matrix=monthlyMatrix(orders.filter(row=>inReportPeriod(row.date,'month','2026-01-01')),[2025,2026]);
 assert.equal(matrix[0].total.revenue,0);
 assert.equal(matrix[1].total.revenue,200);
 assert.equal(inReportPeriod('invalid','all',''),false);
});

test('display categories and API warnings use English without guessing category groups',()=>{
 assert.equal(categoryLabel('Máy pha cà phê'),'Coffee Maker');
 assert.equal(categoryLabel('Cà phê'),'Coffee');
 assert.equal(categoryLabel('Hóa chất'),'Hygiene Products');
 assert.equal(categoryLabel('Chưa phân loại'),'Other / Unclassified');
 assert.equal(categoryLabel('Coffee grinder'),'Coffee Grinder');
 assert.equal(categoryLabel('Unverified product group'),'Other / Unclassified');
 const data=parseDashboard([headers,row({shop:'',category:''}),row({date:'invalid'})],[]);
 assert.equal(data.orders[0].platform,'Unidentified');
 assert(data.warnings.every(w=>!/[\u0300-\u036fđĐ]/u.test(w.normalize('NFD'))));
 assert.deepEqual(Object.keys(data.reports.yearly[0].categories),GROUPS);
});
