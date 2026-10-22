import {isISODate, vietnamDate} from '../../shared/date.js';
import {validOrder, shopSummary, yearlySummary, monthlySummary, productGroup, GROUPS} from '../../shared/reporting.js';

const clean = value => String(value ?? '').trim();
function numberValue(value, fallback=NaN) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const input = clean(value).replace(/[₫đ\s]/gi, '');
  if (!input) return fallback;
  const normalized = input.includes(',') && input.includes('.')
    ? (input.lastIndexOf(',') > input.lastIndexOf('.') ? input.replace(/\./g,'').replace(',','.') : input.replace(/,/g,''))
    : input.replace(/[,.](?=\d{3}(\D|$))/g,'').replace(',','.');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : fallback;
}
export function sheetDate(value) {
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899,11,30) + Math.floor(value)*86400000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0,10) : '';
  }
  const input = clean(value);
  const match = input.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  if (isISODate(input)) return input;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input) && Number.isFinite(Date.parse(input))) return vietnamDate(new Date(input));
  return '';
}
function reader(headers, row) {
  return names => {
    for (const name of names) {
      // Preserve the existing last Số PO column preference, with a nonempty fallback.
      for (let i=headers.length-1; i>=0; i--) {
        if (clean(headers[i]).toLowerCase() === name.toLowerCase() && clean(row[i])) return row[i];
      }
    }
    return '';
  };
}

export function parseDashboard(poValues=[], trafficValues=[]) {
  const [headers=[], ...rows] = poValues;
  if (!['Đặt hàng','Số PO','Tên sản phẩm','Giá thực bán','SL'].every(name=>headers.some(h=>clean(h)===name))) {
    throw new Error('Invalid PO headers');
  }
  const orders = rows.map(row=>{
    const get = reader(headers,row);
    // PO range starts at A: index 2 is always physical column C, regardless of its header.
    const shop = row[2] == null ? '' : String(row[2]);
    const price = numberValue(get(['Giá thực bán']));
    const qty = numberValue(get(['SL']));
    return {date:sheetDate(get(['Đặt hàng'])), orderId:clean(get(['Số PO'])),
      product:clean(get(['Tên sản phẩm'])), productCode:clean(get(['ID Per'])),
      price, qty, revenue:price*qty, brand:clean(get(['BRAND'])) || 'Chưa phân loại',
      category:clean(get(['CAT'])) || 'Chưa phân loại', status:clean(get(['Trạng thái'])),
      platform:shop.trim() ? shop : 'Chưa xác định'};
  }).filter(validOrder);
  const [trafficHeaders=[], ...trafficRows] = trafficValues;
  const traffic = trafficRows.map(row=>{
    const get=reader(trafficHeaders,row);
    return {start:sheetDate(get(['Tuần bắt đầu'])),end:sheetDate(get(['Tuần kết thúc'])),scope:clean(get(['Phạm vi'])),
      visits:numberValue(get(['Visits']),0), buyers:numberValue(get(['Potential buyers']),0)};
  }).filter(row=>isISODate(row.start)&&isISODate(row.end)&&row.scope&&row.visits>=0&&row.buyers>=0&&(row.visits||row.buyers));
  const yearly = yearlySummary(orders);
  const otherRows = orders.filter(row=>productGroup(row.category)===GROUPS[3]).length;
  return {orders, traffic, updatedAt:new Date().toISOString(),
    reports:{shops:shopSummary(orders), yearly, monthly:yearly.map(({year})=>monthlySummary(orders,year))},
    warnings:[
      'Doanh thu được tính bằng Giá thực bán × SL. Ngày báo cáo theo múi giờ Việt Nam.',
      ...(rows.length>orders.length ? [`Đã bỏ qua ${rows.length-orders.length} dòng trống hoặc có ngày, mã đơn, sản phẩm, giá, số lượng không hợp lệ.`] : []),
      ...(!traffic.length ? ['Sheet TRAFFIC chưa có dữ liệu hợp lệ cho Visits/Potential buyers.'] : []),
      ...(otherRows ? [`${otherRows} dòng thuộc danh mục khác hoặc chưa được ánh xạ; doanh thu được giữ trong Khác / Chưa phân loại. Không suy đoán nhóm từ tên hoặc mã sản phẩm.`] : []),
      ...(orders.some(row=>row.platform==='Chưa xác định') ? ['Một số đơn hàng thiếu shop tại cột C.'] : []),
    ]};
}
