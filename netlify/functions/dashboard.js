import { google } from "googleapis";
import { parseDashboard } from "../lib/dashboard-data.js";

const authFromEnv = () => {
  const raw = Netlify.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Thiếu biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON");
  return new google.auth.GoogleAuth({
    credentials: parseCredentials(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });
};
function parseCredentials(raw) {
  try {
    const credentials = JSON.parse(raw);
    if (!credentials.client_email || !credentials.private_key) throw new Error();
    return credentials;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON không hợp lệ. Kiểm tra cấu hình phía máy chủ.");
  }
}
async function readGoogleSheets() {
    const SHEET_ID = Netlify.env.get("GOOGLE_SHEET_ID");
    if (!SHEET_ID) throw new Error("Missing sheet configuration");
    const auth = authFromEnv();
    const sheets = google.sheets({version:"v4", auth});
    // PO: row 3 is the column header in the supplied CSV export; TRAFFIC: row 1.
    const [poRes, trafficRes] = await Promise.all([
      sheets.spreadsheets.values.get({spreadsheetId:SHEET_ID, range:"PO!A3:AL", valueRenderOption:"UNFORMATTED_VALUE", dateTimeRenderOption:"SERIAL_NUMBER"}, {timeout:20000}),
      sheets.spreadsheets.values.get({spreadsheetId:SHEET_ID, range:"TRAFFIC!A1:E", valueRenderOption:"UNFORMATTED_VALUE", dateTimeRenderOption:"SERIAL_NUMBER"}, {timeout:20000})
    ]);
    return {poValues:poRes.data.values || [], trafficValues:trafficRes.data.values || []};
}

// Injecting the reader makes the actual API response testable without credentials or network access.
export async function dashboardResponse(readSheets = readGoogleSheets) {
  try {
    const {poValues, trafficValues} = await readSheets();
    return Response.json(parseDashboard(poValues, trafficValues), {headers:{"Cache-Control":"no-store"}});
  } catch (e) {
    const status = Number(e.response?.status || e.code);
    const error = status === 403 ? "Không có quyền đọc Google Sheets. Kiểm tra quyền Viewer của tài khoản dịch vụ và Google Sheets API."
      : status === 404 ? "Không tìm thấy Google Sheet. Kiểm tra GOOGLE_SHEET_ID và quyền truy cập."
      : status === 400 ? "Không đọc được vùng dữ liệu. Kiểm tra các tab PO và TRAFFIC."
      : "Không tải được dữ liệu Google Sheets. Kiểm tra cấu hình tài khoản dịch vụ và thử lại.";
    return Response.json({error}, {status:502, headers:{"Cache-Control":"no-store"}});
  }
}

export default async () => dashboardResponse();
