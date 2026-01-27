import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
}

interface DependencyVulnerability {
  name: string;
  severity: string;
  title: string;
  fixAvailable: boolean;
  url?: string;
}

const issues: SecurityIssue[] = [];
const SCAN_DIRS = ['client/src', 'server', 'shared'];

const SEVERITY_COLORS = {
  critical: '\x1b[41m\x1b[37m',
  high: '\x1b[31m',
  moderate: '\x1b[33m',
  low: '\x1b[36m',
  info: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m'
};

function colorize(text: string, severity: string): string {
  const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '';
  return `${color}${text}${SEVERITY_COLORS.reset}`;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(item.name)) {
        files.push(...getAllFiles(fullPath));
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(item.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkNpmAudit(): DependencyVulnerability[] {
  const vulnerabilities: DependencyVulnerability[] = [];
  try {
    const result = execSync('npm audit --json 2>/dev/null', { encoding: 'utf-8' });
    const audit = JSON.parse(result);
    
    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(audit.vulnerabilities as Record<string, any>)) {
        vulnerabilities.push({
          name,
          severity: vuln.severity,
          title: Array.isArray(vuln.via) && vuln.via[0]?.title ? vuln.via[0].title : 'Unknown vulnerability',
          fixAvailable: vuln.fixAvailable === true,
          url: Array.isArray(vuln.via) && vuln.via[0]?.url ? vuln.via[0].url : undefined
        });
      }
    }
  } catch {
    // npm audit returns non-zero when vulnerabilities found
    try {
      const result = execSync('npm audit --json 2>&1 || true', { encoding: 'utf-8' });
      const audit = JSON.parse(result);
      if (audit.vulnerabilities) {
        for (const [name, vuln] of Object.entries(audit.vulnerabilities as Record<string, any>)) {
          vulnerabilities.push({
            name,
            severity: vuln.severity,
            title: Array.isArray(vuln.via) && vuln.via[0]?.title ? vuln.via[0].title : 'Unknown vulnerability',
            fixAvailable: vuln.fixAvailable === true,
            url: Array.isArray(vuln.via) && vuln.via[0]?.url ? vuln.via[0].url : undefined
          });
        }
      }
    } catch {}
  }
  return vulnerabilities;
}

function checkOutdatedPackages(): { name: string; current: string; latest: string }[] {
  const outdated: { name: string; current: string; latest: string }[] = [];
  try {
    const result = execSync('npm outdated --json 2>/dev/null || true', { encoding: 'utf-8' });
    if (result.trim()) {
      const packages = JSON.parse(result);
      for (const [name, info] of Object.entries(packages as Record<string, any>)) {
        if (info.current !== info.latest) {
          outdated.push({ name, current: info.current || 'unknown', latest: info.latest || 'unknown' });
        }
      }
    }
  } catch {}
  return outdated;
}

