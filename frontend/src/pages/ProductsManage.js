import React, { useEffect, useState } from 'react';
import { managerAPI, adminAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

// Basic product management (Manager/Admin)
export default function ProductsManage() {
  const { isManager, isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ product_name: '', price: '', category: '', warehouse_quantity: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shopQtyEdits, setShopQtyEdits] = useState({}); // product_id -> qty

  // Only Admin can edit catalog (create/update/delete). Managers can only adjust shop stock.
  const adminCanEditCatalog = isAdmin();
  const isManagerView = isManager();
  const isAdminView = isAdmin();

  const loadProducts = async () => {
    try {
      setLoading(true);
      console.debug('[ProductsManage] Fetching products...');
      // Admins: show central warehouse stock (with COALESCE fallback) via admin API
      if (isAdminView) {
        try {
          const res = await adminAPI.getWarehouseStock();
          const list = res.data?.stock || [];
          // Normalize fields so the table renders consistently
          const normalized = list.map(p => ({
            ...p,
            shop_quantity: undefined, // not applicable
            stock_quantity: p.quantity // display column for Admin
          }));
          setProducts(normalized);
        } catch (err) {
          console.warn('[ProductsManage] Admin warehouse stock load failed, falling back to catalog:', err?.response?.data || err?.message);
          const res = await managerAPI.getProducts();
          const base = res.data.products || res.data || [];
          setProducts(base);
        }
        return;
      }

      // Managers: merge shop stock with products
      // Be resilient: if shop stock fails (e.g., no assignment yet), still show the catalog
      const resProducts = await managerAPI.getProducts();
      const base = resProducts.data.products || resProducts.data || [];
      try {
        const resShop = await managerAPI.getShopStock();
        const shop = (resShop.data?.stock || []).reduce((acc, it) => { acc[it.product_id] = it.quantity; return acc; }, {});
        const merged = base.map(p => ({ ...p, shop_quantity: shop[p.product_id] ?? 0 }));
        setProducts(merged);
      } catch (shopErr) {
        console.warn('[ProductsManage] Could not load shop stock, showing base catalog only:', shopErr?.response?.data || shopErr?.message);
        setProducts(base);
      }
    } catch (e) {
      console.error('[ProductsManage] Load products error:', e);
      setError(e.response?.data?.error || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    console.debug('[ProductsManage] Mounted. adminCanEditCatalog=', adminCanEditCatalog, 'isAdminView=', isAdminView, 'isManagerView=', isManagerView);
    loadProducts(); 
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm({ product_name: '', price: '', category: '', warehouse_quantity: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_name || !form.price) return;
    try {
      setSaving(true);
      if (editingId) {
        await managerAPI.updateProduct(editingId, {
          product_name: form.product_name,
          price: form.price,
          category: form.category
        });
      } else {
        // Create product first
        const res = await managerAPI.createProduct({
          product_name: form.product_name,
          price: form.price,
          category: form.category
        });
        // If Admin provided initial warehouse quantity, set it now
        const created = res?.data?.product;
        const qty = form.warehouse_quantity === '' ? null : Number(form.warehouse_quantity);
        if (isAdminView && created?.product_id && qty != null && !Number.isNaN(qty)) {
          try {
            await adminAPI.setWarehouseStock(created.product_id, Math.max(0, Math.floor(qty)));
          } catch (stockErr) {
            console.warn('[ProductsManage] Could not set initial warehouse stock:', stockErr?.response?.data || stockErr?.message);
          }
        }
      }
      resetForm();
      loadProducts();
    } catch (e) {
      setError(e.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.product_id);
    setForm({
      product_name: p.product_name,
      price: p.price,
      category: p.category || '',
      warehouse_quantity: ''
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await managerAPI.deleteProduct(id);
      loadProducts();
    } catch (e) {
      setError(e.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="container" style={{ padding: 'var(--space-6)' }}>
      <div style={{background:'#ffe08a',color:'#5a4500',padding:'8px 12px',borderRadius:4,marginBottom:12,fontSize:14}}>
        ProductsManage component mounted {loading && '(loading...)'} | products: {products.length}
      </div>
      <h1 className="heading-xl">Product Management</h1>
      <p className="subtle">{isAdminView ? 'Create or edit products and manage central stock.' : 'View catalog and manage your shop stock quantities.'}</p>

      {error && <div className="alert error" style={{ marginTop: '1rem' }}>{error}</div>}

      {isAdminView && (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>{editingId ? 'Edit Product' : 'Create Product'}</h2>
          <form onSubmit={handleSubmit} className="grid" style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            <input name="product_name" placeholder="Name" value={form.product_name} onChange={handleChange} required />
            <input name="price" placeholder="Price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
            <input name="category" placeholder="Category" value={form.category} onChange={handleChange} />
            {!editingId && (
              <input
                name="warehouse_quantity"
                placeholder="Initial Warehouse Stock"
                type="number"
                min={0}
                value={form.warehouse_quantity}
                onChange={handleChange}
              />
            )}
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}</button>
              {editingId && <button type="button" className="btn" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
          <p className="subtle" style={{marginTop:8}}>
            Tip: When creating a product, you can optionally set its initial Warehouse stock. After creation, you can continue managing central stock in Admin &gt; Warehouse Stock, and managers can adjust their shop stock below.
          </p>
        </div>
      )}

      <div className="panel" style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Products</h2>
        {loading ? <p>Loading...</p> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  {isManagerView ? (
                    <th>Shop Stock</th>
                  ) : (
                    <th>Stock</th>
                  )}
                  {isAdminView && <th style={{ width: '160px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={isAdminView ? 5 : 4} style={{ textAlign: 'center', padding: '1rem' }}>No products found.</td>
                  </tr>
                )}
                {products.map(p => (
                  <tr key={p.product_id}>
                    <td>{p.product_name}</td>
                    <td>{p.category || '-'}</td>
                    <td>{Number(p.price).toFixed(2)}</td>
                    <td>
                      {isManagerView ? (
                        <div style={{display:'flex',gap:6,alignItems:'center'}}>
                          <input
                            type="number"
                            min={0}
                            value={shopQtyEdits[p.product_id] ?? p.shop_quantity ?? 0}
                            onChange={(e)=>{
                              const v = Math.max(0, Math.floor(Number(e.target.value)||0));
                              setShopQtyEdits(prev => ({ ...prev, [p.product_id]: v }));
                            }}
                            style={{width:100,padding:'6px 8px',border:'1px solid var(--border)',borderRadius:6}}
                          />
                          <button className="btn small" onClick={async ()=>{
                            try {
                              const qty = shopQtyEdits[p.product_id] ?? p.shop_quantity ?? 0;
                              await managerAPI.setShopStock(p.product_id, qty);
                              loadProducts();
                            } catch (e) {
                              setError(e.response?.data?.error || 'Failed to update shop stock');
                            }
                          }}>Save</button>
                        </div>
                      ) : (
                        <span>{p.stock_quantity ?? 0}</span>
                      )}
                    </td>
                    {isAdminView && (
                      <td>
                        <div style={{ display: 'flex', gap: '.5rem' }}>
                          {adminCanEditCatalog && <button className="btn small" onClick={() => startEdit(p)}>Edit</button>}
                          {adminCanEditCatalog && <button className="btn small danger" onClick={() => handleDelete(p.product_id)}>Delete</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
