import React, { useState, useEffect } from 'react';
import { Printer, Download, Filter, TrendingUp, ShoppingCart, Package, DollarSign, X } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

const Reports = () => {
  const [reportType, setReportType] = useState('sales');
  const [salesData,    setSalesData]    = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [itemsData,    setItemsData]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [dateTo,   setDateTo]   = useState(new Date().toISOString().split('T')[0]);
  const [taxRate,  setTaxRate]  = useState(5);
  const [activeRecord, setActiveRecord] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [s, p, i, t] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('purchases').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*').order('name'),
      supabase.from('tax').select('rate_percent').limit(1).single(),
    ]);
    if (!s.error) setSalesData(s.data || []);
    if (!p.error) setPurchaseData(p.data || []);
    if (!i.error) setItemsData(i.data || []);
    if (!t.error && t.data) setTaxRate(t.data.rate_percent || 5);
    setLoading(false);
  };

  const filterByDate = (rows) => rows.filter(r => {
    const d = r.created_at?.split('T')[0];
    return d >= dateFrom && d <= dateTo;
  });

  const filteredSales    = filterByDate(salesData);
  const filteredPurchases= filterByDate(purchaseData);

  const totalSales     = filteredSales.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalPurchases = filteredPurchases.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalStock     = itemsData.reduce((s, i) => s + (i.stock_quantity || 0) * (i.price || 0), 0);
  const profit         = totalSales - totalPurchases;

  const printReport = () => {
    let tableHTML = '';
    const now = new Date().toLocaleString();
    const dateRange = `${dateFrom} to ${dateTo}`;

    if (reportType === 'sales') {
      tableHTML = `
        <h2>Sales Report</h2>
        <p>Period: ${dateRange} &nbsp;|&nbsp; Generated: ${now}</p>
        <table>
          <thead><tr><th>#</th><th>Invoice ID</th><th>Date &amp; Time</th><th>Payment</th><th style="text-align:right">Amount (₹)</th></tr></thead>
          <tbody>
            ${filteredSales.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td style="font-family:monospace;font-size:11px">${r.id}</td>
                <td>${new Date(r.created_at).toLocaleString()}</td>
                <td>${r.payment_method || 'CASH'}</td>
                <td style="text-align:right;font-weight:600">${(r.total_amount || 0).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="4" style="text-align:right;font-weight:700">Grand Total:</td><td style="text-align:right;font-weight:700">${totalSales.toFixed(2)}</td></tr>
          </tfoot>
        </table>`;
    } else if (reportType === 'purchase') {
      tableHTML = `
        <h2>Purchase Report</h2>
        <p>Period: ${dateRange} &nbsp;|&nbsp; Generated: ${now}</p>
        <table>
          <thead><tr><th>#</th><th>Supplier</th><th>Date</th><th style="text-align:right">Amount (₹)</th></tr></thead>
          <tbody>
            ${filteredPurchases.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${r.supplier || '—'}</td>
                <td>${new Date(r.created_at).toLocaleString()}</td>
                <td style="text-align:right;font-weight:600">${(r.total_amount || 0).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="3" style="text-align:right;font-weight:700">Grand Total:</td><td style="text-align:right;font-weight:700">${totalPurchases.toFixed(2)}</td></tr>
          </tfoot>
        </table>`;
    } else if (reportType === 'inventory') {
      tableHTML = `
        <h2>Inventory Valuation Report</h2>
        <p>Generated: ${now}</p>
        <table>
          <thead><tr><th>Code</th><th>Item Name</th><th>Category</th><th>Unit/Pack</th><th style="text-align:right">Price (₹)</th><th style="text-align:right">Stock Qty</th><th style="text-align:right">Stock Value (₹)</th></tr></thead>
          <tbody>
            ${itemsData.map(item => {
              const val = ((item.stock_quantity || 0) * (item.price || 0)).toFixed(2);
              const isLow = (item.stock_quantity || 0) <= (item.low_stock_alert || 5);
              return `<tr style="${isLow ? 'color:#dc2626' : ''}">
                <td>${item.code || ''}</td>
                <td>${item.name}</td>
                <td>${item.category || ''}</td>
                <td>${item.unit || item.pack || ''}</td>
                <td style="text-align:right">${(item.price || 0).toFixed(2)}</td>
                <td style="text-align:right">${(item.stock_quantity || 0).toFixed(2)}${isLow ? ' ⚠' : ''}</td>
                <td style="text-align:right;font-weight:600">${val}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr><td colspan="6" style="text-align:right;font-weight:700">Total Stock Value:</td><td style="text-align:right;font-weight:700">${totalStock.toFixed(2)}</td></tr>
          </tfoot>
        </table>`;
    } else if (reportType === 'tax') {
      const taxable = totalSales / (1 + taxRate / 100);
      const gst = totalSales - taxable;
      tableHTML = `
        <h2>GST / Tax Summary</h2>
        <p>Period: ${dateRange} &nbsp;|&nbsp; Generated: ${now}</p>
        <table>
          <thead><tr><th>Metric</th><th style="text-align:right">Value (₹)</th></tr></thead>
          <tbody>
            <tr><td>Total Sales</td><td style="text-align:right">${totalSales.toFixed(2)}</td></tr>
            <tr><td>Taxable Sales (@ ${taxRate}%)</td><td style="text-align:right">${taxable.toFixed(2)}</td></tr>
            <tr><td>GST Collected</td><td style="text-align:right;font-weight:700">${gst.toFixed(2)}</td></tr>
            <tr><td>Total Transactions</td><td style="text-align:right">${filteredSales.length}</td></tr>
          </tbody>
        </table>`;
    }

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
      <html>
        <head>
          <title>Report — Monsoon Meridian</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; font-size: 13px; margin: 2rem; color: #1a1a1a; }
            h2 { margin-bottom: 0.25rem; font-size: 1.4rem; color: #3a5a2a; }
            p { margin: 0 0 1rem 0; color: #666; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
            th { background: #3a5a2a; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
            td { padding: 6px 12px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            tfoot td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${tableHTML}</body>
      </html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const exportCSV = (rows, columns, filename) => {
    if (!rows || rows.length === 0) return alert('No data to export.');
    
    // Create CSV content with proper escaping for commas
    const headerRow = columns.map(c => `"${c.header.toUpperCase()}"`).join(',');
    const dataRows = rows.map(r => 
      columns.map(c => {
        let val = '';
        if (c.formatter) {
          val = c.formatter(r);
        } else {
          val = r[c.key] ?? '';
        }
        // Escape quotes and wrap in quotes
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    const csvContent = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (reportType === 'sales') {
      exportCSV(filteredSales, [
        { header: 'Invoice ID', key: 'id' },
        { header: 'Date & Time', formatter: r => new Date(r.created_at).toLocaleString() },
        { header: 'Payment', formatter: r => r.payment_method || 'CASH' },
        { header: 'Amount', formatter: r => (r.total_amount || 0).toFixed(2) }
      ], 'sales_report.csv');
    } else if (reportType === 'purchase') {
      exportCSV(filteredPurchases, [
        { header: 'Supplier', formatter: r => r.supplier || '—' },
        { header: 'Date', formatter: r => new Date(r.created_at).toLocaleString() },
        { header: 'Amount', formatter: r => (r.total_amount || 0).toFixed(2) }
      ], 'purchase_report.csv');
    } else if (reportType === 'inventory') {
      exportCSV(itemsData, [
        { header: 'Code', key: 'code' },
        { header: 'Item Name', key: 'name' },
        { header: 'Category', key: 'category' },
        { header: 'Unit/Pack', formatter: r => r.unit || r.pack || '' },
        { header: 'Price', formatter: r => (r.price || 0).toFixed(2) },
        { header: 'Stock Qty', formatter: r => (r.stock_quantity || 0).toFixed(2) },
        { header: 'Stock Value', formatter: r => ((r.stock_quantity || 0) * (r.price || 0)).toFixed(2) }
      ], 'inventory_report.csv');
    } else if (reportType === 'tax') {
      const taxSummary = [
        { label: 'Total Sales', value: totalSales.toFixed(2) },
        { label: `Taxable Sales (@${taxRate}%)`, value: (totalSales / (1 + taxRate/100)).toFixed(2) },
        { label: `GST Collected`, value: (totalSales - (totalSales / (1 + taxRate/100))).toFixed(2) },
        { label: 'Transactions Count', value: filteredSales.length }
      ];
      exportCSV(taxSummary, [
        { header: 'Metric', key: 'label' },
        { header: 'Value', key: 'value' }
      ], 'tax_summary_report.csv');
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ width: 56, height: 56, borderRadius: 12, background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
        <Icon size={28} />
      </div>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--c-text-secondary)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--c-text-primary)' }}>₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
      </div>
    </div>
  );

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <StatCard icon={TrendingUp}    label="Total Sales"      value={totalSales}     color="var(--c-success)" />
        <StatCard icon={ShoppingCart}  label="Total Purchases"  value={totalPurchases} color="var(--c-info)"    />
        <StatCard icon={DollarSign}    label="Gross Profit"     value={profit}         color={profit >= 0 ? 'var(--c-success)' : 'var(--c-danger)'} />
        <StatCard icon={Package}       label="Stock Value"      value={totalStock}     color="var(--c-warning)" />
      </div>

      {/* Controls bar */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={reportType} onChange={e => setReportType(e.target.value)} style={{ width: 220 }}>
            <option value="sales">Sales Report</option>
            <option value="purchase">Purchase Report</option>
            <option value="inventory">Inventory Valuation</option>
            <option value="tax">GST / Tax Summary</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ color: 'var(--c-text-secondary)', fontWeight: 700 }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button className="btn-primary" onClick={fetchAll} style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} /> Refresh
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-primary" onClick={printReport} style={{ backgroundColor: 'var(--c-info)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} /> Print
          </button>
          <button className="btn-primary" onClick={handleExport} style={{ backgroundColor: 'var(--c-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Table */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ backgroundColor: '#f1f5f9', padding: '1rem 1.5rem', borderBottom: '1px solid var(--c-border)' }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: 'var(--c-text-primary)' }}>
            {reportType === 'sales' && `Sales Report — ${filteredSales.length} transactions`}
            {reportType === 'purchase' && `Purchase Report — ${filteredPurchases.length} records`}
            {reportType === 'inventory' && `Inventory Valuation — ${itemsData.length} items`}
            {reportType === 'tax' && 'GST / Tax Summary'}
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>Loading data...</div>}

          {/* SALES TABLE */}
          {!loading && reportType === 'sales' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>#</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Invoice ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Payment</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>No sales in this period.</td></tr>}
                {filteredSales.map((row, i) => (
                  <tr key={row.id} 
                      onClick={() => setActiveRecord({ type: 'sales', data: row })}
                      style={{ borderBottom: '1px solid var(--c-border)', background: i % 2 === 0 ? 'white' : '#f8fafc', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#f8fafc'}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--c-text-secondary)' }}>{i + 1}</td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.id}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(row.created_at).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, background: row.payment_method === 'CASH' ? '#dcfce7' : row.payment_method?.includes('CARD') ? '#dbeafe' : '#ede9fe', color: row.payment_method === 'CASH' ? '#166534' : row.payment_method?.includes('CARD') ? '#1e40af' : '#5b21b6' }}>
                        {row.payment_method || 'CASH'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>₹{(row.total_amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--c-border)', background: '#f1f5f9', fontWeight: 800 }}>
                  <td colSpan={4} style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Grand Total:</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '1.1rem', color: 'var(--c-success)' }}>₹{totalSales.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* PURCHASE TABLE */}
          {!loading && reportType === 'purchase' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>#</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Supplier</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>No purchases in this period.</td></tr>}
                {filteredPurchases.map((row, i) => (
                  <tr key={row.id} 
                      onClick={() => setActiveRecord({ type: 'purchase', data: row })}
                      style={{ borderBottom: '1px solid var(--c-border)', background: i % 2 === 0 ? 'white' : '#f8fafc', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#f8fafc'}
                  >
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--c-text-secondary)' }}>{i + 1}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{row.supplier || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{new Date(row.created_at).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>₹{(row.total_amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--c-border)', background: '#f1f5f9', fontWeight: 800 }}>
                  <td colSpan={3} style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Grand Total:</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '1.1rem', color: 'var(--c-info)' }}>₹{totalPurchases.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* INVENTORY TABLE */}
          {!loading && reportType === 'inventory' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Code</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Item Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Unit/Pack</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Stock Qty</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {itemsData.map((item, i) => {
                  const val = (item.stock_quantity || 0) * (item.price || 0);
                  const isLow = (item.stock_quantity || 0) <= (item.low_stock_alert || 5);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--c-border)', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.code}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{item.name}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, background: '#f1f5f9', fontWeight: 700 }}>{item.category}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{item.unit || item.pack}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>₹{(item.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: isLow ? 'var(--c-danger)' : 'inherit', fontWeight: isLow ? 700 : 400 }}>
                        {(item.stock_quantity || 0).toFixed(2)} {isLow && '⚠'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>₹{val.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--c-border)', background: '#f1f5f9', fontWeight: 800 }}>
                  <td colSpan={6} style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Stock Value:</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '1.1rem', color: 'var(--c-warning)' }}>₹{totalStock.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAX SUMMARY */}
          {!loading && reportType === 'tax' && (
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '2rem', textAlign: 'center' }}>
                <div><div style={{ fontSize: '0.9rem', color: 'var(--c-text-secondary)', fontWeight: 700 }}>Total Taxable Sales</div><div style={{ fontSize: '2rem', fontWeight: 900 }}>₹{(totalSales / (1 + taxRate/100)).toFixed(2)}</div></div>
                <div><div style={{ fontSize: '0.9rem', color: 'var(--c-text-secondary)', fontWeight: 700 }}>GST @ {taxRate}% Collected</div><div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--c-danger)' }}>₹{(totalSales - totalSales / (1 + taxRate/100)).toFixed(2)}</div></div>
                <div><div style={{ fontSize: '0.9rem', color: 'var(--c-text-secondary)', fontWeight: 700 }}>Total Transactions</div><div style={{ fontSize: '2rem', fontWeight: 900 }}>{filteredSales.length}</div></div>
              </div>
              <p style={{ color: 'var(--c-text-secondary)', fontSize: '0.9rem' }}>Note: Tax is estimated at the default rate of {taxRate}%. Consult your CA for exact GSTR filing computations.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* ─── OVERLAY: Details Modal ────────────────────────────────────────── */}
      {activeRecord && (() => {
        const isSale = activeRecord.type === 'sales';
        const data = activeRecord.data;
        const itemsList = data.items_json || [];

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="card" style={{ width: 680, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
              
              {/* Header */}
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--c-text-primary)' }}>
                    {isSale ? 'Sale Invoice Detail' : 'Purchase Bill Detail'}
                  </h2>
                  <div style={{ color: 'var(--c-text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                    <b>ID/Bill No:</b> {data.id || data.bill_no || 'NA'} &nbsp;|&nbsp; <b>Date:</b> {new Date(data.created_at).toLocaleString()}
                  </div>
                  <div style={{ color: 'var(--c-text-secondary)', fontSize: '0.9rem', marginTop: 2 }}>
                    <b>{isSale ? 'Customer:' : 'Supplier:'}</b> {isSale ? (data.customer_name || 'Walk-in Customer') : (data.supplier || '—')}
                    {isSale && <span style={{ marginLeft: 16 }}><b>Payment:</b> {data.payment_method}</span>}
                    {!isSale && <span style={{ marginLeft: 16 }}><b>Ref No:</b> {data.reference_no || 'NA'} &nbsp;|&nbsp; <b>Mode:</b> {data.payment_mode || 'Cash'}</span>}
                  </div>
                </div>
                <button onClick={() => setActiveRecord(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)' }}><X size={24} /></button>
              </div>

              {/* Items Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '2px solid var(--c-border)' }}>
                    <tr>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Item Description</th>
                      <th style={{ padding: '0.6rem', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Unit Rate</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsList.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>No items detail recorded.</td></tr>}
                    {itemsList.map((it, idx) => {
                      const name = it.name || 'Unknown Item';
                      const rate = it.price || it.rate || 0;
                      const qty  = it.qty || 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '0.6rem' }}>
                            {name} 
                            {(it.unit || it.pack) ? <span style={{color: '#94a3b8', fontSize: '0.8rem', marginLeft: 6}}>({it.unit || it.pack})</span> : ''}
                            {!isSale && it.mrp ? <span style={{color: '#94a3b8', fontSize: '0.8rem', marginLeft: 6}}>MRP: ₹{it.mrp}</span> : ''}
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 700 }}>{qty}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right' }}>₹{Number(rate).toFixed(2)}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700 }}>₹{(qty * rate).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Sub-charges Section */}
                <div style={{ marginTop: '1.5rem', marginLeft: 'auto', width: 280, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                  
                  {/* Dynamic Other Charges for Purchases */}
                  {!isSale && data.other_charges && Array.isArray(data.other_charges) && data.other_charges.map((charge, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--c-text-secondary)' }}>{charge.name || 'Charge'}:</span>
                      <span>₹{Number(charge.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}

                  {/* Fallback for legacy columns */}
                  {data.freight > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--c-text-secondary)' }}>Freight:</span><span>₹{Number(data.freight).toFixed(2)}</span></div>}
                  {data.labor_charge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--c-text-secondary)' }}>Labor Charge:</span><span>₹{Number(data.labor_charge).toFixed(2)}</span></div>}
                  
                  {isSale && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--c-text-secondary)' }}>Est. Tax ({data.tax_percent || 0}%):</span><span>Included</span></div>}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.2rem', borderTop: '2px solid var(--c-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span>Grand Total:</span>
                    <span>₹{Number(data.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
                
                {(data.internal_notes || data.notes) && (
                   <div style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', borderRadius: 8, fontSize: '0.85rem' }}>
                     <strong style={{ color: '#92400e' }}>Notes:</strong> {data.internal_notes || data.notes}
                   </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Printer size={16} /> Print</button>
                <button onClick={() => setActiveRecord(null)} className="btn-primary">Close Details</button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Reports;
