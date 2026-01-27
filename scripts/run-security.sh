#!/bin/bash

echo "============================================"
echo "     AutoGlass Pro Security Scan"
echo "============================================"
echo ""
echo "Based on:"
echo "  - Steve Gibson's Security Now (grc.com)"
echo "  - OWASP Top 10 vulnerabilities"
echo "  - npm security best practices"
echo ""
echo "Reference: scripts/security-principles.md"
echo ""

npx tsx scripts/security-analyzer.ts
