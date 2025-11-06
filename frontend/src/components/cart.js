export default function Cart({ cart, removeFromCart }) {
    return (
      <div>
        <h2>Cart</h2>
        {cart.length === 0 ? <p>No items in cart</p> : null}
        {cart.map((item, idx) => (
          <div key={idx} style={{ borderBottom: "1px solid #ccc", margin: "5px" }}>
            <h3>{item.product_name}</h3>
            <p>Qty: {item.quantity}</p>
            <button onClick={() => removeFromCart(item.product_id)}>Remove</button>
          </div>
        ))}
      </div>
    );
  }