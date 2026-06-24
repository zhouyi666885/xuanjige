#!/bin/bash
cd /workspace/projects
npx tsx scripts/translate-books-v5.ts >> /app/work/logs/bypass//translate-v5.log 2>&1
