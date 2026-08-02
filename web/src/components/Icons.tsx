import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

// Logotipo: libro abierto con lomo y lineas ruladas, el mismo trazo usado
// en la identidad de marca (ficha de bitacora de obra).
export function LogoMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polygon points="12,4 3,6 3,19 12,21" />
      <polygon points="12,4 21,6 21,19 12,21" />
      <line x1="12" y1="4" x2="12" y2="21" />
      <line x1="14.5" y1="9.5" x2="18.5" y2="9" />
      <line x1="14.5" y1="13" x2="18.5" y2="12.5" />
      <line x1="14.5" y1="16.5" x2="18.5" y2="16" />
    </svg>
  );
}

export function IconResumen(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <line x1="7" y1="9" x2="17" y2="9" />
      <line x1="7" y1="13" x2="14" y2="13" />
      <line x1="7" y1="17" x2="11" y2="17" />
    </svg>
  );
}

// Grua de obra: representa el modulo de Obras / Mis obras.
export function IconObras(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="6" y1="20" x2="6" y2="4" />
      <line x1="6" y1="5" x2="18" y2="8" />
      <line x1="6" y1="8.5" x2="13" y2="10" />
      <line x1="16" y1="8.3" x2="16" y2="13" />
      <line x1="3" y1="20" x2="10" y2="20" />
    </svg>
  );
}

export function IconPersonas(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20a7 6 0 0 1 14 0" />
    </svg>
  );
}

export function IconHerramientas(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6.2" cy="6.2" r="2.6" />
      <line x1="8" y1="8" x2="16.8" y2="16.8" />
      <line x1="15" y1="19" x2="19" y2="15" />
    </svg>
  );
}

export function IconReportes(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polygon points="7,3 14,3 18,7 18,21 7,21" />
      <polyline points="14,3 14,7 18,7" />
      <line x1="9.3" y1="11.5" x2="15.5" y2="11.5" />
      <line x1="9.3" y1="15" x2="15.5" y2="15" />
      <line x1="9.3" y1="18.2" x2="13" y2="18.2" />
    </svg>
  );
}

export function IconHistorial(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="12" x2="12" y2="7.5" />
      <line x1="12" y1="12" x2="15.3" y2="14" />
    </svg>
  );
}

export function IconEmpresa(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="11" height="18" />
      <rect x="15" y="10" width="5" height="11" />
      <rect x="6.7" y="6" width="2" height="2" />
      <rect x="10.3" y="6" width="2" height="2" />
      <rect x="6.7" y="10.5" width="2" height="2" />
      <rect x="10.3" y="10.5" width="2" height="2" />
      <rect x="6.7" y="15" width="2" height="2" />
      <rect x="10.3" y="15" width="2" height="2" />
      <rect x="16.7" y="13" width="1.6" height="1.6" />
    </svg>
  );
}

export function IconSeguridad(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="10" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.4" r="1.2" fill="currentColor" stroke="none" />
      <line x1="12" y1="16.6" x2="12" y2="18.1" />
    </svg>
  );
}
