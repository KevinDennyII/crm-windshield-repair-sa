#!/usr/bin/env npx tsx

/**
 * Code Cleanup Analyzer
 * 
 * Analyzes the codebase for potential improvements based on:
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
  type: 'warning' | 'suggestion' | 'info';
  category: string;
  message: string;
  principle: string;
}

const issues: Issue[] = [];

// Directories to analyze
const CLIENT_SRC = './client/src';
const SERVER_DIR = './server';
const SHARED_DIR = './shared';

// File extensions to check
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
  
  // Check file length
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
    
    // Check for magic numbers (excluding common ones like 0, 1, 2, 100)
    const magicNumberMatch = line.match(/[^a-zA-Z0-9_](\d{3,})[^a-zA-Z0-9_]/);
    if (magicNumberMatch && !line.includes('const') && !line.includes('//')) {
      const num = magicNumberMatch[1];
      if (!['100', '1000', '1024'].includes(num)) {
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

    // Check for very long lines
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

    // Check for console.log in production code
    if (line.includes('console.log') && !filePath.includes('cleanup-analyzer')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'warning',
        category: 'Debug Code',
        message: 'Found console.log - remove before production',
        principle: 'Clean Code: Remove debug statements'
      });
    }

    // Check for commented-out code
    if (line.trim().startsWith('//') && (line.includes('const ') || line.includes('function ') || line.includes('return '))) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'suggestion',
        category: 'Dead Code',
        message: 'Possible commented-out code - consider removing',
        principle: 'Clean Code: Delete dead code'
      });
    }

    // Check for TODO/FIXME comments
    if (line.includes('TODO') || line.includes('FIXME')) {
      issues.push({
        file: filePath,
        line: lineNum,
        type: 'info',
        category: 'Pending Work',
        message: 'Found TODO/FIXME comment',
        principle: 'Track technical debt'
      });
    }

    // React-specific checks
    if (isReactFile) {
      // Check for passing setState directly as prop (Principle of Least Privilege)
      if (line.match(/\bset[A-Z]\w+\s*=\s*\{set[A-Z]\w+\}/)) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'suggestion',
          category: 'React Pattern',
          message: 'Passing setState directly as prop. Consider passing a handler function instead.',
          principle: 'Principle of Least Privilege (Josh Comeau)'
        });
      }

      // Check for array index as key
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

      // Check for potential derived state issues (useState followed by useEffect to sync)
      if (line.includes('useState') && content.includes('useEffect')) {
        const stateMatch = line.match(/const\s*\[\s*(\w+)/);
        if (stateMatch) {
          const stateName = stateMatch[1];
          // Look for useEffect that sets this state
          const effectPattern = new RegExp(`set${stateName.charAt(0).toUpperCase() + stateName.slice(1)}\\s*\\(`);
          const hasEffectSetting = content.match(effectPattern);
          if (hasEffectSetting && content.includes('useEffect') && content.match(new RegExp(`useEffect\\s*\\([^)]*set${stateName.charAt(0).toUpperCase() + stateName.slice(1)}`))) {
            // This is a potential derived state issue, but needs manual review
          }
        }
      }
    }
  });

  // Check for long functions
  analyzeForLongFunctions(filePath, content);
  
  // Check for duplicate code patterns
  analyzeDuplicatePatterns(filePath, content);
}

function analyzeForLongFunctions(filePath: string, content: string): void {
  // Simple heuristic: count lines between function declaration and closing brace
  const functionPattern = /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)|^(\s*)(export\s+)?const\s+(\w+)\s*=\s*(\([^)]*\)|[^=])\s*=>\s*\{/gm;
  const lines = content.split('\n');
  
  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    const startPos = match.index;
    const startLine = content.substring(0, startPos).split('\n').length;
    const funcName = match[4] || match[7] || 'anonymous';
    
    // Count lines until matching brace (simplified check)
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
      if (lineCount > 200) break; // Safety limit
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
  // Check for repeated JSX patterns (simplified)
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

function generateReport(): void {
  console.log('\n' + '='.repeat(80));
  console.log('                     CODE CLEANUP ANALYZER REPORT');
  console.log('='.repeat(80));
  console.log(`\nAnalyzed at: ${new Date().toISOString()}`);
  console.log(`Total issues found: ${issues.length}\n`);

  if (issues.length === 0) {
    console.log('No issues found! Your code looks clean.\n');
    return;
  }

  // Group by category
  const byCategory = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {} as Record<string, Issue[]>);

  // Summary
  console.log('SUMMARY BY CATEGORY:');
  console.log('-'.repeat(40));
  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    const warnings = categoryIssues.filter(i => i.type === 'warning').length;
    const suggestions = categoryIssues.filter(i => i.type === 'suggestion').length;
    const infos = categoryIssues.filter(i => i.type === 'info').length;
    console.log(`  ${category}: ${categoryIssues.length} (${warnings} warnings, ${suggestions} suggestions, ${infos} info)`);
  }

  // Detailed issues
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED ISSUES:');
  console.log('='.repeat(80));

  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    console.log(`\n## ${category} (${categoryIssues.length})\n`);
    
    for (const issue of categoryIssues.slice(0, 10)) { // Limit to 10 per category
      const typeIcon = issue.type === 'warning' ? '!' : issue.type === 'suggestion' ? '*' : 'i';
      const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      console.log(`  [${typeIcon}] ${location}`);
      console.log(`      ${issue.message}`);
      console.log(`      Principle: ${issue.principle}`);
    }
    
    if (categoryIssues.length > 10) {
      console.log(`  ... and ${categoryIssues.length - 10} more in this category`);
    }
  }

  // Recommendations
  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(80));
  console.log(`
1. Start with WARNINGS - these are the most impactful to fix
2. Address SUGGESTIONS when refactoring related code  
3. INFO items are for awareness - fix opportunistically

For the full principles guide, see: scripts/cleanup-principles.md

Reference Links:
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
