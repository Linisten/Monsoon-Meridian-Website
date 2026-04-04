import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filePath = join(__dirname, 'src', 'pages', 'Purchase.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the stray closing tags between Left and Right panes
// We want: 
//   </div> (Tab Content)
//   </div> (Tab Card)
//   </div> (Left Pane div)
//   -- NO MORE DIVS HERE --
//   {/* RIGHT: ... */}

content = content.replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* RIGHT:/,
  `</div>
          </div>
        </div>

      {/* RIGHT:`
);

// Fallback if that regex is too specific
if (!content.includes('RIGHT:')) {
    console.log('Regex failed, trying alternative...');
}

// 2. Fix the bottom of the file
// We want exactly ONE </div> at the very end (closing the main container)
// since Right Pane already has its own closing tags.

// Let's just do a complete refactor of the closing tags around the panes.
const segments = content.split('{/* RIGHT:');
if (segments.length === 2) {
    let leftPart = segments[0];
    let rightPart = segments[1];
    
    // Clean up end of leftPart
    // It should end with 3 </div>s (content, card, left-pane)
    leftPart = leftPart.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$/, '</div>\n          </div>\n        </div>\n\n      ');
    leftPart = leftPart.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*$/, '</div>\n          </div>\n        </div>\n\n      ');
    
    // Clean up end of rightPart (before the export)
    // It should end with:
    //   </div> (Right Pane content)
    //   </div> (Right Pane container)
    //   </div> (Main Container)
    //   );
    // };
    
    rightPart = rightPart.replace(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\;/, '</div>\n      </div>\n    </div>\n  );');

    content = leftPart + '{/* RIGHT:' + rightPart;
}

fs.writeFileSync(filePath, content);
console.log('Purchase.jsx structural alignment complete');
