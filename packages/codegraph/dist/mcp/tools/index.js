import { registerMemoryTools } from './memory.js';
import { registerProjectTools } from './projects.js';
import { registerSessionTools } from './sessions.js';
import { registerSkillTools } from './skills.js';
import { registerCodegraphTools } from './codegraph.js';
import { registerComponentTools } from './components.js';
import { registerUserEnvTools } from './users-env.js';
export function registerAllTools(server, ctx) {
    registerMemoryTools(server, ctx);
    registerProjectTools(server, ctx);
    registerSessionTools(server, ctx);
    registerSkillTools(server, ctx);
    registerCodegraphTools(server, ctx);
    registerComponentTools(server, ctx);
    registerUserEnvTools(server, ctx);
}
//# sourceMappingURL=index.js.map