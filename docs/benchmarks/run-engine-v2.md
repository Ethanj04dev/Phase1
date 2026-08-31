# Run Engine distance benchmark

Ruleset v2 · selected pipeline: **kalman_stride** · 3 seeds per condition.
Signed mean % error (positive = over-credit, the dangerous direction) / mean |%| error.

| condition | smooth3 | stride | kalman | kalman_stride |
|---|---|---|---|---|
| clean_open_sky | +0.00% / 0.00% | +0.00% / 0.00% | +0.00% / 0.00% | +0.00% / 0.00% |
| normal_noise | +0.73% / 0.73% | +0.40% / 0.40% | +0.90% / 0.90% | +0.46% / 0.46% |
| heavy_jitter_white | +4.88% / 4.88% | +1.70% / 1.70% | +4.46% / 4.46% | +0.77% / 0.77% |
| temporary_dropout | +0.71% / 0.71% | +0.40% / 0.40% | +0.88% / 0.88% | +0.46% / 0.46% |
| urban_degradation | +2.97% / 2.97% | +1.75% / 1.75% | +3.00% / 3.00% | +1.55% / 1.55% |
| tree_cover | +2.12% / 2.12% | +1.19% / 1.19% | +1.72% / 1.72% | +1.05% / 1.05% |
| slow_running | +2.39% / 2.39% | +1.35% / 1.35% | +2.88% / 2.88% | +0.82% / 0.82% |
| elite_speed | +0.22% / 0.22% | +0.13% / 0.13% | +0.26% / 0.26% | +0.19% / 0.19% |
| track_laps | -1.17% / 1.17% | -3.20% / 3.20% | +1.69% / 1.69% | -0.78% / 0.78% |
| many_turns | -4.16% / 4.16% | -9.57% / 9.57% | +4.12% / 4.12% | -2.05% / 2.05% |
| out_and_back | +0.70% / 0.70% | +0.58% / 0.58% | +1.06% / 1.06% | +0.43% / 0.43% |
| short_run_noisy | +5.01% / 5.01% | +1.82% / 1.82% | +4.51% / 4.51% | +0.80% / 0.80% |

## Verdict behaviour (selected pipeline)

- assessments analysed: 36
- verified: 33 · unable_to_verify: 0
- **false verifications: 0**
- false failures (valid runs failed): 0
- accepted-time mean |error|: 5.8s (max 17.2s)
- uncertainty bound covered the true error in 33/36 runs
