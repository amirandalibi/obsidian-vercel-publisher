import { App, Modal, Notice, TFile } from "obsidian";
import type VercelPublisherPlugin from "./main";
import { VercelApi } from "./vercelApi";

// Helper function to set CSS properties
function setCssProps(element: HTMLElement, props: Record<string, string | number>) {
	for (const [key, value] of Object.entries(props)) {
		element.style.setProperty(
			key.replace(/([A-Z])/g, "-$1").toLowerCase(),
			typeof value === "number" ? `${value}px` : value
		);
	}
}

export class PublishModal extends Modal {
	plugin: VercelPublisherPlugin;
	file: TFile;
	slug: string;
	onSubmit: (slug: string) => void;
	onUnpublish: () => void;
	domains: string[] = [];
	selectedDomain: string;
	domainSelectEl: HTMLSelectElement;
	urlDisplayEl: HTMLDivElement;

	constructor(app: App, plugin: VercelPublisherPlugin, file: TFile, onSubmit: (slug: string) => void, onUnpublish: () => void) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.onSubmit = onSubmit;
		this.onUnpublish = onUnpublish;

		// Check if file is already published and use existing slug
		const existingPublish = plugin.settings.publishedPages.find(p => p.filePath === file.path);
		if (existingPublish) {
			this.slug = existingPublish.slug;
		} else {
			// Will be generated asynchronously in onOpen
			this.slug = "";
		}

