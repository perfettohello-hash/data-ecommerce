import {isISODate} from './date.js';

export const GROUPS = ['Máy pha cà phê', 'Cà phê', 'Hóa chất', 'Khác / Chưa phân loại'];
// Verified against CAT, product names, and ID Per in the PO sheet. No name/code guessing.
export function productGroup(category) {
  const mapping = new Map([
    ['Coffee maker', GROUPS[0]], ['Máy pha cà phê', GROUPS[0]],
    ['Coffee', GROUPS[1]], ['Cà phê', GROUPS[1]],
    ['Hygiene products', GROUPS[2]], ['Hóa chất', GROUPS[2]],
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
