# Skills Ecosystem Map

> Auto-updated by `post-session-review`. Last update: 2026-04-10

## Skill Graph

```mermaid
graph TD
    subgraph Lifecycle
        US[using-superpowers] -->|session start| GC[gitnexus-context]
        GC -->|calls| LL[load-learnings]
        US -->|session end| PSR[post-session-review]
        PSR -->|calls| CL[capture-learning]
        PSR -->|updates| PR[pending-review.md]
        PSR -->|re-indexes| EMB[GitNexus Embeddings]
        CL -->|validates against| SCH[_schema/]
        CL -->|writes to| LRN[(learnings.md)]
        LL -->|semantic query| EMB
        EMB -->|reads| LRN
    end

    subgraph Process
        BS[brainstorming]
        SD[systematic-debugging]
        WP[writing-plans]
        EP[executing-plans]
        TDD[test-driven-development]
        SDD[subagent-driven-development]
        DPA[dispatching-parallel-agents]
    end

    subgraph Implementation
        FD[frontend-design]
        NBP[next-best-practices]
        VRPB[vercel-react-best-practices]
        UPM[ui-ux-pro-max]
        WDG[web-design-guidelines]
        AW[audit-website]
    end

    subgraph Quality
        VBC[verification-before-completion]
        RCR[requesting-code-review]
        RECV[receiving-code-review]
        FDB[finishing-a-development-branch]
        UGW[using-git-worktrees]
    end

    GC -->|before| SD
    GC -->|before| WP
    BS -->|then| WP
    WP -->|then| EP
    SD -->|uses| TDD

    style US fill:#4CAF50,color:#fff
    style GC fill:#2196F3,color:#fff
    style LL fill:#FF9800,color:#fff
    style CL fill:#FF9800,color:#fff
    style PSR fill:#FF9800,color:#fff
    style EMB fill:#9C27B0,color:#fff
    style PR fill:#f44336,color:#fff
    style SCH fill:#607D8B,color:#fff
    style LRN fill:#607D8B,color:#fff
```

## Skill Inventory

| Skill | Type | Learnings | Confidence avg |
|-------|------|-----------|---------------|
| using-superpowers | lifecycle | 0 | — |
| gitnexus-context | lifecycle | 0 | — |
| load-learnings | lifecycle | 0 | — |
| capture-learning | lifecycle | 0 | — |
| post-session-review | lifecycle | 0 | — |
| brainstorming | process | 0 | — |
| systematic-debugging | process | 0 | — |
| writing-plans | process | 0 | — |
| executing-plans | process | 0 | — |
| test-driven-development | process | 0 | — |
| subagent-driven-development | process | 0 | — |
| dispatching-parallel-agents | process | 0 | — |
| frontend-design | implementation | 0 | — |
| next-best-practices | implementation | 0 | — |
| vercel-react-best-practices | implementation | 0 | — |
| ui-ux-pro-max | implementation | 0 | — |
| web-design-guidelines | implementation | 0 | — |
| audit-website | implementation | 0 | — |
| verification-before-completion | quality | 0 | — |
| requesting-code-review | quality | 0 | — |
| receiving-code-review | quality | 0 | — |
| finishing-a-development-branch | quality | 0 | — |
| using-git-worktrees | quality | 0 | — |

## Learning Stats

- **Total learnings**: 0
- **Global**: 0 | **Project-specific**: 0
- **Average confidence**: —
- **Pending review**: 0
- **Deprecated**: 0
- **Semantic index**: active (embeddings enabled)
