export type DeepDiveMode = "separate" | "bundled" | "full";
export const deepDiveMode: DeepDiveMode = "full"; // change to switch modes

export const singleShotCourse = true; // true = load all weeks in one API call

export const progressiveLoading = true; // true = skeleton-first progressive loading (overrides singleShotCourse)
export const prefetchAhead = 2; // number of weeks to fetch in parallel during cascade

export const infiniteScroll = true; // true = generate weeks beyond 10 on scroll
