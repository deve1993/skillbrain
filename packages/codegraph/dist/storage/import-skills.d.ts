/**
 * Import skills, agents, and commands from filesystem into SQLite.
 *
 * Walks .opencode/skill/, .agents/skills/, .opencode/agents/, .opencode/command/
 * and imports all SKILL.md, AGENT.md, and command .md files.
 */
export declare function importSkills(workspacePath: string): {
    skills: number;
    agents: number;
    commands: number;
};
//# sourceMappingURL=import-skills.d.ts.map