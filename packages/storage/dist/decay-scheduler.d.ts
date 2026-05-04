export interface DecaySchedulerOpts {
    runner: () => void | Promise<void>;
    intervalMs: number;
}
export declare function startDecayScheduler(opts: DecaySchedulerOpts): () => void;
//# sourceMappingURL=decay-scheduler.d.ts.map