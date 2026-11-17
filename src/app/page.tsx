"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, CalendarClock,
  Check, ChevronDown, CircleHelp, Command, LayoutDashboard,
  Menu, Mic, PackagePlus, Pencil, Plus, Search, Settings2, ShoppingCart,
  Sparkles, TrendingUp, Wallet, X,
} from "lucide-react";

type Batch = { id:string; batchNo:string; quantity:number; expiryDate:string; receivedAt:string };
type StockMovement = { id:string; productId:string; productName:string; type:'IN'|'OUT'|'ADJUSTMENT'; quantity:number; note:string; at:string };
type Sale = { id:string; productId:string; productName:string; quantity:number; unit:string; unitPrice:number; unitCost:number; revenue:number; cost:number; profit:number; soldAt:string };
type Product = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  lowStockAt: number;
  expiryDate: string;
  batches: Batch[];
};

type ProductStatus = "Healthy" | "Low stock" | "Expiring" | "Expired";

const STORAGE_KEY = "stocksaathi.inventory.v3";
const PREVIOUS_STORAGE_KEY = "stocksaathi.inventory.v2";
const LEGACY_STORAGE_KEY = "stocksaathi.inventory.v1";
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2,7);
const sumBatches = (b:Batch[]) => b.reduce((n,x)=>n+Math.max(0,x.quantity),0);
function normalizeProduct(p:Omit<Product,'batches'> & {batches?:Batch[]}):Product { const batches=Array.isArray(p.batches)&&p.batches.length?p.batches:[{id:makeId(),batchNo:"OPENING",quantity:Math.max(0,Number(p.quantity)||0),expiryDate:p.expiryDate||"",receivedAt:new Date().toISOString()}]; return {...p,batches,quantity:sumBatches(batches),expiryDate:batches.filter(x=>x.quantity>0&&x.expiryDate).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate))[0]?.expiryDate||""}; }
const today = () => new Date().toISOString().slice(0, 10);
const dateInDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const initialProducts: Omit<Product, 'batches'>[] = [
  { id: "demo-milk", name: "Amul Taaza Milk", category: "Dairy", quantity: 18, unit: "packets", costPrice: 24, sellingPrice: 27, lowStockAt: 5, expiryDate: dateInDays(4) },
  { id: "demo-oil", name: "Fortune Sunflower Oil", category: "Grocery", quantity: 4, unit: "pouches", costPrice: 130, sellingPrice: 142, lowStockAt: 8, expiryDate: "" },
  { id: "demo-maggi", name: "Maggi 2-Min Noodles", category: "Snacks", quantity: 32, unit: "packs", costPrice: 11, sellingPrice: 14, lowStockAt: 10, expiryDate: dateInDays(90) },
  { id: "demo-bread", name: "Britannia Bread", category: "Bakery", quantity: 6, unit: "loaves", costPrice: 34, sellingPrice: 40, lowStockAt: 4, expiryDate: dateInDays(1) },
];

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Inventory", icon: Boxes },
  { label: "Sales & profit", icon: TrendingUp },
  { label: "Expiry alerts", icon: CalendarClock },
];

const emptyForm = {
  name: "", category: "Grocery", quantity: "1", unit: "units",
  costPrice: "0", sellingPrice: "0", lowStockAt: "5", expiryDate: "",
};

