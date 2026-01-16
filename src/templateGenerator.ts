import { App } from "obsidian";

export interface PageData {
	title: string;
	content: string;
	slug: string;
}

export class TemplateGenerator {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	generateHTML(page: PageData): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${this.escapeHtml(page.title)}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet">
	<style>
		:root {
			--background-primary: #F2F0EF;
			--background-secondary: #f5f5f5;
			--text-normal: #546373;
			--text-muted: #6c7680;
			--text-faint: #CBCBCB;
			--interactive-accent: #36404A;
			--interactive-accent-hover: #6D8196;
			--background-modifier-border: #e0e0e0;
			--code-background: #f5f5f5;
			--blockquote-border: #8683a0;
		}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: "IBM Plex Serif", -apple-system, BlinkMacSystemFont, serif;
			line-height: 1.6;
			color: var(--text-normal);
			background: var(--background-primary);
			padding: 0;
		}

		a.internal-link {
			text-decoration: underline;
			text-underline-offset: 4px;
			text-decoration-line: underline;
      		text-decoration-thickness: 1.6px;
		}

		del {
			text-decoration-line: line-through;
  			text-decoration-thickness: 4px;
		}

		.container {
			max-width: 780px;
			margin: 0 auto;
			background: var(--background-primary);
			padding: 40px 30px;
		}

		.header {
			border-bottom: 1px solid var(--background-modifier-border);
			padding-bottom: 20px;
			margin-bottom: 30px;
		}

		.site-title {
			font-size: 1.3rem;
			color: var(--interactive-accent);
			text-decoration: none;
			font-weight: 600;
		}

		.site-title:hover {
			color: var(--interactive-accent-hover);
		}

		.nav {
			margin-top: 15px;
		}

		.nav-links {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			list-style: none;
		}

		.nav-links a {
			color: var(--text-muted);
			text-decoration: none;
			padding: 4px 8px;
			border-radius: 4px;
			transition: all 0.2s;
			font-size: 0.9em;
		}

		.nav-links a:hover {
			color: var(--interactive-accent);
		}

		.nav-links a.active {
			color: var(--interactive-accent);
			font-weight: 500;
		}

		.markdown-content {
			font-size: 16px;
		}

		h1, h2, h3, h4, h5, h6 {
			font-weight: 600;
			line-height: 1.3;
			color: var(--text-normal);
			margin-top: 1.5em;
			margin-bottom: 0.5em;
		}

		h1 {
			font-size: 2em;
			margin-top: 0;
		}

		h2 {
			font-size: 1.6em;
		}

		h3 {
			font-size: 1.37em;
		}

		h4 {
			font-size: 1.25em;
		}

		h5 {
			font-size: 1.12em;
		}

		h6 {
			font-size: 1em;
		}

		p {
			margin-bottom: 1em;
		}

		a {
			color: var(--interactive-accent);
			text-decoration: none;
		}

		a:hover {
			color: var(--interactive-accent-hover);
		}

		strong {
			font-weight: 600;
			color: var(--text-normal);
		}

		em {
			color: var(--text-normal);
		}

		code {
			background: var(--code-background);
			color: #eb5757;
			padding: 0.2em 0.4em;
			border-radius: 3px;
			font-family: "Menlo", "Monaco", "Courier New", monospace;
			font-size: 0.9em;
		}

		pre {
			background: var(--background-secondary);
			color: var(--text-normal);
			padding: 1em;
			border-radius: 4px;
			overflow-x: auto;
			margin: 1em 0;
			line-height: 1.5;
		}

		pre code {
			background: none;
			color: inherit;
			padding: 0;
			font-size: 0.875em;
		}

		blockquote {
			border-left: 2px solid var(--blockquote-border);
			padding-left: 1em;
			margin: 1em 0;
			color: var(--text-muted);
		}

		ul, ol {
			margin: 1em 0;
			padding-left: 2em;
		}

		li {
			margin-bottom: 0.25em;
		}

		li > p {
			margin-bottom: 0.25em;
		}

		hr {
			border: none;
			border-top: 1px solid var(--background-modifier-border);
			margin: 2em 0;
		}

		table {
			border-collapse: collapse;
			width: 100%;
			margin: 1em 0;
		}

		th, td {
			border: 1px solid var(--background-modifier-border);
			padding: 0.5em;
			text-align: left;
		}

		th {
			background: var(--background-secondary);
			font-weight: 600;
		}

		img {
			max-width: 100%;
			height: auto;
			margin: 1em 0;
		}

		.task-list-item {
			list-style: none;
		}

		.task-list-item input[type="checkbox"] {
			margin-right: 0.5em;
		}

		@media (max-width: 768px) {
			.container {
				padding: 20px 15px;
			}

			h1 {
				font-size: 1.75em;
			}

			h2 {
				font-size: 1.5em;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<main class="content">
			<h1>${this.escapeHtml(page.title)}</h1>
			<div class="markdown-content">
				${page.content}
			</div>
		</main>
	</div>
</body>
</html>`;
	}


	private escapeHtml(text: string): string {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}
}
