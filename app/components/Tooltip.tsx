"use client";

import React, { useId } from "react";

type Props = {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: "top" | "right" | "bottom" | "left";
  className?: string;
};

export function Tooltip({ content, children, position = "top", className }: Props) {
  const positionClasses = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  } as const;

  const posCls = positionClasses[position] ?? positionClasses.top;

  // Generate an id for the tooltip and forward it to the child via aria-describedby,
  // assuming children won't have their own aria-describedby
  const tooltipId = useId();

  const childProps = (children.props ?? {}) as Record<string, unknown>;
  const extraProps: Record<string, unknown> = { ...(childProps as Record<string, unknown>) };
  extraProps["aria-describedby"] = tooltipId;

  const cls = `pointer-events-none absolute z-10 ${posCls} whitespace-normal text-white text-sm shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150`;
  const visualClasses = `min-w-[20rem] px-6 py-4 leading-[1.75] text-lg font-semibold rounded-[40px] delay-100 group-hover:delay-100 group-focus-within:delay-100 bg-[rgb(209,139,71)]`;

  /* TW classes correspond to the below styles:
    const styleProps: React.CSSProperties = {
        backgroundColor: "rgb(209 139 71)",
        minWidth: "20rem",
        padding: "1rem 1.5rem",
        lineHeight: 1.75,
        fontWeight: 600,
        borderRadius: 40,
        transitionDelay: "100ms",
    };*/
  return (
    <div className="group relative inline-block">
      {React.cloneElement(children, extraProps)}

      <div
        id={tooltipId}
        role="tooltip"
        aria-hidden={false}
        className={`${cls} ${visualClasses}${className ? ` ${className}` : ""}`}
      >
        {content}
      </div>
    </div>
  );
}

export default Tooltip;
