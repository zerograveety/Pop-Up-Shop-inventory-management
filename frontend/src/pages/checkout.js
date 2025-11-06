import { useState } from "react";
import API from "../api";
import QuantitySelector from "../components/QuantitySelector";
import LoadingSkeleton from "../components/LoadingSkeleton";

export default function Checkout({ cart, clearCart, updateCartItem, removeCartItem, addToast }) {
  const [loading, setLoading] = useState(false);
  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setLoading(true);
    try {
      for (let item of cart) {
        await API.post("/orders", {
          customer_id: 1,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          discount: 0,
          tax: 0,
          total_amount: item.price * item.quantity,
          event_id: 1
        });
      }
      addToast("Order placed successfully! 🎉", "success", 4000);
      clearCart();
    } catch (err) {
      console.error(err);
      addToast("Error placing order. Please try again.", "error", 4000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container section">
        <div className="panel" style={{ padding: 'var(--space-8)' }}>
          <h2 className="heading-lg">Processing Order...</h2>
          <LoadingSkeleton type="list" />
          <LoadingSkeleton type="list" />
          <div style={{ height: '60px', marginTop: 'var(--space-6)' }} className="loading-skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="panel" style={{ padding: 'var(--space-8)' }}>
        <h2 className="heading-lg">Shopping Cart</h2>
        
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <div style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>🛒</div>
            <h3 className="heading-md">Your cart is empty</h3>
            <p className="subtle">Add some products to get started!</p>
          </div>
        ) : (
          <>
            <div className="list" style={{ marginTop: 'var(--space-6)' }}>
              {cart.map((item, index) => (
                <div 
                  className="list-item" 
                  key={item.product_id}
                  style={{ 
                    gap: 'var(--space-4)', 
                    alignItems: 'stretch',
                    animation: `slide-up 0.3s ease-out ${index * 0.1}s forwards`
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="font-semibold text-lg">{item.product_name}</div>
                    <div className="subtle text-sm" style={{ marginBottom: 'var(--space-3)' }}>
                      ₹{item.price} each
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <QuantitySelector
                        value={item.quantity}
                        onChange={(q) => updateCartItem(item.product_id, q)}
                        max={item.stock_quantity || undefined}
                        small
                      />
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => removeCartItem(item.product_id)} 
                        aria-label={`Remove ${item.product_name}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div style={{ minWidth: '100px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="font-bold text-lg">₹{item.price * item.quantity}</div>
                    <div className="subtle text-xs">{item.quantity} × ₹{item.price}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="total" style={{ marginTop: 'var(--space-6)' }}>
              <span className="text-lg">Total Amount</span>
              <strong className="text-2xl">₹{total.toFixed(2)}</strong>
            </div>

            <div style={{ marginTop: 'var(--space-6)', display: "flex", gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-lg" 
                onClick={handleCheckout} 
                disabled={cart.length === 0 || loading}
                style={{ flex: 1, minWidth: '200px' }}
              >
                {loading ? 'Processing...' : `Place Order (₹${total})`}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={clearCart} 
                disabled={cart.length === 0 || loading}
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}