import { useEffect, useState, useMemo } from "react";
import { managerAPI } from "../api";
import ProductDetailModal from "./ProductDetailModal";
import QuantitySelector from "./QuantitySelector";
import LoadingSkeleton from "./LoadingSkeleton";
import SearchBar from "./SearchBar";

export default function Products({ addToCart, onRequestAdd, mode = 'POS', searchQuery = "", onSearchChange, onSearchClear }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (mode === 'REQUEST') {
          const { data } = await managerAPI.getCombinedStock();
          if (!active) return;
          const list = Array.isArray(data?.products) ? data.products : [];
          // Normalize to maintain fields consumed by UI (product_id, product_name, price, category)
          setProducts(list.map(p => ({ ...p })));
          const initialQty = {};
          list.forEach(p => { initialQty[p.product_id] = 1; });
          setQuantities(initialQty);
        } else {
          const res = await fetch("http://localhost:8080/api/products");
          if (!res.ok) {
            throw new Error(`Products fetch failed: ${res.status}`);
          }
          const data = await res.json();
          if (!active) return;
          const list = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
          setProducts(list);
          const initialQty = {};
          list.forEach(p => { initialQty[p.product_id] = 1; });
          setQuantities(initialQty);
        }
      } catch (err) {
        if (active) {
          console.error('Error fetching products:', err);
          setProducts([]);
        }
      } finally {
        active && setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [mode]);

  const setQty = (id, v) => setQuantities(q => ({ ...q, [id]: v }));

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    
    const query = searchQuery.toLowerCase().trim();
    return products.filter(product => 
      product.product_name?.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const handleSearchChange = (query) => {
    if (onSearchChange) onSearchChange(query);
  };

  const handleSearchClear = () => {
    if (onSearchClear) onSearchClear();
  };

  // Highlight search terms in text
  const highlightText = (text, query) => {
    if (!query.trim() || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="search-highlight">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="section">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 className="heading-xl">Products</h2>
          <div style={{ minWidth: '300px' }}>
            <SearchBar
              value={searchQuery}
              onChange={handleSearchChange}
              onClear={handleSearchClear}
              placeholder="Search products..."
            />
          </div>
        </div>

        {loading ? (
          <div className="grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} type="card" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="panel" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            {searchQuery ? (
              <>
                <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>🔍</div>
                <h3 className="heading-md">No products found</h3>
                <p className="subtle">Try adjusting your search terms or <button onClick={handleSearchClear} className="search-clear-link">clear search</button></p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>🛍️</div>
                <h3 className="heading-md">No products available</h3>
                <p className="subtle">Check back later for new arrivals!</p>
              </>
            )}
          </div>
        ) : (
          <>
            {searchQuery && (
              <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--accent-light)', borderRadius: 'var(--radius)', border: '1px solid var(--accent)' }}>
                <p className="text-sm">
                  Found <strong>{filteredProducts.length}</strong> product{filteredProducts.length !== 1 ? 's' : ''} matching "{searchQuery}"
                  {filteredProducts.length !== products.length && (
                    <button onClick={handleSearchClear} className="search-clear-link" style={{ marginLeft: 'var(--space-2)' }}>
                      Show all {products.length} products
                    </button>
                  )}
                </p>
              </div>
            )}
            <div className="grid">
              {filteredProducts.map((p, index) => {
                const qty = quantities[p.product_id] || 1;
                return (
                  <div 
                    className="card panel" 
                    key={p.product_id} 
                    onClick={() => { if (mode !== 'REQUEST') setSelected(p); }} 
                    style={{ 
                      cursor: 'pointer',
                      animationDelay: `${index * 0.1}s`,
                      animation: 'slide-up 0.5s ease-out forwards'
                    }}
                  >
                    {p.image_url ? (
                      <img className="card-media" src={p.image_url} alt={p.product_name} />
                    ) : (
                      <img className="card-media" src={`/images/products/${p.product_id}.jpg`} alt={p.product_name} />
                    )}
                    <div className="card-body stack">
                      <h3>{highlightText(p.product_name, searchQuery)}</h3>
                      {p.category && searchQuery && (
                        <p className="text-xs subtle">{highlightText(p.category, searchQuery)}</p>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p className="font-semibold">₹{p.price}</p>
                        {mode === 'REQUEST' ? (
                          <span className="text-xs subtle">Wh: {p.warehouse_quantity ?? 0} • Shop: {p.shop_quantity ?? 0}</span>
                        ) : (
                          p.stock_quantity != null && (
                            <span className="text-xs subtle">Stock: {p.stock_quantity}</span>
                          )
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} onClick={e => e.stopPropagation()}>
                        <QuantitySelector 
                          value={qty} 
                          onChange={(v) => setQty(p.product_id, v)} 
                          max={mode === 'REQUEST' ? (p.warehouse_quantity ?? undefined) : (p.stock_quantity || undefined)} 
                          small 
                        />
                        <button 
                          className="btn btn-sm" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (mode === 'REQUEST') {
                              onRequestAdd && onRequestAdd(p, qty);
                            } else {
                              addToCart(p, qty);
                            }
                          }}
                          disabled={mode === 'REQUEST' ? (p.warehouse_quantity === 0) : (p.stock_quantity === 0)}
                        >
                          {mode === 'REQUEST' ? 'Request' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {mode !== 'REQUEST' && (
          <ProductDetailModal product={selected} onClose={() => setSelected(null)} addToCart={addToCart} />
        )}
      </div>
    </div>
  );
}
