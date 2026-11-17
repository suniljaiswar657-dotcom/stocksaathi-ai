"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, CalendarClock,
  Check, ChevronDown, CircleHelp, Command, LayoutDashboard,
  Menu, Mic, MessageCircle, PackagePlus, Pencil, Plus, Search, Send, Settings2, ShoppingCart,
  Sparkles, TrendingUp, Truck, Wallet, X,
} from "lucide-react";

type Batch = { id:string; batchNo:string; quantity:number; expiryDate:string; receivedAt:string };
type StockMovement = { id:string; productId:string; productName:string; type:'IN'|'OUT'|'ADJUSTMENT'; quantity:number; note:string; at:string };
type Sale = { id:string; productId:string; productName:string; quantity:number; unit:string; unitPrice:number; unitCost:number; revenue:number; cost:number; profit:number; soldAt:string };
type Supplier = { id:string; name:string; contact:string; notes:string; createdAt:string };
type Expense = { id:string; description:string; category:string; amount:number; spentAt:string; createdAt:string };
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
  supplierId?: string;
  reorderToLevel?: number;
};

type ProductStatus = "Healthy" | "Low stock" | "Expiring" | "Expired";

const STORAGE_KEY = "stocksaathi.inventory.v4";
const PREVIOUS_STORAGE_KEY = "stocksaathi.inventory.v3";
const OLDER_STORAGE_KEY = "stocksaathi.inventory.v2";
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
  { label: "Shop assistant", icon: MessageCircle },
  { label: "Inventory", icon: Boxes },
  { label: "Sales & profit", icon: TrendingUp },
  { label: "Expiry alerts", icon: CalendarClock },
  { label: "Suppliers & reorder", icon: Truck },
];

