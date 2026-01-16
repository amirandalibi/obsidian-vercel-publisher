import { requestUrl } from "obsidian";

export interface VercelFile {
	file: string;  // file path
	data: string;  // file content
	encoding?: "utf-8" | "base64";
}

export interface DeploymentResponse {
	id: string;
	url: string;
	name: string;
	inspectorUrl: string;
	readyState: string;
}

// Internal API response type from Vercel
interface VercelDeploymentApiResponse {
	id: string;
	url: string;
	name: string;
	inspectorUrl?: string;
	readyState?: string;
}

// Internal API response for deployment status
interface VercelDeploymentStatusResponse {
	readyState: string;
}

// Internal API response for deployments list
interface VercelDeploymentsListResponse {
	deployments?: Array<{ uid: string; state: string; created: number }>;
}

export class VercelApi {
	private apiToken: string;
	private projectName: string;
	private baseUrl = "https://api.vercel.com";

	constructor(apiToken: string, projectName: string) {
		this.apiToken = apiToken;
		this.projectName = projectName;
	}

	/**
	 * Deploy files to Vercel
	 */
	async deploy(files: VercelFile[]): Promise<DeploymentResponse> {
		// Create deployment payload - Vercel expects inline file data
		const payload = {
			name: this.projectName,
			files: files.map(f => {
				const fileObj: { file: string; data: string; encoding?: string } = {
					file: f.file,
					data: f.data
				};
				// Include encoding if specified (base64 for images)
				if (f.encoding) {
					fileObj.encoding = f.encoding;
				}
				return fileObj;
			}),
			target: "production"
		};

		try {
			// Create deployment - using skipAutoDetectionConfirmation for static files
			const deploymentResponse = await requestUrl({
				url: `${this.baseUrl}/v13/deployments?skipAutoDetectionConfirmation=1`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.apiToken}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify(payload)
			});

			const deployment = deploymentResponse.json as VercelDeploymentApiResponse;

			// Return deployment info
			return {
				id: deployment.id,
				url: deployment.url,
				name: deployment.name,
				inspectorUrl: deployment.inspectorUrl || `https://vercel.com/deployments/${deployment.id}`,
				readyState: deployment.readyState || "QUEUED"
			};

		} catch (error: unknown) {
			console.error("Vercel deployment error:", error);
			if (error && typeof error === "object" && "json" in error) {
				const apiError = error as { json: { error?: { message?: string } } };
				console.error("Error details:", apiError.json);
				throw new Error(`Vercel API error: ${apiError.json.error?.message || JSON.stringify(apiError.json)}`);
			}
			throw error;
		}
	}


	/**
	 * Get deployment status
	 */
	async getDeploymentStatus(deploymentId: string): Promise<string> {
		const response = await requestUrl({
			url: `${this.baseUrl}/v13/deployments/${deploymentId}`,
			method: "GET",
			headers: {
				"Authorization": `Bearer ${this.apiToken}`
			}
		});

		const data = response.json as VercelDeploymentStatusResponse;
		return data.readyState;
	}

	/**
	 * Wait for deployment to be ready
	 */
	async waitForDeployment(deploymentId: string, maxWaitTime = 300000): Promise<boolean> {
		const startTime = Date.now();
		const pollInterval = 3000; // 3 seconds

		while (Date.now() - startTime < maxWaitTime) {
			const status = await this.getDeploymentStatus(deploymentId);

			if (status === "READY") {
				return true;
			} else if (status === "ERROR" || status === "CANCELED") {
				throw new Error(`Deployment failed with status: ${status}`);
			}

			// Wait before next poll
			await new Promise(resolve => setTimeout(resolve, pollInterval));
		}

		throw new Error("Deployment timeout - took longer than expected");
	}

	/**
	 * Delete a specific deployment
	 */
	async deleteDeployment(deploymentId: string): Promise<void> {
		try {
			await requestUrl({
				url: `${this.baseUrl}/v13/deployments/${deploymentId}`,
				method: "DELETE",
				headers: {
					"Authorization": `Bearer ${this.apiToken}`
				}
			});
		} catch {
			// Don't throw - we want to continue even if some deletions fail
		}
	}

	/**
	 * Get all deployments for the project
	 */
	async getDeployments(): Promise<Array<{ uid: string; state: string; created: number }>> {
		try {
			const response = await requestUrl({
				url: `${this.baseUrl}/v6/deployments?projectId=${this.projectName}`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${this.apiToken}`
				}
			});

			const data = response.json as VercelDeploymentsListResponse;
			return data.deployments || [];
		} catch {
			return [];
		}
	}

	/**
	 * Delete deployments that are not being used by any published pages
	 */
	async deleteUnusedDeployments(activeDeploymentIds: string[]): Promise<void> {
		try {
			const deployments = await this.getDeployments();

			// Only delete deployments that are NOT in the active list
			const deploymentsToDelete = deployments.filter(d => !activeDeploymentIds.includes(d.uid));

			// Delete unused deployments in parallel
			await Promise.all(
				deploymentsToDelete.map(d => this.deleteDeployment(d.uid))
			);
		} catch {
			// Silently fail - don't interrupt the deployment process
		}
	}

	/**
	 * Get project domains
	 */
	async getProjectDomains(): Promise<string[]> {
		try {
			// Get domains from the dedicated domains API endpoint
			// This works even when there's no production deployment
			const domainsResponse = await requestUrl({
				url: `${this.baseUrl}/v9/projects/${this.projectName}/domains`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${this.apiToken}`
				}
			});

			const domainsData = domainsResponse.json as { domains?: Array<{ name: string; verified?: boolean; configured?: boolean }> };
			const domains: string[] = [];

			// Add default Vercel domain first
			domains.push(`${this.projectName}.vercel.app`);

			// Add configured custom domains
			if (domainsData.domains && Array.isArray(domainsData.domains)) {
				// Filter for verified/configured domains only
				const configuredDomains = domainsData.domains
					.filter(d => d.verified || d.configured)
					.map(d => d.name);

				// Add custom domains at the beginning (before vercel domain)
				const customDomains = configuredDomains.filter(d => !d.endsWith(".vercel.app"));
				if (customDomains.length > 0) {
					// Put custom domains first, then vercel domain
					return [...customDomains, `${this.projectName}.vercel.app`];
				}
			}

			return domains;

		} catch {
			// If we can't fetch domains, return default
			return [`${this.projectName}.vercel.app`];
		}
	}

	/**
	 * Validate API token and project
	 */
	async validateCredentials(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: `${this.baseUrl}/v9/projects/${this.projectName}`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${this.apiToken}`
				}
			});

			return response.status === 200;
		} catch {
			return false;
		}
	}
}
