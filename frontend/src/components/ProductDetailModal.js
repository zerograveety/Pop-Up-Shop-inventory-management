import { useEffect, useState } from 'react';
import QuantitySelector from './QuantitySelector';

export default function ProductDetailModal({ product, onClose, addToCart }) {
  // Close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [qty, setQty] = useState(1);
  useEffect(() => { setQty(1); }, [product]);

  if (!product) return null;

  return (
    <div className="modal-portal" role="dialog" aria-modal="true" aria-label={product.product_name}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal panel">
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-content">
          <div className="modal-media-wrap">
            {product.image_url ? (
              <img src={product.image_url} alt={product.product_name} />
            ) : (
              <img src={`/images/products/${product.product_id}.jpg`} alt={product.product_name} />
            )}
          </div>
          <div className="modal-body stack">
            <h2 className="heading-lg" style={{ marginTop: 0 }}>{product.product_name}</h2>
            <p style={{ fontSize: 18, fontWeight: 600 }}>₹{product.price}</p>
            {product.category && (<p className="subtle" style={{ margin: 0 }}>Category: {product.category}</p>)}
            {product.stock_quantity != null && (<p className="subtle" style={{ margin: 0 }}>In Stock: {product.stock_quantity}</p>)}
            {/* Placeholder for description if added later */}
            {product.description && (<p>{product.description}</p>)}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 4 }}>
              <QuantitySelector value={qty} onChange={setQty} max={product.stock_quantity || undefined} />
              <span className="subtle" style={{ fontSize: 12 }}>Qty</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn" onClick={() => { addToCart(product, qty); onClose(); }}>Add {qty} to Cart</button>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
