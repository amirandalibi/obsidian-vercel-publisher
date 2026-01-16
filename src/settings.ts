import { App, PluginSettingTab, Setting } from "obsidian";
import type VercelPublisherPlugin from "./main";

export interface PublishedPage {
	filePath: string;
	slug: string;
	publishedAt: number;
	deploymentId?: string;  // Track deployment ID for deletion
}

export interface VercelPublisherSettings {
	exportFolder: string;
	vercelApiToken: string;
	vercelProjectName: string;
	publishedPages: PublishedPage[];
}

export const DEFAULT_SETTINGS: VercelPublisherSettings = {
	exportFolder: "_exported",
	vercelApiToken: "",
	vercelProjectName: "",
	publishedPages: []
}

export class VercelPublisherSettingTab extends PluginSettingTab {
	plugin: VercelPublisherPlugin;

	constructor(app: App, plugin: VercelPublisherPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		;

		// Export section
		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("Export folder")
			.setDesc("Folder where HTML files will be exported locally (relative to vault root)")
			.addText(text => text
				.setPlaceholder("_exported")
				.setValue(this.plugin.settings.exportFolder)
				.onChange(async (value) => {
					this.plugin.settings.exportFolder = value;
					await this.plugin.saveSettings();
				}));

		// Vercel section
		new Setting(containerEl).setName("Vercel").setHeading();

		const vercelDesc = containerEl.createEl("p", {
			text: "To publish to Vercel, you need an API token and project name. ",
			cls: "setting-item-description"
		});
		vercelDesc.createEl("a", {
			text: "Get your Vercel API token here",
			href: "https://vercel.com/account/tokens"
		});

		new Setting(containerEl)
			.setName("Vercel API token")
			.setDesc("Your Vercel API token (keep this secret!)")
			.addText(text => {
				text.setPlaceholder("Enter your Vercel API token")
					.setValue(this.plugin.settings.vercelApiToken)
					.onChange(async (value) => {
						this.plugin.settings.vercelApiToken = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Vercel project name")
			.setDesc("The name of your Vercel project (will be created if it doesn't exist)")
			.addText(text => text
				.setPlaceholder("My project")
				.setValue(this.plugin.settings.vercelProjectName)
				.onChange(async (value) => {
					this.plugin.settings.vercelProjectName = value;
					await this.plugin.saveSettings();
				}));
	}
}
