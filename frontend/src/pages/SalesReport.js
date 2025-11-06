import React, { useEffect, useState } from 'react';
import { managerAPI } from '../api';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SalesReport() {
  const { isManager, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState({ period: 'today', summary: {}, topProducts: [] });

  const period = params.get('period') || 'today';

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await managerAPI.getSalesReport({ period });
        setReport(res.data);
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load sales report');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  if (!isManager() && !isAdmin()) {
    return <div className="panel" style={{ margin: '2rem' }}>Access denied.</div>;
  }

  const changePeriod = (p) => {
    setParams({ period: p });
  };

  const { summary } = report;

  return (
    <div className="container" style={{ padding: '2rem' }}>
      <h1 className="heading-xl">Sales Report</h1>
      <p className="subtle" style={{ marginBottom: '1.5rem' }}>Sales performance overview</p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['today','week','month'].map(p => (
          <button key={p} className={`btn ${p===period ? 'primary' : ''}`} onClick={() => changePeriod(p)}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
        ))}
      </div>
      {loading && <div className="panel">Loading...</div>}
      {error && <div className="alert error">{error}</div>}
      {!loading && !error && (
        <div className="stack" style={{ gap: '2rem' }}>
          <section className="panel">
            <h2 className="heading-md">Summary</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="metric"><h3>Total Orders</h3><p>{summary?.total_orders || 0}</p></div>
              <div className="metric"><h3>Total Sales</h3><p>₹{Number(summary?.total_sales || 0).toFixed(2)}</p></div>
              <div className="metric"><h3>Avg Order</h3><p>₹{Number(summary?.average_order_value || 0).toFixed(2)}</p></div>
            </div>
          </section>
          <section className="panel">
            <h2 className="heading-md">Top Products</h2>
            {report.topProducts.length === 0 ? <p className="subtle">No data</p> : (
              <table className="data-table" style={{ marginTop: '1rem' }}>
                <thead>
                  <tr><th>Product</th><th>Sold</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {report.topProducts.map(tp => (
                    <tr key={tp.product_name}>
                      <td>{tp.product_name}</td>
                      <td>{tp.total_sold}</td>
                      <td>₹{Number(tp.revenue || 0).toFixed(2)}</td>
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
