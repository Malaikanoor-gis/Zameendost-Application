# Publishing ZameenDost yourself

GitHub Pages is free and gives the app an `https://` address, which the GPS button and "install on phone" need.
Nothing has been uploaded yet. You do three things: make a GitHub repository, run one command, switch the website on.

## Part 1 — on the GitHub website (once)

1. Go to https://github.com and sign in. If you have no account, click **Sign up** and make one; remember your **username**.
2. Go to https://github.com/new
3. **Repository name:** `zameendost`
4. Choose **Public**.
5. Leave "Add a README file", "Add .gitignore" and "Choose a license" **unticked / None**.
6. Click **Create repository**. You can close the page that appears.

## Part 2 — on your laptop (one command)

Open **Command Prompt** (press the Windows key, type `cmd`, press Enter). Paste this line and press Enter:

    "C:\Users\PMYLS\Documents\Deepseek\zameendost\publish.bat"

(You can also double-click `publish.bat` in the folder instead.)

It will:

1. ask for your GitHub username — type it and press Enter;
2. show the name and email that will appear publicly on the upload — press any key to continue;
3. upload the app. The first time, a **GitHub sign-in window** opens: sign in there.

When it says **UPLOADED**, it prints two addresses for you. Keep the window open for Part 3.

## Part 3 — switch the website on (once)

1. Open the first address it printed: `https://github.com/YOUR-USERNAME/zameendost/settings/pages`
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`.
4. Click **Save**.

Wait a minute or two, then open:

    https://YOUR-USERNAME.github.io/zameendost/

That is the link to share. On a phone, open it, allow location when asked, and use the browser menu →
**Add to Home screen** to install it.

## Later, when you change something

Run the same command again. It uploads only what changed, and the site updates in a minute or two.

    "C:\Users\PMYLS\Documents\Deepseek\zameendost\publish.bat"

If you changed `engine.js`, first raise the number in `engine.js?v=…` inside `index.html`.

## If something goes wrong

| What you see | What to do |
|---|---|
| "The upload did not go through" | Most often the repository in Part 1 does not exist yet, or the username was mistyped. The script lists the fixes; then run it again. |
| Wrong username typed | In CMD: `cd "C:\Users\PMYLS\Documents\Deepseek\zameendost"` then `git remote set-url origin https://github.com/RIGHT-USERNAME/zameendost.git` then run the script again. |
| `Updates were rejected` | The repository was created with a README. Delete it on GitHub (Settings → bottom of the page), create it again with nothing ticked, run the script again. |
| The website shows 404 | Wait two minutes; check Part 3 says `main` and `/ (root)`. |
| The website shows an old version | Refresh with Ctrl+Shift+R. |
| You want to keep your email private | Before the first run, copy your private address from GitHub → Settings → Emails (it ends in `@users.noreply.github.com`) and run `git config --global user.email "THAT-ADDRESS"` in CMD. |

## The same thing by hand

If you would rather type the Git commands yourself, these are what the script runs:

    cd "C:\Users\PMYLS\Documents\Deepseek\zameendost"
    git init -b main
    git add .
    git commit -m "ZameenDost: satellite-based irrigation advisory"
    git remote add origin https://github.com/YOUR-USERNAME/zameendost.git
    git push -u origin main

and for later changes:

    git add .
    git commit -m "Describe what changed"
    git push

## Before you share the link widely

- Run `node test.js` — all 42 checks should pass.
- Try the GPS button and offline mode on a real phone; neither could be tested while building.
- The map and place-search services are free and need no key, which suits a pilot. For heavy traffic move the
  basemap to a keyed provider (see README, "Coverage").