const emptyForm = {
  name: "", category: "Grocery", quantity: "1", unit: "units",
  costPrice: "0", sellingPrice: "0", lowStockAt: "5", expiryDate: "",
  supplierId: "", reorderToLevel: "10",
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
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [monthlyExpenseBudget,setMonthlyExpenseBudget]=useState(0);
  const [budgetInput,setBudgetInput]=useState("");
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [supplierForm,setSupplierForm]=useState({name:"",contact:"",notes:""});
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
  const [assistantInput,setAssistantInput]=useState("");
  const [assistantLanguage,setAssistantLanguage]=useState<"hi-IN"|"en-IN">("hi-IN");
  const [assistantMessages,setAssistantMessages]=useState<{role:"assistant"|"user";text:string}[]>([{role:"assistant",text:"Namaste! Main aapke saved stock, sales, profit aur suppliers ke data se jawab de sakti hoon. Example: “Maggi ka stock kitna hai?” ya “Aaj ka profit batao.”"}]);
  const [isListening,setIsListening]=useState(false);
  const [stopSpeech,setStopSpeech]=useState<(()=>void)|null>(null);
  const [pendingStockAction,setPendingStockAction]=useState<{productId:string;productName:string;quantity:number;direction:"IN"|"OUT"}|null>(null);
  const [pendingSaleAction,setPendingSaleAction]=useState<{productId:string;productName:string;quantity:number;unitPrice:number}|null>(null);
  const [pendingExpenseAction,setPendingExpenseAction]=useState<{description:string;category:string;amount:number;spentAt:string}|null>(null);
  const [editingExpenseId,setEditingExpenseId]=useState<string|null>(null);
  const [expenseForm,setExpenseForm]=useState({description:"",category:"Other",amount:"",spentAt:today()});
  const [expenseReportFrom,setExpenseReportFrom]=useState(dateInDays(-29));
  const [expenseReportTo,setExpenseReportTo]=useState(today());

  useEffect(() => {
    try {
      const saved=window.localStorage.getItem(STORAGE_KEY); const previous=window.localStorage.getItem(PREVIOUS_STORAGE_KEY); const older=window.localStorage.getItem(OLDER_STORAGE_KEY); const legacy=window.localStorage.getItem(LEGACY_STORAGE_KEY); const source=saved||previous||older||legacy;
      if(source){ const parsed:unknown=JSON.parse(source); if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&"products" in parsed){const data=parsed as {products:Product[];movements?:StockMovement[];sales?:Sale[];suppliers?:Supplier[];expenses?:Expense[];monthlyExpenseBudget?:number};if(Array.isArray(data.products))setProducts(data.products.map(normalizeProduct));if(Array.isArray(data.movements))setMovements(data.movements);if(Array.isArray(data.sales))setSales(data.sales);if(Array.isArray(data.suppliers))setSuppliers(data.suppliers);if(Array.isArray(data.expenses))setExpenses(data.expenses);if(typeof data.monthlyExpenseBudget==="number"&&Number.isFinite(data.monthlyExpenseBudget)&&data.monthlyExpenseBudget>=0){setMonthlyExpenseBudget(data.monthlyExpenseBudget);setBudgetInput(String(data.monthlyExpenseBudget));}}else if(Array.isArray(parsed)){setProducts((parsed as Product[]).map(normalizeProduct));setNotice("Purana inventory safely migrate ho gaya. Existing products preserve hain.");}}
    } catch {
      setNotice("Saved inventory could not be read. Demo data is shown.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({version:4,products,movements,sales,suppliers,expenses,monthlyExpenseBudget}));
    } catch {
      setNotice("Device storage is full. Changes may not persist.");
    }
  }, [products, movements, sales, suppliers, expenses, monthlyExpenseBudget, hydrated]);

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
  const totalExpenses=expenses.reduce((sum,expense)=>sum+expense.amount,0);
  const netProfit=totalProfit-totalExpenses;
  const currentMonth=today().slice(0,7);
  const monthExpenses=useMemo(()=>expenses.filter(expense=>expense.spentAt.slice(0,7)===currentMonth),[expenses,currentMonth]);
  const monthExpenseTotal=monthExpenses.reduce((sum,expense)=>sum+expense.amount,0);
  const budgetUsage=monthlyExpenseBudget>0?monthExpenseTotal/monthlyExpenseBudget*100:0;
  const budgetRemaining=monthlyExpenseBudget-monthExpenseTotal;
  const monthCategoryTotals=useMemo(()=>{const groups=new Map<string,number>();for(const expense of monthExpenses)groups.set(expense.category,(groups.get(expense.category)||0)+expense.amount);return Array.from(groups.entries()).map(([category,amount])=>({category,amount})).sort((x,y)=>y.amount-x.amount);},[monthExpenses]);
  const reportSales=useMemo(()=>sales.filter(sale=>sale.soldAt>=reportFrom&&sale.soldAt<=reportTo).sort((a,b)=>a.soldAt.localeCompare(b.soldAt)),[sales,reportFrom,reportTo]);
  const reportRevenue=reportSales.reduce((sum,sale)=>sum+sale.revenue,0);
  const reportCost=reportSales.reduce((sum,sale)=>sum+sale.cost,0);
  const reportProfit=reportSales.reduce((sum,sale)=>sum+sale.profit,0);
  const reportExpenses=useMemo(()=>expenses.filter(expense=>expense.spentAt>=reportFrom&&expense.spentAt<=reportTo),[expenses,reportFrom,reportTo]);
  const reportExpenseTotal=reportExpenses.reduce((sum,expense)=>sum+expense.amount,0);
  const reportNetProfit=reportProfit-reportExpenseTotal;
  const reportRows=useMemo(()=>{const groups=new Map<string,{label:string;revenue:number;cost:number;profit:number;expenses:number;netProfit:number;count:number}>();for(const sale of reportSales){const key=reportGrouping==="day"?sale.soldAt:sale.soldAt.slice(0,7);const row=groups.get(key)||{label:key,revenue:0,cost:0,profit:0,expenses:0,netProfit:0,count:0};row.revenue+=sale.revenue;row.cost+=sale.cost;row.profit+=sale.profit;row.count+=1;groups.set(key,row);}for(const expense of reportExpenses){const key=reportGrouping==="day"?expense.spentAt:expense.spentAt.slice(0,7);const row=groups.get(key)||{label:key,revenue:0,cost:0,profit:0,expenses:0,netProfit:0,count:0};row.expenses+=expense.amount;groups.set(key,row);}for(const row of groups.values())row.netProfit=row.profit-row.expenses;return Array.from(groups.values()).sort((x,y)=>y.label.localeCompare(x.label));},[reportSales,reportExpenses,reportGrouping]);
  const maxReportRevenue=Math.max(1,...reportRows.map(row=>row.revenue));
  const expenseReportItems=useMemo(()=>expenses.filter(expense=>expense.spentAt>=expenseReportFrom&&expense.spentAt<=expenseReportTo).sort((x,y)=>y.spentAt.localeCompare(x.spentAt)||y.createdAt.localeCompare(x.createdAt)),[expenses,expenseReportFrom,expenseReportTo]);
  const expenseReportDaily=useMemo(()=>{const groups=new Map<string,number>();for(const expense of expenseReportItems)groups.set(expense.spentAt,(groups.get(expense.spentAt)||0)+expense.amount);return Array.from(groups.entries()).map(([date,amount])=>({date,amount})).sort((x,y)=>y.date.localeCompare(x.date));},[expenseReportItems]);
  const expenseReportCategories=useMemo(()=>{const groups=new Map<string,number>();for(const expense of expenseReportItems)groups.set(expense.category,(groups.get(expense.category)||0)+expense.amount);return Array.from(groups.entries()).map(([category,amount])=>({category,amount})).sort((x,y)=>y.amount-x.amount);},[expenseReportItems]);
  const expenseReportTotal=expenseReportItems.reduce((sum,expense)=>sum+expense.amount,0);


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
      supplierId: product.supplierId || "",
      reorderToLevel: String(product.reorderToLevel ?? Math.max(product.lowStockAt * 2, product.lowStockAt + 1)),
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
      supplierId: form.supplierId || undefined,
      reorderToLevel: Math.max(lowStockAt, Number(form.reorderToLevel) || lowStockAt),
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

  function addSupplier(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const name=supplierForm.name.trim();
    if(!name){setNotice("Supplier name required hai.");return;}
    if(suppliers.some(item=>item.name.toLowerCase()===name.toLowerCase())){setNotice("Ye supplier pehle se saved hai.");return;}
    const supplier:Supplier={id:makeId(),name,contact:supplierForm.contact.trim(),notes:supplierForm.notes.trim(),createdAt:new Date().toISOString()};
    setSuppliers(current=>[supplier,...current]);
    setSupplierForm({name:"",contact:"",notes:""});
    setNotice(name+" supplier saved.");
  }

  const reorderSuggestions=products.filter(product=>product.quantity<=product.lowStockAt).map(product=>({...product,suggestedQty:Math.max(0,(product.reorderToLevel??Math.max(product.lowStockAt*2,product.lowStockAt+1))-product.quantity)})).filter(product=>product.suggestedQty>0);

  function parseStockAction(raw:string):{product:Product;quantity:number;direction:"IN"|"OUT"}|null {
    const q=raw.toLowerCase().replace(/[.,!?]/g," ").replace(/\s+/g," ").trim();
    const add=/\b(add|receive|received|increase|restock|jama|jamaa|jod|daal|dalo|bhar|bharo|badha|badhao|aaya|aaye)\b/.test(q);
    const remove=/\b(remove|subtract|decrease|reduce|nikal|hata|ghata|ghatao|kam karo|minus|out)\b/.test(q);
    if(add===remove)return null;
    const candidates=products.map(product=>({product,matched:product.name.toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>2&&q.includes(word)).sort((a,b)=>b.length-a.length)[0]||""})).filter(item=>item.matched).sort((a,b)=>b.matched.length-a.matched.length);
    if(!candidates.length||(candidates.length>1&&candidates[0].matched.length===candidates[1].matched.length))return null;
    const product=candidates[0].product;
    const withoutName=q.replace(product.name.toLowerCase()," ").replaceAll(candidates[0].matched," ");
    const quantityMatch=withoutName.match(/\b(\d+(?:\.\d+)?)\b/);
    if(!quantityMatch)return null;
    const quantity=Number(quantityMatch[1]);if(!Number.isFinite(quantity)||quantity<=0)return null;
    const unitMatch=q.match(/\b(packets?|packs?|packet|pcs|pieces?|units?|kg|kgs|grams?|g|litres?|liters?|bottles?|boxes?|loaves?|pouches?)\b/);
    if(unitMatch){
      const aliases:Record<string,string>={pack:"packet",packs:"packet",packet:"packet",packets:"packet",pcs:"piece",pieces:"piece",piece:"piece",units:"unit",unit:"unit",kg:"kg",kgs:"kg",gram:"gram",grams:"gram",g:"gram",litre:"litre",litres:"litre",liter:"litre",liters:"litre",bottle:"bottle",bottles:"bottle",box:"box",boxes:"box",loaf:"loaf",loaves:"loaf",pouch:"pouch",pouches:"pouch"};
      const spoken=aliases[unitMatch[1]]||unitMatch[1];
      const saved=aliases[product.unit.toLowerCase()]||product.unit.toLowerCase().replace(/s$/,"");
      if(spoken!==saved)return null;
    }
    return {product,quantity,direction:add?"IN":"OUT"};
  }

  function parseNaturalSale(raw:string):{product:Product;quantity:number;unitPrice:number}|null {
    const q=raw.toLowerCase().replace(/,/g," ").replace(/\s+/g," ").trim();
    if(!/\b(sell|sold|sale|becho| बेचो|bikri|nikaal do)\b/.test(q))return null;
    const candidates=products.map(product=>({product,matched:product.name.toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>2&&q.includes(word)).sort((x,y)=>y.length-x.length)[0]||""})).filter(item=>item.matched).sort((x,y)=>y.matched.length-x.matched.length);
    if(!candidates.length||(candidates.length>1&&candidates[0].matched.length===candidates[1].matched.length))return null;
    const product=candidates[0].product;
    const currencyPrice=q.match(/(?:₹|rs\.?|rupees?\s*)(\d+(?:\.\d+)?)/);
    const suffixPrice=q.match(/(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?)/);
    const priceMatch=currencyPrice||suffixPrice;
    if(!priceMatch)return null;
    const unitPrice=Number(priceMatch[1]);
    if(!Number.isFinite(unitPrice)||unitPrice<=0)return null;
    const priceToken=priceMatch[0];
    const withoutPrice=q.replace(priceToken," ");
    const withoutProduct=withoutPrice.replaceAll(candidates[0].matched," ");
    const numbers=[...withoutProduct.matchAll(/\b(\d+(?:\.\d+)?)\b/g)];
    const quantityToken=numbers[0]?.[1];
    const quantity=Number(quantityToken);
    if(!Number.isFinite(quantity)||quantity<=0)return null;
    const unitMatch=q.match(/\b(packets?|packs?|packet|pcs|pieces?|units?|kg|kgs|grams?|g|litres?|liters?|bottles?|boxes?|loaves?|pouches?)\b/);
    if(unitMatch){
      const aliases:Record<string,string>={pack:"pack",packs:"pack",packet:"packet",packets:"packet",pcs:"piece",pieces:"piece",piece:"piece",units:"unit",unit:"unit",kg:"kg",kgs:"kg",gram:"gram",grams:"gram",g:"gram",litre:"litre",litres:"litre",liter:"litre",liters:"litre",bottle:"bottle",bottles:"bottle",box:"box",boxes:"box",loaf:"loaf",loaves:"loaf",pouch:"pouch",pouches:"pouch"};
      const spoken=aliases[unitMatch[1]]||unitMatch[1];
      const saved=aliases[product.unit.toLowerCase()]||product.unit.toLowerCase().replace(/s$/,"");
      if(spoken!==saved)return null;
    }
    return {product,quantity,unitPrice};
  }

  function confirmAssistantSale(){
    if(!pendingSaleAction)return;
    const product=products.find(item=>item.id===pendingSaleAction.productId);
    if(!product){setNotice("Product ab inventory mein nahi mila. Sale cancel.");setPendingSaleAction(null);return;}
    const {quantity,unitPrice}=pendingSaleAction;
    if(quantity>product.quantity){setNotice("Current stock sirf "+product.quantity+" "+product.unit+" hai. Sale cancel.");setPendingSaleAction(null);return;}
    const remainingAfter=product.quantity-quantity;
    let remaining=quantity;
    const batches=[...product.batches].sort((x,y)=>x.receivedAt.localeCompare(y.receivedAt)).map(batch=>{const used=Math.min(batch.quantity,remaining);remaining-=used;return {...batch,quantity:batch.quantity-used};});
    const revenue=quantity*unitPrice;
    const cost=quantity*product.costPrice;
    const sale:Sale={id:makeId(),productId:product.id,productName:product.name,quantity,unit:product.unit,unitPrice,unitCost:product.costPrice,revenue,cost,profit:revenue-cost,soldAt:today()};
    const updated=normalizeProduct({...product,batches,quantity:sumBatches(batches)});
    setProducts(current=>current.map(item=>item.id===product.id?updated:item));
    setSales(current=>[sale,...current].slice(0,1000));
    setMovements(current=>[{id:makeId(),productId:product.id,productName:product.name,type:"OUT",quantity,note:"Assistant sale confirmed · "+formatMoney(revenue),at:new Date().toISOString()},...current].slice(0,200));
    setAssistantMessages(current=>[...current,{role:"assistant",text:"Sale confirmed and saved: "+quantity+" "+product.unit+" "+product.name+" × "+formatMoney(unitPrice)+". Revenue "+formatMoney(revenue)+", product cost "+formatMoney(cost)+", gross profit "+formatMoney(sale.profit)+". Remaining stock "+remainingAfter+" "+product.unit+"."}].slice(-30));
    setPendingSaleAction(null);
    setNotice("Sale saved. Gross profit: "+formatMoney(sale.profit));
  }

  function parseNaturalExpense(raw:string):{description:string;category:string;amount:number;spentAt:string}|null {
    const q=raw.toLowerCase().replace(/,/g," ").replace(/\s+/g," ").trim();
    if(!/\b(expense|spent|spend|paid|payment|diya|diye|di|kharcha|kharch|bhar diya|jama kiya)\b/.test(q))return null;
    const amountMatch=q.match(/(?:₹\s*|rs\.?\s*|rupees?\s*)(\d+(?:\.\d+)?)/)||q.match(/(\d+(?:\.\d+)?)\s*(?:rupees?|rs\.?)/);
    if(!amountMatch)return null;
    const amount=Number(amountMatch[1]);
    if(!Number.isFinite(amount)||amount<=0)return null;
    let description=q.replace(amountMatch[0]," ").replace(/\b(aaj|today|kal|yesterday|expense|spent|spend|paid|payment|diya|diye|di|kharcha|kharch|bhar|jama|kiya|the|was|for)\b/g," ").replace(/\s+/g," ").trim();
    description=description.replace(/^(ka|ke|ki|the)\s+/,"").replace(/\s+(ka|ke|ki)$/,"").trim();
    if(!description)return null;
    const category=/\b(bijli|electricity|power|water|paani|internet|wifi|gas|telephone|mobile recharge|utility|bill)\b/.test(description)?"Utilities"
      :/\b(rent|kiraya|lease|shop rent)\b/.test(description)?"Rent"
      :/\b(salary|wages|mazdoori|staff|worker|helper)\b/.test(description)?"Staff"
      :/\b(petrol|diesel|transport|delivery|fuel|travel|auto fare|rickshaw)\b/.test(description)?"Transport"
      :/\b(repair|maintenance|marammat|plumber|electrician)\b/.test(description)?"Repairs"
      :/\b(packaging|packing|wrapper|carry bag)\b/.test(description)?"Packaging"
      :/\b(advertising|advertisement|marketing|promotion|poster)\b/.test(description)?"Marketing"
      :/\b(bank charge|bank fee|transaction fee|upi charge|payment fee)\b/.test(description)?"Bank charges"
      :/\b(purchase|stationery|cleaning|supplies|samaan)\b/.test(description)?"Supplies"
      :/\b(tea|chai|food|lunch|snacks|nashta|khana)\b/.test(description)?"Food & refreshments":"Other";
    const spentAt=/\b(kal|yesterday)\b/.test(q)?dateInDays(-1):today();
    return {description,category,amount,spentAt};
  }

  function saveMonthlyExpenseBudget(){
    const amount=Number(budgetInput);
    if(!Number.isFinite(amount)||amount<0){setNotice("Monthly budget valid amount enter karein.");return;}
    setMonthlyExpenseBudget(amount);
    setNotice(amount===0?"Monthly expense budget disabled.":"Monthly expense budget saved: "+formatMoney(amount));
  }

  function downloadExpenseCsv(){
    if(expenseReportFrom>expenseReportTo){setNotice("Report ki start date end date se pehle honi chahiye.");return;}
    const escapeCsv=(value:string|number)=>{let text=String(value);if(/^[=+@]/.test(text)||(/^-(?!\d+(?:\.\d+)?$)/.test(text))||text.startsWith("\t")||text.startsWith("\r"))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows:string[][]=[["Record type","Date","Description","Category","Amount (INR)"]];
    for(const expense of expenseReportItems)rows.push(["Expense",expense.spentAt,expense.description,expense.category,String(expense.amount)]);
    rows.push(["","","","",""]);
    rows.push(["Daily total","Date","","","Amount (INR)"]);
    for(const item of expenseReportDaily)rows.push(["Daily total",item.date,"","",String(item.amount)]);
    rows.push(["","","","",""]);
    rows.push(["Category total","","","Category","Amount (INR)"]);
    for(const item of expenseReportCategories)rows.push(["Category total","","",item.category,String(item.amount)]);
    rows.push(["Grand total","","","",String(expenseReportTotal)]);
    const csv="\uFEFF"+rows.map(row=>row.map(escapeCsv).join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="stocksaathi-expense-report-"+expenseReportFrom+"-to-"+expenseReportTo+".csv";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    setNotice("Expense CSV report download start ho gaya.");
  }

  function downloadProfitLossCsv(){
    if(reportFrom>reportTo){setNotice("Report ki start date end date se pehle honi chahiye.");return;}
    const escapeCsv=(value:string|number)=>{let text=String(value);if(/^[=+@-]/.test(text)||text.startsWith("\\t")||text.startsWith("\\r"))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows:string[][]=[["Record type","Date / period","Description / category","Quantity","Unit","Revenue (INR)","Product cost (INR)","Gross profit (INR)","Expenses (INR)","Net profit (INR)"]];
    for(const sale of reportSales)rows.push(["Sale",sale.soldAt,sale.productName,String(sale.quantity),sale.unit,String(sale.revenue),String(sale.cost),String(sale.profit),"",""]);
    for(const expense of reportExpenses)rows.push(["Expense",expense.spentAt,expense.description+" / "+expense.category,"","","","","",String(expense.amount),""]);
    rows.push(["","","","","","","","","",""]);
    rows.push(["P&L "+(reportGrouping==="day"?"daily":"monthly")+" total","Period","Description","Quantity","Unit","Revenue (INR)","Product cost (INR)","Gross profit (INR)","Expenses (INR)","Net profit (INR)"]);
    for(const row of reportRows)rows.push(["P&L total",row.label,"","","",String(row.revenue),String(row.cost),String(row.profit),String(row.expenses),String(row.netProfit)]);
    rows.push(["GRAND TOTAL",reportFrom+" to "+reportTo,"","","",String(reportRevenue),String(reportCost),String(reportProfit),String(reportExpenseTotal),String(reportNetProfit)]);
    const csv="\\uFEFF"+rows.map(row=>row.map(escapeCsv).join(",")).join("\\r\\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="stocksaathi-profit-loss-"+reportFrom+"-to-"+reportTo+".csv";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    setNotice("Profit & Loss CSV download start ho gaya.");
  }

  function printProfitLoss(){
    if(reportFrom>reportTo){setNotice("Report ki start date end date se pehle honi chahiye.");return;}
    window.print();
  }

  function openExpenseEdit(expense:Expense){
    setEditingExpenseId(expense.id);
    setExpenseForm({description:expense.description,category:expense.category,amount:String(expense.amount),spentAt:expense.spentAt});
  }

  function saveExpenseEdit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const description=expenseForm.description.trim();
    const category=expenseForm.category.trim();
    const amount=Number(expenseForm.amount);
    const spentAt=expenseForm.spentAt;
    if(!editingExpenseId)return;
    if(!description||!category||!spentAt||!Number.isFinite(amount)||amount<=0){setNotice("Description, category, valid amount aur date required hain.");return;}
    const existing=expenses.find(item=>item.id===editingExpenseId);
    if(!existing){setEditingExpenseId(null);setNotice("Expense record nahi mila. List refresh karke dobara try karein.");return;}
    setExpenses(current=>current.map(item=>item.id===editingExpenseId?{...item,description,category,amount,spentAt}:item));
    setEditingExpenseId(null);
    setNotice("Expense updated. Net profit aur reports recalculate ho gaye.");
  }

  function confirmAssistantExpense(){
    if(!pendingExpenseAction)return;
    const expense:Expense={id:makeId(),description:pendingExpenseAction.description,category:pendingExpenseAction.category,amount:pendingExpenseAction.amount,spentAt:pendingExpenseAction.spentAt,createdAt:new Date().toISOString()};
    setExpenses(current=>[expense,...current].slice(0,2000));
    setAssistantMessages(current=>[...current,{role:"assistant",text:"Expense confirmed and saved: "+expense.description+" · "+formatMoney(expense.amount)+" · "+expense.category+" · "+expense.spentAt+". Updated total expenses "+formatMoney(totalExpenses+expense.amount)+", net profit "+formatMoney(totalProfit-totalExpenses-expense.amount)+"."}].slice(-30));
    setPendingExpenseAction(null);
    setNotice("Expense saved: "+formatMoney(expense.amount));
  }

  function processAssistantInput(raw:string){
    const expenseAction=parseNaturalExpense(raw);
    if(expenseAction){
      setPendingStockAction(null);setPendingSaleAction(null);setPendingExpenseAction(expenseAction);
      setAssistantMessages(current=>[...current,{role:"user",text:raw},{role:"assistant",text:"Expense confirmation required: "+expenseAction.description+" · "+formatMoney(expenseAction.amount)+" · "+expenseAction.category+" · Date "+expenseAction.spentAt+". Confirm karne par expense record hoga. Estimated net profit "+formatMoney(totalProfit-totalExpenses-expenseAction.amount)+"."}].slice(-30));
      return;
    }
    const saleAction=parseNaturalSale(raw);
    if(saleAction){
      setPendingExpenseAction(null);setPendingStockAction(null);
      setPendingSaleAction({productId:saleAction.product.id,productName:saleAction.product.name,quantity:saleAction.quantity,unitPrice:saleAction.unitPrice});
      const revenue=saleAction.quantity*saleAction.unitPrice;
      const profit=revenue-saleAction.quantity*saleAction.product.costPrice;
      setAssistantMessages(current=>[...current,{role:"user",text:raw},{role:"assistant",text:"Sale confirmation required: "+saleAction.quantity+" "+saleAction.product.unit+" "+saleAction.product.name+" at "+formatMoney(saleAction.unitPrice)+" each. Revenue "+formatMoney(revenue)+", estimated gross profit "+formatMoney(profit)+". Current stock "+saleAction.product.quantity+" "+saleAction.product.unit+". Confirm karne par sale save hogi aur FIFO stock deduct hoga."}].slice(-30));
      return;
    }
    const action=parseStockAction(raw);
    if(action){
      setPendingExpenseAction(null);setPendingSaleAction(null);
      setPendingStockAction({productId:action.product.id,productName:action.product.name,quantity:action.quantity,direction:action.direction});
      const verb=action.direction==="IN"?"add":"remove";
      setAssistantMessages(current=>[...current,{role:"user",text:raw},{role:"assistant",text:"Confirmation required: "+action.quantity+" "+action.product.unit+" "+action.product.name+" ke stock mein "+verb+" honge. Current stock "+action.product.quantity+" "+action.product.unit+". Confirm karne ke baad hi inventory change hogi."}].slice(-30));
      return;
    }
    const answer=answerShopQuestion(raw);
    setAssistantMessages(current=>[...current,{role:"user",text:raw},{role:"assistant",text:answer}].slice(-30));
  }

  function confirmStockAction(){
    if(!pendingStockAction)return;
    const product=products.find(item=>item.id===pendingStockAction.productId);
    if(!product){setNotice("Product ab inventory mein nahi mila. Action cancel kar diya.");setPendingStockAction(null);return;}
    if(pendingStockAction.direction==="OUT"&&pendingStockAction.quantity>product.quantity){setNotice("Current stock sirf "+product.quantity+" "+product.unit+" hai. Action cancel.");setPendingStockAction(null);return;}
    const amount=pendingStockAction.direction==="IN"?pendingStockAction.quantity:-pendingStockAction.quantity;
    adjustStock(product,amount);
    setAssistantMessages(current=>[...current,{role:"assistant",text:"Confirmed. "+product.name+" stock "+(amount>0?"increased":"reduced")+" by "+Math.abs(amount)+" "+product.unit+". New quantity: "+(product.quantity+amount)+" "+product.unit+"."}].slice(-30));
    setPendingStockAction(null);
  }

  function answerShopQuestion(raw:string):string {
    const q=raw.trim().toLowerCase();
    if(!q)return "Please apna question type ya bolkar batayein.";
    const low=products.filter(p=>p.quantity<=p.lowStockAt);
    const matched=products.find(p=>q.includes(p.name.toLowerCase())||p.name.toLowerCase().split(/\s+/).some(w=>w.length>2&&q.includes(w)));
    if(/\b(low stock|kam stock|stock kam|reorder|order karna|khatam|shortage)\b/.test(q)){
      if(!low.length)return "Abhi kisi product ka stock low-stock threshold par ya neeche nahi hai.";
      return "Low-stock items: "+low.map(p=>{const target=p.reorderToLevel??Math.max(p.lowStockAt*2,p.lowStockAt+1);const supplier=suppliers.find(x=>x.id===p.supplierId);return p.name+": "+p.quantity+" "+p.unit+" available, "+Math.max(0,target-p.quantity)+" "+p.unit+" reorder karein"+(supplier?" ("+supplier.name+")":"");}).join("; ")+".";
    }
    if(/\b(sales|sale|revenue|bikri|aamdani)\b/.test(q)){
      const day=sales.filter(x=>x.soldAt===today());const revenue=day.reduce((n,x)=>n+x.revenue,0);
      if(/\b(today|aaj)\b/.test(q))return "Aaj "+day.length+" sales record hui. Revenue "+formatMoney(revenue)+".";
      return "Saved sales ka total revenue "+formatMoney(totalRevenue)+", product cost "+formatMoney(totalCost)+" hai.";
    }
    if(/\b(budget|monthly limit|mahine ka budget|mahina budget)\b/.test(q)){
      if(monthlyExpenseBudget<=0)return "Abhi monthly expense budget set nahi hai. Sales & profit mein monthly budget enter karein.";
      return "Is month expenses "+formatMoney(monthExpenseTotal)+" / "+formatMoney(monthlyExpenseBudget)+" ("+Math.round(budgetUsage)+"%). "+(budgetRemaining<0?"Budget "+formatMoney(Math.abs(budgetRemaining))+" se cross ho gaya.":"Budget mein "+formatMoney(budgetRemaining)+" remaining hai.")+" Top categories: "+(monthCategoryTotals.slice(0,3).map(x=>x.category+" "+formatMoney(x.amount)).join(", ")||"No expenses")+".";
    }
    if(/\b(expense|expenses|kharcha|kharch|spending|bijli bill)\b/.test(q)){
      const day=expenses.filter(x=>x.spentAt===today());const dayTotal=day.reduce((n,x)=>n+x.amount,0);
      if(/\b(today|aaj)\b/.test(q))return "Aaj "+day.length+" expenses record hue. Total expense "+formatMoney(dayTotal)+". Net profit "+formatMoney(sales.filter(x=>x.soldAt===today()).reduce((n,x)=>n+x.profit,0)-dayTotal)+".";
      return "Saved expenses "+formatMoney(totalExpenses)+". Gross profit "+formatMoney(totalProfit)+". Net profit "+formatMoney(netProfit)+".";
    }
    if(/\b(net profit|net munafa|net fayda)\b/.test(q)){
      if(/\b(today|aaj)\b/.test(q)){const dayGross=sales.filter(x=>x.soldAt===today()).reduce((n,x)=>n+x.profit,0);const dayExpenses=expenses.filter(x=>x.spentAt===today()).reduce((n,x)=>n+x.amount,0);return "Aaj ka net profit "+formatMoney(dayGross-dayExpenses)+" (gross profit "+formatMoney(dayGross)+" − expenses "+formatMoney(dayExpenses)+").";}
      return "Net profit = gross profit − recorded expenses. Current net profit "+formatMoney(netProfit)+". Unrecorded costs, tax and fees excluded.";
    }
    if(/\b(profit|munafa|faayda|fayda)\b/.test(q)){
      const day=sales.filter(x=>x.soldAt===today());const profit=day.reduce((n,x)=>n+x.profit,0);const dayExpenses=expenses.filter(x=>x.spentAt===today()).reduce((n,x)=>n+x.amount,0);
      if(/\b(today|aaj)\b/.test(q))return "Aaj gross profit "+formatMoney(profit)+", recorded expenses "+formatMoney(dayExpenses)+" aur net profit "+formatMoney(profit-dayExpenses)+" hai.";
      return "Recorded gross profit "+formatMoney(totalProfit)+", expenses "+formatMoney(totalExpenses)+" aur net profit "+formatMoney(netProfit)+" hai.";
    }
    if(/\b(supplier|suppliers|vendor|distributor)\b/.test(q)){
      if(matched){const supplier=suppliers.find(x=>x.id===matched.supplierId);return supplier?matched.name+" ka preferred supplier "+supplier.name+" hai. Contact: "+(supplier.contact||"saved nahi hai")+".":matched.name+" ke saath abhi koi supplier linked nahi hai.";}
      return suppliers.length?"Saved suppliers: "+suppliers.map(x=>x.name+(x.contact?" ("+x.contact+")":"")).join(", ")+".":"Abhi koi supplier saved nahi hai.";
    }
    if(matched)return matched.name+": available stock "+matched.quantity+" "+matched.unit+", purchase price "+formatMoney(matched.costPrice)+", selling price "+formatMoney(matched.sellingPrice)+", status "+getStatus(matched)+".";
    if(/\b(stock|inventory|maal|samaan|item|product)\b/.test(q))return "Inventory mein "+products.length+" products hain. Total stock cost "+formatMoney(inventoryValue)+". Low-stock items "+low.length+". Kisi product ka naam poochhein for exact quantity.";
    return "Main saved inventory, stock, suppliers, sales, expenses aur net profit ke questions answer kar sakti hoon. Example: “Aaj ₹500 bijli bill diya”, “Aaj ka net profit”, “Aaj ki sales” ya “Low stock items”.";
  }

  function submitAssistantQuestion(event?:FormEvent<HTMLFormElement>){
    event?.preventDefault();const question=assistantInput.trim();if(!question)return;
    processAssistantInput(question);setAssistantInput("");
  }

  function handleVoice() {
    type SpeechResultEvent={results:ArrayLike<ArrayLike<{transcript:string}>>};
    type SpeechRecognitionLike={lang:string;interimResults:boolean;maxAlternatives:number;onresult:((event:SpeechResultEvent)=>void)|null;onerror:(()=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
    type SpeechWindow=Window&{SpeechRecognition?:new()=>SpeechRecognitionLike;webkitSpeechRecognition?:new()=>SpeechRecognitionLike};
    const speechWindow=window as SpeechWindow;const Recognition=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!Recognition){setNotice("Is browser mein voice recognition supported nahi. Text assistant use karein.");return;}
    if(isListening){stopSpeech?.();setIsListening(false);setStopSpeech(null);return;}
    const recognition=new Recognition();recognition.lang=assistantLanguage;recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onresult=(event)=>{const transcript=event.results[0]?.[0]?.transcript||"";if(transcript){setAssistantInput("");processAssistantInput(transcript);if("speechSynthesis" in window){const utterance=new SpeechSynthesisUtterance("Request received. Please check the screen and confirm before any record is saved.");utterance.lang=assistantLanguage;window.speechSynthesis.speak(utterance);}}};
    recognition.onerror=()=>{setIsListening(false);setNotice("Voice capture nahi ho paya. Text se question pooch sakte hain.");};
    recognition.onend=()=>{setIsListening(false);setStopSpeech(null);};setStopSpeech(()=>()=>recognition.stop());setIsListening(true);recognition.start();
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

            {activeNav==="Shop assistant" ? <div className="mt-7 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Hindi + English shop assistant</h2><p className="mt-1 text-xs text-slate-400">Answers use this device's saved inventory and sales.</p></div><select value={assistantLanguage} onChange={e=>setAssistantLanguage(e.target.value as "hi-IN"|"en-IN")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="hi-IN">Hindi voice</option><option value="en-IN">English voice</option></select></div>
                <div className="mt-5 max-h-[440px] min-h-[260px] space-y-3 overflow-y-auto rounded-xl bg-[#f8fbf8] p-3">{assistantMessages.map((message,index)=><div key={index} className={message.role==="user"?"ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-forest px-4 py-3 text-xs leading-5 text-white":"mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-100 bg-white px-4 py-3 text-xs leading-5 text-slate-700"}>{message.text}</div>)}</div>
                <form onSubmit={submitAssistantQuestion} className="mt-4 flex gap-2"><input value={assistantInput} onChange={e=>setAssistantInput(e.target.value)} placeholder="Maggi stock kitna hai? / Today's profit?" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-forest"/><button type="submit" aria-label="Send question" className="rounded-xl bg-forest px-4 text-white"><Send size={17}/></button><button type="button" onClick={handleVoice} aria-label="Start voice input" className={isListening?"rounded-xl bg-amber-100 px-4 text-amber-800":"rounded-xl border border-slate-200 px-4 text-forest"}><Mic size={17}/></button></form>
                {pendingExpenseAction ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-extrabold text-amber-900">Confirm expense</p><p className="mt-2 text-sm font-bold text-ink">{pendingExpenseAction.description}</p><p className="mt-1 text-xs text-slate-700">Amount: {formatMoney(pendingExpenseAction.amount)} · Category: {pendingExpenseAction.category} · Date: {pendingExpenseAction.spentAt}</p><p className="mt-1 text-xs text-slate-700">Net profit after expense: {formatMoney(totalProfit-totalExpenses-pendingExpenseAction.amount)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={confirmAssistantExpense} className="rounded-lg bg-forest px-4 py-2 text-xs font-bold text-white">Confirm expense</button><button type="button" onClick={()=>{setPendingExpenseAction(null);setAssistantMessages(current=>[...current,{role:"assistant",text:"Expense cancelled. No expense record was saved."}].slice(-30));}} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancel</button></div></div>:null}
                {pendingSaleAction ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-extrabold text-emerald-900">Confirm sale</p><p className="mt-2 text-sm font-bold text-ink">{pendingSaleAction.quantity} {products.find(p=>p.id===pendingSaleAction.productId)?.unit||"units"} — {pendingSaleAction.productName}</p><p className="mt-1 text-xs text-slate-700">Selling price: {formatMoney(pendingSaleAction.unitPrice)} each · Revenue: {formatMoney(pendingSaleAction.quantity*pendingSaleAction.unitPrice)}</p><p className="mt-1 text-xs text-slate-700">Product cost: {formatMoney(pendingSaleAction.quantity*(products.find(p=>p.id===pendingSaleAction.productId)?.costPrice||0))} · Gross profit: {formatMoney(pendingSaleAction.quantity*(pendingSaleAction.unitPrice-(products.find(p=>p.id===pendingSaleAction.productId)?.costPrice||0)))}</p><p className="mt-1 text-xs text-slate-600">Available: {products.find(p=>p.id===pendingSaleAction.productId)?.quantity??"Unavailable"} · After sale: {Math.max(0,(products.find(p=>p.id===pendingSaleAction.productId)?.quantity??0)-pendingSaleAction.quantity)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={confirmAssistantSale} className="rounded-lg bg-forest px-4 py-2 text-xs font-bold text-white">Confirm sale</button><button type="button" onClick={()=>{setPendingSaleAction(null);setAssistantMessages(current=>[...current,{role:"assistant",text:"Sale cancelled. Stock aur sales record unchanged hain."}].slice(-30));}} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancel</button></div></div>:null}
                {pendingStockAction ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-extrabold text-amber-900">Confirm inventory change</p><p className="mt-2 text-sm font-bold text-ink">{pendingStockAction.direction==="IN"?"Add":"Remove"} {pendingStockAction.quantity} {products.find(p=>p.id===pendingStockAction.productId)?.unit||"units"} — {pendingStockAction.productName}</p><p className="mt-1 text-xs text-slate-600">Current stock: {products.find(p=>p.id===pendingStockAction.productId)?.quantity??"Unavailable"} · After action: {((products.find(p=>p.id===pendingStockAction.productId)?.quantity??0)+(pendingStockAction.direction==="IN"?pendingStockAction.quantity:-pendingStockAction.quantity))}</p><div className="mt-3 flex gap-2"><button type="button" onClick={confirmStockAction} className="rounded-lg bg-forest px-4 py-2 text-xs font-bold text-white">Confirm change</button><button type="button" onClick={()=>{setPendingStockAction(null);setAssistantMessages(current=>[...current,{role:"assistant",text:"Cancelled. Inventory mein koi change nahi hua."}].slice(-30));}} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancel</button></div></div>:null}
                <p className="mt-3 text-[10px] text-slate-400">{isListening?"Listening… Speak now.":"Voice needs browser support and microphone permission. Text mode always available."}</p>
              </div>
              <div className="space-y-4"><div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft"><h3 className="text-sm font-extrabold text-ink">Try asking</h3><div className="mt-3 space-y-2 text-xs text-slate-600"><p>• Maggi ka stock kitna hai?</p><p>• Which items are low stock?</p><p>• Aaj ki sales kitni hui?</p><p>• Total gross profit batao</p><p>• Amul milk ka supplier kaun hai?</p></div></div><div className="rounded-2xl bg-ink p-5 text-white"><div className="flex items-center gap-2"><Sparkles size={17}/><h3 className="text-sm font-extrabold">Data-grounded, not guesswork</h3></div><p className="mt-3 text-xs leading-5 text-white/70">Assistant saved products, quantities, supplier links aur recorded sales ko read karke calculations se jawab deta hai.</p><p className="mt-3 text-[10px] text-white/50">No external AI API, no extra cost, no cloud upload. Speech support browser par depend karta hai.</p></div></div>
            </div> : null}

            {activeNav==="Suppliers & reorder" ? <div className="mt-7 space-y-6">
              <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                <form onSubmit={addSupplier} className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                  <h2 className="text-base font-extrabold text-ink">Add supplier</h2>
                  <p className="mt-1 text-xs text-slate-400">Supplier details is device par locally save honge.</p>
                  <div className="mt-5 space-y-3">
                    <input required maxLength={80} value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm,name:e.target.value})} placeholder="Supplier / distributor name" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
                    <input maxLength={40} value={supplierForm.contact} onChange={e=>setSupplierForm({...supplierForm,contact:e.target.value})} placeholder="Phone / contact (optional)" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
                    <textarea maxLength={240} value={supplierForm.notes} onChange={e=>setSupplierForm({...supplierForm,notes:e.target.value})} placeholder="Notes, delivery day, shop address..." rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/>
                  </div>
                  <button type="submit" className="mt-4 w-full rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white">Save supplier</button>
                </form>
                <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                  <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Supplier directory</h2><p className="mt-1 text-xs text-slate-400">{suppliers.length} saved suppliers</p></div><span className="rounded-lg bg-[#eff8f1] px-3 py-2 text-xs font-bold text-forest">{products.filter(p=>p.supplierId).length} linked products</span></div>
                  <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto">
                    {suppliers.map(supplier=><div key={supplier.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink">{supplier.name}</p><p className="mt-1 text-xs text-slate-500">{supplier.contact||"No contact added"}</p>{supplier.notes?<p className="mt-1 text-[10px] text-slate-400">{supplier.notes}</p>:null}</div><span className="rounded-full bg-[#eff8f1] px-2.5 py-1 text-[10px] font-bold text-forest">{products.filter(p=>p.supplierId===supplier.id).length} items</span></div></div>)}
                    {suppliers.length===0?<p className="py-10 text-center text-xs text-slate-400">Abhi supplier saved nahi hai. Pehla supplier add karein.</p>:null}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Automatic reorder suggestions</h2><p className="mt-1 text-xs text-slate-400">Current stock low-stock threshold tak aate hi reorder quantity calculate hoti hai.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">{reorderSuggestions.length} items to review</span></div>
                <div className="mt-4 space-y-3">
                  {reorderSuggestions.map(product=>{const supplier=suppliers.find(item=>item.id===product.supplierId);return <div key={product.id} className="grid gap-3 rounded-xl border border-amber-100 bg-[#fffdf8] p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-bold text-ink">{product.name}</p><p className="mt-1 text-xs text-slate-500">Available: {product.quantity} {product.unit} · Alert at: {product.lowStockAt} · Target: {product.reorderToLevel??Math.max(product.lowStockAt*2,product.lowStockAt+1)} {product.unit}</p><p className="mt-1 text-[10px] text-slate-500">Supplier: {supplier?.name||"Not assigned — edit product to link supplier"}</p></div><div className="text-left sm:text-right"><p className="text-lg font-extrabold text-forest">Order {product.suggestedQty} {product.unit}</p><p className="text-[10px] text-slate-400">Est. cost {formatMoney(product.suggestedQty*product.costPrice)}</p></div></div>})}
                  {reorderSuggestions.length===0?<p className="py-10 text-center text-xs text-slate-400">Abhi reorder ki zaroorat nahi. Stock threshold se upar hai.</p>:null}
                </div>
                <p className="mt-4 text-[10px] text-slate-400">Formula: target stock level − current stock. Ye planning suggestion hai; purchase order ya supplier ko message automatically send nahi hota.</p>
              </div>
            </div> : null}

            {activeNav==="Sales & profit" ? <div className="mt-7 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total revenue" value={formatMoney(totalRevenue)} note={sales.length+" recorded sales"} icon={Wallet}/><MetricCard label="Cost of goods sold" value={formatMoney(totalCost)} note="Based on saved purchase cost" icon={Boxes}/><MetricCard label="Gross profit" value={formatMoney(totalProfit)} note="Revenue minus product cost" icon={TrendingUp} trend={totalProfit>=0?"up":"down"}/><MetricCard label="Net profit" value={formatMoney(netProfit)} note={formatMoney(totalExpenses)+" recorded expenses"} icon={TrendingUp} trend={netProfit>=0?"up":"down"}/></div>
              <style>{`@media print{@page{size:A4 landscape;margin:12mm}body *{visibility:hidden!important}.pnl-print-area,.pnl-print-area *{visibility:visible!important}.pnl-print-area{position:absolute!important;left:0!important;top:0!important;width:100%!important;max-width:none!important;border:0!important;box-shadow:none!important;padding:0!important}.pnl-no-print{display:none!important}.pnl-print-area table{min-width:0!important;width:100%!important}.pnl-print-area th,.pnl-print-area td{padding:6px!important;font-size:9pt!important}.pnl-print-area .pnl-summary{break-inside:avoid}.pnl-print-area h2{font-size:18pt!important;color:#111!important}}`}</style><section className="pnl-print-area rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Profit &amp; Loss statement</h2><p className="mt-1 text-xs text-slate-400">Sales aur recorded expenses ka combined date-wise financial view</p><div className="mt-2 hidden text-xs text-slate-500 print:block">Period: {reportFrom} to {reportTo} · View: {reportGrouping==="day"?"Daily":"Monthly"}</div></div><div className="pnl-no-print flex flex-wrap items-center gap-2"><button type="button" onClick={downloadProfitLossCsv} className="rounded-lg border border-[#dce9de] px-3 py-2 text-xs font-bold text-forest hover:bg-[#f4faf5]">Download P&amp;L CSV</button><button type="button" onClick={printProfitLoss} className="rounded-lg bg-forest px-3 py-2 text-xs font-bold text-white hover:bg-[#225238]">Print / Save PDF</button><span className="rounded-full bg-[#eff8f1] px-3 py-1.5 text-[10px] font-bold text-forest">{reportRows.length} periods</span></div></div><div className="mt-4 flex flex-wrap items-end gap-3"><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">From</label><input type="date" value={reportFrom} max={reportTo} onChange={e=>setReportFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">To</label><input type="date" value={reportTo} min={reportFrom} max={today()} onChange={e=>setReportTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1"><button type="button" onClick={()=>setReportGrouping("day")} className={`rounded-md px-3 py-2 text-xs font-bold ${reportGrouping==="day"?"bg-white text-forest shadow-sm":"text-slate-500"}`}>Daily</button><button type="button" onClick={()=>setReportGrouping("month")} className={`rounded-md px-3 py-2 text-xs font-bold ${reportGrouping==="month"?"bg-white text-forest shadow-sm":"text-slate-500"}`}>Monthly</button></div><button type="button" onClick={()=>{setReportFrom(dateInDays(-29));setReportTo(today());}} className="rounded-lg px-3 py-2 text-xs font-bold text-forest hover:bg-[#f2f8f3]">Last 30 days</button></div><div className="pnl-summary mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"><div className="rounded-xl bg-[#f7faf7] p-3"><p className="text-[10px] font-semibold text-slate-500">Revenue</p><p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(reportRevenue)}</p></div><div className="rounded-xl bg-[#f7faf7] p-3"><p className="text-[10px] font-semibold text-slate-500">Product cost</p><p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(reportCost)}</p></div><div className="rounded-xl bg-[#f0f8f2] p-3"><p className="text-[10px] font-semibold text-forest">Gross profit</p><p className="mt-1 text-lg font-extrabold text-forest">{formatMoney(reportProfit)}</p></div><div className="rounded-xl bg-[#fff8ed] p-3"><p className="text-[10px] font-semibold text-slate-500">Expenses</p><p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(reportExpenseTotal)}</p></div><div className="col-span-2 rounded-xl bg-[#f0f8f2] p-3 sm:col-span-1"><p className="text-[10px] font-semibold text-forest">Net profit</p><p className="mt-1 text-lg font-extrabold text-forest">{formatMoney(reportNetProfit)}</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-400"><th className="px-3 py-3">{reportGrouping==="day"?"Date":"Month"}</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">Product cost</th><th className="px-3 py-3 text-right">Gross profit</th><th className="px-3 py-3 text-right">Expenses</th><th className="px-3 py-3 text-right">Net profit</th></tr></thead><tbody className="divide-y divide-slate-100">{reportRows.map(row=><tr key={row.label} className="text-xs"><td className="px-3 py-3 font-semibold text-slate-600">{row.label}</td><td className="px-3 py-3 text-right text-slate-700">{formatMoney(row.revenue)}</td><td className="px-3 py-3 text-right text-slate-700">{formatMoney(row.cost)}</td><td className="px-3 py-3 text-right font-semibold text-forest">{formatMoney(row.profit)}</td><td className="px-3 py-3 text-right text-slate-700">{formatMoney(row.expenses)}</td><td className={`px-3 py-3 text-right font-extrabold ${row.netProfit>=0?"text-forest":"text-rose-600"}`}>{formatMoney(row.netProfit)}</td></tr>)}{reportRows.length===0?<tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">Selected date range mein sales ya expense records nahi hain.</td></tr>:null}</tbody><tfoot><tr className="border-t-2 border-slate-200 bg-[#f8fbf8] text-xs font-extrabold text-ink"><td className="px-3 py-3">TOTAL</td><td className="px-3 py-3 text-right">{formatMoney(reportRevenue)}</td><td className="px-3 py-3 text-right">{formatMoney(reportCost)}</td><td className="px-3 py-3 text-right text-forest">{formatMoney(reportProfit)}</td><td className="px-3 py-3 text-right">{formatMoney(reportExpenseTotal)}</td><td className={`px-3 py-3 text-right ${reportNetProfit>=0?"text-forest":"text-rose-600"}`}>{formatMoney(reportNetProfit)}</td></tr></tfoot></table></div><p className="mt-4 text-[10px] leading-5 text-slate-400">Net profit = gross product profit − recorded expenses. Unrecorded overheads, taxes, discounts and payment fees included nahi hain. Sales aur expenses unki saved dates ke hisaab se group hote hain.</p></section>
              <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <form onSubmit={recordSale} className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><h2 className="text-base font-extrabold text-ink">Record a sale</h2><p className="mt-1 text-xs text-slate-400">Sale save hote hi inventory FIFO ke hisaab se reduce hoga.</p><div className="mt-5 space-y-4"><div><label className="text-xs font-bold text-slate-600">Product</label><select required value={saleForm.productId} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setSaleForm({...saleForm,productId:e.target.value,unitPrice:p?String(p.sellingPrice):''});}} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Select product</option>{products.filter(p=>p.quantity>0).map(p=><option key={p.id} value={p.id}>{p.name} · {p.quantity} {p.unit} available</option>)}</select></div><div><label className="text-xs font-bold text-slate-600">Quantity sold</label><input required type="number" min="0.01" step="any" value={saleForm.quantity} onChange={e=>setSaleForm({...saleForm,quantity:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div><label className="text-xs font-bold text-slate-600">Selling price per unit (₹)</label><input required type="number" min="0" step="0.01" value={saleForm.unitPrice} onChange={e=>setSaleForm({...saleForm,unitPrice:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div><label className="text-xs font-bold text-slate-600">Sale date</label><input type="date" value={saleForm.soldAt} onChange={e=>setSaleForm({...saleForm,soldAt:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div></div><div className="mt-5 rounded-xl bg-[#f2f8f3] p-4"><p className="text-xs text-slate-500">Estimated gross profit</p><p className="mt-1 text-xl font-extrabold text-forest">{formatMoney((Number(saleForm.quantity)||0)*((Number(saleForm.unitPrice)||0)-(products.find(p=>p.id===saleForm.productId)?.costPrice||0)))}</p></div><button type="submit" disabled={!products.some(p=>p.quantity>0)} className="mt-5 w-full rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Save sale & update stock</button></form>
                <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><h2 className="text-base font-extrabold text-ink">Sales history</h2><p className="mt-1 text-xs text-slate-400">Latest recorded transactions · maximum 1,000</p><div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto">{sales.map(sale=><div key={sale.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-ink">{sale.productName}</p><p className="mt-1 text-[10px] text-slate-500">{sale.quantity} {sale.unit} × {formatMoney(sale.unitPrice)} · {sale.soldAt}</p></div><div className="text-right"><p className="text-sm font-extrabold text-ink">{formatMoney(sale.revenue)}</p><p className={`mt-1 text-[10px] font-bold ${sale.profit>=0?"text-emerald-700":"text-rose-600"}`}>Profit {formatMoney(sale.profit)}</p></div></div></div>)}{sales.length===0?<p className="py-10 text-center text-xs text-slate-400">Abhi koi sale record nahi hui.</p>:null}</div></div>
              </div>
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Monthly expense budget</h2><p className="mt-1 text-xs text-slate-400">Set a monthly spending limit · {currentMonth}</p></div><span className={monthlyExpenseBudget>0&&monthExpenseTotal>monthlyExpenseBudget?"rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-bold text-rose-700":"rounded-full bg-[#eff8f1] px-3 py-1.5 text-[10px] font-bold text-forest"}>{monthlyExpenseBudget>0?(monthExpenseTotal>monthlyExpenseBudget?"Budget exceeded":"Budget tracking"):"Budget not set"}</span></div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><label className="text-xs font-bold text-slate-600">Monthly limit (₹)</label><input type="number" min="0" step="0.01" value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} placeholder="e.g. 10000" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><button type="button" onClick={saveMonthlyExpenseBudget} className="self-end rounded-xl bg-forest px-5 py-3 text-xs font-bold text-white">Save budget</button></div>
                {monthlyExpenseBudget>0?<div className="mt-5"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold text-ink">{formatMoney(monthExpenseTotal)} spent</span><span className="text-slate-500">of {formatMoney(monthlyExpenseBudget)} · {Math.round(budgetUsage)}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${budgetUsage>=100?"bg-rose-500":budgetUsage>=80?"bg-amber-500":"bg-emerald-600"}`} style={{width:`${Math.min(100,budgetUsage)}%`}}/></div><p className={`mt-2 text-xs font-semibold ${budgetRemaining<0?"text-rose-700":budgetUsage>=80?"text-amber-700":"text-emerald-700"}`}>{budgetRemaining<0?"Budget exceeded by "+formatMoney(Math.abs(budgetRemaining)):formatMoney(budgetRemaining)+" remaining this month"}</p>{budgetUsage>=100?<p className="mt-2 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">Alert: Monthly expense budget cross ho gaya. Spending review zaroori hai.</p>:budgetUsage>=80?<p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-700">Warning: Monthly budget ka 80% ya zyada use ho chuka hai.</p>:null}</div>:<p className="mt-4 text-xs text-slate-500">Budget set karne ke baad 80% par warning aur 100% par exceeded alert dikhega.</p>}
              </div>
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><div><h2 className="text-base font-extrabold text-ink">This month · spending analysis</h2><p className="mt-1 text-xs text-slate-400">Category-wise confirmed expenses · {monthExpenses.length} records</p></div><div className="mt-4 space-y-3">{monthCategoryTotals.map(item=><div key={item.category}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-ink">{item.category}</span><span className="font-bold text-ink">{formatMoney(item.amount)}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-forest" style={{width:`${monthExpenseTotal>0?item.amount/monthExpenseTotal*100:0}%`}}/></div></div>)}{monthCategoryTotals.length===0?<p className="py-6 text-center text-xs text-slate-400">Is month abhi koi expense record nahi hua.</p>:null}</div><div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Monthly expenses: <strong className="text-ink">{formatMoney(monthExpenseTotal)}</strong></div></div>
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Expense reports</h2><p className="mt-1 text-xs text-slate-400">Date-wise expenses and category totals · CSV Excel export</p></div><button type="button" onClick={downloadExpenseCsv} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-bold text-white hover:bg-[#225238]">Download CSV</button></div><div className="mt-4 flex flex-wrap items-end gap-3"><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">From</label><input type="date" value={expenseReportFrom} max={expenseReportTo} onChange={e=>setExpenseReportFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">To</label><input type="date" value={expenseReportTo} min={expenseReportFrom} max={today()} onChange={e=>setExpenseReportTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><button type="button" onClick={()=>{setExpenseReportFrom(dateInDays(-29));setExpenseReportTo(today());}} className="rounded-lg px-3 py-2 text-xs font-bold text-forest hover:bg-[#f2f8f3]">Last 30 days</button><span className="text-xs font-bold text-ink">{formatMoney(expenseReportTotal)} total · {expenseReportItems.length} records</span></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Date-wise totals</h3><div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{expenseReportDaily.map(item=><div key={item.date} className="flex items-center justify-between rounded-xl bg-[#f8fbf8] px-3 py-2.5"><span className="text-xs font-semibold text-slate-600">{item.date}</span><span className="text-xs font-extrabold text-ink">{formatMoney(item.amount)}</span></div>)}{expenseReportDaily.length===0?<p className="py-5 text-xs text-slate-400">Selected date range mein expenses nahi hain.</p>:null}</div></div><div><h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Category-wise totals</h3><div className="mt-3 max-h-64 space-y-3 overflow-y-auto">{expenseReportCategories.map(item=><div key={item.category}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-slate-600">{item.category}</span><span className="font-extrabold text-ink">{formatMoney(item.amount)}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-forest" style={{width:(expenseReportTotal>0?item.amount/expenseReportTotal*100:0)+"%"}}/></div></div>)}{expenseReportCategories.length===0?<p className="py-5 text-xs text-slate-400">Selected date range mein expenses nahi hain.</p>:null}</div></div></div><div className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400">CSV mein individual expense records, daily totals, category totals aur grand total included hain. Excel-compatible UTF-8 CSV.</div></div>
              <div className="mt-6 rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Expense history</h2><p className="mt-1 text-xs text-slate-400">Confirmed expenses · latest 2,000 records</p></div><span className="text-sm font-extrabold text-ink">{formatMoney(totalExpenses)}</span></div><div className="mt-4 max-h-72 space-y-3 overflow-y-auto">{expenses.map(expense=><div key={expense.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="text-sm font-bold text-ink">{expense.description}</p><p className="mt-1 text-[10px] text-slate-500">{expense.category} · {expense.spentAt}</p></div><div className="flex shrink-0 items-center gap-3"><span className="text-sm font-extrabold text-ink">{formatMoney(expense.amount)}</span><button type="button" onClick={()=>openExpenseEdit(expense)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50"><Pencil size={11}/> Edit</button></div></div>)}{expenses.length===0?<p className="py-8 text-center text-xs text-slate-400">Abhi koi expense record nahi hua.</p>:null}</div></div>
            </div> : null}

            {activeNav!=="Suppliers & reorder" ? <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Products" value={String(products.length)} note="In your inventory" icon={Boxes} />
              <MetricCard label="Stock cost value" value={formatMoney(inventoryValue)} note="Based on purchase price" icon={Wallet} />
              <MetricCard label="Low stock / alerts" value={String(attentionCount)} note="Needs review" icon={Activity} trend={attentionCount ? "down" : undefined} />
              <MetricCard label="Expiry alerts" value={String(expiryCount)} note="Within 7 days or expired" icon={CalendarClock} />
            </div> : null}

            {activeNav==="Overview" ? <div className="mt-6 rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-ink">Sales performance</h2><p className="mt-1 text-xs text-slate-400">Live analytics from your saved sales transactions</p></div><span className="rounded-full bg-[#eff8f1] px-3 py-1.5 text-[10px] font-bold text-forest">{reportSales.length} transactions</span></div>
              <div className="mt-5 flex flex-wrap items-end gap-3"><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">From</label><input type="date" value={reportFrom} max={reportTo} onChange={e=>setReportFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">To</label><input type="date" value={reportTo} min={reportFrom} max={today()} onChange={e=>setReportTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-xs"/></div><div className="flex gap-1 rounded-lg bg-slate-100 p-1"><button onClick={()=>setReportGrouping("day")} className={`rounded-md px-3 py-2 text-xs font-bold ${reportGrouping==="day"?"bg-white text-forest shadow-sm":"text-slate-500"}`}>Daily</button><button onClick={()=>setReportGrouping("month")} className={`rounded-md px-3 py-2 text-xs font-bold ${reportGrouping==="month"?"bg-white text-forest shadow-sm":"text-slate-500"}`}>Monthly</button></div><button onClick={()=>{setReportFrom(dateInDays(-29));setReportTo(today());}} className="rounded-lg px-3 py-2 text-xs font-bold text-forest hover:bg-[#f2f8f3]">Last 30 days</button></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="rounded-xl bg-[#f7faf7] p-4"><p className="text-[10px] font-semibold text-slate-500">Revenue</p><p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(reportRevenue)}</p></div><div className="rounded-xl bg-[#f7faf7] p-4"><p className="text-[10px] font-semibold text-slate-500">Product cost</p><p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(reportCost)}</p></div><div className="rounded-xl bg-[#f0f8f2] p-4"><p className="text-[10px] font-semibold text-forest">Gross profit</p><p className="mt-1 text-xl font-extrabold text-forest">{formatMoney(reportProfit)}</p></div><div className="rounded-xl bg-[#fff8ed] p-4"><p className="text-[10px] font-semibold text-slate-500">Expenses</p><p className="mt-1 text-xl font-extrabold text-ink">{formatMoney(reportExpenseTotal)}</p></div><div className="rounded-xl bg-[#f0f8f2] p-4"><p className="text-[10px] font-semibold text-forest">Net profit</p><p className="mt-1 text-xl font-extrabold text-forest">{formatMoney(reportNetProfit)}</p></div></div>
              <div className="mt-6"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-extrabold text-ink">{reportGrouping==="day"?"Daily report":"Monthly report"}</h3><span className="text-[10px] text-slate-400">Revenue bars · newest first</span></div>{reportRows.length? <div className="space-y-3">{reportRows.map(row=><div key={row.label} className="grid grid-cols-[76px_1fr_90px] items-center gap-3"><span className="text-[10px] font-semibold text-slate-500">{row.label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-forest" style={{width:(row.revenue/maxReportRevenue*100)+"%"}}/></div><div className="text-right"><p className="text-[10px] font-bold text-ink">{formatMoney(row.revenue)}</p><p className="text-[9px] text-emerald-700">Gross {formatMoney(row.profit)}</p><p className="text-[9px] text-amber-700">Expense {formatMoney(row.expenses)}</p><p className="text-[9px] font-bold text-forest">Net {formatMoney(row.netProfit)}</p></div></div>)}</div>:<p className="rounded-xl bg-slate-50 py-8 text-center text-xs text-slate-400">Selected dates mein koi sale record nahi hai.</p>}</div>
              <p className="mt-4 text-[10px] text-slate-400">Reports group sales and expenses by their recorded dates. Net profit = gross product profit − recorded expenses; unrecorded costs, tax and fees are not included.</p>
            </div> : null}

            {activeNav!=="Suppliers & reorder" ? <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
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
            </div> : null}
          </div>
        </section>
      </div>

      {batchProductId ? <div className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4"><form onSubmit={addBatch} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 className="text-lg font-extrabold text-ink">Receive new batch</h3><p className="mt-1 text-xs text-slate-500">{products.find(item=>item.id===batchProductId)?.name}</p><div className="mt-5 space-y-3"><input required maxLength={40} placeholder="Batch / lot number" value={batchForm.batchNo} onChange={e=>setBatchForm({...batchForm,batchNo:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input required type="number" min="0.01" step="any" placeholder="Quantity" value={batchForm.quantity} onChange={e=>setBatchForm({...batchForm,quantity:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/><input type="date" value={batchForm.expiryDate} onChange={e=>setBatchForm({...batchForm,expiryDate:e.target.value})} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>setBatchProductId(null)} className="rounded-xl px-4 py-2 text-xs font-bold">Cancel</button><button type="submit" className="rounded-xl bg-forest px-4 py-2 text-xs font-bold text-white">Save batch</button></div></form></div> : null}
      {editingExpenseId ? <div className="fixed inset-0 z-[56] flex items-center justify-center overflow-y-auto bg-ink/40 p-4"><div className="my-6 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-extrabold text-ink">Edit expense</h3><p className="mt-1 text-xs text-slate-500">Changes saved expense and recalculate reports.</p></div><button type="button" onClick={()=>setEditingExpenseId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18}/></button></div><form onSubmit={saveExpenseEdit} className="mt-5 space-y-3"><div><label className="text-xs font-bold text-slate-600">Description</label><input required maxLength={100} value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm,description:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div><label className="text-xs font-bold text-slate-600">Category</label><select required value={expenseForm.category} onChange={e=>setExpenseForm({...expenseForm,category:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{["Utilities","Rent","Staff","Transport","Repairs","Packaging","Marketing","Bank charges","Supplies","Food & refreshments","Other"].map(category=><option key={category} value={category}>{category}</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-600">Amount (₹)</label><input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div><div><label className="text-xs font-bold text-slate-600">Expense date</label><input required type="date" value={expenseForm.spentAt} onChange={e=>setExpenseForm({...expenseForm,spentAt:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>setEditingExpenseId(null)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-xl bg-forest px-5 py-2.5 text-xs font-bold text-white">Save changes</button></div></form></div></div> : null}
      {showForm ? <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4">
        <div className="my-6 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between"><div><h3 className="text-lg font-extrabold text-ink">{editingId ? "Edit product" : "Add a product"}</h3><p className="mt-1 text-xs text-slate-500">Product details inventory mein save honge.</p></div><button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div>
          <form onSubmit={saveProduct} className="mt-5 space-y-4">
            <div><label htmlFor="product-name" className="text-xs font-bold text-slate-600">Product name *</label><input id="product-name" required maxLength={80} autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Tata Salt 1kg" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-forest" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="product-category" className="text-xs font-bold text-slate-600">Category</label><input id="product-category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div><div><label htmlFor="product-unit" className="text-xs font-bold text-slate-600">Unit</label><input id="product-unit" required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="pcs, kg, packet" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="product-quantity" className="text-xs font-bold text-slate-600">Current quantity</label><input id="product-quantity" type="number" min="0" step="any" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div><div><label htmlFor="product-threshold" className="text-xs font-bold text-slate-600">Low-stock alert at</label><input id="product-threshold" type="number" min="0" step="any" required value={form.lowStockAt} onChange={(event) => setForm({ ...form, lowStockAt: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label htmlFor="product-cost" className="text-xs font-bold text-slate-600">Purchase price (₹)</label><input id="product-cost" type="number" min="0" step="0.01" required value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div><div><label htmlFor="product-selling" className="text-xs font-bold text-slate-600">Selling price (₹)</label><input id="product-selling" type="number" min="0" step="0.01" required value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div></div>
            <div><label htmlFor="product-expiry" className="text-xs font-bold text-slate-600">Expiry date (optional)</label><input id="product-expiry" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-forest" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-600">Preferred supplier</label><select value={form.supplierId} onChange={e=>setForm({...form,supplierId:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Not assigned</option>{suppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600">Reorder target quantity</label><input type="number" min="0" step="any" value={form.reorderToLevel} onChange={e=>setForm({...form,reorderToLevel:e.target.value})} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></div></div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-xl bg-forest px-5 py-2.5 text-xs font-bold text-white hover:bg-[#225238]">{editingId ? "Save changes" : "Add product"}</button></div>
          </form>
        </div>
      </div> : null}

      {notice ? <div role="status" className="fixed bottom-5 left-1/2 z-[60] flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check size={15} className="shrink-0 text-emerald-300" />{notice}</div> : null}
    </main>
  );
}
