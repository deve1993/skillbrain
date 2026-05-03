export interface ScanResult {
    detected: {
        name: string;
        displayName?: string;
        repoUrl?: string;
        mainBranch?: string;
        startedAt?: string;
        stack: string[];
        language?: string;
        packageManager?: string;
        nodeVersion?: string;
        dbType?: string;
        cmsType?: string;
        cmsAdminUrl?: string;
        deployPlatform?: string;
        hasCi: boolean;
        integrations: Record<string, string>;
        legalCookieBanner?: string;
        envVarNames: string[];
    };
    missing: Array<{
        field: string;
        prompt: string;
    }>;
}
export declare function scanProject(workspacePath: string): ScanResult;
//# sourceMappingURL=project-scanner.d.ts.map