import type { ReactNode } from "react";

type IconProps = {
  size?: number;
  className?: string;
};

function Icon({ size = 24, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function DocumentIcon({ size = 24, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M7 3.75h7.1L19.25 8.9V20.25H7z" />
      <path d="M14 3.75V9h5.25" />
      <path d="M9.5 13h5.5" />
      <path d="M9.5 16.5h5.5" />
    </Icon>
  );
}

export function UploadIcon({ size = 24, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M12 16.5V5" />
      <path d="M8.25 8.25 12 4.5l3.75 3.75" />
      <path d="M5 19.5h14" />
    </Icon>
  );
}

export function SearchDocumentIcon({ size = 24, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M6 4.75h7.2L17 8.6V13" />
      <path d="M13.2 4.75V8.75H17" />
      <circle cx="15" cy="16" r="3.25" />
      <path d="M17.4 18.4 20.25 21.25" />
    </Icon>
  );
}

export function InfoIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Icon>
  );
}

export function AlertIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
    </Icon>
  );
}

export function CloseIcon({ size = 20, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="M7 7l10 10" />
      <path d="M17 7 7 17" />
    </Icon>
  );
}

export function ChevronIcon({ size = 18, className }: IconProps) {
  return (
    <Icon size={size} className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}
