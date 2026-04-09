# ChorogUsan Working Plan Dashboard - GitHub Pages Version

This package contains a static dashboard for GitHub Pages plus a Google Apps Script backend that reads and writes task data to Google Sheets.

## Included files

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `assets/logo.png`
- `apps-script/Code.gs`

## Default login

- Username: `admin`
- Password: `88888888`

## Important note

GitHub Pages alone cannot securely write directly to Google Sheets.
For that reason, this package uses:

- GitHub Pages for the front-end
- Google Apps Script Web App for the API layer

## Step 1 - Deploy the Apps Script backend

1. Open Google Apps Script.
2. Create a new project.
3. Paste the content of `apps-script/Code.gs` into the project.
4. Save the project.
5. Click **Deploy** → **New deployment**.
6. Choose **Web app**.
7. Execute as: **Me**.
8. Who has access: **Anyone**.
9. Deploy and copy the Web App URL.

## Step 2 - Update the front-end config

Open `config.js` and replace the `API_BASE_URL` value with your deployed Apps Script Web App URL if needed.

## Step 3 - Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload all files in this package, keeping the same folder structure.
3. In repository settings, enable **GitHub Pages**.
4. Use the root folder as the publishing source.
5. Open the generated GitHub Pages URL.

## Sheet structure

The Apps Script will automatically create or normalize a sheet named `Tasks` with these columns:

1. ID
2. TaskName
3. Category
4. Partner
5. AssignedTo
6. StartDate
7. EndDate
8. Status
9. Risk
10. ReferenceLink
11. Notes
12. CreatedBy
13. CreatedAt
14. UpdatedAt

If the old sheet still has the legacy `AssignedEmail` column, the updated Apps Script will automatically remove it and normalize the structure.

## Category list included

- Planning
- Field Activities
- Event
- Meeting
- M&E
- Finance
- Communications
- Partnership

## Main UI changes included

- Removed **Upcoming Deadlines**
- Replaced **Task Overview** table with a month-based roadmap view
- Removed **Assigned Email** from the form and table
- Changed **Risk Level** to free-text **Risk** input

## Notes

- The login in this GitHub Pages version is client-side only.
- That means it is useful for a simple internal page, but it is not strong security.
- For stronger security, a real authentication system should be added later.
