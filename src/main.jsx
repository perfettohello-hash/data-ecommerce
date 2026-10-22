import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend} from "recharts";
import {RefreshCw, ShoppingBag, Package, Eye, Users, TrendingUp, CalendarDays, AlertCircle} from "lucide-react";
import "./style.css";
import {isISODate, weekStart, vietnamDate} from "../shared/date.js";
import {validOrder, filterDimensions, monthlySummary, yearlySummary, shopSummary, GROUPS} from "../shared/reporting.js";

const money = n => new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(n||0);
const integer = n => new Intl.NumberFormat("vi-VN",{maximumFractionDigits:0}).format(n||0);
const COLORS=["#2563eb","#16a34a","#f59e0b","#8b5cf6","#e11d48","#0891b2","#64748b"];
const monthKey = d => isISODate(d) ? d.slice(0,7) : "";
function validateData(payload) {
 if (!payload || !Array.isArray(payload.orders) || !Array.isArray(payload.traffic)) throw new Error("API trả về dữ liệu không hợp lệ.");
 const numeric = (row, keys) => keys.every(key => Number.isFinite(row[key]));
 const orders = payload.orders.filter(validOrder).map(row=>({...row,revenue:row.price*row.qty}));
 const traffic = payload.traffic.filter(row => row && isISODate(row.start) && numeric(row, ["visits", "buyers"]));
 const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter(w => typeof w === "string") : [];
 if (orders.length !== payload.orders.length || traffic.length !== payload.traffic.length) warnings.push("Đã bỏ qua các dòng có ngày hoặc số liệu không hợp lệ.");
 return {orders, traffic, warnings, updatedAt: typeof payload.updatedAt === "string" && Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : null};
}
class DashboardBoundary extends React.Component {
 state = {failed:false};
 static getDerivedStateFromError() { return {failed:true}; }
 render() {
  if (this.state.failed) return <div className="shell"><div className="notice error" role="alert"><div><b>Không thể hiển thị dashboard</b><p>Vui lòng tải lại trang. Nếu lỗi tiếp tục, hãy kiểm tra dữ liệu Google Sheets.</p><button onClick={()=>window.location.reload()}>Tải lại trang</button></div></div></div>;
  return this.props.children;
 }
}
function App(){
 const [data,setData]=useState({orders:[],traffic:[],warnings:[]});
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [period,setPeriod]=useState("week"),[date,setDate]=useState(vietnamDate());
 const [summaryYear,setSummaryYear]=useState(Number(vietnamDate().slice(0,4)));
 const [platform,setPlatform]=useState("all"),[brand,setBrand]=useState("all"),[category,setCategory]=useState("all");
 const load=async()=>{setLoading(true);setError("");try{
  const r=await fetch("/api/dashboard?ts="+Date.now(), {signal:AbortSignal.timeout(25000)});
  let j;try{j=await r.json();}catch{throw new Error(`API không trả về JSON (HTTP ${r.status}).`);}
  if(!r.ok)throw new Error(typeof j?.error === "string" ? j.error : `Không tải được dữ liệu (HTTP ${r.status}).`);
  setData(validateData(j));
 }catch(e){setError(e.name === "TimeoutError" ? "Yêu cầu dữ liệu quá thời gian. Vui lòng thử lại." : e.message);}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const dimensionOrders=useMemo(()=>filterDimensions(data.orders,{platform,brand,category}),[data.orders,platform,brand,category]);
 const filtered=useMemo(()=>dimensionOrders.filter(r=>isISODate(date)&&(period==="month"?monthKey(r.date)===monthKey(date):weekStart(r.date)===weekStart(date))),[dimensionOrders,period,date]);
 const monthly=useMemo(()=>monthlySummary(dimensionOrders,summaryYear),[dimensionOrders,summaryYear]);
 const yearly=useMemo(()=>yearlySummary(dimensionOrders,[...new Set(data.orders.map(row=>Number(row.date.slice(0,4))))]),[dimensionOrders,data.orders]);
 const years=[...new Set([Number(vietnamDate().slice(0,4)),summaryYear,...data.orders.map(row=>Number(row.date.slice(0,4)))])].sort((a,b)=>b-a);
 const revenue=filtered.reduce((s,r)=>s+r.revenue,0), qty=filtered.reduce((s,r)=>s+r.qty,0);
 const orders=new Set(filtered.map(r=>r.orderId)).size;
 const sumBy=(key)=>Object.entries(filtered.reduce((a,r)=>(a[r[key]||"Chưa phân loại"]=(a[r[key]||"Chưa phân loại"]||0)+r.revenue,a),{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const platforms=shopSummary(filtered), categories=sumBy("category"), brands=sumBy("brand");
 const traffic=data.traffic.filter(t=>period==="month"?monthKey(t.start)===monthKey(date):weekStart(t.start)===weekStart(date));
 const visits=traffic.reduce((s,t)=>s+t.visits,0), buyers=traffic.reduce((s,t)=>s+t.buyers,0);
 const daily=Object.entries(filtered.reduce((a,r)=>{const k=r.date;a[k]=(a[k]||0)+r.revenue;return a;},{})).sort(([a],[b])=>a.localeCompare(b)).map(([date,revenue])=>({date:date.slice(5),revenue}));
 const platformNames=[...new Set(data.orders.map(r=>r.platform))],brandNames=[...new Set(data.orders.map(r=>r.brand))],catNames=[...new Set(data.orders.map(r=>r.category))];
 return <div className="shell">
  <header><div className="brandmark">P</div><div><h1>Weekly Report — E-commerce</h1><p>Perfetto · Sales & Traffic Dashboard</p></div><div className="headerRight"><span className="live">● Google Sheets</span><button onClick={load}><RefreshCw size={16}/> Làm mới</button></div></header>
  <section className="filters">
   <label>Kỳ báo cáo<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="week">Theo tuần</option><option value="month">Theo tháng</option></select></label>
   <label>{period==="week"?"Chọn ngày trong tuần":"Chọn tháng"}<input type={period==="week"?"date":"month"} value={period==="week"?date:date.slice(0,7)} onChange={e=>{if(e.target.value)setDate(period==="week"?e.target.value:e.target.value+"-01")}}/></label>
   <label>Nền tảng / Shop<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="all">Tất cả</option>{platformNames.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Brand<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="all">Tất cả</option>{brandNames.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Tất cả</option>{catNames.map(x=><option key={x}>{x}</option>)}</select></label>
  </section>
  {error&&<div className="notice error" role="alert"><AlertCircle size={18}/><div><b>Chưa kết nối được dữ liệu</b><p>{error}. Kiểm tra biến môi trường Netlify và quyền đọc Google Sheets.</p></div></div>}
  {data.warnings?.length>0&&<div className="notice"><AlertCircle size={18}/><div>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</div></div>}
  {!loading&&!error&&filtered.length===0&&<div className="notice" role="status">Không có đơn hàng trong kỳ hoặc bộ lọc đã chọn.</div>}
  <section className="kpis">
   <Kpi icon={<TrendingUp/>} label="Tổng doanh thu" value={money(revenue)} note="Giá thực bán × SL"/>
   <Kpi icon={<ShoppingBag/>} label="Số đơn hàng" value={integer(orders)} note="Đếm mã đơn duy nhất"/>
   <Kpi icon={<Package/>} label="Sản phẩm bán ra" value={integer(qty)} note="Tổng số lượng"/>
   <Kpi icon={<Eye/>} label="Visits" value={integer(visits)} note="Từ sheet TRAFFIC"/>
   <Kpi icon={<Users/>} label="Potential buyers" value={integer(buyers)} note="Từ sheet TRAFFIC"/>
  </section>
  <section className="charts">
   <Panel title="Tỷ trọng doanh thu theo shop"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={platforms} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={2}>{platforms.map((p,i)=><Cell key={p.name} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/><Legend/></PieChart></ResponsiveContainer></Panel>
   <Panel title={period==="week"?"Doanh thu theo ngày":"Doanh thu theo ngày trong tháng"}><ResponsiveContainer width="100%" height={260}><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis tickFormatter={v=>`${Math.round(v/1000000)}M`}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="revenue" name="Doanh thu" fill="#e9a66f" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></Panel>
   <Panel title="Doanh thu theo Category"><RankChart data={categories}/></Panel>
   <Panel title="Doanh thu theo Brand"><RankChart data={brands}/></Panel>
  </section>
  <section className="panel full"><h2>Chi tiết theo Category</h2><table><thead><tr><th>Category</th><th>Doanh thu</th><th>Tỷ trọng</th></tr></thead><tbody>{categories.map(r=><tr key={r.name}><td>{r.name}</td><td>{money(r.value)}</td><td>{revenue?`${(r.value/revenue*100).toFixed(1)}%`:"—"}</td></tr>)}</tbody></table></section>
  <section className="panel full summary" aria-labelledby="monthly-heading">
   <div className="summary-heading"><div><h2 id="monthly-heading">Doanh thu theo tháng</h2><p>Đủ 12 tháng của năm đã chọn · Theo bộ lọc shop, brand và category</p></div>
    <label className="year-picker">Năm báo cáo<select value={summaryYear} onChange={event=>setSummaryYear(Number(event.target.value))}>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
   </div>
   <p className="summary-note">Hai bảng tổng hợp dùng năm riêng, không giới hạn theo tuần/tháng đang chọn ở phía trên. Ngày theo giờ Việt Nam. Tổng số đơn năm được đếm duy nhất trong cả năm.</p>
   <div className="table-scroll" tabIndex={0} role="region" aria-label="Bảng doanh thu theo tháng"><table><thead><tr><th scope="col">Tháng</th><th scope="col">Doanh thu</th><th scope="col">Số đơn hàng</th><th scope="col">Số lượng bán</th></tr></thead>
    <tbody>{monthly.months.map(row=><tr key={row.month}><th scope="row">Tháng {row.month}</th><td>{money(row.revenue)}</td><td>{integer(row.orders)}</td><td>{integer(row.qty)}</td></tr>)}</tbody>
    <tfoot><tr><th scope="row">Tổng năm {summaryYear}</th><td>{money(monthly.total.revenue)}</td><td>{integer(monthly.total.orders)}</td><td>{integer(monthly.total.qty)}</td></tr></tfoot>
   </table></div>
  </section>
  <section className="panel full summary" aria-labelledby="yearly-heading">
   <div className="summary-heading"><div><h2 id="yearly-heading">Doanh thu năm theo nhóm sản phẩm</h2><p>Tất cả các năm trong dữ liệu · Áp dụng bộ lọc shop, brand và category</p></div></div>
   <p className="summary-note">CAT: Coffee maker → Máy pha cà phê; Coffee → Cà phê; Hygiene products → Hóa chất. Các danh mục khác hoặc thiếu CAT được giữ trong Khác / Chưa phân loại; không suy đoán từ tên hoặc mã sản phẩm.</p>
   <div className="table-scroll" tabIndex={0} role="region" aria-label="Bảng doanh thu theo năm"><table><thead><tr><th scope="col">Năm</th>{GROUPS.map(group=><th scope="col" key={group}>{group}</th>)}<th scope="col">Tổng doanh thu</th></tr></thead>
    <tbody>{yearly.map(row=><tr key={row.year}><th scope="row">{row.year}</th>{GROUPS.map(group=><td key={group}>{money(row.categories[group])}</td>)}<td className="year-total">{money(row.revenue)}</td></tr>)}{yearly.length===0&&<tr><td colSpan={6}>Không có dữ liệu theo bộ lọc đã chọn.</td></tr>}</tbody>
   </table></div>
  </section>
  <footer>{loading?"Đang tải dữ liệu…":`Cập nhật gần nhất: ${data.updatedAt?new Date(data.updatedAt).toLocaleString("vi-VN"):"—"}`} · <button className="textBtn" onClick={load}>Tải lại dữ liệu</button></footer>
 </div>;
}
function Kpi({icon,label,value,note}){return <div className="kpi"><div className="kpiIcon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function Panel({title,children}){return <div className="panel"><h2>{title}</h2>{children}</div>}
function RankChart({data}){return <ResponsiveContainer width="100%" height={260}><BarChart data={data.slice(0,10)} layout="vertical" margin={{left:12,right:12}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={v=>`${Math.round(v/1000000)}M`}/><YAxis type="category" dataKey="name" width={112} tick={{fontSize:11}}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="value" name="Doanh thu" fill="#2563eb" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer>}
createRoot(document.getElementById("root")).render(<DashboardBoundary><App/></DashboardBoundary>);
