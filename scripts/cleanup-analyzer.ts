#!/usr/bin/env npx tsx

/**
 * Code Cleanup Analyzer
 * 
 * Analyzes the codebase for potential improvements based on:
 * - Steve Gibson's Security Now principles (TWiT.tv)
 * - Clean Code principles (Robert Martin)
 * - Josh Comeau's React and CSS best practices
 * 
 * Run with: npx tsx scripts/cleanup-analyzer.ts
 * Or use the workflow: "run cleanup script"
 */

import * as fs from 'fs';
import * as path from 'path';

interface Issue {
  file: string;
  line?: number;
  type: 'warning' | 'suggestion' | 'info' | 'security';
  category: string;
  message: string;
  principle: string;
}

const issues: Issue[] = [];

const CLIENT_SRC = './client/src';
const SERVER_DIR = './server';
const SHARED_DIR = './shared';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function getAllFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        getAllFiles(fullPath, files);
      }
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function analyzeFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const isReactFile = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
  const isServerFile = filePath.startsWith('./server') || filePath.includes('/server/');
  
  if (lines.length > 500) {
    issues.push({
      file: filePath,
      type: 'warning',
      category: 'File Size',
      message: `File has ${lines.length} lines. Consider breaking into smaller modules.`,
      principle: 'Clean Code: Small, focused modules'
    });
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    
    // ========================================
    // STEVE GIBSON SECURITY CHECKS
    // ========================================

    // 1. Hardcoded Secrets (Secrets Management)
    if (line.match(/(['"`])(sk[-_]|pk[-_]|api[-_]?key|secret[-_]|password\s*=\s*['"`](?!.*process\.env)|token\s*=\s*['"`][a-zA-Z0-9]{20,})/i) &&
        !line.includes('process.env') && !line.includes('import.meta.env') &&
        !filePath.includes('cleanup-analyzer') && !filePath.includes('.md')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'security',
        category: 'Hardcoded Secrets',
        message: 'Possible hardcoded secret detected. Use environment variables instead.',
        principle: 'Gibson: Secrets Management - Never expose secrets in code'
      });
    }

    // 2. Logging Secrets (Secrets Management)
    if (line.match(/console\.(log|info|warn|error|debug)\s*\(.*\b(password|secret|token|apiKey|api_key|authorization|cookie)\b/i) &&
        !filePath.includes('cleanup-analyzer')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'security',
        category: 'Secret Logging',
        message: 'Possible logging of sensitive data. Never log passwords, tokens, or API keys.',
        principle: 'Gibson: Secrets Management - Never log sensitive values'
      });
    }

    // 3. Exposed Error Details (Minimize Attack Surface)
    if (isServerFile && line.match(/res\s*\.\s*(json|send)\s*\(.*\b(err\.stack|error\.stack|err\.message|\.stack)\b/)) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'security',
        category: 'Error Exposure',
        message: 'Exposing error stack/details to client. Return generic error messages instead.',
        principle: 'Gibson: Minimize Attack Surface - Don\'t expose internal details'
      });
    }

    // 4. SQL Injection via String Interpolation (Zero Trust)
    if (line.match(/\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i) ||
        line.match(/(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b.*\$\{/i)) {
      if (!line.includes('$1') && !line.includes('$2') && !line.includes('parameterized')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'security',
          category: 'SQL Injection Risk',
          message: 'Possible SQL injection via string interpolation. Use parameterized queries.',
          principle: 'Gibson: Zero Trust - Never trust user input, use parameterized queries'
        });
      }
    }

    // 5. Insecure Randomness (Cryptography Done Right)
    if (line.match(/Math\.random\s*\(\)/) && isServerFile) {
      if (line.match(/token|secret|password|key|session|nonce|salt|hash|auth|csrf/i)) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'security',
          category: 'Insecure Randomness',
          message: 'Using Math.random() for security-sensitive operation. Use crypto.randomBytes() instead.',
          principle: 'Gibson: Cryptography Done Right - Use high-entropy random generation'
        });
      }
    }

    // 6. Missing Auth Check Pattern (Least Privilege)
    if (isServerFile && line.match(/app\.(get|post|put|patch|delete)\s*\(\s*['"`]\/api\//) &&
        !content.substring(Math.max(0, content.indexOf(line) - 200), content.indexOf(line) + line.length + 500)
          .match(/isAuthenticated|requireAuth|req\.session|req\.user|hasAdminAccess|isAdmin/)) {
      // This is a heuristic - may have false positives
    }

    // 7. Returning Password/Hash Fields (Least Privilege / Data Exposure)
    if (isServerFile && line.match(/res\s*\.\s*json\s*\(/) && 
        (line.includes('password') || line.includes('hash')) &&
        !line.includes('...') && !line.includes('omit') && !line.includes('exclude')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'security',
        category: 'Data Exposure',
        message: 'Possible exposure of password/hash field in API response. Strip sensitive fields.',
        principle: 'Gibson: Least Privilege - Return only necessary data'
      });
    }

    // 8. Disabled Security Features
    if (line.match(/cors\s*\(\s*\{?\s*origin\s*:\s*['"`]\*['"`]/) ||
        line.match(/cors\s*\(\s*\)/) && isServerFile) {
      // Open CORS can be intentional for dev, mark as info
    }

    // ========================================
    // CLEAN CODE CHECKS (Robert Martin)
    // ========================================

    // Magic numbers
    const magicNumberMatch = line.match(/[^a-zA-Z0-9_](\d{3,})[^a-zA-Z0-9_]/);
    if (magicNumberMatch && !line.includes('const') && !line.includes('//') && !line.includes('port')) {
      const num = magicNumberMatch[1];
      if (!['100', '1000', '1024', '5000', '3000'].includes(num)) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'suggestion',
          category: 'Magic Numbers',
          message: `Consider extracting magic number ${num} to a named constant`,
          principle: 'Clean Code: Meaningful names'
        });
      }
    }

    // Long lines
    if (line.length > 150) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'info',
        category: 'Formatting',
        message: `Line is ${line.length} characters. Consider breaking up for readability.`,
        principle: 'Clean Code: Formatting'
      });
    }

    // Console.log in production code
    if (line.includes('console.log') && !filePath.includes('cleanup-analyzer') && !filePath.includes('worker')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'warning',
        category: 'Debug Code',
        message: 'Found console.log - remove or replace with proper logging before production',
        principle: 'Clean Code: Remove debug statements / Gibson: Minimize Attack Surface'
      });
    }

    // Commented-out code
    if (trimmed.startsWith('//') && (line.includes('const ') || line.includes('function ') || line.includes('return ')) &&
        !line.includes('example') && !line.includes('GOOD') && !line.includes('BAD')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'suggestion',
        category: 'Dead Code',
        message: 'Possible commented-out code - consider removing',
        principle: 'Clean Code: Delete dead code / Gibson: Minimize Attack Surface'
      });
    }

    // TODO/FIXME comments
    if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'info',
        category: 'Pending Work',
        message: `Found ${line.includes('TODO') ? 'TODO' : line.includes('FIXME') ? 'FIXME' : 'HACK'} comment`,
        principle: 'Track technical debt'
      });
    }

    // ========================================
    // REACT CHECKS (Josh Comeau)
    // ========================================

    if (isReactFile) {
      // Passing setState directly as prop
      if (line.match(/\bset[A-Z]\w+\s*=\s*\{set[A-Z]\w+\}/)) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'suggestion',
          category: 'React Pattern',
          message: 'Passing setState directly as prop. Consider passing a handler function instead.',
          principle: 'Principle of Least Privilege (Josh Comeau / Gibson)'
        });
      }

      // Array index as key
      if (line.match(/key\s*=\s*\{?\s*(index|idx|i)\s*\}?/)) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'warning',
          category: 'React Pattern',
          message: 'Using array index as key. Use stable, unique identifiers instead.',
          principle: 'Leveraging Keys (Josh Comeau)'
        });
      }

      // dangerouslySetInnerHTML (XSS risk - Gibson: Zero Trust)
      if (line.includes('dangerouslySetInnerHTML')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'security',
          category: 'XSS Risk',
          message: 'dangerouslySetInnerHTML detected. Ensure input is properly sanitized.',
          principle: 'Gibson: Zero Trust - Sanitize all user-facing output'
        });
      }
    }
  });

  // Check for long functions
  analyzeForLongFunctions(filePath, content);
  
  // Check for duplicate code patterns
  analyzeDuplicatePatterns(filePath, content);

  // Check for unused imports (Dead Code / Attack Surface)
  analyzeUnusedImports(filePath, content);
}

