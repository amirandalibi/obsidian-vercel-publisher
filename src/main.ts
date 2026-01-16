import { Component, MarkdownRenderer, MarkdownView, Notice, Plugin, TFile, normalizePath } from "obsidian";
import { DEFAULT_SETTINGS, VercelPublisherSettings, VercelPublisherSettingTab } from "./settings";
import { TemplateGenerator, PageData } from "./templateGenerator";
import { VercelApi, VercelFile } from "./vercelApi";
import { PublishModal } from "./publishModal";

// Helper function to set CSS properties
function setCssProps(element: HTMLElement, props: Record<string, string | number>) {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(
			key.replace(/([A-Z])/g, "-$1").toLowerCase(),
			typeof value === "number" ? `${value}px` : value
		);
	}
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		const byte = bytes[i];
		if (byte !== undefined) {
			binary += String.fromCharCode(byte);
		}
	}
	return window.btoa(binary);
}

export default class VercelPublisherPlugin extends Plugin {
	settings: VercelPublisherSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon for local export
		this.addRibbonIcon("file-output", "Export to HTML", async () => {
			await this.exportCurrentNote();
		});

		// Add ribbon icon for Vercel publishing (current page)
		this.addRibbonIcon("upload-cloud", "Publish to Vercel", async () => {
			await this.publishCurrentPageToVercel();
		});

