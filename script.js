// Navigation Logic
const navItems = document.querySelectorAll('.nav-list li');
const views = document.querySelectorAll('.phase-view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        views.forEach(view => {
            view.classList.remove('active-view');
            view.classList.remove('is-fullscreen'); // Reset fullscreen on switch
        });

        // Add active class to clicked
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active-view');
    });
});

// Fullscreen Logic
document.querySelectorAll('.fullscreen-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const view = e.target.closest('.phase-view');
        view.classList.toggle('is-fullscreen');
        
        // Change icon based on state
        if (view.classList.contains('is-fullscreen')) {
            e.target.innerHTML = '✖';
            e.target.title = "Exit Fullscreen";
        } else {
            e.target.innerHTML = '⛶';
            e.target.title = "Toggle Fullscreen";
        }
    });
});

// Zoom Logic
let syntaxZoom = 1;
let semanticZoom = 1;

document.querySelectorAll('.zoom-in-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        const treeEl = document.getElementById(targetId);
        if (targetId === 'syntaxOut') {
            syntaxZoom += 0.2;
            treeEl.style.transform = `scale(${syntaxZoom})`;
        } else {
            semanticZoom += 0.2;
            treeEl.style.transform = `scale(${semanticZoom})`;
        }
    });
});

document.querySelectorAll('.zoom-out-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        const treeEl = document.getElementById(targetId);
        if (targetId === 'syntaxOut') {
            syntaxZoom = Math.max(0.2, syntaxZoom - 0.2);
            treeEl.style.transform = `scale(${syntaxZoom})`;
        } else {
            semanticZoom = Math.max(0.2, semanticZoom - 0.2);
            treeEl.style.transform = `scale(${semanticZoom})`;
        }
    });
});

document.getElementById('compileBtn').addEventListener('click', compile);

// 1. Lexical Analyzer
function lexer(input) {
    const tokens = [];
    const regex = /\s*([A-Za-z_][A-Za-z0-9_]*|[0-9]+|==|!=|<=|>=|[-+*/=();])/g;
    let match;
    let idCounter = 1;
    const symbolMap = {};
    
    while ((match = regex.exec(input)) !== null) {
        const token = match[1];
        if (/^[A-Za-z_]/.test(token)) {
            if (!symbolMap[token]) {
                symbolMap[token] = idCounter++;
            }
            tokens.push({ type: 'id', value: token, id: symbolMap[token] });
        } else if (/^[0-9]+/.test(token)) {
            tokens.push({ type: 'num', value: token });
        } else {
            tokens.push({ type: 'op', value: token });
        }
    }
    return tokens;
}

// 2. Syntax Analyzer (Parser)
let currentParseIndex = 0;
function parse(tokens) {
    currentParseIndex = 0;

    function walk() {
        let token = tokens[currentParseIndex];
        if (!token) throw new Error("Unexpected end of input");

        if (token.type === 'num') {
            currentParseIndex++;
            return { type: 'Literal', value: token.value };
        }
        if (token.type === 'id') {
            currentParseIndex++;
            return { type: 'Identifier', value: token.value, id: token.id };
        }
        if (token.type === 'op' && token.value === '(') {
            currentParseIndex++;
            let node = parseExpr();
            token = tokens[currentParseIndex];
            if (token && token.type === 'op' && token.value === ')') {
                currentParseIndex++;
                return node;
            }
            throw new Error('Missing closing parenthesis');
        }
        throw new Error('Unexpected token: ' + token.value);
    }

    function parseFactor() {
        return walk();
    }

    function parseTerm() {
        let left = parseFactor();
        while (currentParseIndex < tokens.length && tokens[currentParseIndex].type === 'op' && (tokens[currentParseIndex].value === '*' || tokens[currentParseIndex].value === '/')) {
            let operator = tokens[currentParseIndex].value;
            currentParseIndex++;
            let right = parseFactor();
            left = { type: 'BinaryExpression', operator, left, right };
        }
        return left;
    }

    function parseExpr() {
        let left = parseTerm();
        while (currentParseIndex < tokens.length && tokens[currentParseIndex].type === 'op' && (tokens[currentParseIndex].value === '+' || tokens[currentParseIndex].value === '-')) {
            let operator = tokens[currentParseIndex].value;
            currentParseIndex++;
            let right = parseTerm();
            left = { type: 'BinaryExpression', operator, left, right };
        }
        return left;
    }

    function parseStatement() {
        let token = tokens[currentParseIndex];
        // Handle optional assignment
        if (token && token.type === 'id') {
            if (currentParseIndex + 1 < tokens.length && tokens[currentParseIndex+1].value === '=') {
                let left = walk(); // consume id
                currentParseIndex++; // consume '='
                let right = parseExpr();
                
                // consume optional semicolon
                if (currentParseIndex < tokens.length && tokens[currentParseIndex].value === ';') {
                    currentParseIndex++;
                }
                return { type: 'Assignment', left, right };
            }
        }
        
        let expr = parseExpr();
        if (currentParseIndex < tokens.length && tokens[currentParseIndex].value === ';') {
            currentParseIndex++;
        }
        return expr;
    }

    let statements = [];
    while (currentParseIndex < tokens.length) {
        statements.push(parseStatement());
    }
    
    return { type: 'Program', body: statements };
}

