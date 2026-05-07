#!/usr/bin/env python
"""Run all tests for automation system"""
import unittest
import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# Discover and run all tests
loader = unittest.TestLoader()
start_dir = os.path.join(backend_dir, 'tests')
suite = loader.discover(start_dir, pattern='test_*.py')

# Run tests
runner = unittest.TextTestRunner(verbosity=2)
result = runner.run(suite)

# Exit with appropriate code
sys.exit(0 if result.wasSuccessful() else 1)
