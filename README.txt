FAZAL HOSSEN PRANTO | PORTFOLIO WEBSITE
=======================================

FILES (all go in the ROOT of your repository, not inside a folder)
  index.html     the page
  style.css      all styling (colors/fonts are CSS variables at the top)
  script.js      builds the page from content.json + all effects
  content.fallback.js   a built-in copy of content.json so the page also opens by double-click
  content.json   ALL your text, colors, links, section order  <- the file the admin panel edits
  admin.html / admin.css / admin.js    the admin panel
  assets/        portrait.webp, share.jpg (share preview), favicon.svg

DEPLOY (GitHub Pages)
  1. Open your repository fazalhossen48/fazalhossen48.github.io on GitHub.
  2. Add file > Upload files. Drag in EVERYTHING from this folder
     (index.html, style.css, script.js, content.json, content.fallback.js, admin.html, admin.css,
      admin.js and the whole assets folder). Commit changes.
  3. Settings > Pages > Deploy from branch > main / root.
  4. Wait 1-2 minutes. Your site: https://fazalhossen48.github.io/
     Admin panel:               https://fazalhossen48.github.io/admin.html

USE THE ADMIN PANEL
  - Open /admin.html and enter your password.
  - Edit texts, colors, fonts, section order/visibility, videos, services, links.
  - The right side shows a live preview. Edits are kept as a draft in your browser.
  - To publish: Publish tab > Download content.json > upload it to GitHub
    (it replaces the old one) > Commit. Wait 1-2 minutes, then hard-refresh.
  - New photos: upload them into the assets/ folder on GitHub and type the path
    in the admin (e.g. assets/photo.webp), or use the Upload button to embed one.

PASSWORD NOTE
  The admin password is a light lock only (a static site cannot hide a page).
  The real protection is that nothing goes live until YOU upload content.json.
  Change it: Publish tab > "Change the admin password", then paste the new
  PASS_HASH line into admin.js on GitHub.

OPEN IT ON YOUR COMPUTER (optional)
  Double-click index.html. All sections show using the built-in copy (content.fallback.js).
  YouTube videos only play once the site is on GitHub (YouTube blocks embeds from local files).
  Edits made later in the admin are published through content.json; the local copy is only a preview.

NOT EDITABLE IN THE ADMIN
  The browser-tab title, search description and share-preview card live in index.html
  (the <head> tags) because link crawlers do not run JavaScript. After you change
  your share image, ask Facebook's Sharing Debugger to scrape the URL again.

SHARE PREVIEW IMAGE
  assets/share.jpg is 1200x630 (73 KB). Replace it with the same name to change it.