function analyzeForLongFunctions(filePath: string, content: string): void {
  const functionPattern = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)|^(\s*)(export\s+)?const\s+(\w+)\s*=\s*(\([^)]*\)|[^=])\s*=>\s*\{/gm;
  const lines = content.split('\n');
  
  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    const startPos = match.index;
    const startLine = content.substring(0, startPos).split('\n').length;
    const funcName = match[4] || match[7] || 'anonymous';
    
    let braceCount = 0;
    let started = false;
    let lineCount = 0;
    
    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }
      lineCount++;
      if (started && braceCount === 0) break;
      if (lineCount > 200) break;
    }
    
    if (lineCount > 50) {
      issues.push({
        file: filePath,
        line: startLine,
        type: 'warning',
        category: 'Function Length',
        message: `Function "${funcName}" is ~${lineCount} lines. Consider breaking into smaller functions.`,
        principle: 'Clean Code: Small functions'
      });
    }
  }
}

function analyzeDuplicatePatterns(filePath: string, content: string): void {
  const jsxPatterns: Record<string, number> = {};
  const classNamePattern = /className="([^"]{20,})"/g;
  
  let match;
  while ((match = classNamePattern.exec(content)) !== null) {
    const className = match[1];
    jsxPatterns[className] = (jsxPatterns[className] || 0) + 1;
  }
  
  for (const [className, count] of Object.entries(jsxPatterns)) {
    if (count >= 3) {
      issues.push({
        file: filePath,
        type: 'suggestion',
        category: 'DRY',
        message: `className "${className.substring(0, 40)}..." appears ${count} times. Consider extracting to a component or constant.`,
        principle: 'DRY (Don\'t Repeat Yourself)'
      });
    }
  }
}

