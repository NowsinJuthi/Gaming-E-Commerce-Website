export const HERO_SLIDER_DESIGNS = [
  "fade",
  "slide-left",
  "slide-right",
  "zoom",
  "glow",
  "cinema",
  "shimmer",
  "spotlight",
  "flip-3d",
  "cube-left",
  "cube-right",
  "depth-dive",
  "tilt-parallax",
  "hologram",
  "portal",
  "float-3d",
  "aurora",
  "neon-pulse",
  "wave-rise",
  "glitch",
  "vortex",
  "prism",
  "liquid",
  "lightning",
  "curtain",
  "orbit",
  "dreamy",
  "pixel-reveal",
] as const;

export type HeroSliderDesign = (typeof HERO_SLIDER_DESIGNS)[number];

/** True 3D presentation modes — each has its own deco + CSS identity. */
export const HERO_3D_DESIGNS = [
  "flip-3d",
  "cube-left",
  "cube-right",
  "depth-dive",
  "tilt-parallax",
  "hologram",
  "portal",
  "float-3d",
  "aurora",
  "neon-pulse",
  "vortex",
  "prism",
  "liquid",
  "lightning",
  "orbit",
  "dreamy",
] as const satisfies readonly HeroSliderDesign[];

export type Hero3dDesign = (typeof HERO_3D_DESIGNS)[number];

export type HeroDesignLayers = {
  grid: boolean;
  shine: boolean;
  deco: boolean;
};

const HERO_DESIGN_LAYERS: Record<HeroSliderDesign, HeroDesignLayers> = {
  fade: { grid: false, shine: false, deco: false },
  "slide-left": { grid: false, shine: false, deco: false },
  "slide-right": { grid: false, shine: false, deco: false },
  zoom: { grid: false, shine: false, deco: false },
  glow: { grid: false, shine: true, deco: false },
  cinema: { grid: false, shine: false, deco: false },
  shimmer: { grid: false, shine: true, deco: false },
  spotlight: { grid: false, shine: false, deco: false },
  "flip-3d": { grid: false, shine: true, deco: false },
  "cube-left": { grid: false, shine: false, deco: false },
  "cube-right": { grid: false, shine: false, deco: false },
  "depth-dive": { grid: false, shine: false, deco: false },
  "tilt-parallax": { grid: false, shine: true, deco: false },
  hologram: { grid: false, shine: false, deco: false },
  portal: { grid: false, shine: true, deco: false },
  "float-3d": { grid: false, shine: true, deco: false },
  aurora: { grid: false, shine: false, deco: false },
  "neon-pulse": { grid: false, shine: false, deco: false },
  "wave-rise": { grid: false, shine: false, deco: false },
  glitch: { grid: false, shine: false, deco: false },
  vortex: { grid: false, shine: false, deco: false },
  prism: { grid: false, shine: true, deco: false },
  liquid: { grid: false, shine: false, deco: false },
  lightning: { grid: false, shine: false, deco: false },
  curtain: { grid: false, shine: false, deco: false },
  orbit: { grid: false, shine: false, deco: false },
  dreamy: { grid: false, shine: false, deco: false },
  "pixel-reveal": { grid: false, shine: false, deco: false },
};

export function getHeroDesignLayers(design: HeroSliderDesign): HeroDesignLayers {
  return HERO_DESIGN_LAYERS[design];
}

export function isHero3dDesign(design: HeroSliderDesign): design is Hero3dDesign {
  return (HERO_3D_DESIGNS as readonly string[]).includes(design);
}

export function isHeroEnhancedDesign(design: HeroSliderDesign): boolean {
  return isHero3dDesign(design);
}

export function pickRandomHeroDesign(exclude?: HeroSliderDesign): HeroSliderDesign {
  const pool =
    exclude && HERO_SLIDER_DESIGNS.length > 1
      ? HERO_SLIDER_DESIGNS.filter((design) => design !== exclude)
      : [...HERO_SLIDER_DESIGNS];
  return pool[Math.floor(Math.random() * pool.length)] ?? "fade";
}

export function pickRandomHero3dDesign(exclude?: Hero3dDesign): Hero3dDesign {
  const pool =
    exclude && HERO_3D_DESIGNS.length > 1
      ? HERO_3D_DESIGNS.filter((design) => design !== exclude)
      : [...HERO_3D_DESIGNS];
  return pool[Math.floor(Math.random() * pool.length)] ?? "flip-3d";
}
