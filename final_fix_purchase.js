import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'pages', 'Purchase.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The count confirms 5 missing </div>s if we want to reach the root.
// Let's re-verify the nesting at the end of Right Pane.

const rightPaneEnd = `
            <div style={{ display: 'flex', marginTop: '1rem', justifyContent: 'flex-end' }}>
               <button onClick={savePurchase} className="btn-primary" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--c-success)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                 <CheckCircle size={18} /> Process Purchase
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Purchase;
`;

// Identify the 'Process Purchase' button block and replace everything after it.
const target = /<div style=\{\{ display: 'flex', marginTop: '1rem', justifyContent: 'flex-end' \}\}>[\s\S]*?<\/button>\s*<\/div>/;

if (target.test(content)) {
    // We replace from the button container to the end of the component
    content = content.replace(
        /<div style=\{\{ display: 'flex', marginTop: '1rem', justifyContent: 'flex-end' \}\}>[\s\S]*?export default Purchase;/,
        rightPaneEnd.trim()
    );
    fs.writeFileSync(filePath, content);
    console.log('Purchase.jsx final syntax check and balance complete');
} else {
    console.log('Could not find the Process Purchase button block');
}
