export const isMobile =
  typeof navigator !== "undefined" &&
  /Mobi|Android/i.test(navigator.userAgent);

export const isSmallScreen =
  typeof window !== "undefined" && window.innerWidth < 768;
