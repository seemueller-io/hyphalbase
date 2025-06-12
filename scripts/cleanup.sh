#!/usr/bin/env bash

# Clean up build artifacts and temporary directories
echo "Cleaning up build artifacts and temporary directories..."

# Remove persisted data
find . -name ".open-gsio" -type d -prune -exec rm -rf {} \;


# Remove node_modules directories
find . -name "node_modules" -type d -prune -exec rm -rf {} \;

# Remove .wrangler directories
find . -name ".wrangler" -type d -prune -exec rm -rf {} \;

# Remove build directories
find . -name "dist" -type d -prune -exec rm -rf {} \;
find . -name "build" -type d -prune -exec rm -rf {} \;

# Remove coverage directories
find . -name "coverage" -type d -prune -exec rm -rf {} \;
find . -name "html" -type d -prune -exec rm -rf {} \;

echo "Cleanup complete!"
