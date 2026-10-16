import { Globe, Puzzle, Server, Sparkles, SquareTerminal } from "lucide-react";
import { siAndroid, siApple, siLinux } from "simple-icons";

type IconProps = { className?: string };

function Brand({ path, className }: { path: string } & IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d={path} />
    </svg>
  );
}

function WindowsGrid({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="8.2" height="8.2" rx="0.6" />
      <rect x="12.8" y="3" width="8.2" height="8.2" rx="0.6" />
      <rect x="3" y="12.8" width="8.2" height="8.2" rx="0.6" />
      <rect x="12.8" y="12.8" width="8.2" height="8.2" rx="0.6" />
    </svg>
  );
}

export function PlatformIcon({ id, className = "size-4" }: { id: string } & IconProps) {
  switch (id) {
    case "android":
      return <Brand path={siAndroid.path} className={className} />;
    case "ios":
    case "macos":
      return <Brand path={siApple.path} className={className} />;
    case "linux":
      return <Brand path={siLinux.path} className={className} />;
    case "windows":
      return <WindowsGrid className={className} />;
    case "web":
      return <Globe className={className} aria-hidden="true" strokeWidth={2} />;
    case "selfhosted":
      return <Server className={className} aria-hidden="true" strokeWidth={2} />;
    case "cli":
      return <SquareTerminal className={className} aria-hidden="true" strokeWidth={2} />;
    case "extension":
      return <Puzzle className={className} aria-hidden="true" strokeWidth={2} />;
    case "ai":
      return <Sparkles className={className} aria-hidden="true" strokeWidth={2} />;
    default:
      return null;
  }
}

export function StarIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
    </svg>
  );
}
