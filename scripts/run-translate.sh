#!/bin/bash
cd /workspace/projects
npx tsx scripts/translate-books-v2.ts >> /app/work/logs/bypass//translate-v2.log 2>&1
