# Vercel Publisher for Obsidian

An Obsidian plugin that allows you to publish your notes to Vercel with one click.

## Features

- Publish individual pages or all notes to Vercel
- Automatically includes linked pages and embedded assets
- Supports images, videos, PDFs, and audio files
- Custom domain support
- Unpublish pages when needed
- Local HTML export option
- Ribbon icons for quick publishing
- Command palette integration
- Clean, serif-based design optimized for reading

## Setup

### 1. Create a Vercel Account and Project

1. Sign up for a free account at [Vercel](https://vercel.com/)
2. Choose a project name (you'll use this in the plugin settings)
3. No need to create the project manually - the plugin will handle deployment

### 2. Get Your Vercel API Token

1. Go to [Vercel Account Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Give it a name (e.g., "Obsidian Publisher")
4. Set the scope to your account
5. Copy the generated token (you won't be able to see it again!)

### 3. Configure Plugin Settings

1. Open Obsidian Settings
2. Go to "Obsidian to Vercel Publisher" in the Community Plugins section
3. Enter your credentials:
   - **Export Folder**: Local folder for HTML exports (default: `_exported`)
   - **Vercel API Token**: The API token you created in step 2
   - **Vercel Project Name**: Choose a name for your project (e.g., "my-obsidian-notes")

## Usage

### Publishing a Page to Vercel

The plugin is designed to publish individual pages along with their linked content. There are several ways to publish:

1. **Ribbon icon**: Click the cloud upload icon in the left ribbon while viewing a note
2. **Right-click menu**: Right-click on any markdown file and select "Publish to Vercel"
3. **Command palette**: Use Ctrl/Cmd+P and search for "Publish current page to Vercel"

**Publishing Flow:**
1. Choose a page to publish
2. A modal opens showing:
   - Available domains (including custom domains if configured)
   - An editable URL slug (auto-generated hash or custom)
   - A live preview of the final URL
   - Copy button for easy sharing
3. Click "Publish"
4. The plugin will:
   - Find and include all pages linked from the main page (`[[wiki links]]`)
   - Collect all embedded assets (images, videos, PDFs, audio)
   - Convert markdown to HTML using Obsidian's renderer
   - Deploy to Vercel with clean URLs
   - Show you the direct URL to your page

**Unpublishing:**
- Click "Unpublish" in the modal to remove a page from your site
- The plugin will redeploy without the unpublished page

### Publishing All Notes

You can also publish your entire vault:

1. **Command palette**: Use Ctrl/Cmd+P and search for "Publish all notes to Vercel"

This will publish every markdown file in your vault.

### Local Export

You can also export notes to HTML locally:

1. **Export current note**: Right-click on a file and select "Export to HTML"
2. **Export all notes**: Use the command palette and search for "Export all markdown notes to HTML"

### Viewing Your Published Pages

After publishing, your pages will be available at:
- **Main page**: `https://[your-project-name].vercel.app/[your-slug]/`
- **Linked pages**: `https://[your-project-name].vercel.app/[your-slug]/[linked-page-name]`
- **Custom domains**: If configured in Vercel, use `https://[your-domain].com/[your-slug]/`

The plugin automatically:
- Detects all `[[wiki-style links]]` in your page
- Publishes linked pages alongside the main page in the same slug folder
- Converts internal links to work on the web
- Embeds images, videos, PDFs, and audio files
- Uses clean URLs (no `.html` extension needed)
- Applies a responsive, mobile-friendly serif design

## How It Works

1. **Single Page Publishing**:
   - You choose a page to publish
   - Plugin scans for `[[linked]]` pages in that note
   - Finds all embedded assets (images via `![[image.png]]`, videos, PDFs, audio)
   - Converts main page + linked pages to HTML using Obsidian's markdown renderer
   - Generates clean HTML with serif typography styling
   - Deploys everything to Vercel in a single slug folder
   - Returns the direct URL to your main page

2. **Asset Handling**:
   - Detects embedded images: `![[image.png]]` or `![](image.png)`
   - Supports videos (mp4, webm, mov, mkv) with HTML5 video players
   - Embeds PDFs in iframes
   - Includes audio files (mp3, wav, ogg, flac) with HTML5 audio players
   - All assets are base64-encoded and uploaded to Vercel

3. **Link Detection**:
   - Finds all `[[note]]` and `[[note|alias]]` style wiki links
   - Automatically includes those pages in the deployment
   - Converts links to relative paths within the slug folder

4. **Deployment Process**:
   - Creates a single deployment containing ALL published pages
   - Each published page gets its own slug folder: `/slug-name/`
   - Linked pages are stored as: `/slug-name/linked-page-name.html`
   - Uses Vercel's REST API for instant deployment
   - Each deployment replaces the previous version entirely

## URL Slug Generation

The plugin generates stable, unique slugs for your pages:
- **Auto-generated**: Creates a hash-based slug (e.g., `a3f5e8c2`) from the file path for stability
- **Reuses existing**: If you've published a page before, it keeps the same slug
- **Fully customizable**: Edit the slug in the publish modal before deploying
- **URL-friendly**: Converts custom slugs to lowercase, removes special characters, replaces spaces with hyphens

**Examples:**
- Auto-generated: `a3f5e8c2`
- Custom: "My Great Note!" becomes `my-great-note`

## Supported File Formats

The plugin supports all Obsidian-compatible media formats:

**Images:**
- AVIF, BMP, GIF, JPEG/JPG, PNG, SVG, WebP

**Videos:**
- MP4, WebM, OGV, MKV, MOV, 3GP

**Audio:**
- MP3, WAV, OGG, FLAC, M4A, WebM

**Documents:**
- PDF (embedded in iframe)

All media files are automatically detected, embedded, and deployed alongside your pages.

## Development

### Building the Plugin

```bash
npm install
npm run build
```

### Installing in Obsidian

1. Copy `main.js`, `manifest.json` to your vault's `.obsidian/plugins/vercel-publisher/` folder
2. Reload Obsidian
3. Enable the plugin in Settings > Community Plugins

## Troubleshooting

If you encounter any issues:

1. **Authentication errors**:
   - Check that your Vercel API token is correct
   - Make sure you copied the entire token
   - Try creating a new token

2. **Project not found**:
   - The project name should be lowercase with hyphens
   - The plugin will attempt to create the project if it doesn't exist
   - Check the Vercel dashboard to see if the project exists

3. **Deployment fails**:
   - Check the developer console (Ctrl/Cmd+Shift+I) for detailed error messages
   - Ensure you have a stable internet connection
   - Try again - sometimes Vercel's API has temporary issues

## Why Vercel?

Vercel offers:
- **Free tier**: Perfect for personal note publishing
- **Reliable API**: Well-documented REST API with good performance
- **Fast deployments**: Your site goes live in seconds
- **Global CDN**: Your notes load fast anywhere in the world
- **HTTPS by default**: Secure connection out of the box
- **No build step**: Direct file upload makes deployments simple

## License

MIT
