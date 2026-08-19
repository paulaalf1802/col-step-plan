# Setup Guide - Tenure Increase Calculator

## Quick Start

This guide will help you set up the testing framework and project structure for the Tenure Increase Calculator.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
  
- **npm** (comes with Node.js)
  - Verify installation: `npm --version`

## Installation Steps

### 1. Install Dependencies

Open a terminal in the project root directory and run:

```bash
npm install
```

This will install:
- `fast-check` (v3.15.0) - Property-based testing library

### 2. Verify Setup

Run the verification script to ensure everything is configured correctly:

```bash
node verify-setup.js
```

This script checks:
- ✅ Directory structure (src/, tests/)
- ✅ Required files exist
- ✅ package.json configuration
- ✅ Dependencies installed
- ✅ Module imports work correctly

### 3. Run Tests

Once setup is verified, run the test suite:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only property-based tests
npm run test:property
```

## Project Structure

After setup, your project should have this structure:

```
tenure-increase-calculator/
├── src/                                  # Source code
│   └── TenureCalculator.js              # Core calculation engine
├── tests/                                # Test files
│   ├── TenureCalculator.test.js         # Unit tests
│   ├── TenureCalculator.property.test.js # Property-based tests
│   └── README.md                         # Testing documentation
├── node_modules/                         # Dependencies (created by npm install)
├── .gitignore                           # Git ignore rules
├── package.json                         # Project configuration
├── verify-setup.js                      # Setup verification script
├── SETUP_GUIDE.md                       # This file
└── PROJECT_STRUCTURE.md                 # Detailed structure documentation
```

## Testing Framework Details

### Unit Tests
- **Location:** `tests/TenureCalculator.test.js`
- **Framework:** Node.js built-in test runner
- **Purpose:** Test specific examples and edge cases
- **Run:** `npm run test:unit`

### Property-Based Tests
- **Location:** `tests/TenureCalculator.property.test.js`
- **Library:** fast-check
- **Iterations:** 100 runs per property (minimum)
- **Purpose:** Validate universal properties across all inputs
- **Run:** `npm run test:property`

## What's Been Set Up

### ✅ Task 1 Completion Checklist

- [x] Created `src/` directory for source files
- [x] Created `tests/` directory for test files
- [x] Installed fast-check library (v3.15.0)
- [x] Configured package.json with test scripts
- [x] Set up ES6 module system
- [x] Created TenureCalculator class with core methods
- [x] Created comprehensive unit tests
- [x] Created property-based tests (8 properties, 100+ iterations each)
- [x] Added .gitignore for clean repository
- [x] Created documentation (README, guides)
- [x] Created verification script

## Next Steps

Now that the testing framework is set up, you can proceed with:

1. **Task 2:** Implement remaining calculation engine features
2. **Task 3:** Add input validation system
3. **Task 4:** Create configuration management
4. **Task 5:** Build user interface components
5. **Task 6:** Implement output formatting
6. **Task 7:** Integration testing

## Troubleshooting

### Node.js not found
- Install Node.js from https://nodejs.org/
- Restart your terminal after installation
- Verify with: `node --version`

### npm install fails
- Check your internet connection
- Try clearing npm cache: `npm cache clean --force`
- Delete `node_modules/` and `package-lock.json`, then run `npm install` again

### Tests not running
- Ensure you're in the project root directory
- Verify Node.js version is 18+: `node --version`
- Check that dependencies are installed: `npm list fast-check`

### Import errors
- Verify `"type": "module"` is in package.json
- Ensure file extensions (.js) are included in import statements
- Check that file paths are correct

## Testing Best Practices

1. **Run tests frequently** - After any code change
2. **Check all tests pass** - Before committing code
3. **Read failure messages** - They provide valuable debugging info
4. **Use property tests** - To discover edge cases
5. **Keep tests fast** - So you run them often

## Support

If you encounter issues:
1. Run `node verify-setup.js` to diagnose problems
2. Check the troubleshooting section above
3. Review the test output for specific error messages
4. Ensure all prerequisites are installed correctly

## Summary

You now have:
- ✅ Organized project structure (src/, tests/)
- ✅ Fast-check library installed and configured
- ✅ Node.js test runner configured
- ✅ Comprehensive test suite (unit + property-based)
- ✅ Core TenureCalculator class implemented
- ✅ Documentation and guides

**Ready to proceed with Task 2!** 🚀
