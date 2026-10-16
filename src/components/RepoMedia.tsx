"use client";

import { useState } from "react";
import { hueOf } from "@/lib/format";

type LogoProps = { logo: string; owner: string; name: string; className?: string };

// Logo with fallbacks: README/org logo, then the owner avatar, then an initial.
export function RepoLogo({ logo, owner, name, className = "size-10" }: LogoProps) {
  const avatar = `https://github.com/${owner}.png?size=96`;
  const [src, setSrc] = useState<string | null>(logo);

  if (!src) {
    return (
      <span
        className={`${className} grid shrink-0 place-items-center rounded-xl font-display text-lg font-bold text-white`}
        style={{ background: `hsl(${hueOf(name)} 45% 42%)` }}
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={`${className} shrink-0 rounded-xl bg-surface object-contain p-0.5 ring-1 ring-line`}
      onError={() => setSrc(src === avatar ? null : avatar)}
    />
  );
}

type ShotProps = { image: string | null; logo: string; owner: string; name: string; eager?: boolean };

// 16:10 screenshot box that never shifts layout; falls back to a tinted panel with the logo.
export function RepoShot({ image, logo, owner, name, eager }: ShotProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hue = hueOf(owner + name);
  const showImage = image && !failed;

  return (
    <div
      className="relative aspect-[16/10] overflow-hidden bg-sunken"
      style={showImage ? undefined : { background: `linear-gradient(135deg, hsl(${hue} 40% 55% / 0.22), hsl(${(hue + 40) % 360} 45% 50% / 0.10))` }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={`Screenshot of ${name}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          // Images in the prerendered HTML can finish before hydration, when onLoad no longer fires.
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setLoaded(true);
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`size-full object-cover object-top transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="grid size-full place-items-center">
          <RepoLogo logo={logo} owner={owner} name={name} className="size-16" />
        </div>
      )}
    </div>
  );
}