function renderAST(node) {
    if (!node) return '';
    
    if (node.type === 'Program') {
        let html = `<li><a href="javascript:void(0)">Program</a><ul>`;
        node.body.forEach(stmt => {
            html += renderAST(stmt);
        });
        html += `</ul></li>`;
        return html;
    }

    let label = '';
    let children = [];
    if (node.type === 'Assignment') {
        label = '=';
        children.push(node.left);
        children.push(node.right);
    } else if (node.type === 'BinaryExpression') {
        label = node.operator;
        children.push(node.left);
        children.push(node.right);
    } else if (node.type === 'Literal') {
        label = node.value;
        if (node.semanticNote) {
            label += `<br><small style="color:#10b981; font-size: 0.8rem; white-space: nowrap; display: block; margin-top: 5px;">${node.semanticNote}</small>`;
        }
    } else if (node.type === 'Identifier') {
        label = `&lt;${node.value}, ${node.id}&gt;`;
    }
    
    let html = `<li><a href="javascript:void(0)">${label}</a>`;
    if (children.length > 0) {
        html += `<ul>`;
        children.forEach(c => {
            html += renderAST(c);
        });
        html += `</ul>`;
    }
    html += `</li>`;
    return html;
}

// 3. Semantic Analyzer
function analyzeSemantics(ast) {
    let newAst = JSON.parse(JSON.stringify(ast));
    function traverse(node) {
        if (!node) return;
        if (node.type === 'Program') {
            node.body.forEach(traverse);
            return;
        }
        if (node.type === 'Literal') {
            node.semanticNote = 'int to real';
        }
        if (node.left) traverse(node.left);
        if (node.right) traverse(node.right);
    }
    traverse(newAst);
    return newAst;
}

// 4. Intermediate Code Generator
let tempCount = 1;
let tacList = [];

function generateTAC(node) {
    if (!node) return '';
    if (node.type === 'Program') {
        node.body.forEach(stmt => generateTAC(stmt));
        return;
    }
    if (node.type === 'Literal') {
        return node.value;
    }
    if (node.type === 'Identifier') {
        return `&lt;${node.value},${node.id}&gt;`;
    }
    if (node.type === 'BinaryExpression') {
        let left = generateTAC(node.left);
        let right = generateTAC(node.right);
        let temp = `temp${tempCount++}`;
        tacList.push({ temp, left, op: node.operator, right });
        return temp;
    }
    if (node.type === 'Assignment') {
        let right = generateTAC(node.right);
        let left = `&lt;${node.left.value},${node.left.id}&gt;`;
        tacList.push({ temp: left, left: right, op: '', right: '' });
        return left;
    }
}