		// Set default domain
		this.selectedDomain = `${this.plugin.settings.vercelProjectName}.vercel.app`;
	}

	async generateHashSlug(text: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(text);
		const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
		return hashHex.substring(0, 8);
	}

	getFullUrl(): string {
		return `https://${this.selectedDomain}/${this.slug}/`;
	}

	updateUrlDisplay() {
		if (this.urlDisplayEl) {
			this.urlDisplayEl.textContent = this.getFullUrl();
		}
	}

	async fetchDomains() {
		const defaultDomain = `${this.plugin.settings.vercelProjectName}.vercel.app`;

		if (!this.plugin.settings.vercelApiToken || !this.plugin.settings.vercelProjectName) {
			this.domains = [defaultDomain];
			this.selectedDomain = defaultDomain;
			return;
		}

		try {
			const vercelApi = new VercelApi(
				this.plugin.settings.vercelApiToken,
				this.plugin.settings.vercelProjectName
			);

			this.domains = await vercelApi.getProjectDomains();
			this.selectedDomain = this.domains[0] || defaultDomain;
		} catch {
			this.domains = [defaultDomain];
			this.selectedDomain = defaultDomain;
			new Notice("Failed to fetch custom domains, using default");
		}
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add padding to modal
		setCssProps(contentEl, {
			padding: "20px",
			minWidth: "550px"
		});

		// Show loading state while fetching domains
		const loadingEl = contentEl.createDiv({ text: "Loading..." });
		setCssProps(loadingEl, {
			textAlign: "center",
			padding: "20px",
			color: "var(--text-muted)"
		});

		// Generate slug if not already set
		if (!this.slug) {
			this.slug = await this.generateHashSlug(this.file.path);
		}

		// Fetch domains
		await this.fetchDomains();

		// Clear loading
		contentEl.empty();

		// Domain selector row
		if (this.domains.length > 1) {
			const domainRow = contentEl.createDiv({ cls: "publish-domain-row" });
			setCssProps(domainRow, {
				marginBottom: "12px"
			});

			const domainLabel = domainRow.createEl("label", { text: "Domain:" });
			setCssProps(domainLabel, {
				display: "block",
				marginBottom: "4px",
				fontSize: "13px",
				fontWeight: "500"
			});

			this.domainSelectEl = domainRow.createEl("select");
			setCssProps(this.domainSelectEl, {
				width: "100%",
				padding: "8px",
				borderRadius: "4px",
				border: "1px solid var(--background-modifier-border)",
				fontFamily: "var(--font-monospace)",
				fontSize: "13px"
			});

			// Add domain options
			this.domains.forEach(domain => {
				this.domainSelectEl.createEl("option", {
					value: domain,
					text: domain
				});
			});

			this.domainSelectEl.addEventListener("change", () => {
				this.selectedDomain = this.domainSelectEl.value;
				this.updateUrlDisplay();
			});
		}

		// URL display
		const urlRow = contentEl.createDiv({ cls: "publish-url-row" });
		setCssProps(urlRow, {
			marginBottom: "12px"
		});

		const urlLabel = urlRow.createEl("label", { text: "Page URL:" });
		setCssProps(urlLabel, {
			display: "block",
			marginBottom: "4px",
			fontSize: "13px",
			fontWeight: "500"
		});

		const urlContainer = urlRow.createDiv();
		setCssProps(urlContainer, {
			display: "flex",
			gap: "8px",
			alignItems: "center"
		});

		this.urlDisplayEl = urlContainer.createDiv();
		setCssProps(this.urlDisplayEl, {
			flex: "1",
			padding: "8px 12px",
			backgroundColor: "var(--background-secondary)",
			border: "1px solid var(--background-modifier-border)",
			borderRadius: "4px",
			fontFamily: "var(--font-monospace)",
			fontSize: "13px",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		});
		this.updateUrlDisplay();

		// Copy button
		const copyBtn = urlContainer.createEl("button");
		setCssProps(copyBtn, {
			padding: "8px 12px",
			borderRadius: "4px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		});
		// Create SVG icon programmatically to avoid innerHTML security issues
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", "16");
		svg.setAttribute("height", "16");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("fill", "none");
		svg.setAttribute("stroke", "currentColor");
		svg.setAttribute("stroke-width", "2");
		svg.setAttribute("stroke-linecap", "round");
		svg.setAttribute("stroke-linejoin", "round");

		const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		rect.setAttribute("x", "9");
		rect.setAttribute("y", "9");
		rect.setAttribute("width", "13");
		rect.setAttribute("height", "13");
		rect.setAttribute("rx", "2");
		rect.setAttribute("ry", "2");

		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

		svg.appendChild(rect);
		svg.appendChild(path);
		copyBtn.appendChild(svg);
		copyBtn.addEventListener("click", () => {
			void navigator.clipboard.writeText(this.getFullUrl()).then(() => {
				new Notice("URL copied to clipboard");
			});
		});

		// Slug editor row
		const slugRow = contentEl.createDiv({ cls: "publish-slug-row" });
		setCssProps(slugRow, {
			marginBottom: "16px"
		});

		const slugLabel = slugRow.createEl("label", { text: "Custom slug (optional):" });
		setCssProps(slugLabel, {
			display: "block",
			marginBottom: "4px",
			fontSize: "13px",
			fontWeight: "500"
		});

		const slugInput = slugRow.createEl("input", {
			type: "text",
			value: this.slug,
			placeholder: "e.g., my-custom-slug"
		});
		setCssProps(slugInput, {
			width: "100%",
			padding: "8px",
			border: "1px solid var(--background-modifier-border)",
			borderRadius: "4px",
			fontFamily: "var(--font-monospace)",
			fontSize: "13px"
		});

		slugInput.addEventListener("input", () => {
			this.slug = slugInput.value;
			this.updateUrlDisplay();
		});

		// Buttons row
		const buttonRow = contentEl.createDiv({ cls: "publish-button-row" });
		setCssProps(buttonRow, {
			display: "flex",
			gap: "8px",
			justifyContent: "flex-end"
		});

		const publishButton = buttonRow.createEl("button", {
			text: "Publish",
			cls: "mod-cta"
		});
		setCssProps(publishButton, {
			padding: "8px 16px"
		});
		publishButton.addEventListener("click", () => {
			if (!this.slug) {
				new Notice("Please enter a URL slug");
				return;
			}
			this.onSubmit(this.slug);
			this.close();
		});

		// Check if file is already published
		const isPublished = this.plugin.settings.publishedPages.some(
			p => p.filePath === this.file.path
		);

		if (isPublished) {
			const unpublishButton = buttonRow.createEl("button", {
				text: "Unpublish"
			});
			setCssProps(unpublishButton, {
				padding: "8px 16px"
			});
			unpublishButton.addEventListener("click", () => {
				this.onUnpublish();
				this.close();
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
