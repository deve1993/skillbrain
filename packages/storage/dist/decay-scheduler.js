// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 Pixarts — contact daniel@pixarts.eu for commercial license
export function startDecayScheduler(opts) {
    const safeRun = async () => {
        try {
            await opts.runner();
        }
        catch (err) {
            console.error('[decay-scheduler] runner failed', err);
        }
    };
    void safeRun();
    const handle = setInterval(safeRun, opts.intervalMs);
    return () => clearInterval(handle);
}
//# sourceMappingURL=decay-scheduler.js.map