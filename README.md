# Tenure Increase Calculator

A web-based tool to calculate salary increases based on employee tenure, supporting both single employee calculations and bulk processing.

## Features

- **Single Employee Calculation**: Calculate individual salary increases
- **Bulk Calculation**: Process multiple employees at once via CSV upload or manual entry
- **Export Results**: Download bulk calculation results as CSV
- Clean, responsive web interface with tabbed navigation
- Real-time calculations with detailed breakdown
- Summary statistics for bulk calculations

## Tenure Increase Tiers (Colombia CS Step Plan)

| Months of Service | Step | Increase Percentage |
|-------------------|------|-------------------|
| 0-5 months        | Step 1 | 0%              |
| 6-11 months       | Step 2 | 3%              |
| 12-23 months      | Step 3 | 5%              |
| 24-35 months      | Step 4 | 7%              |
| 36+ months        | Step 5 | 10%             |

## Usage

### Single Employee Calculation
1. Open `index.html` in a web browser
2. On the "Single Employee" tab, enter:
   - Employee name
   - Start date
   - Current salary
   - Calculation date (defaults to today)
3. Click "Calculate Increase" to see results

### Bulk Calculation
1. Switch to the "Bulk Calculation" tab
2. Set the calculation date (applies to all employees)
3. Either:
   - Upload a CSV file with employee data, or
   - Paste CSV data directly into the text area
4. CSV format: `Name, Start Date (YYYY-MM-DD), Current Salary`
5. Click "Calculate All" to process all employees
6. View summary statistics and detailed results table
7. Click "Download Results" to export as CSV

### Sample CSV Format
```
John Doe,2020-01-15,50000
Jane Smith,2019-03-20,65000
Bob Johnson,2021-07-10,45000
```

## Customization

You can modify the increase tiers by editing the `increaseRules` array in `script.js`:

```javascript
this.increaseRules = [
    { minYears: 0, maxYears: 1, percentage: 0 },
    { minYears: 1, maxYears: 3, percentage: 3 },
    // Add or modify tiers as needed
];
```

## Files

- `index.html` - Main HTML structure with tabbed interface
- `styles.css` - Styling and layout for both single and bulk calculations
- `script.js` - Calculation logic, UI interactions, and bulk processing
- `sample_employees.csv` - Example CSV file for testing bulk calculations
- `test.html` - Comprehensive test suite for validation
- `README.md` - Documentation