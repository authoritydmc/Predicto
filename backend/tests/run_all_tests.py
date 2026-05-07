#!/usr/bin/env python
"""Run all tests for automation system"""
import unittest
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Discover and run all tests
loader = unittest.TestLoader()
suite = unittest.TestSuite()

# Add test modules
test_modules = [
    'tests.test_cron_manager',
    'tests.test_cron_scheduler', 
    'tests.test_matches',
    'tests.test_scoring',
    'tests.test_scraper_runner',
    'tests.test_config',
    'tests.test_main'
]

for module in test_modules:
    try:
        suite.addTests(loader.loadTestsFromName(module))
    except Exception as e:
        print(f"Warning: Could not load {module}: {e}")

# Run tests
runner = unittest.TextTestRunner(verbosity=2)
result = runner.run(suite)

# Exit with appropriate code
sys.exit(0 if result.wasSuccessful() else 1)
