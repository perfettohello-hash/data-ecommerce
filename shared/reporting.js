import {isISODate, weekStart} from './date.js';

export const GROUPS = ['Coffee Maker', 'Coffee', 'Hygiene Products', 'Other / Unclassified'];
// Verified against CAT, product names, and ID Per in the PO sheet. No name/code guessing.
export function productGroup(category) {
  const mapping = new Map([
    ['Coffee maker', GROUPS[0]], ['Coffee Maker', GROUPS[0]], ['Máy pha cà phê', GROUPS[0]],
    ['Coffee', GROUPS[1]], ['Cà phê', GROUPS[1]],
    ['Hygiene products', GROUPS[2]], ['Hygiene Products', GROUPS[2]], ['Hóa chất', GROUPS[2]],
  ]);
  return mapping.get(category) || GROUPS[3];
}

export function validOrder(row) {
  return !!row && isISODate(row.date) && typeof row.orderId === 'string' && !!row.orderId.trim()
    && typeof row.product === 'string' && !!row.product.trim()
    && ['platform', 'brand', 'category', 'productCode'].every(key => typeof row[key] === 'string')
    && Number.isFinite(row.price) && row.price >= 0 && Number.isFinite(row.qty) && row.qty > 0
    && Number.isFinite(row.price * row.qty);
}

export function filterDimensions(orders, {platform='all', brand='all', category='all'} = {}) {
  return orders.filter(row => (platform === 'all' || row.platform === platform)
    && (brand === 'all' || row.brand === brand) && (category === 'all' || row.category === category));
}

export function monthlySummary(orders, year) {
  const months = Array.from({length:12}, (_, index) => ({month:index+1, revenue:0, qty:0, ids:new Set()}));
  const ids = new Set();
  for (const row of orders) {
    if (!isISODate(row.date) || Number(row.date.slice(0,4)) !== Number(year)) continue;
    const month = months[Number(row.date.slice(5,7))-1];
    month.revenue += row.price * row.qty;
    month.qty += row.qty;
    month.ids.add(row.orderId);
    ids.add(row.orderId);
  }
  return {
    year:Number(year),
    months:months.map(({ids, ...month}) => ({...month, orders:ids.size})),
    total:{revenue:months.reduce((sum,m)=>sum+m.revenue,0), qty:months.reduce((sum,m)=>sum+m.qty,0), orders:ids.size},
  };
}

export function yearlySummary(orders, availableYears = []) {
  const years = new Map(availableYears.map(year => [year, {year, categories:Object.fromEntries(GROUPS.map(group=>[group,0])), revenue:0}]));
  for (const row of orders) {
    if (!isISODate(row.date)) continue;
    const year = Number(row.date.slice(0,4));
    if (!years.has(year)) years.set(year, {year, categories:Object.fromEntries(GROUPS.map(group=>[group,0])), revenue:0});
    const result = years.get(year);
    result.categories[productGroup(row.category)] += row.price * row.qty;
  }
  for (const result of years.values()) result.revenue = GROUPS.reduce((sum,group)=>sum+result.categories[group],0);
  return [...years.values()].sort((a,b)=>a.year-b.year);
}

export function shopSummary(orders) {
  const shops = new Map();
  for (const row of orders) shops.set(row.platform, (shops.get(row.platform)||0)+row.price*row.qty);
  return [...shops].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
}

// Display labels only; source shop names are never translated.
export function categoryLabel(value) {
  const main = productGroup(value);
  if (main !== GROUPS[3]) return main;
  const labels = new Map([
    ['Components / Other','Components / Other'], ['Accessory','Accessories'], ['Accessories','Accessories'],
    ['Tea','Tea'], ['Coffee grinder','Coffee Grinder'], ['Coffee Grinder','Coffee Grinder'],
    ['Air fryer','Air Fryer'], ['Air Fryer','Air Fryer'], ['Toaster','Toaster'],
    ['Oil heater','Oil Heater'], ['Oil Heater','Oil Heater'], ['Electric kettle','Electric Kettle'], ['Electric Kettle','Electric Kettle'],
    ['Mixer','Mixer'], ['Milk frother','Milk Frother'], ['Milk Frother','Milk Frother'],
    ['Blender','Blender'], ['Egg beater','Egg Beater'], ['Egg Beater','Egg Beater'],
  ]);
  return labels.get(value) || GROUPS[3];
}

export function inReportPeriod(value, period, selectedDate) {
  if (!isISODate(value)) return false;
  if (period === 'all') return true;
  if (!isISODate(selectedDate)) return false;
  if (period === 'year') return value.slice(0,4) === selectedDate.slice(0,4);
  if (period === 'month') return value.slice(0,7) === selectedDate.slice(0,7);
  return weekStart(value) === weekStart(selectedDate);
}

export function monthlyMatrix(orders, years, group) {
  const rows = group ? orders.filter(row=>productGroup(row.category)===group) : orders;
  return [...years].sort((a,b)=>a-b).map(year=>monthlySummary(rows, year));
}
