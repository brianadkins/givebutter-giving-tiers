# Givebutter Donor Tier Segmentation

A simple web tool to analyze your Givebutter donation exports and segment donors into giving tiers.

## What It Does

Upload a CSV export from Givebutter and this tool will:

- Group donors by total giving amount into customizable tiers (Platinum, Gold, Silver, Bronze, Friend)
- Show individual donations when you click to expand a donor's row
- Let you merge duplicate contacts that represent the same person
- Export results to a text file

## How to Use

### Step 1: Export Your Data from Givebutter

1. Log into your Givebutter account
2. Go to **Transactions** in the menu
3. Click the **Export** button (usually in the top right)
4. Choose **CSV** format and download the file

### Step 2: Upload and Analyze

1. Open `index.html` in your web browser
2. Click the upload area or drag your CSV file onto it
3. Adjust the time period if needed (default is 12 months)
4. Click **Analyze Donations**

Or click **Load Sample Data** to try it out with fake donor data first.

### Step 3: Review Your Results

Donors are grouped by how much they've given:

| Tier | Default Minimum |
|------|-----------------|
| Platinum | $2,500+ |
| Gold | $1,000+ |
| Silver | $500+ |
| Bronze | $250+ |
| Friend | $50+ |

You can customize these tier names and amounts in the Configuration section.

### Merging Duplicate Donors

Sometimes the same person appears with different Contact IDs. To combine them:

1. Check the boxes next to the donors you want to merge
2. Click **Merge Selected Donors**
3. Their donations will be combined into one total
4. To undo, select the merged row and click **Unmerge Selected**

## Privacy

**Your data never leaves your computer.**

This tool runs entirely in your web browser using client-side JavaScript. When you upload a file:

- It's processed locally in your browser
- Nothing is sent to the internet
- No data is stored on any server
- When you close the page, the data is gone

## Sample Data

The **Load Sample Data** button loads fake donor data for demonstration purposes. This sample data:

- Was generated with fictional names, emails, and donation amounts
- Spans 3 years (2023-2025) with 30 unique donors and 79 total transactions
- Shows realistic giving patterns:
  - Annual repeat donors (giving around the same time each year)
  - Growing donors (increasing their gifts over time)
  - Consistent donors (same amount each year)
  - One-time donors from earlier years
- Includes one anonymous donor giving $5,000 annually
- Features a mix of individuals and organizations

The sample data is embedded directly in the JavaScript code (`app.js`) and does not represent real people or organizations.

**Tip:** Try changing the "Time Period" setting to see how donors move between tiers based on the timeframe analyzed (12 months vs 36 months shows very different totals).

## Technical Details

- **No frameworks** - Built with vanilla HTML, CSS, and JavaScript
- **No server required** - Just open `index.html` in a browser
- **CSV parsing** - Handles quoted fields with commas correctly
- **Columns used from Givebutter export**:
  - Contact ID (primary identifier)
  - First Name, Last Name, Public Name
  - Email, Contact Email
  - Company
  - Donated (amount)
  - Transaction Date (UTC)
  - Status Friendly (only "Succeeded" transactions are counted)

## Files

```
index.html      - Main HTML page
styles.css      - Styling
app.js          - Application logic
sample-files/   - Contains sample CSV for testing
```

## License

MIT
