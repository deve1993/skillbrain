const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};
let quiet = false;
export function setQuiet(value) {
    quiet = value;
}
export function info(msg) {
    if (!quiet)
        console.log(`${COLORS.cyan}[codegraph]${COLORS.reset} ${msg}`);
}
export function success(msg) {
    if (!quiet)
        console.log(`${COLORS.green}[codegraph]${COLORS.reset} ${msg}`);
}
export function warn(msg) {
    if (!quiet)
        console.log(`${COLORS.yellow}[codegraph]${COLORS.reset} ${msg}`);
}
export function error(msg) {
    console.error(`${COLORS.red}[codegraph]${COLORS.reset} ${msg}`);
}
export function dim(msg) {
    if (!quiet)
        console.log(`${COLORS.dim}${msg}${COLORS.reset}`);
}
//# sourceMappingURL=logger.js.map