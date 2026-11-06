import React from "react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`brand ${light ? "brand-light" : ""}`}
      href="/"
      aria-label="Seasonal Solutions home"
    >
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-roof" />
        <span className="brand-stem" />
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="brand-name">
        Seasonal <b>Solutions</b>
        <small>WINNIPEG · MANITOBA</small>
      </span>
    </a>
  );
}
