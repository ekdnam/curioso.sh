export const geminiModel = "gemini-3-flash-preview";

export type DeepDiveMode = "separate" | "bundled" | "full";
export const deepDiveMode: DeepDiveMode = "full"; // change to switch modes

export const singleShotCourse = true; // true = load all weeks in one API call

export const progressiveLoading = true; // true = skeleton-first progressive loading (overrides singleShotCourse)
export const prefetchAhead = 2; // number of weeks to fetch in parallel during cascade

export const infiniteScroll = true; // true = generate weeks beyond 10 on scroll

export const prefetchRecommendations = true; // true = proactively prefetch upcoming weeks
export const prefetchCount = 3; // how many weeks to keep buffered ahead of consumption frontier

export const roadmapBatchSize = 20; // how many topics to batch-predict at once
export const roadmapRefetchThreshold = 5; // refetch roadmap when fewer than this many topics remain
export const maxPrefetchCount = 10; // upper bound for dynamic prefetch count
