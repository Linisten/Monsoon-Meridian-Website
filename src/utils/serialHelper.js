/**
 * serialHelper.js
 * A free alternative to QZ Tray using the Web Serial API.
 * This allows direct communication with USB/Serial thermal printers from Chrome/Edge.
 * UPGRADED: Added support for Raster Graphics (Images/Logos).
 */

class SerialHelper {
    constructor() {
        this.port = null;
        this.writer = null;
        this.usbDevice = null;
        this.usbEndpoint = null;
        this.connectionType = null; // 'serial' or 'usb'
        this.isConnecting = false;
    }

    // Common ESC/POS Commands
    static Commands = {
        INIT: '\x1B\x40',
        ALIGN_LEFT: '\x1B\x61\x00',
        ALIGN_CENTER: '\x1B\x61\x01',
        ALIGN_RIGHT: '\x1B\x61\x02',
        BOLD_ON: '\x1B\x45\x01',
        BOLD_OFF: '\x1B\x45\x00',
        CUT: '\x1D\x56\x00',
        FEED_6: '\x1B\x64\x06',
        WIDE_ON: '\x1D\x21\x11', 
        WIDE_OFF: '\x1D\x21\x00',
    };

    /** Connect using Web Serial API (Needs Virtual COM Port) */
    async requestPort() {
        if (this.isConnecting) return;
        try {
            this.isConnecting = true;
            if (!navigator.serial) throw new Error("Web Serial API not supported. Use Chrome/Edge.");
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 9600 });
            this.writer = this.port.writable.getWriter();
            this.connectionType = 'serial';
            this.usbDevice = null;
            return true;
        } catch (err) {
            console.error("Serial Connection Failed:", err);
            throw err;
        } finally {
            this.isConnecting = false;
        }
    }

    /** Connect using WebUSB API (For Raw USB Printers) */
    async requestUsbPort() {
        if (this.isConnecting) return;
        try {
            this.isConnecting = true;
            if (!navigator.usb) throw new Error("WebUSB API not supported. Use Chrome/Edge.");
            
            // Use empty filters to show all USB devices
            this.usbDevice = await navigator.usb.requestDevice({ filters: [] });
            await this.usbDevice.open();
            
            if (this.usbDevice.configuration === null) {
                await this.usbDevice.selectConfiguration(1);
            }
            
            // Claim interface 0 (standard for printers)
            await this.usbDevice.claimInterface(0);
            
            const endpoints = this.usbDevice.configuration.interfaces[0].alternate.endpoints;
            const outEndpoint = endpoints.find(e => e.direction === 'out');
            
            if (!outEndpoint) {
                throw new Error("No OUT endpoint found on printer.");
            }
            
            this.usbEndpoint = outEndpoint.endpointNumber;
            this.connectionType = 'usb';
            this.port = null;
            this.writer = null;
            return true;
        } catch (err) {
            console.error("USB Connection Failed:", err);
            throw err;
        } finally {
            this.isConnecting = false;
        }
    }

    async write(content) {
        const encoder = new TextEncoder();
        const data = typeof content === 'string' ? encoder.encode(content) : content;

        if (this.connectionType === 'serial') {
            if (!this.writer) {
                if (this.port && this.port.writable) {
                    this.writer = this.port.writable.getWriter();
                } else {
                    throw new Error("Serial printer not connected.");
                }
            }
            await this.writer.write(data);
        } else if (this.connectionType === 'usb') {
            if (!this.usbDevice || !this.usbEndpoint) {
                throw new Error("USB printer not connected.");
            }
            await this.usbDevice.transferOut(this.usbEndpoint, data);
        } else {
            throw new Error("Printer not connected. Please click one of the Connect buttons.");
        }
    }

    /**
     * Prints an image from a URL.
     * Converts to 1-bit monochrome raster.
     */
    async printImage(url, maxWidth = 384) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = async () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Scale to fit printer width
                    const scale = maxWidth / img.width;
                    canvas.width = maxWidth;
                    canvas.height = img.height * scale;
                    
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const pixels = imageData.data;
                    
                    const widthInBytes = Math.ceil(canvas.width / 8);
                    const rasterData = new Uint8Array(widthInBytes * canvas.height);
                    
                    for (let y = 0; y < canvas.height; y++) {
                        for (let x = 0; x < canvas.width; x++) {
                            const i = (y * canvas.width + x) * 4;
                            // Grayscale conversion
                            const avg = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
                            // Threshold (invert because 1 is black in ESC/POS raster)
                            if (avg < 128) {
                                const byteIdx = (y * widthInBytes) + Math.floor(x / 8);
                                rasterData[byteIdx] |= (0x80 >> (x % 8));
                            }
                        }
                    }

                    // GS v 0 m xL xH yL yH d1...dk
                    const header = new Uint8Array([
                        0x1D, 0x76, 0x30, 0, 
                        widthInBytes & 0xFF, (widthInBytes >> 8) & 0xFF,
                        canvas.height & 0xFF, (canvas.height >> 8) & 0xFF
                    ]);

                    await this.write(header);
                    await this.write(rasterData);
                    resolve();
                } catch (e) { reject(e); }
            };
            img.onerror = () => reject(new Error("Failed to load logo image at " + url));
            img.src = url;
        });
    }

    async printQRCode(data) {
        const encoder = new TextEncoder();
        const urlBytes = encoder.encode(data);
        const pL = (urlBytes.length + 3) & 0xFF;
        const pH = (urlBytes.length + 3) >> 8;
        await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04]));
        await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]));
        const storeHeader = new Uint8Array([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]);
        const storeCmd = new Uint8Array(storeHeader.length + urlBytes.length);
        storeCmd.set(storeHeader);
        storeCmd.set(urlBytes, storeHeader.length);
        await this.write(storeCmd);
        await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]));
    }

    async printElement(elementId, tx, settings) {
        if (!tx) return;
        try {
            const cmds = SerialHelper.Commands;
            await this.write(cmds.INIT);
            await this.write(cmds.ALIGN_CENTER);
            
            // LOGO
            try {
                // Try to print the logo from the public folder (Enlarged to 384px)
                await this.printImage('/logo.jpg', 384); 
                await this.write('\x0A'); // Newline after logo
            } catch (e) {
                console.warn("Logo print failed, skipping:", e);
                // Fallback to minimal header if logo fails
                await this.write(cmds.WIDE_ON + cmds.BOLD_ON + (settings?.company_name || 'MONSOON') + "\x0A" + cmds.WIDE_OFF + cmds.BOLD_OFF);
            }

            if (settings?.address) await this.write(settings.address + "\x0A");
            if (settings?.phone) await this.write("Tel: " + settings.phone + "\x0A");
            if (settings?.gst_no) await this.write("GSTIN: " + settings.gst_no + "\x0A");
            await this.write("--------------------------------\x0A");

            await this.write(cmds.ALIGN_LEFT);
            await this.write("Invoice: " + (tx.id?.substring(0, 8) || 'NA') + "\x0A");
            await this.write("Date:    " + (tx.date?.split(',')[0]) + "\x0A");
            await this.write("Cust:    " + (tx.customer_name || 'Walk-in') + "\x0A");
            await this.write("--------------------------------\x0A");

            await this.write("Item          Qty       Amt\x0A");
            for (const it of tx.items_json) {
                const name = it.name.substring(0, 14).padEnd(14, ' ');
                const qty = String(it.qty || 1).padStart(3, ' ');
                const amt = (it.price * it.qty).toFixed(2).padStart(10, ' ');
                await this.write(`${name} ${qty} ${amt}\x0A`);
            }
            await this.write("--------------------------------\x0A");

            await this.write(cmds.ALIGN_RIGHT);
            await this.write(cmds.BOLD_ON + "TOTAL: INR " + tx.total_amount.toFixed(2) + cmds.BOLD_OFF + "\x0A\x0A");

            await this.write(cmds.ALIGN_CENTER);
            await this.write("Follow on Instagram\x0A");
            await this.printQRCode("https://www.instagram.com/monsoonmeridian/");
            await this.write("\x0A@MONSOONMERIDIAN\x0A");
            await this.write("\x0A*** THANK YOU — VISIT AGAIN ***\x0A");
            await this.write(cmds.FEED_6);
            await this.write(cmds.CUT);

        } catch (err) {
            console.error("Serial Print Error:", err);
            throw err;
        }
    }
}

export default new SerialHelper();
