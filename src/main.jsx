import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend} from "recharts";
import {RefreshCw, ShoppingBag, Package, Eye, Users, TrendingUp, AlertCircle} from "lucide-react";
import "./style.css";
import {isISODate, vietnamDate} from "../shared/date.js";
import {validOrder, filterDimensions, monthlyMatrix, yearlySummary, shopSummary, GROUPS, categoryLabel, inReportPeriod} from "../shared/reporting.js";

const money = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"VND",currencyDisplay:"code",maximumFractionDigits:2}).format(n||0);
const amount = n => new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n||0);
const integer = n => new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(n||0);
const COLORS=["#2563eb","#16a34a","#f59e0b","#8b5cf6","#e11d48","#0891b2","#64748b"];
function validateData(payload) {
 if (!payload || !Array.isArray(payload.orders) || !Array.isArray(payload.traffic)) throw new Error("The data response is not valid. Please try again.");
 const numeric = (row, keys) => keys.every(key => Number.isFinite(row[key]));
 const orders = payload.orders.filter(validOrder).map(row=>({...row,category:categoryLabel(row.category),revenue:row.price*row.qty}));
 const traffic = payload.traffic.filter(row => row && isISODate(row.start) && numeric(row, ["visits", "buyers"]));
 const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter(w => typeof w === "string") : [];
 if (orders.length !== payload.orders.length || traffic.length !== payload.traffic.length) warnings.push("Skipped rows with invalid dates or numbers.");
 return {orders, traffic, warnings, updatedAt: typeof payload.updatedAt === "string" && Number.isFinite(Date.parse(payload.updatedAt)) ? payload.updatedAt : null};
}
class DashboardBoundary extends React.Component {
 state = {failed:false};
 static getDerivedStateFromError() { return {failed:true}; }
 render() {
  if (this.state.failed) return <div className="shell"><div className="notice error" role="alert"><div><b>Cannot display the dashboard</b><p>Refresh the page. If this keeps happening, check the Google Sheets data.</p><button onClick={()=>window.location.reload()}>Refresh</button></div></div></div>;
  return this.props.children;
 }
}
function App(){
 const [data,setData]=useState({orders:[],traffic:[],warnings:[]});
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [period,setPeriod]=useState("week"),[date,setDate]=useState(vietnamDate());
 const [monthlyMetric,setMonthlyMetric]=useState("revenue");
 const [platform,setPlatform]=useState("all"),[brand,setBrand]=useState("all"),[category,setCategory]=useState("all");
 const load=async()=>{setLoading(true);setError("");try{
  const r=await fetch("/api/dashboard?ts="+Date.now(), {signal:AbortSignal.timeout(25000)});
  let j;try{j=await r.json();}catch{throw new Error(`The data service returned an unreadable response (HTTP ${r.status}).`);}
  if(!r.ok)throw new Error(typeof j?.error === "string" ? j.error : `Cannot load data (HTTP ${r.status}).`);
  setData(validateData(j));
 }catch(e){setError(e.name === "TimeoutError" ? "The request took too long. Please try again." : e.message);}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const dimensionOrders=useMemo(()=>filterDimensions(data.orders,{platform,brand,category}),[data.orders,platform,brand,category]);
 const filtered=useMemo(()=>dimensionOrders.filter(row=>inReportPeriod(row.date,period,date)),[dimensionOrders,period,date]);
 const years=useMemo(()=>[...new Set(data.orders.map(row=>Number(row.date.slice(0,4))))].sort((a,b)=>a-b),[data.orders]);
 const selectableYears=[...new Set([...years,Number(date.slice(0,4))])].sort((a,b)=>b-a);
 const monthly=useMemo(()=>monthlyMatrix(filtered,years),[filtered,years]);
 const categoryMonths=useMemo(()=>GROUPS.map(group=>monthlyMatrix(filtered,years,group)),[filtered,years]);
 const yearly=useMemo(()=>yearlySummary(filtered,years),[filtered,years]);
 const revenue=filtered.reduce((s,r)=>s+r.revenue,0), qty=filtered.reduce((s,r)=>s+r.qty,0);
 const orders=new Set(filtered.map(r=>r.orderId)).size;
 const sumBy=(key)=>Object.entries(filtered.reduce((a,r)=>(a[r[key]||"Unclassified"]=(a[r[key]||"Unclassified"]||0)+r.revenue,a),{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const platforms=shopSummary(filtered), categories=sumBy("category"), brands=sumBy("brand");
 const traffic=data.traffic.filter(t=>inReportPeriod(t.start,period,date));
 const visits=traffic.reduce((s,t)=>s+t.visits,0), buyers=traffic.reduce((s,t)=>s+t.buyers,0);
 const daily=Object.entries(filtered.reduce((a,r)=>{const k=r.date;a[k]=(a[k]||0)+r.revenue;return a;},{})).sort(([a],[b])=>a.localeCompare(b)).map(([date,revenue])=>({date:period==="all"?date:date.slice(5),revenue}));
 const platformNames=[...new Set(data.orders.map(r=>r.platform))],brandNames=[...new Set(data.orders.map(r=>r.brand))],catNames=[...new Set(data.orders.map(r=>r.category))];
 return <div className="shell">
  <header><div className="brandmark">P</div><div><h1>Weekly Report — E-commerce</h1><p>Perfetto · Sales & Traffic Dashboard</p></div><div className="headerRight"><span className="live">● Google Sheets</span><button onClick={load} aria-label="Refresh"><RefreshCw size={16}/> Refresh</button></div></header>
  <section className="filters">
   <label>Report Period<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option><option value="all">All dates</option></select></label>
   {period==="year"?<label>Year<select value={date.slice(0,4)} onChange={e=>setDate(e.target.value+"-01-01")}>{selectableYears.map(year=><option key={year} value={year}>{year}</option>)}</select></label>:period!=="all"?<label>{period==="week"?"Date in Week":"Month"}<input type={period==="week"?"date":"month"} value={period==="week"?date:date.slice(0,7)} onChange={e=>{if(e.target.value)setDate(period==="week"?e.target.value:e.target.value+"-01")}}/></label>:<div className="date-scope">Date range<strong>All available years</strong></div>}

   <label>Platform / Shop<select value={platform} onChange={e=>setPlatform(e.target.value)}><option value="all">All</option>{platformNames.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Brand<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="all">All</option>{brandNames.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All</option>{catNames.map(x=><option key={x}>{x}</option>)}</select></label>
  </section>
  {error&&<div className="notice error" role="alert"><AlertCircle size={18}/><div><b>Cannot load data</b><p>{error} Check the Google Sheets connection and try Refresh.</p></div></div>}
  {data.warnings?.length>0&&<div className="notice"><AlertCircle size={18}/><div>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</div></div>}
  {!loading&&!error&&filtered.length===0&&<div className="notice" role="status">No data available</div>}
  <section className="kpis">
   <Kpi icon={<TrendingUp/>} label="Total Revenue" value={money(revenue)} note="Selling price × quantity"/>
   <Kpi icon={<ShoppingBag/>} label="Orders" value={integer(orders)} note="Unique order IDs"/>
   <Kpi icon={<Package/>} label="Units Sold" value={integer(qty)} note="Total quantity"/>
   <Kpi icon={<Eye/>} label="Visits" value={integer(visits)} note="From the TRAFFIC sheet"/>
   <Kpi icon={<Users/>} label="Potential Buyers" value={integer(buyers)} note="From the TRAFFIC sheet"/>
  </section>
  <section className="charts">
   <Panel title="Revenue by Platform / Shop"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={platforms} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={2}>{platforms.map((p,i)=><Cell key={p.name} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/><Legend/></PieChart></ResponsiveContainer></Panel>
   <Panel title="Daily Revenue"><ResponsiveContainer width="100%" height={260}><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis tickFormatter={v=>`${Math.round(v/1000000)}M`}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="revenue" name="Revenue" fill="#e9a66f" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></Panel>
   <Panel title="Revenue by Category"><RankChart data={categories}/></Panel>
   <Panel title="Revenue by Brand"><RankChart data={brands}/></Panel>
  </section>
  <section className="panel full"><h2>Category Details</h2><table><thead><tr><th>Category</th><th>Revenue</th><th>Share</th></tr></thead><tbody>{categories.map(r=><tr key={r.name}><td>{r.name}</td><td>{money(r.value)}</td><td>{revenue?`${(r.value/revenue*100).toFixed(1)}%`:"—"}</td></tr>)}</tbody></table></section>
  <section className="panel full summary" aria-labelledby="monthly-heading">
   <div className="summary-heading"><div><h2 id="monthly-heading">Monthly Revenue</h2><p>One row per year · Jan–Dec · {monthlyMetric==="revenue"?"Revenue in VND":monthlyMetric==="orders"?"Orders":"Units Sold"}</p></div>
    <label className="metric-picker">Show<select value={monthlyMetric} onChange={event=>setMonthlyMetric(event.target.value)}><option value="revenue">Total Revenue</option><option value="orders">Orders</option><option value="qty">Units Sold</option></select></label>
   </div>
   <p className="summary-note">All tables use the filters above and Vietnam dates. Revenue is shown in VND, rounded to two decimal places; totals use unrounded data. Choose All dates to compare full years. Orders are counted by unique order ID; yearly orders are counted once across the year.</p>
   <HorizontalTable title="Monthly Revenue" rows={monthly} metric={monthlyMetric}/>
  </section>
  {GROUPS.map((group,index)=><section key={group} className="panel full summary" aria-labelledby={`category-${index}-heading`}>
   <div className="summary-heading"><div><h2 id={`category-${index}-heading`}>{group===GROUPS[3]?group:`${group} Revenue`}</h2><p>Revenue in VND · Selling price × quantity</p></div></div>
   {group===GROUPS[3]&&<p className="summary-note">Includes other categories and missing or unrecognized category labels. Products are not assigned to a main group by guessing from names or codes.</p>}
   <HorizontalTable title={`${group} monthly revenue`} rows={categoryMonths[index]}/>
  </section>)}
  <section className="panel full summary" aria-labelledby="yearly-heading">
   <div className="summary-heading"><div><h2 id="yearly-heading">Yearly Category Comparison</h2><p>Revenue in VND · All revenue is included in TOTAL before display rounding</p></div></div>
   <div className="table-scroll" tabIndex={0} role="region" aria-label="Yearly Category Comparison"><table><thead><tr><th scope="col">Year</th>{GROUPS.map(group=><th scope="col" key={group}>{group}</th>)}<th scope="col">TOTAL</th></tr></thead>
    <tbody>{yearly.map(row=><tr key={row.year}><th scope="row">{row.year}</th>{GROUPS.map(group=><td key={group}>{amount(row.categories[group])}</td>)}<td className="year-total">{amount(row.revenue)}</td></tr>)}{yearly.length===0&&<tr><td colSpan={6}>No data available</td></tr>}</tbody>
   </table></div>
  </section>
  <footer>{loading?"Loading data…":`Last updated: ${data.updatedAt?new Date(data.updatedAt).toLocaleString("en-US",{timeZone:"Asia/Ho_Chi_Minh"}):"—"}`} (Vietnam time) · <button className="textBtn" onClick={load}>Refresh</button></footer>
 </div>;
}
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function HorizontalTable({title,rows,metric="revenue"}) {
 const metricLabel={revenue:"Revenue (VND)",orders:"Orders",qty:"Units Sold"}[metric];
 return <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title} — ${metricLabel}`}><table className="horizontal-table">
  <caption className="sr-only">{title}: {metricLabel}. Zero means no matching data.</caption>
  <thead><tr><th scope="col">Year</th>{MONTHS.map(month=><th scope="col" key={month}>{month}</th>)}<th scope="col">TOTAL</th></tr></thead>
  <tbody>{rows.map(row=><tr key={row.year}><th scope="row">{row.year}</th>{row.months.map((month,index)=><td key={month.month} title={`${MONTHS[index]} ${row.year}: ${metric==="revenue"?money(month[metric]):integer(month[metric])}`}>{metric==="revenue"?amount(month[metric]):integer(month[metric])}</td>)}<td className="year-total">{metric==="revenue"?amount(row.total[metric]):integer(row.total[metric])}</td></tr>)}{rows.length===0&&<tr><td colSpan={14}>No data available</td></tr>}</tbody>
 </table></div>;
}
function Kpi({icon,label,value,note}){return <div className="kpi"><div className="kpiIcon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function Panel({title,children}){return <div className="panel"><h2>{title}</h2>{children}</div>}
function RankChart({data}){return <ResponsiveContainer width="100%" height={260}><BarChart data={data.slice(0,10)} layout="vertical" margin={{left:12,right:12}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={v=>`${Math.round(v/1000000)}M`}/><YAxis type="category" dataKey="name" width={112} tick={{fontSize:11}}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="value" name="Revenue" fill="#2563eb" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer>}
createRoot(document.getElementById("root")).render(<DashboardBoundary><App/></DashboardBoundary>);