function getStatus(product: Product): ProductStatus {
  const dates=product.batches.filter(b=>b.quantity>0&&b.expiryDate).map(b=>b.expiryDate).sort();
  if (dates.some(d=>d<today())) return "Expired";
  if (dates.some(d=>d<=dateInDays(7))) return "Expiring";
  if (product.quantity <= product.lowStockAt) return "Low stock";
  return "Healthy";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function MetricCard({
  label, value, note, icon: Icon, trend,
}: {
  label: string; value: string; note: string; icon: typeof Wallet; trend?: "up" | "down";
}) {
  return (
    <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-xl bg-[#eff8f1] p-2.5 text-forest"><Icon size={18} /></span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        {trend === "up" ? <ArrowUpRight size={14} className="text-emerald-600" /> : null}
        {trend === "down" ? <ArrowDownRight size={14} className="text-amber-600" /> : null}
        <span className="font-semibold text-emerald-700">{note}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(initialProducts.map(normalizeProduct));
  const [movements,setMovements]=useState<StockMovement[]>([]);
  const [sales,setSales]=useState<Sale[]>([]);
  const [reportFrom,setReportFrom]=useState(dateInDays(-29));
  const [reportTo,setReportTo]=useState(today());
  const [reportGrouping,setReportGrouping]=useState<"day"|"month">("day");
  const [saleForm,setSaleForm]=useState({productId:'',quantity:'1',unitPrice:'',soldAt:today()});
  const [batchProductId,setBatchProductId]=useState<string|null>(null);
  const [batchForm,setBatchForm]=useState({batchNo:'',quantity:'1',expiryDate:''});
  const [hydrated, setHydrated] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved=window.localStorage.getItem(STORAGE_KEY); const previous=window.localStorage.getItem(PREVIOUS_STORAGE_KEY); const legacy=window.localStorage.getItem(LEGACY_STORAGE_KEY); const source=saved||previous||legacy;
      if(source){ const parsed:unknown=JSON.parse(source); if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&"products" in parsed){const data=parsed as {products:Product[];movements?:StockMovement[];sales?:Sale[]};if(Array.isArray(data.products))setProducts(data.products.map(normalizeProduct));if(Array.isArray(data.movements))setMovements(data.movements);if(Array.isArray(data.sales))setSales(data.sales);}else if(Array.isArray(parsed)){setProducts((parsed as Product[]).map(normalizeProduct));setNotice("Purana inventory safely migrate ho gaya. Existing products preserve hain.");}}
    } catch {
      setNotice("Saved inventory could not be read. Demo data is shown.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({version:3,products,movements,sales}));
    } catch {
      setNotice("Device storage is full. Changes may not persist.");
    }
  }, [products, movements, sales, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredProducts = useMemo(
    () => products.filter((product) =>
      [product.name, product.category].some((value) => value.toLowerCase().includes(search.toLowerCase())),
    ),
    [products, search],
  );

  const attentionCount = products.filter((product) => getStatus(product) !== "Healthy").length;
  const expiryCount = products.filter((product) => ["Expiring", "Expired"].includes(getStatus(product))).length;
  const inventoryValue = products.reduce((sum, product) => sum + product.quantity * product.costPrice, 0);
  const totalRevenue=sales.reduce((sum,sale)=>sum+sale.revenue,0);
  const totalCost=sales.reduce((sum,sale)=>sum+sale.cost,0);
  const totalProfit=sales.reduce((sum,sale)=>sum+sale.profit,0);
  const reportSales=useMemo(()=>sales.filter(sale=>sale.soldAt>=reportFrom&&sale.soldAt<=reportTo).sort((a,b)=>a.soldAt.localeCompare(b.soldAt)),[sales,reportFrom,reportTo]);
  const reportRevenue=reportSales.reduce((sum,sale)=>sum+sale.revenue,0);
  const reportCost=reportSales.reduce((sum,sale)=>sum+sale.cost,0);
  const reportProfit=reportSales.reduce((sum,sale)=>sum+sale.profit,0);
  const reportRows=useMemo(()=>{const groups=new Map<string,{label:string;revenue:number;cost:number;profit:number;count:number}>();for(const sale of reportSales){const key=reportGrouping==="day"?sale.soldAt:sale.soldAt.slice(0,7);const row=groups.get(key)||{label:key,revenue:0,cost:0,profit:0,count:0};row.revenue+=sale.revenue;row.cost+=sale.cost;row.profit+=sale.profit;row.count+=1;groups.set(key,row);}return Array.from(groups.values()).sort((a,b)=>b.label.localeCompare(a.label));},[reportSales,reportGrouping]);
  const maxReportRevenue=Math.max(1,...reportRows.map(row=>row.revenue));

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      quantity: String(product.quantity),
      unit: product.unit,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      lowStockAt: String(product.lowStockAt),
      expiryDate: product.expiryDate,
    });
    setShowForm(true);
  }

  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    const quantity = Number(form.quantity);
    const costPrice = Number(form.costPrice);
    const sellingPrice = Number(form.sellingPrice);
    const lowStockAt = Number(form.lowStockAt);
    if (!name || !form.category.trim() || !form.unit.trim()) {
      setNotice("Product name, category aur unit required hain.");
      return;
    }
    if ([quantity, costPrice, sellingPrice, lowStockAt].some((value) => !Number.isFinite(value) || value < 0)) {
      setNotice("Quantity aur prices valid positive numbers hone chahiye.");
      return;
    }
    const productId=editingId??makeId(); const existing=products.find(item=>item.id===editingId); let batches=existing?[...existing.batches]:[{id:makeId(),batchNo:"OPENING",quantity,expiryDate:form.expiryDate,receivedAt:new Date().toISOString()}];
    if(existing){if(form.expiryDate!==existing.expiryDate){const target=batches.find(batch=>batch.quantity>0);if(target)batches=batches.map(batch=>batch.id===target.id?{...batch,expiryDate:form.expiryDate}:batch);}let delta=quantity-existing.quantity;if(delta>0)batches.push({id:makeId(),batchNo:"MANUAL-ADJ",quantity:delta,expiryDate:form.expiryDate,receivedAt:new Date().toISOString()});if(delta<0){let left=-delta;batches=batches.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)).map(batch=>{const take=Math.min(batch.quantity,left);left-=take;return {...batch,quantity:batch.quantity-take};});}}
    const product: Product = {
      id: productId,
      name,
      category: form.category.trim(),
      quantity: sumBatches(batches),
      unit: form.unit.trim(),
      costPrice,
      sellingPrice,
      lowStockAt,
      expiryDate: form.expiryDate,
      batches,
    };
    setProducts((current) => editingId ? current.map((item) => item.id === editingId ? product : item) : [product,...current]);
    if(!existing)setMovements(current=>[{id:makeId(),productId,productName:name,type:"IN",quantity,note:"Opening stock",at:new Date().toISOString()},...current].slice(0,200));
    else if(quantity!==existing.quantity)setMovements(current=>[{id:makeId(),productId,productName:name,type:"ADJUSTMENT",quantity:Math.abs(quantity-existing.quantity),note:"Quantity changed while editing product",at:new Date().toISOString()},...current].slice(0,200));
    setShowForm(false);
    setNotice(editingId ? name + " updated." : name + " inventory mein add ho gaya.");
  }

  function adjustStock(product:Product,amount:number){const next=product.quantity+amount;if(next<0){setNotice("Stock zero se kam nahi ho sakta.");return;}let batches=[...product.batches];if(amount>0)batches.push({id:makeId(),batchNo:"MANUAL-IN",quantity:amount,expiryDate:"",receivedAt:new Date().toISOString()});else{let left=-amount;batches=batches.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)).map(batch=>{const take=Math.min(batch.quantity,left);left-=take;return {...batch,quantity:batch.quantity-take};});}const updated=normalizeProduct({...product,batches,quantity:sumBatches(batches)});setProducts(current=>current.map(item=>item.id===product.id?updated:item));setMovements(current=>[{id:makeId(),productId:product.id,productName:product.name,type:amount>0?"IN":"OUT",quantity:Math.abs(amount),note:amount>0?"Manual stock received":"Manual stock reduction (FIFO)",at:new Date().toISOString()},...current].slice(0,200));setNotice(product.name+" stock updated: "+updated.quantity+" "+product.unit);}

  function addBatch(event:FormEvent<HTMLFormElement>){event.preventDefault();const product=products.find(item=>item.id===batchProductId);const quantity=Number(batchForm.quantity);if(!product||!batchForm.batchNo.trim()||!Number.isFinite(quantity)||quantity<=0){setNotice("Batch number aur valid quantity required hain.");return;}const batch:Batch={id:makeId(),batchNo:batchForm.batchNo.trim(),quantity,expiryDate:batchForm.expiryDate,receivedAt:new Date().toISOString()};const updated=normalizeProduct({...product,batches:[...product.batches,batch],quantity:product.quantity+quantity});setProducts(current=>current.map(item=>item.id===product.id?updated:item));setMovements(current=>[{id:makeId(),productId:product.id,productName:product.name,type:"IN",quantity,note:"New batch: "+batch.batchNo,at:new Date().toISOString()},...current].slice(0,200));setBatchProductId(null);setBatchForm({batchNo:"",quantity:"1",expiryDate:""});setNotice("New batch added for "+product.name);}

  function recordSale(event:FormEvent<HTMLFormElement>){event.preventDefault();const product=products.find(item=>item.id===saleForm.productId);const quantity=Number(saleForm.quantity);const unitPrice=Number(saleForm.unitPrice);if(!product){setNotice("Sale ke liye product select karein.");return;}if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unitPrice)||unitPrice<0){setNotice("Quantity aur selling price valid enter karein.");return;}if(quantity>product.quantity){setNotice("Available stock sirf "+product.quantity+" "+product.unit+" hai.");return;}let remaining=quantity;const batches=[...product.batches].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)).map(batch=>{const used=Math.min(batch.quantity,remaining);remaining-=used;return {...batch,quantity:batch.quantity-used};});const revenue=quantity*unitPrice;const cost=quantity*product.costPrice;const sale:Sale={id:makeId(),productId:product.id,productName:product.name,quantity,unit:product.unit,unitPrice,unitCost:product.costPrice,revenue,cost,profit:revenue-cost,soldAt:saleForm.soldAt||today()};const updated=normalizeProduct({...product,batches,quantity:sumBatches(batches)});setProducts(current=>current.map(item=>item.id===product.id?updated:item));setSales(current=>[sale,...current].slice(0,1000));setMovements(current=>[{id:makeId(),productId:product.id,productName:product.name,type:"OUT",quantity,note:"Sale recorded · "+formatMoney(revenue),at:new Date().toISOString()},...current].slice(0,200));setSaleForm({productId:product.id,quantity:"1",unitPrice:String(product.sellingPrice),soldAt:today()});setNotice("Sale saved. Profit: "+formatMoney(sale.profit));}

  function handleVoice() {
    setNotice("Hindi voice entry abhi connected nahi hai. Product form se stock add karein.");
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#e7eee7] bg-white px-5 py-6 transition-transform lg:static lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest text-white"><Boxes size={21} /></div>
              <div><p className="text-[17px] font-extrabold tracking-tight text-ink">StockSaathi<span className="text-emerald-600"> AI</span></p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Smart shop manager</p></div>
            </div>
            <button onClick={() => setMobileMenu(false)} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label="Close menu"><X size={18} /></button>
          </div>

          <div className="mt-10">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
            <nav className="mt-3 space-y-1">
              {navItems.map(({ label, icon: Icon }) => (
                <button key={label} onClick={() => { setActiveNav(label); setMobileMenu(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${activeNav === label ? "bg-[#eaf5ed] text-forest" : "text-slate-500 hover:bg-slate-50 hover:text-ink"}`}>
                  <Icon size={18} />{label}
                  {label === "Expiry alerts" ? <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{expiryCount}</span> : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-9">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Manage</p>
            <button onClick={() => setNotice("Settings next phase mein add honge.")} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"><Settings2 size={18} /> Settings</button>
            <button onClick={() => setNotice("Help centre coming soon.")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"><CircleHelp size={18} /> Help & support</button>
          </div>

          <div className="mt-auto rounded-2xl bg-[#f0f7f1] p-4">
            <div className="flex items-center gap-2 text-forest"><Sparkles size={16} /><span className="text-xs font-bold">Saathi stock alert</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{attentionCount ? attentionCount + " products need your attention. Review low stock and expiry dates." : "All products look healthy right now."}</p>
            <button onClick={() => setActiveNav("Inventory")} className="mt-3 text-xs font-bold text-forest underline underline-offset-4">Review stock</button>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcece0] text-xs font-bold text-forest">RK</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-ink">My Shop</p><p className="text-[10px] text-slate-400">Device workspace</p></div>
            <ChevronDown size={16} className="text-slate-400" />
          </div>
        </aside>

        {mobileMenu ? <button aria-label="Close navigation overlay" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" /> : null}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e8eee8] bg-white/90 px-4 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenu(true)} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
              <div><p className="text-sm font-bold text-ink">{activeNav}</p><p className="hidden text-[11px] text-slate-400 sm:block">{hydrated ? "Inventory saved on this device" : "Loading inventory..."}</p></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden rounded-full border border-[#e4eee5] bg-[#f7fbf7] px-3 py-1.5 text-[11px] font-semibold text-forest sm:inline-flex"><span className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> Local workspace</span>
              <button onClick={() => setNotice(attentionCount ? attentionCount + " products need attention." : "No stock alerts right now.")} className="relative rounded-xl border border-slate-100 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Notifications"><Bell size={17} />{attentionCount > 0 ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}</button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">S</div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9">
            <div className="float-in flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Your shop, one smart view</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-[32px]">Namaste, Shopkeeper <span className="inline-block">👋</span></h1><p className="mt-2 text-sm text-slate-500">Aaj aapki dukaan ka stock kaisa hai?</p></div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleVoice} className="inline-flex items-center gap-2 rounded-xl border border-[#dce9de] bg-white px-4 py-3 text-sm font-bold text-forest shadow-sm transition hover:bg-[#f4faf5]"><Mic size={17} /> Speak in Hindi</button>
                <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white shadow-lg shadow-forest/15 transition hover:bg-[#225238]"><PackagePlus size={17} /> Add stock</button>
              </div>
            </div>

            {activeNav==="Sales & profit" ? <div className="mt-7 space-y-6">
              <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Total revenue" value={formatMoney(totalRevenue)} note={sales.length+" recorded sales"} icon={Wallet}/><MetricCard label="Cost of goods sold" value={formatMoney(totalCost)} note="Based on saved purchase cost" icon={Boxes}/><MetricCard label="Gross profit" value={formatMoney(totalProfit)} note="Revenue minus product cost" icon={TrendingUp} trend={totalProfit>=0?"up":"down"}/></div>
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <form onSubmit={recordSale} className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><h2 className="text-base font-extrabold text-ink">Record a sale</h2><p className="mt-1 text-xs text-slate-400">Sale save hote hi inventory FIFO ke hisaab se reduce hoga.</p><div className="mt-5 space-y-4"><div><label className="text-xs font-bold text-slate-600">Product</label><select required value={saleForm.productId} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setSaleForm({...saleForm,productId:e.target.value,unitPrice:p?String(p.sellingPrice):''});}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Select product</option>{products.filter(p=>p.quantity>0).map(p=><option key={p.id} value={p.id}>{p.name} · {p.quantity} {p.unit} available</option>)}</select></div><div><label className="text-xs font-bold text-slate-600">Quantity sold</label><input required type="number" min="0.01" step="any" value={saleForm.quantity} onChange={e=>setSaleForm({...saleForm,quantity:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div><label className="text-xs font-bold text-slate-600">Selling price per unit (₹)</label><input required type="number" min="0" step="0.01" value={saleForm.unitPrice} onChange={e=>setSaleForm({...saleForm,unitPrice:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div><label className="text-xs font-bold text-slate-600">Sale date</label><input type="date" value={saleForm.soldAt} onChange={e=>setSaleForm({...saleForm,soldAt:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div></div><div className="mt-5 rounded-xl bg-[#f2f8f3] p-4"><p className="text-xs text-slate-500">Estimated gross profit</p><p className="mt-1 text-xl font-extrabold text-forest">{formatMoney((Number(saleForm.quantity)||0)*((Number(saleForm.unitPrice)||0)-(products.find(p=>p.id===saleForm.productId)?.costPrice||0)))}</p></div><button type="submit" disabled={!products.some(p=>p.quantity>0)} className="mt-5 w-full rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Save sale & update stock</button></form>
                <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><h2 className="text-base font-extrabold text-ink">Sales history</h2><p className="mt-1 text-xs text-slate-400">Latest recorded transactions · maximum 1,000</p><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto">{sales.map(sale=><div key={sale.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink">{sale.productName}</p><p className="mt-1 text-[10px] text-slate-500">{sale.quantity} {sale.unit} × {formatMoney(sale.unitPrice)} · {sale.soldAt}</p></div><div className="text-right"><p className="text-sm font-extrabold text-ink">{formatMoney(sale.revenue)}</p><p className={`mt-1 text-[10px] font-bold ${sale.profit>=0?"text-emerald-700":"text-rose-600"}`}>Profit {formatMoney(sale.profit)}</p></div></div></div>)}{sales.length===0?<p className="py-10 text-center text-xs text-slate-400">Abhi koi sale record nahi hui.</p>:null}</div></div>
              </div>
            </div> : null}

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Products" value={String(products.length)} note="In your inventory" icon={Boxes} />
              <MetricCard label="Stock cost value" value={formatMoney(inventoryValue)} note="Based on purchase price" icon={Wallet} />
              <MetricCard label="Low stock / alerts" value={String(attentionCount)} note="Needs review" icon={Activity} trend={attentionCount ? "down" : undefined} />
              <MetricCard label="Expiry alerts" value={String(expiryCount)} note="Within 7 days or expired" icon={CalendarClock} />
            </div>

            {activeNav==="Overview" ? <div className="mt-6 rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Sales performance</h2><p className="mt-1 text-xs text-slate-400">Live analytics from your saved sales transactions</p></div><span className="rounded-full bg-[#eff8f1] px-3 py-1.5 text-[10px] font-bold text-forest">{reportSales.length} transactions</span></div>
              <div className="mt-5 flex flex-wrap items-end gap-3"><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">From</label><input type="date" value={reportFrom} max={reportTo} onChange={e=>setReportFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">To</label><input type="date" value={reportTo} min={reportFrom} max={today()} onChange={e=>setReportTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1"><button onClick={()=>setReportGrouping("day")} className={`rounded-md px-3 py-2 text-xs font-bold ${reportGrouping==="day"?"bg-white text-forest shadow-sm":"text-slate-500"}`}>Daily</button><button onClick={()=>setReportGrouping("month")} className={`rounded-md px-3 py-2 text-xs font-bold ${reportGrouping==="month"?"bg-white text-forest shadow-sm":"text-slate-500"}`}>Monthly</button></div><button onClick={()=>{setReportFrom(dateInDays(-29));setReportTo(today());}} className="rounded-lg px-3 py-2 text-xs font-bold text-forest hover:bg-[#f2f8f3]">Last 30 days</button></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f7faf7] p-4"><p className="text-[10px] font-semibold text-slate-500">Revenue</p><p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(reportRevenue)}</p></div><div className="rounded-xl bg-[#f7faf7] p-4"><p className="text-[10px] font-semibold text-slate-500">Product cost</p><p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(reportCost)}</p></div><div className="rounded-xl bg-[#f0f8f2] p-4"><p className="text-[10px] font-semibold text-forest">Gross profit</p><p className="mt-1 text-xl font-extrabold text-forest">{formatMoney(reportProfit)}</p></div></div>
              <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-extrabold text-ink">{reportGrouping==="day"?"Daily report":"Monthly report"}</h3><span className="text-[10px] text-slate-400">Revenue bars · newest first</span></div>{reportRows.length? <div className="space-y-3">{reportRows.slice(0,31).map(row=><div key={row.label} className="grid grid-cols-[76px_1fr_90px] items-center gap-3"><span className="text-[10px] font-semibold text-slate-500">{row.label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-forest" style={{width:(row.revenue/maxReportRevenue*100)+"%"}}/></div><div className="text-right"><p className="text-[10px] font-bold text-ink">{formatMoney(row.revenue)}</p><p className="text-[9px] text-emerald-700">Profit {formatMoney(row.profit)}</p></div></div>)}</div>:<p className="rounded-xl bg-slate-50 py-8 text-center text-xs text-slate-400">Selected dates mein koi sale record nahi hai.</p>}</div>
              <p className="mt-4 text-[10px] text-slate-400">Reports use sale date and saved cost snapshots. Gross profit excludes rent, wages, tax, payment fees and other overheads.</p>
            </div> : null}

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Inventory health</h2><p className="mt-1 text-xs text-slate-400">Live summary calculated from saved products</p></div><span className="rounded-lg bg-[#eff8f1] px-3 py-2 text-xs font-semibold text-forest">Updated automatically</span></div>
                <div className="mt-7 space-y-5">
                  {(["Healthy", "Low stock", "Expiring", "Expired"] as ProductStatus[]).map((status) => {
                    const count = products.filter((product) => getStatus(product) === status).length;
                    const width = products.length ? Math.max(0, (count / products.length) * 100) : 0;
                    return <div key={status}><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-slate-600">{status}</span><span className="font-bold text-ink">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div style={{ width: width + "%" }} className={`h-full rounded-full ${status === "Healthy" ? "bg-emerald-500" : status === "Low stock" ? "bg-amber-400" : "bg-rose-400"}`} /></div></div>;
                  })}
                </div>
                <div className="mt-6 rounded-xl bg-[#f6faf6] p-4 text-xs leading-5 text-slate-600"><strong className="text-forest">Saathi tip:</strong> Stock status low-stock threshold aur expiry date ke basis par calculate hota hai. Product edit karke threshold badal sakte hain.</div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-forest p-5 text-white shadow-soft sm:p-6">
                <div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#c9efd7]">Saathi intelligence</span><Sparkles size={18} className="text-[#bce8c9]" /></div>
                <h2 className="mt-5 text-xl font-extrabold leading-7">Aaj ka stock summary</h2>
                <p className="mt-2 text-xs leading-5 text-white/65">Aapke device par saved inventory se.</p>
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3.5"><div className="flex items-center gap-2 text-[#c9efd7]"><ShoppingCart size={15} /><span className="text-xs font-bold">Reorder check</span></div><p className="mt-1.5 text-xs leading-5 text-white/80">{products.filter((product) => getStatus(product) === "Low stock").length ? products.filter((product) => getStatus(product) === "Low stock").map((product) => product.name).join(", ") + " — stock threshold par ya usse neeche hai." : "Abhi koi product low-stock threshold par nahi hai."}</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3.5"><div className="flex items-center gap-2 text-[#f8d99c]"><CalendarClock size={15} /><span className="text-xs font-bold">Expiry check</span></div><p className="mt-1.5 text-xs leading-5 text-white/80">{products.filter((product) => ["Expiring", "Expired"].includes(getStatus(product))).length ? products.filter((product) => ["Expiring", "Expired"].includes(getStatus(product))).map((product) => product.name).join(", ") + " — date check karein." : "Agle 7 din mein koi expiry alert nahi."}</p></div>
                </div>
                <p className="mt-5 text-[10px] text-white/50">Suggestions are rule-based; AI assistant is not connected yet.</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#e8eee8] bg-white shadow-soft">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-6">
                <div><h2 className="text-base font-extrabold text-ink">Your inventory</h2><p className="mt-1 text-xs text-slate-400">Add, edit and adjust stock. Changes save on this device.</p></div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or category" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-forest sm:w-[210px]" /></div>
                  <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl border border-[#dce9de] px-3 py-2.5 text-xs font-bold text-forest hover:bg-[#f4faf5]"><Plus size={14} /> Add item</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead><tr className="bg-[#fafcfa] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Cost / Sell</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-6 py-3">Actions</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((product) => {
                      const status = getStatus(product);
                      return <tr key={product.id} className="text-xs transition hover:bg-[#fbfdfb]">
                        <td className="px-6 py-4 font-bold text-ink">{product.name}</td>
                        <td className="px-4 py-4 text-slate-500">{product.category}</td>
                        <td className="px-4 py-4"><div className="font-semibold text-slate-700">{product.quantity} {product.unit}</div><div className="mt-1 text-[10px] text-slate-400">Alert at ≤ {product.lowStockAt}</div></td>
                        <td className="px-4 py-4 text-slate-600">{formatMoney(product.costPrice)} / {formatMoney(product.sellingPrice)}</td>
                        <td className="px-4 py-4 text-slate-500">{product.expiryDate || "—"}</td>
                        <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${status === "Healthy" ? "bg-emerald-50 text-emerald-700" : status === "Low stock" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span></td>
                        <td className="px-6 py-3"><div className="flex items-center gap-1"><button onClick={() => {setBatchProductId(product.id);setBatchForm({batchNo:"",quantity:"1",expiryDate:""});}} className="h-8 rounded-lg border border-[#dce9de] px-2 text-[10px] font-bold text-forest">+ Batch</button><button onClick={() => adjustStock(product, -1)} disabled={product.quantity <= 0} className="h-8 w-8 rounded-lg border border-slate-200 font-bold text-slate-600 disabled:opacity-30" aria-label={`Decrease ${product.name} stock`}>−</button><button onClick={() => adjustStock(product, 1)} className="h-8 w-8 rounded-lg border border-slate-200 font-bold text-slate-600" aria-label={`Increase ${product.name} stock`}>+</button><button onClick={() => openEdit(product)} className="ml-1 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-slate-600 hover:bg-slate-50"><Pencil size={12} /> Edit</button></div></td>
                      </tr>;
                    })}
                    {filteredProducts.length === 0 ? <tr><td colSpan={7} className="px-6 py-8 text-center text-xs text-slate-400">{products.length ? "No products match your search." : "Inventory empty. Add your first product."}</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><span className="text-[11px] text-slate-400">Showing {filteredProducts.length} of {products.length} products</span><span className="text-[10px] font-semibold text-emerald-700">{hydrated ? "Saved on this device" : "Loading..."}</span></div>
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft"><h2 className="text-base font-extrabold text-ink">Batch-wise expiry</h2><p className="mt-1 text-xs text-slate-400">Active lot-wise quantity and expiry</p><div className="mt-4 max-h-64 space-y-3 overflow-y-auto">{products.flatMap(product=>product.batches.filter(batch=>batch.quantity>0).map(batch=>({product,batch}))).sort((a,b)=>(a.batch.expiryDate||"9999").localeCompare(b.batch.expiryDate||"9999")).map(({product,batch})=><div key={batch.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f8fbf8] p-3"><div><p className="text-xs font-bold text-ink">{product.name}</p><p className="mt-1 text-[10px] text-slate-500">Batch {batch.batchNo} · {batch.quantity} {product.unit}</p></div><span className="text-[10px] font-bold text-slate-500">{batch.expiryDate||"No expiry"}</span></div>)}</div></div>
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft"><h2 className="text-base font-extrabold text-ink">Stock movement history</h2><p className="mt-1 text-xs text-slate-400">Latest 200 changes stored on this device</p><div className="mt-4 max-h-64 space-y-3 overflow-y-auto">{movements.slice(0,30).map(m=><div key={m.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{m.productName}</p><p className="mt-1 text-[10px] text-slate-500">{m.note} · {new Date(m.at).toLocaleString("en-IN")}</p></div><span className="text-[10px] font-bold text-forest">{m.type} {m.quantity}</span></div>)}{movements.length===0?<p className="text-xs text-slate-400">No movements yet.</p>:null}</div></div>
            </div>
            <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-[#cbdccc] bg-[#f8fbf8] p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-white p-2.5 text-forest shadow-sm"><Command size={18} /></div><div><p className="text-xs font-bold text-ink">Made for Indian small businesses</p><p className="mt-1 text-[11px] text-slate-500">Hindi-first workflows • Simple inventory • Clear stock visibility</p></div></div>
              <span className="text-[10px] font-semibold text-slate-400">STOCKSAATHI AI · INVENTORY PREVIEW</span>
            </div>
          </div>
        </section>
      </div>

      {batchProductId ? <div className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4"><form onSubmit={addBatch} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-extrabold text-ink">Receive new batch</h3><p className="mt-1 text-xs text-slate-500">{products.find(item=>item.id===batchProductId)?.name}</p><div className="mt-5 space-y-3"><input required maxLength={40} placeholder="Batch / lot number" value={batchForm.batchNo} onChange={e=>setBatchForm({...batchForm,batchNo:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input required type="number" min="0.01" step="any" placeholder="Quantity" value={batchForm.quantity} onChange={e=>setBatchForm({...batchForm,quantity:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input type="date" value={batchForm.expiryDate} onChange={e=>setBatchForm({...batchForm,expiryDate:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setBatchProductId(null)} className="rounded-xl px-4 py-2 text-xs font-bold">Cancel</button><button type="submit" className="rounded-xl bg-forest px-4 py-2 text-xs font-bold text-white">Save batch</button></div></form></div> : null}
      {showForm ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
        <div className="my-6 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between"><div><h3 className="text-lg font-extrabold text-ink">{editingId ? "Edit product" : "Add a product"}</h3><p className="mt-1 text-xs text-slate-500">Product details inventory mein save honge.</p></div><button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div>
          <form onSubmit={saveProduct} className="mt-5 space-y-4">
            <div><label htmlFor="product-name" className="text-xs font-bold text-slate-600">Product name *</label><input id="product-name" required maxLength={80} autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Tata Salt 1kg" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-forest" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="product-category" className="text-xs font-bold text-slate-600">Category</label><input id="product-category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div><div><label htmlFor="product-unit" className="text-xs font-bold text-slate-600">Unit</label><input id="product-unit" required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="pcs, kg, packet" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="product-quantity" className="text-xs font-bold text-slate-600">Current quantity</label><input id="product-quantity" type="number" min="0" step="any" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div><div><label htmlFor="product-threshold" className="text-xs font-bold text-slate-600">Low-stock alert at</label><input id="product-threshold" type="number" min="0" step="any" required value={form.lowStockAt} onChange={(event) => setForm({ ...form, lowStockAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="product-cost" className="text-xs font-bold text-slate-600">Purchase price (₹)</label><input id="product-cost" type="number" min="0" step="0.01" required value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div><div><label htmlFor="product-selling" className="text-xs font-bold text-slate-600">Selling price (₹)</label><input id="product-selling" type="number" min="0" step="0.01" required value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div></div>
            <div><label htmlFor="product-expiry" className="text-xs font-bold text-slate-600">Expiry date (optional)</label><input id="product-expiry" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-xl bg-forest px-5 py-2.5 text-xs font-bold text-white hover:bg-[#225238]">{editingId ? "Save changes" : "Add product"}</button></div>
          </form>
        </div>
      </div> : null}

      {notice ? <div role="status" className="fixed bottom-5 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check size={15} className="shrink-0 text-emerald-300" />{notice}</div> : null}
    </main>
  );
}