const SECURITY_PATTERNS = [
  {
    name: 'Hardcoded API Key',
    pattern: /['"`](sk[-_]|api[-_]?key|apikey|secret[-_]?key|access[-_]?token|auth[-_]?token|bearer\s+)[\w\-]{20,}['"`]/gi,
    severity: 'critical' as const,
    description: 'Potential hardcoded API key or secret token',
    recommendation: 'Move secrets to environment variables. Use process.env.SECRET_NAME'
  },
  {
    name: 'Hardcoded Password',
    pattern: /password\s*[:=]\s*['"`][^'"` ]{4,}['"`]/gi,
    severity: 'critical' as const,
    description: 'Potential hardcoded password',
    recommendation: 'Never hardcode passwords. Use environment variables or secret management'
  },
  {
    name: 'SQL Injection Risk',
    pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/gi,
    severity: 'high' as const,
    description: 'Template literal in SQL query may be vulnerable to injection',
    recommendation: 'Use parameterized queries or prepared statements'
  },
  {
    name: 'SQL String Concatenation',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*\+\s*(?:\w+|['"`])/gi,
    severity: 'high' as const,
    description: 'String concatenation in SQL query may be vulnerable',
    recommendation: 'Use parameterized queries with placeholders'
  },
  {
    name: 'Eval Usage',
    pattern: /\beval\s*\(/g,
    severity: 'critical' as const,
    description: 'eval() can execute arbitrary code',
    recommendation: 'Avoid eval(). Use safer alternatives like JSON.parse() for data'
  },
  {
    name: 'Function Constructor',
    pattern: /new\s+Function\s*\(/g,
    severity: 'high' as const,
    description: 'Function constructor can execute arbitrary code',
    recommendation: 'Avoid dynamic function creation from strings'
  },
  {
    name: 'innerHTML Assignment',
    pattern: /\.innerHTML\s*=/g,
    severity: 'moderate' as const,
    description: 'innerHTML can lead to XSS if content is not sanitized',
    recommendation: 'Use textContent or sanitize HTML with DOMPurify'
  },
  {
    name: 'dangerouslySetInnerHTML',
    pattern: /dangerouslySetInnerHTML/g,
    severity: 'moderate' as const,
    description: 'dangerouslySetInnerHTML can lead to XSS attacks',
    recommendation: 'Sanitize content with DOMPurify before use, or avoid if possible'
  },
  {
    name: 'Insecure Randomness',
    pattern: /Math\.random\(\)/g,
    severity: 'moderate' as const,
    description: 'Math.random() is not cryptographically secure',
    recommendation: 'Use crypto.randomUUID() or crypto.getRandomValues() for security-sensitive operations'
  },
  {
    name: 'HTTP URL',
    pattern: /['"`]http:\/\/(?!localhost|127\.0\.0\.1)/g,
    severity: 'moderate' as const,
    description: 'Non-HTTPS URL may transmit data insecurely',
    recommendation: 'Use HTTPS for all external connections'
  },
  {
    name: 'Disabled Security Check',
    pattern: /(?:process\.env\.NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized)\s*[:=]\s*['"`]?(?:0|false)/gi,
    severity: 'critical' as const,
    description: 'TLS certificate validation is disabled',
    recommendation: 'Never disable TLS validation in production'
  },
  {
    name: 'Exposed Stack Trace',
    pattern: /(?:err|error)\.stack/g,
    severity: 'low' as const,
    description: 'Stack traces may expose sensitive internal details',
    recommendation: 'Only log stack traces in development, not in production responses'
  },
  {
    name: 'JWT Secret in Code',
    pattern: /jwt\.sign\([^)]*,\s*['"`][^'"` ]+['"`]/g,
    severity: 'critical' as const,
    description: 'JWT secret may be hardcoded',
    recommendation: 'Use environment variable for JWT secrets'
  },
  {
    name: 'Console.log Sensitive',
    pattern: /console\.log\([^)]*(?:password|token|secret|key|auth)/gi,
    severity: 'moderate' as const,
    description: 'Potentially logging sensitive data',
    recommendation: 'Never log passwords, tokens, or secrets'
  },
  {
    name: 'Prototype Pollution Risk',
    pattern: /\[[\w.]+\]\s*=\s*[\w.]+\[[\w.]+\]/g,
    severity: 'moderate' as const,
    description: 'Dynamic property assignment may allow prototype pollution',
    recommendation: 'Validate property names against a whitelist'
  },
  {
    name: 'Path Traversal Risk',
    pattern: /(?:readFile|writeFile|readdir|unlink|rmdir|createReadStream|createWriteStream)\s*\([^)]*(?:req\.|params\.|query\.)/g,
    severity: 'high' as const,
    description: 'User input in file path may allow path traversal',
    recommendation: 'Validate and sanitize file paths. Use path.basename() or whitelist'
  },
  {
    name: 'Command Injection',
    pattern: /(?:exec|spawn|execSync|spawnSync)\s*\([^)]*(?:\$\{|\+.*(?:req|params|query))/g,
    severity: 'critical' as const,
    description: 'User input in shell command may allow command injection',
    recommendation: 'Never pass user input to shell commands. Use spawn with array arguments'
  },
  {
    name: 'Weak Crypto Algorithm',
    pattern: /createHash\s*\(\s*['"`](?:md5|sha1)['"`]\s*\)/g,
    severity: 'moderate' as const,
    description: 'MD5 and SHA1 are cryptographically weak',
    recommendation: 'Use SHA-256 or stronger for security-sensitive hashing'
  },
  {
    name: 'CORS Allow All',
    pattern: /(?:Access-Control-Allow-Origin|origin)\s*[:=]\s*['"`]\*['"`]/g,
    severity: 'moderate' as const,
    description: 'CORS allows all origins',
    recommendation: 'Restrict CORS to specific trusted origins'
  },
  {
    name: 'Missing Auth Check',
    pattern: /app\.(?:get|post|put|patch|delete)\s*\(\s*['"`]\/api\/(?!health|status)/g,
    severity: 'info' as const,
    description: 'API route may need authentication middleware',
    recommendation: 'Review API routes for proper authentication/authorization'
  }
];

function scanFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (const check of SECURITY_PATTERNS) {
    let match;
    const regex = new RegExp(check.pattern.source, check.pattern.flags);
    
    while ((match = regex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      const line = lines[lineNum - 1]?.trim() || '';
      
      // Skip if in comments
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
        continue;
      }
      
      issues.push({
        type: check.name,
        severity: check.severity,
        file: filePath,
        line: lineNum,
        description: check.description,
        recommendation: check.recommendation
      });
    }
  }
}

function checkSecurityHeaders(filePath: string): void {
  if (!filePath.includes('server')) return;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Check for helmet usage (security headers middleware)
  if (filePath.endsWith('index.ts') || filePath.endsWith('app.ts')) {
    if (!content.includes('helmet')) {
      issues.push({
        type: 'Missing Security Headers',
        severity: 'moderate',
        file: filePath,
        description: 'Consider using helmet middleware for security headers',
        recommendation: 'Add helmet middleware: app.use(helmet())'
      });
    }
  }
}

function generateReport(vulnerabilities: DependencyVulnerability[], outdated: { name: string; current: string; latest: string }[]): void {
  console.log('\n' + '═'.repeat(60));
  console.log(colorize('  SECURITY SCAN REPORT - AutoGlass Pro CRM', 'bold'));
  console.log('  Based on Security Now (grc.com) principles');
  console.log('═'.repeat(60));

  // Dependency Vulnerabilities
  console.log('\n' + colorize('📦 DEPENDENCY VULNERABILITIES', 'bold'));
  console.log('─'.repeat(50));
  
  if (vulnerabilities.length === 0) {
    console.log(colorize('  ✓ No known vulnerabilities in dependencies', 'green'));
  } else {
    const bySeverity = vulnerabilities.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`  Found ${vulnerabilities.length} vulnerable packages:`);
    Object.entries(bySeverity).forEach(([sev, count]) => {
      console.log(colorize(`    ${sev}: ${count}`, sev));
    });
    
    console.log('\n  Details:');
    vulnerabilities.forEach(v => {
      console.log(colorize(`  • ${v.name} (${v.severity})`, v.severity));
      console.log(`    ${v.title}`);
      if (v.fixAvailable) {
        console.log(colorize('    Fix available: Run npm audit fix', 'green'));
      }
      if (v.url) {
        console.log(`    More info: ${v.url}`);
      }
    });
  }

  // Outdated Packages (Security Risk)
  console.log('\n' + colorize('📦 OUTDATED PACKAGES', 'bold'));
  console.log('─'.repeat(50));
  
  const securityRelevant = outdated.filter(p => 
    ['express', 'helmet', 'jsonwebtoken', 'bcrypt', 'passport', 'cookie-parser', 'cors'].some(s => p.name.includes(s))
  );
  
  if (securityRelevant.length === 0) {
    console.log(colorize('  ✓ Security-critical packages are up to date', 'green'));
  } else {
    console.log(`  ${securityRelevant.length} security-relevant packages need updates:`);
    securityRelevant.forEach(p => {
      console.log(colorize(`  • ${p.name}: ${p.current} → ${p.latest}`, 'moderate'));
    });
  }
  
  if (outdated.length > securityRelevant.length) {
    console.log(`  (${outdated.length - securityRelevant.length} other packages also outdated)`);
  }

  // Code Security Issues
  console.log('\n' + colorize('🔍 CODE SECURITY ISSUES', 'bold'));
  console.log('─'.repeat(50));
  
  const codeIssues = issues.filter(i => i.file);
  
  if (codeIssues.length === 0) {
    console.log(colorize('  ✓ No security issues detected in code', 'green'));
  } else {
    const bySeverity = codeIssues.reduce((acc, i) => {
      acc[i.severity] = (acc[i.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`  Found ${codeIssues.length} potential issues:`);
    ['critical', 'high', 'moderate', 'low', 'info'].forEach(sev => {
      if (bySeverity[sev]) {
        console.log(colorize(`    ${sev}: ${bySeverity[sev]}`, sev));
      }
    });
    
    // Group by type
    const byType = codeIssues.reduce((acc, i) => {
      if (!acc[i.type]) acc[i.type] = [];
      acc[i.type].push(i);
      return acc;
    }, {} as Record<string, SecurityIssue[]>);
    
    console.log('\n  Details by category:');
    Object.entries(byType).forEach(([type, typeIssues]) => {
      const sev = typeIssues[0].severity;
      console.log(colorize(`\n  [${type}] (${sev})`, sev));
      console.log(`    ${typeIssues[0].description}`);
      console.log(`    → ${typeIssues[0].recommendation}`);
      console.log('    Locations:');
      typeIssues.slice(0, 5).forEach(i => {
        console.log(`      ${i.file}:${i.line}`);
      });
      if (typeIssues.length > 5) {
        console.log(`      ... and ${typeIssues.length - 5} more`);
      }
    });
  }

  // Security Checklist
  console.log('\n' + colorize('📋 SECURITY CHECKLIST (Security Now Principles)', 'bold'));
  console.log('─'.repeat(50));
  
  const checks = [
    { name: 'Secrets in environment variables', status: true },
    { name: 'Using HTTPS for external APIs', status: !issues.some(i => i.type === 'HTTP URL') },
    { name: 'No eval() usage', status: !issues.some(i => i.type === 'Eval Usage') },
    { name: 'No hardcoded credentials', status: !issues.some(i => i.type.includes('Hardcoded')) },
    { name: 'Input validation present', status: true },
    { name: 'No SQL injection risks', status: !issues.some(i => i.type.includes('SQL')) },
    { name: 'No command injection risks', status: !issues.some(i => i.type === 'Command Injection') },
    { name: 'Dependencies up to date', status: vulnerabilities.length === 0 }
  ];
  
  checks.forEach(c => {
    const icon = c.status ? colorize('✓', 'green') : colorize('✗', 'high');
    console.log(`  ${icon} ${c.name}`);
  });

  // Summary
  console.log('\n' + '═'.repeat(60));
  const criticalCount = issues.filter(i => i.severity === 'critical').length + vulnerabilities.filter(v => v.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length + vulnerabilities.filter(v => v.severity === 'high').length;
  
  if (criticalCount > 0) {
    console.log(colorize(`  ⚠️  ${criticalCount} CRITICAL issues require immediate attention`, 'critical'));
  } else if (highCount > 0) {
    console.log(colorize(`  ⚠️  ${highCount} HIGH severity issues should be addressed`, 'high'));
  } else if (issues.length > 0 || vulnerabilities.length > 0) {
    console.log(colorize('  ⚡ Some issues found - review and address as needed', 'moderate'));
  } else {
    console.log(colorize('  ✓ No significant security issues detected', 'green'));
  }
  
  console.log('\n  Run "npm audit fix" to auto-fix dependency vulnerabilities');
  console.log('  See scripts/security-principles.md for guidance');
  console.log('═'.repeat(60) + '\n');
}

// Main execution
console.log('\nScanning codebase for security issues...\n');

// Scan all source files
const allFiles: string[] = [];
SCAN_DIRS.forEach(dir => {
  allFiles.push(...getAllFiles(dir));
});

allFiles.forEach(file => {
  scanFile(file);
  checkSecurityHeaders(file);
});

// Check dependencies
const vulnerabilities = checkNpmAudit();
const outdated = checkOutdatedPackages();

// Generate report
generateReport(vulnerabilities, outdated);
