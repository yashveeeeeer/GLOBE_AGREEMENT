export const isSmallScreen =
  typeof window !== "undefined" && window.innerWidth < 768;

export const isMobile =
  isSmallScreen ||
  (typeof navigator !== "undefined" &&
    /Mobi|Android/i.test(navigator.userAgent));
