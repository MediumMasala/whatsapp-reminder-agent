#!/bin/sh
set -e

echo "Running database migrations..."

# Run migrations with a timeout of 30 seconds
timeout 30s npm run migrate || {
  exit_code=$?
  if [ $exit_code -eq 124 ]; then
    echo "Migration timed out after 30 seconds"
    exit 1
  elif [ $exit_code -ne 0 ]; then
    echo "Migration failed with exit code $exit_code"
    exit $exit_code
  fi
}

echo "Migrations completed successfully"
echo "Starting server..."

# Start the application
exec node dist/server.js
