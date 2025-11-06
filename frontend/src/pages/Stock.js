import { useEffect, useMemo, useState } from 'react';
import { managerAPI } from '../api';
import './Dashboard.css';

export default function Stock() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [edit, setEdit] = useState(false);
  const [shopEdits, setShopEdits] = useState({}); // product_id -> new qty
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await managerAPI.getShopStock();
        if (!mounted) return;
        // managerAPI.getShopStock() returns { event_id, stock: [...] }
        const list = Array.isArray(data?.stock) ? data.stock : [];
        setProducts(list);
        // Fetch low stock alerts (trigger-populated)
        try {
          const a = await managerAPI.getLowStockAlerts();
          if (mounted) setAlerts(Array.isArray(a?.data?.alerts) ? a.data.alerts : []);
        } catch (_) {
          // ignore alert fetch errors
        }
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to load stock');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  // No request flow here; Stock page is for viewing and editing shop stock only

  const applyShopEdit = async (product_id) => {
    const qty = shopEdits[product_id];
    if (qty == null || qty < 0) return;
    try {
      await managerAPI.setShopStock(product_id, qty);
      // refresh list
      const { data } = await managerAPI.getCombinedStock();
      setProducts(data.products || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to update shop stock');
    }
  };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      {alerts && alerts.length > 0 && (
        <div style={{background:'#fff4e5',border:'1px solid #ffd399',padding:'8px 12px',borderRadius:8,marginBottom:12,color:'#5a3e00'}}>
          <strong>Low stock alerts</strong>
          <ul style={{margin:'6px 0 0',paddingLeft:18}}>
            {alerts.map(al => (
              <li key={al.id}>{al.product_name || `Product #${al.product_id}`} is low (qty {al.quantity})</li>
            ))}
          </ul>
        </div>
      )}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,marginBottom:16}}>
        <h2>Your Shop Stock</h2>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input 
            type="text"
            value={search}
            placeholder="Search products..."
            onChange={(e)=>setSearch(e.target.value)}
            style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,minWidth:240}}
          />
        </div>
      </div>

      {error && (
        <div style={{background:'#fee',border:'1px solid #f99',padding:'8px 12px',borderRadius:8,marginBottom:12,color:'#900'}}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading stock...</div>
      ) : (
        <div className="card" style={{padding:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderBottom:'1px solid var(--border)',background:'var(--card)'}}>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12,flex:1}}>
              <div>Product</div>
              <div style={{textAlign:'right'}}>Your Shop</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <label className="text-sm subtle" style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={edit} onChange={(e)=>setEdit(e.target.checked)} /> Edit Shop Stock
              </label>
            </div>
          </div>
          {filtered.map(p => (
            <div key={p.product_id} style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:12,padding:'10px 12px',borderBottom:'1px solid var(--border)'}}>
              <div>
                <div style={{fontWeight:600}}>{p.product_name}</div>
                <div style={{fontSize:12,opacity:0.7}}>{p.category || '—'}</div>
              </div>
              <div style={{textAlign:'right'}}>
                {!edit ? (
                  p.quantity
                ) : (
                  <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                    <input 
                      type="number"
                      min={0}
                      value={shopEdits[p.product_id] ?? p.quantity}
                      onChange={(e)=>{
                        const v = Math.max(0, Math.floor(Number(e.target.value)||0));
                        setShopEdits(prev => ({ ...prev, [p.product_id]: v }));
                      }}
                      style={{width:100,padding:'6px 8px',border:'1px solid var(--border)',borderRadius:6}}
                    />
                    <button className="btn btn-sm" onClick={()=>applyShopEdit(p.product_id)}>Save</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
