# Tenure Increase Calculator - Project Structure

## Directory Structure

```
tenure-increase-calculator/
├── src/                          # Source code directory
│   └── TenureCalculator.js       # Core calculation engine
├── tests/                        # Test directory
│   ├── TenureCalculator.test.js          # Unit tests
│   ├── TenureCalculator.property.test.js # Property-based tests
│   └── README.md                         # Testing documentation
├── .gitignore                    # Git ignore configuration
├── package.json                  # Project configuration and dependencies
├── PROJECT_STRUCTURE.md          # This file
├── index.html                    # Web interface (to be integrated)
├── script.js                     # UI logic (to be refactored)
└── styles.css                    # Styling
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Install dependencies:
```bash
npm install
```

This will install:
- `fast-check` (v3.15.0) - Property-based testing library

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only property-based tests
npm run test:property

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch
```

## Testing Framework

### Unit Testing
- **Framework:** Node.js built-in test runner (`node:test`)
- **Assertions:** Node.js built-in assert module
- **Purpose:** Test specific examples and edge cases

### Property-Based Testing
- **Library:** fast-check v3.15.0
- **Iterations:** Minimum 100 runs per property (as per design specification)
- **Purpose:** Validate universal properties across comprehensive input ranges

## Module System

The project uses ES6 modules (`"type": "module"` in package.json):
- Use `import/export` syntax
- File extension `.js` required in import statements
- Compatible with modern browsers and Node.js

## Next Steps

After setting up the project structure and testing framework:

1. **Task 2:** Implement core calculation engine (already created in `src/TenureCalculator.js`)
2. **Task 3:** Implement input validation system
3. **Task 4:** Create configuration management system
4. **Task 5:** Build user interface components
5. **Task 6:** Implement output formatting system
6. **Task 7:** Integration and system testing

## Configuration

### package.json
- Project metadata and dependencies
- Test scripts configuration
- ES6 module configuration

### .gitignore
- Excludes node_modules, logs, and IDE-specific files
- Keeps repository clean

## Testing Best Practices

1. **Run tests frequently** during development
2. **Write tests first** when adding new features (TDD)
3. **Check property tests** for edge cases discovered
4. **Maintain 100+ iterations** for property-based tests
5. **Link tests to requirements** using comments

## Troubleshooting

### Tests not running?
- Ensure Node.js v18+ is installed
- Run `npm install` to install dependencies
- Check that you're in the project root directory

### Import errors?
- Verify `"type": "module"` is in package.json
- Include `.js` extension in import statements
- Use relative paths for local modules

### Property tests failing?
- Check the counterexample provided by fast-check
- Verify the property logic matches requirements
- Consider if the failure reveals a real bug