// 5. Code Optimization
function optimizeTAC(tacList) {
    let usageCount = {};
    let opInvolvesLiteral = {};
    let isPureAssignment = {};

    tacList.forEach(t => {
        let lStr = String(t.left);
        let rStr = String(t.right);
        
        if (lStr.startsWith('temp')) {
            usageCount[lStr] = (usageCount[lStr] || 0) + 1;
            if (t.right !== '' && !isNaN(String(t.right).replace(/&lt;|&gt;|<|>/g, ''))) {
                opInvolvesLiteral[lStr] = true;
            }
            if (t.op === '') isPureAssignment[lStr] = true;
        }
        if (rStr.startsWith('temp')) {
            usageCount[rStr] = (usageCount[rStr] || 0) + 1;
            if (t.left !== '' && !isNaN(String(t.left).replace(/&lt;|&gt;|<|>/g, ''))) {
                opInvolvesLiteral[rStr] = true;
            }
        }
    });

    let defs = {};
    let toInline = {};

    tacList.forEach(t => {
        if (String(t.temp).startsWith('temp')) {
            defs[t.temp] = t;
            if (usageCount[t.temp] === 1 && isPureAssignment[t.temp]) {
                toInline[t.temp] = true;
            }
        }
    });

    let opt = [];
    tacList.forEach(t => {
        if (toInline[t.temp]) return;

        let l = t.left;
        let r = t.right;

        let formatInline = (def, isPure) => {
            if (isPure) return `${def.left} ${def.op} ${def.right}`.trim();
            return `(${def.left} ${def.op} ${def.right})`.trim();
        };

        if (typeof l === 'string' && toInline[l]) {
            l = formatInline(defs[l], t.op === '');
        }
        if (typeof r === 'string' && toInline[r]) {
            r = formatInline(defs[r], false);
        }

        // Constant folding
        let plainL = String(l).replace(/<[^>]+>/g, '');
        let plainR = String(r).replace(/<[^>]+>/g, '');
        if (t.op && !isNaN(plainL) && !isNaN(plainR)) {
            l = eval(`${plainL} ${t.op} ${plainR}`);
            opt.push({ temp: t.temp, left: l, op: '', right: '' });
        } else {
            opt.push({ temp: t.temp, left: l, op: t.op, right: r });
        }
    });

    // Renumber temporaries
    let newTempCount = 1;
    let tempMap = {};
    
    let finalOpt = [];
    opt.forEach(t => {
        let newTemp = t.temp;
        if (String(t.temp).startsWith('temp')) {
            newTemp = `temp${newTempCount++}`;
            tempMap[t.temp] = newTemp;
        }

        let l = String(t.left);
        let r = String(t.right);

        Object.keys(tempMap).forEach(oldT => {
            let re = new RegExp(`\\b${oldT}\\b`, 'g');
            l = l.replace(re, tempMap[oldT]);
            r = r.replace(re, tempMap[oldT]);
        });
        
        if (l === 'undefined') l = '';
        if (r === 'undefined') r = '';

        finalOpt.push({ temp: newTemp, left: l, op: t.op, right: r });
    });

    if (finalOpt.length === 0) return tacList;
    return finalOpt;
}

// 6. Target Code Generator
function generateTargetCode(tacList) {
    let asm = [];
    let regCount = 1;
    let tempToReg = {};

    let getVal = (v) => {
        if (v === undefined || v === '') return '';
        if (typeof v === 'string' && v.startsWith('temp')) {
            return tempToReg[v] || v;
        }
        if (typeof v === 'string' && v.includes('&lt;')) {
            let match = v.match(/&lt;([a-zA-Z0-9_]+),\s*\d+&gt;/);
            if (match) return match[1];
        }
        return v;
    };

    tacList.forEach(instr => {
        let dest = getVal(instr.temp);
        
        if (instr.op === '') {
            let src = getVal(instr.left);
            asm.push(`MOV ${dest}, ${src}`);
        } else {
            let r = `R${regCount++}`;
            tempToReg[instr.temp] = r;
            
            let left = getVal(instr.left);
            let right = getVal(instr.right);
            
            asm.push(`MOV ${r}, ${left}`);
            
            let opMap = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' };
            let asmOp = opMap[instr.op] || 'OP';
            
            asm.push(`${asmOp} ${r}, ${right}`);
        }
    });
    return asm;
}

