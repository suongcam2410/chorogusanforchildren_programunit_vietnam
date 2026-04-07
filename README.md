# ChorogUsan Working Plan Dashboard - GitHub Pages Version

This package contains a static dashboard for GitHub Pages plus a small Google Apps Script backend that reads and writes task data to this Google Sheet:

`https://docs.google.com/spreadsheets/d/1qOeUB-NCxspsVLvxUXzZuVIt8ffetuezBIydqKiBOxc/`

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

Open `config.js` and replace:

`PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`

with your deployed Apps Script Web App URL.

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
6. AssignedEmail
7. StartDate
8. EndDate
9. Status
10. Risk
11. ReferenceLink
12. Notes
13. CreatedBy
14. CreatedAt
15. UpdatedAt

## Category list included

The Add New Task form now includes these categories, including your requested additions:

- Finance
- Planning
- Partnership
- Capacity Building
- Field Activities
- M&E
- Reporting
- Administration
- Other

## Notes

- The login in this GitHub Pages version is client-side only.
- That means it is useful for a simple internal page, but it is not strong security.
- For stronger security, a real authentication system should be added later.
