import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { Megaphone, Users, Mail, MessageSquare, Send, CheckCircle, X, Search, Copy, ExternalLink, Calendar, Tag } from 'lucide-react';

const Marketing = () => {
    const [customers, setCustomers] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [status, setStatus] = useState({ msg: '', type: '' });

    const templates = [
        { id: 'discount', label: '10% OFF Discount', text: "Hello! Monsoon Meridian is offering a special 10% discount on all premium spices this week. Visit us today!" },
        { id: 'new_stock', label: 'New Stock Alert', text: "New arrivals! We just stocked fresh artisan chocolates and single-origin coffees. Come check them out at Monsoon Meridian." },
        { id: 'holiday', label: 'Holiday Greetings', text: "Season's Greetings from Monsoon Meridian! Thank you for being a valued customer. Stop by for a special holiday treat!" },
        { id: 'clearance', label: 'Clearance Sale', text: "Final Clearance! Everything must go. Buy 1 Get 1 Free on all nuts and dry fruits. Only at Monsoon Meridian." }
    ];

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('customer').select('*').order('name');
        if (!error && data) setCustomers(data);
        setLoading(false);
    };

    const showStatus = (msg, type = 'success') => {
        setStatus({ msg, type });
        setTimeout(() => setStatus({ msg: '', type: '' }), 4000);
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const selectAll = () => {
        if (selectedIds.length === filteredCustomers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredCustomers.map(c => c.id));
        }
    };

    const applyTemplate = (tpl) => {
        setMessage(tpl.text);
        setActiveTemplate(tpl.id);
    };

    const getSelectedCustomers = () => customers.filter(c => selectedIds.includes(c.id));

    // ── Actions ──
    const handleEmailBCC = () => {
        const selected = getSelectedCustomers().filter(c => c.email);
        if (selected.length === 0) return showStatus('No selected customers have email addresses', 'error');

        // Some clients (Outlook) prefer ; while others (Gmail) prefer ,
        // We'll use , as it's the standard, but ensure the string is clean.
        const emails = selected.map(c => c.email.trim()).join(',');
        const subject = encodeURIComponent("Special Offer from Monsoon Meridian");
        const body = encodeURIComponent(message);
        
        const mailtoUrl = `mailto:?bcc=${emails}&subject=${subject}&body=${body}`;
        
        // URL length check (standard limit is around 2000)
        if (mailtoUrl.length > 2000) {
            return showStatus(`Too many recipients (${selected.length}). Try selecting fewer customers.`, 'error');
        }

        // Using a hidden anchor tag is more reliable than window.open
        const link = document.createElement('a');
        link.href = mailtoUrl;
        link.click();
        
        showStatus(`Email app triggered for ${selected.length} customers`);
    };

    const handleWhatsAppSingle = (customer) => {
        if (!customer.phone) return showStatus(`No phone number for ${customer.name}`, 'error');
        const text = encodeURIComponent(message);
        const phone = customer.phone.replace(/[^0-9]/g, ''); // Basic cleaning
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    };

    const copyEmails = () => {
        const selected = getSelectedCustomers().filter(c => c.email);
        const emails = selected.map(c => c.email).join(', ');
        navigator.clipboard.writeText(emails);
        showStatus(`${selected.length} emails copied to clipboard`);
    };

    const copyNumbers = () => {
        const selected = getSelectedCustomers().filter(c => c.phone);
        const numbers = selected.map(c => c.phone).join(', ');
        navigator.clipboard.writeText(numbers);
        showStatus(`${selected.length} numbers copied to clipboard`);
    };

    const filteredCustomers = customers.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone?.includes(searchTerm) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.6rem', background: 'var(--c-wave)', color: 'white', borderRadius: '12px' }}>
                        <Megaphone size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Marketing & Offers</h1>
                        <p style={{ fontSize: '0.85rem', color: 'var(--c-text-secondary)', margin: 0 }}>Send free broadcast messages via WhatsApp and Email</p>
                    </div>
                </div>
                {status.msg && (
                    <div style={{ 
                        padding: '0.6rem 1.25rem', 
                        borderRadius: '99px', 
                        background: status.type === 'error' ? '#fee2e2' : '#f0fdf4',
                        color: status.type === 'error' ? '#991b1b' : '#166534',
                        fontSize: '0.85rem', fontWeight: 600, border: '1px solid currentColor'
                    }}>
                        {status.msg}
                    </div>
                )}
            </div>

            <div style={{ flex: 1, display: 'flex', gap: '1.5rem', minHeight: 0 }}>
                
                {/* LEFT: Customer Selection */}
                <div className="card" style={{ flex: '0 0 450px', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Users size={18} color="var(--c-wave)" /> Select Target Customers
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--c-bg)', padding: '0.2rem 0.6rem', borderRadius: '99px' }}>
                            {selectedIds.length} / {filteredCustomers.length} selected
                        </span>
                    </div>

                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)' }} />
                        <input 
                            type="text" 
                            placeholder="Search by name, phone or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ padding: '0.65rem 1rem 0.65rem 2.5rem', fontSize: '0.9rem' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button onClick={selectAll} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--c-wave)', background: 'none', border: '1px solid var(--c-wave)', padding: '0.3rem 0.75rem', borderRadius: '6px' }}>
                            {selectedIds.length === filteredCustomers.length ? 'Deselect All' : 'Select All Filtered'}
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--c-border)', borderRadius: '8px' }}>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>Loading customers...</div>
                        ) : filteredCustomers.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--c-text-secondary)' }}>No customers found.</div>
                        ) : (
                            filteredCustomers.map(cust => (
                                <div 
                                    key={cust.id}
                                    onClick={() => toggleSelect(cust.id)}
                                    style={{ 
                                        padding: '0.75rem 1rem', 
                                        borderBottom: '1px solid var(--c-border)', 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        backgroundColor: selectedIds.includes(cust.id) ? 'var(--c-bg-hover)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                >
                                    <div style={{ 
                                        width: '18px', height: '18px', 
                                        border: '2px solid var(--c-wave)', 
                                        borderRadius: '4px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: selectedIds.includes(cust.id) ? 'var(--c-wave)' : 'transparent'
                                    }}>
                                        {selectedIds.includes(cust.id) && <CheckCircle size={14} color="white" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{cust.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)', display: 'flex', gap: '1rem' }}>
                                            <span>{cust.phone || 'No Phone'}</span>
                                            <span>{cust.email || 'No Email'}</span>
                                        </div>
                                    </div>
                                    {selectedIds.includes(cust.id) && cust.phone && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleWhatsAppSingle(cust); }}
                                            title="Send individual WhatsApp"
                                            style={{ color: '#25D366', padding: '0.2rem' }}
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Message Composer */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Template Row */}
                    <div className="card" style={{ padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Tag size={16} /> Quick Templates
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                            {templates.map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => applyTemplate(t)}
                                    style={{ 
                                        padding: '0.75rem', 
                                        textAlign: 'left', 
                                        fontSize: '0.82rem', 
                                        fontWeight: 600,
                                        borderRadius: '8px',
                                        border: '1px solid',
                                        borderColor: activeTemplate === t.id ? 'var(--c-wave)' : 'var(--c-border)',
                                        background: activeTemplate === t.id ? '#eff6ff' : 'white',
                                        color: activeTemplate === t.id ? 'var(--c-wave)' : 'var(--c-text-primary)'
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Composer */}
                    <div className="card" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Send size={18} color="var(--c-wave)" /> Compose Message
                        </h3>
                        <textarea 
                            value={message}
                            onChange={e => { setMessage(e.target.value); setActiveTemplate(null); }}
                            placeholder="Enter your discount offer, advertisement or news here..."
                            style={{ 
                                flex: 1, 
                                width: '100%', 
                                padding: '1rem', 
                                borderRadius: '12px', 
                                border: '2px solid var(--c-border)',
                                fontSize: '1rem',
                                resize: 'none',
                                marginBottom: '1.5rem'
                            }}
                        />

                        {/* Broadcast Actions */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <button 
                                onClick={handleEmailBCC}
                                disabled={selectedIds.length === 0 || !message}
                                className="btn-secondary"
                                style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                    opacity: (selectedIds.length === 0 || !message) ? 0.5 : 1
                                }}
                            >
                                <Mail size={20} /> Bulk Email (BCC)
                            </button>
                            <button 
                                onClick={copyNumbers}
                                disabled={selectedIds.length === 0}
                                className="btn-primary"
                                style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                    backgroundColor: '#10b981',
                                    opacity: selectedIds.length === 0 ? 0.5 : 1
                                }}
                            >
                                <Copy size={20} /> Copy Phone List
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                            <button 
                                onClick={copyEmails}
                                disabled={selectedIds.length === 0}
                                className="btn-secondary"
                                style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                                    opacity: selectedIds.length === 0 ? 0.5 : 1,
                                    background: 'transparent',
                                    border: '1.5px solid var(--c-wave)',
                                    color: 'var(--c-wave)'
                                }}
                            >
                                <Mail size={20} /> Copy Email List (Manual)
                            </button>
                        </div>
                        
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--c-text-secondary)', padding: '0.75rem', background: 'var(--c-bg)', borderRadius: '8px' }}>
                            <ExternalLink size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                            <p style={{ fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
                                <strong>Free Broadcasting Guide:</strong> Use "Bulk Email" to open your mail app with all customers in the BCC field. For WhatsApp, click the individual icons in the customer list to send personalized messages for free.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Marketing;