function analyzeUnusedImports(filePath: string, content: string): void {
  const importPattern = /import\s+(?:\{([^}]+)\}|(\w+))\s+from/g;
  const lines = content.split('\n');
  
  let match;
  while ((match = importPattern.exec(content)) !== null) {
    const importedNames = match[1] || match[2];
    if (!importedNames) continue;
    
    const names = importedNames.split(',').map(n => n.trim().split(' as ').pop()?.trim()).filter(Boolean);
    
    for (const name of names) {
      if (!name || name.length < 2) continue;
      const usageCount = content.split(name).length - 1;
      const importLine = content.substring(0, match.index).split('\n').length;
      
      if (usageCount <= 1 && !name.startsWith('type ')) {
        issues.push({
          file: filePath,
          line: importLine,
          type: 'suggestion',
          category: 'Unused Import',
          message: `"${name}" appears to be imported but unused. Consider removing.`,
          principle: 'Clean Code: Dead code / Gibson: Minimize Attack Surface'
        });
      }
    }
  }
}

function generateReport(): void {
  console.log('\n' + '='.repeat(80));
  console.log('              CODE CLEANUP ANALYZER REPORT');
  console.log('       Based on: Gibson (Security Now) | Martin (Clean Code)');
  console.log('                 Comeau (Joy of React / CSS for JS)');
  console.log('='.repeat(80));
  console.log(`\nAnalyzed at: ${new Date().toISOString()}`);
  console.log(`Total issues found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('No issues found! Your code looks clean and secure.\n');
    return;
  }

  const securityIssues = issues.filter(i => i.type === 'security');
  const warnings = issues.filter(i => i.type === 'warning');
  const suggestions = issues.filter(i => i.type === 'suggestion');
  const infos = issues.filter(i => i.type === 'info');

  console.log('SEVERITY BREAKDOWN:');
  console.log('-'.repeat(40));
  if (securityIssues.length > 0) console.log(`  SECURITY:    ${securityIssues.length} issues`);
  console.log(`  WARNINGS:    ${warnings.length} issues`);
  console.log(`  SUGGESTIONS: ${suggestions.length} issues`);
  console.log(`  INFO:        ${infos.length} issues`);

  const byCategory = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);

  console.log('\nSUMMARY BY CATEGORY:');
  console.log('-'.repeat(40));
  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    const sec = categoryIssues.filter(i => i.type === 'security').length;
    const w = categoryIssues.filter(i => i.type === 'warning').length;
    const s = categoryIssues.filter(i => i.type === 'suggestion').length;
    const inf = categoryIssues.filter(i => i.type === 'info').length;
    const parts: string[] = [];
    if (sec > 0) parts.push(`${sec} security`);
    if (w > 0) parts.push(`${w} warnings`);
    if (s > 0) parts.push(`${s} suggestions`);
    if (inf > 0) parts.push(`${inf} info`);
    console.log(`  ${category}: ${categoryIssues.length} (${parts.join(', ')})`);
  }

  // Security issues first
  if (securityIssues.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('SECURITY ISSUES (Steve Gibson Principles):');
    console.log('='.repeat(80));
    
    for (const issue of securityIssues) {
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(`\n  [SEC] ${location}`);
      console.log(`        ${issue.message}`);
      console.log(`        Principle: ${issue.principle}`);
    }
  }

  // Then other issues
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED ISSUES:');
  console.log('='.repeat(80));

  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    const nonSecurity = categoryIssues.filter(i => i.type !== 'security');
    if (nonSecurity.length === 0) continue;
    
    console.log(`\n## ${category} (${nonSecurity.length})\n`);
    
    for (const issue of nonSecurity.slice(0, 10)) {
      const typeIcon = issue.type === 'warning' ? '!' : issue.type === 'suggestion' ? '*' : 'i';
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(`  [${typeIcon}] ${location}`);
      console.log(`      ${issue.message}`);
      console.log(`      Principle: ${issue.principle}`);
    }
    
    if (nonSecurity.length > 10) {
      console.log(`  ... and ${nonSecurity.length - 10} more in this category`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(80));
  console.log(`
1. Fix SECURITY issues first - these are the highest priority (Gibson: Defense in Depth)
2. Address WARNINGS - impactful code quality improvements
3. Handle SUGGESTIONS when refactoring related code  
4. INFO items are for awareness - fix opportunistically

For the full principles guide, see: scripts/cleanup-principles.md

Reference Links:
- Security Now: https://twit.tv/shows/security-now
- GRC: https://www.grc.com
- React Notes: https://separated-day-526.notion.site/The-Joy-Of-React-d234359051a44f2ca721bcb4c9ec5de5
- CSS Notes: https://separated-day-526.notion.site/ea79a7c11e9940f9bd572a40dd1f8957
`);
}

// Main execution
console.log('Starting code cleanup analysis...\n');
console.log('Scanning directories:');
console.log(`  - ${CLIENT_SRC}`);
console.log(`  - ${SERVER_DIR}`);
console.log(`  - ${SHARED_DIR}`);

const allFiles = [
  ...getAllFiles(CLIENT_SRC),
  ...getAllFiles(SERVER_DIR),
  ...getAllFiles(SHARED_DIR),
];

console.log(`\nFound ${allFiles.length} files to analyze...`);

for (const file of allFiles) {
  try {
    analyzeFile(file);
  } catch (error) {
    console.error(`Error analyzing ${file}:`, error);
  }
}

generateReport();
