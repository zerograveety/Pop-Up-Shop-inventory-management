import React, { useEffect, useState } from 'react';
import { managerAPI } from '../api';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

export default function InventoryReport() {
  const { isManager, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ lowStockProducts: [], inventoryValue: null, categoryBreakdown: [] });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Align endpoint path with backend (/api/manager/reports/inventory)
        const res = await managerAPI.getInventoryReport();
        setData(res.data);
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load inventory report');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!isManager() && !isAdmin()) {
    return <div className="panel" style={{ margin: '2rem' }}>Access denied.</div>;
  }

  return (
    <div className="container" style={{ padding: '2rem' }}>
      <h1 className="heading-xl">Inventory Report</h1>
      <p className="subtle" style={{ marginBottom: '1.5rem' }}>Current stock health and valuation</p>
      {loading && <div className="panel">Loading...</div>}
      {error && <div className="alert error">{error}</div>}
      {!loading && !error && (
        <div className="stack" style={{ gap: '2rem' }}>
          <section className="panel">
            <h2 className="heading-md">Summary</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="metric">
                <h3>Total Products</h3>
                <p>{data.inventoryValue?.total_products || 0}</p>
              </div>
              <div className="metric">
                <h3>Total Cost Value</h3>
                <p>₹{Number(data.inventoryValue?.total_cost_value || 0).toFixed(2)}</p>
              </div>
              <div className="metric">
                <h3>Total Selling Value</h3>
                <p>₹{Number(data.inventoryValue?.total_selling_value || 0).toFixed(2)}</p>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="heading-md">Low Stock Products</h2>
            {data.lowStockProducts.length === 0 ? <p className="subtle">None 🎉</p> : (
              <table className="data-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>Category</th><th>Stock</th><th>Reorder Level</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockProducts.map(p => (
                    <tr key={p.product_id}>
                      <td>{p.product_id}</td>
                      <td>{p.product_name}</td>
                      <td>{p.category || '-'}</td>
                      <td>{p.stock_quantity}</td>
                      <td>{p.reorder_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h2 className="heading-md">Category Breakdown</h2>
            {data.categoryBreakdown.length === 0 ? <p className="subtle">No data</p> : (
              <table className="data-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th>Category</th><th>Products</th><th>Total Stock</th><th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categoryBreakdown.map(c => (
                    <tr key={c.category}>
                      <td>{c.category || 'Uncategorized'}</td>
                      <td>{c.product_count}</td>
                      <td>{c.total_stock}</td>
                      <td>₹{Number(c.category_value || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
