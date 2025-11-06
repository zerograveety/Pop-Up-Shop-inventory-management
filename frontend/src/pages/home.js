import { useMemo, useState } from "react";
import ProductList from "../components/ProductList";
import { managerAPI } from "../api";

export default function Home({ addToCart, searchQuery, onSearchChange, onSearchClear }) {
  const mode = 'REQUEST'; // Always in order mode per requirements
  const [requestCart, setRequestCart] = useState({}); // product_id -> qty
  const entries = useMemo(() => Object.entries(requestCart).filter(([,q]) => q>0), [requestCart]);
  const totalLines = entries.length;
  const totalQty = entries.reduce((s, [,q]) => s + q, 0);

  const onRequestAdd = (product, qty) => {
    setRequestCart(prev => ({ ...prev, [product.product_id]: (prev[product.product_id] || 0) + qty }));
  };

  const clearRequestCart = () => setRequestCart({});

  const submitRequest = async () => {
    if (entries.length === 0) return;
    const items = entries.map(([product_id, quantity]) => ({ product_id: Number(product_id), quantity: Number(quantity) }));
    const note = `POS request for ${totalQty} units across ${totalLines} products`;
    const { data } = await managerAPI.createStockOrder({ items, note });
    alert(`Stock request submitted. Order #${data.order?.id ?? ''}`);
    clearRequestCart();
  };

  return (
    <div className="container">
      <div className="panel" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}>
          <div>
            <h1 className="heading-xl">Stock Request 🧺</h1>
            <p className="subtle">Browse items with images and build a request to Admin warehouse.</p>
          </div>
        </div>
      </div>

      <ProductList 
        mode={mode}
        addToCart={addToCart}
        onRequestAdd={onRequestAdd}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onSearchClear={onSearchClear}
      />

      {/* Always in request mode */}
        <div className="panel" style={{marginTop:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <h3>Request Cart</h3>
            <div className="text-sm subtle">Lines: {totalLines} • Qty: {totalQty}</div>
          </div>
          {entries.length === 0 ? (
            <div className="subtle">No items added yet. Click "Request" on products to add.</div>
          ) : (
            <div className="stack" style={{gap:8}}>
              {entries.map(([pid, qty]) => (
                <div key={pid} style={{display:'flex',justifyContent:'space-between',alignItems:'center',border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px'}}>
                  <div>Product #{pid}</div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input type="number" value={qty} min={0} onChange={(e)=>{
                      const v = Math.max(0, Math.floor(Number(e.target.value)||0));
                      setRequestCart(prev => ({ ...prev, [pid]: v }));
                    }} style={{width:100,padding:'6px 8px',border:'1px solid var(--border)',borderRadius:6}} />
                    <button className="btn btn-sm" onClick={()=>setRequestCart(prev=>{ const n={...prev}; delete n[pid]; return n; })}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
            <button className="btn btn-outline" onClick={clearRequestCart} disabled={entries.length===0}>Clear</button>
            <button className="btn" onClick={submitRequest} disabled={entries.length===0}>Submit Request</button>
          </div>
        </div>
      
    </div>
  );
}