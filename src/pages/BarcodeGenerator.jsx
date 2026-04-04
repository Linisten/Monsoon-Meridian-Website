import React, { useState, useRef } from 'react';
import Barcode from 'react-barcode';
import { Printer, Settings2 } from 'lucide-react';

const BarcodeGenerator = () => {
  const [barcodeValue, setBarcodeValue] = useState('123456789012');
  const [productName, setProductName] = useState('Premium Coffee');
  const [price, setPrice] = useState('150.00');
  const [copies, setCopies] = useState(1);
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    // Create an iframe to print the barcodes cleanly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-9999px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    
    doc.write(`
      <html>
        <head>
          <title>Print Barcodes</title>
          <style>
            @media print {
              @page { margin: 0; }
              body { 
                margin: 0; 
                padding: 10px;
                display: flex; 
                flex-wrap: wrap; 
                gap: 10px;
                font-family: sans-serif;
              }
              .sticker {
                width: 50mm;
                height: 25mm;
                border: 1px dashed #ccc;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2px;
                box-sizing: border-box;
                page-break-inside: avoid;
              }
              .title { font-size: 10px; font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
              .price { font-size: 10px; font-weight: bold; margin-top: 2px; }
            }
          </style>
        </head>
        <body>
          ${Array(Number(copies)).fill(printContent.innerHTML).join('')}
        </body>
      </html>
    `);

    doc.close();

    // Wait for images/SVG to render within iframe
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      document.body.removeChild(iframe);
    }, 500);
  };

  return (
    <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--c-olive-dark)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Settings2 size={24} /> Custom Barcode Generator
      </h1>

      <div style={{ display: 'flex', gap: '2rem' }}>
        
        {/* Controls */}
        <div className="card" style={{ flex: '1', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Barcode Value (Number or Text)</label>
            <input 
              type="text" 
              value={barcodeValue} 
              onChange={e => setBarcodeValue(e.target.value)} 
              placeholder="e.g. 890123456789"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }} 
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Product Name Label</label>
            <input 
              type="text" 
              value={productName} 
              onChange={e => setProductName(e.target.value)} 
              placeholder="Product Name"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }} 
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Price Label (Optional)</label>
            <input 
              type="text" 
              value={price} 
              onChange={e => setPrice(e.target.value)} 
              placeholder="e.g. 150.00"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }} 
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--c-text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Copies to Print</label>
            <input 
              type="number" 
              min="1" max="100" 
              value={copies} 
              onChange={e => setCopies(e.target.value)} 
              style={{ width: '100px', padding: '0.75rem', fontSize: '1rem' }} 
            />
          </div>

          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: '1rem', marginTop: '1rem' }}>
            <button onClick={handlePrint} className="btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Printer size={20} /> Print {copies} Labels
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="card" style={{ flex: '1', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--c-text-secondary)', marginBottom: '2rem' }}>Live Preview (Sticker Format)</h3>
          
          <div 
            style={{ 
              background: 'white', 
              padding: '1rem', 
              boxShadow: 'var(--shadow-md)', 
              borderRadius: 8,
              border: '1px dashed #cbd5e1'
            }}
          >
            {/* The actual HTML rendered for the sticker view */}
            <div ref={printRef}>
              <div className="sticker" style={{ width: '50mm', height: '25mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', boxSizing: 'border-box' }}>
                {productName && (
                  <div className="title" style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px', fontFamily: 'sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {productName.toUpperCase()}
                  </div>
                )}
                {barcodeValue ? (
                  <Barcode value={barcodeValue} width={1.2} height={35} fontSize={10} margin={0} background="#ffffff" />
                ) : (
                  <div style={{ height: '35px', display: 'flex', alignItems: 'center', color: '#999', fontSize: '10px' }}>No Data</div>
                )}
                {price && (
                  <div className="price" style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px', fontFamily: 'sans-serif' }}>
                    Rs {price}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BarcodeGenerator;