		// Add command to export current note
		this.addCommand({
			id: "export-current-note",
			name: "Export current note to HTML",
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						void this.exportCurrentNote();
					}
					return true;
				}
				return false;
			}
		});

		// Add command to export all notes
		this.addCommand({
			id: "export-all-notes",
			name: "Export all notes to HTML",
			callback: async () => {
				await this.exportAllNotes();
			}
		});

		// Add command to publish current page to Vercel
		this.addCommand({
			id: "publish-page-to-vercel",
			name: "Publish current page to Vercel",
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.file) {
					if (!checking) {
						void this.publishCurrentPageToVercel();
					}
					return true;
				}
				return false;
			}
		});

		// Add command to publish all notes to Vercel
		this.addCommand({
			id: "publish-all-notes-to-vercel",
			name: "Publish all notes to Vercel",
			callback: async () => {
				await this.publishAllNotesToVercel();
			}
		});

		// Add settings tab
		this.addSettingTab(new VercelPublisherSettingTab(this.app, this));

		// Register file menu event for right-click context menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item
							.setTitle("Export to HTML")
							.setIcon("file-output")
							.onClick(() => {
								void this.exportNote(file);
							});
					});

					menu.addItem((item) => {
						item
							.setTitle("Publish to Vercel")
							.setIcon("upload-cloud")
							.onClick(() => {
								new PublishModal(this.app, this, file,
									(slug: string) => {
										void this.publishPageToVercel(file, slug);
									},
									() => {
										void this.unpublishFromVercel(file);
									}
								).open();
							});
					});
				}
			})
		);
	}

	async exportCurrentNote() {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) {
			new Notice("No active file");
			return;
		}

		const file = markdownView.file;
		if (!file) {
			new Notice("No file found");
			return;
		}

		await this.exportNote(file);
	}

	async exportNote(file: TFile) {
		try{
			const loadingNotice = new Notice("Exporting note...", 0);

			// Ensure export folder exists
			const exportPath = normalizePath(this.settings.exportFolder);
			await this.ensureFolderExists(exportPath);

			// Read the file content
			const content = await this.app.vault.read(file);

			// Convert markdown to HTML
			const htmlContent = await this.markdownToHtml(content);

			// Create page data
			const pageData: PageData = {
				title: file.basename,
				content: htmlContent,
				slug: this.generateSlug(file.basename)
			};

			// Generate HTML
			const templateGen = new TemplateGenerator(this.app);
			const html = templateGen.generateHTML(pageData);

			// Write to export folder
			const outputPath = normalizePath(`${exportPath}/${pageData.slug}.html`);
			await this.app.vault.adapter.write(outputPath, html);

			loadingNotice.hide();
			new Notice(`Exported to ${outputPath}`);
		} catch (error) {
			console.error("Export error:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			new Notice(`Failed to export: ${errorMessage}`);
		}
	}

	async exportAllNotes() {
		try {
			const loadingNotice = new Notice("Exporting all notes to HTML...", 0);

			// Ensure export folder exists
			const exportPath = normalizePath(this.settings.exportFolder);
			await this.ensureFolderExists(exportPath);

			// Get all markdown files
			const files = this.app.vault.getMarkdownFiles();

			if (files.length === 0) {
				loadingNotice.hide();
				new Notice("No files found");
				return;
			}

			// Collect all pages
			const allPages: PageData[] = [];
			for (const file of files) {
				const content = await this.app.vault.read(file);
				const htmlContent = await this.markdownToHtml(content);
				allPages.push({
					title: file.basename,
					content: htmlContent,
					slug: this.generateSlug(file.basename)
				});
			}

			// Generate HTML files
			const templateGen = new TemplateGenerator(this.app);

			// Generate individual pages
			for (const page of allPages) {
				const html = templateGen.generateHTML(page);
				const outputPath = normalizePath(`${exportPath}/${page.slug}.html`);
				await this.app.vault.adapter.write(outputPath, html);
			}

			loadingNotice.hide();
			new Notice(`Exported ${files.length} notes to ${exportPath}`);
		} catch (error) {
			console.error("Export error:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			new Notice(`Failed to export: ${errorMessage}`);
		}
	}

	async ensureFolderExists(folderPath: string) {
		const normalizedPath = normalizePath(folderPath);
		const folderExists = await this.app.vault.adapter.exists(normalizedPath);
		if (!folderExists) {
			await this.app.vault.adapter.mkdir(normalizedPath);
		}
	}

	generateSlug(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	}

	/**
	 * Get MIME type from file extension
	 * Based on Obsidian's officially supported file formats
	 */
	getMimeType(extension: string): string {
		const MIME_TYPES: Record<string, string> = {
			// Images - Obsidian supported formats
			"avif": "image/avif",
			"bmp": "image/bmp",
			"gif": "image/gif",
			"jpeg": "image/jpeg",
			"jpg": "image/jpeg",
			"png": "image/png",
			"svg": "image/svg+xml",
			"webp": "image/webp",

			// Audio - Obsidian supported formats
			"flac": "audio/flac",
			"m4a": "audio/mp4",
			"mp3": "audio/mpeg",
			"ogg": "audio/ogg",
			"wav": "audio/wav",
			"webm": "audio/webm",  // Note: webm can be audio or video
			"3gp": "audio/3gpp",

			// Video - Obsidian supported formats
			"mkv": "video/x-matroska",
			"mov": "video/quicktime",
			"mp4": "video/mp4",
			"ogv": "video/ogg",

			// Documents - Obsidian supported formats
			"pdf": "application/pdf"
		};

		return MIME_TYPES[extension.toLowerCase()] || "application/octet-stream";
	}

	/**
	 * Create appropriate HTML element based on file type
	 */
	createElementForFile(filename: string, alt?: string): HTMLElement {
		const extension = filename.split(".").pop()?.toLowerCase() || "";
		const mimeType = this.getMimeType(extension);
		const category = mimeType.split("/")[0]; // 'image', 'audio', 'video', 'application'

		let element: HTMLElement;

		switch (category) {
			case "image":
				element = document.createElement("img");
				element.setAttribute("src", filename);
				element.setAttribute("alt", alt || filename);
				break;

			case "video":
				element = document.createElement("video");
				element.setAttribute("src", filename);
				element.setAttribute("controls", "true");
				setCssProps(element, {
					maxWidth: "100%",
					height: "auto"
				});
				break;

			case "audio":
				element = document.createElement("audio");
				element.setAttribute("src", filename);
				element.setAttribute("controls", "true");
				setCssProps(element, {
					width: "100%"
				});
				break;

			case "application":
				if (mimeType === "application/pdf") {
					element = document.createElement("iframe");
					element.setAttribute("src", filename);
					setCssProps(element, {
						width: "100%",
						height: "600px",
						border: "1px solid var(--background-modifier-border)"
					});
					break;
				}
				// Fall through to default for other application types

			default:
				// Unknown or unsupported - provide download link
				element = document.createElement("a");
				// Use relative path (same folder)
				element.setAttribute("href", filename);
				element.setAttribute("download", filename);
				element.textContent = `📎 ${filename}`;
				setCssProps(element, {
					display: "inline-block",
					padding: "8px 12px",
					border: "1px solid var(--background-modifier-border)",
					borderRadius: "4px",
					textDecoration: "none"
				});
				break;
		}

		return element;
	}

	async markdownToHtml(markdown: string, sourcePath: string = "", parentSlug?: string): Promise<string> {
		// Use Obsidian's markdown renderer
		const div = document.createElement("div");
		// Create a lightweight component for markdown rendering to avoid memory leaks
		const component = new Component();
		await MarkdownRenderer.render(this.app, markdown, div, sourcePath, component);
		component.unload();

		const links = div.querySelectorAll("a.internal-link");
		links.forEach((link) => {
			const href = link.getAttribute("href");
			if (href && !href.startsWith("http")) {
				// Convert [[note]] links to paths in the same slug folder
				const cleanHref = href.replace(/^\//, "").replace(/\.html$/, "");
				const slug = this.generateSlug(cleanHref);
				// Use absolute path with slug folder: /parent-slug/linked-page
				if (parentSlug) {
					link.setAttribute("href", `/${parentSlug}/${slug}`);
				} else {
					link.setAttribute("href", slug);
				}

				link.removeAttribute("target");
			}
		});

		const images = div.querySelectorAll("img");
		images.forEach((img) => {
			const src = img.getAttribute("src");

			// Skip external URLs (http/https) and data URIs
			if (src && src.startsWith("http://") || src && src.startsWith("https://") || src && src.startsWith("data:")) {
				return;
			}

			if (src) {
				// Remove app:// protocol if present
				let cleanSrc = src.replace(/^app:\/\/[^/]+\//, "");
				// Extract just the filename from the path
				const filename = cleanSrc.split("/").pop() || cleanSrc;

				img.setAttribute("src", filename);
			}
		});

		// Convert wiki-style embed spans to appropriate HTML tags based on MIME type
		const embeds = div.querySelectorAll("span.internal-embed");
		embeds.forEach((embed) => {
			const src = embed.getAttribute("src");
			const alt = embed.getAttribute("alt");

			// The filename might be in the alt attribute or innerHTML
			let filename = src || alt || embed.innerHTML.trim();

			if (filename) {
				// Remove app:// protocol if present
				filename = filename.replace(/^app:\/\/[^/]+\//, "");
				// Extract just the filename
				filename = filename.split("/").pop() || filename;

				// Create appropriate HTML element using MIME type detection
				const element = this.createElementForFile(filename, alt || undefined);
				embed.replaceWith(element);
			}
		});

		return div.innerHTML;
	}

	/**
	 * Find all assets (images, videos, etc.) referenced in a note
	 */
	async findAssets(file: TFile): Promise<TFile[]> {
		const assets: TFile[] = [];
		const content = await this.app.vault.read(file);

		// Find markdown images: ![alt](path)
		const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
		// Find wiki-style embeds: ![[file]]
		const embedRegex = /!\[\[([^\]]+)\]\]/g;

		let match;

		// Find markdown-style images
		while ((match = imageRegex.exec(content)) !== null) {
			const assetPath = match[2];
			if (assetPath && !assetPath.startsWith("http")) {
				const assetFile = this.app.metadataCache.getFirstLinkpathDest(assetPath, file.path);
				if (assetFile && !assets.includes(assetFile)) {
					assets.push(assetFile);
				}
			}
		}

		// Find wiki-style embeds
		while ((match = embedRegex.exec(content)) !== null) {
			const assetPath = match[1];
			if (!assetPath) continue;

			const assetFile = this.app.metadataCache.getFirstLinkpathDest(assetPath, file.path);
			if (assetFile && !assets.includes(assetFile)) {
				assets.push(assetFile);
			} else if (!assetFile) {
				// Try searching all files in vault
				const allFiles = this.app.vault.getFiles();
				const foundFile = allFiles.find(f => f.name === assetPath || f.path.endsWith(assetPath));
				if (foundFile) {
					assets.push(foundFile);
				}
			}
		}

		return assets;
	}

	/**
	 * Find all linked pages from the current note
	 */
	async findLinkedPages(file: TFile): Promise<TFile[]> {
		const linkedFiles: TFile[] = [];
		const content = await this.app.vault.read(file);

		// Find all wiki-style links [[note]] or [[note|alias]]
		const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
		let match;

		while ((match = wikiLinkRegex.exec(content)) !== null) {
			const linkPath = match[1];
			if (!linkPath) continue;

			const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

			if (linkedFile && linkedFile.extension === "md" && !linkedFiles.includes(linkedFile)) {
				linkedFiles.push(linkedFile);
			}
		}

		return linkedFiles;
	}

	/**
	 * Publish current page to Vercel
	 */
	async publishCurrentPageToVercel() {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) {
			new Notice("No active file");
			return;
		}

		const file = markdownView.file;
		if (!file) {
			new Notice("No file found");
			return;
		}

		// Show modal to confirm publishing
		new PublishModal(this.app, this, file,
			(slug: string) => {
				void this.publishPageToVercel(file, slug);
			},
			() => {
				void this.unpublishFromVercel(file);
			}
		).open();
	}

	/**
	 * Publish a page to Vercel - creates ONE deployment containing ALL published pages
	 */
	async publishPageToVercel(mainFile: TFile, customSlug?: string) {
		// Validate settings
		if (!this.settings.vercelApiToken) {
			new Notice("Please set your Vercel API token in plugin settings");
			return;
		}

		if (!this.settings.vercelProjectName) {
			new Notice("Please set your Vercel project name in plugin settings");
			return;
		}

		try {
			const loadingNotice = new Notice("Publishing to Vercel...", 0);

			// Determine the slug for the main file
			const mainSlug = customSlug || this.generateSlug(mainFile.basename);

			// Update or add ONLY the main file to publishedPages (not linked pages!)
			const existingIndex = this.settings.publishedPages.findIndex(p => p.filePath === mainFile.path);
			if (existingIndex >= 0) {
				const existingPage = this.settings.publishedPages[existingIndex];
				if (existingPage) {
					existingPage.slug = mainSlug;
					existingPage.publishedAt = Date.now();
				}
			} else {
				this.settings.publishedPages.push({
					filePath: mainFile.path,
					slug: mainSlug,
					publishedAt: Date.now()
				});
			}

			loadingNotice.setMessage("Generating HTML for all published pages...");

			// Generate HTML files for ALL published pages and their linked pages
			const templateGen = new TemplateGenerator(this.app);
			const vercelFiles: VercelFile[] = [];

			// Add Vercel configuration for clean URLs
			const vercelConfig = {
				cleanUrls: true,
				trailingSlash: false
			};
			vercelFiles.push({
				file: "vercel.json",
				data: JSON.stringify(vercelConfig, null, 2),
				encoding: "utf-8"
			});

			// Process each published page
			for (const publishedPage of this.settings.publishedPages) {
				const file = this.app.vault.getAbstractFileByPath(publishedPage.filePath);

				if (!(file instanceof TFile)) {
					// File was deleted from vault but still in publishedPages
					continue;
				}

				const pageSlug = publishedPage.slug;

				// Find linked pages from this published page
				loadingNotice.setMessage(`Processing ${file.basename} and its linked pages...`);
				const linkedFiles = await this.findLinkedPages(file);
				const allFilesForThisPage = [file, ...linkedFiles];

				// Collect pages and assets for this published page
				const pagesForThisSlug: PageData[] = [];
				const assetsForThisSlug: TFile[] = [];

				for (const pageFile of allFilesForThisPage) {
					// Generate HTML for this page
					const content = await this.app.vault.read(pageFile);
					const htmlContent = await this.markdownToHtml(content, pageFile.path, pageSlug);
					pagesForThisSlug.push({
						title: pageFile.basename,
						content: htmlContent,
						slug: pageFile === file ? pageSlug : this.generateSlug(pageFile.basename)
					});

					// Collect assets for this page
					const assets = await this.findAssets(pageFile);
					for (const asset of assets) {
						if (!assetsForThisSlug.includes(asset)) {
							assetsForThisSlug.push(asset);
						}
					}
				}

				// Add main page: /slug/index.html
				const mainPageData = pagesForThisSlug.find(p => p.slug === pageSlug);
				if (mainPageData) {
					const html = templateGen.generateHTML(mainPageData);
					vercelFiles.push({
						file: `${pageSlug}/index.html`,
						data: html,
						encoding: "utf-8"
					});
				}

				// Add linked pages: /slug/page-name.html
				for (const linkedPage of pagesForThisSlug) {
					if (linkedPage.slug !== pageSlug) {
						const html = templateGen.generateHTML(linkedPage);
						vercelFiles.push({
							file: `${pageSlug}/${linkedPage.slug}.html`,
							data: html,
							encoding: "utf-8"
						});
					}
				}

				// Add assets under this slug folder: /slug/asset.png
				for (const asset of assetsForThisSlug) {
					const arrayBuffer = await this.app.vault.readBinary(asset);
					const base64 = arrayBufferToBase64(arrayBuffer);
					vercelFiles.push({
						file: `${pageSlug}/${asset.name}`,
						data: base64,
						encoding: "base64"
					});
				}
			}

			loadingNotice.setMessage("Deploying to Vercel...");

			// Deploy to Vercel
			const vercelApi = new VercelApi(
				this.settings.vercelApiToken,
				this.settings.vercelProjectName
			);

			const deployment = await vercelApi.deploy(vercelFiles);

			// Update ALL published pages to reference the new deployment
			for (const publishedPage of this.settings.publishedPages) {
				publishedPage.deploymentId = deployment.id;
			}
			await this.saveSettings();

			loadingNotice.hide();

			// Show success message with the main page URL
			const productionUrl = `${this.settings.vercelProjectName}.vercel.app`;
			const pageUrl = `https://${productionUrl}/${mainSlug}/`;
			new Notice(`Successfully published!\nPage URL: ${pageUrl}`, 15000);

		} catch (error) {
			console.error("Vercel publish error:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			new Notice(`Failed to publish to Vercel: ${errorMessage}`, 10000);
		}
	}

	/**
	 * Publish all notes to Vercel (legacy method)
	 */
	async publishAllNotesToVercel() {
		// Validate settings
		if (!this.settings.vercelApiToken) {
			new Notice("Please set your Vercel API token in plugin settings");
			return;
		}

		if (!this.settings.vercelProjectName) {
			new Notice("Please set your Vercel project name in plugin settings");
			return;
		}

		try {
			const loadingNotice = new Notice("Publishing to Vercel...", 0);

			// Get all markdown files
			const files = this.app.vault.getMarkdownFiles();

			if (files.length === 0) {
				loadingNotice.hide();
				new Notice("No files found");
				return;
			}

			// Collect all pages
			const allPages: PageData[] = [];
			for (const file of files) {
				const content = await this.app.vault.read(file);
				const htmlContent = await this.markdownToHtml(content);
				allPages.push({
					title: file.basename,
					content: htmlContent,
					slug: this.generateSlug(file.basename)
				});
			}

			// Generate HTML files
			const templateGen = new TemplateGenerator(this.app);
			const vercelFiles: VercelFile[] = [];

			// Generate individual pages (as slug/index.html for clean URLs)
			for (const page of allPages) {
				const html = templateGen.generateHTML(page);
				vercelFiles.push({
					file: `${page.slug}/index.html`,
					data: html,
					encoding: "utf-8"
				});
			}

			// Deploy to Vercel
			const vercelApi = new VercelApi(
				this.settings.vercelApiToken,
				this.settings.vercelProjectName
			);

			await vercelApi.deploy(vercelFiles);

			loadingNotice.hide();

			// Show success message with production URL
			const productionUrl = `${this.settings.vercelProjectName}.vercel.app`;
			new Notice(`Successfully published to Vercel!\nURL: https://${productionUrl}`, 10000);

		} catch (error) {
			console.error("Vercel publish error:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			new Notice(`Failed to publish to Vercel: ${errorMessage}`, 10000);
		}
	}

	/**
	 * Unpublish a file from Vercel - creates a new deployment WITHOUT this page
	 */
	async unpublishFromVercel(file: TFile) {
		// Validate settings
		if (!this.settings.vercelApiToken) {
			new Notice("Please set your Vercel API token in plugin settings");
			return;
		}

		if (!this.settings.vercelProjectName) {
			new Notice("Please set your Vercel project name in plugin settings");
			return;
		}

		try {
			const loadingNotice = new Notice("Unpublishing from Vercel...", 0);

			// Find the published page entry
			const publishedPage = this.settings.publishedPages.find(p => p.filePath === file.path);

			if (!publishedPage) {
				loadingNotice.hide();
				new Notice("This page is not published", 3000);
				return;
			}

			// Remove from published pages
			this.settings.publishedPages = this.settings.publishedPages.filter(
				p => p.filePath !== file.path
			);

			// If no more pages published, just delete everything
			if (this.settings.publishedPages.length === 0) {
				await this.saveSettings();
				loadingNotice.hide();
				new Notice("Successfully unpublished! No pages remaining.", 3000);
				return;
			}

			loadingNotice.setMessage("Regenerating remaining pages...");

			// Generate HTML files for ALL remaining published pages and their linked pages
			const templateGen = new TemplateGenerator(this.app);
			const vercelFiles: VercelFile[] = [];

			// Add Vercel configuration for clean URLs
			const vercelConfig = {
				cleanUrls: true,
				trailingSlash: false
			};
			vercelFiles.push({
				file: "vercel.json",
				data: JSON.stringify(vercelConfig, null, 2),
				encoding: "utf-8"
			});

			// Process each remaining published page
			for (const publishedPage of this.settings.publishedPages) {
				const pageFile = this.app.vault.getAbstractFileByPath(publishedPage.filePath);

				if (!(pageFile instanceof TFile)) {
					// File was deleted from vault but still in publishedPages
					continue;
				}

				const pageSlug = publishedPage.slug;

				// Find linked pages from this published page
				loadingNotice.setMessage(`Processing ${pageFile.basename} and its linked pages...`);
				const linkedFiles = await this.findLinkedPages(pageFile);
				const allFilesForThisPage = [pageFile, ...linkedFiles];

				// Collect pages and assets for this published page
				const pagesForThisSlug: PageData[] = [];
				const assetsForThisSlug: TFile[] = [];

				for (const file of allFilesForThisPage) {
					// Generate HTML for this page
					const content = await this.app.vault.read(file);
					const htmlContent = await this.markdownToHtml(content, file.path, pageSlug);
					pagesForThisSlug.push({
						title: file.basename,
						content: htmlContent,
						slug: file === pageFile ? pageSlug : this.generateSlug(file.basename)
					});

					// Collect assets for this page
					const assets = await this.findAssets(file);
					for (const asset of assets) {
						if (!assetsForThisSlug.includes(asset)) {
							assetsForThisSlug.push(asset);
						}
					}
				}

				// Add main page: /slug/index.html
				const mainPageData = pagesForThisSlug.find(p => p.slug === pageSlug);
				if (mainPageData) {
					const html = templateGen.generateHTML(mainPageData);
					vercelFiles.push({
						file: `${pageSlug}/index.html`,
						data: html,
						encoding: "utf-8"
					});
				}

				// Add linked pages: /slug/page-name.html
				for (const linkedPage of pagesForThisSlug) {
					if (linkedPage.slug !== pageSlug) {
						const html = templateGen.generateHTML(linkedPage);
						vercelFiles.push({
							file: `${pageSlug}/${linkedPage.slug}.html`,
							data: html,
							encoding: "utf-8"
						});
					}
				}

				// Add assets under this slug folder: /slug/asset.png
				for (const asset of assetsForThisSlug) {
					const arrayBuffer = await this.app.vault.readBinary(asset);
					const base64 = arrayBufferToBase64(arrayBuffer);
					vercelFiles.push({
						file: `${pageSlug}/${asset.name}`,
						data: base64,
						encoding: "base64"
					});
				}
			}

			loadingNotice.setMessage("Deploying to Vercel...");

			// Deploy to Vercel
			const vercelApi = new VercelApi(
				this.settings.vercelApiToken,
				this.settings.vercelProjectName
			);

			const deployment = await vercelApi.deploy(vercelFiles);

			// Update ALL remaining published pages to reference the new deployment
			for (const publishedPage of this.settings.publishedPages) {
				publishedPage.deploymentId = deployment.id;
			}
			await this.saveSettings();

			loadingNotice.hide();
			new Notice(`Successfully unpublished! ${this.settings.publishedPages.length} page(s) remaining.`, 3000);

		} catch (error) {
			console.error("Vercel unpublish error:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			new Notice(`Failed to unpublish: ${errorMessage}`, 10000);
		}
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<VercelPublisherSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
