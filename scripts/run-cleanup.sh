#!/bin/bash

echo "============================================"
echo "       AutoGlass Pro Code Cleanup"
echo "============================================"
echo ""
echo "Running code analysis based on:"
echo "  - Clean Code principles (Robert Martin)"
echo "  - Josh Comeau's React/CSS best practices"
echo ""
echo "Reference: scripts/cleanup-principles.md"
echo ""

npx tsx scripts/cleanup-analyzer.ts