// Main Compile Function
function compile() {
    const input = document.getElementById('sourceCode').value;
    const btn = document.getElementById('compileBtn');
    
    // Animate button
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => btn.style.transform = '', 150);

    // Reset Zoom
    syntaxZoom = 1;
    semanticZoom = 1;
    document.getElementById('syntaxOut').style.transform = `scale(1)`;
    document.getElementById('semanticOut').style.transform = `scale(1)`;

    if (!input.trim()) return;

    try {
        // 1. Lexical Analysis
        const tokens = lexer(input);
        
        // 1a. Token Stream String
        let lexOut = '[ ' + tokens.map(t => {
            if (t.type === 'id') return `<span style="color: #a78bfa">&lt;${t.value}, ${t.id}&gt;</span>`;
            if (t.type === 'num') return `<span style="color: #f472b6">&lt;${t.value}&gt;</span>`;
            return `<span style="color: #38bdf8">&lt;${t.value}&gt;</span>`;
        }).join(' ') + ' ]';
        
        // 1b. Token Table Breakdown
        let tokenTableHtml = `<table class="token-table">
            <thead><tr><th>Token Value</th><th>Lexical Type</th><th>Symbol Table Index</th></tr></thead>
            <tbody>`;
        tokens.forEach(t => {
            let typeName = t.type === 'id' ? 'Identifier' : (t.type === 'num' ? 'Number' : 'Operator/Symbol');
            let typeColor = t.type === 'id' ? '#a78bfa' : (t.type === 'num' ? '#f472b6' : '#38bdf8');
            let idIndex = t.id ? t.id : '-';
            tokenTableHtml += `<tr>
                <td style="color: ${typeColor}; font-weight: bold;">${t.value}</td>
                <td>${typeName}</td>
                <td>${idIndex}</td>
            </tr>`;
        });
        tokenTableHtml += `</tbody></table>`;
        
        document.getElementById('lexicalOut').innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h3 style="color:#94a3b8; font-family:'Outfit',sans-serif; margin-top:0;">Raw Token Stream:</h3>
                <div style="background:rgba(0,0,0,0.4); padding:1rem; border-radius:8px;">${lexOut}</div>
            </div>
            <div>
                <h3 style="color:#94a3b8; font-family:'Outfit',sans-serif; margin-bottom:1rem;">Detailed Breakdown:</h3>
                ${tokenTableHtml}
            </div>
        `;

        // 2. Syntax Analysis
        currentParseIndex = 0;
        let ast = parse(tokens);
        
        // Filter out initialization statements for phases 2-6
        if (ast.type === 'Program') {
            ast.body = ast.body.filter(stmt => {
                if (stmt.type === 'Assignment' && stmt.right && stmt.right.type === 'Literal') {
                    return false;
                }
                if (stmt.type === 'Identifier' || stmt.type === 'Literal') {
                    return false;
                }
                return true;
            });
        }
        
        document.getElementById('syntaxOut').innerHTML = `<ul>${renderAST(ast)}</ul>`;

        // 3. Semantic Analysis
        const semanticAst = analyzeSemantics(ast);
        document.getElementById('semanticOut').innerHTML = `<ul>${renderAST(semanticAst)}</ul>`;

        // 4. Intermediate Code
        tempCount = 1;
        tacList = [];
        generateTAC(ast);
        let icgHtml = tacList.map(t => {
            let leftStr = String(t.left).replace(/&lt;/g, '<span style="color:#a78bfa">&lt;').replace(/&gt;/g, '&gt;</span>');
            let rightStr = String(t.right).replace(/&lt;/g, '<span style="color:#a78bfa">&lt;').replace(/&gt;/g, '&gt;</span>');
            let tempStr = String(t.temp).replace(/&lt;/g, '<span style="color:#a78bfa">&lt;').replace(/&gt;/g, '&gt;</span>');
            
            if (t.op === '') return `${tempStr} = ${leftStr}`;
            return `${tempStr} = ${leftStr} <span style="color:#38bdf8">${t.op}</span> ${rightStr}`;
        }).join('<br><br>');
        document.getElementById('icgOut').innerHTML = icgHtml;

        // 5. Optimization
        const optTac = optimizeTAC(tacList);
        let optHtml = optTac.map(t => {
            let leftStr = String(t.left).replace(/&lt;/g, '<span style="color:#a78bfa">&lt;').replace(/&gt;/g, '&gt;</span>');
            let rightStr = String(t.right).replace(/&lt;/g, '<span style="color:#a78bfa">&lt;').replace(/&gt;/g, '&gt;</span>');
            let tempStr = String(t.temp).replace(/&lt;/g, '<span style="color:#a78bfa">&lt;').replace(/&gt;/g, '&gt;</span>');

            if (t.op === '') return `${tempStr} = ${leftStr}`;
            return `${tempStr} = ${leftStr} <span style="color:#38bdf8">${t.op}</span> ${rightStr}`;
        }).join('<br><br>');
        document.getElementById('optOut').innerHTML = optHtml;

        // 6. Target Code
        const asm = generateTargetCode(tacList);
        document.getElementById('targetOut').innerHTML = asm.map(line => {
            let parts = line.split(' ');
            let instruction = `<span style="color:#f472b6; font-weight:bold;">${parts[0]}</span>`;
            let rest = parts.slice(1).join(' ').replace(/(R\d+)/g, '<span style="color:#38bdf8">$1</span>');
            return `${instruction}  ${rest}`;
        }).join('<br><br>');

    } catch (e) {
        const errorHtml = `<span class="error-text">Syntax Error: ${e.message}</span>`;
        document.getElementById('lexicalOut').innerHTML = errorHtml;
        document.getElementById('syntaxOut').innerHTML = '';
        document.getElementById('semanticOut').innerHTML = '';
        document.getElementById('icgOut').innerHTML = '';
        document.getElementById('optOut').innerHTML = '';
        document.getElementById('targetOut').innerHTML = '';
    }
}

// Run initially
window.onload = compile;
