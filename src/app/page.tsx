"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarClock,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  IndianRupee,
  LayoutDashboard,
  Menu,
  Mic,
  PackagePlus,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

type Product = {
  name: string;
  category: string;
  stock: number;
  unit: string;
  status: "Healthy" | "Low stock" | "Expiring";
  price: string;
};

const initialProducts: Product[] = [
  { name: "Amul Taaza Milk", category: "Dairy", stock: 18, unit: "packets", status: "Healthy", price: "₹27" },
  { name: "Fortune Sunflower Oil", category: "Grocery", stock: 4, unit: "pouches", status: "Low stock", price: "₹142" },
  { name: "Maggi 2-Min Noodles", category: "Snacks", stock: 32, unit: "packs", status: "Healthy", price: "₹14" },
  { name: "Britannia Bread", category: "Bakery", stock: 6, unit: "loaves", status: "Expiring", price: "₹40" },
];

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Inventory", icon: Boxes },
  { label: "Sales & profit", icon: TrendingUp },
  { label: "Expiry alerts", icon: CalendarClock },
];

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Wallet;
  trend?: "up" | "down";
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
        <span className="text-slate-400">vs last week</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState(initialProducts);
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");

  const filteredProducts = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newProduct.trim();
    if (!name) return;
    setProducts((current) => [
      { name, category: "New item", stock: 1, unit: "units", status: "Low stock", price: "—" },
      ...current,
    ]);
    setNewProduct("");
    setShowAdd(false);
    setNotice(name + " added to demo inventory");
    window.setTimeout(() => setNotice(""), 3000);
  }

  function handleVoice() {
    setNotice("Voice entry preview: Hindi voice capture will be connected in the next phase.");
    window.setTimeout(() => setNotice(""), 3800);
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#e7eee7] bg-white px-5 py-6 transition-transform lg:static lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest text-white"><Boxes size={21} /></div>
              <div>
                <p className="text-[17px] font-extrabold tracking-tight text-ink">StockSaathi<span className="text-emerald-600"> AI</span></p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Smart shop manager</p>
              </div>
            </div>
            <button onClick={() => setMobileMenu(false)} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label="Close menu"><X size={18} /></button>
          </div>

          <div className="mt-10">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
            <nav className="mt-3 space-y-1">
              {navItems.map(({ label, icon: Icon }) => (
                <button key={label} onClick={() => { setActiveNav(label); setMobileMenu(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${activeNav === label ? "bg-[#eaf5ed] text-forest" : "text-slate-500 hover:bg-slate-50 hover:text-ink"}`}>
                  <Icon size={18} />{label}
                  {label === "Expiry alerts" ? <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">3</span> : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-9">
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Manage</p>
            <button onClick={() => setNotice("Settings will be available in a later phase.")} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"><Settings2 size={18} /> Settings</button>
            <button onClick={() => setNotice("Help centre is coming soon.")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"><CircleHelp size={18} /> Help & support</button>
          </div>

          <div className="mt-auto rounded-2xl bg-[#f0f7f1] p-4">
            <div className="flex items-center gap-2 text-forest"><Sparkles size={16} /><span className="text-xs font-bold">Saathi AI tip</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Fortune Oil stock is running low. Add it to your next supplier order.</p>
            <button onClick={() => setActiveNav("Inventory")} className="mt-3 text-xs font-bold text-forest underline underline-offset-4">Review stock</button>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dcece0] text-xs font-bold text-forest">RK</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-ink">Ravi Kirana Store</p><p className="text-[10px] text-slate-400">Free workspace</p></div>
            <ChevronDown size={16} className="text-slate-400" />
          </div>
        </aside>

        {mobileMenu ? <button aria-label="Close navigation overlay" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" /> : null}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#e8eee8] bg-white/90 px-4 backdrop-blur sm:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenu(true)} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
              <div><p className="text-sm font-bold text-ink">{activeNav}</p><p className="hidden text-[11px] text-slate-400 sm:block">Tuesday, 17 November 2026</p></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden rounded-full border border-[#e4eee5] bg-[#f7fbf7] px-3 py-1.5 text-[11px] font-semibold text-forest sm:inline-flex"><span className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" /> Demo workspace</span>
              <button onClick={() => setNotice("You are all caught up on notifications.")} className="relative rounded-xl border border-slate-100 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500" /></button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">RK</div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9">
            <div className="float-in flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Your shop, one smart view</p>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-[32px]">Namaste, Ravi <span className="inline-block">👋</span></h1>
                <p className="mt-2 text-sm text-slate-500">Aaj aapki dukaan ka business kaisa chal raha hai?</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleVoice} className="inline-flex items-center gap-2 rounded-xl border border-[#dce9de] bg-white px-4 py-3 text-sm font-bold text-forest shadow-sm transition hover:bg-[#f4faf5]"><Mic size={17} /> Speak in Hindi</button>
                <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-bold text-white shadow-lg shadow-forest/15 transition hover:bg-[#225238]"><PackagePlus size={17} /> Add stock</button>
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Today's sales" value="₹8,450" note="+12.8%" icon={IndianRupee} trend="up" />
              <MetricCard label="Estimated profit" value="₹1,920" note="+8.2%" icon={Wallet} trend="up" />
              <MetricCard label="Products in stock" value={String(products.length + 146)} note="4 categories" icon={Boxes} />
              <MetricCard label="Needs attention" value="7 items" note="3 expiring soon" icon={Activity} trend="down" />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
              <div className="rounded-2xl border border-[#e8eee8] bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="text-base font-extrabold text-ink">Sales overview</h2><p className="mt-1 text-xs text-slate-400">Your shop performance this week</p></div>
                  <button className="rounded-lg border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">This week <ChevronDown size={13} className="ml-1 inline" /></button>
                </div>
                <div className="mt-7 flex h-[190px] items-end gap-3 border-b border-slate-100 pb-3 sm:gap-5">
                  {[42, 64, 51, 78, 58, 88, 72].map((height, index) => (
                    <div key={index} className="flex h-full flex-1 flex-col justify-end gap-2">
                      <div className="relative flex h-full items-end justify-center">
                        <div style={{ height: height + "%" }} className={`w-full max-w-[38px] rounded-t-lg ${index === 5 ? "bg-forest" : "bg-[#dcefe1]"} transition-all`} />
                      </div>
                      <span className="text-center text-[10px] font-medium text-slate-400">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between"><div><p className="text-[11px] text-slate-400">Total revenue</p><p className="mt-1 text-xl font-extrabold text-ink">₹42,680</p></div><div className="rounded-xl bg-[#eff8f1] px-3 py-2 text-xs font-bold text-emerald-700"><ArrowUpRight size={14} className="mr-1 inline" /> 9.4% this week</div></div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-forest p-5 text-white shadow-soft sm:p-6">
                <div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#c9efd7]">Saathi intelligence</span><Sparkles size={18} className="text-[#bce8c9]" /></div>
                <h2 className="mt-5 text-xl font-extrabold leading-7">Aaj ka smart business summary</h2>
                <p className="mt-2 text-xs leading-5 text-white/65">Aapke demo shop data ke basis par kuch useful suggestions.</p>
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3.5"><div className="flex items-center gap-2 text-[#c9efd7]"><ShoppingCart size={15} /><span className="text-xs font-bold">Reorder suggestion</span></div><p className="mt-1.5 text-xs leading-5 text-white/80">Fortune Sunflower Oil ke 4 pouches bache hain. Supplier order plan karein.</p></div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.07] p-3.5"><div className="flex items-center gap-2 text-[#f8d99c]"><CalendarClock size={15} /><span className="text-xs font-bold">Expiry reminder</span></div><p className="mt-1.5 text-xs leading-5 text-white/80">Britannia Bread ke 6 loaves ko aaj check karein.</p></div>
                </div>
                <button onClick={() => setNotice("AI recommendations are sample insights in this UI preview.")} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#c9efd7]">View all insights <ArrowUpRight size={14} /></button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#e8eee8] bg-white shadow-soft">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:px-6">
                <div><h2 className="text-base font-extrabold text-ink">Inventory snapshot</h2><p className="mt-1 text-xs text-slate-400">Quick look at products that need attention</p></div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-forest sm:w-[190px]" /></div>
                  <button onClick={() => setShowAdd(true)} className="rounded-xl border border-[#dce9de] px-3 py-2.5 text-xs font-bold text-forest hover:bg-[#f4faf5]">+ Add item</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead><tr className="bg-[#fafcfa] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-6 py-3">Product name</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Available stock</th><th className="px-4 py-3">Unit price</th><th className="px-6 py-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((product) => (
                      <tr key={product.name} className="text-xs transition hover:bg-[#fbfdfb]">
                        <td className="px-6 py-4 font-bold text-ink">{product.name}</td><td className="px-4 py-4 text-slate-500">{product.category}</td><td className="px-4 py-4 font-semibold text-slate-700">{product.stock} <span className="font-normal text-slate-400">{product.unit}</span></td><td className="px-4 py-4 text-slate-600">{product.price}</td>
                        <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${product.status === "Healthy" ? "bg-emerald-50 text-emerald-700" : product.status === "Low stock" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{product.status}</span></td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 ? <tr><td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">No products match your search.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><span className="text-[11px] text-slate-400">Showing {filteredProducts.length} demo products</span><button onClick={() => setActiveNav("Inventory")} className="text-xs font-bold text-forest">View inventory <ArrowUpRight size={13} className="ml-1 inline" /></button></div>
            </div>

            <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-[#cbdccc] bg-[#f8fbf8] p-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex items-center gap-3"><div className="rounded-xl bg-white p-2.5 text-forest shadow-sm"><Command size={18} /></div><div><p className="text-xs font-bold text-ink">Made for Indian small businesses</p><p className="mt-1 text-[11px] text-slate-500">Hindi-first workflows • Simple inventory • Clear profit insights</p></div></div>
              <span className="text-[10px] font-semibold text-slate-400">STOCKSAATHI AI · PHASE 1 PREVIEW</span>
            </div>
          </div>
        </section>
      </div>

      {showAdd ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between"><div><h3 className="text-lg font-extrabold text-ink">Add a product</h3><p className="mt-1 text-xs text-slate-500">Demo inventory mein naya item add karein.</p></div><button onClick={() => setShowAdd(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button></div>
          <form onSubmit={addProduct} className="mt-6"><label htmlFor="product-name" className="text-xs font-bold text-slate-600">Product name</label><input id="product-name" autoFocus value={newProduct} onChange={(event) => setNewProduct(event.target.value)} placeholder="e.g. Tata Salt 1kg" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-forest" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setShowAdd(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button><button type="submit" className="rounded-xl bg-forest px-4 py-2.5 text-xs font-bold text-white hover:bg-[#225238]">Add product</button></div></form>
        </div>
      </div> : null}

      {notice ? <div role="status" className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check size={15} className="text-emerald-300" />{notice}</div> : null}
    </main>
  );
}
