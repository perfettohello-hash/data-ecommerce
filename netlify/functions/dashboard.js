import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const authFromEnv = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Thiếu biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
};
const clean = (v) => String(v ?? "").trim();
const num = (v) => {
  if (typeof v === "number") return v;
  const s = clean(v).replace(/[₫đ\s]/gi, "");
  if (!s) return 0;
  // Vietnamese exports use dot/comma as thousands/decimal separators inconsistently.
  const normalized = s.includes(",") && s.includes(".")
    ? (s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g,"").replace(",",".") : s.replace(/,/g,""))
    : s.replace(/[,.](?=\d{3}(\D|$))/g,"").replace(",",".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
const dateISO = (v) => {
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899,11,30) + v*86400000);
    return d.toISOString().slice(0,10);
  }
  const s = clean(v);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0,10) : "";
};
const rowsToObjects = (values, headerRow=0) => {
  if (!values?.length || values.length <= headerRow) return [];
  const headers = values[headerRow].map(clean);
  return values.slice(headerRow+1).map(row => Object.fromEntries(headers.map((h,i)=>[h, row[i] ?? ""])));
};
const pick = (o, names) => {
  const entries = Object.entries(o);
  for (const name of names) {
    const found = entries.find(([k]) => clean(k).toLowerCase() === name.toLowerCase());
    if (found) return found[1];
  }
  return "";
};

export default async (req) => {
  try {
    if (!SHEET_ID) return Response.json({error:"Thiếu GOOGLE_SHEET_ID"}, {status:500});
    const auth = authFromEnv();
    const sheets = google.sheets({version:"v4", auth});
    // PO: row 3 is the column header in the supplied CSV export; TRAFFIC: row 1.
    const [poRes, trafficRes] = await Promise.all([
      sheets.spreadsheets.values.get({spreadsheetId:SHEET_ID, range:"PO!A3:AL"}),
      sheets.spreadsheets.values.get({spreadsheetId:SHEET_ID, range:"TRAFFIC!A1:E"})
    ]);
    const po = rowsToObjects(poRes.data.values || []);
    const traffic = rowsToObjects(trafficRes.data.values || []);
    const orders = po.map((r) => {
      const orderDate = dateISO(pick(r,["Đặt hàng"]));
      const orderId = clean(pick(r,["Số PO"]));
      const product = clean(pick(r,["Tên sản phẩm"]));
      const price = num(pick(r,["Giá thực bán"]));
      const qty = num(pick(r,["SL"]));
      const brand = clean(pick(r,["BRAND"])) || "Chưa phân loại";
      const category = clean(pick(r,["CAT"])) || "Chưa phân loại";
      const status = clean(pick(r,["Trạng thái"]));
      // The supplied PO sheet does not yet expose an unambiguous platform column.
      const platform = clean(pick(r,["Platform","Nền tảng","Sàn bán","Kênh bán hàng"])) || "Chưa xác định";
      return {date:orderDate, orderId, product, price, qty, revenue:price*qty, brand, category, status, platform};
    }).filter(r => r.date && r.orderId && r.product && r.price >= 0 && r.qty > 0);
    const trafficRows = traffic.map(r=>({
      start:dateISO(pick(r,["Tuần bắt đầu"])),
      end:dateISO(pick(r,["Tuần kết thúc"])),
      scope:clean(pick(r,["Phạm vi"])),
      visits:num(pick(r,["Visits"])),
      buyers:num(pick(r,["Potential buyers"]))
    })).filter(r=>r.start && r.end && r.scope && (r.visits || r.buyers));
    return Response.json({orders, traffic:trafficRows, updatedAt:new Date().toISOString(), warnings:[
      "Doanh thu được tính bằng Giá thực bán × SL.",
      "Cần xác nhận cột nền tảng trong PO: hiện chưa xác định được cột nào thể hiện rõ tên sàn."
    ]}, {headers:{"Cache-Control":"no-store"}});
  } catch (e) {
    return Response.json({error:"Không tải được dữ liệu Google Sheets", detail:e.message}, {status:500});
  }
};
