// Shared Tailwind class string constants to reduce duplication across components
export const navInner = "mx-auto max-w-7xl flex items-center justify-start flex-wrap gap-x-4 gap-y-2 px-4 py-3"; // gap-y for the wrapped lines to have vertical spacing on mobile
export const card = "rounded-md border border-zinc-200 bg-white p-4 shadow-sm";
export const pageContainer = "max-w-7xl mx-auto px-4";
export const headerRow = "flex items-center justify-center gap-4 mb-8";
export const colStack = "flex flex-col";
export const gridTwoCol = "grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6";

export const mutedSm = "text-sm text-zinc-500";
export const mutedXs = "text-xs font-medium text-zinc-600";
export const uppercasedLabel = "text-xs uppercase tracking-wide text-zinc-500";
export const heading1 = "mx-auto px-3 text-3xl font-extrabold text-center";

export const formInput =
  "rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300";

export const primaryBtn = "px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700";
export const primaryBtnLg =
  "inline-block rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2";

export const linkPrimary =
  "inline-flex items-center gap-3 text-sky-600 font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-sky-300 rounded";

export const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-2 py-[6px] text-sm hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed";

export const selectedModeClass =
  "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200 disabled:cursor-default disabled:bg-sky-200 disabled:opacity-[1]";

export const primaryButtonBase =
  "rounded-md px-3 py-[6px] text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed";

// Variant of card used for neutral panels (lighter background)
export const panel = "rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800";

// Page-specific helpers (used by judge page)
export const sectionHeading = "text-center text-lg font-semibold mb-3 text-zinc-800";
export const errorAlert = "px-4 py-3 rounded-md text-center text-sm bg-red-100 text-red-800";

// Table utilities
export const tableHeader = "px-3 py-2 text-center text-xs font-semibold text-zinc-600";
export const tableCell = "px-3 py-2 text-center font-semibold";
