# Node.js Installation Instructions

## Quick Installation

### Option 1: Official Installer (Recommended)

1. **Download Node.js**
   - Visit: https://nodejs.org/
   - Download the **LTS (Long Term Support)** version
   - Choose the Windows Installer (.msi) for your system (64-bit recommended)

2. **Run the Installer**
   - Double-click the downloaded .msi file
   - Follow the installation wizard
   - **Important**: Check the box "Automatically install the necessary tools"
   - Accept the default installation path: `C:\Program Files\nodejs\`

3. **Verify Installation**
   - Open a **new** PowerShell or Command Prompt window
   - Run: `node --version`
   - Run: `npm --version`
   - Both commands should display version numbers

### Option 2: Using Winget (Windows Package Manager)

If you have Windows 10/11 with winget installed:

```powershell
winget install OpenJS.NodeJS.LTS
```

Then restart your terminal and verify:
```powershell
node --version
npm --version
```

### Option 3: Using Chocolatey

If you have Chocolatey installed:

```powershell
choco install nodejs-lts
```

Then restart your terminal and verify:
```powershell
node --version
npm --version
```

## After Installation

### 1. Restart Your Terminal
**Important**: Close all PowerShell/Command Prompt windows and open a new one. This ensures the PATH is updated.

### 2. Navigate to Project Directory
```powershell
cd "C:\Users\paulaalf\New folder"
```

### 3. Install Project Dependencies
```powershell
npm install
```

This will install fast-check and other dependencies.

### 4. Run the Property Test
```powershell
node --test tests/TenureCalculator.property.test.js
```

Or run all tests:
```powershell
npm test
```

Or run just the property tests:
```powershell
npm run test:property
```

## Troubleshooting

### "node is not recognized" after installation

1. **Restart your terminal** - This is the most common fix
2. **Check PATH manually**:
   ```powershell
   $env:PATH -split ';' | Select-String nodejs
   ```
   Should show: `C:\Program Files\nodejs`

3. **Add to PATH manually** (if needed):
   - Open System Properties → Environment Variables
   - Under "System variables", find "Path"
   - Click "Edit" → "New"
   - Add: `C:\Program Files\nodejs\`
   - Click OK and restart terminal

### npm install fails

1. **Check internet connection**
2. **Clear npm cache**:
   ```powershell
   npm cache clean --force
   ```
3. **Try again**:
   ```powershell
   npm install
   ```

### Permission errors

Run PowerShell as Administrator and try again.

## Expected Output After Running Test

Once Node.js is installed and you run the property test, you should see output like:

```
✔ TenureCalculator - Property-Based Tests > Property 1: Tenure calculation accuracy (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 2: Tier selection correctness (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 3: Salary calculation mathematical accuracy (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 4: Complete result information - tenure (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 4: Complete result information - increase (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 8: Fractional year precision (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 5: Input validation completeness (XXXms)
✔ TenureCalculator - Property-Based Tests > Property 6: Error handling consistency (XXXms)
```

All tests should pass with green checkmarks (✔).

## What Was Implemented

### Property 6: Error handling consistency

The test validates Requirements 2.4 and 2.5:

**What it tests:**
- For any invalid input, the system prevents calculation execution (Requirement 2.5)
- For any invalid input, appropriate error messages are displayed (Requirement 2.4)
- Error messages have proper structure (field and message)
- User-friendly messages are provided
- Valid inputs allow calculation to proceed
- Invalid inputs do not produce calculation data

**Test coverage:**
- 100+ iterations with random invalid input combinations
- Tests missing required fields (name, startDate, currentSalary)
- Tests invalid date formats and future start dates
- Tests invalid salary values (negative, non-numeric, zero)
- Verifies error message structure and content
- Verifies calculation prevention for invalid inputs

## Next Steps After Installation

1. Install Node.js using one of the methods above
2. Restart your terminal
3. Navigate to the project directory
4. Run `npm install` to install dependencies
5. Run `npm run test:property` to execute the property tests
6. Verify that Property 6 test passes

## Summary

- ✅ Property 6 test code is written and ready
- ⏳ Waiting for Node.js installation
- ⏳ After installation, run tests to verify implementation

The test is complete and ready to run once Node.js is installed!
